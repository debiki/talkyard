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
import com.debiki.dao.rdb.{Rdb, RdbDaoFactory}
import com.github.benmanes.caffeine
import com.zaxxer.hikari.HikariDataSource
import debiki.DebikiHttp.throwForbidden
import debiki.Globals.NoStateError
import ed.server.spam.{SpamCheckActor, SpamChecker}
import debiki.dao._
import debiki.dao.migrations.ScalaBasedMigrations
import ed.server.search.SearchEngineIndexer
import io.efdi.server.notf.Notifier
import java.{lang => jl, net => jn}
import java.util.concurrent.TimeUnit
import io.efdi.server.pubsub.{PubSub, PubSubApi, StrangerCounterApi}
import org.{elasticsearch => es}
import org.scalactic._
import play.{api => p}
import play.api.libs.concurrent.Akka
import play.api.Play
import play.api.Play.current
import redis.RedisClient
import scala.concurrent.duration._
import scala.concurrent.{Await, Future, TimeoutException}
import scala.concurrent.ExecutionContext.Implicits.global
import scala.util.matching.Regex
import Globals._


object Globals extends Globals {

  class NoStateError extends AssertionError(
    "No Globals.State created, please call onServerStartup() [DwE5NOS0]")

  object StillConnectingException extends QuickException

  class DatabasePoolInitializationException(cause: Exception) extends RuntimeException(cause)

  val LocalhostUploadsDirConfigValueName = "ed.uploads.localhostDir"

  val FirstSiteHostnameConfigValue = "ed.hostname"
  val BecomeOwnerEmailConfigValue = "ed.becomeOwnerEmailAddress"

}



/** App server startup and shutdown hooks, plus global stuff like
  * the systemDao and tenantDao:s and an email actor.
  *
  * It's a class, so it can be tweaked during unit testing.
  */
class Globals {

  private def conf = Play.configuration

  /** Can be accessed also after the test is done and Play.maybeApplication is None.
    */
  lazy val wasTest = Play.isTest
  lazy val isProd = Play.isProd

  def testsDoneServerGone = Play.isTest && (!isInitialized || Play.maybeApplication.isEmpty)

  def isTestDisableScripts = state.isTestDisableScripts
  def isTestDisableBackgroundJobs = state.isTestDisableBackgroundJobs

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


  @volatile var killed = false

  /** For now (forever?), ignore platforms that don't send Linux signals.
    */
  sun.misc.Signal.handle(new sun.misc.Signal("TERM"), new sun.misc.SignalHandler () {
    def handle(signal: sun.misc.Signal) {
      p.Logger.info("Got SIGTERM, exiting with status 0 [EsMSIGTERM]")
      killed = true
      System.exit(0)  // doing this here instead of [9KYKW25] although leaves PID file [65YKFU02]
    }
  })

  sun.misc.Signal.handle(new sun.misc.Signal("INT"), new sun.misc.SignalHandler () {
    def handle(signal: sun.misc.Signal) {
      p.Logger.info("Got SIGINT, exiting with status 0 [EsMSIGINT]")
      killed = true
      System.exit(0)  // doing this here instead of [9KYKW25] although leaves PID file [65YKFU02]
    }
  })

  def metricRegistry = state.metricRegistry

  def mostMetrics: MostMetrics = state.mostMetrics


  def applicationVersion = state.applicationVersion

  def applicationSecret = {
    throwForbiddenIfSecretNotChanged()
    state.applicationSecret
  }

  def throwForbiddenIfSecretNotChanged() {
    if (state.applicationSecretNotChanged && Play.isProd)
      throwForbidden("EsE4UK20F", o"""Please edit the 'play.crypto.secret' config value,
          its still set to 'changeme'""")
  }

  /** Lets people do weird things, namely fake their ip address (&fakeIp=... url param)
    * in order to create many e2e test sites — also in prod mode, for smoke tests.
    * The e2e test sites will have ids like {{{test__...}}} so that they can be deleted safely.
    */
  def e2eTestPassword: Option[String] = state.e2eTestPassword

  /** Lets people do some forbidden things, like creating a site with a too short
    * local hostname.
    */
  def forbiddenPassword: Option[String] = state.forbiddenPassword


  def systemDao: SystemDao = state.systemDao  // [rename] to newSystemDao()?


  def siteDao(siteId: SiteId): SiteDao =  // [rename] to newSiteDao?
    state.siteDaoFactory.newSiteDao(siteId)


  def redisClient: RedisClient = state.redisClient


  def sendEmail(email: Email, websiteId: String) {
    state.mailerActorRef ! (email, websiteId)
  }

  def endToEndTestMailer = state.mailerActorRef

