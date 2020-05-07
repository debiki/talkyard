/**
 * Copyright (c) 2014-2017 Kaj Magnus Lindberg
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

import com.debiki.core._
import com.debiki.core.Prelude._
import com.github.benmanes.caffeine
import com.mohiva.play.silhouette
import com.mohiva.play.silhouette.api.util.HTTPLayer
import com.mohiva.play.silhouette.api.LoginInfo
import com.mohiva.play.silhouette.impl.providers.oauth1.services.PlayOAuth1Service
import com.mohiva.play.silhouette.impl.providers.oauth1.TwitterProvider
import com.mohiva.play.silhouette.impl.providers.oauth2._
import com.mohiva.play.silhouette.impl.providers._
import ed.server.spam.SpamChecker
import debiki._
import debiki.EdHttp._
import ed.server._
import ed.server.http._
import ed.server.security.EdSecurity
import javax.inject.Inject
import java.{util => ju}
import org.scalactic.{Bad, ErrorMessage, Good, Or}
import play.api.libs.json._
import play.api.mvc._
import play.api.Configuration
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration._
import talkyard.server.{ProdConfFilePath, TyLogging}



/** OpenAuth 1 and 2 login, provided by Silhouette, e.g. for Google, Facebook and Twitter.
  *
  * This class is a bit complicated, because it supports logging in at site X
  * via another site, say login.domain.com. This is needed because Debiki is a multitenant
  * system, but OAuth providers allow one to login only via *one* single domain. That
  * single domain is login.domain.com, and if you want to login at site X this class
  * redirects you to login.domain.com, then logs you in at the OAuth provider from
  * login.domain.com, and redirects you back to X with a session id and an XSRF token.
  */
class LoginWithOpenAuthController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) with TyLogging {

  import context.globals
  import context.security._

  private val LoginTimeoutMins = 15
  private val Separator = '|'

  private val ReturnToUrlCookieName = "dwCoReturnToUrl"
  private val ReturnToSiteOriginTokenCookieName = "dwCoReturnToSite"
  private val ReturnToThisSiteXsrfTokenCookieName = "dwCoReturnToSiteXsrfToken"
  private val AvoidCookiesCookieName = "TyCoAvoidCookies"
  private val IsInLoginWindowCookieName = "dwCoIsInLoginWindow"
  private val IsInLoginPopupCookieName = "dwCoIsInLoginPopup"
  private val MayCreateUserCookieName = "dwCoMayCreateUser"
  private val AuthStateCookieName = "dwCoOAuth2State"

  private val CookiesToDiscardAfterLogin: Seq[DiscardingCookie] = Seq(
    ReturnToUrlCookieName,
    ReturnToSiteOriginTokenCookieName,
    ReturnToThisSiteXsrfTokenCookieName,
    AvoidCookiesCookieName,
    IsInLoginWindowCookieName,
    IsInLoginPopupCookieName,
    MayCreateUserCookieName,
    AuthStateCookieName).map(DiscardingSecureCookie)

  def conf: Configuration = globals.rawConf

  private val cache = caffeine.cache.Caffeine.newBuilder()
    .maximumSize(20*1000) // change to config value, e.g. 1e9 = 1GB mem cache. Default to 50M? [ADJMEMUSG]
    // Don't expire too quickly — the user needs time to choose & typ a username.
    // SECURITY COULD expire sooner (say 10 seconds) if just logging in, because then
    // the user need not think or type anything.
    // The user might want to review the Terms of Use, so wait for an hour, here. [4WHKTP06]
    // BUG SHOULD use Redis, so the key won't disappear after server restart.
    .expireAfterWrite(65, java.util.concurrent.TimeUnit.MINUTES)
    .build().asInstanceOf[caffeine.cache.Cache[String, OpenAuthDetails]]


  // SAML = no, wait.
  // Complicated, not fun?: https://news.ycombinator.com/item?id=13129570:

  // Threading: Fix later
  @volatile
  private var anyClient: Option[org.pac4j.oidc.client.KeycloakOidcClient] = None

  def loginOidcStart(provider: String, returnToUrl: String): Action[Unit] =
        AsyncGetActionIsLogin { request =>
    // Wow! This one seems pretty good:
    // https://connect2id.com/learn/openid-connect
    // "OpenID Connect explained" — seems to be about all one needs to know
    // (and just a little bit more).
    // Also nice (but about OAuth not OIDC): https://www.oauth.com/

    // Talkyard uses Pac4j:
    //   https://github.com/pac4j/pac4j
    //   https://github.com/pac4j/play-pac4j
    // Docs: https://www.pac4j.org/docs/clients/openid-connect.html
    // And: https://www.pac4j.org/docs/how-to-implement-pac4j-for-a-new-framework.html#b-handle-callback-for-indirect-client

    // Pac4j uses NimbusDS which is developed by a company Connect2id (https://connect2id.com/about)
    // incorporated in Bulgaria (as of 2020-05), formerly NimbusDS.com but they didn't renew
    // that domain name.
    // Their Git repo:
    //   https://bitbucket.org/connect2id/oauth-2.0-sdk-with-openid-connect-extensions/src/master/
    //   (linked from: https://connect2id.com/products/nimbus-oauth-openid-connect-sdk/download )
    // (Connect2id sells a "Connect2id server" — and they've made their oidc client
    // libs available open-source, Apache2.)
    //
    // Connect2id writes:
    // """ you can use our own open source OpenID Connect SDK directly, or via a web
    // framework, such as Spring Security or Pac4j, whichever is be easier to use.
    // Spring Security and Pac4j also support SAML """
    // (https://connect2id.com/products/server/docs/guides/identity-federation )
    // And Pac4j is what Talkyard uses.
    // Can also use Nimbus directly:
    //   "Nimbus OAuth 2.0 SDK with OpenID Connect extensions"
    //   https://connect2id.com/products/nimbus-oauth-openid-connect-sdk

        // There's also ScribeJava but it doesn't support OIDC:
        // https://github.com/scribejava/scribejava/pull/646

    if (anyClient.isEmpty) {
      val conf = new org.pac4j.oidc.config.KeycloakOidcConfiguration()
      conf.setResponseType("code")
      conf.setResponseMode("") // what's that?
      conf.setUseNonce(true)
      conf.setMaxClockSkew(30) // seconds, default is 30
      // Could:
        // conf.setPreferredJwsAlgorithm(JWSAlgorithm.RS256) — but which alg?
        // select display mode: page, popup, touch, and wap
        // conf.addCustomParam("display", "popup")
        // select prompt mode: none, consent, select_account
        // conf.addCustomParam("prompt", "select_account")
        // conf.setWithState(true)
        // conf.setStateData("custom-state-value")  ? no such method
        // Can look at response to find out for how long to stay logged in:
        // conf.setExpireSessionWithToken(true); — no, look at callback data instead?

        conf.setScope("openid email profile")
      // The client id and secret are from the OpenID Connect provider.
      conf.setClientId("talkyard_keycloak_test_client")
      conf.setSecret("...")

      // Discovery url:
      // This constructs the OIDC discovery url:
      //   baseUri + "/realms/" + realm + "/.well-known/openid-configuration"
        // e.p.  https://keycloak.example.com/auth

      // Docker will resolve 'keycloak' to the Docker KeyCloak container.
      // ('localhost' would have worked, if we used Docker's host networking.)
      conf.setBaseUri("http://keycloak:8080/auth")
      conf.setRealm("talkyard_keycloak_test_realm")
      anyClient = Some(new org.pac4j.oidc.client.KeycloakOidcClient(conf))
    }

    val client = anyClient.get

    // new org.pac4j.oidc.profile.keycloak.KeycloakOidcProfile — no extra fields,
    // just like: extends org.pac4j.oidc.profile.OidcProfile {}.

    // This is the OIDC "Redirection Endpoint",
    // docs:  https://tools.ietf.org/html/rfc6749#section-3.1.2
    // It should not change — not even the query string, see:
    // https://www.oauth.com/oauth2-servers/redirect-uris/redirect-uri-registration/
    // Instead, use the 'state' parameter to get back e.g. a session / user id,
    // when redirected from the OIDC provider back to here.
    // It's below  /-/login-oidc/(provider)/ because at least KeyCloak by
    // default allows callback urls below the base URL
    client.setCallbackUrl("http://localhost/-/login-oidc/keycloak/callback")

    // Or instead?:
    // val context = new org.pac4j.core.context.MockWebContext()
    val sessionStoreNotNeeded = new org.pac4j.play.store.PlayCookieSessionStore()
    val context = new org.pac4j.play.PlayWebContext(
          request.underlying, sessionStoreNotNeeded)

    // This'll make the OidcConfiguration make a HTTP request to get the
    // OIDC metadata. Here:
    // pac4j-oidc-4.0.0-sources.jar!/org/pac4j/oidc/config/OidcConfiguration.java
    // protected void internalInit() { ...  new URL(this.getDiscoveryURI()) ... }
    //
    // Weird that Pac4j does HTTP requests from inside a config values class!
    //
    val discoveryUrl = client.getConfiguration.getDiscoveryURI
    System.out.println(s"Pac4j now will download ODIC metadata from: $discoveryUrl")

    val redirectActionOpt: ju.Optional[org.pac4j.core.exception.http.RedirectionAction] =
          client.getRedirectionAction(context)

    val redirectToUrl: String = redirectActionOpt.get()
          .asInstanceOf[org.pac4j.core.exception.http.FoundAction]
          .getLocation

    /*
    val action: org.pac4j.core.exception.http.HttpAction =
          client.getRedirectionAction(context).get()
            .asInstanceOf[org.pac4j.core.exception.http.HttpAction] */

          // call  profile.removeLoginData() afterwards to remove the OIDC tokens.

    //   PlayHttpActionAdapter.INSTANCE.adapt(action, context)
    // startAuthenticationImpl(provider, returnToUrl, request)
    // throwTemporaryRedirect(redirectToUrl)

    System.out.println(s"Pac4j got back URL: $redirectToUrl")

    val testHost = "://keycloak:8080/"
    val redir2 =
      if (redirectToUrl.contains("http" + testHost) ||
          redirectToUrl.contains("https" + testHost)) {
        // We're testing on localhost?
        // Then, change to 'localhost'. Otherwise the e2e test browsers
        // cannot access KeyCloak — they don't run inside the Docker network
        // and the 'keycloak' hostname exists only in that network.
        redirectToUrl.replaceAllLiterally(testHost, "://localhost:8080/")
      }
      else {
        // This is for real (not a test).
        redirectToUrl
      }

    System.out.println(s"Redirecting the browser to: $redir2")

    Future.successful(
        play.api.mvc.Results.Redirect(
          redir2, status = play.api.http.Status.SEE_OTHER))
  }


