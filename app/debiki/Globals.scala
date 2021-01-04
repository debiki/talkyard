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
import debiki.EdHttp._
import ed.server.spam.{SpamCheckActor, SpamChecker}
import debiki.dao._
import debiki.dao.migrations.ScalaBasedMigrations
import ed.server.search.SearchEngineIndexer
import ed.server.notf.NotifierActor
import java.{lang => jl, net => jn}
import java.util.concurrent.TimeUnit
import ed.server.pubsub.{PubSub, PubSubApi, StrangerCounterApi}
import org.{elasticsearch => es}
import org.scalactic._
import play.{api => p}
import play.api.libs.ws.WSClient
import redis.RedisClient
import scala.collection.immutable
import scala.concurrent.duration._
import scala.concurrent.{Await, ExecutionContext, Future, TimeoutException}
import scala.util.matching.Regex
import ed.server.EdContext
import ed.server.http.GetRequest
import ed.server.jobs.Janitor
import play.api.http.{HeaderNames => p_HeaderNames}
import play.api.mvc.RequestHeader
import talkyard.server.TyLogging


object Globals extends TyLogging {

  class NoStateError extends AssertionError(
    "No Globals.State created, please call onServerStartup() [DwE5NOS0]")

  object AppSecretNotChangedException extends QuickException
  object StillConnectingException extends QuickException

  class DatabasePoolInitializationException(cause: Exception) extends RuntimeException(cause)

  val LoginOriginConfValName = "talkyard.loginOrigin"
  val CdnOriginConfValName = "talkyard.cdn.origin"
  val LocalhostUploadsDirConfValName = "talkyard.uploads.localhostDir"
  val DefaultLocalhostUploadsDir = "/opt/talkyard/uploads/"

  val AppSecretConfValName = "play.http.secret.key"
  val AppSecretDefVal = "change_this"
  val DefaultSiteIdConfValName = "talkyard.defaultSiteId"
  val DefaultSiteHostnameConfValName = "talkyard.hostname"
  val BecomeOwnerEmailConfValName = "talkyard.becomeOwnerEmailAddress"
  val SiteOwnerTermsUrl = "talkyard.siteOwnerTermsUrl"
  val SiteOwnerPrivacyUrl = "talkyard.siteOwnerPrivacyUrl"
  val MaxGroupMentionNotfsConfValName = "talkyard.maxGroupMentionNotifications"

  val CreateSiteHostnameConfValName = "talkyard.createSiteHostname"

  CLEAN_UP; REMOVE //  Now placed in  core  instead -------
  def isProd: Boolean = _isProd

  def isDevOrTest: Boolean = !isProd

  /** One never changes from Prod to Dev or Test, or from Dev or Test to Prod, so we can safely
    * remember isProd, forever. (However, is-Dev and is-Test might change, depending on which
    * commands one types in the cli.)
    */
  def setIsProdForever(isIt: Boolean): Unit = {
    dieIf(hasSet && isIt != _isProd, "EdE2PWVU07")
    _isProd = isIt
    hasSet = true
    com.debiki.core.Prelude.setIsProdForever(isIt)
  }

  private var _isProd = true
  private var hasSet = false
  // ------------------------------------------------------
}


class E2eTestCounters {
  @volatile var numReportedSpamFalsePositives: Int = 0
  @volatile var numReportedSpamFalseNegatives: Int = 0
}


