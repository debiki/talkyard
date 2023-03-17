/**
 * Copyright (C) 2014-2015 Kaj Magnus Lindberg
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

package controllers

import akka.pattern.ask
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{GetEndToEndTestEmail, Nashorn, NumEndToEndTestEmailsSent, RateLimits}
import debiki.dao.PagePartsDao
import debiki.EdHttp._
import debiki.JsonUtils.{parseOptInt32, parseOptSt, parseOptBo}
import talkyard.server.{TyContext, TyController}
import talkyard.server.pop.PagePopularityCalculator
import talkyard.server.pubsub.WebSocketClient
import java.lang.management.ManagementFactory
import java.{io => jio, util => ju}
import javax.inject.Inject
import org.slf4j.Marker
import play.api.libs.json._
import play.{api => p}
import play.api.mvc.{Action, ControllerComponents, Result}
import play.api.http.{Status => p_Status, ContentTypes => p_ContentTypes}
import redis.RedisClient
import scala.concurrent.duration._
import scala.concurrent.{Await, Future}
import scala.concurrent.Future._
import scala.util.Try
import talkyard.server.TyLogging
import talkyard.server.JsX._
import talkyard.server.authn.MinAuthnStrength


/** Intended for troubleshooting, via the browser, and helps running End-to-End tests.
  */
class DebugTestController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) with TyLogging {

  import context.globals
  import context.safeActions.ExceptionAction


  /** If a JS error happens in the browser, it'll post the error message to this
    * endpoint, which logs it, so we'll get to know about client side errors.
    */
  def logBrowserErrors: Action[JsValue] = PostJsonAction(
        RateLimits.BrowserError, MinAuthnStrength.EmbeddingStorageSid12, maxBytes = 10000) {
        request =>
    val allErrorMessages = request.body.as[Seq[String]]
    // If there are super many errors, perhaps all of them is the same error. Don't log too many.
    val firstErrors = allErrorMessages take 20
    firstErrors foreach { message =>
      logger.warn(o"""Browser error,
      ip: ${request.ip},
      user: ${request.user.map(_.id)},
      site: ${request.siteId}
      message: $message
      [DwE4KF6]""")
    }
    Ok
  }


  def showMetrics: Action[Unit] = GetActionRateLimited(RateLimits.ReadsFromCache) { req =>
    throwForbiddenIfBadMetricsKey(req)
    val osMXBean = ManagementFactory.getOperatingSystemMXBean
    val systemLoad = osMXBean.getSystemLoadAverage
    val runtime = Runtime.getRuntime
    val toMegabytes = 0.000001d
    val systemStats = StringBuilder.newBuilder
      .append("System stats: (in megabytes)")
      .append("\n================================================================================")
      .append("\n")
      .append("\nCPU load: ").append(systemLoad)
      .append("\nMax memory: ").append(runtime.maxMemory * toMegabytes)
      .append("\nAllocated memory: ").append(runtime.totalMemory * toMegabytes)
      .append("\nFree allocated memory: ").append(runtime.freeMemory * toMegabytes)
      .append("\nTotal free memory: ").append((
        runtime.freeMemory + runtime.maxMemory - runtime.totalMemory) * toMegabytes)
      .append("\n\nMetrics:\n").toString()

    val outputStream = new jio.ByteArrayOutputStream(100 * 1000)
    val printStream = new jio.PrintStream(outputStream, false, "utf-8")
    val metricsText = try {
      val metricsReporter =
        com.codahale.metrics.ConsoleReporter.forRegistry(globals.metricRegistry)
          .convertRatesTo(ju.concurrent.TimeUnit.SECONDS)
          .convertDurationsTo(ju.concurrent.TimeUnit.MILLISECONDS)
          .outputTo(printStream)
          .build()
      metricsReporter.report()
      systemStats + outputStream.toString("utf-8")
    }
    finally {
      org.apache.lucene.util.IOUtils.closeWhileHandlingException(printStream, outputStream)
    }
    Ok(metricsText) as TEXT
  }