  def loginOidcCallback(provider: String): Action[Unit] = AsyncGetActionIsLogin { request =>
    // Docs: https://www.pac4j.org/docs/user-profile.html
    //    val credentials: Optional[Credentials] = client.getCredentials(context)
    //    val profile: UserProfile = client.getUserProfile(credentials.get(), context).get()

    val client: org.pac4j.oidc.client.KeycloakOidcClient = anyClient.get

    // The URL is sth like:
    //  GET /-/login-oidc/keycloak/callback
    //     ? client_name=KeycloakOidcClient
    //     & state=8JZ5h.....JafCD7_Cwk
    //     & session_state=9ebda6d1-d9....1fec0c5
    //     & code=5718c...really..long..dd0b0

    // Or instead?:
    // val context = new org.pac4j.core.context.MockWebContext()
    val sessionStoreNotNeeded = new org.pac4j.play.store.PlayCookieSessionStore()
    val context = new org.pac4j.play.PlayWebContext(
      request.underlying, sessionStoreNotNeeded)

    val credentials: ju.Optional[org.pac4j.oidc.credentials.OidcCredentials] =
          client.getCredentials(context)

    val genericProfile: org.pac4j.core.profile.UserProfile =
          client.getUserProfile(credentials.get(), context).get()

    val oidcProfile: org.pac4j.oidc.profile.OidcProfile =
          genericProfile.asInstanceOf[org.pac4j.oidc.profile.OidcProfile]

    Future.successful(Ok(i"""
        |Hello
        |
        |Logged in as: ${oidcProfile.getUsername}
        |Email: ${oidcProfile.getEmail}
        |Verified: ${oidcProfile.getEmailVerified}
        |
        |toString: ${oidcProfile.toString}
        |"""))
  }


  def logoutOidcCallback(provider: String, returnToUrl: String): Action[Unit] =
    AsyncGetActionIsLogin { request =>
      // Docs: https://www.pac4j.org/docs/how-to-implement-pac4j-for-a-new-framework.html#c-logout
      ???
    }




  def startAuthentication(provider: String, returnToUrl: String): Action[Unit] =
        AsyncGetActionIsLogin { request =>
    startAuthenticationImpl(provider, returnToUrl, request)
  }


  private def startAuthenticationImpl(provider: String, returnToUrl: String, request: GetRequest)
        : Future[Result] = {

    globals.loginOriginConfigErrorMessage foreach { message =>
      throwInternalError("DwE5WKU3", message)
    }

    var futureResult = startOrFinishAuthenticationWithSilhouette(provider, request)
    if (returnToUrl.nonEmpty) {
      futureResult = futureResult map { result =>
        result.withCookies(
          SecureCookie(name = ReturnToUrlCookieName, value = returnToUrl, httpOnly = false))
      }
    }
    if (request.rawQueryString.contains("isInLoginPopup")) {
      futureResult = futureResult map { result =>
        result.withCookies(
          SecureCookie(name = IsInLoginPopupCookieName, value = "true", httpOnly = false))
      }
    }
    if (request.rawQueryString.contains("mayNotCreateUser")) {
      futureResult = futureResult map { result =>
        result.withCookies(
          SecureCookie(name = MayCreateUserCookieName, value = "false", httpOnly = false))
      }
    }
    futureResult
  }


  def finishAuthentication(provider: String): Action[Unit] = AsyncGetActionIsLogin { request =>
    startOrFinishAuthenticationWithSilhouette(provider, request)
  }