class Globals(  // RENAME to TyApp? or AppContext? TyAppContext? variable name = appCtx
                // But then rename EdContext  to ... what?
  private val appLoaderContext: p.ApplicationLoader.Context,
  val executionContext: scala.concurrent.ExecutionContext,
  val wsClient: WSClient,
  val actorSystem: ActorSystem,
  val tracer: io.opentracing.Tracer) extends TyLogging {

  def outer: Globals = this

  import Globals._

  def setEdContext(edContext: EdContext): Unit = {
    dieIf(this.edContext ne null, "EdE7UBR10")
    this.edContext = edContext
  }

  var edContext: EdContext = _

  val e2eTestCounters = new E2eTestCounters

  private implicit def execCtc: ExecutionContext = executionContext

  val conf: p.Configuration = appLoaderContext.initialConfiguration
  def rawConf: p.Configuration = conf

  val config = new Config(conf)

  // Dupl [305926XFG24] -------------------
  private def getBoolOrFalse(confValName: String): Boolean =
    getBoolOrDefault(confValName, default = false)

  private def getIntOrDefault(confName: String, default: Int): Int =
    conf.getOptional[Int](confName) getOrElse default

  private def getBoolOrDefault(confName: String, default: Boolean): Boolean =
    conf.getOptional[Boolean](confName) getOrElse default

  // private def getStringOrEmpty[A](confName: String): String =
  //   getStringOrDefault(confName, "")
  //
  //private def getStringOrDefault[A](confName: String, default: String): String =
  //  conf.getOptional[String](confName).trimNoneIfBlank getOrElse default

  private def getStringNoneIfBlank[A](confName: String): Option[String] =
    conf.getOptional[String](confName).noneIfBlank
  // --------------------------------------


  /** Can be accessed also after the test is done and Play.maybeApplication is None.
    */
  val isDev: Boolean = appLoaderContext.environment.mode == play.api.Mode.Dev
  val isOrWasTest: Boolean = appLoaderContext.environment.mode == play.api.Mode.Test
  val isProd: Boolean = Globals.isProd

  // This helps with shutting down when running tests — might not work properly now
  // with Play 2.8 but seems the test shutdown properly anyway.
  def testsDoneServerGone: Boolean =
    isOrWasTest && (!isInitialized )  // [PLAY28] ?? || Play.maybeApplication.isEmpty)

  val isTestDisableScripts: Boolean = isOrWasTest && {
    val disable = getBoolOrFalse("isTestDisableScripts")
    if (disable) {
      logger.info("Is test with scripts disabled. [EsM4GY82]")
    }
    disable
  }

  lazy val (isTestDisableBackgroundJobs, isTestEnableJanitor): (Boolean, Boolean) =
      if (isProd) (false, false) else {
    val disableJobs = getBoolOrFalse("isTestDisableBackgroundJobs")
    val butEnableJanitor = getBoolOrFalse("isTestEnableJanitor")
    if (disableJobs) {
      val butJanitor = if (butEnableJanitor) ", except for the Janitor" else ", incl the Janitor"
      logger.info(s"Is test with background jobs disabled$butJanitor. [EsM6JY0K2]")
    }
    (disableJobs, butEnableJanitor)
  }

  def isInitialized: Boolean = (_state ne null) && _state.isGood

  @volatile private var _state: State Or Option[Exception] = _

  private def state: State = {
    if (_state eq null) {
      throw new NoStateError()
    }
    // Errors thrown here will be shown in the browser. Admin friendly :-)
    _state match {
      case Good(state) => state
      case Bad(anyException) =>
        logger.warn("Accessing state before it's been created. I'm still trying to start.")
        throw anyException getOrElse StillConnectingException
    }
  }


  @volatile var killed = false
  @volatile var shallStopStuff = false

  // 5 seconds sometimes in a test —> """
  // debiki.RateLimiterSpec *** ABORTED ***
  // Futures timed out after [5 seconds]
  // """
  // (in that case, all tests went fine, but couldn't shutdown the test server quickly enough)
  val ShutdownTimeout: FiniteDuration = 10.seconds

  /** For now (forever?), ignore platforms that don't send Linux signals.
    */
  sun.misc.Signal.handle(new sun.misc.Signal("TERM"), new sun.misc.SignalHandler () {
    def handle(signal: sun.misc.Signal): Unit = {
      logger.info("Got SIGTERM, exiting with status 0 [EsMSIGTERM]")
      killed = true
      System.exit(0)  // doing this here instead of [9KYKW25] although leaves PID file [65YKFU02]
    }
  })

  sun.misc.Signal.handle(new sun.misc.Signal("INT"), new sun.misc.SignalHandler () {
    def handle(signal: sun.misc.Signal): Unit = {
      logger.info("Got SIGINT, exiting with status 0 [EsMSIGINT]")
      killed = true
      System.exit(0)  // doing this here instead of [9KYKW25] although leaves PID file [65YKFU02]
    }
  })


  val metricRegistry = new metrics.MetricRegistry()
  val mostMetrics = new MostMetrics(metricRegistry)

  val talkyardVersion: String = {
    // Placed here by docker-compose.yml, in dev builds, and the Dockerfile, in prod builds.
    // [Scala_213] Using(...) { ... }
    var source: scala.io.Source = null
    try {
      source = scala.io.Source.fromFile("/opt/talkyard/app/version.txt")(scala.io.Codec.UTF8)
      source.mkString.trim
    }
    finally {
      if (source ne null) source.close()
    }
  }

  // Could rename to "rendererVersion".
  val applicationVersion = "0.00.74"  // later, read from some build config file

  def applicationSecret: String = _appSecret

  private var _appSecret: String = _

  private def reloadAppSecret(): Unit = {
    _appSecret = conf.getOptional[String](AppSecretConfValName).orElse(
      conf.getOptional[String]("play.crypto.secret")).noneIfBlank.getOrDie(
      s"Config value '$AppSecretConfValName' missing [EdENOAPPSECRET]")
  }


  /** Lets people do weird things, namely fake their ip address (&fakeIp=... url param)
    * in order to create many e2e test sites — also in prod mode, for smoke tests.
    * The e2e test sites will have ids like {{{test__...}}} so that they can be deleted safely.
    */

  val e2eTestPassword: Option[String] = getStringNoneIfBlank("talkyard.e2eTestPassword")

  /** Lets people do some forbidden things, like creating a site with a too short
    * local hostname.
    */
  val forbiddenPassword: Option[String] = getStringNoneIfBlank("talkyard.forbiddenPassword")

  /** Maybe later, let individual sites require longer passwords. This conf val will then be the
    * minimum length, for all sites. (So server admins can require a min length they're ok with.)
    * 8 = rather low, but zxcvbn helpfully blocks really bad 8 char passwords like "password".
    * 10 = can be good passwords.
    */
  val minPasswordLengthAllSites: Int =
    conf.getOptional[Int]("talkyard.minPasswordLength") match {
      case None =>
        AllSettings.MinPasswordLengthHardcodedDefault
      case Some(length) =>
        dieIf(length < AllSettings.HardMinPasswordLength, "TyE2WKG7",
          "I refuse to start: Min password length is less than 8 chars; that's too easy to crack. Bye.")
        length
    }

  val mayFastForwardTime: Boolean =
    if (!isProd) true
    else getBoolOrFalse("talkyard.mayFastForwardTime")

  def systemDao: SystemDao = state.systemDao  // [rename] to newSystemDao()?


  def siteDao(siteId: SiteId): SiteDao =  // RENAME [rename] to newSiteDao?
    state.siteDaoFactory.newSiteDao(siteId)


  def redisClient: RedisClient = state.redisClient


  def sendEmail(email: Email, siteId: SiteId): Unit = {
    state.mailerActorRef ! (email, siteId)
  }

  def sendEmails(emails: Iterable[Email], siteId: SiteId): Unit = {
    COULD_OPTIMIZE // send just one message with all emails to send.
    emails foreach { email =>
      sendEmail(email, siteId)
    }
  }

  def endToEndTestMailer: ActorRef = state.mailerActorRef
  def spamCheckActor: Option[ActorRef] = state.spamCheckActorRef

  def renderPageContentInBackground(
        sitePageId: SitePageId, customParams: Option[PageRenderParamsAndHash]): Unit = {
    if (!isTestDisableBackgroundJobs) {
      state.renderContentActorRef ! (sitePageId, customParams)
    }
  }

  /** Good to stop it, when importing sites via JSON, so can avoid PostgreSQL serialization
    * failures. Later: One single actor for all database writes? + message passing. [one-db-writer]
    */
  def pauseAutoBackgorundRenderer3Seconds(): Unit = {
    if (isTestDisableBackgroundJobs) return
    state.renderContentActorRef ! RenderContentService.PauseThreeSeconds
  }

  def spamChecker: SpamChecker = state.spamChecker

  /** Is non-zero iff server maintenance is going on, so that the server is read-only.
    * Should be set to the Unix second when one thinks the maintenance will be done,
    * or to 1 if one isn't sure. A change requires a Play app server restart to get picked up.
    */
  val maintWorkUntilSecs: Option[Long] = conf.getOptional[Long]("talkyard.maintenanceUntilUnixSeconds")

  /* Add configurable support email address?  [CONFADDRS]
  val supportEmailAddress: Option[String] =
    getStringNoneIfBlank("talkyard.supportEmailAddress") */

  val securityComplaintsEmailAddress: Option[String] =
    getStringNoneIfBlank("talkyard.securityComplaintsEmailAddress")


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
  val secure: Boolean =
    conf.getOptional[Boolean]("talkyard.secure") getOrElse {
      logger.info("Config value 'talkyard.secure' missing; defaulting to true. [DwM3KEF2]")
      true
    }


  lazy val (anyLoginOrigin, loginOriginConfigErrorMessage): (Option[String], Option[String]) =
    if (isOrWasTest) {
      // The base domain should have been automatically configured with the test server's
      // listen port.
      (Some(s"$scheme://$baseDomainWithPort"), None)
    }
    else {
      val anyOrigin = conf.getOptional[String](LoginOriginConfValName) orElse {
        defaultSiteHostname map { hostname =>
          s"$scheme://$hostname$colonPort"
        }
      }
      var anyError: Option[String] = None
      anyOrigin foreach { origin =>
        if (secure && !origin.startsWith("https:")) {
          anyError = Some(s"Config value '$LoginOriginConfValName' does not start with 'https:'")
          logger.error(s"Disabling OAuth: ${anyError.get}. It is: '$origin' [DwE6KW5]")
        }
      }
      (anyOrigin, anyError)
    }


  object socialLogin {
    import com.mohiva.play.silhouette.impl.providers.{OAuth1Settings, OAuth2Settings}

    val googleOAuthSettings: OAuth2Settings Or ErrorMessage = goodOrError {
      def getGoogle(confValName: String) = getConfValOrThrowDisabled(confValName, "Google")
      OAuth2Settings(
        authorizationURL = getStringNoneIfBlank("silhouette.google.authorizationURL"),
        accessTokenURL = getGoogle("silhouette.google.accessTokenURL"),
        redirectURL = makeRedirectUrl("google"),
        clientID = getGoogle("silhouette.google.clientID"),
        clientSecret = getGoogle("silhouette.google.clientSecret"),
        scope = getStringNoneIfBlank("silhouette.google.scope"))
    }

    val facebookOAuthSettings: OAuth2Settings Or ErrorMessage = goodOrError {
      def getFacebook(confValName: String) = getConfValOrThrowDisabled(confValName, "Facebook")
      OAuth2Settings(
        authorizationURL = getStringNoneIfBlank("silhouette.facebook.authorizationURL"),
        accessTokenURL = getFacebook("silhouette.facebook.accessTokenURL"),
        redirectURL = makeRedirectUrl("facebook"),
        clientID = getFacebook("silhouette.facebook.clientID"),
        clientSecret = getFacebook("silhouette.facebook.clientSecret"),
        scope = getStringNoneIfBlank("silhouette.facebook.scope"))
    }

    val twitterOAuthSettings: OAuth1Settings Or ErrorMessage = goodOrError {
      def getTwitter(confValName: String) = getConfValOrThrowDisabled(confValName, "Twitter")
      OAuth1Settings(
        requestTokenURL = getTwitter("silhouette.twitter.requestTokenURL"),
        accessTokenURL = getTwitter("silhouette.twitter.accessTokenURL"),
        authorizationURL = getTwitter("silhouette.twitter.authorizationURL"),
        callbackURL = makeRedirectUrl("twitter").get,
        consumerKey = getTwitter("silhouette.twitter.consumerKey"),
        consumerSecret = getTwitter("silhouette.twitter.consumerSecret"))
    }

    val githubOAuthSettings: OAuth2Settings Or ErrorMessage = goodOrError {
      def getGitHub(confValName: String) = getConfValOrThrowDisabled(confValName, "GitHub")
      OAuth2Settings(
        authorizationURL = getStringNoneIfBlank("silhouette.github.authorizationURL"),
        accessTokenURL = getGitHub("silhouette.github.accessTokenURL"),
        redirectURL = makeRedirectUrl("github"),
        apiURL = getStringNoneIfBlank("silhouette.github.apiURL"),
        clientID = getGitHub("silhouette.github.clientID"),
        clientSecret = getGitHub("silhouette.github.clientSecret"),
        scope = getStringNoneIfBlank("silhouette.github.scope"))
    }

    // rm
    val gitlabOAuthSettings: OAuth2Settings Or ErrorMessage = goodOrError {
      def getGitLab(confValName: String) = getConfValOrThrowDisabled(confValName, "GitLab")
      OAuth2Settings(
        authorizationURL = getStringNoneIfBlank("silhouette.gitlab.authorizationURL"),
        accessTokenURL = getGitLab("silhouette.gitlab.accessTokenURL"),
        redirectURL = makeRedirectUrl("gitlab"),
        clientID = getGitLab("silhouette.gitlab.clientID"),
        clientSecret = getGitLab("silhouette.gitlab.clientSecret"),
        scope = getStringNoneIfBlank("silhouette.gitlab.scope"))
    }

    val linkedInOAuthSettings: OAuth2Settings Or ErrorMessage = goodOrError {
      def getLinkedin(confValName: String) = getConfValOrThrowDisabled(confValName, "LinkedIn")
      OAuth2Settings(
        authorizationURL = getStringNoneIfBlank("silhouette.linkedin.authorizationURL"),
        accessTokenURL = getLinkedin("silhouette.linkedin.accessTokenURL"),
        redirectURL = makeRedirectUrl("linkedin"),
        // These fields no longer available in LinkedIn's API v2, unless one somehow
        // partners with LinkedIn;
        //apiURL = Some("https://api.linkedin.com/v2/me?fields=id,first-name,last-name,formatted-name,picture-url,email-address&oauth2_access_token=%s"),
        // Also profilePicture results in an error.
        // Instead:
        apiURL = Some("https://api.linkedin.com/v2/me?fields=id,firstName,lastName&oauth2_access_token=%s"),
        clientID = getLinkedin("silhouette.linkedin.clientID"),
        clientSecret = getLinkedin("silhouette.linkedin.clientSecret"),
        scope = getStringNoneIfBlank("silhouette.linkedin.scope"))
    }

    // rm
    val vkOAuthSettings: OAuth2Settings Or ErrorMessage = goodOrError {
      def getVk(confValName: String) = getConfValOrThrowDisabled(confValName, "VK")
      OAuth2Settings(
        authorizationURL = getStringNoneIfBlank("silhouette.vk.authorizationURL"),
        accessTokenURL = getVk("silhouette.vk.accessTokenURL"),
        redirectURL = makeRedirectUrl("vk"),
        clientID = getVk("silhouette.vk.clientID"),
        clientSecret = getVk("silhouette.vk.clientSecret"),
        scope = getStringNoneIfBlank("silhouette.vk.scope"))
    }

    // rm
    val instagramOAuthSettings: OAuth2Settings Or ErrorMessage = goodOrError {
      def getInstagram(confValName: String) = getConfValOrThrowDisabled(confValName, "Instagram")
      OAuth2Settings(
        authorizationURL = getStringNoneIfBlank("silhouette.instagram.authorizationURL"),
        accessTokenURL = getInstagram("silhouette.instagram.accessTokenURL"),
        redirectURL = makeRedirectUrl("instagram"),
        clientID = getInstagram("silhouette.instagram.clientID"),
        clientSecret = getInstagram("silhouette.instagram.clientSecret"),
        scope = getStringNoneIfBlank("silhouette.instagram.scope"))
    }


    private def goodOrError[A](block: => A): A Or ErrorMessage =
      try Good(block)
      catch {
        case ex: QuickMessageException => Bad(ex.message)
      }

    private def getConfValOrThrowDisabled(confValName: String, providerName: String): String =
      getStringNoneIfBlank(confValName) getOrElse {
        throw new QuickMessageException(
          s"Login via $providerName not possible: Config value missing: $confValName [TyE0SOCIALCONF")
      }

    private def makeRedirectUrl(provider: String): Option[String] = {
      // A relative path which will be resolved against the current request's host.
      // BUG?: seems Silhouette changes from https to http. So add origin ourselves:
      val urlPath = controllers.routes.LoginWithOpenAuthController.finishAuthentication(provider).url
      Some(anyLoginOrigin.getOrElse("") + urlPath)
    }
  }


  /** If secure=true, then prefix with 'https:', if absent (i.e. if only '//' specified),
    * so a 'http:' embedded comments iframe parent base address (i.e. a <base href=...> elem)
    * won't make us use http instead of https — that could break embedded comments when testing
    * locally and embedding page = http://localhost/... .
    */
  val anyCdnOrigin: Option[String] =
    config.cdn.origin.map(origin => {
      if (origin.startsWith("https:")) origin
      else if (secure && origin.startsWith("//")) "https:" + origin
      else if (!secure) origin
      else if (origin.startsWith("http:")) {
        die("EdEINSECCDNORIG", o"""The server is configured to use https, but in the config file,
            $CdnOriginConfValName is http://... (not https)""")
      }
      else {
        die("EdEBADCDNORIG", o"""In the config file, $CdnOriginConfValName is not http(s)
            but something else weird.""")
      }
    })

  def cdnOrSiteOrigin(siteHost: St): St =
    anyCdnOrigin.getOrElse(schemeColonSlashSlash + siteHost)

  val scheme: String = if (secure) "https" else "http"
  def schemeColonSlashSlash: String = scheme + "://"

  val port: Int = {
    if (isOrWasTest) {
      // Not on classpath: play.api.test.Helpers.testServerPort
      // Instead, duplicate its implementation here:
      sys.props.get("testserver.port").map(_.toInt) getOrElse 19001
    }
    else {
      conf.getOptional[Int]("talkyard.port") getOrElse {
        if (secure) 443
        else 80
      }
    }
  }

  def colonPort: String =
    if (secure && port == 443) ""
    else if (!secure && port == 80) ""
    else s":$port"

  val baseDomainNoPort: String =
    if (isOrWasTest) "localhost"
    else getStringNoneIfBlank("talkyard.baseDomain") getOrElse "localhost"

  val baseDomainWithPort: String =  // [CONFADDRS]
    if (secure && port == 443) baseDomainNoPort
    else if (!secure && port == 80) baseDomainNoPort
    else s"$baseDomainNoPort:$port"


  /** Accessing this hostname will return the default site, namely site 1 (or defaultSiteId,
    * if configured.)
    */
  val defaultSiteHostname: Option[String] =
    getStringNoneIfBlank(DefaultSiteHostnameConfValName)

  if (defaultSiteHostname.exists(_ contains ':'))
    logger.error(s"Config value $DefaultSiteHostnameConfValName contains ':' [DwE4KUWF7]")

  val becomeFirstSiteOwnerEmail: Option[String] =
    getStringNoneIfBlank(BecomeOwnerEmailConfValName)

  val siteOwnerTermsUrl: Option[String] =
    getStringNoneIfBlank(SiteOwnerTermsUrl)

  val siteOwnerPrivacyUrl: Option[String] =
    getStringNoneIfBlank(SiteOwnerPrivacyUrl)

  /** If accessing the server via ip address, then, if no website with a matching ip has been
    * configured in the database, we'll show the site with id 'defaultSiteId'. If not defined,
    * we'll use FirstSiteId (i.e. 1, one).
    */

  val defaultSiteId: SiteId = getIntOrDefault(DefaultSiteIdConfValName, FirstSiteId)

  /** New sites may be created only from this hostname. */
  val anyCreateSiteHostname: Option[String] =
    getStringNoneIfBlank(CreateSiteHostnameConfValName)
  val anyCreateTestSiteHostname: Option[String] =
    getStringNoneIfBlank("talkyard.createTestSiteHostname")

  val anyUploadsDir: Option[String] = {
    val value = getStringNoneIfBlank(LocalhostUploadsDirConfValName)
    val pathSlash = if (value.exists(_.endsWith("/"))) value else value.map(_ + "/")
    pathSlash match {
      case None =>
        Some(DefaultLocalhostUploadsDir)
      case Some(path) =>
        // SECURITY COULD test more dangerous dirs. Or whitelist instead?
        if (path == "/" || path.startsWith("/etc/") || path.startsWith("/bin/")) {
          logger.warn(o"""Config value $LocalhostUploadsDirConfValName specifies
                a dangerous path: $path — file uploads disabled. [DwE0GM2]""")
          None
        }
        else {
          pathSlash
        }
    }
  }

  val anyPublicUploadsDir: Option[String] = anyUploadsDir.map(_ + "public/")

  def settingsBySiteId(siteId: SiteId): AllSettings =
    siteDao(siteId).getWholeSiteSettings()

  def siteById(siteId: SiteId): Option[Site] =
    systemDao.getSiteById(siteId)

  def originOfSiteId(siteId: SiteId): Option[String] =
    systemDao.getSiteById(siteId).flatMap(_.canonicalHostname.map(originOf))

  def theHostnameOf(site: Site): String =
    site.canonicalHostnameStr getOrElse siteByPubIdHostnamePort(site.pubId)

  def theOriginOf(site: Site): String =
    originOf(site) getOrElse siteByPubIdOrigin(site.pubId)

  def originOf(site: Site): Option[String] = site.canonicalHostname.map(originOf)
  def originOf(host: Hostname): String = originOf(host.hostname)
  def originOf(hostOrHostname: String): String = {
    val (hostname, colonPortParam) = hostOrHostname.span(_ != ':')
    def portParam = colonPortParam drop 1
    dieIf(colonPortParam.nonEmpty && colonPortParam != colonPort,
      "EdE47SK2", o"""Bad port: $portParam. You're accessing the server via non-standard
        port $portParam, but then you need to add config value `talkyard.port=$portParam`,
        in file /opt/talkyard/conf/app/play.conf,
        otherwise I won't know for sure which port to include in URLs I generate.
        Also restart the app server for the new config to take effect:
        sudo docker-compose restart web app""")
    s"$scheme://$hostname$colonPort"
  }
  def originOf(request: p.mvc.RequestHeader): String = s"$scheme://${request.host}"

  def originOf(request: GetRequest): String =
    originOf(request.underlying)


  def poweredBy = s"https://www.talkyard.io"


  /** If a hostname matches this pattern, the site id can be extracted directly from the url.
    */
  val siteByIdHostnameRegex: Regex = {
    // The hostname must be directly below the base domain, otherwise
    // wildcard HTTPS certificates won't work: they cover 1 level below the
    // base domain only, e.g. host.example.com but not sub.host.example.com,
    // if the cert was issued for *.example.com.
    s"""^$SiteByIdHostnamePrefix(.*)\\.$baseDomainNoPort$$""".r
  }

  def SiteByIdHostnamePrefix = "site-"

  def siteByPubIdOrigin(pubId: PubSiteId): String =
    s"$scheme://${siteByPubIdHostnamePort(pubId)}"

  def siteByIdOrigin(siteId: SiteId): String =
    s"$scheme://${siteByIdHostnamePort(siteId)}"

  // [Scala_3]  can replace the two below with just one:  `siteId: SiteId | PubSiteId`.
  // And the two ...By..Origin above too.

  def siteByIdHostnamePort(siteId: SiteId): String =
    s"$SiteByIdHostnamePrefix$siteId.$baseDomainWithPort"

  def siteByPubIdHostnamePort(pubId: PubSiteId): String =
    s"$SiteByIdHostnamePrefix$pubId.$baseDomainWithPort"


  def pubSub: PubSubApi = state.pubSub
  def strangerCounter: StrangerCounterApi = state.strangerCounter


  /** Looks up a site by hostname, or directly by id.
    *
    * By id: If a HTTP request specifies a hostname like "site-<id>.<baseDomain>",
    * for example:  site-123.example.com,
    * then the site is looked up directly by id.
    */
  def lookupSiteOrThrow(request: RequestHeader): SiteBrief = {
    // Nginx sends the host name in the Host header — not in the request line.
    // (So, no need to use Play's request.host, which looks first in the request
    // line for any Absolute-URI,  e.g.: 'https://example.com/url/path',  defined in RFC 3986
    // https://tools.ietf.org/html/rfc3986#page-27
    // — Nginx instead sends just  '/url/path' and the host in the Host header.)
    // Later:
    //val hostInHeader = request.headers.get(p_HeaderNames.HOST).getOrElse("") //  [ngx_host_hdr]
    // For now: (doesn't matter — this'll use the Host header anyway)
    val hostInHeader = request.host
    lookupSiteOrThrow(host = hostInHeader, request.uri)
  }


  def lookupSiteOrThrow(url: String): SiteBrief = {
    val (scheme, separatorHostPathQuery) = url.span(_ != ':')
    val (host, pathAndQuery) =
      separatorHostPathQuery.drop(3).span(_ != '/') // drop(3) drops "://"
    lookupSiteOrThrow(host = host, pathAndQuery)
  }


  private def lookupSiteOrThrow(host: String, pathAndQuery: String): SiteBrief = {
    // Play supports one HTTP and one HTTPS port only, so it makes little sense
    // to include any port number when looking up a site.
    val hostname = if (host contains ':') host.span(_ != ':')._1 else host

    def defaultSiteIdAndHostname = {
      val hostname = defaultSiteHostname getOrElse throwForbidden(
        "EsE5UYK2", o"""No site hostname configured (config value: $DefaultSiteHostnameConfValName)""")
      if (defaultSiteId != FirstSiteId) {
        val site = systemDao.getSiteById(defaultSiteId).getOrDie(
          "EdEDEFSITEID", o"""There's no site with id $defaultSiteId, which is the configured
            default site id (config value: $DefaultSiteIdConfValName)""")
        SiteBrief(defaultSiteId, site.pubId, Some(hostname), site.status,
              featureFlags = site.featureFlags)
      }
      else {
        // Lazy-create the very first site, with id 1, if doesn't yet exist.
        val firstSite = systemDao.getOrCreateFirstSite()
        SiteBrief(FirstSiteId, firstSite.pubId, Some(hostname), firstSite.status,
              featureFlags = firstSite.featureFlags)
      }
    }

    if (defaultSiteHostname is hostname)
      return defaultSiteIdAndHostname

    // If the hostname is like "site-123.example.com" then we'll just lookup site id 123.
    // Or if the id is long, like "site-aabbcc112233.ex.com" then we'll lookup by publ id aabb...33.
    val SiteByIdRegex = siteByIdHostnameRegex // uppercase, otherwise Scala won't "de-structure".
    hostname match {
      case SiteByIdRegex(siteIdString: String) =>
        val anySite =
          if (siteIdString.length >= Site.MinPubSiteIdLength) {
            systemDao.getSiteByPubId(siteIdString)
          }
          else {
            SECURITY; PRIVACY // LATER, don't allow lookup by direct id, in prod mode,  [5UKFBQW2]
            // because that'd let people find and crawl all sites hosted by this server
            // (by crawling site-1, site-2, ...). And the server owners might not like that.
            // (Access by publ site ids is ok though: they are long random strings, not sequential ids.)
            // throwForbiddenIf(isProd && !okForbiddenPassword,
            //    "TyE4HJWQ10", "Looking up sites by private id is not allowed")
            val siteId = siteIdString.toIntOrThrow("EdE5PJW2", s"Bad site id: $siteIdString")
            systemDao.getSiteById(siteId)
          }
        anySite match {
          case None =>
            throwNotFound("DwE72SF6", s"No site with id $siteIdString")
          case Some(site: Site) =>
            COULD // link to canonical host if (site.hosts.exists(_.role == SiteHost.RoleCanonical))
            // Let the config file hostname have precedence over the database.
            if (site.id == defaultSiteId && defaultSiteHostname.isDefined)
              return site.brief.copy(hostname = defaultSiteHostname)
            else
              return site.brief
        }
      case _ =>
    }

    // Id unknown so we'll lookup the hostname instead.
    val lookupResult = systemDao.lookupCanonicalHost(hostname) match {
      case Some(result) =>
        if (result.thisHost == result.canonicalHost)
          result
        else result.thisHost.role match {
          case Hostname.RoleDuplicate =>
            result
          case Hostname.RoleRedirect =>
            throwPermanentRedirect(originOf(result.canonicalHost.hostname) + pathAndQuery)
          case Hostname.RoleLink =>
            die("DwE2KFW7", "Not implemented: <link rel='canonical'>")
          case _ =>
            die("DwE20SE4")
        }
      case None =>
        if (Site.Ipv4AnyPortRegex.matches(hostname)) {
          // Make it possible to access the server before any domain has been pointed
          // to it, just after installation, by lazy-creating an empty default site.
          return defaultSiteIdAndHostname
        }
        throwSiteNotFound(
          hostname, debugCode = "LKPCANHOST")
    }
    val site = systemDao.getSiteById(lookupResult.siteId) getOrDie "EsE2KU503"
    site.brief
  }


  def startStuff(): Unit = {
    if (_state ne null)
      throw new jl.IllegalStateException(o"""Server already running, was it not properly
        shut down last time? Please hit CTRL+C to kill it. [DwE83KJ9]""")

    DeadlockDetector.ensureStarted()

    // Let the server start, whilst we try to connect to services like the database and Redis.
    // If we're unable to connect to a service, then we'll set _state to a
    // developer / operations-team friendly error message about the service being
    // inaccessible, and some tips about how troubleshoot this and how to start it.
    // Whilst the state is being created, we'll show a message in any browser that
    // the server is starting, please wait — to me, that's more user friendly than
    // a blank page, in case this takes long.
    val createStateFuture = Future {
      tryCreateStateUntilKilled()
    }

    createStateFuture foreach { _ =>
      logger.info("State created. [EsMSTATEREADY]")
    }

    // When testing, never proceed before the server has started properly, or tests will fail (I think).
    if (isOrWasTest) {
      try {
        Await.ready(createStateFuture, 99.seconds)
        if (killed) {
          logger.info("Killed. Bye. [EsMKILLED]")
          // Don't know how to tell Play to exit? Maybe might as well just:
          System.exit(0)
          // However this leaves a RUNNING_PID file. So the docker container deletes it
          // before start, see docker/play-prod/Dockerfile [65YKFU02]  <— this was before,
          //                                     when also Prod mode waited for the future.

          // However this block won't run if we've started already. So exiting directly
          // in the signal handler instea, right now, see [9KYKW25] above. Not sure why Play
          // apparently ignores signals, once we've started (i.e. returned from this function).
        }
      }
      catch {
        case _: TimeoutException =>
          logger.error("Creating state takes too long, something is amiss? [EsESTATESLOW]")
          System.exit(0)
      }
    }
  }


  private def tryCreateStateUntilKilled(): Unit = {
    logger.info("Creating state.... [EdMCREATESTATE]")
    _state = Bad(None)
    var firsAttempt = true

    while (_state.isBad && !killed && !shallStopStuff) {
      if (!firsAttempt) {
        // Don't attempt to connect to everything too quickly, because then 100 MB log data
        // with "Error connecting to database ..." are quickly generated.
        Thread.sleep(4000)
        if (killed || shallStopStuff) {
          logger.info(killed ? "Killed. Bye. [EsM200KILLED]" |
              "Aborting create-state loop, shall stop stuff [EsMSTOPSTATE1]")
          return
        }
      }
      firsAttempt = false
      val cache = makeCache
      try {
        reloadAppSecret()
        if (isProd && _appSecret == AppSecretDefVal)
          throw AppSecretNotChangedException

        logger.info("Connecting to database... [EsM200CONNDB]")
        val readOnlyDataSource = Debiki.createPostgresHikariDataSource(readOnly = true, conf, isOrWasTest)
        val readWriteDataSource = Debiki.createPostgresHikariDataSource(readOnly = false, conf, isOrWasTest)
        val rdb = new Rdb(readOnlyDataSource, readWriteDataSource)
        val dbDaoFactory = new RdbDaoFactory(
          rdb, ScalaBasedMigrations, getCurrentTime = now, cdnOrigin = anyCdnOrigin, isOrWasTest)

        // Create any missing database tables before `new State`, otherwise State
        // creates background threads that might attempt to access the tables.
        logger.info("Running database migrations... [EsM200MIGRDB]")
        new SystemDao(dbDaoFactory, cache, this).applyEvolutions()

        logger.info("Done migrating database. Connecting to other services... [EsM200CONNOTR]")
        val newState = new State(dbDaoFactory, cache)

        if (isOrWasTest && conf.getOptional[Boolean]("isTestShallEmptyDatabase").contains(true)) {
          logger.info("Emptying database... [EsM200EMPTYDB]")
          newState.systemDao.emptyDatabase()
        }

        _state = Good(newState)
        logger.info("Done creating state [EsMSTATEOK]")
      }
      catch {
        case ex: com.zaxxer.hikari.pool.HikariPool.PoolInitializationException =>
          _state = Bad(Some(new DatabasePoolInitializationException(ex)))
        case ex @ AppSecretNotChangedException =>
          logger.error(s"Admin error: The admin hasn't edited '$AppSecretConfValName' [EdE2QCHP4]", ex)
          _state = Bad(Some(ex))
        case ex @ StillConnectingException =>
          logger.error("Bug: StillConnectingException [EdE3PG7FY1]", ex)
          _state = Bad(Some(ex))
        case ex: Exception =>
          logger.error("Unknown state creation error [EsE4GY67]", ex)
          _state = Bad(Some(ex))
      }
    }

    if (killed || shallStopStuff) {
      logger.info("Aborting create-state loop [EsMSTOPSTATE2]")
      return
    }

    // The render engines might be needed by some Java (Scala) evolutions.
    // Let's create them in this parallel thread rather than blocking the whole server.
    // (Takes 2? 5? seconds.)
    edContext.nashorn.startCreatingRenderEngines()

    if (!isTestDisableBackgroundJobs) {
      actorSystem.scheduler.scheduleOnce(5.seconds, state.renderContentActorRef,
          RenderContentService.RegenerateStaleHtml())(executionContext)
    }

    logger.info("Done creating rendering engines [EsMENGDONE]")
  }


  def stopStuff(): Unit = {
    // Play.start() first calls Play.stop(), so:
    if (_state eq null)
      return

    if (_state.isBad) {
      shallStopStuff = true
    }
    else {
      if (isDevOrTest) {
        // Could wait for this to complete, but doesn't matter — just dev & test.
        logger.info(s"Closing WebSockets ...")
        pubSub.closeWebSocketConnections()
      }

      // Shutdown the NotifierActor before the MailerActor, so no notifications
      // are lost because the MailerActor was gone, couldn't send them.
      logger.info(s"Stopping the NotifierActor ...")
      val (name, future) = stopPlease(state.notifierActorRef)
      Await.result(future, ShutdownTimeout)

      // Shutdown in parallel.
      logger.info(s"Stopping remaining actors ...")
      val futureShutdownResults = Seq(
            stopPlease(state.mailerActorRef),
            stopPlease(state.renderContentActorRef),
            stopPlease(state.indexerActorRef),
            stopPlease(state.spamCheckActorRef),
            stopPlease(state.janitorActorRef),
            stopPlease(state.pubSubActorRef))

      state.elasticSearchClient.close()
      state.redisClient.quit()
      state.dbDaoFactory.db.readOnlyDataSource.asInstanceOf[HikariDataSource].close()
      state.dbDaoFactory.db.readWriteDataSource.asInstanceOf[HikariDataSource].close()
      wsClient.close()

      // Wait ... (Also see:
      // https://stackoverflow.com/questions/16256279/how-to-wait-for-several-futures )
      futureShutdownResults foreach { nameAndFutureResult =>
        logger.info(s"Waiting for ${nameAndFutureResult._1} to stop ...")
        Await.result(nameAndFutureResult._2, ShutdownTimeout)
      }
      logger.info(s"All actors stopped")
    }

    _state = null
    timeStartMillis = None
    timeOffsetMillis = 0

    shutdownLogging()
  }


  private def stopPlease(anyActorRef: Option[ActorRef])
        : (String, Future[Boolean]) = anyActorRef match {
    case None => ("None", Future.successful(true))
    case Some(ref) => stopPlease(ref)
  }


  private def stopPlease(actorRef: ActorRef): (String, Future[Boolean]) = {
    logger.info(s"Telling actor to stop: ${actorRef.path}")
    val future = gracefulStop(actorRef, ShutdownTimeout)
    (actorRef.path.name, future)
  }


  def shutdownLogging(): Unit = {
    // Flush any async log messages, just in case, so they won't get lost.
    // See: https://logback.qos.ch/manual/configuration.html#stopContext
    // and: https://github.com/logstash/logstash-logback-encoder/tree/logstash-logback-encoder-4.9
    // this: """In order to guarantee that logged messages have had a chance to be processed by
    // the TCP appender, you'll need to cleanly shut down logback when your application exits."""
    import org.slf4j.LoggerFactory
    import ch.qos.logback.classic.LoggerContext
    // assume SLF4J is bound to logback-classic in the current environment
    val loggerContext = LoggerFactory.getILoggerFactory.asInstanceOf[LoggerContext]
    loggerContext.stop()
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
  }).build().asInstanceOf[DaoMemCache]


  def now(): When = {
    // [E2EBUG]: This won't work when running many e2e tests in parallel.
    // But can make this work, by letting the time offset be per site.
    val millisNow =
      if (!isInitialized || !mayFastForwardTime) System.currentTimeMillis()
      else {
        val millisStart = timeStartMillis getOrElse System.currentTimeMillis()
        millisStart + timeOffsetMillis
      }
    When.fromMillis(millisNow)
  }

  /** When running tests only. */
  def testSetTime(when: When): Unit = {
    timeStartMillis = Some(when.millis)
    timeOffsetMillis = 0
  }

  /** When running tests only. */
  def testFastForwardTimeMillis(millis: Long): Unit = {
    timeOffsetMillis += millis
  }

  /** When running tests only. */
  def testResetTime(): Unit = {
    timeStartMillis = None
    timeOffsetMillis = 0
  }

  @volatile
  private var timeStartMillis: Option[Long] = None

  @volatile
  private var timeOffsetMillis: Long = 0


  val loadGlobalAdminScript: Boolean = getBoolOrFalse("talkyard.loadGlobalAdminScript")
  val loadGlobalStaffScript: Boolean = getBoolOrFalse("talkyard.loadGlobalStaffScript")
  val loadGlobalAllScript: Boolean = getBoolOrFalse("talkyard.loadGlobalAllScript")

  /** Not needed any longer, after I ported to compile time dependency injection, with Play 2.6?
    */
  private class State(
    val dbDaoFactory: RdbDaoFactory,
    val cache: DaoMemCache) {

    // Redis. (A Redis client pool makes sense if we haven't saturate the CPU on localhost, or
    // if there're many Redis servers and we want to round robin between them. Not needed, now.)
    val redisHost: ErrorMessage =
      conf.getOptional[String]("talkyard.redis.host").noneIfBlank getOrElse "localhost"
    val redisClient: RedisClient = RedisClient(host = redisHost)(actorSystem)

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
        .asInstanceOf[UsersOnlineCache]

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

    val elasticSearchClient: es.client.transport.TransportClient =
      new es.transport.client.PreBuiltTransportClient(es.common.settings.Settings.EMPTY)
        .addTransportAddress(
          new es.common.transport.TransportAddress(
            jn.InetAddress.getByName(elasticSearchHost), 9300))

    val siteDaoFactory = new SiteDaoFactory(
      edContext, dbDaoFactory, redisClient, cache, usersOnlineCache, elasticSearchClient, config)

    val mailerActorRef: ActorRef = MailerActor.startNewActor(actorSystem, siteDaoFactory, conf, now, isProd)

    val notifierActorRef: Option[ActorRef] =
      if (isTestDisableBackgroundJobs) None
      else Some(
        NotifierActor.startNewActor(executionContext, actorSystem, systemDao, siteDaoFactory))

    def indexerBatchSize: Int = getIntOrDefault("talkyard.search.indexer.batchSize", 100)
    def indexerIntervalSeconds: Int = getIntOrDefault("talkyard.search.indexer.intervalSeconds", 5)

    val indexerActorRef: Option[ActorRef] =
      if (isTestDisableBackgroundJobs) None
      else Some(SearchEngineIndexer.startNewActor(
          indexerBatchSize, indexerIntervalSeconds, executionContext,
          elasticSearchClient, actorSystem, systemDao))

    def spamCheckBatchSize: Int = getIntOrDefault("talkyard.spamcheck.batchSize", 20)
    def spamCheckIntervalSeconds: Int =
      getIntOrDefault("talkyard.spamcheck.intervalSeconds", if (isOrWasTest) 1 else 4)

    val spamCheckActorRef: Option[ActorRef] =
      if (isTestDisableBackgroundJobs) None
      else Some(SpamCheckActor.startNewActor(
        spamCheckBatchSize, spamCheckIntervalSeconds, actorSystem, executionContext, systemDao))

    // (Currently not in use, now with WebSocket ending in Play not in Nginx.)
    val nginxHost: String =
      conf.getOptional[String]("talkyard.nginx.host").noneIfBlank getOrElse "localhost"

    val (pubSub, pubSubActorRef, strangerCounter) = PubSub.startNewActor(outer)

    val renderContentActorRef: ActorRef =
      RenderContentService.startNewActor(outer, edContext.nashorn)

    val spamChecker = new SpamChecker(
          config, isDevTest = isOrWasTest, siteById, originOfSiteId, settingsBySiteId,
          executionContext, appLoaderContext.initialConfiguration, wsClient,
          edContext.nashorn)

    spamChecker.start()

    val janitorActorRef: Option[ActorRef] =
      if (isTestDisableBackgroundJobs && !isTestEnableJanitor) None
      else Some(Janitor.startNewActor(outer))

    def systemDao: SystemDao = new SystemDao(dbDaoFactory, cache, outer) // RENAME to newSystemDao()?

  }

}


