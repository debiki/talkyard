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
import debiki.{RateLimits, ReactRenderer}
import debiki.dao.PagePartsDao
import debiki.EdHttp._
import ed.server.{EdContext, EdController}
import ed.server.pop.PagePopularityCalculator
import java.lang.management.ManagementFactory
import java.{io => jio, util => ju}
import javax.inject.Inject
import org.slf4j.Marker
import play.api.libs.json._
import play.{api => p}
import play.api.mvc.{Action, ControllerComponents}
import redis.RedisClient
import scala.concurrent.duration._
import scala.concurrent.{Await, Future}
import scala.concurrent.Future._
import scala.util.Try


/** Intended for troubleshooting, via the browser, and helps running End-to-End tests.
  */
class DebugTestController @Inject()(cc: ControllerComponents, edContext: EdContext,
  loginWithOpenAuthController: LoginWithOpenAuthController)
  extends EdController(cc, edContext) {

  import context.globals
  import context.safeActions.ExceptionAction


  /** If a JS error happens in the browser, it'll post the error message to this
    * endpoint, which logs it, so we'll get to know about client side errors.
    */
  def logBrowserErrors: Action[JsValue] = PostJsonAction(RateLimits.BrowserError, maxBytes = 10000) {
        request =>
    val allErrorMessages = request.body.as[Seq[String]]
    // If there are super many errors, perhaps all of them is the same error. Don't log too many.
    val firstErrors = allErrorMessages take 20
    firstErrors foreach { message =>
      p.Logger.warn(o"""Browser error,
      ip: ${request.ip},
      user: ${request.user.map(_.id)},
      site: ${request.siteId}
      message: $message
      [DwE4KF6]""")
    }
    Ok
  }


  SECURITY; COULD // allow only if a Ops team password header? is included? For now, superadmins only.
  def showMetrics: Action[Unit] = SuperAdminGetAction { _ =>
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


  SECURITY; COULD // make this accessible only for superadmins + if ok forbidden-password specified.
  def showBuildInfo: Action[Unit] = GetAction { _ =>
    import generatedcode.BuildInfo
    val infoTextBuilder = StringBuilder.newBuilder
      .append("Build info:")
      .append("\n")
      .append("\ndocker tag: ").append(BuildInfo.dockerTag)
      .append("\napp version: ").append(BuildInfo.version)
      .append("\ngit revision: ").append(BuildInfo.gitRevision)
      .append("\ngit branch: ").append(BuildInfo.gitBranch)
      .append("\nscala version: ").append(BuildInfo.scalaVersion)
      .append("\nsbt version: ").append(BuildInfo.sbtVersion)
    Ok(infoTextBuilder.toString) as TEXT
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
    val redis: RedisClient = globals.redisClient
    val futureGetResult = redis.get("missing_value")
    Await.result(futureGetResult, 5 seconds)
    Ok("pong, from Play and Redis")
  }


  /** For load balancers (and performance tests too) */
  def pingDatabaseAndCache: Action[Unit] = GetAction { request =>
    throwForbidden("EdE2wKFUG8", "Not impl")
    request.dao.readOnlyTransaction { _ =>
      // tx.pingDatabase()
      // ping Redis too
    }
    Ok("pong, from Play, Postgres and Redis")
  }


  def origin: Action[Unit] = GetAction { request =>
    val canonicalHost = request.dao.theSite().canonicalHost
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
         |OAuth login origin: ${loginWithOpenAuthController.anyLoginOrigin}
         |
         |Request host: ${request.host}
         |Request secure: ${request.request.secure}
         |
         |Site canonical hostname: ${canonicalHost.map(_.hostname)}
         |Site canonical host origin: ${canonicalHost.map(globals.originOf)}
       """.stripMargin
    Ok(response)
  }


  def areScriptsReady: Action[Unit] = ExceptionAction(cc.parsers.empty) { _ =>
    val numEnginesCreated = context.nashorn.numEnginesCreated
    val numMissing = ReactRenderer.MinNumEngines - numEnginesCreated
    if (numMissing > 0)
      throwServiceUnavailable("EsE7KJ0F", o"""Only $numEnginesCreated engines created thus far,
          waiting for $numMissing more engines""")
    Ok(s"$numEnginesCreated script engines have been created, fine")
  }


  /** Fast-forwards the server's current time, for End-to-End tests.
    */
  def playTime: Action[JsValue] = PostJsonAction(RateLimits.BrowserError, maxBytes = 100) { request =>
    throwForbiddenIf(!globals.mayFastForwardTime,
        "EdE5AKWYQ1", "To fast-forward time, you need a wizard's wand")
    val seconds = (request.body \ "seconds").as[Int]
    globals.testFastForwardTimeMillis(seconds * 1000)
    Ok
  }


  def createDeadlock: Action[Unit] = ExceptionAction(cc.parsers.empty) { _ =>
    throwForbiddenIf(globals.isProd, "DwE5K7G4", "You didn't say the magic word")
    debiki.DeadlockDetector.createDebugTestDeadlock()
    Ok("Deadlock created, current time: " + toIso8601(new ju.Date)) as TEXT
  }


  def showLastE2eTestEmailSent(siteId: SiteId, sentTo: String): Action[Unit] =
        ExceptionAction.async(cc.parsers.empty) { request =>
    SECURITY // COULD add and check an e2e password. Or rate limits.

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
          "GetEndToEndTestEmail", s"$siteId:$sentTo")(akka.util.Timeout(timeout))

    val result: Future[p.mvc.Result] = futureReply.flatMap({
      case futureEmail: Future[_] =>
        val scheduler = globals.actorSystem.scheduler
        val futureTimeout = akka.pattern.after(timeout, scheduler)(
          failed(ResultException(InternalErrorResult(
            "EdE5KSA0", "Timeout waiting for an email to get sent to that address"))))

        firstCompletedOf(Seq(futureEmail, futureTimeout)).map({
          case emails: Vector[Email] =>
            Ok(JsArray(emails.map(email => {
              Json.obj(
                "subject" -> JsString(email.subject),
                "bodyHtmlText" -> JsString(email.bodyHtmlText))
            }))) as JSON
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


  def showPagePopularityStats(pageId: PageId): Action[Unit] = AdminGetAction { request =>
    val (scoreInDb, scoreNow, statsNow) = request.dao.readOnlyTransaction { tx =>
      val scoreInDb = tx.loadPagePopularityScore(pageId)
      val pageParts = PagePartsDao(pageId, tx)
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


  def showPubSubSubscribers(siteId: Option[SiteId]): Action[Unit] = AsyncAdminGetAction { request =>
    globals.pubSub.debugGetSubscribers(siteId getOrElse request.siteId) map { pubSubState =>
      Ok(i"""
        |Subscribers by site and user id
        |==================================
        |${pubSubState.subscribersBySite}
        |
        |Watchers by site and page id
        |==================================
        |${pubSubState.watcherIdsByPageSiteId}
        """)
    }
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