  /** Authenticates a user against e.g. Facebook or Google or Twitter, using OAuth 1 or 2.
    *
    * Confusingly enough (?), Silhouette uses the same method both for starting
    * and finishing authentication. (529JZ24)
    *
    * Based on:
    *   https://github.com/mohiva/play-silhouette-seed/blob/master/
    *                     app/controllers/SocialAuthController.scala#L32
    */
  private def startOrFinishAuthenticationWithSilhouette(
        providerName: String, request: GetRequest): Future[Result] = {
    context.rateLimiter.rateLimit(RateLimits.Login, request)

    val settings = request.siteSettings

    throwForbiddenIf(settings.enableSso,
      "TyESSO0OAUTH", "OpenAuth authentication disabled, because SSO enabled")

    DELETE_LATER // after 2019-05-01 (59289560). Just temp test to verif didn't break anything when rewriting
    // 'if' test.
    dieIf((globals.anyLoginOrigin.map(_ == originOf(request)).contains(false)) !=
      (globals.anyLoginOrigin isSomethingButNot originOf(request)), "TyE8KBSWG4")

    if (globals.anyLoginOrigin isSomethingButNot originOf(request)) {
      // OAuth providers have been configured to send authentication data to another
      // origin (namely anyLoginOrigin.get); we need to redirect to that origin
      // and login from there.
      return loginViaLoginOrigin(providerName, request.underlying)
    }

    val provider: SocialProvider = providerName match {   // with TalkyardSocialProfileBuilder?  (TYSOCPROF)
      case FacebookProvider.ID =>
        throwForbiddenIf(!settings.enableFacebookLogin, "TyE0FBLOGIN", "Facebook login disabled")
        facebookProvider()
      case GoogleProvider.ID =>
        throwForbiddenIf(!settings.enableGoogleLogin, "TyE0GOOGLOGIN", "Google login disabled")
        googleProvider()
      case TwitterProvider.ID =>
        throwForbiddenIf(!settings.enableTwitterLogin, "TyE0TWTTRLOGIN", "Twitter login disabled")
        twitterProvider()
      case GitHubProvider.ID =>
        throwForbiddenIf(!settings.enableGitHubLogin, "TyE0GITHLOGIN", "GitHub login disabled")
        githubProvider()
      case GitLabProvider.ID =>
        throwForbiddenIf(!settings.enableGitLabLogin, "TyE0GITLBLOGIN", "GitLab login disabled")
        gitlabProvider()
      case LinkedInProvider.ID =>
        throwForbiddenIf(!settings.enableLinkedInLogin, "TyE0LKDINLOGIN", "LinkedIn login disabled")
        linkedinProvider()
      case VKProvider.ID =>
        throwForbiddenIf(!settings.enableVkLogin, "TyE0VKLOGIN", "VK login disabled")
        vkProvider()
      case InstagramProvider.ID =>
        throwForbiddenIf(!settings.enableInstagramLogin, "TyE0INSTALOGIN", "Instagram login disabled")
        instagramProvider()
      case x =>
        return Future.successful(Results.Forbidden(s"Bad provider: `$providerName' [DwE2F0D6]"))
    }

    provider.authenticate()(request.underlying) flatMap {  // (529JZ24)
      case Left(result) =>
        // We're starting authentication.
        Future.successful(result)
      case Right(authInfo) =>
        // We're finishing authentication.
        val futureProfile: Future[SocialProfile] = provider.retrieveProfile(authInfo)
        futureProfile flatMap { profile: SocialProfile =>   // TalkyardSocialProfile?  (TYSOCPROF)
          handleAuthenticationData(request, profile)
        }
    } recoverWith {
      case ex: Exception =>
        val noStateHandlerMessage: String =
          com.mohiva.play.silhouette.impl.providers.DefaultSocialStateHandler.MissingItemHandlerError
            .dropRight(5)  // trop trailing  %s
        // Silhouette has an xsrf cookie 5 minutes timeout, and overwrites (forgets) old handlers
        // if one clicks login buttons in different browser tabs, in parallel. [PRLGIN]
        val handlerMissing = ex.getMessage.contains(noStateHandlerMessage)
        val result =
          if (handlerMissing) {
            logger.warn(s"Silhouette handler missing error [TYEOAUTMTPLL2]", ex)
            BadReqResult("TYEOAUTMTPLL", "\nYou need to login within 5 minutes, and " +
              "you cannot login in different browser tabs, at the same time. Error logging in.")
          }
          else {
            val errorCode = "TYE0AUUNKN"
            logger.error(s"Error during OAuth2 authentication with Silhouette [$errorCode]", ex)
            import org.apache.commons.lang3.exception.ExceptionUtils.getStackTrace
            InternalErrorResult(errorCode, "Unknown login error", moreDetails =
              s"Error when signing in with $providerName: ${ex.getMessage}\n\n" +
              "Stack trace:\n" + getStackTrace(ex))
          }
        Future.successful(result)
    }
  }


  private def handleAuthenticationData(request: GetRequest, profile: SocialProfile)
        : Future[Result] = {
    logger.debug(s"OAuth data received at ${originOf(request)}: $profile")

    val (anyReturnToSiteOrigin: Option[String], anyReturnToSiteXsrfToken: Option[String]) =
      request.cookies.get(ReturnToSiteOriginTokenCookieName) match {
        case None => (None, None)
        case Some(cookie) =>
          val (originalSiteOrigin, separatorAndXsrfToken) = cookie.value.span(_ != Separator)
          (Some(originalSiteOrigin), Some(separatorAndXsrfToken.drop(1)))
      }

    val anyReturnToUrl = request.cookies.get(ReturnToUrlCookieName).map(_.value)

    if (anyReturnToSiteOrigin.isDefined && anyReturnToUrl.isDefined) {
      // Someone has two browser tabs open? And in one tab s/he attempts to login at one site,
      // and in another tab at the site at anyLoginDomain? Don't know which login attempt
      // to continue with.
      val errorMessage = i"""Parallel logins not supported. Cookies now cleared. Try again. [EdE07G32]
        |
        |Details: Both these were defined:
        |anyReturnToSiteOrigin = $anyReturnToSiteOrigin
        |anyReturnToUrl = $anyReturnToUrl"""
      // Delete the cookies, so if the user tries again, there'll be only one cookie and things
      // will work properly.
      return Future.successful(
        Forbidden(errorMessage).discardingCookies(
          DiscardingSecureCookie(ReturnToSiteOriginTokenCookieName),
          DiscardingSecureCookie(ReturnToUrlCookieName)))
    }

    REFACTOR; CLEAN_UP // stop using CommonSocialProfile. Use ExternalSocialProfile instead,  (TYSOCPROF)
    // it has useful things like username, about user text, etc.
    val oauthDetails = profile match {
      case p: CommonSocialProfile =>
        OpenAuthDetails(
          providerId = p.loginInfo.providerID,
          providerKey = p.loginInfo.providerKey,
          username = None, // not incl in CommonSocialProfile
          firstName = p.firstName,
          lastName = p.lastName,
          fullName = p.fullName,
          email = p.email,
          avatarUrl = p.avatarURL)
      case p: ExternalSocialProfile =>
        OpenAuthDetails(
          providerId = p.providerId,
          providerKey = p.providerUserId,
          username = p.username,
          firstName = p.firstName,
          lastName = p.lastName,
          fullName = p.fullName,
          email = if (p.primaryEmailIsVerified is true) p.primaryEmail else None,  // [7KRBGQ20]
          avatarUrl = p.avatarUrl)
    }

    val result = anyReturnToSiteOrigin match {
      case Some(originalSiteOrigin) =>
        val xsrfToken = anyReturnToSiteXsrfToken getOrDie "DwE0F4C2"
        val oauthDetailsCacheKey = nextRandomString()
        SHOULD // use Redis instead, so logins won't fail because the app server was restarted.
        cache.put(oauthDetailsCacheKey, oauthDetails)
        val continueAtOriginalSiteUrl =
          originalSiteOrigin + routes.LoginWithOpenAuthController.continueAtOriginalSite(
            oauthDetailsCacheKey, xsrfToken)
        Redirect(continueAtOriginalSiteUrl)
          .discardingCookies(DiscardingSecureCookie(ReturnToSiteOriginTokenCookieName))
      case None =>
        tryLoginOrShowCreateUserDialog(request, anyOauthDetails = Some(oauthDetails))
    }

    Future.successful(result)
  }


