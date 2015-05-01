/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

import actions.ApiActions.PostJsonAction
import actions.SafeActions.ExceptionAction
import com.debiki.core._
import com.debiki.core.Prelude._
import com.mohiva.play.silhouette.contrib.services.PlayOAuth1Service
import com.mohiva.play.silhouette.core.providers._
import com.mohiva.play.silhouette.core.providers.oauth1.TwitterProvider
import com.mohiva.play.silhouette.core.providers.oauth2._
import com.mohiva.play.silhouette
import com.mohiva.play.silhouette.core.{exceptions => siex}
import debiki.RateLimits
import debiki.DebikiHttp._
import java.{util => ju}
import org.scalactic.{Good, Bad}
import play.{api => p}
import play.api.mvc._
import play.api.mvc.BodyParsers.parse.empty
import play.api.Play
import play.api.Play.current
import play.api.libs.concurrent.Execution.Implicits._
import requests.JsonPostRequest
import scala.concurrent.Future



/** OpenAuth 1 and 2 login, provided by Silhouette, e.g. for Google, Facebook and Twitter.
  *
  * This class is a bit complicated, because it supports logging in at site X
  * via another site, say login.domain.com. This is needed because Debiki is a multitenant
  * system, but OAuth providers allow one to login only via *one* single domain. That
  * single domain is login.domain.com, and if you want to login at site X this class
  * redirects you to login.domain.com, then logs you in at the OAuth provider from
  * login.domain.com, and redirects you back to X with a session id and an XSRF token.
  */
object LoginWithOpenAuthController extends Controller {

  private val Separator = '|'
  private val ReturnToUrlCookieName = "dwCoReturnToUrl"
  private val ReturnToSiteCookieName = "dwCoReturnToSite"
  private val ReturnToSiteXsrfTokenCookieName = "dwCoReturnToSiteXsrfToken"
  private val IsInLoginWindowCookieName = "dwCoIsInLoginWindow"
  private val MayCreateUserCookieName = "dwCoMayCreateUser"

  val anyLoginOrigin =
    if (Play.isTest) {
      // The base domain should have been automatically configured with the test server's
      // listen port.
      Some(s"http://${debiki.Globals.baseDomain}")
    }
    else {
      Play.configuration.getString("debiki.loginOrigin") orElse
        Play.configuration.getString("debiki.hostname").map("http://" + _)
    }


  def startAuthentication(provider: String, returnToUrl: String) =
        ExceptionAction.async(empty) { request =>
    startAuthenticationImpl(provider, returnToUrl, request)
  }


  def startAuthenticationImpl(provider: String, returnToUrl: String, request: Request[Unit]) = {
    var futureResult = authenticate(provider, request)
    if (returnToUrl.nonEmpty) {
      futureResult = futureResult map { result =>
        result.withCookies(
          Cookie(name = ReturnToUrlCookieName, value = returnToUrl, httpOnly = false))
      }
    }
    if (request.rawQueryString.contains("mayNotCreateUser")) {
      futureResult = futureResult map { result =>
        result.withCookies(
          Cookie(name = MayCreateUserCookieName, value = "false", httpOnly = false))
      }
    }
    futureResult
  }


  def finishAuthentication(provider: String) = ExceptionAction.async(empty) { request =>
    authenticate(provider, request)
  }


  /** Authenticates a user against e.g. Facebook or Google or Twitter, using OAuth 1 or 2.
    *
    * Based on:
    *   https://github.com/mohiva/play-silhouette-seed/blob/master/
    *                     app/controllers/SocialAuthController.scala#L32
    */
  private def authenticate(providerName: String, request: Request[Unit]): Future[Result] = {
    if (anyLoginOrigin.map(_ == originOf(request)) == Some(false)) {
      // OAuth providers have been configured to send authentication data to another
      // origin (namely anyLoginOrigin.get); we need to redirect to that origin
      // and login from there.
      return loginViaLoginOrigin(providerName, request)
    }
    val provider: SocialProvider[_] with CommonSocialProfileBuilder[_] = providerName match {
      case FacebookProvider.Facebook =>
        facebookProvider(request)
      case GoogleProvider.Google =>
        googleProvider(request)
      case TwitterProvider.Twitter =>
        twitterProvider(request)
      case GitHubProvider.GitHub =>
        githubProvider(request)
      case x =>
        return Future.successful(Results.Forbidden(s"Bad provider: `$providerName' [DwE2F0D6]"))
    }
    val authFutureResult = provider.authenticate()(request)
    authFutureResult.flatMap {
      case Left(result) =>
        Future.successful(result)
      case Right(profile: provider.Profile) =>
        handleAuthenticationData(request, profile)
    }.recoverWith({
      case e: siex.AccessDeniedException =>
        Future.successful(Results.Forbidden(s"${e.getMessage} [DwE39DG42]"))
      case e: siex.AuthenticationException =>
        Future.successful(Results.Forbidden(s"${e.getMessage} [DwE56FZ21]"))
    })
  }


