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

package com.debiki.core

import com.debiki.core.Prelude._
import play.api.libs.json.JsObject
import com.debiki.core.Prelude.MessAborter
import com.debiki.core.RetryNr.Automatic


object Webhook {
  val NewUnconfigured: Webhook = Webhook(
        id = 1,
        ownerId = Group.AdminsId,
        runAsId  = Some(Pat.SysbotUserId),
        enabled = false,
        deleted = false,
        descr = None,
        sendToUrl = "https://example.com",
        //checkDestCert: Bo,
        //sendEventTypes: Set[EventType],
        //sendEventSubTypes: Set[EventSubType],
        apiVersion = None,
        //sendMaxReqsPerSec: Opt[f32],
        sendMaxEventsPerReq = None,
        //sendMaxDelaySecs: i32,
        sendCustomHeaders = None,
        retryMaxSecs = None,
        retryExtraTimes = None)(IfBadDie)
}


// COULD split into WebhookConf and WebhookState, the former updated by admins,
// the latter by the server only?
//
/** Each Webhook instance represents an external server that wants to get
  * notified via webhooks, from Talkyard.
  */
case class Webhook(
  id: WebhookId,

  // ----- Conf (could be own class)

  // Who may edit this webhook conf. For now, admins only.
  ownerId:  PatId,

  // Only sends events about things that run_as_id_c can see. None means strangers.
  runAsId:  Opt[PatId],

  enabled: Bo,
  deleted: Bo,
  descr: Opt[St],
  sendToUrl: St,
  // If should check the TLS cert of the send_to_url_c.
  //checkDestCert: Bo,
  //sendEventTypes: Set[EventType],
  //sendEventSubTypes: Set[EventSubType],
  apiVersion: Opt[St],
  //toExtAppVersion: Opt[St]
  //sendMaxReqsPerSec: Opt[f32],
  // Default 1. Max 500? (Zapier limit)
  sendMaxEventsPerReq: Opt[i32],
  // How long to wait, between each batch.
  //sendMaxDelaySecs: i32,
  sendCustomHeaders: Opt[JsObject],
  retryMaxSecs: Opt[i32],
  // Maybe change to retryOnceMore: Bo  ?
  retryExtraTimes: Opt[i32],

  // ----- State (could be own class)

  failedSince: Opt[When] = None,
  lastFailedHow: Opt[SendFailedHow] = None,
  lastErrMsgOrResp: Opt[St] = None,
  // Doesn't include manual retries (triggered via the admin UI), only automatic retries.
  retriedNumTimes: Opt[i32] = None,
  retriedNumSecs: Opt[i32] = None,
  brokenReason: Opt[WebhookBrokenReason] = None,

  sentUpToWhen: When = When.Genesis,
  sentUpToEventId: Opt[i32] = None,
  numPendingMaybe: Opt[i32] = None,
  doneForNow: Opt[Bo] = None,
  //retryEventIds: Set[EventId]
  //skipEventTypes: __ — auto updated, if endpoint fails always for these types?
  //skipEventSubtypes: __
  )(mab: MessAborter) {

  // Later: >= 1 instead of == 1. The tests already use many (two) webhooks per site.
  mab.check(if (com.debiki.core.isDevOrTest) id >= 1 else id == 1,
      "TyEWBHKS01", "The webhook id must be 1, for now")  // [only_1_webhook]
  // For now:
  mab.abortIf(ownerId != Group.AdminsId, "TyE03MEJA46", "ownerId must be the admins group")
  mab.abortIf(runAsId isNot SysbotUserId, "TyE03ME7A47W", "runAsId must be sysbot")  // [webhook_alw_sysbot]
  mab.abortIf(descr.exists(_.length > 250), "TyE034EJA4M5")  // [db_constrs]
  mab.abortIf(sendToUrl.obviouslyBadUrl, "TyEWBHK5012MS", "Invalid sendToUrl")
  mab.abortIf(apiVersion.isSomethingButNot("0.0.1"), "TyEWB012M7", "API version must be 0.0.1")

  //sendMaxReqsPerSec
  mab.check(sendMaxEventsPerReq.forall(_ >= 1),
        "TyEWBHK0BRNK2", s"Must send >= 1 events per request, but sendMaxEventsPerReq is: ${
        sendMaxEventsPerReq}")
  // For now:
  mab.check(sendMaxEventsPerReq.forall(_ == 1),  // [whks_1_event]
        "TyEWBHK0BRNK9", s"Must send == 1 events per request, but sendMaxEventsPerReq is: ${
        sendMaxEventsPerReq}")

  //sendMaxDelaySecs

  require(sendCustomHeaders.forall(_.value.nonEmpty), "TyEWBHKSNHDR53")
  // sendCustomHeaders — check that is St -> St map?
  // Already an utility fn for this, somewhere?

  mab.check(retryMaxSecs.forall(_ >= 0),
      "TyEWBHK0BRNK3", "Cannot retry a webhook < 0 seconds")
  mab.check(retryExtraTimes.isEmpty || failedSince.isDefined,
      "TyEWBHK0BRNK", "Cannot retry a webhook that isn't failing")
  mab.check(retryExtraTimes.forall(_ == 1), // could be a bool instead? hmm
      "TyEWBHK0BRNK4", "Cannot retry a webhook <= 0 times")

  mab.check(failedSince.isDefined == lastFailedHow.isDefined, "TyE05MQNSFJ24")
  mab.check(failedSince.isDefined || lastErrMsgOrResp.isEmpty, "TyE05MQNSFJ25")
  mab.check(failedSince.isDefined || retriedNumTimes.isEmpty, "TyE05MQNSFJ26")
  mab.check(failedSince.isDefined || retriedNumSecs.isEmpty, "TyE05MQNSFJ27")

  mab.check(failedSince.isDefined || brokenReason.isEmpty, "TyE05MQNSFJ2M")

  mab.check(retriedNumTimes.forall(_ >= 0), "TyEWBHK052MD")
  mab.check(retriedNumSecs.forall(_ >= 0), "TyEWBHK052MC")

  mab.check(sentUpToEventId.forall(_ >= 1), "TyEWBHK052MW")
  mab.check(numPendingMaybe.forall(_ >= 0), "TyEWBHK052MB")

  //retry_event_ids_c — can check forall >= 1

  def isBroken: Bo = brokenReason.isDefined


  def copyAsWorking(
        sentUpToWhen: When,
        sentUpToEventId: Opt[i32],
        numPendingMaybe: Opt[i32],
        doneForNow: Opt[Bo]): Webhook =
    copy(retryExtraTimes = None,
          failedSince = None,
          lastFailedHow = None,
          lastErrMsgOrResp = None,
          retriedNumTimes = None,
          retriedNumSecs = None,
          brokenReason = None,
          sentUpToWhen = sentUpToWhen,
          sentUpToEventId = sentUpToEventId,
          numPendingMaybe = numPendingMaybe,
          doneForNow = doneForNow)(IfBadDie)


  def copyWithFailure(failedReq: WebhookReqOut, now: When, retryMaxSecs: i32): Webhook = {
    val failedHow = failedReq.failedHow.getOrDie(
          "TyE603MEPJ4", "The webhook req didn't fail; cannot copy-with-failure")

    val failedSeconds = math.max(failedSince.map(now.secondsSince).map(_.toInt) getOrElse 0,
          0) // maybe someone changes the server clock

    val brokenReason = failedHow match {
      case SendFailedHow.BadConfig => Some(WebhookBrokenReason.BadConfig)
      case SendFailedHow.TalkyardBug => Some(WebhookBrokenReason.TalkyardBug)
      case _ =>
        if (failedSeconds <= retryMaxSecs) {
          // Keep trying a bit longer.
          None
        }
        else {
          Some(WebhookBrokenReason.RequestFails)
        }
    }

    /* Or just set to None? Done (below).
    val nextRetryExtra =
          if (!failedReq.retryNr) retryExtraTimes
          else if (retryExtraTimes.forall(_ <= 1)) None
          else Some(retryExtraTimes.get - 1) */

    // Don't bump the retries counter, if did manually — otherwise, the exp backoff
    // would happen too fast.
    val nextRetriedNumTimes =
          if (failedReq.retryNr.exists(_.isManual)) retriedNumTimes
          else retriedNumTimes.map(_ + 1) orElse Some(0)

    copy(retryExtraTimes = None,
          failedSince = When.anyEarliestOf(failedSince, Some(now)),
          lastFailedHow = Some(failedHow),
          lastErrMsgOrResp = failedReq.errMsg orElse failedReq.respBody,
          retriedNumTimes = nextRetriedNumTimes,
          retriedNumSecs = Some(failedSeconds),
          brokenReason = brokenReason,
          // Don't update sentUpToWhen/ToEventId etc — we'd like to continue where we stopped,
          // when the network / remote endpoint starts working again.
          )(IfBadDie)
  }
}