  private def tryLoginOrShowCreateUserDialog(
        request: GetRequest, oauthDetailsCacheKey: Option[String] = None,
        anyOauthDetails: Option[OpenAuthDetails] = None): Result = {

    val dao = request.dao
    val siteSettings = dao.getWholeSiteSettings()

    throwForbiddenIf(siteSettings.enableSso,
      "TyESSO0OAUTHLGI", "OpenAuth login disabled, because SSO enabled")

    def cacheKey = oauthDetailsCacheKey.getOrDie("DwE90RW215")
    val oauthDetails: OpenAuthDetails =
      anyOauthDetails.getOrElse(Option(cache.getIfPresent(cacheKey)) match {
        case None => throwForbidden("DwE76fE50", "OAuth cache value not found")
        case Some(value) =>
          // Remove to prevent another login with the same key, in case it gets leaked,
          // e.g. via a log file.
          // (Hmm, we remove the OpenAuthDetails entry here, and then add it back again here: (406BM5).
          // Maybe could avoid removing it here. Still, good to do here, so it gets
          // deleted for all code paths below that throws a client error back to the browser.)
          cache.invalidate(cacheKey)
          value.asInstanceOf[OpenAuthDetails]
      })

    val loginAttempt = OpenAuthLoginAttempt(
      ip = request.ip, date = globals.now().toJavaDate, oauthDetails)

    val mayCreateNewUserCookie = request.cookies.get(MayCreateUserCookieName)
    val mayCreateNewUser = !mayCreateNewUserCookie.map(_.value).contains("false")

    // COULD let tryLogin() return a LoginResult and use pattern matching, not exceptions.
    //var showsCreateUserDialog = false
    val result =
      try {
        val loginGrant = dao.tryLoginAsMember(loginAttempt)
        createCookiesAndFinishLogin(request, dao.siteId, loginGrant.user)
      }
      catch {
        case DbDao.IdentityNotFoundException =>
          // Let's check if the user already exists, and if so, create an OpenAuth identity
          // and connect it to the user.
          // Details: The user might exist, although no identity was found, if the user
          // has already 1) signed up as an email + password user, or 2) accepted an invitation
          // (when the user clicks the invitation link in the invite email, a user entry
          // is created automatically, without the user having to login). Or 3) signed up
          // via e.g. a Twitter account and specified a Google email address like
          // user@whatever.com (but not gmail.com) and then later attempts to log in
          // via this Google email address instead of via Twitter.
          // Or perhaps 4) signed up via a Facebook account that uses a Google address
          // like user@whatever.com (but not gmail.com).

          // Save canonical email? [canonical-email]

          oauthDetails.email.flatMap(dao.loadMemberByEmailOrUsername) match {
            case Some(user) =>
              if (providerHasVerifiedEmail(oauthDetails)) {
                val loginGrant = dao.createIdentityConnectToUserAndLogin(user, oauthDetails)
                createCookiesAndFinishLogin(request, dao.siteId, loginGrant.user)
              }
              else {
                // There is no reliable way of knowing that the current user is really
                // the same one as the old user in the database? We don't know if the
                // OpenAuth provider has verified the email address.
                // What we can do, is to:
                // A) instruct the user to 1) login as the user in the database
                // (say, via Twitter, in case 3 above). And then 2) click
                // an Add-OpenAuth/OpenID-account button, and then login again in the
                // way s/he attempted to do right now. Then, since the user is logged
                // in at both providers (e.g. both Twitter and Google, in case 3 above)
                // we can safely connect this new OpenAuth identity to the user account
                // already in the database. This is how StackOverflow does it.
                //  See: http://stackoverflow.com/questions/6487418/
                //                  how-to-handle-multiple-openids-for-the-same-user
                // Or B) Perhaps we can ask the user to login as the Twitter user directly?
                // From here, when already logged in with the oauthDetails.
                // (Instead of first logging in via Google then Twitter).
                // Or C) Or we could just send an email address verification email?
                // But then we'd reveal the existense of the Twitter account. And what if
                // the user clicks the confirmation link in the email account without really
                // understanding what s/he is doing? I think A) is safer.
                // Anyway, for now, simply:
                // (Use "user" for the provider's account, and "account" for the account in
                // this server)
                val emailAddress = oauthDetails.email.getOrDie("EsE2FPK8")
                throwForbidden("DwE7KGE32", "\n"+o"""You already have an account with email address
                  $emailAddress, and your ${oauthDetails.providerId} user has the same
                  email address. Since you already have an account here, please don't login via
                  ${oauthDetails.providerId} —
                  instead login using your original login method, e.g. ${
                    someProvidersExcept(oauthDetails.providerId)},
                  or username and password. — I hope you remember which one.""" +
                  "\n\n" +
                  o"""The reason I do not currently let you login via the
                  ${oauthDetails.providerId} user with email $emailAddress
                  is that I don't know if ${oauthDetails.providerId}
                  has verified that the email address is really yours — because if it is not,
                  then you would get access to someone else's account, if I did let you login.""" +
                  "\n\n")
                // If the user does *not* own the email address, s/he would be able to
                // impersonate another user, when his/her new account gets associated with
                // the old one just because they both claim to use the same email address.
              }
            case None =>
              if (!siteSettings.allowSignup) {
                throwForbidden("TyE0SIGNUP02A", "Creation of new accounts is disabled")
              }
              else if (!siteSettings.isEmailAddressAllowed(oauthDetails.emailLowercasedOrEmpty)) {
                throwForbidden(
                  "TyEBADEMLDMN_-OAUTH_", "You cannot sign up using that email address")
              }
              else if (mayCreateNewUser) {
                //showsCreateUserDialog = true
                showCreateUserDialog(request, oauthDetails)
              }
              else {
                // COULD show a nice error dialog instead.
                throwForbidden("DwE5FK9R2", o"""Access denied. You don't have an account
                    at this site with ${oauthDetails.providerId} login. And you may not
                    create a new account to access this resource.""")
              }
          }
      }

    // COULD avoid deleting cookeis if we have now logged in (which we haven't, if
    // the create-user dialog is shown: showsCreateUserDialog == true). Otherwise,
    // accidentally reloading the page, results in weird errors, like the xsrf token
    // missing. But supporting page reload here requires fairly many mini fixes,
    // and maybe is mariginally worse for security? since then someone else,
    // e.g. an "evil" tech support person, can ask for and resuse the url?
    result.discardingCookies(CookiesToDiscardAfterLogin: _*)
  }


  private def someProvidersExcept(providerId: String) =
    Seq(GoogleProvider.ID, FacebookProvider.ID, TwitterProvider.ID, GitHubProvider.ID,
      LinkedInProvider.ID)
      .filterNot(_ equalsIgnoreCase providerId).mkString(", ")


  private def providerHasVerifiedEmail(oauthDetails: OpenAuthDetails) = {
    // Don't know about Facebook and GitHub. Twitter has no emails at all. So for now:
    // (I'm fairly sure Google knows that each Gmail address is owned by the correct user.)
    oauthDetails.providerId == GoogleProvider.ID &&
      oauthDetails.email.exists(_ endsWith "@gmail.com")
    // + known all-email-addrs-have-been-verified email domains from site settings?
  }


  private def createCookiesAndFinishLogin(request: DebikiRequest[_], siteId: SiteId, member: User)
        : Result = {
    request.dao.pubSub.userIsActive(request.siteId, member, request.theBrowserIdData)
    val (sid, _, sidAndXsrfCookies) = createSessionIdAndXsrfToken(siteId, member.id)

    var maybeCannotUseCookies =
      request.headers.get(EdSecurity.AvoidCookiesHeaderName) is EdSecurity.Avoid

    def weakSessionIdOrEmpty =
      if (maybeCannotUseCookies)
        sid.value
      else
        ""

    val response =
      if (isAjax(request.underlying)) {
        // We've shown but closed an OAuth provider login popup, and now we're
        // handling a create-user Ajax request from a certain showCreateUserDialog()
        // Javascript dialog. It already knows about any pending redirects.
        OkSafeJson(Json.obj(
          "userCreatedAndLoggedIn" -> JsTrue,
          "emailVerifiedAndLoggedIn" -> JsBoolean(member.emailVerifiedAt.isDefined),
          // In case we're in a login popup for [an embedded <iframe> with cookies disabled],
          // send the session id in the response body, so the <iframe> can access it
          // and remember it for the current page load.
          "weakSessionId" -> JsString(weakSessionIdOrEmpty))) // [NOCOOKIES]
      }
      else {
        // In case we need to do a cookieless login:
        // This request is a redirect from e.g. Gmail or Facebook login, so there's no
        // AvoidCookiesHeaderName header that tells us if we are in an iframe and maybe cannot
        // use cookies (because of e.g. Safari's "Intelligent Tracking Prevention").
        // However, we've remembered already, in a 1st party cookie (in the login popup?),
        // if 3rd party iframe cookies not work.
        maybeCannotUseCookies ||=
          request.cookies.get(AvoidCookiesCookieName).map(_.value) is EdSecurity.Avoid

        val isInLoginPopup = request.cookies.get(IsInLoginPopupCookieName).nonEmpty
        def loginPopupCallback: Result =
          Ok(views.html.login.loginPopupCallback(
            weakSessionId = weakSessionIdOrEmpty).body) as HTML // [NOCOOKIES]

        request.cookies.get(ReturnToUrlCookieName) match {  // [49R6BRD2]
          case Some(returnToUrlCookie) =>
            if (returnToUrlCookie.value.startsWith(
                LoginWithPasswordController.RedirectFromVerificationEmailOnly)) {
              // We are to redirect only from new account email address verification
              // emails, not from here.
              loginPopupCallback
            }
            else if (isInLoginPopup) {
              // Javascript in the popup will call handleLoginResponse() which calls
              // continueAfterLogin().
              loginPopupCallback
            }
            else {
              // Currently only happens in the create site wizard (right?), and this redirects to
              // the next step in the wizard.
              Redirect(returnToUrlCookie.value)
            }
          case None =>
            // We're logging in an existing user in a popup window.
            loginPopupCallback
        }
      }

    response.withCookies(sidAndXsrfCookies: _*)
  }