  private def handleAuthenticationData(request: Request[Unit], profile: CommonSocialProfile[_])
        : Future[Result] = {
    p.Logger.debug(s"OAuth data received at ${originOf(request)}: $profile")

    val (anyReturnToSiteOrigin: Option[String], anyReturnToSiteXsrfToken: Option[String]) =
      request.cookies.get(ReturnToSiteCookieName) match {
        case None => (None, None)
        case Some(cookie) =>
          val (originalSiteOrigin, separatorAndXsrfToken) = cookie.value.span(_ != Separator)
          (Some(originalSiteOrigin), Some(separatorAndXsrfToken.drop(1)))
      }

    if (anyReturnToSiteOrigin.isDefined && request.cookies.get(ReturnToUrlCookieName).isDefined) {
      // Someone has two browser tabs open? And in one tab s/he attempts to login at one site,
      // and in another tab at the site at anyLoginDomain? Weird.
      return Future.successful(
        Forbidden("Parallel logins not supported [DwE07G32]")
          .discardingCookies(
            DiscardingCookie(ReturnToSiteCookieName),
            DiscardingCookie(ReturnToSiteXsrfTokenCookieName),
            DiscardingCookie(ReturnToUrlCookieName)))
    }

    val oauthDetails = OpenAuthDetails(
      providerId = profile.loginInfo.providerID,
      providerKey = profile.loginInfo.providerKey,
      firstName = profile.firstName,
      fullName = profile.fullName,
      email = profile.email,
      avatarUrl = profile.avatarURL)

    val result = anyReturnToSiteOrigin match {
      case Some(originalSiteOrigin) =>
        val xsrfToken = anyReturnToSiteXsrfToken getOrDie "DwE0F4C2"
        val oauthDetailsCacheKey = nextRandomString()
        play.api.cache.Cache.set(oauthDetailsCacheKey, oauthDetails) //, SECURITY: expiration = 10)
        val continueAtOriginalSiteUrl =
          originalSiteOrigin + routes.LoginWithOpenAuthController.continueAtOriginalSite(
            oauthDetailsCacheKey, xsrfToken)
        Redirect(continueAtOriginalSiteUrl)
          .discardingCookies(DiscardingCookie(ReturnToSiteCookieName))
      case None =>
        login(request, anyOauthDetails = Some(oauthDetails))
    }

    Future.successful(result)
  }


  private def login(request: Request[_], oauthDetailsCacheKey: Option[String] = None,
        anyOauthDetails: Option[OpenAuthDetails] = None): Result = {

    def cacheKey = oauthDetailsCacheKey.getOrDie("DwE90RW215")
    val oauthDetails: OpenAuthDetails =
      anyOauthDetails.getOrElse(play.api.cache.Cache.get(cacheKey) match {
        case None => throwForbidden("DwE76fE50", "OAuth cache value not found")
        case Some(value) => value.asInstanceOf[OpenAuthDetails]
      })

    val loginAttempt = OpenAuthLoginAttempt(
      ip = request.remoteAddress, date = new ju.Date, oauthDetails)

    val mayCreateNewUserCookie = request.cookies.get(MayCreateUserCookieName)
    val mayCreateNewUser = mayCreateNewUserCookie.map(_.value) != Some("false")

    val dao = daoFor(request)

    // COULD let tryLogin() return a LoginResult and use pattern matching, not exceptions.
    val result =
      try {
        val loginGrant = dao.tryLogin(loginAttempt)
        createCookiesAndFinishLogin(request, loginGrant.user)
      }
      catch {
        case ex: DbDao.IdentityNotFoundException =>
          if (mayCreateNewUser) {
            showCreateUserDialog(request, oauthDetails)
          }
          else {
            // COULD show a nice error dialog instead.
            throwForbidden("DwE5FK9R2", "Access denied")
          }
      }

    result.discardingCookies(DiscardingCookie(MayCreateUserCookieName))
  }