sealed abstract class WebhookBrokenReason(val IntVal: i32) { def toInt: i32 = IntVal }

object WebhookBrokenReason {
  case object BadConfig extends WebhookBrokenReason(1)
  case object RequestFails extends WebhookBrokenReason(2)
  case object AdminsMarkedItBroken extends WebhookBrokenReason(3)
  case object TalkyardBug extends WebhookBrokenReason(9)

  def fromOptInt(value: Opt[i32]): Opt[WebhookBrokenReason] = value map {
    case BadConfig.IntVal => BadConfig
    case RequestFails.IntVal => RequestFails
    case AdminsMarkedItBroken.IntVal => AdminsMarkedItBroken
    case TalkyardBug.IntVal => TalkyardBug
    case _ => return None
  }
}



case class WebhookReqOut(
  webhookId: WebhookId,
  reqNr: i32,

  sentAt: When,
  sentAsId: Opt[PatId],
  sentToUrl: St,
  sentByAppVer: St,
  sentApiVersion: St,
  //sentToExtAppVersion: Opt[St]
  sentEventTypes: Set[EventType],
  //sentEventSubtypes: Set[EventSubtype],
  sentEventIds: Set[EventId],
  sentJson: JsObject,
  sentHeaders: Opt[JsObject],

  retryNr: Opt[RetryNr],

  failedAt: Opt[When] = None,
  failedHow: Opt[SendFailedHow] = None,
  errMsg: Opt[St] = None,

  respAt: Opt[When] = None,
  respStatus: Opt[i32] = None,
  respStatusText: Opt[St] = None,
  respBody: Opt[St] = None,
  respHeaders: Opt[JsObject] = None,
) {

  require(webhookId >= 1, "TyEWBHKSNC01")
  require(reqNr >= 1, "TyEWBHKSNC0H")
  require(sentAsId.forall(_ >= Pat.SysbotUserId), "TyEWBHKSNC58")
  require(sentToUrl.nonEmpty, "TyEWBHKSNC02")
  require(sentByAppVer.isTrimmedNonEmpty, "TyEWBHKSNC03")
  require(sentApiVersion == "0.0.1", "TyEWBHKSNC04")
  require(sentEventTypes.nonEmpty, "TyEWBHKSNC05")
  //require(sentEventSubTypes.nonEmpty, "TyEWBHKSNC05B")
  require(sentEventIds.nonEmpty, "TyEWBHKSNC06")
  require(com.debiki.core.isDevOrTest || sentEventIds.size == 1,
        "Only one event at a time, for now [TyEWBHK1EVT") // [whks_1_event]
  require(sentJson.value.nonEmpty, "TyEWBHKSNJSN")
  require(sentHeaders.forall(_.value.nonEmpty), "TyEWBHKSNHDR")
  //require(is-headers-single-map(sentHeaders), "TyEWBHKSNC06B")
  // See: headersToJsonSingleMap — place nearby?

  require(failedAt.isDefined == failedHow.isDefined, "TyEWBHKSNC07")
  require(failedAt.isDefined || errMsg.isEmpty, "TyEWBHKSNC08")

  // [db_constr]
  require(respStatusText.forall(_.length < 120), "TyEWBHKSNC0E")

  // The reply could be just 200 OK — without any response body or anything.
  require(respAt.isDefined || respStatus.isEmpty, "TyEWBHKSNC09")
  require(respAt.isDefined || respStatusText.isEmpty, "TyEWBHKSNC0C")
  require(respAt.isDefined || respBody.isEmpty, "TyEWBHKSNC0A")
  require(respAt.isDefined || respHeaders.isEmpty, "TyEWBHKSNC0B")
  require(respHeaders.forall(_.value.nonEmpty), "TyEWBHKSNC0F")
  //require(is-headers-multi-map(respHeaders), "TyEWBHKSNC06B2")
  // See: headersToJsonMultiMap — place nearby?

  // If we got a response, then, shouldn't have set errMsg, since the
  // request actually succeeded.
  require(errMsg.isEmpty || respBody.isEmpty, "TyEWBHKSNC0D")

  // (We wait until any response body has arrived, before updating the database,
  // so, if respAt.isDefined, then the response body has arrived too.)
  def hasOkResp: Bo = respAt.isDefined && failedAt.isEmpty
  def failed: Bo = failedAt.isDefined
}