  /** If any error logged recently (the last okMinsAfterErr minutes), returns
    * status 500 Internal Error, otherwise 200 OK.
    * External monitoring systems can then notify any operations people about the error.
    */
  def showNumErrorsLogged(okMinsAfterErr: Opt[Int], apiKey: Opt[St]): Action[Unit] =
          GetActionRateLimited(RateLimits.ReadsFromCache) { req =>
    throwForbiddenIfBadMetricsKey(apiKey)
    val okAftMins = okMinsAfterErr getOrElse 60

    // Dupl code [now_mins].
    val nowMillis = System.currentTimeMillis()
    val nowMins_i64 = nowMillis / MillisPerMinute
    val nowMins = castToInt32(nowMins_i64, IfBadDie)

    val numErrs = talkyard.server.numErrors
    val numWarns = talkyard.server.numWarnings
    val lastErrAtMin: Opt[i32] = numErrs.lastAtUnixMinute()
    val lastErrMinsAgo: Opt[i32] = lastErrAtMin.map(nowMins - _)

    val result = Json.obj(
          "errors" -> Json.obj(
            "lastMinsAgo" -> JsInt32OrNull(lastErrMinsAgo),
            "lastAtUnixMinute" -> numErrs.lastAtUnixMinute(),
            "numSinceStart" -> numErrs.numSinceStart()),
          "warnings" -> Json.obj(
            "lastMinsAgo" -> JsInt32OrNull(numWarns.lastAtUnixMinute.map(nowMins - _)),
            "lastAtUnixMinute" -> numWarns.lastAtUnixMinute(),
            "numSinceStart" -> numWarns.numSinceStart()))

    val statusCode =
          if (lastErrMinsAgo.forall(_ >= okAftMins)) p_Status.OK
          else p_Status.INTERNAL_SERVER_ERROR

    Status(statusCode)(result.toString) as p_ContentTypes.JSON
  }




  def showBuildInfo(apiKey: Opt[String]): Action[Unit] = GetAction { _ =>
    throwForbiddenIfBadMetricsKey(apiKeyInReq,
          // This had better be available by default, otherwise it'd be hopeless
          // to help out with troubleshooting people's self hosted installations.
          okIfNoKeyInConf = true)
    import generatedcode.BuildInfo
    val infoTextBuilder = StringBuilder.newBuilder
      .append("Build info:")
      .append("\n")
      .append("\ndocker tag: ").append(BuildInfo.dockerTag)
      .append("\napp version: ").append(BuildInfo.version)
      .append("\ngit revision: ").append(BuildInfo.gitRevision)
      .append("\ngit branch: ").append(BuildInfo.gitBranch)
      .append("\ngit last commit date: ").append(BuildInfo.gitLastCommitDateUtc)
      .append("\nscala version: ").append(BuildInfo.scalaVersion)
      .append("\nsbt version: ").append(BuildInfo.sbtVersion)
    Ok(infoTextBuilder.toString) as TEXT
  }


  def showFlags: Action[U] = AdminGetAction { req =>
    val globals = req.context.globals
    val respBuilder = StringBuilder.newBuilder
          .append("\n")
          .append("\nSite feature flags: ").append(req.dao.theSite().featureFlags)
          .append("\nServer feature flags: ").append(globals.config.featureFlags)
          .append("\n")
    Ok(respBuilder.toString) as TEXT
  }


  def throwForbiddenIfBadMetricsKey(apiKeyInReq, okIfNoKeyInConf: Bo = false): U = {
    globals.metricsApiKey match {
      case Some(keyInConf) =>
        throwForbiddenIf(apiKeyInReq isNot keyInConf, "TyECOUNTRAPIKEY",
              "Bad counters API key, should be the same as: talkyard.metricsApiKey")
      case None =>
        throwForbiddenIf(!okIfNoKeyInConf && globals.isProdLive, "TyE0METRAPICONF",
              "No talkyard.metricsApiKey specified in conf/play-framework.cons")
    }
  }