  private def showCreateUserDialog(request: GetRequest, oauthDetails: OpenAuthDetails): Result = {
    // Re-insert the  OpenAuthDetails, we just removed it (406BM5). A bit double work?
    val cacheKey = nextRandomString()
    cache.put(cacheKey, oauthDetails)

    val anyIsInLoginWindowCookieValue = request.cookies.get(IsInLoginWindowCookieName).map(_.value)
    val anyReturnToUrlCookieValue = request.cookies.get(ReturnToUrlCookieName).map(_.value)

    val result = if (anyIsInLoginWindowCookieValue.isDefined) {
      // Continue running in the login window, by returning a complete HTML page that
      // shows a create-user dialog. (( This happens if 1) we're in a create
      // site wizard, then there's a dedicated login step in a login window, or 2)
      // we're logging in to the admin pages, or 3) when logging in to a login required site,
      // or 4) we're visiting an embedded comments
      // site and attempted to login, then a login popup window opens (better than
      // showing a login dialog somewhere inside the iframe). ))
      Ok(views.html.login.showCreateUserDialog(
        SiteTpi(request),
        serverAddress = s"//${request.host}",
        newUserUsername = oauthDetails.username getOrElse "",
        newUserFullName = oauthDetails.displayNameOrEmpty,
        newUserEmail = oauthDetails.emailLowercasedOrEmpty,
        authDataCacheKey = cacheKey,
        anyContinueToUrl = anyReturnToUrlCookieValue))
    }
    else {
      // The request is from an OAuth provider login popup. Run some Javascript in the
      // popup that continues execution in the main window (the popup's window.opener)
      // and closes the popup.
      Ok(views.html.login.closePopupShowCreateUserDialog(
        providerId = oauthDetails.providerId,
        newUserUsername = oauthDetails.username getOrElse "",
        newUserFullName = oauthDetails.displayNameOrEmpty,
        newUserEmail = oauthDetails.emailLowercasedOrEmpty,
        authDataCacheKey = cacheKey,
        anyContinueToUrl = anyReturnToUrlCookieValue))
    }

    result.discardingCookies(
      DiscardingSecureCookie(IsInLoginWindowCookieName),
      DiscardingSecureCookie(ReturnToUrlCookieName))
  }


  def handleCreateUserDialog: Action[JsValue] = AsyncPostJsonAction(
        RateLimits.CreateUser, maxBytes = 1000,
        // Could set isLogin = true instead, see handleCreateUserDialog(..) in
        // LoginWithPasswordController, + login-dialog.ts [5PY8FD2]
        allowAnyone = true) { request: JsonPostRequest =>

    val body = request.body
    val dao = request.dao

    val siteSettings = dao.getWholeSiteSettings()

    throwForbiddenIf(siteSettings.enableSso,
      "TyESSO0OAUTHNWUSR", "OpenAuth user creation disabled, because SSO enabled")

    throwForbiddenIf(!siteSettings.allowSignup,
      "TyE0SIGNUP04", "OpenAuth user creation disabled, because new signups not allowed")

    val fullName = (body \ "fullName").asOptStringNoneIfBlank
    val emailAddress = (body \ "email").as[String].trim
    val username = (body \ "username").as[String].trim
    val anyReturnToUrl = (body \ "returnToUrl").asOpt[String]

    throwForbiddenIf(!siteSettings.isEmailAddressAllowed(emailAddress),
      "TyEBADEMLDMN_-OAUTHB", "You cannot sign up using that email address")

    val oauthDetailsCacheKey = (body \ "authDataCacheKey").asOpt[String] getOrElse
      throwBadReq("DwE08GM6", "Auth data cache key missing")
    val oauthDetails = Option(cache.getIfPresent(oauthDetailsCacheKey)) match {
      case Some(details: OpenAuthDetails) =>
        // Don't remove the cache key here — maybe the user specified a username that's
        // in use already. Then hen needs to be able to submit again (using the same key).
        details
      case None =>
        throwForbidden("DwE50VC4", o"""Bad auth data cache key — this happens if you wait
             rather long (many minutes) with submitting the dialog.
             Or if the server was just restarted. Please try to sign up again.""")
      case _ =>
        die("TyE2GVM0")
    }

    val emailVerifiedAt = oauthDetails.email match {
      case Some(e) if e.toLowerCase != emailAddress =>
        throwForbidden("DwE523FU2", o"""When signing up, currently you cannot change your email address
          from the one you use at ${oauthDetails.providerId}, namely: ${oauthDetails.email}""")
      case Some(e) =>
        // Twitter provides no email, or I don't know if any email has been verified.
        // We currently use only verified email addresses, from GitHub. [7KRBGQ20]
        // Google and Facebook emails have been verified though.
        // LinkedIn: Don't know if the email has been verified, so exclude LinkedIn here.
        if (oauthDetails.providerId == GoogleProvider.ID ||
            oauthDetails.providerId == GitHubProvider.ID ||
            oauthDetails.providerId == FacebookProvider.ID) {
          Some(request.ctime)
        }
        else {
          None
        }
      case None =>
        None
    }

    // Some dupl code. [2FKD05]
    if (!siteSettings.requireVerifiedEmail && emailAddress.isEmpty) {
      // Fine.
    }
    else if (emailAddress.isEmpty) {
      throwUnprocessableEntity("EdE8JUK02", "Email address missing")
    }
    else {
      anyEmailAddressError(emailAddress) foreach { errMsg =>
        throwUnprocessableEntity("TyEBADEMLADR_-OAU", s"Bad email address: $errMsg")
      }
    }

    if (ed.server.security.ReservedNames.isUsernameReserved(username)) // [5LKKWA10]
      throwForbidden("EdE4SWWB9", s"Username is reserved: '$username'; choose another username")

    val spamCheckTask = SpamCheckTask(
      createdAt = globals.now(),
      siteId = request.siteId,
      postToSpamCheck = None,
      who = request.whoOrUnknown,
      requestStuff = request.spamRelatedStuff.copy(
        userName = Some((username + " " + fullName.getOrElse("")).trim),
        userEmail = Some(emailAddress),
        userTrustLevel = Some(TrustLevel.NewMember)))

    globals.spamChecker.detectRegistrationSpam(spamCheckTask) map {
          spamCheckResults: SpamCheckResults =>
      SpamChecker.throwForbiddenIfSpam(spamCheckResults, "TyE2AKF067")

      val becomeOwner = LoginController.shallBecomeOwner(request, emailAddress)

      val userData = // [5LKKWA10]
        NewOauthUserData.create(name = fullName, username = username, email = emailAddress,
            emailVerifiedAt = emailVerifiedAt, identityData = oauthDetails,
            isAdmin = becomeOwner, isOwner = becomeOwner) match {
          case Good(data) => data
          case Bad(errorMessage) =>
            throwUnprocessableEntity("DwE7BD08", s"$errorMessage, please try again.")
        }

      val result = try {
        val loginGrant = dao.createIdentityUserAndLogin(userData, request.theBrowserIdData)
        val newMember = loginGrant.user
        dieIf(newMember.emailVerifiedAt != emailVerifiedAt, "EdE2WEP03")
        if (emailAddress.nonEmpty && emailVerifiedAt.isEmpty) {
          TESTS_MISSING // no e2e tests for this
          val email = LoginWithPasswordController.createEmailAddrVerifEmailLogDontSend(
              newMember, anyReturnToUrl, request.host, request.dao)
          globals.sendEmail(email, dao.siteId)
        }
        if (emailVerifiedAt.isDefined || siteSettings.mayPostBeforeEmailVerified) {
          createCookiesAndFinishLogin(request, request.siteId, loginGrant.user)
        }
        else {
          OkSafeJson(Json.obj(
            "userCreatedAndLoggedIn" -> JsFalse,
            "emailVerifiedAndLoggedIn" -> JsFalse))
        }
      }
      catch {
        case _: DbDao.DuplicateUsername =>
          throwForbidden(
              "DwE6D3G8", "Username already taken, please try again with another username")
        case _: DbDao.DuplicateUserEmail =>
          // BUG SHOULD support many users per email address, if mayPostBeforeEmailVerified.
          if (emailVerifiedAt.isDefined) {
            // The user has been authenticated, so it's okay to tell him/her about the email address.
            throwForbidden(
              "DwE4BME8", "You already have an account with that email address")
          }
          // Don't indicate that there is already an account with this email.
          LoginWithPasswordController.sendYouAlreadyHaveAnAccountWithThatAddressEmail(
            request.dao, emailAddress, siteHostname = request.host, siteId = request.siteId)
          OkSafeJson(Json.obj(
            "userCreatedAndLoggedIn" -> JsFalse,
            "emailVerifiedAndLoggedIn" -> JsFalse))
      }

      // Everything went fine. Won't need to submit the dialog again, so remove the cache key.
      cache.invalidate(oauthDetailsCacheKey)

      result.discardingCookies(CookiesToDiscardAfterLogin: _*)
    }
  }


