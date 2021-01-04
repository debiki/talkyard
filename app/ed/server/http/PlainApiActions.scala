/**
 * Copyright (c) 2012-2017 Kaj Magnus Lindberg
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

package ed.server.http

import org.apache.commons.codec.{binary => acb}
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.RateLimits.NoRateLimits
import debiki.dao.{LoginNotFoundException, SiteDao}
import ed.server._
import ed.server.security._
import java.{util => ju}
import play.api.mvc._
import scala.concurrent.{ExecutionContext, Future}
import scala.util.{Failure, Success}
import EdSecurity.AvoidCookiesHeaderName
import scala.collection.mutable
import play.api.http.{HeaderNames => p_HNs}
import play.api.mvc.{Results => p_Results}
import talkyard.server.TyLogging


/** Play Framework Actions for requests to Debiki's HTTP API.
  */
class PlainApiActions(
  val safeActions: SafeActions,
  val globals: Globals,
  val security: EdSecurity,
  val rateLimiter: RateLimiter) extends TyLogging {

  import EdHttp._
  import security.DiscardingSecureCookie
  import security.DiscardingSessionCookie
  import safeActions.ExceptionAction

  def PlainApiAction[B](parser: BodyParser[B],
        rateLimits: RateLimits, allowAnyone: Bo = false, isLogin: Bo = false,
        avoidCookies: Bo = false, skipXsrfCheck: Bo = false)
        : ActionBuilder[ApiRequest, B] =
    PlainApiActionImpl(parser, rateLimits,
        allowAnyone = allowAnyone, isLogin = isLogin, avoidCookies = avoidCookies,
        skipXsrfCheck = skipXsrfCheck)

  def PlainApiActionStaffOnly[B](parser: BodyParser[B]): ActionBuilder[ApiRequest, B] =
    PlainApiActionImpl(parser, NoRateLimits, staffOnly = true)

  def PlainApiActionAdminOnly[B](rateLimits: RateLimits, parser: BodyParser[B])
        : ActionBuilder[ApiRequest, B] =
    PlainApiActionImpl(parser, rateLimits, adminOnly = true)

  def PlainApiActionApiSecretOnly[B](rateLimits: RateLimits, parser: BodyParser[B])
        : ActionBuilder[ApiRequest, B] =
    PlainApiActionImpl(parser, rateLimits, viaApiSecretOnly = true)

  def PlainApiActionSuperAdminOnly[B](parser: BodyParser[B])
        : ActionBuilder[ApiRequest, B] =
    PlainApiActionImpl(parser, NoRateLimits, superAdminOnly = true)



  /** Checks the session id and xsrf token and looks up the user rate limits the endpoint.
    *
    * Throws Forbidden if this is a POST request with no valid xsrf token.
    * Creates a new xsrf token cookie, if there is none, or if it's invalid.
    *
    * Throws Forbidden, and deletes the session id cookie, if any login id
    * doesn't map to any login entry.
    * The SidStatusRequest.sidStatus passed to the action is either SidAbsent or a SidOk.
    */
  def PlainApiActionImpl[B](aParser: BodyParser[B],
        rateLimits: RateLimits,
        adminOnly: Boolean = false,
        staffOnly: Boolean = false,
        allowAnyone: Boolean = false,  // try to delete 'allowAnyone'? REFACTOR
        avoidCookies: Boolean = false,
        isLogin: Boolean = false,
        superAdminOnly: Boolean = false,
        viaApiSecretOnly: Boolean = false,
        skipXsrfCheck: Bo = false): ActionBuilder[ApiRequest, B] =
      new ActionBuilder[ApiRequest, B] {

    override def parser: BodyParser[B] =
      aParser

    override protected def executionContext: ExecutionContext =
      globals.executionContext

    def numOnly: Int = adminOnly.toZeroOne + superAdminOnly.toZeroOne + staffOnly.toZeroOne
    require(numOnly <= 1, "EsE4KYF02")
    require(!allowAnyone || numOnly == 0, "EsE8KU24K")

    override def composeAction[A](action: Action[A]): Action[A] = {
      ExceptionAction.async(action.parser) { request: Request[A] =>
        action(request)
      }
    }


    override def invokeBlock[A](request: Request[A], block: ApiRequest[A] => Future[Result])
            : Future[Result] = {
      import scala.concurrent.duration._
      import scala.concurrent.Promise

      val Slow3gHostnamePart = "slow-3g"  // also in tests/e2e/

      if (globals.isProd || !request.host.contains(Slow3gHostnamePart))
        return invokeBlockImpl(request, block)

      // Add latency. I don't know how to throttle the response bandwidth though.
      // In Chrome Dev Tools, setting the network latency to 2 seconds, is pretty
      // useless — seems as if Chrome still executes the requests instantly,
      // just delays them for a while. Won't make Talkyard's "This takes long" server
      // request overlay appear, '#theLoadingOverlay', as of Jan 2020 ...
      //
      // ... But adding the below for-real server side delay, *does* make that overlay
      // appear. So, this delay here, is more realistic, than Dev Tools network
      // latency settings.
      //
      val promise = Promise[Result]()
      globals.actorSystem.scheduler.scheduleOnce(delay = 2.seconds) {
        invokeBlockImpl[A](request, block).onComplete({
          case Success(value) =>
            promise.success(value)
          case Failure(exception) =>
            promise.failure(exception)
        })(executionContext)
      }(executionContext)
      promise.future
    }


    private def invokeBlockImpl[A](request: Request[A], block: ApiRequest[A] => Future[Result])
        : Future[Result] = {

      // ----- Under maintenance?

      // Throw if the server is under maintenance, and the request tries to do anything
      // but reading, e.g. saving a reply. That is, throw for all POST request. Except for
      // logout or login, so people can login and read (OpenAuth login is GET only).
      def logoutPath: String = controllers.routes.LoginController.logout(None).url
      def loginPasswordPath: String = controllers.routes.LoginWithPasswordController.login().url
      if (globals.maintWorkUntilSecs.isDefined && request.method == "POST"
          && request.path != logoutPath
          && request.path != loginPasswordPath) {
        throwServiceUnavailable("TyMMAINTWORK", o"""The server is under maintenance:
              You cannot do anything, except for reading.""")
      }

      // ----- Cross-Origin (CORS) request?

      val site = globals.lookupSiteOrThrow(request)
      val siteDao = globals.siteDao(site.id)
      val siteSettings = siteDao.getWholeSiteSettings()

      // Is this a CORS request?
      val corsInfo = security.checkIfCorsRequest(request, siteSettings)
      val corsHeaders = mutable.ArrayBuffer[(String, String)]()

      // Add CORS headers if needed — both for pre-flight and real requests.
      corsInfo match {
        case CorsInfo.OkayCrossOrigin(okayOrigin, _, _) =>
          corsHeaders.append(p_HNs.ACCESS_CONTROL_ALLOW_ORIGIN -> okayOrigin)

          // Seconds.  5 min for now when testing — should be pretty ok in prod too.
          corsHeaders.append(p_HNs.ACCESS_CONTROL_MAX_AGE -> "300")

          // Talkyard only uses GET and POST (never PUT or DELETE etc).
          corsHeaders.append(p_HNs.ACCESS_CONTROL_ALLOW_METHODS -> "GET, POST")

          // No cookies (credentials), for now.
          // Without the below header in the server's response, the browser will discard
          // the response, if the request included cookies.
          // See: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#Requests_with_credentials
          // ""fetch won’t send cookies, unless you set the credentials init option
          // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
          //
          // add_header Access-Control-Allow-Credentials 'true' always; // Ngnix syntax

          // These allowed by default: Accept, Accept-Language, Content-Language, Content-Type,
          // see: https://developer.mozilla.org/en-US/docs/Glossary/CORS-safelisted_request_header.
          // However there's additional restrictions: Only form data or plain text allowed
          // — not json. So, incl Content-Type too, then, json allowed.
          //
          // Forbidden headers are allowed — that is, headers the browser javascript
          // cannot change, like: Origin, Host, User-Agent, Connection: keep-alive,
          // Content-Length, DNT. Need not include any of those.
          // https://fetch.spec.whatwg.org/#forbidden-header-name
          //
          corsHeaders.append(p_HNs.ACCESS_CONTROL_ALLOW_HEADERS ->
                "Content-Type, Authorization, X-Requested-With, X-Xsrf-Token, X-Ty-Xsrf")

        case x =>
          dieIf(x.isCrossOrigin, "TyE5603SKDH7")
      }

      // Reply directly, if CORS pre-flight request. [CORSPREFL]
      // There'll be a 2nd "real" request and that's when we'll do something.
      if (corsInfo.isPreFlight) {
        return Future.successful(
              p_Results.NoContent.withHeaders(corsHeaders: _*))
      }

      // ----- Handle the request

      // [APIAUTHN]  If there's an Authorization header, we'll use it but ignore
      // any cookie.
      val futureResult =
        try {
          request.headers.get("Authorization") match {
            case Some(authHeaderValue) =>
              invokeBlockAuthViaApiSecret(
                    request, site, siteDao, siteSettings, authHeaderValue, block)

            case None =>
              throwForbiddenIf(viaApiSecretOnly,
                    "TyE0APIRQ", s"You may invoke ${request.path} only via the API")
              dieIf(corsInfo.isCrossOrigin && corsInfo.hasCorsCreds &&
                    !siteSettings.allowCorsCreds, "TyE603RKDJL5")

              invokeBlockAuthViaCookie(
                    request, corsInfo, site, siteDao, siteSettings, block)
          }
        }
        catch {
          // Dupl code [RESLTEXC]
          case ResultException(result) =>
            // So can add CORS headers below.
            Future.successful(result)
        }

      // ----- Add CORS headers?

      if (corsHeaders.isEmpty) futureResult
      else futureResult.map(_.withHeaders(corsHeaders: _*))(executionContext)
    }


    private def invokeBlockAuthViaApiSecret[A](request: Request[A], site: SiteBrief,
          dao: SiteDao, settings: AllSettings,
          authHeaderValue: String, block: ApiRequest[A] => Future[Result]): Future[Result] = {
      val usernamePasswordBase64Encoded = authHeaderValue.replaceFirst("Basic ", "")
      val decodedBytes: Array[Byte] = acb.Base64.decodeBase64(usernamePasswordBase64Encoded)
      val usernameColonPassword = new String(decodedBytes, "UTF-8")
      val (username, colonPassword) = usernameColonPassword.span(_ != ':')
      val secretKey = colonPassword.drop(1)

      // But if API disabled ???? TODO

      val apiSecret = dao.getApiSecret(secretKey) getOrElse {
        throwNotFound("TyEAPI0SECRET", "No such API secret or it has been deleted")
      }
      val tyIdPrefix = "tyid="
      val talkyardIdPrefix = "talkyardId="   // DEPRECATED 2019-08-18 v0.6.43
      val ssoIdPrefix = "ssoid="
      val externalIdPrefix = "externalId="   // DEPRECATED 2019-08-18 v0.6.43  [395KSH20]
      val anyUser: Option[Participant] =
        if (username.startsWith(tyIdPrefix) || username.startsWith(talkyardIdPrefix)) {
          val userIdStr = username.dropWhile(_ != '=').drop(1)
          val userId = userIdStr.toIntOrThrow(
            "TyEAPIUSERID", s"Talkyard user id is not a number: $userIdStr")
          dao.getParticipant(userId)
        }
        else if (username.startsWith(ssoIdPrefix) || username.startsWith(externalIdPrefix)) {
          val ssoId = username.dropWhile(_ != '=').drop(1)
          dao.getMemberBySsoId(ssoId)
        }
        else {
          throwBadRequest("TyESSOUSERNAME",
              s"Username doesn't start with '$tyIdPrefix' or '$ssoIdPrefix': $username")
        }

      val user = anyUser getOrElse throwNotFound("TyAPI0USR_", s"User not found: $username")

      apiSecret.userId match {
        case None =>
          // Fine, this key lets one do things as any user.
        case Some(userId) =>
          throwForbiddenIf(userId != user.id,
            "TyEAPIWRNGUSR_", s"The specified user does not own the API secret: $username")
      }

      throwForbiddenIf(user.id == SystemUserId,
        "TyEAPISYSUSR_", s"Call the API as Sysbot (id 2), not System (id 1)")
      throwForbiddenIf(user.id < Group.EveryoneId && user.id != SysbotUserId,
        "TyEAPIBADUSR_", s"Not allowed to call the API as user ${user.usernameOrGuestName}")

      runBlockIfAuthOk(request, site, dao, Some(user),
          SidOk("_api_secret_", 0, Some(user.id)), XsrfOk("_api_secret_"), None, block)
    }


    private def invokeBlockAuthViaCookie[A](request: Request[A], corsInfo: CorsInfo,
          site: SiteBrief,
          dao: SiteDao, siteSettings: AllSettings,
          block: ApiRequest[A] => Future[Result]): Future[Result] = {

      // Why avoid cookies? In an embedded comments iframe, cookies frequently get blocked
      // by Privacy Badger or iOS or browser settings for 3rd-party-cookies.
      // The embedded comments show-page etc endpoints sets avoidCookies,
      // so we know, here, that we should avoid setting any cookies.  [NOCOOKIES]
      // And, for subsequent requests — to *other* endpoints — the browser Javascript code sets
      // the AvoidCookiesHeaderName header, so we won't froget that we should avoid cookies here.
      val hasCookiesAlready = request.cookies.exists(_.name != "esCoE2eTestPassword")
      val maySetCookies = hasCookiesAlready || {   // TODO
        val shallAvoid = avoidCookies || {
          val avoidCookiesHeaderValue = request.headers.get(AvoidCookiesHeaderName)
          if (avoidCookiesHeaderValue.isEmpty) false
          else if (avoidCookiesHeaderValue.is("Avoid")) true
          else throwBadRequest("TyE7KBET225", s"Bad $AvoidCookiesHeaderName value")
        }
        !shallAvoid
      }

      // Below: A bit dupl code, same as for WebSocket upgrade requests. [WSHTTPREQ]

      val expireIdleAfterMins = siteSettings.expireIdleAfterMins

      val (actualSidStatus, xsrfOk, newCookies) = corsInfo match {
        case ci: CorsInfo.OkayCrossOrigin =>
          // Cross-origin requests with credentials (i.e. session id cookie)
          // not yet tested and thought throw.
          // Continue as a stranger (a not logged in user).
          throwForbiddenIf(ci.hasCorsCreds,  // [CORSCREDSUNIMPL]
                "TyECORSCREDSUNIM", o"""Cross-Origin requests with credentials
                  (i.e. session id cookie) not implemented""")
          // Skip any xsrf token check since this origin is *supposed* to do
          // cross-origin requests, right.
          // Currently only publicly accessible data can be seen, since proceeding
          // with no session id.
          (SidAbsent, XsrfOk("cors_no_xsrf"), Nil)
        case ci =>
          dieIf(ci.isCrossOrigin, "TyEJ2503TKHJ")
          security.checkSidAndXsrfToken(
                request, anyRequestBody = Some(request.body), siteId = site.id,
                expireIdleAfterMins, maySetCookies = maySetCookies,
                skipXsrfCheck = skipXsrfCheck)
      }

      // Ignore and delete any broken or expired session id cookie.
      val (mendedSidStatus, deleteSidCookie) =
        if (actualSidStatus.canUse) (actualSidStatus, false)
        else (SidAbsent, true)

      val (anyBrowserId, newBrowserIdCookie) =  // [5JKWQ21]
        if (maySetCookies) {
          security.getBrowserIdCreateCookieIfMissing(request, isLogin = isLogin)
        }
        else {
          // Then use any xsrf token, if present. It stays the same until page reload,
          // and has the same format as any id cookie anyway, see timeDotRandomDotHash() [2AB85F2].
          // The token can be missing (empty) for GET requests [2WKA40].
          if (xsrfOk.value.nonEmpty)
            (Some(BrowserId(xsrfOk.value, isNew = false)), Nil)
          else
            (None, Nil)
        }

      // Parts of `block` might be executed asynchronously. However any LoginNotFoundException
      // should happen before the async parts, because access control should be done
      // before any async computations are started. So I don't try to recover
      // any AsyncResult(future-result-that-might-be-a-failure) here.
      val resultOldCookies: Future[Result] =
        try {
          dao.perhapsBlockRequest(request, mendedSidStatus, anyBrowserId)
          val anyUserMaybeSuspended =
                dao.getUserBySessionId(mendedSidStatus) getOrIfBad { ex =>
                  throw ex
                }

          runBlockIfAuthOk(request, site, dao, anyUserMaybeSuspended,
                mendedSidStatus, xsrfOk, anyBrowserId, block)
        }
        catch {
          case _: LoginNotFoundException =>
            // This might happen if I manually deleted stuff from the
            // database during development, or if the server has fallbacked
            // to a standby database.
            throw ResultException(InternalErrorResult2(i"""
              |Internal error, please try again. For example, reload the page. [DwE034ZQ3]
              |
              |Details: A certain login id has become invalid. I just gave you a new id,
              |but you will probably need to login again.""")
              .discardingCookies(DiscardingSessionCookie))
        }

      val resultOkSid =
        if (newCookies.isEmpty && newBrowserIdCookie.isEmpty && !deleteSidCookie) {
          resultOldCookies
        }
        else {
          resultOldCookies.map({ result =>
            var resultWithCookies = result
              .withCookies(newCookies ::: newBrowserIdCookie: _*)
              .withHeaders(safeActions.MakeInternetExplorerSaveIframeCookiesHeader)
            if (deleteSidCookie) {
              resultWithCookies =
                resultWithCookies.discardingCookies(DiscardingSessionCookie)
            }
            resultWithCookies
          })(executionContext)
        }

      resultOkSid
    }


    private def runBlockIfAuthOk[A](request: Request[A], site: SiteBrief, dao: SiteDao,
          anyUserMaybeSuspended: Option[Participant], sidStatus: SidStatus,
          xsrfOk: XsrfOk, browserId: Option[BrowserId], block: ApiRequest[A] => Future[Result])
          : Future[Result] = {

      // Maybe the user was logged in in two different browsers, and deleted hens account
      // in one browser and got logged out there, only.
      if (anyUserMaybeSuspended.exists(_.isDeleted))
        return Future.successful(
          ForbiddenResult("TyEUSRDLD", "That account has been deleted")
            .discardingCookies(DiscardingSessionCookie))

      val isSuspended = anyUserMaybeSuspended.exists(_.isSuspendedAt(new ju.Date))

      if (isSuspended && request.method != "GET")
        return Future.successful(
            ForbiddenResult("TyESUSPENDED_", "Your account has been suspended")
              .discardingCookies(DiscardingSessionCookie))

      val anyUser =
        if (isSuspended) None
        else anyUserMaybeSuspended

      // Re the !superAdminOnly test: Do allow access for superadmin endpoints,
      // so they can reactivate this site, in case this site is the superadmin site itself.
      // Sync w WebSocket endpoint. [SITESTATUS].
      if (!superAdminOnly) site.status match {
        case SiteStatus.NoAdmin | SiteStatus.Active | SiteStatus.ReadAndCleanOnly =>
          // Fine
        case SiteStatus.HiddenUnlessStaff =>
          if (!anyUser.exists(_.isStaff) && !isLogin)
            throwLoginAsStaff(request)
        case SiteStatus.HiddenUnlessAdmin =>
          if (!anyUser.exists(_.isAdmin) && !isLogin)
            throwLoginAsAdmin(request)
        case SiteStatus.Deleted | SiteStatus.Purged =>
          throwSiteNotFound(
            request.host,
            debugCode = s"SITEGONE-${site.status.toString.toUpperCase}")
      }

      if (staffOnly && !anyUser.exists(_.isStaff) && !isLogin)
        throwLoginAsStaff(request)

      if (adminOnly && !anyUser.exists(_.isAdmin) && !isLogin)
        throwLoginAsAdmin(request)

      if (superAdminOnly) {
        globals.config.superAdmin.siteIdString match {
          case Some(siteId) if site.id.toString == siteId =>
            // Fine: this (i.e. 'site') is the superadmin site, so we're allowed to access
            // the superadmin endpoints.
          case Some(Whatever) =>
            if (globals.isProd)
              throwForbidden("EsE4KS2YR",
                s"The superadmin site id may not be set to '$Whatever' in prod mode")
          case Some(_) =>
            throwForbidden("EsE8Y0KR2", o"""This is not the superadmin site. This is site
                id ${site.id}, but the superadmin site has another id""")
          case None =>
            throwForbidden("EsE17KFE2", "No superadmin site id configured")
        }

        globals.config.superAdmin.hostname match {
          case Some(request.host) =>
            // Fine: we're accessing the superadmin endpoints via the correct hostname.
          case Some(Whatever) =>
            if (globals.isProd)
              throwForbidden("EsE5GKTS",
                s"The superadmin hostname may not be set to '$Whatever' in prod mode")
          case Some(superAdminHostname) =>
            throwForbidden(
              "EsE2KPU04", o"""Wrong hostname. Please instead access the super admin area
                  via: $superAdminHostname""")
          case None =>
            // Fine, this double check hasn't been enabled.
        }

        COULD /* Show this message in the login dialog somehow:
        def thatIs__ = o"""That is, as a user whose email address is listed in the
           '${Config.SuperAdminEmailAddressesPath}' config value in the config file 'play.conf'."""
           */

        if (globals.config.superAdmin.emailAddresses.isEmpty) {
          throwForbidden("EsE5KU02Y", o"""To access the super admin area, you first need to add
              your email address to the '${Config.SuperAdminEmailAddressesPath}' config value
              in the config file 'play.conf'. Thereafter, sign up or login as a user
              with that email.""")
        }

        anyUser match {
          case None =>
            throwLoginAsSuperAdmin(request)
          case Some(user) =>
            if (!globals.config.superAdmin.emailAddresses.contains(user.email))
              throwLoginAsSuperAdmin(request)
        }
      }

      if (!allowAnyone && !isLogin
          // HACK, CLEAN_UP, QUICK [SSOBUGHACK]
          && request.path != "/-/v0/login-with-secret") {

        // ViewPageController has allow-anyone = true.
        val isXhr = isAjax(request)
        val isInternalApi = isXhr  // TODO
        def isPublicApi = request.path.startsWith("/-/v0/")
        def isApiReq = isInternalApi || isPublicApi

        def goToHomepageOrIfApiReqThen(block: => Unit): Unit = {
          if (isApiReq) block
          else throwTemporaryRedirect("/")  ;COULD // throwLoginAsTo but undef error [5KUP02]
        }

        val siteSettings = dao.getWholeSiteSettings()   // TODO pass along inst

        if (!anyUser.exists(_.isAuthenticated) && siteSettings.userMustBeAuthenticated)
          goToHomepageOrIfApiReqThen(throwForbidden(
                "TyE0AUTHN_", s"Not authenticated. ${
                      if (isPublicApi) "Please include Basic Auth credentials"
                      else "You need to be logged in" }"))

        if (!anyUser.exists(_.isApprovedOrStaff) && siteSettings.userMustBeApproved)
          goToHomepageOrIfApiReqThen(throwForbidden(
                "TyE0APPRVD", "Your user account has not yet been approved"))

        if (anyUser.exists(_.isGuest) && !siteSettings.isGuestLoginAllowed && isApiReq)
          throwForbidden("DwE7JYK4", o"""Guest access has been disabled, but you're logged in
                as guest. Please sign up with a real account instead""")
      }

      val apiRequest = ApiRequest[A](
        site, sidStatus, xsrfOk, browserId, anyUser, dao, request)

      rateLimiter.rateLimit(rateLimits, apiRequest)

      // COULD use markers instead for site id and ip, and perhaps uri too? Dupl code [5KWC28]
      val requestUriAndIp = s"site $site, ip ${apiRequest.ip}: ${apiRequest.uri}"
      //logger.debug(s"API request started [DwM6L8], " + requestUriAndIp)


      import apiRequest.tracerSpan
      tracerSpan.setTag("siteId", site.id)
      anyUser foreach { user =>
        tracerSpan.setTag("userId", user.id)
        if (user.isStaff) tracerSpan.setTag("isStaff", true)
        if (user.isAdmin) tracerSpan.setTag("isAdmin", true)
        if (user.isModerator) tracerSpan.setTag("isModerator", true)
      }

      val timer = globals.metricRegistry.timer(request.path)
      val timerContext = timer.time()
      var result = try {
        block(apiRequest)
      }
      catch {
        // case ProblemException ?  NEXT [ADMERRLOG] + tracer tag?
        case ex: ResultException =>
          // This is fine, probably just a 403 Forbidden exception or 404 Not Found, whatever.
          logger.debug(
            s"API request result exception [EsE4K2J2]: $ex, $requestUriAndIp")
          throw ex
        case ex: play.api.libs.json.JsResultException =>
          // A bug in Talkyard's JSON parsing, or the client sent bad JSON?
          logger.warn(i"""s${site.id}: Bad JSON exception [TyEJSONEX]
              |$requestUriAndIp""", ex)
          throw ResultException(Results.BadRequest(s"Bad JSON: $ex [TyEJSONEX]"))
        case ex: Exception =>
          logger.error(i"""s${site.id}: API request unexpected exception [TyEUNEXPEX],
              |$requestUriAndIp""", ex)
          throw ex
      }
      finally {
        timerContext.stop()
      }

      result.onComplete({
        case Success(_) =>
          //logger.debug(
            //s"API request ended, status ${r.header.status} [DwM9Z2], $requestUriAndIp")
        case Failure(exception) =>
          // exception –> case ProblemException ?  [ADMERRLOG]
          //            case ex: ResultException ?
          logger.debug(
            s"API request exception: ${classNameOf(exception)} [DwE4P7], $requestUriAndIp")
      })(executionContext)

      if (isSuspended) {
        // BUG: (old? can still happen?) We won't get here if e.g. a 403 Forbidden exception
        // was thrown because 'anyUser' was set to None. How solve that?
        result = result.map(_.discardingCookies(DiscardingSessionCookie))(executionContext)
      }
      result
    }
  }
}
