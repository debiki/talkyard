/**
 * Copyright (c) 2022 Kaj Magnus Lindberg
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package talkyard.server.events

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.SiteDao
import talkyard.{server => tys}

import play.api.libs.ws._
import play.api.libs.json.Json
import scala.concurrent.Future
import scala.concurrent.duration._
import org.scalactic.{Good, Or, Bad}
import scala.util.{Success, Failure}



case class PreparedWebhookReq(
  req: WebhookReqOut,
  nextConseqEvent: Event)



trait WebhooksSiteDaoMixin {
  self: SiteDao =>


  // Retrying with an exponential backoff factor 3, gives these minute intervals
  // between the retries:  (in Julia:  3 .^ [1:15]' ./ 60 )
  // 0.05  0.15  0.45  1.35  4.05  12.15  36.45  109.35  328.05  984.15  2952.45 ...
  // So, with a max delay of 180 minutes, we'll retry about 30 times, until
  // giving up after max three days. Does that make sense?
  // Maybe it's a bit much — and it'd be higher priority, to email the site admins,
  // if a webhook doesn't work. [notf_adm_broken_webhook]
  val RetryBackoffFactorSecs: f64 =
    // It's boring to wait, when running tests, so retry more often (1.5^... instead of 3^).
    if (globals.isProd) 3 else 1.5

  val MaxRetryDelaySecs: i32 = 180 * 60

  val WebhookRequestTimeoutSecs = 20


  def upsertWebhookConf(webhook: Webhook): Webhook = {
    dieIf(webhook.id != 1, "TyE603MRAEPJ6") // for now [only_1_webhook]

    writeTx { (tx, _) =>
      val webhookBef = tx.loadWebhook(webhook.id) getOrElse Webhook.NewUnconfigured
      // Don't overwrite more fields than needed.  [invw_q]
      var webhookToSave = webhookBef.copy(
            ownerId = webhook.ownerId,
            runAsId = webhook.runAsId,
            enabled = webhook.enabled,
            deleted = webhook.deleted,
            descr = webhook.descr,
            sendToUrl = webhook.sendToUrl,
            //checkDestCert: Bo,
            //sendEventTypes: Set[EventType],
            //sendEventSubTypes: Set[EventSubType],
            apiVersion = webhook.apiVersion,
            //sendMaxReqsPerSec: Opt[f32],
            sendMaxEventsPerReq = webhook.sendMaxEventsPerReq,
            //sendMaxDelaySecs: i32,
            sendCustomHeaders = webhook.sendCustomHeaders,
            retryMaxSecs = webhook.retryMaxSecs,
            retryExtraTimes = webhook.retryExtraTimes,
            )(IfBadAbortReq)

      // If enabling, don't send past event — only future events.
      UX // Actually, maybe should ask the admin what hen wants? See below...
      val isEnabling = !webhookBef.enabled && webhook.enabled
      if (isEnabling) {
        tx.loadEventsFromAuditLog(1, newestFirst = true).headOption foreach { event =>

          // ... This sometimes makes sense:
          val doneUpToId = math.max(event.id, webhookBef.sentUpToEventId getOrElse -1)
          val doneUpToWhen = When.latestOf(event.doneAtWhen, webhookBef.sentUpToWhen)
          webhookToSave = webhookToSave.copyAsWorking(
                sentUpToWhen = doneUpToWhen,
                sentUpToEventId = Some(doneUpToId),
                numPendingMaybe = None,
                doneForNow = None)

          // ... But leaving it as is too, makes sense sometimes as well
          // (if maybe disabling for 10 minutes, to do something, and then resuming
          // — might want to get all events, then).

          COULD_OPTIMIZE // set doneForNow = true and numPendingMaybe = 0.
        }
      }

      tx.upsertWebhook(webhookToSave)
      webhookToSave
    }
  }


  def sendPendingWebhookReqs(webhooks: ImmSeq[Webhook]): U = {
    webhooks foreach { whk =>
      try {
        sendReqsForOneWebhook(whk)
      }
      catch {
        // Don't let one webhook, mess up all webhooks.
        case ex: Exception =>
          logger.error(s"s$siteId: Error sending webhook ${whk.id}, marking it broken", ex)
          writeTx { (tx, _) =>
            COULD // remember this in-memory instead, if for some reason the upsert fails.
            tx.upsertWebhook(whk.copy(
                  failedSince = Some(tx.now),
                  lastFailedHow = Some(SendFailedHow.TalkyardBug),
                  brokenReason = Some(WebhookBrokenReason.TalkyardBug))(IfBadDie))
          }
      }
    }
  }


/** Must be called by one thread only, per webhook — currently the Janitor thread
  * (so, currently one thread for the whole app server process).
  * Otherwise there could e.g. be next-request-nr collisions, and things would get
  * more complicated for no good reason.
  */
  def sendReqsForOneWebhook(webhookMaybeStale: Webhook): U = {
    val (webhook, events: ImmSeq[Event], now_, reqNr: i32, anyRetryNr: Opt[RetryNr]) =
          readTx { tx =>

      // Reload the webhook, so it's from the same transaction, as the last request
      // also loaded below — otherwise, Webhook.sentUpToEventId might be stale
      // — we'd send the same event twice (fine, but slightly bad for performance).
      val webhook = tx.loadWebhook(webhookMaybeStale.id) getOrElse {
        logger.warn(o"""s$siteId: Webhook ${webhookMaybeStale.id} just disappeared?
               [TyEWHKGONE04356]""")
        return ()
      }

      // ----- Webhook broken?

      def brokenPrefix = o"""s$siteId: webhook ${webhook.id}
            didn't work the last ${
            webhook.retriedNumTimes getOrElse "None [TyE5MQDL024]"} times"""

      val lastReq = tx.loadWebhookReqsOutRecentFirst(webhookId = webhook.id, limit = 1)
      val (nextReqNr: i32, anyRetryNr: Opt[RetryNr]) = lastReq.headOption match {
        case None =>
          if (webhook.retriedNumTimes.isDefined) {
            // Could happen, if the webhook got imported, but not the reqs out.
            logger.warn(o"""$brokenPrefix — but why no reqs in webhook_reqs_out_t?
                  Whatever, I'll try again. [TyEWHKREQOUTMSNG]""")
          }
          (1, None)

        case Some(req) =>
          val secsSinceLastReq = tx.now.secondsSince(req.sentAt)
          if (req.hasOkResp || req.failed) {
            // Fine. We send one webhook request at a time — and now, since the last
            // one is over, we can send a request about any next event.
          }
          else {
            // Wait until we've gotten a response (don't send more webhooks until then).
            // But maybe the response never arrived, and the request didn't time out,
            // e.g. because the Ty server shut down? Then, there'll be old requests
            // with no failure or done status. Let's ignore them.
            COULD // add status: SendFailedHow.Abandoned, so it'll be considered done (failed)?
            val whatWebhookAndReq = o"Webhook ${webhook.id} has req ${req.reqNr
                  } about event ids [${req.sentEventIds.mkString(", ")}] in-flight"

            val probablyFailed = secsSinceLastReq > WebhookRequestTimeoutSecs + 10
            if (probablyFailed) {
              logger.debug(o"""s$siteId: $whatWebhookAndReq,
                    but it's old, probably failed. [TyMWHKREQRTY]""")
            }
            else {
              // Still in-flight / in progress. To avoid sending many reqs about the
              // same events, let's wait until this req is done.
              // This also helps us avoid updating the webhook tables from different threads
              // at once. [0_whks_out_db_race]
              logger.debug(o"""s$siteId: $whatWebhookAndReq,
                    I'll wait until it's done. [TyMWHKREQONG]""")
              return ()
            }
          }

          // Retry with exponential backoff, if last req failed.
          // Tests:
          //   - webhooks-retry.2br  TyTE2EWBHKRETRY
          val anyRetryNr: Opt[RetryNr] = webhook.retriedNumTimes map { retriedNumTimes =>
            // Maybe an admin clicked Retry manually?
            if (webhook.retryExtraTimes.exists(_ >= 1)) {
              logger.debug(o"$brokenPrefix. I'll retry, because admin clicked Retry.")
              RetryNr.Manual
            }
            else {
              // Too soon to retry automatically?
              val retryDelay = Math.min(MaxRetryDelaySecs,
                    Math.pow(RetryBackoffFactorSecs, retriedNumTimes))
              if (secsSinceLastReq < retryDelay) {
                if (secsSinceLastReq % 5 == 0) {  // don't log so much
                  logger.debug(o"""$brokenPrefix. I'm waiting, $secsSinceLastReq < $retryDelay
                        retry delay seconds.""")
                }
                return ()
              }
              else {
                logger.debug(o"""$brokenPrefix. I've waited $secsSinceLastReq >= $retryDelay
                      retry delay seconds — retrying, retry nr ${retriedNumTimes + 1} ...""")
                RetryNr.Automatic(retriedNumTimes + 1)
              }
            }
          }

          (req.reqNr + 1, anyRetryNr)
      }

      // ----- Find events to send

      // Maybe break out to own fn?  Dao.loadEvents()?  [load_events_fn]
      val logEntries = tx.loadEventsFromAuditLog(newerOrAt = Some(webhook.sentUpToWhen),
            newerThanEventId = webhook.sentUpToEventId,
            limit = webhook.sendMaxEventsPerReq.getOrElse(1),  // [whks_1_event]
            // We send older events, before more recent events.
            newestFirst = false)

      (webhook,
          logEntries.flatMap(Event.fromAuditLogItem),
          tx.now,
          nextReqNr,
          anyRetryNr)
    }

    COULD_OPTIMIZE // Mark webhooks as done_for_now_c, and mark dirty on new and edited posts.
    if (events.isEmpty)
      return ()

    // ----- Prepare a request

    val reqToSend = generateWebhookRequest(webhook, events, reqNr = reqNr, anyRetryNr
          ) getOrIfBad { problem =>
      // Webhook broken — we'll stop sending; seems the config is invalid somehow,
      // since we couldn't even construct a request.
      val webhookAfter = webhook.copy(
            failedSince = Some(now_),
            lastFailedHow = Some(SendFailedHow.BadConfig),
            lastErrMsgOrResp = Some(problem),
            retriedNumTimes = Some(0),
            retriedNumSecs = Some(0),
            brokenReason = Some(WebhookBrokenReason.BadConfig))(IfBadDie)
      writeTx { (tx, _) =>
        tx.updateWebhookState(webhookAfter)
      }
      return ()
    }

    // ----- Save and send the request

    writeTx { (tx, _) =>
      // The webhook response fields are blank — only the send-to fields, filled in.
      tx.insertWebhookReqOut(reqToSend)
    }

    val futureReqWithResp: Future[WebhookReqOut] = sendWebhookRequest(reqToSend)

    futureReqWithResp onComplete {
      case Success(reqMaybeResp: WebhookReqOut) =>
        // The request might have failed, but at least we tried.
        updWebhookAndReq(webhook, reqMaybeResp, events, now_)
      case Failure(ex: Throwable) =>
        // Shouldn't happen — instead WebhookReqOut.errMsg should have been updated,
        // and saved by the Success case above.
        logger.error("Error sending webhook [TyEWHSNDUNKERR]", ex)
    }
  }



  private def updWebhookAndReq(webhook: Webhook, reqMaybeResp: WebhookReqOut,
          events: ImmSeq[Event], now_ : When): U = {

    // The event ids should be sequential — remember the highest sent.
    val latestByTime = events.maxBy(_.when.millis)
    val latestByEventId = events.maxBy(_.id)
    if (latestByTime.id != latestByEventId.id) {
      // Hmm. But what if 2 or more events, same timestamp?
      warnDevDie("TyELATESTEVENT", "The most recent event by time, is different from " +
            s"by event id. By time: ${latestByTime}, by event id: ${latestByEventId}")
    }

    dieIf(debiki.Globals.isDevOrTest && reqMaybeResp.sentEventIds.size == 1 &&
              reqMaybeResp.sentEventIds.head != latestByEventId.id,
          "TyEWHWWRONGID", // [whks_1_event]
          s"reqMaybeResp.sentEventIds != latestByEventId.id: ${reqMaybeResp.sentEventIds
          } != ${latestByEventId.id}, latestByEventId: $latestByEventId}")

    val webhookAfter = {
      if (reqMaybeResp.hasOkResp) {
        // In case responses somehow arrive out of order, we'd better use max() here.
        // But cannot happen currently? Since we send events one at a time,
        // and wait until it's done, before sending the next one.
        val maxEventIdDone = math.max(latestByEventId.id, webhook.sentUpToEventId getOrElse -1)
        webhook.copyAsWorking(
              sentUpToWhen = latestByTime.when,
              sentUpToEventId = Some(maxEventIdDone),
              numPendingMaybe = None, // unknown
              doneForNow = None)      // unknown
      }
      else {
        val defaultRetryMaxSecs = 3600 * 24 * 3  // 3 days, same as Stripe [add_whk_conf]
        webhook.copyWithFailure(reqMaybeResp, now = now_, retryMaxSecs = defaultRetryMaxSecs)
      }
    }

    // This is in another thread — but the Janitor thread, will wait
    // until we've updated the request as done.  [0_whks_out_db_race]
    writeTx { (tx, _) =>
      tx.updateWebhookState(webhookAfter)  // only updates state fields (not config fields)
      tx.updateWebhookReqOutWithResp(reqMaybeResp)  // only updates response fields
    }
  }



  private def generateWebhookRequest(webhook: Webhook, events: ImmSeq[Event],
        reqNr: i32, retryNr: Opt[RetryNr]): WebhookReqOut Or ErrMsg = {
    dieIf(events.isEmpty, "TyE502MREDL6", "No events to send")

    val runAsUser = webhook.runAsId match {
      case None =>
        // This means "run as a stranger". Not impl [webhook_alw_sysbot].
        None
      case Some(id) =>
        Some(getUser(id) getOrElse {
          val errMsg = s"Webhook run-as user not found, user id: $id [TyE0MWUX46MW]"
          logger.warn(errMsg)
          return Bad(errMsg)
        })
    }

    // Site origin.  Dupl code [603RKDJL5]
    val siteIdsOrigins = theSiteIdsOrigins()
    val avatarUrlPrefix =
          siteIdsOrigins.uploadsOrigin +
            talkyard.server.UploadsUrlBasePath + siteIdsOrigins.pubId + '/'

    val eventsJsonList: ImmSeq[EventAndJson] = EventsParSer.makeEventsListJson(
          events, dao = this, reqer = runAsUser, avatarUrlPrefix)

    val webhookReqBodyJson = Json.obj(
          "origin" -> siteIdsOrigins.siteOrigin,
          "events" -> eventsJsonList.map(_.json))

    val reqToSend = WebhookReqOut(
          webhookId = webhook.id,
          reqNr = reqNr,
          sentAt = now(),
          sentAsId = webhook.runAsId,
          sentToUrl = webhook.sendToUrl,
          sentByAppVer = generatedcode.BuildInfo.dockerTag,
          sentApiVersion = "0.0.1",
          sentEventTypes = eventsJsonList.map(_.event.eventType).toSet,
          //sentEventSubtypes =
          sentEventIds = eventsJsonList.map(_.event.id).toSet,
          sentJson = webhookReqBodyJson,
          sentHeaders = webhook.sendCustomHeaders,

          retryNr = retryNr,

          // We don't know, yet:
          failedAt = None,
          respAt = None,
          // ... etc, None is the default.
          )

    Good(reqToSend)
  }



  private def sendWebhookRequest(reqOut: WebhookReqOut): Future[WebhookReqOut] = {
    val jsonSt: St = reqOut.sentJson.toString()
    val wsClient: WSClient = globals.wsClient
    val request: WSRequest =
          wsClient.url(reqOut.sentToUrl).withHttpHeaders(
              play.api.http.HeaderNames.CONTENT_TYPE -> play.api.http.ContentTypes.JSON,
              play.api.http.HeaderNames.USER_AGENT ->
                  // Move to TyHttp maybe?  [ty_user_agent]
                  s"Talkyard / ${reqOut.sentByAppVer} API-v${reqOut.sentApiVersion}",
              play.api.http.HeaderNames.CONTENT_LENGTH -> jsonSt.length.toString)
              .withRequestTimeout(WebhookRequestTimeoutSecs.seconds)
              // .withConnectionTimeout(2.seconds)  // configured in Play's conf files?

    request.post(jsonSt).map({ response: WSResponse =>
      // Now we're in a different thread.
      try {
        var webhookReqAfter = reqOut.copy(
              respAt = Some(now()),
              respStatus = Some(response.status),
              respBody = Some(response.body),
              respHeaders =
                    if (response.headers.isEmpty) None
                    else Some(tys.http.headersToJsonMultiMap(response.headers)))

        if (200 <= response.status && response.status <= 299) {
          logger.debug(s"OK status ${response.status} in webhook req resp")
        }
        else {
          logger.debug(s"Bad status ${response.status} in webhook req resp")
          webhookReqAfter = webhookReqAfter.copy(
                failedAt  = Some(now()),
                failedHow = Some(SendFailedHow.ErrorResponseStatusCode))
        }

        webhookReqAfter
      }
      catch {
        case ex: Exception =>
          // This'd be a bug in Talkyard? We won't retry the webhook.
          logger.warn(s"Error handling webhook response [TyEPWHK1]", ex)
          reqOut.copy(
                failedAt  = Some(now()),
                failedHow = Some(SendFailedHow.TalkyardBug),
                errMsg = Some(ex.getMessage))
      }
    })(globals.execCtx)
      .recover({
        case ex: Exception =>
          val failedHow = ex match {
            case _: scala.concurrent.TimeoutException => SendFailedHow.RequestTimedOut
            // Unsure precisely which of these are thrown:  (annoying! Would have
            // been better if Play's API returned an Ok Or ErrorEnum-plus-message?)
            case _: io.netty.channel.ConnectTimeoutException => SendFailedHow.CouldntConnect
            case _: java.net.ConnectException => SendFailedHow.CouldntConnect
            case _ => SendFailedHow.OtherException
          }
          logger.info(s"s${siteId}: Error sending webhook: ${ex.getMessage} [TyEPWHK2]")
          reqOut.copy(
                failedAt  = Some(now()),
                failedHow = Some(failedHow),
                errMsg = Some(s"${classNameOf(ex)}: ${ex.getMessage}"))
      })(globals.execCtx)
  }

}