  def getE2eTestCounters: Action[Unit] = GetAction { _ =>
    throwForbiddenIf(globals.isProdLive, "TyE0MAGIC", o"""Wave a magic wand, and include in
          the request payload a video recording of the result, in mp4 format, to get access""")
    val dbCounts = com.debiki.dao.rdb.Rdb.getRequestCounts()
    val responseJson = Json.obj(
      "numReportedSpamFalsePositives" -> globals.e2eTestCounters.numReportedSpamFalsePositives,
      "numReportedSpamFalseNegatives" -> globals.e2eTestCounters.numReportedSpamFalseNegatives,
      "numQueriesDone" -> dbCounts.numQueriesDone,
      "numWritesDone" -> dbCounts.numWritesDone,
      )
    OkApiJson(responseJson)
  }


  /** For performance tests. */
  def pingExceptionAction: Action[Unit] = ExceptionAction(cc.parsers.empty) { _ =>
    Ok("exception-action-pong")
  }


  /** For performance tests. */
  def pingApiAction: Action[Unit] = GetAction { _ =>
    Ok("session-action-pong")
  }


  /** For performance tests. */
  def pingCache: Action[Unit] = GetAction { _ =>
    pingCacheImpl()
    Ok("pong pong, from Play and Redis")
  }


  /** For performance tests. */
  def pingCacheTenTimes: Action[Unit] = GetAction { _ =>
    for (x <- 1 to 10) pingCacheImpl(x)
    Ok("pong pong, from Play and Redis, x 10")
  }


  /** For performance tests. */
  def pingCacheImpl(x: Int = 1): Unit = {
    val redis: RedisClient = globals.redisClient
    val futureGetResult = redis.get("missing_value_" + x)
    Await.result(futureGetResult, 5.seconds)
  }


  /** For performance tests. */
  def pingDatabase: Action[Unit] = GetAction { request =>
    val systemUser = request.dao.readOnlyTransaction(_.loadUser(SystemUserId))
    Ok("pong pong, from Play and Postgres. Found system user: " + systemUser.isDefined)
  }


  /** For performance tests. */
  def pingDatabaseTenTimes: Action[Unit] = GetAction { request =>
    val users = (1 to 10).flatMap(x => request.dao.readOnlyTransaction(_.loadMemberInclDetailsById(x)))
    Ok("pong pong, from Play and Postgres, x 10. Found num built-in users: " + users.length)
  }


  /** For load balancers (and performance tests too) */
  def pingCacheAndDatabase: Action[Unit] = GetAction { request =>
    pingCacheImpl()
    val systemUser = request.dao.readOnlyTransaction(_.loadUser(SystemUserId))
    Ok("pong pong pong, from Play, Redis and Postgres. Found system user: " + systemUser.isDefined)
  }


  /** For performance tests */
  def pingCacheAndDatabaseTenTimes: Action[Unit] = GetAction { request =>
    for (x <- 1 to 10) pingCacheImpl(x)
    val users = (1 to 10).flatMap(x => request.dao.readOnlyTransaction(_.loadMemberInclDetailsById(x)))
    Ok("pong pong pong, from Play, Redis and Postgres, x 10. Found num built-in users: " + users.length)
  }


  def origin: Action[Unit] = GetAction { request =>
    val canonicalHostname = request.dao.theSite().canonicalHostname
    val response =
      s"""Globals.secure: ${globals.secure}
         |Globals.scheme: ${globals.scheme}
         |Globals.port: ${globals.port}
         |Globals.baseDomainWithPort: ${globals.baseDomainWithPort}
         |Globals.baseDomainNoPort: ${globals.baseDomainNoPort}
         |
         |Is default site hostname: ${globals.defaultSiteHostname is request.hostname}
         |Is default site id: ${globals.defaultSiteId == request.siteId}
         |
         |Default site hostname: ${globals.defaultSiteHostname}
         |Default site id: ${globals.defaultSiteId}
         |
         |OAuth login origin: ${globals.anyLoginOrigin}
         |
         |Request host: ${request.host}
         |Request secure: ${request.request.secure} (but Globals.secure used instead)
         |
         |Site canonical hostname: ${canonicalHostname.map(_.hostname)}
         |Site canonical hostname origin: ${canonicalHostname.map(globals.originOf)}
       """.stripMargin
    Ok(response)
  }


