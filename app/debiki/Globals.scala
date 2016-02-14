/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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

package debiki

import akka.actor._
import akka.pattern.gracefulStop
import com.codahale.metrics
import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.dao.rdb.{RdbDaoFactory, Rdb}
import com.zaxxer.hikari.HikariDataSource
import debiki.Globals.NoStateError
import debiki.antispam.AntiSpam
import debiki.dao._
import debiki.dao.migrations.ScalaBasedMigrations
import io.efdi.server.notf.Notifier
import java.{lang => jl, util => ju}
import io.efdi.server.pubsub.{PubSubApi, PubSub, StrangerCounterApi}
import org.scalactic._
import play.{api => p}
import play.api.libs.concurrent.Akka
import play.api.Play
import play.api.Play.current
import scala.concurrent.duration._
import scala.concurrent.{Future, Await, TimeoutException}
import scala.concurrent.ExecutionContext.Implicits.global
import scala.util.matching.Regex
import Globals._


object Globals extends Globals {

  class NoStateError extends AssertionError(
    "No Globals.State created, please call onServerStartup() [DwE5NOS0]")

  object StillConnectingException extends QuickException

  class DatabasePoolInitializationException(cause: Exception) extends RuntimeException(cause)

  val LocalhostUploadsDirConfigValueName = "debiki.uploads.localhostDir"

}



/** App server startup and shutdown hooks, plus global stuff like
  * the systemDao and tenantDao:s and an email actor.
  *
  * It's a class, so it can be tweaked during unit testing.
  */
class Globals {

  /** Can be accessed also after the test is done and Play.maybeApplication is None.
    */
  lazy val wasTest = Play.isTest

  def testsDoneServerGone = Play.isTest && (!isInitialized || Play.maybeApplication.isEmpty)

  def isInitialized = _state ne null

  @volatile private var _state: State Or Option[Exception] = null

  private def state: State = {
    if (_state eq null) {
      throw new NoStateError()
    }
    _state match {
      case Good(state) => state
      case Bad(anyException) =>
        throw anyException getOrElse StillConnectingException
    }
  }


  def metricRegistry = state.metricRegistry

  def mostMetrics: MostMetrics = state.mostMetrics


  def applicationVersion = state.applicationVersion

  def applicationSecret = state.applicationSecret


  /** Lets people do weird things, namely fake their ip address (&fakeIp=... url param)
    * in order to create many e2e test sites — also in prod mode, for smoke tests.
    * The e2e test sites will have ids like 'test__...' so that they can be deleted safely.
    */
  def e2eTestPassword: Option[String] = state.e2eTestPassword

  /** Lets people do some forbidden things, like creating a site with a too short
    * local hostname.
    */
  def forbiddenPassword: Option[String] = state.forbiddenPassword


  def systemDao = state.systemDao


  def siteDao(siteId: SiteId): SiteDao =
    state.siteDaoFactory.newSiteDao(siteId)


  def sendEmail(email: Email, websiteId: String) {
    state.mailerActorRef ! (email, websiteId)
  }

  def endToEndTestMailer = state.mailerActorRef

  def renderPageContentInBackground(sitePageId: SitePageId) {
    state.renderContentActorRef ! sitePageId
  }

  def antiSpam: AntiSpam = state.antiSpam

  def securityComplaintsEmailAddress = state.securityComplaintsEmailAddress


  /** Either exactly all sites uses HTTPS, or all of them use HTTP.
    * A mixed configuration makes little sense I think:
    * 1) On the public internet, obviously HTTPS should be used, always.
    * 2) On an intranet, HTTP might be okay. And HTTPS. But not a combination of HTTP and HTTPS:
    *   a) What about an intranet with some sites using HTTPS and some using HTTPS?
    *     Then the organization would setup a Certificate Authority, install
    *     certs in the members' browsers, but then uses them only sometimes, for some
    *     sites? Why? That seems weird. Supporting this seems like not-well-spent-time.
    *   b) What about sites that are accessible over HTTP on the intranet and HTTPS
    *     on the public Internet? Then email links will break (they'll use either http or https).
    *   c) What about some sites accessible only over HTTP on an intranet,
    *     and others accessible only on the public Internet over HTTPS?
    *     Then some firewall has to block access to the HTTP sites from the public internet.
    *     Seems like a risky and unusual configuration. Not well spent time.
    *     They might as well use two servers instead, one for the public internet,
    *     one internally?
    * -->
    *  Either HTTP for all sites (assuming a trusted intranet), or HTTPS for all sites.
    */
  def secure = state.secure

  def scheme = state.scheme
  def schemeColonSlashSlash = state.scheme + "://"


  def port = state.port

  def colonPort =
    if (secure && port == 443) ""
    else if (!secure && port == 80) ""
    else s":$port"