object Config {
  val CreateSitePath = "talkyard.createSite"
  val SuperAdminPath = "talkyard.superAdmin"
  val SuperAdminEmailAddressesPath = s"$SuperAdminPath.emailAddresses"
  val DnsCnameTargetHostConfValName = "talkyard.cnameTargetHost"
}


class Config(conf: play.api.Configuration) extends TyLogging {

  import Globals._

  // Dupl [305926XFG24] -------------------
  private def getIntOrDefault(confName: String, default: Int): Int =
    conf.getOptional[Int](confName) getOrElse default

  private def getF64OrDefault(confName: St, default: f64): f64 =
    conf.getOptional[f64](confName) getOrElse default

  private def getBoolOrDefault(confName: String, default: Boolean): Boolean =
    conf.getOptional[Boolean](confName) getOrElse default

  private def getStringOrEmpty(confName: String): String =
    getStringOrDefault(confName, "")

  private def getStringOrDefault(confName: String, default: String): String =
    conf.getOptional[String](confName).trimNoneIfBlank getOrElse default
  // --------------------------------------

  val useServiceWorker: Boolean = getBoolOrDefault("talkyard.useServiceWorker", default = true)

  val maxWebSocketConnectionsAllSitesTotal: Int =
    getIntOrDefault("talkyard.maxWebSockets", 200)