  def areScriptsReady: Action[Unit] = ExceptionAction(cc.parsers.empty) { _ =>
    val numEnginesCreated = context.nashorn.numEnginesCreated
    val numMissing = Nashorn.MinNumEngines - numEnginesCreated
    if (numMissing > 0)
      throwServiceUnavailable("EsE7KJ0F", o"""Only $numEnginesCreated engines created thus far,
          waiting for $numMissing more engines""")
    Ok(s"$numEnginesCreated script engines have been created, fine")
  }


  def viewTime: Action[Unit] = GetAction { _ =>
    makeTimeResponse()
  }


  /** Fast-forwards the server's current time, for End-to-End tests.
    */
  def playTime: Action[JsValue] = PostJsonAction(RateLimits.BrowserError, maxBytes = 100) {
          request =>
    throwForbiddenIf(!globals.mayFastForwardTime,
        "EdE5AKWYQ1", "To fast-forward time, in Prod mode, you need a wizard's wand")
    val anySeconds = (request.body \ "seconds").asOpt[Int]
    anySeconds foreach { seconds =>
      globals.testFastForwardTimeMillis(seconds * 1000)
    }
    makeTimeResponse()
  }

  def makeTimeResponse(): Result = {
    def showTime(millis: Long): String = i"""
        |now millis:  $millis
        |now seconds: ${millis / 1000}
        |now minutes: ${millis / 1000 / 60}
        |now iso:     ${toIso8601T(millis)}
        |now iso day: ${toIso8601Day(millis)}
        |"""

    val tyNowMs = globals.now().millis
    val realNowMs = new java.util.Date().getTime
    val diffMs = tyNowMs - realNowMs
    val diffMsDbl = diffMs.toDouble
    Ok("Ty:" +
          showTime(tyNowMs) +
        "\nReal:" +
          showTime(realNowMs) + i"""
        |
        |Difference Ty - Real:
        |millis: $diffMs
        |seconds: ${diffMs / 1000}
        |minutes: ${diffMsDbl / 1000 / 60}
        |hours: ${diffMsDbl / 1000 / 3600}
        |days: ${diffMsDbl / 1000 / 3600 / 24}
        |""") as TEXT
  }


  def deleteRedisKey: Action[JsValue] = PostJsonAction(RateLimits.BrowserError, maxBytes = 100) {
        request =>
    throwForbiddenIf(globals.isProdLive, "TyE502KUJ5",
        "I only do this, in Prod mode, when an odd number of " +
          "Phoenix birds sleep at my fireplace, and more than one")
    val key = (request.body \ "key").as[String]
    context.globals.redisClient.del(key)
    Ok
  }


  def skipLimitsForThisSite: Action[JsValue] = PostJsonAction(
        RateLimits.BrowserError, MinAuthnStrength.E2eTestPassword, maxBytes = 150) {
            request =>
    val okE2ePassword = context.security.hasOkE2eTestPassword(request.underlying)
    throwForbiddenIf(globals.isProdLive && !okE2ePassword,
      "TyE8WTHFJ25", "I only do this, in Prod mode, if I can see two moons from " +
        "my kitchen window and at least two of my pigeons tell me I should.")
    val anySiteId: Opt[i32] = parseOptInt32(request.body, "siteId")
    val anySiteOrigin: Opt[St] = parseOptSt(request.body, "siteOrigin")
    throwBadReqIf(anySiteId.isDefined == anySiteOrigin.isDefined, "TyE0J5MWSG24",
          "Specify only one of siteId and siteOrigin")

    val skipRateLimits: Bo = parseOptBo(request.body, "rateLimits") is true
    val skipDiskQuotaLimits: Bo = parseOptBo(request.body, "diskQuotaLimits") is true

    throwBadReqIf(!skipRateLimits && !skipDiskQuotaLimits, "TyE496MSKD35",
          "Specify at least one type of limit to skip")

    val siteId = anySiteId getOrElse {
      val site = request.context.globals.lookupSiteOrThrow(anySiteOrigin.get)
      site.id
    }

    if (skipRateLimits) {
      globals.siteDao(siteId).skipRateLimitsBecauseIsTest()
    }

    if (skipDiskQuotaLimits) {
      val patch = SuperAdminSitePatch(
            siteId = siteId,
            SiteStatus.Active,
            newNotes = None,
            rdbQuotaMiBs = Some(99),    //  <––
            fileQuotaMiBs = Some(99),   //  <––
            readLimitsMultiplier = None,
            logLimitsMultiplier = None,
            createLimitsMultiplier = None,
            featureFlags = "")
      globals.systemDao.updateSites(Vec(patch))
    }

    Ok
  }