  private def createCookiesAndFinishLogin(request: Request[_], user: User): Result = {
    val (_, _, sidAndXsrfCookies) = debiki.Xsrf.newSidAndXsrf(user)

    val response =
      if (isAjax(request)) {
        // We've shown but closed an OAuth provider login popup, and now we're
        // handling a create-user Ajax request from a certain showCreateUserDialog()
        // Javascript dialog. It already knows about any pending redirects.
        Ok("""{ "emailVerifiedAndLoggedIn": true }""")
      }
      else {
        def loginPopupCallback =
          Ok(views.html.login.loginPopupCallback(user.displayName).body) as HTML

        request.cookies.get(ReturnToUrlCookieName) match {
          case Some(returnToUrlCookie) =>
            if (returnToUrlCookie.value.startsWith(
                LoginWithPasswordController.RedirectFromVerificationEmailOnly)) {
              // We are to redirect only from new account email address verification
              // emails, not from here.
              loginPopupCallback
            }
            else {
              // We're in a create site wizard; redirect to the next step in the wizard.
              Redirect(returnToUrlCookie.value)
            }
          case None =>
            // We're logging in an existing user in a popup window.
            loginPopupCallback
        }
      }
    response.withCookies(sidAndXsrfCookies: _*)
      .discardingCookies(DiscardingCookie(ReturnToUrlCookieName))
  }


  private def showCreateUserDialog(request: Request[_], oauthDetails: OpenAuthDetails): Result = {
    val cacheKey = nextRandomString()
    play.api.cache.Cache.set(cacheKey, oauthDetails)
    val anyIsInLoginWindowCookieValue = request.cookies.get(IsInLoginWindowCookieName).map(_.value)
    val anyReturnToUrlCookieValue = request.cookies.get(ReturnToUrlCookieName).map(_.value)

    val result = if (anyIsInLoginWindowCookieValue.isDefined) {
      // Continue running in the login window, by returning a complete HTML page that
      // shows a create-user dialog. (( This happens for example if 1) we're in a create
      // site wizard, then there's a dedicated login step in a login window, or 2)
      // we're logging in to the admin pages, or 3) we're visiting an embedded comments
      // site and attempted to login, then a login popup window opens (better than
      // showing a login dialog somewhere inside the iframe). ))
      Ok(views.html.login.showCreateUserDialog(
        serverAddress = s"//${request.host}",
        newUserName = oauthDetails.displayName,
        newUserEmail = oauthDetails.email getOrElse "",
        authDataCacheKey = cacheKey,
        anyContinueToUrl = anyReturnToUrlCookieValue))
    }
    else {
      // The request is from an OAuth provider login popup. Run some Javascript in the
      // popup that closes the popup and continues execution in the main window (the popup's
      // window.opener).
      Ok(views.html.login.closePopupShowCreateUserDialog(
        newUserName = oauthDetails.displayName,
        newUserEmail = oauthDetails.email getOrElse "",
        authDataCacheKey = cacheKey,
        anyContinueToUrl = anyReturnToUrlCookieValue))
    }

    result.discardingCookies(
      DiscardingCookie(IsInLoginWindowCookieName),
      DiscardingCookie(ReturnToUrlCookieName))
  }