  // Remove these later — just for now, new feature switches.
  // Don't set to true just yet — Apple iOS 12 handles None as Strict,
  // that seems really bad?
  val sameSiteNone: Boolean = getBoolOrDefault("talkyard.sameSiteNone", default = false)
  val sameSiteLax: Boolean = getBoolOrDefault("talkyard.sameSiteLax", default = false)

  private val mayPatchSiteIds: String = "," + getStringOrEmpty("talkyard.mayPatchSiteIds") + ","
  def mayPatchSite(siteId: SiteId): Boolean =
    siteId == FirstSiteId ||                        // <—— people's self hosted installations, fine
      includesSiteId(mayPatchSiteIds, siteId)       // <—— talkyard.net — restricted

  private def includesSiteId(value: St, siteId: SiteId): Bo =
    value.contains("," + siteId + ",")

  val mayImportSite: Boolean = getBoolOrDefault("talkyard.mayImportSite", default = false)
  val maxImportDumpBytes: Int = getIntOrDefault("talkyard.maxImportDumpBytes", default = 50*1000*1000)

  val oneTimeSecretSecondsToLive: Long = getIntOrDefault(
    "talkyard.oneTimeSecretSecondsToLive",
    // Typically, the subsequent steps will be automatic, by the browser [306KUD244],
    // so we can set a short expire time (no need to wait for the human to do
    // anything). In dev mode though, allow time for debugging & breakpoints.
    // Short time-to-live is good, mitigates session fixation attacks?
    // Maybe just 15 seconds would be better? Let's wait with that.
    default = if (Globals.isProd) 30 else 30 * 60).toLong