sealed abstract class RetryNr(val IntVal: i32) {
  def toInt: i32 = IntVal
  def isManual: Bo
}

object RetryNr {
  case object Manual extends RetryNr(-1) { val isManual = true }
  case class Automatic(nr: i32) extends RetryNr(nr) { val isManual = false }

  def fromOptInt(value: Opt[i32]): Opt[RetryNr] = value map {
    case Manual.IntVal => Manual
    case nr if nr >= 1 => Automatic(nr)
    case _ => return None
  }
}



sealed abstract class SendFailedHow(val IntVal: i32) { def toInt: i32 = IntVal }

object SendFailedHow {
  case object BadConfig extends SendFailedHow(21)
  case object CouldntConnect extends SendFailedHow(31)
  case object RequestTimedOut extends SendFailedHow(41)
  case object OtherException extends SendFailedHow(51)
  case object ErrorResponseStatusCode extends SendFailedHow(61)
  //se object Abandoned extends SendFailedHow(81)
  case object TalkyardBug extends SendFailedHow(91)

  def fromOptInt(value: Opt[i32]): Opt[SendFailedHow] = value map {
    case BadConfig.IntVal => BadConfig
    case CouldntConnect.IntVal => CouldntConnect
    case RequestTimedOut.IntVal => RequestTimedOut
    case OtherException.IntVal => OtherException
    case ErrorResponseStatusCode.IntVal => ErrorResponseStatusCode
    //se Abandoned.IntVal => Abandoned
    case TalkyardBug.IntVal => TalkyardBug
    case _ => return None
  }
}