  def handleCreateUserDialog = PostJsonAction(RateLimits.CreateUser, maxLength = 1000) {
        request: JsonPostRequest =>
    val body = request.body

    val name = (body \ "name").as[String]
    val email = (body \ "email").as[String]
    val username = (body \ "username").as[String]
    val anyReturnToUrl = (body \ "returnToUrl").asOpt[String]

    val oauthDetailsCacheKey = (body \ "authDataCacheKey").asOpt[String] getOrElse
      throwBadReq("DwE08GM6", "Auth data cache key missing")
    val oauthDetails = play.api.cache.Cache.get(oauthDetailsCacheKey) match {
      case Some(details: OpenAuthDetails) =>
        details
      case None =>
        throwForbidden("DwE50VC4", "Bad auth data cache key")
      case _ =>
        assErr("DwE2GVM0")
    }

    val emailVerifiedAt = oauthDetails.email match {
      case Some(e) if (e != email) =>
        throwForbidden("DwE523FU2", "Cannot change email from ones' OAuth provider email")
      case Some(e) =>
        // Twitter and GitHub provide no email, or I don't know if any email has been verified.
        // Google and Facebook emails have been verified though.
        if (oauthDetails.providerId == GoogleProvider.Google ||
            oauthDetails.providerId == FacebookProvider.Facebook) {
          Some(request.ctime)
        }
        else {
          None
        }
      case None =>
        None
    }

    val becomeOwner = LoginController.shallBecomeOwner(request, email)

    val dao = daoFor(request.request)
    val userData =
      NewOauthUserData.create(name = name, username = username, email = email,
          emailVerifiedAt = emailVerifiedAt, identityData = oauthDetails,
          isAdmin = becomeOwner, isOwner = becomeOwner) match {
        case Good(data) => data
        case Bad(errorMessage) =>
          throwUnprocessableEntity("DwE7BD08", s"$errorMessage, please try again.")
      }

    try {
      val loginGrant = dao.createIdentityUserAndLogin(userData)
      if (emailVerifiedAt.isDefined) {
        createCookiesAndFinishLogin(request.request, loginGrant.user)
      }
      else {
        LoginWithPasswordController.sendEmailAddressVerificationEmail(
          loginGrant.user, anyReturnToUrl, request.host, request.dao)
        Ok("""{ "emailVerifiedAndLoggedIn": false }""")
      }
    }
    catch {
      case DbDao.DuplicateUsername =>
        throwForbidden(
            "DwE6D3G8", "Username already taken, please try again with another username")
      case DbDao.DuplicateUserEmail =>
        if (emailVerifiedAt.isDefined) {
          // The user has been authenticated, so it's okay to tell him/her about the email address.
          throwForbidden(
            "DwE4BME8", "You already have an account with that email address")
        }
        // Don't indicate that there is already an account with this email.
        LoginWithPasswordController.sendYouAlreadyHaveAnAccountWithThatAddressEmail(
          request.dao, email, siteHostname = request.host, siteId = request.siteId)
        Ok("""{ "emailVerifiedAndLoggedIn": false }""")
    }
  }


  /** Redirects to and logs in via anyLoginOrigin; then redirects back to this site, with
    * a session id and xsrf token included in the GET request.
    */
  private def loginViaLoginOrigin(providerName: String, request: Request[Unit]): Future[Result] = {
    val xsrfToken = nextRandomString()
    val loginEndpoint =
      anyLoginOrigin.getOrDie("DwE830bF1") +
        routes.LoginWithOpenAuthController.loginThenReturnToOriginalSite(
          providerName, returnToOrigin = originOf(request), xsrfToken)
    Future.successful(Redirect(loginEndpoint).withCookies(
      Cookie(name = ReturnToSiteXsrfTokenCookieName, value = xsrfToken, httpOnly = false)))
  }


  /** Logs in, then redirects back to returnToOrigin, and specifies xsrfToken to prevent
    * XSRF attacks and session fixation attacks.
    *
    * The request origin must be the anyLoginOrigin, because that's the origin that the
    * OAuth 1 and 2 providers supposedly have been configured to use.
    */
  def loginThenReturnToOriginalSite(provider: String, returnToOrigin: String, xsrfToken: String)
        = ExceptionAction.async(empty) { request =>
    // The actual redirection back to the returnToOrigin happens in handleAuthenticationData()
    // — it checks the value of the return-to-origin cookie.
    if (anyLoginOrigin.map(_ == originOf(request)) != Some(true))
      throwForbidden(
        "DwE50U2", s"You need to login via the login origin, which is: `$anyLoginOrigin'")

    val futureResponse = authenticate(provider, request)
    futureResponse map { response =>
      response.withCookies(
        Cookie(name = ReturnToSiteCookieName, value = s"$returnToOrigin$Separator$xsrfToken",
          httpOnly = false))
    }
  }