  // Or use sites_t.feature_flags_c for the superadmin site instead?
  val featureFlags: St = { // Map[String, FeatureOnOff] = {
    conf.getOptional[St]("talkyard.featureFlags") getOrElse ""
  }

  val isTestDisableRateLimits: Boolean = {
    val disable = getBoolOrDefault("talkyard.isTestDisableRateLimits", default = false)
    if (disable) {
      logger.info("Is test with rate limits disabled. [TyM0RATELIM]")
    }
    disable
  }

  val dnsCnameTargetHost: Option[String] =
    conf.getOptional[String](Config.DnsCnameTargetHostConfValName).noneIfBlank

  CLEAN_UP; REMOVE // this + the routes file entry [2KGLCQ4], use UploadsUrlBasePath instead only.
  val uploadsUrlPath: String = controllers.routes.UploadsController.servePublicFile("").url
  require(uploadsUrlPath == ed.server.UploadsUrlBasePath, "TyE2UKDU0")

  val maxGroupMentionNotfs: Int =
    conf.getOptional[Int](MaxGroupMentionNotfsConfValName) getOrElse 25

  val akismetApiKey: Option[String] =
    conf.getOptional[String]("talkyard.akismet.apiKey").noneIfBlank orElse  // old name
      conf.getOptional[String]("talkyard.akismetApiKey").noneIfBlank