  def originOf(site: Site): Option[String] = site.canonicalHost.map(originOf)
  def originOf(host: SiteHost): String = originOf(host.hostname)
  def originOf(hostOrHostname: String): String = {
    val (hostname, port) = hostOrHostname.span(_ != ':')
    dieIf(port.nonEmpty && port != colonPort, "DwE47SK2", s"Bad port: '$hostOrHostname'")
    s"$scheme://$hostname$colonPort"
  }
  def originOf(request: p.mvc.Request[_]): String = s"$scheme://${request.host}"


  def baseDomainWithPort = state.baseDomainWithPort
  def baseDomainNoPort = state.baseDomainNoPort


  def firstSiteHostname = state.firstSiteHostname

  /** New sites may be created only from this hostname. */
  def anyCreateSiteHostname = state.anyCreateSiteHostname


  def poweredBy = s"$scheme://www.debiki.com"


  /** If a hostname matches this pattern, the site id can be extracted directly from the url.
    */
  def siteByIdHostnameRegex: Regex = state.siteByIdHostnameRegex

  def SiteByIdHostnamePrefix = "site-"

  def siteByIdOrigin(siteId: String) =
    s"$scheme://$SiteByIdHostnamePrefix$siteId.$baseDomainWithPort"


  def maxUploadSizeBytes = state.maxUploadSizeBytes
  def anyUploadsDir = state.anyUploadsDir
  def anyPublicUploadsDir = state.anyPublicUploadsDir
  val localhostUploadsBaseUrl = controllers.routes.UploadsController.servePublicFile("").url

  def pubSub: PubSubApi = state.pubSub
  def strangerCounter: StrangerCounterApi = state.strangerCounter


  def onServerStartup(app: p.Application) {
    p.Logger.info("Starting... [EsM200HI]")
    wasTest // initialise it now
    if (_state ne null)
      throw new jl.IllegalStateException(o"""Server already running, was it not properly
        shut down last time? Please hit CTRL+C to kill it. [DwE83KJ9]""")

    p.Logger.info("Search disabled, see debiki-dao-rdb [DwM4KEWKB2]")
    DeadlockDetector.ensureStarted()

    _state = Bad(None)

    // Let the server start, whilst we try to connect to services like the database and Redis.
    // If we're unable to connect to a service, then we'll set _state to a
    // developer / operations-team friendly error message about the service being
    // inaccessible, and some tips about how troubleshoot this and how to start it.
    val createStateFuture = Future {
      while (_state.isBad) {
        p.Logger.info("Connecting to services... [EsM200CTS]")
        try {
          val dataSource = Debiki.createPostgresHikariDataSource()
          _state = Good(new State(dataSource))
        }
        catch {
          case ex: com.zaxxer.hikari.pool.HikariPool.PoolInitializationException =>
            _state = Bad(Some(new DatabasePoolInitializationException(ex)))
          case ex: Exception =>
            p.Logger.error("Unknown state creation error [EsE4GY67]", ex)
            _state = Bad(Some(ex))
        }
      }

      // The render engines might be needed by some Java (Scala) evolutions.
      debiki.ReactRenderer.startCreatingRenderEngines()
      state.systemDao.applyEvolutions()
    }

    try {
      Await.ready(createStateFuture, 2 seconds)
      p.Logger.info("Started. [EsM200RDY]")
    }
    catch {
      case _: TimeoutException =>
        // We'll show a message in any browser that the server is starting, please wait
        // — that's better than a blank page? In case this takes long.
        p.Logger.info("Still connecting to other services, starting anyway. [EsM200CRZY]")
    }
  }


  def onServerShutdown(app: p.Application) {
    // Play.start() first calls Play.stop(), so:
    if (_state eq null)
      return

    p.Logger.info("Shutting down... [EsM200BYE]")
    state.dataSource.close()
    // Shutdown the notifier before the mailer, so no notifications are lost
    // because there was no mailer that could send them.
    shutdownActorAndWait(state.notifierActorRef)
    shutdownActorAndWait(state.mailerActorRef)
    shutdownActorAndWait(state.renderContentActorRef)
    state.dbDaoFactory.shutdown()
    _state = null
  }


  private def shutdownActorAndWait(actorRef: ActorRef): Boolean = {
    val future = gracefulStop(actorRef, state.ShutdownTimeout)
    val stopped = Await.result(future, state.ShutdownTimeout)
    stopped
  }


  private class State(val dataSource: HikariDataSource) {

    val ShutdownTimeout = 30 seconds

    val metricRegistry = new metrics.MetricRegistry()
    val mostMetrics = new MostMetrics(metricRegistry)