  def continueAtOriginalSite(oauthDetailsCacheKey: String, xsrfToken: String) = ExceptionAction(empty) {
        request =>
    val anyXsrfTokenInSession = request.cookies.get(ReturnToSiteXsrfTokenCookieName)
    anyXsrfTokenInSession match {
      case Some(xsrfCookie) =>
        if (xsrfCookie.value != xsrfToken)
          throwForbidden("DwE53FC9", "Bad XSRF token")
      case None =>
        throwForbidden("DwE7GCV0", "No XSRF cookie")
    }
    login(request, oauthDetailsCacheKey = Some(oauthDetailsCacheKey))
      .discardingCookies(DiscardingCookie(ReturnToSiteXsrfTokenCookieName))
  }


  private val CacheLayer =
    new silhouette.contrib.utils.PlayCacheLayer

  private val HttpLayer =
    new silhouette.core.utils.PlayHTTPLayer


  private def googleProvider(request: Request[Unit])
        : GoogleProvider with CommonSocialProfileBuilder[OAuth2Info] = {
    GoogleProvider(CacheLayer, HttpLayer, OAuth2Settings(
      authorizationURL = Play.configuration.getString("silhouette.google.authorizationURL").get,
      accessTokenURL = Play.configuration.getString("silhouette.google.accessTokenURL").get,
      redirectURL = buildRedirectUrl(request, "google"),
      clientID = Play.configuration.getString("silhouette.google.clientID").get,
      clientSecret = Play.configuration.getString("silhouette.google.clientSecret").get,
      scope = Play.configuration.getString("silhouette.google.scope")))
  }


  private def facebookProvider(request: Request[Unit])
        : FacebookProvider with CommonSocialProfileBuilder[OAuth2Info] = {
    FacebookProvider(CacheLayer, HttpLayer, OAuth2Settings(
      authorizationURL = Play.configuration.getString("silhouette.facebook.authorizationURL").get,
      accessTokenURL = Play.configuration.getString("silhouette.facebook.accessTokenURL").get,
      redirectURL = buildRedirectUrl(request, "facebook"),
      clientID = Play.configuration.getString("silhouette.facebook.clientID").get,
      clientSecret = Play.configuration.getString("silhouette.facebook.clientSecret").get,
      scope = Play.configuration.getString("silhouette.facebook.scope")))
  }


  private def twitterProvider(request: Request[Unit])
        : TwitterProvider with CommonSocialProfileBuilder[OAuth1Info] = {
    val settings = OAuth1Settings(
      requestTokenURL = Play.configuration.getString("silhouette.twitter.requestTokenURL").get,
      accessTokenURL = Play.configuration.getString("silhouette.twitter.accessTokenURL").get,
      authorizationURL = Play.configuration.getString("silhouette.twitter.authorizationURL").get,
      callbackURL = buildRedirectUrl(request, "twitter"),
      consumerKey = Play.configuration.getString("silhouette.twitter.consumerKey").get,
      consumerSecret = Play.configuration.getString("silhouette.twitter.consumerSecret").get)
    TwitterProvider(CacheLayer, HttpLayer, new PlayOAuth1Service(settings), settings)
  }


  private def githubProvider(request: Request[Unit])
        : GitHubProvider with CommonSocialProfileBuilder[OAuth2Info] = {
    GitHubProvider(CacheLayer, HttpLayer, OAuth2Settings(
      authorizationURL = Play.configuration.getString("silhouette.github.authorizationURL").get,
      accessTokenURL = Play.configuration.getString("silhouette.github.accessTokenURL").get,
      redirectURL = buildRedirectUrl(request, "github"),
      clientID = Play.configuration.getString("silhouette.github.clientID").get,
      clientSecret = Play.configuration.getString("silhouette.github.clientSecret").get,
      scope = Play.configuration.getString("silhouette.github.scope")))
  }


  private def buildRedirectUrl(request: Request[_], provider: String) = {
    originOf(request) + routes.LoginWithOpenAuthController.finishAuthentication(provider).url
  }

}