  object uploads {
    TESTS_MISSING // test that these conf vals work properly, by running UploadsDaoSpec twice,
    // once with default values, once with 2 x higher values (people typically want to increase,
    // not decrease, these limits).

    private val p = "talkyard.uploads."
    // COULD make this configurable dynamically, per site, in the admin area, per site, too.
    // The limits below, would then be a hard max, for each site, regardless of admin area settings.
    //
    // Hmm, no, instead, this can be a per group setting,  [more_pat_perms]
    // configurable via: /-/groups/groupname.
    // There's a whole site setting too, and that's the max-for-everyone setting.
    // Also allowed upload types will be a per user/group setting, in addition
    // to a site wide restriction.

    val maxBytesPerDayMember: Int =
      getIntOrDefault(p + "maxKiloBytesPerDayMember", 10*Megabytes / 1000) * 1000

    val maxBytesPerDayStaff: Int =
      getIntOrDefault(p + "maxKiloBytesPerDayStaff", 999*Megabytes / 1000) * 1000

    val maxBytesPerWeekMember: Int =
      getIntOrDefault(p + "maxKiloBytesPerWeekMember", 25*Megabytes / 1000) * 1000

    val maxBytesPerWeekStaff: Int =
      getIntOrDefault(p + "maxKiloBytesPerWeekStaff", 999*Megabytes / 1000) * 1000