  /** Redirects to and logs in via anyLoginOrigin; then redirects back to this site, with
    * a session id and xsrf token included in the GET request.
    */
  private def loginViaLoginOrigin(providerName: String, request: Request[Unit]): Future[Result] = {
    // Parallel logins? Is the same user logging in in two browser tabs, at the same time?
    // People sometimes do, for some reason, and if that won't work, they sometimes contact
    // the Talkyard developers and ask what's wrong. Only to avoid these support requests,
    // let's make parallel login work, by including xsrf tokens from all such ongoing logins,
    // in the cookie value. [PRLGIN]
    val anyCookie = request.cookies.get(ReturnToThisSiteXsrfTokenCookieName)
    val oldTokens: Option[String] = anyCookie.map(_.value)

    val newXsrfToken = nextRandomString()
    val newCookieValue = newXsrfToken + Separator + oldTokens.getOrElse("")
    val loginEndpoint =
      globals.anyLoginOrigin.getOrDie("TyE830bF1") +
        routes.LoginWithOpenAuthController.loginAtLoginOriginThenReturnToOriginalSite(
          providerName, returnToOrigin = originOf(request), newXsrfToken)
    Future.successful(Redirect(loginEndpoint).withCookies(
      SecureCookie(name = ReturnToThisSiteXsrfTokenCookieName, value = newCookieValue,
        maxAgeSeconds = Some(LoginTimeoutMins * 60), httpOnly = false)))
  }


  /** Logs in, then redirects back to returnToOrigin, and specifies xsrfToken to prevent
    * XSRF attacks and session fixation attacks.
    *
    * The request origin must be the anyLoginOrigin, because that's the origin that the
    * OAuth 1 and 2 providers supposedly have been configured to use.
    */
  def loginAtLoginOriginThenReturnToOriginalSite(provider: String, returnToOrigin: String,
        xsrfToken: String): Action[Unit] = AsyncGetActionIsLogin { request =>
    // The actual redirection back to the returnToOrigin happens in handleAuthenticationData()
    // — it checks the value of the return-to-origin cookie.
    if (globals.anyLoginOrigin isNot originOf(request))
      throwForbidden(
        "DwE50U2", s"You need to login via the login origin, which is: `${globals.anyLoginOrigin}'")

    val futureResponse = startOrFinishAuthenticationWithSilhouette(provider, request)
    futureResponse map { response =>
      response.withCookies(
        SecureCookie(name = ReturnToSiteOriginTokenCookieName, value = s"$returnToOrigin$Separator$xsrfToken",
          httpOnly = false))
    }
  }


  def continueAtOriginalSite(oauthDetailsCacheKey: String, xsrfToken: String): Action[Unit] =
        GetActionIsLogin { request =>
    // oauthDetailsCacheKey might be a chache key Mallory generated, when starting a login
    // flow on his laptop — and now he might have made the current requester click a link
    // with that cache key, in the url. So, we also check an xsrf token here.
    val anyXsrfTokenInSession = request.cookies.get(ReturnToThisSiteXsrfTokenCookieName)
    anyXsrfTokenInSession match {
      case Some(xsrfCookie) =>
        // There might be many tokens, if, surprisingly, the user clicks Login in different
        // browser tabs in parallel. [PRLGIN]  ... Oh this doesn't work anyway, because
        // Silhouette stores and overwrites a Silhouette xsrf token in a single cookie.
        // Keep this anyway — maybe Silhouette fixes that issue, and then this Talkyard code here
        // already works properly.
        val tokens = xsrfCookie.value.split(Separator)
        val okToken = tokens.contains(xsrfToken)
        throwForbiddenIf(!okToken,
          "TyEOAUXSRFTKN", o"""Bad XSRF token, not included in the
              $ReturnToThisSiteXsrfTokenCookieName cookie""")
      case None =>
        throwForbidden("TyE0OAUXSRFCO", s"No $ReturnToThisSiteXsrfTokenCookieName xsrf cookie",
            o"""You need to login over at Google or Facebook, within $LoginTimeoutMins minutes,
            once you've started logging in / signing up. Feel free to try again.""")
    }
    tryLoginOrShowCreateUserDialog(request, oauthDetailsCacheKey = Some(oauthDetailsCacheKey))
      .discardingCookies(DiscardingSecureCookie(ReturnToThisSiteXsrfTokenCookieName))
  }


  private val HttpLayer =
    new silhouette.api.util.PlayHTTPLayer(globals.wsClient)(globals.executionContext)

  private val authStuffSigner = new silhouette.crypto.JcaSigner(
    silhouette.crypto.JcaSignerSettings(
      key = globals.applicationSecret, pepper = "sil-pepper-kfw93KPUF02wF"))

  private val Crypter = new silhouette.crypto.JcaCrypter(
    silhouette.crypto.JcaCrypterSettings(key = globals.applicationSecret))

  private def csrfStateItemHandler = new silhouette.impl.providers.state.CsrfStateItemHandler(
    silhouette.impl.providers.state.CsrfStateSettings(
      cookieName = AuthStateCookieName, cookiePath = "/", cookieDomain = None,
      secureCookie = globals.secure, httpOnlyCookie = true, expirationTime = 5 minutes),
    new silhouette.impl.util.SecureRandomIDGenerator(),
    authStuffSigner)

  private val socialStateHandler =
    new silhouette.impl.providers.DefaultSocialStateHandler(
      Set(csrfStateItemHandler), authStuffSigner)

  private val OAuth1TokenSecretProvider =
    new silhouette.impl.providers.oauth1.secrets.CookieSecretProvider(
      silhouette.impl.providers.oauth1.secrets.CookieSecretSettings(
        cookieName = "dwCoOAuth1TokenSecret", secureCookie = globals.secure),
      authStuffSigner,
      Crypter,
      silhouette.api.util.Clock())


  private def googleProvider(): GoogleProvider with CommonSocialProfileBuilder =
    new GoogleProvider(HttpLayer, socialStateHandler,
      getOrThrowDisabled(globals.socialLogin.googleOAuthSettings))

  private def facebookProvider(): FacebookProvider with CommonSocialProfileBuilder =
    new FacebookProvider(HttpLayer, socialStateHandler,
      getOrThrowDisabled(globals.socialLogin.facebookOAuthSettings))

  private def twitterProvider(): TwitterProvider with CommonSocialProfileBuilder = {
    val settings = getOrThrowDisabled(globals.socialLogin.twitterOAuthSettings)
    new TwitterProvider(
      HttpLayer, new PlayOAuth1Service(settings), OAuth1TokenSecretProvider, settings)
  }