  def renderPageContentInBackground(sitePageId: SitePageId) {
    if (!isTestDisableBackgroundJobs) {
      state.renderContentActorRef ! sitePageId
    }
  }

  def spamChecker: SpamChecker = state.spamChecker

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
    val (hostname, colonPortParam) = hostOrHostname.span(_ != ':')
    def portParam = colonPortParam drop 1
    dieIf(colonPortParam.nonEmpty && colonPortParam != colonPort,
      "DwE47SK2", o"""Bad port: $portParam. You're accessing the server via non-standard
        port $portParam, but then you need to edit/add config value `ed.port=$portParam`,
        otherwise I won't know for sure which port to include in URLs I generate.""")
    s"$scheme://$hostname$colonPort"
  }
  def originOf(request: p.mvc.Request[_]): String = s"$scheme://${request.host}"


  def baseDomainWithPort = state.baseDomainWithPort
  def baseDomainNoPort = state.baseDomainNoPort


  def firstSiteHostname = state.firstSiteHostname
  def becomeFirstSiteOwnerEmail = state.becomeFirstSiteOwnerEmail

  /** New sites may be created only from this hostname. */
  def anyCreateSiteHostname = state.anyCreateSiteHostname
  def anyCreateTestSiteHostname = state.anyCreateTestSiteHostname

  // Hmm, in this way there'll be just one conf field:
  def config = state.config

  def poweredBy = s"https://www.effectivediscussions.org"


  /** If a hostname matches this pattern, the site id can be extracted directly from the url.
    */
  def siteByIdHostnameRegex: Regex = state.siteByIdHostnameRegex

  def SiteByIdHostnamePrefix = "site-"

  def siteByIdOrigin(siteId: String) =
    s"$scheme://$SiteByIdHostnamePrefix$siteId.$baseDomainWithPort"


  def maxUploadSizeBytes = state.maxUploadSizeBytes
  def anyUploadsDir = state.anyUploadsDir
  def anyPublicUploadsDir = state.anyPublicUploadsDir
  val uploadsUrlPath = controllers.routes.UploadsController.servePublicFile("").url

  def pubSub: PubSubApi = state.pubSub
  def strangerCounter: StrangerCounterApi = state.strangerCounter


  def onServerStartup(app: p.Application) {
    p.Logger.info("Starting... [EsM200HELLO]")
    wasTest // initialise it now
    if (_state ne null)
      throw new jl.IllegalStateException(o"""Server already running, was it not properly
        shut down last time? Please hit CTRL+C to kill it. [DwE83KJ9]""")

    DeadlockDetector.ensureStarted()

    // Let the server start, whilst we try to connect to services like the database and Redis.
    // If we're unable to connect to a service, then we'll set _state to a
    // developer / operations-team friendly error message about the service being
    // inaccessible, and some tips about how troubleshoot this and how to start it.
    val createStateFuture = Future {
      tryCreateStateUntilKilled()
    }

    try {
      Await.ready(createStateFuture, (Play.isTest ? 99 | 5) seconds)
      if (killed) {
        p.Logger.info("Killed. Bye. [EsM200KILLED]")
        // Play.stop() has no effect, not from here directly, nor from within a Future {},
        // and Future { sleep(100ms); stop() } also doesn't work.
        //  play.api.Play.stop(app)  <-- nope
        // instead:
        System.exit(0)
        // However this leaves a RUNNING_PID file. So the docker container deletes it
        // before start, see docker/play-prod/Dockerfile [65YKFU02]

        // However this block won't run if we've started already. So exiting directly
        // in the signal handler instea, right now, see [9KYKW25] above. Not sure why Play
        // apparently ignores signals, once we've started (i.e. returned from this function).
      }
      else {
        p.Logger.info("Started. [EsM200READY]")
      }
    }
    catch {
      case _: TimeoutException =>
        // We'll show a message in any browser that the server is starting, please wait
        // — that's better than a blank page? In case this takes long.
        p.Logger.info(
          "Starting now, although not yet connected to all other services. Trying... [EsM200CRAZY]")
    }
  }


  private def tryCreateStateUntilKilled() {
    _state = Bad(None)
    var firsAttempt = true

    while (_state.isBad && !killed) {
      if (!firsAttempt) {
        // Don't attempt to connect to everything too quickly, because then 100 MB log data
        // with "Error connecting to database ..." are quickly generated.
        Thread.sleep(3000)
        if (killed)
          return
      }
      firsAttempt = false
      val cache = makeCache
      try {
        p.Logger.info("Connecting to database... [EsM200CONNDB]")
        val readOnlyDataSource = Debiki.createPostgresHikariDataSource(readOnly = true)
        val readWriteDataSource = Debiki.createPostgresHikariDataSource(readOnly = false)
        val dbDaoFactory = new RdbDaoFactory(
          new Rdb(readOnlyDataSource, readWriteDataSource), ScalaBasedMigrations, Play.isTest)

        // Create any missing database tables before `new State`, otherwise State
        // creates background threads that might attempt to access the tables.
        p.Logger.info("Running database migrations... [EsM200MIGRDB]")
        new SystemDao(dbDaoFactory, cache).applyEvolutions()

        p.Logger.info("Done migrating database. Connecting to other services... [EsM200CONNOTR]")
        val newState = new State(dbDaoFactory, cache)

        if (Play.isTest &&
            Play.configuration.getBoolean("isTestShallEmptyDatabase").contains(true)) {
          p.Logger.info("Emptying database... [EsM200EMPTYDB]")
          newState.systemDao.emptyDatabase()
        }

        _state = Good(newState)
      }
      catch {
        case ex: com.zaxxer.hikari.pool.HikariPool.PoolInitializationException =>
          _state = Bad(Some(new DatabasePoolInitializationException(ex)))
        case ex: Exception =>
          p.Logger.error("Unknown state creation error [EsE4GY67]", ex)
          _state = Bad(Some(ex))
      }
    }

    if (killed)
      return

    // The render engines might be needed by some Java (Scala) evolutions.
    // Let's create them in this parallel thread rather than blocking the whole server.
    // (Takes 2? 5? seconds.)
    debiki.ReactRenderer.startCreatingRenderEngines()

    if (!isTestDisableBackgroundJobs) {
      Akka.system.scheduler.scheduleOnce(
        5 seconds, state.renderContentActorRef, RenderContentService.RegenerateStaleHtml)
    }
  }


  def onServerShutdown(app: p.Application) {
    // Play.start() first calls Play.stop(), so:
    if (_state eq null)
      return

    p.Logger.info("Shutting down... [EsM200BYE]")
    // Shutdown the notifier before the mailer, so no notifications are lost
    // because there was no mailer that could send them.
    shutdownActorAndWait(state.notifierActorRef)
    shutdownActorAndWait(state.mailerActorRef)
    shutdownActorAndWait(state.renderContentActorRef)
    shutdownActorAndWait(state.indexerActorRef)
    shutdownActorAndWait(state.spamCheckActorRef)
    state.elasticSearchClient.close()
    state.redisClient.quit()
    state.dbDaoFactory.db.readOnlyDataSource.asInstanceOf[HikariDataSource].close()
    state.dbDaoFactory.db.readWriteDataSource.asInstanceOf[HikariDataSource].close()
    _state = null
  }


  private def shutdownActorAndWait(actorRef: ActorRef): Boolean = {
    val future = gracefulStop(actorRef, state.ShutdownTimeout)
    val stopped = Await.result(future, state.ShutdownTimeout)
    stopped
  }


  /** Caffeine is a lot faster than EhCache, and it doesn't have annoying problems with
    * a singleton that causes weird classloader related errors on Play app stop-restart.
    * (For a super large out-of-process survive-restarts cache, we use Redis not EhCache.)
    */
  private def makeCache: DaoMemCache = caffeine.cache.Caffeine.newBuilder()
    .maximumWeight(10*1000)  // change to config value, e.g. 1e9 = 1GB mem cache. Default to 50M?
    .weigher[String, DaoMemCacheAnyItem](new caffeine.cache.Weigher[String, DaoMemCacheAnyItem] {
    override def weigh(key: String, value: DaoMemCacheAnyItem): Int = {
      // For now. Later, use e.g. size of cached HTML page + X bytes for fixed min size?
      // Can use to measure size: http://stackoverflow.com/a/30021105/694469
      //   --> http://openjdk.java.net/projects/code-tools/jol/
      1
    }
  }).build()


  private class State(
    val dbDaoFactory: RdbDaoFactory,
    val cache: DaoMemCache) {

    // 5 seconds sometimes in a test —> """
    // debiki.RateLimiterSpec *** ABORTED ***
    // Futures timed out after [5 seconds]
    // """
    // (in that case, all tests went fine, but couldn't shutdown the test server quickly enough)
    val ShutdownTimeout = 10 seconds

    val config = new Config(conf)

    val isTestDisableScripts = {
      val disable =
        Play.isTest && Play.configuration.getBoolean("isTestDisableScripts").getOrElse(false)
      if (disable) {
        p.Logger.info("Is test with scripts disabled. [EsM4GY82]")
      }
      disable
    }

    val isTestDisableBackgroundJobs = {
      val disable =
        Play.isTest && Play.configuration.getBoolean("isTestDisableBackgroundJobs").getOrElse(false)
      if (disable) {
        p.Logger.info("Is test with background jobs disabled. [EsM6JY0K2]")
      }
      disable
    }

    val metricRegistry = new metrics.MetricRegistry()
    val mostMetrics = new MostMetrics(metricRegistry)

    // Redis. (A Redis client pool makes sense if we haven't saturate the CPU on localhost, or
    // if there're many Redis servers and we want to round robin between them. Not needed, now.)
    val redisHost =
      conf.getString("ed.redis.host").orElse(
        conf.getString("debiki.redis.host")).noneIfBlank getOrElse "localhost"
    val redisClient = RedisClient(host = redisHost)(Akka.system)

    // Online user ids are cached in Redis so they'll be remembered accross server restarts,
    // and will be available to all app servers. But we cache them again with more details here
    // in-process mem too. (More details = we've looked up username etc in the database, but
    // in Redis we cache only user ids.) Not for longer than a few seconds though,
    // so that the online-users-json sent to the browsers on page load will be mostly up-to-date.
    // (It'll get patched, later, via pubsub events. SHOULD implement this, otherwise
    // race conditions can cause the online-users list in the browser to become incorrect.)
    private val usersOnlineCache: UsersOnlineCache =
      caffeine.cache.Caffeine.newBuilder()
        .expireAfterWrite(3, TimeUnit.SECONDS)
        .maximumSize(Int.MaxValue)
        .build()

    // ElasticSearch clients are thread safe. Their lifecycle should be the application lifecycle.
    // (see https://discuss.elastic.co/t/is-nodeclient-thread-safe/4231/3 )
    // (Later, could enable a certain 'client.transport.sniff' setting)
    //
    // old comment:
    // The client might throw: org.elasticsearch.action.search.SearchPhaseExecutionException
    // if the ElasticSearch database has not yet started up properly.
    // If you wait for:
    //   newClient.admin().cluster().prepareHealth().setWaitForGreenStatus().execute().actionGet()
    // then the newClient apparently works fine — but waiting for that (once at
    // server startup) takes 30 seconds, on my computer, today 2013-07-20.
    //
    val elasticSearchHost = "search"

    val elasticSearchClient = es.client.transport.TransportClient.builder().build()
      .addTransportAddress(
        new es.common.transport.InetSocketTransportAddress(
          jn.InetAddress.getByName(elasticSearchHost), 9300))

    val siteDaoFactory = new SiteDaoFactory(
      dbDaoFactory, redisClient, cache, usersOnlineCache, elasticSearchClient, config)

    val mailerActorRef = Mailer.startNewActor(Akka.system, siteDaoFactory)

    val notifierActorRef = Notifier.startNewActor(Akka.system, systemDao, siteDaoFactory)

    def indexerBatchSize = conf.getInt("ed.search.indexer.batchSize") getOrElse 100
    def indexerIntervalSeconds = conf.getInt("ed.search.indexer.intervalSeconds") getOrElse 5

    val indexerActorRef = SearchEngineIndexer.startNewActor(
      indexerBatchSize, indexerIntervalSeconds, elasticSearchClient, Akka.system, systemDao)

    def spamCheckBatchSize = conf.getInt("ed.spamcheck.batchSize") getOrElse 20
    def spamCheckIntervalSeconds = conf.getInt("ed.spamcheck.intervalSeconds") getOrElse 1

    val spamCheckActorRef = SpamCheckActor.startNewActor(
      spamCheckBatchSize, spamCheckIntervalSeconds, Akka.system, systemDao)

    val nginxHost =
      conf.getString("ed.nginx.host").orElse(
        conf.getString("debiki.nginx.host")).noneIfBlank getOrElse "localhost"
    val (pubSub, strangerCounter) = PubSub.startNewActor(Akka.system, nginxHost, redisClient)

    val renderContentActorRef = RenderContentService.startNewActor(Akka.system, siteDaoFactory)

    val spamChecker = new SpamChecker()
    spamChecker.start()

    def systemDao: SystemDao = new SystemDao(dbDaoFactory, cache) // [rename] to newSystemDao()?

    val applicationVersion = "0.00.40"  // later, read from some build config file

    val applicationSecret =
      conf.getString("play.crypto.secret").noneIfBlank.getOrDie(
        "Config value 'play.crypto.secret' missing [DwE75FX0]")

    val applicationSecretNotChanged = applicationSecret == "changeme"

    val e2eTestPassword: Option[String] =
      conf.getString("ed.e2eTestPassword").noneIfBlank

    val forbiddenPassword: Option[String] =
      conf.getString("ed.forbiddenPassword").noneIfBlank

    val secure =
      conf.getBoolean("ed.secure").orElse(
        conf.getBoolean("debiki.secure")) getOrElse {
      p.Logger.info("Config value 'ed.secure' missing; defaulting to true. [DwM3KEF2]")
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
        conf.getInt("ed.port").orElse(conf.getInt("debiki.port")) getOrElse {
          if (secure) 443
          else 80
        }
      }
    }

    val baseDomainNoPort =
      if (Play.isTest) "localhost"
      else conf.getString("ed.baseDomain").orElse(
        conf.getString("debiki.baseDomain")).noneIfBlank getOrElse "localhost"

    val baseDomainWithPort =
      if (secure && port == 443) baseDomainNoPort
      else if (!secure && port == 80) baseDomainNoPort
      else s"$baseDomainNoPort:$port"


    /** The hostname of the site created by default when setting up a new server. */
    val firstSiteHostname = conf.getString(FirstSiteHostnameConfigValue).orElse(
      conf.getString("debiki.hostname")).noneIfBlank

    if (firstSiteHostname.exists(_ contains ':'))
      p.Logger.error("Config value ed.hostname contains ':' [DwE4KUWF7]")

    val becomeFirstSiteOwnerEmail = conf.getString(BecomeOwnerEmailConfigValue).orElse(
      conf.getString("debiki.becomeOwnerEmailAddress")).noneIfBlank

    val anyCreateSiteHostname =
      conf.getString("ed.createSiteHostname").orElse(
        conf.getString("debiki.createSiteHostname")).noneIfBlank
    val anyCreateTestSiteHostname =
      conf.getString("ed.createTestSiteHostname").orElse(
        conf.getString("debiki.createTestSiteHostname")).noneIfBlank

    // The hostname must be directly below the base domain, otherwise
    // wildcard HTTPS certificates won't work: they cover 1 level below the
    // base domain only, e.g. host.example.com but not sub.host.example.com,
    // if the cert was issued for *.example.com.
    val siteByIdHostnameRegex: Regex =
      s"""^$SiteByIdHostnamePrefix(.*)\\.$baseDomainNoPort$$""".r

    val maxUploadSizeBytes =
      conf.getInt("ed.uploads.maxKiloBytes").orElse(
        conf.getInt("debiki.uploads.maxKiloBytes").map(_ * 1000)).getOrElse(3*1000*1000)

    val anyUploadsDir = {
      import Globals.LocalhostUploadsDirConfigValueName
      val value = conf.getString(LocalhostUploadsDirConfigValueName).noneIfBlank
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

    val securityComplaintsEmailAddress =
      conf.getString("ed.securityComplaintsEmailAddress").orElse(
        conf.getString("debiki.securityComplaintsEmailAddress")).noneIfBlank
  }

}