    private val largeUploadsSiteIds: String =
        "," + getStringOrEmpty(p + "mayUploadLargeFilesSiteIds") + ","
    def mayUploadLargeFiles(siteId: SiteId): Bo =
      siteId == FirstSiteId ||
        includesSiteId(largeUploadsSiteIds, siteId)

    val maxBytesLargeFile: i32 =
      i64ToMinMaxI32(conf.getOptional[f64](p + "maxMiBLargeFile").map(mib => (mib * MebibyteI64).toLong)
            .getOrElse(maxUploadSizeBytes)) // <— REMOVE change to 10 MiB, default?

    val maxBytesSmallFile: i32 =
      f64ToMinMaxI32(getF64OrDefault(p + "maxMiBSmallFile", default = 1) * MebibyteI64)

    // Old, remove
    // 2 values: 1 for whole server, absolute max all sites.
    // 1 per site.  serverGlobalMaxUploadKb   and siteDefaultMaxUploadKb
    // Or  maxUploadKbServerGlobal  and  maxUploadKbSiteDefault
    // And admins can config their site's siteDefaultMaxFileKb
    //   up to serverGlobalMaxFileKb?
    private def maxUploadSizeBytes: i64 =
      (conf.getOptional[i64]("talkyard.uploads.maxKiloBytesPerFile") orElse
        conf.getOptional[i64]("talkyard.uploads.maxKiloBytes")).map(_ * KibibyteI64)
            .getOrElse(3 * MebibyteI64)  // or 25 MiB? Nginx: TY_NGX_LIMIT_REQ_BODY_SIZE=25m
  }