  def pauseJobs: Action[JsValue] = PostJsonAction(RateLimits.BrowserError,
          MinAuthnStrength.E2eTestPassword, maxBytes = 150) { request =>
    throwForbiddenIf(globals.isProdLive, "TyE0DOVE001", "Not an avian carrier")
    val howManySeconds = parseOptInt32(request.body, "howManySeconds") getOrElse {
      throwBadReq("TyEHOWMNYSEC", "Specify howManySeconds to pause")
    }
    val pause = parseOptBo(request.body, "pause") getOrElse true
    globals.pauseJobs(howManySeconds, pause = pause)
    OkApiJson(Json.obj("paused" -> pause, "howManySeconds" -> howManySeconds))
  }


  def createDeadlock: Action[Unit] = ExceptionAction(cc.parsers.empty) { _ =>
    throwForbiddenIf(globals.isProdLive, "DwE5K7G4", "You didn't say the magic word")
    debiki.DeadlockDetector.createDebugTestDeadlock()
    Ok("Deadlock created, current time: " + toIso8601NoT(new ju.Date)) as TEXT
  }


  def addAdminNotice: Action[JsValue] = PostJsonAction(
        RateLimits.BrowserError, MinAuthnStrength.E2eTestPassword, maxBytes = 50) { request =>
    val okE2ePassword = context.security.hasOkE2eTestPassword(request.underlying)
    throwForbiddenIf(globals.isProdLive && !okE2ePassword, "TyE60MRGP35", "E2e pwd missing")
    import request.body
    val siteId = (body \ "siteId").as[SiteId]
    val noticeId = (body \ "noticeId").as[NoticeId]
    globals.siteDao(siteId).addAdminNotice(noticeId)
    Ok
  }