object Config {
  val CreateSitePath = "ed.createSite"
  val SuperAdminPath = "ed.superAdmin"
  val SuperAdminEmailAddressesPath = s"$SuperAdminPath.emailAddresses"
  val CnameTargetHostConfValName = "ed.cnameTargetHost"
}


class Config(conf: play.api.Configuration) {

  val cnameTargetHost = conf.getString(Config.CnameTargetHostConfValName).noneIfBlank

  object cdn {
    val origin = conf.getString("ed.cdn.origin").noneIfBlank
    def uploadsUrlPrefix = origin.map(_ + Globals.uploadsUrlPath)
  }

  object createSite {
    val path = Config.CreateSitePath
    REFACTOR; RENAME // to ...tooManyTryLaterUrl
    val tooManyTryLaterPagePath = conf.getString(s"$path.tooManyTryLaterPagePath")
    val maxSitesPerPerson = conf.getInt(s"$path.maxSitesPerIp") getOrElse 10
    val maxSitesTotal = conf.getInt(s"$path.maxSitesTotal") getOrElse 1000
    REFACTOR; RENAME // Later: rename to ed.createSite.newSiteQuotaMBs?
    val quotaLimitMegabytes =
      conf.getInt("ed.newSite.quotaLimitMegabytes").orElse(
        conf.getInt("debiki.newSite.quotaLimitMegabytes"))
  }

  object superAdmin {
    val path = Config.SuperAdminPath
    val hostname = conf.getString(s"$path.hostname")
    val siteId = conf.getString(s"$path.siteId")
    val emailAddresses = conf.getString(Config.SuperAdminEmailAddressesPath) match {
      case None => Nil
      case Some(emails) => emails.split(',').map(_.trim).toVector
    }
  }
}