  private def githubProvider(): CustomGitHubProvider =   // (TYSOCPROF)
    new CustomGitHubProvider(HttpLayer, socialStateHandler,
      getOrThrowDisabled(globals.socialLogin.githubOAuthSettings),
      globals.wsClient)

  private def gitlabProvider(): GitLabProvider with CommonSocialProfileBuilder =
    new GitLabProvider(HttpLayer, socialStateHandler,
      getOrThrowDisabled(globals.socialLogin.gitlabOAuthSettings))

  private def linkedinProvider(): CustomLinkedInProvider with CommonSocialProfileBuilder =
    new CustomLinkedInProvider(HttpLayer, socialStateHandler,
      getOrThrowDisabled(globals.socialLogin.linkedInOAuthSettings),
      globals.wsClient)

  private def vkProvider(): VKProvider with CommonSocialProfileBuilder =
    new VKProvider(HttpLayer, socialStateHandler,
      getOrThrowDisabled(globals.socialLogin.vkOAuthSettings))

  private def instagramProvider(): InstagramProvider with CommonSocialProfileBuilder =
    new InstagramProvider(HttpLayer, socialStateHandler,
      getOrThrowDisabled(globals.socialLogin.instagramOAuthSettings))


  private def getOrThrowDisabled[A](anySettings: A Or ErrorMessage): A = anySettings match {
    case Good(settings) => settings
    case Bad(errorMessage) => throwForbidden("EsE5YFK02", errorMessage)
  }

}



case class ExternalEmailAddr(
  emailAddr: String,
  isPrimary: Boolean,
  isVerified: Boolean,
  isPublic: Boolean)


sealed abstract class Gender
object Gender {
  case object Male extends Gender
  case object Female extends Gender
  case object Other extends Gender
}


case class ExternalSocialProfile(
  providerId: String,
  providerUserId: String,
  username: Option[String],
  firstName: Option[String],
  lastName: Option[String],
  fullName: Option[String],
  gender: Option[Gender],
  avatarUrl: Option[String],
  publicEmail: Option[String],
  publicEmailIsVerified: Option[Boolean],
  primaryEmail: Option[String],
  primaryEmailIsVerified: Option[Boolean],
  company: Option[String],
  location: Option[String],
  aboutUser: Option[String],
  facebookUrl: Option[String] = None,
  githubUrl: Option[String] = None,
  createdAt: Option[String]) extends SocialProfile {

  require(publicEmail.isDefined == publicEmailIsVerified.isDefined, "TyE7KBRAW02")
  require(primaryEmail.isDefined == primaryEmailIsVerified.isDefined, "TyE7KBRAW03")

  def loginInfo = LoginInfo(providerId, providerUserId)

}



class CustomGitHubProfileParser(
  val executionContext: ExecutionContext,
  val wsClient: play.api.libs.ws.WSClient,
  val githubApiBaseUrl: String)
  extends SocialProfileParser[JsValue, ExternalSocialProfile, OAuth2Info]
  with TyLogging {

  import play.api.libs.ws

  /** Parses json from GitHub that describes a user with an account at GitHub.
    * The json docs: https://developer.github.com/v3/users/#response
    */
  def parse(json: JsValue, authInfo: OAuth2Info): Future[ExternalSocialProfile] = {
    val anyEmailsFuture = loadPublicAndVerifiedEmailAddrs(authInfo)
    anyEmailsFuture.map({ case (anyPublAddr, anyPrimAddr) =>
      try {
        // GitHub user Json docs:  https://developer.github.com/v3/users/#response
        ExternalSocialProfile(
          providerId = GitHubProvider.ID,
          providerUserId = (json \ "id").as[Long].toString,
          username = (json \ "login").asOptStringNoneIfBlank,
          firstName = None,
          lastName = None,
          fullName = (json \ "name").asOptStringNoneIfBlank,
          gender = None,
          avatarUrl = (json \ "avatar_url").asOptStringNoneIfBlank,
          publicEmail = anyPublAddr.map(_.emailAddr),
          publicEmailIsVerified = anyPublAddr.map(_.isVerified),
          primaryEmail = anyPrimAddr.map(_.emailAddr),
          primaryEmailIsVerified = anyPrimAddr.map(_.isVerified),
          company = (json \ "company").asOptStringNoneIfBlank,
          location = (json \ "location").asOptStringNoneIfBlank,
          aboutUser = (json \ "bio").asOptStringNoneIfBlank,
          // api url, for loading user json: (json \ "url"), but we
          // want the html profile page url, and that's 'html_url'.
          githubUrl = (json \ "html_url").asOptStringNoneIfBlank,
          createdAt = (json \ "created_at").asOptStringNoneIfBlank)
      }
      catch {
        case ex: Exception =>
          // Add this more detailed exception cause to the exception chain.
          PRIVACY // Someone's email might end up in the log files.
          throw new RuntimeException(
            s"Unexpected user profile json from GitHub: ${json.toString()} [TyE5ARQ2HE7]", ex)
      }
    })(executionContext)
  }


  /** GitHub doesn't include any email, if there's no publicly visibly email configured,
    * and that might not be a verified email? Here we load a verified, and preferably
    * primary, email address.
    */
  private def loadPublicAndVerifiedEmailAddrs(oauth2AuthInfo: OAuth2Info)
        : Future[(Option[ExternalEmailAddr], Option[ExternalEmailAddr])] = {
    // List user email addresses docs:
    //   https://developer.github.com/v3/#oauth2-token-sent-in-a-header
    val url = s"$githubApiBaseUrl/emails"
    val githubRequest: ws.WSRequest =
      wsClient.url(url).withHttpHeaders(
        // Auth docs: https://developer.github.com/v3/#oauth2-token-sent-in-a-header
        // OAuth2 bearer token. GitHub will automatically know which user the request concerns
        // (although not mentioned in the request URL).
        play.api.http.HeaderNames.AUTHORIZATION -> s"token ${oauth2AuthInfo.accessToken}",
        // Use version 3 of the API, it's the most recent one (as of 2019-03).
        // https://developer.github.com/v3/#current-version
        play.api.http.HeaderNames.ACCEPT -> "application/vnd.github.v3+json")

    githubRequest.get().map({ response: ws.WSResponse =>
      // GitHub's response is (as of 2018-10-13) like:
      // https://developer.github.com/v3/users/emails/#list-email-addresses-for-a-user
      // [{ "email": "a@b.c", "verified": true, "primary": true, "visibility": "public" }]
      try {
        val statusCode = response.status
        val bodyAsText = response.body
        if (statusCode != 200) {
          logger.warn(o"""Unexpected status: $statusCode, from GitHub
            when loading email address [TyEGITHUBEMLS], url: $url, response: $bodyAsText""")
          (None, None)
        }
        else {
          val bodyAsJson = Json.parse(bodyAsText)
          val emailObjs: Seq[JsValue] = bodyAsJson.asInstanceOf[JsArray].value
          val emails: Seq[ExternalEmailAddr] = emailObjs.map({ emailObjUntyped: JsValue =>
            val emailObj = emailObjUntyped.asInstanceOf[JsObject]
            ExternalEmailAddr(
              emailAddr = emailObj.value.get("email").map(_.asInstanceOf[JsString].value)
                .getOrDie("TyE5RKBW20P", s"Bad JSON from GitHub: $bodyAsText"),
              isVerified = emailObj.value.get("verified") is JsTrue,
              isPrimary = emailObj.value.get("primary") is JsTrue,
              isPublic = emailObj.value.get("visibility") is JsString("public"))
          })

          val anyPublAddr =
            emails.find(e => e.isPublic && e.isVerified) orElse
              emails.find(_.isPublic)

          val anyPrimaryAddr =  // [7KRBGQ20]
            emails.find(e => e.isPrimary && e.isVerified) orElse
              emails.find(e => e.isPublic && e.isVerified) orElse
              emails.find(_.isVerified)

          (anyPublAddr, anyPrimaryAddr)
        }
      }
      catch {
        case ex: Exception =>
          logger.warn("Error parsing GitHub email addresses JSON [TyE4ABK2LR7]", ex)
          (None, None)
      }
    })(executionContext).recoverWith({
      case ex: Exception =>
        logger.warn("Error asking GitHub for user's email addresses [TyE8BKAS225]", ex)
        Future.successful((None, None))
    })(executionContext)
  }
}