  def showLastE2eTestEmailSent(siteId: SiteId, sentToWithSpaces: String): Action[Unit] =
        ExceptionAction.async(cc.parsers.empty) { request =>
    SECURITY // COULD add and check an e2e password. Or rate limits.

    // Un-encode plus '+' which the URL param decoder interpreted as a space ' '.
    val sentTo = sentToWithSpaces.replaceAll(" ", "+")

    if (!Email.isE2eTestEmailAddress(sentTo))
      throwForbidden("DwEZ4GKE7", "Not an end-to-end test email address")

    val timeout = request.queryString.get("timeoutMs") match {
      case Some(values: Seq[String]) if values.nonEmpty =>
        val value = Try(values.head.toInt) getOrElse throwBadArgument("DwE4WK55", "timeoutMs")
        if (value <= 0) throwBadRequest("DwE6KGU3", "timeoutMs is <= 0")
        value millis
      case None =>
        // lower than the e2e test wait-for-timeout,
        // but high in comparison to the notifier [5KF0WU2T4]
        10 seconds
    }

    val futureReply: Future[Any] =
      globals.endToEndTestMailer.ask(
          GetEndToEndTestEmail(s"$siteId:$sentTo"))(akka.util.Timeout(timeout))

    val result: Future[p.mvc.Result] = futureReply.flatMap({
      case futureEmail: Future[_] =>
        val scheduler = globals.actorSystem.scheduler
        val futureTimeout = akka.pattern.after(timeout, scheduler)(
          failed(ResultException(InternalErrorResult(
            "EdE5KSA0", "Timeout waiting for an email to get sent to that address"))))

        firstCompletedOf(Seq(futureEmail, futureTimeout)).map({
          case emails: Vector[Email] =>
            OkPrettyJson(Json.obj("emails" -> JsArray(emails.map(email => {
              Json.obj(
                "emailId" -> JsString(email.id),
                "to" -> JsString(email.sentTo),
                "from" -> JsStringOrNull(email.sentFrom),
                "sentOn" -> JsDateMsOrNull(email.sentOn),
                "numRepliesBack" -> JsNum32OrNull(email.numRepliesBack),
                "subject" -> JsString(email.subject),
                "bodyHtmlText" -> JsString(email.bodyHtmlText))
            }))))
          case x =>
            InternalErrorResult("DwE7UGY4", "Mailer sent the wrong class: " + classNameOf(x))
        }).recover({
          case exception: ResultException =>
            exception.result
          case throwable: Throwable =>
            InternalErrorResult("DwE4KPB2", throwable.toString)
        })
      case x =>
        successful(InternalErrorResult(
          "DwE5KU42", "Mailer didn't send a Future, but this: " + classNameOf(x)))
    }).recover({
      case throwable: Throwable =>
        InternalErrorResult("DwE4KFE2", "Timeout waiting for email: " + throwable.toString)
    })

    result
  }


  def numE2eTestEmailSent(siteId: SiteId): Action[Unit] = ExceptionAction.async(cc.parsers.empty) {
        request =>
      SECURITY // COULD add and check an e2e password. Or rate limits.

      if (siteId > MaxTestSiteId)
        throwForbidden("Ty4ABKR02", "Not a test site")

      val futureReply: Future[Any] =
        globals.endToEndTestMailer.ask(
          NumEndToEndTestEmailsSent(siteId))(akka.util.Timeout(7.seconds))

      futureReply.map(sentToAddrsUntyped => {
        val sentToAddrs = sentToAddrsUntyped.asInstanceOf[Seq[String]]
        dieIf(!sentToAddrs.forall(Email.isE2eTestEmailAddress), "TyE2ABK503")
        OkApiJson(Json.obj(
          "num" -> sentToAddrs.length,
          "addrsByTimeAsc" -> sentToAddrs))
      })
    }



  def showPagePopularityStats(pageId: PageId): Action[Unit] = AdminGetAction { request =>
    import request.dao
    val (scoreInDb, scoreNow, statsNow) = dao.readOnlyTransaction { tx =>
      val scoreInDb = tx.loadPagePopularityScore(pageId)
      val pageParts = PagePartsDao(pageId, dao.loadWholeSiteSettings(tx), tx)
      val actions = tx.loadActionsOnPage(pageParts.pageId)
      val visits = tx.loadPageVisitTrusts(pageParts.pageId)
      val statsNow = PagePopularityCalculator.calcPopStatsNowAndThen(
        globals.now(), pageParts, actions, visits)
      val scoreNow = PagePopularityCalculator.calcPopularityScores(statsNow)
      (scoreInDb, scoreNow, statsNow)
    }
    Ok(i"""
      |Score in db
      |==================================
      |${scoreInDb.map(_.toPrettyString) getOrElse "Absent"}
      |
      |Score now
      |==================================
      |${scoreNow.toPrettyString}
      |
      |Stats now
      |==================================
      |${statsNow.toPrettyString}
      """) as TEXT
  }