  object cdn {
    /** No trailing slash. */
    val origin: Option[String] =
      conf.getOptional[String](CdnOriginConfValName).map(_.dropRightWhile(_ == '/')).noneIfBlank

    def uploadsUrlPrefix: Option[String] = origin.map(_ + uploadsUrlPath)
  }

  object createSite {
    private def path = Config.CreateSitePath

    REFACTOR; RENAME // to ...tooManyTryLaterUrl
    val tooManyTryLaterPagePath: Option[String] = conf.getOptional[String](s"$path.tooManyTryLaterPagePath")

    val maxSitesPerPerson: Int = getIntOrDefault(s"$path.maxSitesPerIp", 10)
    val maxTestSitesPerPerson: Int = getIntOrDefault(s"$path.maxTestSitesPerIp", maxSitesPerPerson * 3)

    val maxSitesTotal: Int = getIntOrDefault(s"$path.maxSitesTotal", 1000)
    val maxTestSitesTotal: Int = getIntOrDefault(s"$path.maxTestSitesTotal", maxSitesTotal * 3)

    REFACTOR; RENAME // Later: rename to ed.createSite.newSiteQuotaMBs?
    def quotaLimitMegabytes(isForBlogComments: Boolean, isTestSite: Boolean): Option[Int] = {
      val limitForRealSite =
        if (!isForBlogComments) quotaLimitMegabytesForum
        else {
          quotaLimitMegabytesBlogComments orElse {
            // Blogs are relatively small, so restrict them a bit more.
            quotaLimitMegabytesForum.map(_ / 10)
          }
        }
      val resultMaybeZero =
        if (isTestSite) limitForRealSite.map(_ / 10)
        else limitForRealSite
      resultMaybeZero.map(Math.max(_, 1))
    }

    private val quotaLimitMegabytesForum: Option[Int] =
      conf.getOptional[Int]("talkyard.newSite.quotaLimitMegabytesForum") orElse
      conf.getOptional[Int]("talkyard.newSite.quotaLimitMegabytes")

    private val quotaLimitMegabytesBlogComments: Option[Int] =
      conf.getOptional[Int]("talkyard.newSite.quotaLimitMegabytesBlogComments")
  }

  object superAdmin {
    private def path = Config.SuperAdminPath
    val hostname: Option[String] = conf.getOptional[String](s"$path.hostname")
    val siteIdString: Option[String] = conf.getOptional[String](s"$path.siteId")
    val emailAddresses: immutable.Seq[String] =
      conf.getOptional[String](Config.SuperAdminEmailAddressesPath) match {
        case None => Nil
        case Some(emails) => emails.split(',').map(_.trim).toVector
      }
  }


}