    val dbDaoFactory = new RdbDaoFactory(
      new Rdb(dataSource), ScalaBasedMigrations, Akka.system,
      anyFullTextSearchDbPath, Play.isTest, fastStartSkipSearch = fastStartSkipSearch)

    val siteDaoFactory = new CachingSiteDaoFactory(dbDaoFactory)

    val mailerActorRef = Mailer.startNewActor(Akka.system, siteDaoFactory)

    val notifierActorRef = Notifier.startNewActor(Akka.system, systemDao, siteDaoFactory)

    val (pubSub, strangerCounter) = PubSub.startNewActor(Akka.system)

    val renderContentActorRef = RenderContentService.startNewActor(Akka.system, siteDaoFactory)

    val antiSpam = new AntiSpam()
    antiSpam.start()

    def systemDao: SystemDao = new CachingSystemDao(dbDaoFactory)

    if (Play.isTest && Play.configuration.getBoolean("isTestShallEmptyDatabase").contains(true)) {
      systemDao.emptyDatabase()
    }

    private def fastStartSkipSearch =
      Play.configuration.getBoolean("crazyFastStartSkipSearch") getOrElse false

    private def anyFullTextSearchDbPath =
      Play.configuration.getString("fullTextSearchDb.dataPath")

    val applicationVersion = "0.00.19"  // later, read from some build config file

    val applicationSecret =
      Play.configuration.getString("play.crypto.secret").getOrDie(
        "Config value 'play.crypto.secret' missing [DwE75FX0]")

    val e2eTestPassword: Option[String] =
      Play.configuration.getString("debiki.e2eTestPassword")

    val forbiddenPassword: Option[String] =
      Play.configuration.getString("debiki.forbiddenPassword")

    val secure = Play.configuration.getBoolean("debiki.secure") getOrElse {
      p.Logger.info("Config value 'debiki.secure' missing; defaulting to true. [DwM3KEF2]")
      true
    }

    def scheme = if (secure) "https" else "http"

    val port: Int = {
      if (Play.isTest) {
        // Not on classpath: play.api.test.Helpers.testServerPort
        // Instead, duplicate its implementation here:
        sys.props.get("testserver.port").map(_.toInt) getOrElse 19001
      }
      else {
        Play.configuration.getInt("debiki.port") orElse
          sys.props.get(s"$scheme.port").map(_.toInt) getOrElse {
            if (Play.isDev) 9000
            else if (secure) 443
            else 80
        }
      }
    }

    val baseDomainNoPort =
      if (Play.isTest) "localhost"
      else Play.configuration.getString("debiki.baseDomain") getOrElse "localhost"

    val baseDomainWithPort =
      if (secure && port == 443) baseDomainNoPort
      else if (!secure && port == 80) baseDomainNoPort
      else s"$baseDomainNoPort:$port"


    /** The hostname of the site created by default when setting up a new server. */
    val firstSiteHostname = Play.configuration.getString("debiki.hostname")

    if (firstSiteHostname.exists(_ contains ':'))
      p.Logger.error("Config value debiki.hostname contains ':' [DwE4KUWF7]")

    val anyCreateSiteHostname = Play.configuration.getString("debiki.createSiteHostname")

    // The hostname must be directly below the base domain, otherwise
    // wildcard HTTPS certificates won't work: they cover 1 level below the
    // base domain only, e.g. host.example.com but not sub.host.example.com,
    // if the cert was issued for *.example.com.
    val siteByIdHostnameRegex: Regex =
      s"""^$SiteByIdHostnamePrefix(.*)\\.$baseDomainNoPort$$""".r

    val maxUploadSizeBytes = Play.configuration.getInt("debiki.uploads.maxKiloBytes").map(_ * 1000)
      .getOrElse(3*1000*1000)

    val anyUploadsDir = {
      import Globals.LocalhostUploadsDirConfigValueName
      val value = Play.configuration.getString(LocalhostUploadsDirConfigValueName)
      val pathSlash = if (value.exists(_.endsWith("/"))) value else value.map(_ + "/")
      pathSlash match {
        case None =>
          p.Logger.warn(o"""Config value $LocalhostUploadsDirConfigValueName missing;
              file uploads disabled. [DwE74W2]""")
          None
        case Some(path) =>
          // SECURITY COULD test more dangerous dirs. Or whitelist instead?
          if (path == "/" || path.startsWith("/etc/") || path.startsWith("/bin/")) {
            p.Logger.warn(o"""Config value $LocalhostUploadsDirConfigValueName specifies
                a dangerous path: $path — file uploads disabled. [DwE0GM2]""")
            None
          }
          else {
            pathSlash
          }
      }
    }

    val anyPublicUploadsDir = anyUploadsDir.map(_ + "public/")

    val securityComplaintsEmailAddress = Play.configuration.getString(
      "debiki.securityComplaintsEmailAddress")
  }

}