class CustomGitHubProvider(
  protected val httpLayer: HTTPLayer,
  protected val stateHandler: SocialStateHandler,
  val settings: OAuth2Settings,
  wsClient: play.api.libs.ws.WSClient) extends BaseGitHubProvider {
                                        // no: with CommonSocialProfileBuilder {
                                        // — maybe create a TalkyardSocialProfileBuilder?  (TYSOCPROF)
                                        //  or TyExternalSocialProfileBuilder?
                                        // "Ty" prefix = clarifies isn't Silhouette's built-in class.

  // This is the base api url, used to construct requests to the GitHub server.
  val apiBaseUrl: String = apiUserUrl

  private var warnedAboutOldAuth = false

  override protected val urls: Map[String, String] = Map("api" -> apiUserUrl)

  // The url to fetch the user's profile, from the GitHub server.
  // For GitHub.com, it's GitHubProvider.API = "https://api.github.com/user".
  // And for GitHub Enterprise, it's "https://own.github/api/v3/user?access_token=%s".
  // Dropping-right up to and incl the rightmost '/' results in the api base url,
  // which can be used to construct other requests to GitHub.
  def apiUserUrl: String = settings.apiURL.map(url => {
    // From 2020-02-10, Git revision 2c94117d54319c1a, Silhouette no longer wants
    // "?access_token=%s", but instead uses the auth header:
    //     Authorization: Bearer the-access-token
    // However, the Talkyard config might still include the "?access_token=%s" suffix,
    // which would make GitHub reply 400 Bad Request. So:
    var u = url.trim()
    val accessTokenQueryParam = "?access_token=%s"
    if (u.contains(accessTokenQueryParam)) {
      u = u.replaceAllLiterally(accessTokenQueryParam, "")
      if (!warnedAboutOldAuth) {
        warnedAboutOldAuth = true
        logger.warn(o"""Deprecated GitHub auth conf: Remove "$accessTokenQueryParam" from
            the  github.apiURL  config value, in  $ProdConfFilePath.""")
      }
    }
    u
  }).getOrElse(
    com.mohiva.play.silhouette.impl.providers.oauth2.GitHubProvider.API)

  type Self = CustomGitHubProvider

  override type Profile = ExternalSocialProfile

  val profileParser = new CustomGitHubProfileParser(executionContext, wsClient, apiBaseUrl)

  def withSettings(fn: Settings => Settings): CustomGitHubProvider = {
    new CustomGitHubProvider(httpLayer, stateHandler, fn(settings), wsClient)
  }
}



// Silhouette doesn't yet support LinkedIn API v2 so using this class,
// temporarily.
// Also need this OAuth2Settings setting:
// apiURL = Some("https://api.linkedin.com/v2/me?fields=id,firstName,lastName&oauth2_access_token=%s")
class CustomLinkedInProvider(
  protected val httpLayer: HTTPLayer,
  protected val stateHandler: SocialStateHandler,
  val settings: OAuth2Settings,
  wsClient: play.api.libs.ws.WSClient)
  extends BaseLinkedInProvider with CommonSocialProfileBuilder {

  override type Self = CustomLinkedInProvider

  override val profileParser = new LinkedInProfileParserApiV2(executionContext, wsClient)

  override def withSettings(f: (Settings) => Settings) =
    new CustomLinkedInProvider(httpLayer, stateHandler, f(settings), wsClient)
}


class LinkedInProfileParserApiV2(
  val executionContext: ExecutionContext,
  val wsClient: play.api.libs.ws.WSClient)
  extends SocialProfileParser[JsValue, CommonSocialProfile, OAuth2Info]
  with TyLogging {

  override def parse(json: JsValue, authInfo: OAuth2Info): Future[CommonSocialProfile] = {
    // Silhouette now includes the email in the json, so skip loadEmailAddr().
    // loadEmailAddr(authInfo).map({ anyEmail =>

      // See  BaseLinkedInProvider.buildProfile().
      val apiJsonObj   = json \ "api"
      val emailJsonObj = json \ "email"
      val photoJsonObj = json \ "photo"

      val anyEmail = (emailJsonObj \\ "emailAddress").headOption.flatMap(_.asOpt[String])

      // The apiJsonObj from API v2 is like:
      // {
      //   "lastName":{
      //     "localized":{"en_US":"MyLastName"},
      //     "preferredLocale":{"country":"US","language":"en"}},
      //   "firstName":{
      //     "localized":{"en_US":"MyFirstName"},
      //     "preferredLocale":  {"country":"US","language":"en"}},
      //   "id":"........"   // "random" chars
      // }

      // Other fields? No. Here:
      // https://docs.microsoft.com/en-us/linkedin/shared/references/v2/profile#profile-fields-available-with-linkedin-partner-programs
      // you'll see that one needs to "have applied and been approved for a LinkedIn Partner Program",
      // to access more fields.

      val userId = (apiJsonObj \ "id").as[String]
      def readName(fieldName: String): Option[String] = {
        (apiJsonObj \ fieldName).asOpt[JsObject] flatMap { jsObj =>
          (jsObj \ "localized").asOpt[JsObject] flatMap { jsObj =>
            jsObj.fields.headOption.map(_._2) flatMap { nameInAnyLocale =>
              nameInAnyLocale match {
                case jsString: JsString => Some(jsString.value)
                case _ => None
              }
            }
          }
        }
      }
      val firstName = readName("firstName")
      val lastName = readName("lastName")

      val profile = CommonSocialProfile(
        loginInfo = LoginInfo(LinkedInProvider.ID, userId),
        firstName = firstName,
        lastName = lastName,
        fullName = None,    // not incl in LinkedIn API v2
        avatarURL = None,   // not incl in LinkedIn API v2
        email = anyEmail)

    Future.successful(profile)
    //})(executionContext)
  }


  /** LinkedIn API v2 requires a separate request to fetch the email address.
    *
    * Update, 2020-04: Silhouette 7.0 now loads the email in a 2nd request itself.
    * So, disabling this fn for now.
    *
    * But keep it commented in, so can fix complation errors, keep it somewhat
    * up-to-date, maybe needed soon again?
    */
  private def loadEmailAddr(oauth2AuthInfo: OAuth2Info): Future[Option[String]] = {
    die("TyE39572KTSP3", "loadEmailAddr() not needed, don't call")

    import play.api.libs.ws
    val emailRequestUrl =
      "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))" +
      "&oauth2_access_token=" + oauth2AuthInfo.accessToken
    val linkedinRequest: ws.WSRequest = wsClient.url(emailRequestUrl)

    linkedinRequest.get().map({ response: ws.WSResponse =>
      // LinkedIn's response is (as of 2019-04) like:
      // { "elements": [
      //   { "handle": "urn:li:emailAddress:1234567890",
      //      "handle~": { "emailAddress": "someone@example.com"  }} ]}
      try {
        val bodyAsText = response.body
        val bodyAsJson = Json.parse(bodyAsText)
        val elementsJsArray = (bodyAsJson \ "elements").as[JsArray]
        val elemOne = elementsJsArray.value.headOption match {
          case Some(o: JsObject) => o
          case Some(x) => throwUnprocessableEntity("TyEJSN0L245", s"Weird elem class: ${classNameOf(x)}")
          case None => throwUnprocessableEntity("TyEJSN2AKB05", "No email elem")
        }
        val handleObj = (elemOne \ "handle~").as[JsObject]
        val addr = (handleObj \ "emailAddress").as[JsString].value
        Some(addr)
      }
      catch {
        case ex: Exception =>
          logger.warn("Error parsing LinkedIn email address JSON [TyE7UABKT32]", ex)
          None
      }
    })(executionContext).recoverWith({
      case ex: Exception =>
        logger.warn("Error asking LinkedIn for user's email address [TyE5KAW2J]", ex)
        Future.successful(None)
    })(executionContext)
  }
}