  def showPubSubSubscribers(siteId: Option[SiteId]): Action[Unit] = AsyncAdminGetAction {
        request =>
    import request.dao
    val theSiteId = siteId getOrElse request.siteId

    globals.pubSub.debugGetSubscribers(theSiteId) map { pubSubState =>
      val clientsByUserId: Map[UserId, WebSocketClient] =
            pubSubState.clientsByUserIdBySiteId.getOrElse(theSiteId, Map.empty)

      val watcherIdsByPageId: Map[PageId, Set[UserId]] =
            pubSubState.watcherIdsByPageIdBySiteId.getOrElse(theSiteId, Map.empty)

      val watchersTexts = watcherIdsByPageId map { case (pageId, watcherIds) =>
        val pagePath = dao.getPagePath2(pageId)
        val sb = StringBuilder.newBuilder
        val pageIdText = "%6s " format pageId
        sb.append(pageIdText).append(pagePath.map(_.value).getOrElse("?")).append(":")
        watcherIds foreach { id =>
          clientsByUserId.get(id) match {
            case None =>
              sb.append(s"\n    ? #$id  — client missing")
            case Some(client) =>
              sb.append(s"\n    ${client.user.nameHashId}")
          }
        }
        sb.toString
      }

      Ok(i"""
        |Site id: $theSiteId
        |
        |${clientsByUserId.size} subscribers:
        |==================================
        |${clientsByUserId.valuesIterator.map(_.toStringPadded).mkString("\n")}
        |
        |Watchers by page:
        |==================================
        |${watchersTexts.mkString("\n\n")}
        |""")
    }
  }


  def showWebSocketClientsAllSites(): Action[Unit] = AsyncSuperAdminGetAction { request =>
      globals.pubSub.debugGetClientsAllSites() map { clientsAllSites =>
        val siteUserIdAndClients = clientsAllSites.clientsInactiveFirst
        Ok(i"""
        |All sites.
        |
        |${siteUserIdAndClients.length} subscribers:
        |==================================
        |${
          siteUserIdAndClients map { case (siteUserId, client) =>
            val siteIdPadded = siteUserId.siteId.toString.padTo(4, ' ')
            s"$siteIdPadded: ${client.toStringPadded}"
          } mkString "\n"
        }
        |""")
      }
  }


  def logError: Action[Unit] = AdminGetAction { _ =>
    throwForbiddenIf(globals.isProdLive, "TyE0LOGERR", o"""
          Look serious, sound serious and say "Seriously".
          And make a serious gesture.
          Then I will log an error *although* I'm in God mode no I mean Prod mode.""")
    val msg = "Test_error_log_msg"
    logger.error(msg)
    Ok(s"I just logged this error: $msg") as TEXT
  }


  def logFunnyLogMessages: Action[Unit] = AdminGetAction { _ =>
    import org.slf4j.Logger
    import org.slf4j.LoggerFactory
    val logger: Logger = LoggerFactory.getLogger("application")
    import net.logstash.logback.argument.StructuredArguments._
    import net.logstash.logback.marker.Markers.append
    logger.info("Funny log message 1 {}", kv("name1", "value1"))
    logger.warn("Funny log message 2 {} {}", kv("name2", "value2"))
    logger.warn("Funny log message 3 {}", keyValue("name3", "value3"), keyValue("n3", "v3"): Any)
    logger.warn(append("zzz", "wwqqq"), "Funny message with append marker")
    logger.warn(append("zzz2", "wwqqq2"), "REALLY FUNNY MESSAGE WITH APPEND MARKER")
    logger.error(append("markerA", "valueA").and(append("markerB", "valueB")).asInstanceOf[Marker],
      "DANGEROUSLY (!) FUNNY MESSAGE WITH TWO APPEND MARKERS")
    logger.warn("Funny log message value {}", value("thekey", "thevalue"))

    val myMap = new ju.HashMap[String, String]()
    myMap.put("hashmap-name1", "hashmap-value1")
    myMap.put("hashmap-name2", "hashmap-value2")
    logger.warn("Funny map log message {}", entries(myMap))

    try die("DIEHARD error")
    catch {
      case ex: Throwable =>
        logger.error("DieHard as error", ex)
    }

    try die("DIEHARD warning")
    catch {
      case ex: Throwable =>
        logger.warn("DieHard as warning", ex)
    }

    try die("DIEHARD debug")
    catch {
      case ex: Throwable =>
        logger.debug("DieHard as debug", ex)
    }

    Ok
  }
}

