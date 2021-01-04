/**
 * Copyright (c) 2014-2017, 2020 Kaj Magnus Lindberg
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

import com.auth0.jwt.{JWT => a0_JWT}
import com.auth0.jwt.interfaces.{Claim => a0_Claim, DecodedJWT => a0_DecodedJWT}
import com.auth0.jwt.exceptions.{JWTDecodeException => a0_JWTDecodeException}
import com.debiki.core._
import com.debiki.core.Prelude._
import com.github.benmanes.caffeine
import com.github.scribejava.core.oauth.{OAuth20Service => sj_OAuth20Service, OAuthService => sj_OAuthService}
import com.github.scribejava.core.builder.api.{DefaultApi20 => sj_DefaultApi20}
import com.github.scribejava.core.model.{OAuth2AccessToken => sj_OAuth2AccessToken, OAuth2AccessTokenErrorResponse => sj_OAuth2AccessTokenErrorResponse, OAuthAsyncRequestCallback => sj_OAuthAsyncReqCallback, OAuthRequest => sj_OAuthRequest, Response => sj_Response, Verb => sj_Verb}
import com.github.scribejava.apis.openid.{OpenIdOAuth2AccessToken => sj_OpenIdOAuth2AccessToken}
import com.mohiva.play.silhouette
import com.mohiva.play.silhouette.api.util.HTTPLayer
import com.mohiva.play.silhouette.api.LoginInfo
import com.mohiva.play.silhouette.impl.providers.oauth1.services.PlayOAuth1Service
import com.mohiva.play.silhouette.impl.providers.oauth1.TwitterProvider
import com.mohiva.play.silhouette.impl.providers.oauth2._
import com.mohiva.play.silhouette.impl.providers._
import ed.server.spam.SpamChecker
import debiki._
import debiki.dao.SiteDao
import debiki.EdHttp._
import debiki.JsonUtils._
import talkyard.server._
import ed.server._
import ed.server.http._
import ed.server.security.EdSecurity
import IdentityProvider.{ProtoNameOidc, ProtoNameOAuth2, ProtoNameOAuth10a}
import org.scalactic.{Bad, ErrorMessage, Good, Or}
import play.api.libs.json._
import play.api.mvc._
import play.api.Configuration
import talkyard.server.authn.{parseCustomUserInfo, parseOidcIdToken, parseOidcUserInfo, doAuthnServiceRequest, WellKnownIdps}
import talkyard.server.{ProdConfFilePath, TyLogging}

import scala.concurrent.{ExecutionContext, Future, Promise}
import scala.concurrent.duration._
import java.io.{IOException => j_IOException}
import java.util.concurrent.{ExecutionException => j_ExecutionException}
import java.util.concurrent.atomic.{AtomicInteger => j_AtomicInteger}
import java.util.concurrent.TimeUnit.{MINUTES => j_MINUTES}
import javax.inject.Inject


/**
  * @param useServerGlobalIdp — Then we'll look up the IDP among the server global
  *   IDPs, ignoring this site's custom IDPs if any.
  * @param authnViaSiteId — If authn via a server global IDP, we do that from
  *   a dedicated authn origin site. Need to remember which site,
  *   so one cannot use a nonce cache key at the wrong site.
  * @param loginToSiteId — The site pat wants to login to (or first create
  *  an account at, and then login to), after having authenticated
  *  against an IDP, possibly via a different Ty site (the authn origin site).
  * @param returnToUrl — Where to redirect pat after login.
  * @param browserNonce
  * @param createdAt
  * @param stateString — The OAuth2 'state' query param sent to the IDP's auth endpoint.
  * @param oauth2StateUseCount — The OAuth2 state an be used once only. We show a
  *  friendly troubleshooting message if used more than once.
  * @param extIdentity Data about the user's account at the Identity Provider (IDP).
  * @param matchingTyUser — any existing Talkyard user with the same email addr as
  *  the extIdentity's email addr.
  * @param nextStep — so a nonce cache key cannot be used for the wrong thing.
  */
private case class OngoingAuthnState(
  useServerGlobalIdp: Bo,
  authnXsrfToken: St,
  authnViaSiteId: SiteId,
  loginToSiteId: SiteId,
  loginToSiteOrigin: St,
  continueAtAuthnSiteNonce: Opt[St] = None,
  continueAtOrigSiteNonce: Opt[St] = None,
  protocol: St,
  providerAlias: St,
  isInLoginPopup: Bo,
  mayCreateUser: Bo,  // RENAME to isAdminArea, client side too, 'mayNotCreateUser' there
  returnToUrl: St,
  browserNonce: St,
  createdAt: When,
  stateString: St,
  oauth2StateUseCount: j_AtomicInteger,
  selectAccountAtIdp: Bo = false,
  lastStepAt: When,
  nextStep: St,
  extIdentity: Opt[OpenAuthDetails] = None,
  matchingTyUser: Opt[User] = None) {

  // If redirecting to the authn site, we must be using a server global IDP.
  require(continueAtAuthnSiteNonce.isEmpty || useServerGlobalIdp,
        "TyE20KADM25A5")
  // If going to the authn site, we must also plan to go back to the
  // login site, afterwards.
  require(continueAtAuthnSiteNonce.isDefined == continueAtOrigSiteNonce.isDefined,
        "TyE63MREJMP45")
  // Don't accidentally bug-reuse the same nonce.
  require(continueAtAuthnSiteNonce.isEmpty ||
        continueAtAuthnSiteNonce != continueAtOrigSiteNonce, "TyE305MWK24")

  def usesServerGlobalIdp: Bo = useServerGlobalIdp
  def usesSiteCustomIdp: Bo = !useServerGlobalIdp

  def protoAlias: St = s"$protocol/$providerAlias"

  def isAdminArea: Bo = !mayCreateUser  // remove later, see above

  def toLogString: St = {
    val who: Opt[St] = extIdentity flatMap { userInfo: IdpUserInfo =>
      userInfo.anyUsernameNameEmail
    }
    val dbUsernameId = matchingTyUser.map(_.usernameHashId)
    val dbUserEmail = matchingTyUser.map(_.primaryEmailAddress)
    s"$protoAlias: next: $nextStep, ext idty: ${who getOrElse "unknown"
          }, db usr: $dbUsernameId, db usr email: $dbUserEmail"
  }
}



/** OAuth2 or OIDC authentication, e.g. for Google, Facebook and Twitter, Keycloak.
  *
  * This class is a bit complicated, because it supports logging in at forum-X
  * via another site hosted by the same Talkyard server — an "Authentication Site",
  * say authn.domain.com. This is needed because Talkyard is multitenant, but
  * OAuth2 providers let one log in only via a specific Redirect URI (or a few)
  * at one domain only — and it's "impossibly complicated" to configure
  * OAuth2 clients app for Talkyard SaaS site admins in general.
  * — So, we need a way to enable OAuth2 login for common Identity Providers that
  * people expect to just work, e.g. Gmail, FB, Twitter, without the site admins
  * having to create their own OAuth2 client apps.
  * Therefore:
  * If you want to login at forum-X.example.com, Talkyard can (if the site
  * admins want) redirect you to the Talkyard server's authn.domain.com,
  * then logs you in from there, over at an IDP whose Redirect URI is
  * to authn.domain.com.
  * This OAuth2 IDP client app gets configured by a *server* admin — which
  * are technical people, can do things like configuring DNS and email services
  * — and OAuth2 apps.
  * After login at the IDP via authn.domain.com, Talkyard redirects you back to
  * forum-X with an identity from the IDP, and you get logged in at forum-X
  * with that identity (say, Gmail account or FB profile).
  * (That identity gets cached server side by Talkyard, when you're at
  * the authn site, and gets retrieved when you're redirected back to Forum-X,
  * by looking at a nonce in the URL.  "Nonce" means: a secret
  * 'N'umber used just 'Once'.)
  */
class LoginWithOpenAuthController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) with TyLogging {

  REFACTOR // MOVE this file to package talkyard.server.authn
  RENAME // to  AuthnWithExtIdp

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


  // Remembers ongoing authentication attempts.
  private val authnStateCache = caffeine.cache.Caffeine.newBuilder()
    .maximumSize(5*1000) // change to config value, e.g. 1e9 = 1GB mem cache. Default to 50M? [ADJMEMUSG]
    // Don't expire too quickly — the user needs time to choose & typ a username.
    // SECURITY COULD expire sooner (say 10 seconds) if just logging in, because then
    // the user need not think or type anything.
    // The user might want to review the Terms of Use, so wait for an hour, here. [4WHKTP06]
    // BUG SHOULD use Redis, so the key won't disappear after server restart.
    // Cmp w GitHub: An authn code in an email from GitHub was valid for 1 hour,
    // today 2020-10-16.
    .expireAfterWrite(65, j_MINUTES)
    .build().asInstanceOf[caffeine.cache.Cache[St, OngoingAuthnState]]


  // Some steps happen without the human doing anything — shouldn't take moree
  // than one or a few seconds, e.g. an auto redirect to the authn site.
  val AFewSeconds: i64 = if (Globals.isDevOrTest) 25 else 25



  private def getAuthnStateOrThrow(nonce: St, thisStep: St,
          authnViaSiteId: SiteId = NoSiteId, loginToSiteId: SiteId = NoSiteId,
          loginToSiteOrigin: St = "",
          keepStateInCache: Bo = false, maxAgeSeconds: Opt[i64] = None)
          : OngoingAuthnState = {

    throwForbiddenIf(nonce.isEmpty, "TyEEMPTYNONCE", s"Empty nonce, step: $thisStep")

    val authnState = authnStateCache.getIfPresent(nonce)
    throwForbiddenIf(authnState eq null, "TyE0AUTSTATE",
          s"No authn state for step: $thisStep, nonce: $nonce")

    maxAgeSeconds foreach { maxSecs: i64 =>
      val elapsed = globals.now().seconds - authnState.lastStepAt.seconds
      throwForbiddenIf(elapsed > maxSecs, "TyEAUTSLOW",
            s"Too many seconds elapsed: $elapsed s, max is: $maxSecs s")
    }

    // Don't reuse a "Number to use Once" — would mess up security, e.g. replay attacks.
    if (!keepStateInCache) {
      authnStateCache.invalidate(nonce)
    }

    // Ensure we're accessing the correct site, say, forum-X.com, but not
    // the-wrong-forum-Y.elsewhere.org hosted by the same server:

    if (authnState.authnViaSiteId != NoSiteId)  // backw compat w Silhouette
      throwForbiddenIf(authnViaSiteId != NoSiteId && authnViaSiteId != authnState.authnViaSiteId,
          "TyEAUTBADAUTSITE", s"At the wrong authn site id: $authnViaSiteId, should be: ${
              authnState.authnViaSiteId}")

    if (authnState.loginToSiteId != NoSiteId)  // backw compat w Silhouette
      throwForbiddenIf(loginToSiteId != NoSiteId && loginToSiteId != authnState.loginToSiteId,
          "TyEAUTLOGI2SITEID", s"Wrong loginToSiteId: $loginToSiteId, should be: ${
              authnState.loginToSiteId}")

    if (authnState.loginToSiteOrigin.nonEmpty)  // backw compat w Silhouette
      throwForbiddenIf(loginToSiteOrigin.nonEmpty &&
              loginToSiteOrigin != authnState.loginToSiteOrigin,
          "TyEAUTLOGI2SITEORG", s"Wrong loginToSiteOrigin: ${loginToSiteOrigin
              }, should be: ${authnState.loginToSiteOrigin}")

    throwForbiddenIf(authnState.nextStep != thisStep,
          "TyEAUTSTEP", s"Bad step: ${authnState.nextStep}, expected: $thisStep")

    authnState
  }



  def authnStart(protocol: St, providerAlias: St, returnToUrl: St, nonce: St,
          useServerGlobalIdp: Opt[Bo], selectAccountAtIdp: Opt[Bo])
          : Action[U] = AsyncGetActionIsLoginRateLimited { request =>
    import request.dao

    val settings = dao.getWholeSiteSettings()
    throwForbiddenIf(settings.enableSso, "TyESSO0OAU01",
          "Single Sign-On API enabled at this site — then, custom IDPs disabled")

    SECURITY // actually do the below, browser side [br_authn_nonce].
    // Once done logging in, the browser will look for this value in the url.
    // If it's missing, that could mean a login xsrf attack is happening
    // — then, better reject the login session (which might be an attacker
    // initiated session, not the end user's own session).
    throwBadReqIfLowEntropy(nonce, paramName = "nonce", "TyENONCEENTROPY")
    throwBadParamIf(returnToUrl.obviouslyBadUrl, "TyE502MSKG", "returnToUrl", returnToUrl)

    val isInLoginPopup = request.rawQueryString.contains("isInLoginPopup")
    val mayCreateUser = !request.rawQueryString.contains("mayNotCreateUser")
    val useServerGlobalIdpBo: Bo = useServerGlobalIdp is true

    val (authnXsrfToken, authnXsrfCookie) = makeAuthnXsrfToken(request.underlying)

    val authnState = OngoingAuthnState(
          useServerGlobalIdp = useServerGlobalIdpBo,
          authnXsrfToken = authnXsrfToken,
          authnViaSiteId = dao.siteId,
          loginToSiteId = dao.siteId,
          loginToSiteOrigin = request.origin,
          protocol = protocol,
          providerAlias = providerAlias,
          isInLoginPopup = isInLoginPopup,
          mayCreateUser = mayCreateUser,
          returnToUrl = returnToUrl,
          browserNonce = nonce,
          createdAt = globals.now(),
          stateString = nextRandomString() + (
                // Only for now, until done migrating to ScribeJava. [migr_to_scribejava]
                "_scribejava_"),
          oauth2StateUseCount = new j_AtomicInteger(0),
          selectAccountAtIdp = selectAccountAtIdp is true,
          lastStepAt = globals.now(),
          nextStep = "redir_back")

    if (useServerGlobalIdpBo) {
      // We're trying to login via a server global IDP, shared by many sites
      // hosted on this server — e.g. Facebook or Gmail login, customized
      // once by a superadmin, and then available to all sites hosted by this server
      // (so no need to configure once per individual site).

      // But cannot do that, if login is only via this-site-custom-IDPs.
      throwForbiddenIf(settings.useOnlyCustomIdps, "TyE0SITECUSIDP",
            s"useOnlyCustomIdps enabled, then cannot use a server global IDP")

      val site = request.site
      throwForbiddenIf(
              site.featureFlags.contains("ffNotScribeJava") ||
              globals.config.featureFlags.contains("ffNotScribeJava"),
              "TyE0FFSCRJVA2", s"Remove feature flag ffNotScribeJava")

      // Verify that the server global IDP that pat tries to login with,
      // is enabled at *this* site  (that there's a server global IDP,
      // doesn't mean that this site wants to use it).  [glob_idp_enb_1]
      getServerGlobalIdentityProvider(authnState, dao).ifBad(problem =>
            throwForbidden(s"Cannot login via ${authnState.protoAlias
                  }: $problem [TyEGETGLOBIDP01]"))
    }

    def globalIdpAuthnOriginIsOtherSite: Bo =
      globals.anyLoginOrigin.isSomethingButNot(originOf(request))

    val futureResponse = {
      if (useServerGlobalIdpBo && globalIdpAuthnOriginIsOtherSite) {
        // The server global IDP has been configured to send authentication data
        // to another Ty site — namely the authn origin site: globals.anyLoginOrigin.
        // Redirect pat to that site, to authenticate from there.
        saveAuthnStateRedirToAuthnOrigin(authnState)
      }
      else {
        // The IDP pat is logging in with, should have been configured to redirect
        // pat back to a Redirection URI here (rather than to an authn origin site),
        // after login over at the IDP.
        // (The IDP might be this-site-custom, or server global, i.e. shared with
        // other sites, who then redirect users to this site for authn here,
        // and then they get sent back to those other site.)
        throwForbiddenIf(!useServerGlobalIdpBo && !settings.enableCustomIdps,
              "TyE0CUSTIDPS", "Custom IDPs not enabled at this site.\n\n" +
              o"""In the Admin Area, the 'Custom OIDC or OAuth2' checkbox
                needs to be checked.""")
        authnStartImpl(authnState, request)
      }
    }

    futureResponse.map(_.withCookies(authnXsrfCookie))
  }



  private def saveAuthnStateRedirToAuthnOrigin(authnStateNoNonce: OngoingAuthnState)
        : Future[p_Result] = {

    // Create two secret nonces:

    // One so we can continue at the authn origin, after having redirected
    // to there.
    val continueAtAuthnOriginNonce = nextRandomString()

    // And one so we can continue here at this site, and look up the authn state,
    // when done authenticating over at the authn origin site,
    // and having been redirected back to this site (this site is the "interesting"
    // site — with the forum/blog-comments/whatever we're logging in to).
    // Not really needed — but nice for debugging?
    val continueAtOrigSiteNonce = nextRandomString()

    val authnState = authnStateNoNonce.copy(
          continueAtAuthnSiteNonce = Some(continueAtAuthnOriginNonce),
          continueAtOrigSiteNonce = Some(continueAtOrigSiteNonce),
          nextStep = "at_authn_origin")

    val continueAtAuthnOriginUrl =
          globals.anyLoginOrigin.getOrDie("TyE305MRKTDE2") +
            routes.LoginWithOpenAuthController.continueAtAuthnOrigin(
                  secretNonce = continueAtAuthnOriginNonce)

    // The real next step.
    authnStateCache.put(continueAtAuthnOriginNonce, authnState)

    // Not really needed. Nice though for double checking, or debugging?
    authnStateCache.put(continueAtOrigSiteNonce, authnState.copy(
          nextStep = "org_site_start_state"))

    Future.successful(p_Results.Redirect(
          continueAtAuthnOriginUrl, status = p_Status.SEE_OTHER))
  }



  def continueAtAuthnOrigin(secretNonce: St): Action[U] = AsyncGetActionIsLogin {
        request =>
    import request.dao

    throwForbiddenIf(globals.anyLoginOrigin isNot request.origin, "TyEWRONGAUTORG",
          s"This site: ${request.origin}, is not the authn origin — that's: ${
            globals.anyLoginOrigin}")

    val authnStateWrongSiteId = getAuthnStateOrThrow(
          secretNonce, "at_authn_origin",
          maxAgeSeconds = Some(AFewSeconds)) // or "isInstantRedirect = true" ?

    // Change the authn site id from the original site id to the current site id.
    // We're authenticating via this site — the authn site — in order to login
    // at another site — the original site, authnState.loginToSiteId.
    val authnState = authnStateWrongSiteId.copy(
          authnViaSiteId = dao.siteId,
          lastStepAt = globals.now(),
          // The next step:
          // We'll redirect the browser to the IDP for pat to authn over there;
          // thereafter, the IDP redirects the browser back to this
          // Talkyard server's OAuth2 redirection URI — so, getting redirected
          // back, is the next HTTP request to this server:
          nextStep = "redir_back")

    dieIf(authnState.continueAtAuthnSiteNonce.isNot(secretNonce), "TyE305MAKTM2")

    // Skip this — not impossible that the authn origin site is accessible
    // via many hostnames, e.g. if currently moving to a new hostname. Then,
    // after redirecting to the authn origin, we might still be at the same site,
    // site id == authn site id. However, we'll check authnState.loginToSiteId later
    // when back at the orig site.
    //dieIf(authnState.authnViaSiteId == authnState.loginToSiteId, ..)

    authnStartImpl(authnState, request)
  }



  /** Redirects the browser to the IDP's authorization URL, for pat to auth there.
    * Once pat has auth'd at the IDP, the IDP will redirect the browser back to
    * this Ty server's OAuth2 redirection URI.
    */
  private def authnStartImpl(authnState: OngoingAuthnState, request: GetRequest)
        : Future[p_Result] = {
    import request.{dao, siteId}

    authnState.protocol match {
      case ProtoNameOidc | ProtoNameOAuth2 => // Fine
      case _ => throwBadReq("TyEBADPROTO", "Bad protocol: Only OIDC and OAuth2 supported")
    }

    dieIf(authnState.nextStep != "redir_back", "TyE405MRKG24")
    dieIf(authnState.authnViaSiteId != siteId, "TyEAUTSITEID001",
          s"Wrong authn site: $siteId, should be: ${authnState.authnViaSiteId}")

    authnStateCache.put(authnState.stateString, authnState)

    val idp: IdentityProvider = getIdentityProvider(authnState, dao)

    // Is it ok to reveal that this provider exists? Otherwise could be really
    // confusing to troubleshoot this.  There could be another setting:
    // hide: Bo  or  hideIfDisabled: Bo,  if we should hide that it even exists?
    throwForbiddenIf(!idp.enabled, "TyEIDPDISBLD01",
          s"Identity provider ${idp.protoAlias} is disabled")

    val origin =
          if (Globals.isProd || request.isDevTestToLocalhost) {
            request.origin
          }
          else {
            // We're testing authn against an external IDP, and via /etc/hosts
            // we pretending its Ty site runs on localhost, so the redir-back url
            // works although it's to a not-localhost domain?
            // Then, pretend we use https — the OAuth2 redirect uri typically is https.
            request.origin.replaceAllLiterally("http:", "https:")  // [local_aut_test]
          }

    val authnService: sj_OAuth20Service =
          dao.getScribeJavaAuthnService(origin, idp) getOrIfBad { errMsg =>
      throwForbidden("TyEGETIDPSVC01",
            s"s$siteId: Cannot get ScribeJava service for IDP ${idp.protoAlias
                }: $errMsg")
    }

    // OIDC nonce.
    // If this is OIDC, the nonce will be sent back to us in the access and id token
    // response, see: [oidc_nonce_back].
    val moreParams = new java.util.HashMap[St, St]()
    moreParams.put("nonce", authnState.browserNonce)

    // More custom params to configure the authn page over at the IDP.
    if (authnState.selectAccountAtIdp) {
      // Might work only for OIDC, not plain OAuth2.
      // Doesn't have any effect with Keycloak + OIDC either, weird.
      // Adding "login" just makes Keycloak ask the user to login again,
      // but if hen then chooses a different account, Keycloak shows an error
      // about already being logged in in the original account. Weird.
      // Is it a Keycloak bug maybe?
      moreParams.put("prompt", "select_account") // + " login"?
    }


    idp.oauAuthReqClaims foreach { reqClaims: JsObject =>
      moreParams.put("claims", reqClaims.toString)
    }

    UX; COULD // improve the login flow slightly, for Azure AD, with these params:
    // https://docs.microsoft.com/sv-se/azure/active-directory/develop/v2-oauth2-auth-code-flow
    // - login_hint — auto suggest username, if we already know what
    //   the name is, having seen it previously in preferred_username
    //   (could remember for a while in a cookie?).
    // - domain_hint=consumers  or  =organizations  — the user previously logged in as
    //   a consumer, if the Azure AD tenant id was Oidc.AzurePersonalAccountTenantId.
    //   Then can auto suggest logging in as a consumer this time too (B2C not B2B).


    val authorizationUrl = authnService.createAuthorizationUrlBuilder()
          .state(authnState.stateString)
          .additionalParams(moreParams)
          .build()

    // Redirect the browser to the OAuth2 auth endpoint; the user is to login over there.
    Future.successful(p_Results.Redirect(authorizationUrl, status = p_Status.SEE_OTHER))
  }



  /** This is the OAuth2 Redirect URL endpoint:
    * After the user has authenticated henself over at the IDP (Identity Provider),
    * the IDP redirects hens browser back to Talkyard, to this "redirect-back" =
    * "redirBack" fn.
    *
    * Note that the IDP might be malicious. So, need rate limits, for example.
    * And the end user might be someone clicking an attacker provided link
    * (e.g. login xsrf attacks), or other weird things.
    *
    * @param state — specified by Ty. For preventing xsrf attacks.
    * @param session_state — if the IDP, say, Keycloak, supports
    *  session management (like, logout?), it'll include a &session_state=...
    *  query param. Talkyard can then include this param in all subsequent
    *  requests to the IDP, so that the IDP knows which user Talkyard has
    *  in mind, from the IDP's point of view. And (?) if Ty tells the IDP that
    *  the user has logged out, then the IDP can log the user out from other
    *  services (other than Ty) managed by the IDP too  ?  or how does it work.
    * @param code — the authorization code: a temporary code to send
    *  to the OAuth2 IDP in the access token request, to get an access token.
    * @return Redirects the browser to some Talkyard page, or possibly
    *  embedding website with Ty embedded comments / an embedded Ty forum,
    *  or a create-new-Talkyard-account Talkyard page, or to a [link IDP identity
    *  to an existing Ty account] page.
    */
  def authnRedirBack(protocol: St, providerAlias: St,
          state: St, session_state: Option[St], code: St): Action[U]
          = AsyncGetActionIsLoginRateLimited { redirBackRequest =>
    authnRedirBackImpl(protocol, providerAlias = providerAlias, state = state,
          session_state = session_state, code = code, redirBackRequest)
  }


  private def authnRedirBackImpl(protocol: St, providerAlias: St,
          state: St, session_state: Option[St], code: St, redirBackRequest: GetRequest)
          : Future[p_Result] = {

    import redirBackRequest.{dao, siteId}

    logger.debug(i"""
          |s$siteId: Req to OAuth2 redirect uri:
          |  State: $state
          |  Code: $code
          |  Session state: $session_state""")

    val authnState = getAuthnStateOrThrow(state, "redir_back", authnViaSiteId = siteId,
          // Keep the authn state — instead, we increment a useCount below,
          // and if > 1, we show a user friendly error message.
          // This is nice to do here at the redirect uri endpoint in particular,
          // in case the end user reloads the page in the browser or sth like that.
          keepStateInCache = true)

    // This checked by getAuthnStateOrThrow() already:
    dieIf(authnState.authnViaSiteId != siteId, "TyEAUTSITEID002",
          s"Wrong authn site: $siteId, should be: ${authnState.authnViaSiteId}")

    logger.debug(s"s$siteId: Authn state: $authnState\n")
    dieIf(authnState.stateString != state, "TyE3M06KD24")

    val useCount = authnState.oauth2StateUseCount.incrementAndGet()
    throwForbiddenIf(useCount >= 2, "TyEOAUSTATEUSED",
          s"Trying to use one-time OAuth2 redirect-back-URI $useCount times")

    // Give the user some minutes to login — maybe hen wants to read some
    // Terms of Use or Privacy Policy.
    // If too slow, show a somewhat user friendly please-try-again message.
    // (Or use getAuthnStateOrThrow(... maxAgeSeconds= ...) instead?
    // But it's more developer friendly to show any useCount >= 2 error first?)
    val minutesOld = globals.now().minutesSince(authnState.createdAt)
    val maxMins = 15
    throwForbiddenIf(minutesOld > maxMins, "TyEOAUSTATESLOW",
          o"""You need to login within $maxMins minutes. Try again, a bit faster?
            Time elapsed: $minutesOld minutes.""")

    // [glob_idp_enb_2]
    val idp: IdentityProvider = getIdentityProvider(authnState, dao)
    throwForbiddenIf(!idp.enabled, "TyEIDPDISBLD02",
          s"Identity provider ${idp.protoAlias} was just disabled")

    def wrong(what: St) =
          s"Wrong $what: $protocol/$providerAlias, should be: ${idp.protoAlias}"
    throwForbiddenIf(protocol != idp.protocol, "TyEREDIRBACKPROTO", wrong("protocol"))
    throwForbiddenIf(providerAlias != idp.alias, "TyEREDIRBACKALIAS", wrong("provider"))

    val origin =
          if (Globals.isProd || redirBackRequest.isDevTestToLocalhost) {
            redirBackRequest.origin
          }
          else {
            // We're localhost-testing authn against a real remote IDP? Pretend https.
            redirBackRequest.origin.replaceAllLiterally(  // [local_aut_test]
                  "http:", "https:")
          }


    // ----- The response

    // We'll resolve this response-to-the-browser promise if there's an error,
    // or when we've gotten enough data about the user from the IDP and have
    // constructed and cached an identity.
    //
    val responseToBrowserPromise = Promise[p_Result]()


    // ----- Access token request

    // We got back `code`, a temporary authorization code, from the IDP's auth server,
    // via the query string in the browser, when it got redirected back to Ty
    // (i.e. back to the Redirect URI, /-/authn/:proto/:provider/redirback).
    // All we can do with this temp code, is to send it to the auth server,
    // to get an access token — plus an ID token if this is OIDC.
    // We'll use the access token to retrieve user info from the auth server
    // — in a per IDP custom way, if OAuth2; and from a standardized user-info
    // endpoint, if OIDC.
    //
    // The security reasons for this "extra" temp code step, are:
    //
    // 1) The redirect back URL is seen by the browser / end-user-app, and
    // possibly intermediate infrastructure, when the browser is redirected back
    // to the Ty server.
    // So, the URL might get intercepted by an attacker — then, we don't want
    // the end user's name, email etc, and access token, in the redirect-back URI.
    // Instead, we get just the one time random `code`, which we'll use to fetch
    // the user info via a backchannel request to the IDP, and this backchannel
    // request cannot get intercepted by the above-mentioned attacker.
    //
    // 2) The IDP wants to authenticate the Talkyard server, so the IDP knows it
    // won't send the access tokens to an untrusted server. We'll include an IDP
    // client id and client secret, when we send `code` to the IDP auth server
    // to get the access token. (This is a request directly from Ty to the IDP,
    // so the browser won't see the client id and secret.)
    //
    // See https://openid.net/specs/openid-connect-core-1_0.html#TokenRequest
    // and https://www.oauth.com/oauth2-servers/access-tokens/authorization-code-request/

    val authnService: sj_OAuth20Service = dao.getScribeJavaAuthnService(origin, idp)
          .getOrIfBad { errMsg =>
      // This ought to have worked? We got one just recently. Maybe a site admin
      // reconfigured something somehow? Or a bug?
      throwInternalError("TyEGETIDPSVC02",
            s"s$siteId: Cannot get ScribeJava service for IDP ${idp.protoAlias
                }: $errMsg")
    }


    authnService.getAccessToken(code, new sj_OAuthAsyncReqCallback[sj_OAuth2AccessToken] {
      override def onThrowable(throwable: Throwable): U = {
        // The access token request failed somehow.

        // Change to info, and show in site admin logs only instead?  [admin_log]
        val oauth2Api: sj_DefaultApi20 = authnService.getApi
        logger.warn(s"Error requesting access token from: ${
              oauth2Api.getAccessTokenEndpoint}  [TyEACSTKNREQ1]", throwable)

        val errorRespEx: RespEx = throwable match {
          case _: java.net.NoRouteToHostException =>
            // Don't include the server address — could be an organization private thing,
            // and reveal e.g. what software they use.
            SECURITY; COULD // later remove ex.toString from all errors responses
            // below, and show ex.toString only in an admin-only log.
            RespEx(BadGatewayResult("TyEACSTKNHST",
                  o"""Error requesting OAuth2 access token:
                      Cannot connect to the IDP's access token server"""))
          case ex @ (_: InterruptedException | _: j_ExecutionException | _: j_IOException) =>
            // We didn't even get a response!
            RespEx(InternalErrorResult("TyEACSTKNREQ2",
                  s"Error requesting access token: ${ex.toString}"))
          case ex: sj_OAuth2AccessTokenErrorResponse =>
            // We got an Error response.
            RespEx(ForbiddenResult("TyEACSTKNRSP",
                  s"Error response from access token endpoint: ${ex.toString}"))
          case ex: Exception =>
            RespEx(InternalErrorResult("TyEACSTKNUNK",
                  s"Unknown error requesting access token: ${ex.toString}"))
        }

        responseToBrowserPromise.failure(errorRespEx)
      }

      override def onCompleted(accessToken: sj_OAuth2AccessToken): U = {
        // TyOidcScribeJavaApi20 uses OpenIdJsonTokenExtractor.instance
        // as access token extractor; therefore, we can downcast to
        // OpenIdOAuth2AccessToken.
        val scribeJavaOidcTokens: Opt[sj_OpenIdOAuth2AccessToken] = accessToken match {
          case t: sj_OpenIdOAuth2AccessToken => Some(t)
          case notOidcToken =>
            dieIf(idp.isOpenIdConnect, "TyE3M05ATJ4",
                  s"Bad token class: ${classNameOf(notOidcToken)}")
            None
        }

        // If this is OAuth2 not OIDC, there's no OIDC id_token.
        val anyOidcIdToken: Opt[OidcIdToken] = scribeJavaOidcTokens flatMap { sjTokens =>
          val idTokenStr: St = sjTokens.getOpenIdToken
          if (idTokenStr eq null) {
            if (idp.isOpenIdConnect) {
              responseToBrowserPromise.failure(RespEx(BadGatewayResult(
                    "TyEACSTKN0OIDTKN",
                    s"s$siteId: Token response from OIDC provider lacks id_token, IDP: ${
                        idp.protoAlias}")))
              return ()
            }
            // An OAuth2-not-OIDC provider that still uses sj_OpenIdOAuth2AccessToken
            // and didn't send us and id_token? Weird, but is okay?
            None
          }
          else {
            Some(new OidcIdToken(idTokenStr))
          }
        }

        val anyUserInfo: Opt[IdpUserInfo] = anyOidcIdToken flatMap { idToken =>

          // Decode online:
          // https://jwt.ms/#id_token=the_id_token  (only do for dummy test tokens!)


          // ----- Validate id_token

          // Could validate the ID token, but, as Google says:  [when_chk_id_tkn]
          // (Ty's comments in [ ] brackets.)
          //
          // > Normally, it is critical that you validate an ID token before you
          // > use it, but since you are communicating directly with Google [or some
          // > other IDP] over an intermediary-free HTTPS channel and using
          // > your client secret to authenticate yourself to Google, you can be
          // > confident that the token you receive really comes from Google
          // > and is valid
          // See: https://developers.google.com/identity/protocols/oauth2/openid-connect#obtainuserinfo
          //
          // However if getting the ID token from an (untrusted) intermediary,
          // it must be validated.
          //
          // Here's Microsoft's docs about how to validate the id_token:
          // https://docs.microsoft.com/en-us/azure/active-directory/develop/access-tokens#validating-tokens
          // And then also:
          // https://docs.microsoft.com/en-us/azure/active-directory/develop/id-tokens#validating-an-id_token


          // ----- Check id_token nonce

          // Compare ID token nonce with authnState.browserNonce:
          // (maybe later we'll have encrypted it or hashed it)  [br_authn_nonce]
          //
          // The nonce [oidc_nonce_back] we sent as an URL query param in the IDP auth
          // request must be included by the IDP in the id token — so we'll know
          // the id token really belongs to the initial auth request we sent to
          // the IDP (by redirecting the browser to the IDP).
          //
          // Why a nonce?: 1, 2, 3 + docs:
          //
          // The nonce can 1) prevent replay attacks: If an attacker somehow sees the
          // redirect URI request back to Ty, and tries to replay it? — then, the nonce
          // has been used already, won't work twice. However, that's already
          // prevented thanks to the OAuth2 state param — and indeed,
          // the nonce is optional when using OIDC code flow.
          // But anyway, cannot hurt to check the nonce too and double-prevent
          // reply attacks.
          //
          // And 2) maybe some IDPs have many servers, and thanks to the nonce we can
          // know that it's less likely that there are security problems with the IDP,
          // because the IDP's auth req endpoint server and its token endpoint server
          // have spoken with each other: the auth req server has sent the nonce to
          // the token server, which now sent it back here. Which is less likely to
          // have worked properly, if one of the IDP's servers has been compromised
          // or we connected to the wrong token server somehow?
          //
          // And 3) We can send it back to the browser — it's nice to check,
          // browser side, that the session that got created, is based on the nonce
          // sent in the initial  /-/authn/../..?..&nonce=..  request to the Ty server,
          //
          // Docs:  https://openid.net/specs/openid-connect-basic-1_0.html#IDToken
          // nonce:  case-sensitive string
          //    OPTIONAL. String value used to associate a Client session with
          //    an ID Token, and to mitigate replay attacks.
          //    The value is passed through unmodified from the Authentication Request
          //    to the ID Token. The Client MUST verify that the nonce Claim Value
          //    is equal to the value of the nonce parameter sent in the
          //    Authentication Request. If present in the Authentication Request,
          //    Authorization Servers MUST include a nonce Claim in the ID Token
          //    with the Claim Value being the nonce value sent in the
          //    Authentication Request.

          val idTokenSt = idToken.idTokenStr
          val decodedJwt: a0_DecodedJWT = {
            try a0_JWT.decode(idTokenSt)
            catch {
              case ex: a0_JWTDecodeException =>
                val errCode = "TyEIDTKNBADJWT"
                val msg = s"Malformed OIDC id_token, IDP: ${idp.protoAlias}"
                responseToBrowserPromise.failure(RespEx(BadGatewayResult(errCode, msg)))
                logger.warn(s"s$siteId: $msg [$errCode], id_token: '$idTokenSt'", ex)
                return ()
            }
          }

          val nonceMaybeNullClaim: a0_Claim = decodedJwt.getClaim("nonce")
          if (nonceMaybeNullClaim.isNull) {
            val errCode = "TyEIDTKN0NONCE"
            val msg = s"No OIDC id_token nonce, IDP: ${idp.protoAlias}"
            responseToBrowserPromise.failure(RespEx(BadGatewayResult(errCode, msg)))
            logger.warn(s"s$siteId: $msg [$errCode], id_token: '$idTokenSt'")
            return ()
          }

          val nonceOrNull = nonceMaybeNullClaim.asString   // [Scala_3] type:  St | null
          if ((nonceOrNull eq null) || nonceOrNull != authnState.browserNonce) {
            val errCode = "TyEIDTKNBADNONCE"
            val msg = s"Wrong OIDC id_token nonce, IDP: ${idp.protoAlias}"
            responseToBrowserPromise.failure(RespEx(BadGatewayResult(errCode, msg)))
            logger.warn(s"s$siteId: $msg, the nonce: $nonceOrNull [${errCode
                  }], id_token: '$idTokenSt'")
            return ()
          }


          // ----- Get id_token claims

          // Some IDPs, e.g. Azure AD, send all info in the id_token, and there's
          // no need to query the userinfo endpoint — in fact, Microsoft recommends
          // not calling the userinfo endpoint:
          // https://docs.microsoft.com/en-us/azure/active-directory/develop/userinfo#consider-use-an-id-token-instead
          // > we suggest that you use that ID token to get information about the user
          // > instead of calling the UserInfo endpoint. Using the ID token
          // > will eliminate one to two network requests

          parseOidcIdToken(decodedJwt, idp) match {
            case Good(userInfo: OpenAuthDetails) =>
              // If we have all we need already, skip the userinfo request
              // — Azure AD doesn't include any info in the userinfo response
              // that's not already included in the id_token.
              // (Read here about when an id_token must be verified: [when_chk_id_tkn].)
              val seemsLikeAzure = userInfo.idpRealmUserId.isDefined ||  // for now
                    idp.wellKnownIdpImpl.is(WellKnownIdpImpl.Azure)    // later
              if (seemsLikeAzure) {
                // Reply here already ...
                constructRedirBackResponseToBrowser(redirBackRequest, idp, authnState,
                      userInfo, responseToBrowserPromise)
                // ... and skip requestUserInfo() below.
                return ()
              }
              // Else: Fill in more info, by calling the userinfo endpoint, below.
              Some(userInfo)

            case Bad(errMsg) =>
              // Try the userinfo endpoint instead then? (just below)
              logger.warn(s"$siteId: id_token problem: $errMsg [TyEIDTKNWEIRID]")
              None
          }
        }

        requestUserInfo(accessToken, anyOidcIdToken, anyUserInfo)
      }
    })


    // ----- User info request

    // Now we have the access token (hopefully), and with it we can do
    // anything we requested (and that the user agreed to) in the  &scope=...
    // parameter in the initial browser auth redirect to the IDP auth server.
    //
    // All we want to do, though, is to fetch some user info data.
    // So, we'll call the user info endpoint.  And we'll include the access
    // token, so the auth server knows we are indeed allowed to access the
    // user-info data.
    //
    // The user-info endpoint and response is standardized if we're using OIDC
    // — otherwise, if just OAuth2, then it's IDP specific.

    def requestUserInfo(accessToken: sj_OAuth2AccessToken, anyIdToken: Opt[OidcIdToken],
          anyUserInfo: Opt[IdpUserInfo]) {
      val userInfoRequest = new sj_OAuthRequest(sj_Verb.GET, idp.oidcUserInfoUrl)

      // Some OAuth2 IDPs want extra headers — when it's not OIDC, it's non-standard.
      idp.wellKnownIdpImpl foreach {
        case WellKnownIdpImpl.LinkedIn =>
          userInfoRequest.addHeader("x-li-format", "json")
          userInfoRequest.addHeader("Accept-Language", "en-US") // I18N use the site lang?
        case _ =>
          // No extra headers needed.
      }

      authnService.signRequest(accessToken, userInfoRequest)

      doAuthnServiceRequest("user info", idp, siteId,
            authnService, userInfoRequest,
            (errorResponse: p_Result) => {
              responseToBrowserPromise.failure(RespEx(errorResponse))
            },
            (json: JsValue) => {
              handleUserInfoJson(
                    redirBackRequest, idp, json, siteId, anyUserInfo,
                    anyIdToken, authnState, authnService, accessToken,
                    responseToBrowserPromise)
            })
    }

    responseToBrowserPromise.future
  }



  private def handleUserInfoJson(redirBackRequest: GetRequest, idp: IdentityProvider,
          userInfJsVal: JsValue, siteId: SiteId, userInfoFromIdToken: Opt[IdpUserInfo],
          anyOidcIdToken: Opt[OidcIdToken],
          authnState: OngoingAuthnState, authnService: sj_OAuth20Service,
          accessToken: sj_OAuth2AccessToken, responseToBrowserPromise: Promise[p_Result])
          : U = {

    logger.debug(s"s$siteId: Got user info from ${idp.protoAlias}:  ${
          userInfJsVal.toString}")

    val json = userInfJsVal.asOpt[JsObject] getOrElse {
      responseToBrowserPromise.failure(RespEx(BadGatewayResult("TyEUSRJSN0OBJ",
            s"IDP user json is not an obj")))
      return
    }

    // Already checked in authnRedirBack().
    dieIf(authnState.authnViaSiteId != siteId, "TyEAUTSITEID003",
          s"Wrong authn site: $siteId, should be: ${authnState.authnViaSiteId}")
    dieIf(authnState.nextStep != "redir_back", "TyEAUTSITEID004",
          s"Wrong step: ${authnState.nextStep}")

    SHOULD // keep  userInfoFromIdToken,  and add more info to it,
    // rather than forgetting the info we have already from id_token

    var userInfo: IdpUserInfo = (idp.protocol match {
      // Some providers, e.g. Google, uses OIDC user info also for OAuth2 [goog_oidc]
      case ProtoNameOidc | ProtoNameOAuth2 if anyOidcIdToken.isDefined =>
        parseOidcUserInfo(json, idp)
      case ProtoNameOAuth2 =>
        parseCustomUserInfo(json, idp)
      case bad =>
        die("TyE5F5RKS56", s"Bad auth protocol: $bad")
    }) getOrIfBad { errMsg =>
      responseToBrowserPromise.failure(RespEx(BadGatewayResult("TyEUSRINFJSONUSE",
            s"Got invalid user json from IDP: ${errMsg}")))
      return
    }

    anyOidcIdToken foreach { idToken: OidcIdToken =>
      userInfo = userInfo.copy(idToken = Some(idToken.idTokenStr))
    }

    if (idp.wellKnownIdpImpl.isDefined) {
      // Fetch any missing profile info.  [oauth2_extra_req]
      // E.g. for LinkedIn and GitHub, need to fetch the verified email address (if any).
      WellKnownIdps.fetchAnyMissingUserInfo(userInfo, idp, siteId = siteId,
            authnService, accessToken,
            onError = (errorResponse: p_Result) => {
              responseToBrowserPromise.failure(RespEx(errorResponse))
            },
            onOk = (allDetails: OpenAuthDetails) => {
              constructRedirBackResponseToBrowser(
                    redirBackRequest, idp, authnState, allDetails,
                    responseToBrowserPromise)
            })
    }
    else {
      constructRedirBackResponseToBrowser(
            redirBackRequest, idp, authnState, userInfo, responseToBrowserPromise)
    }
  }



  private def constructRedirBackResponseToBrowser(redirBackRequest: GetRequest,
          idp: IdentityProvider, authnState: OngoingAuthnState,
          oauthDetails: OpenAuthDetails, responseToBrowserPromise: Promise[p_Result])
          : U = {

    val siteId = authnState.authnViaSiteId
    Validation.ifBadEmail(oauthDetails.email, siteId = siteId, problem => {
      responseToBrowserPromise.failure(ResultException(
            BadGatewayResult("TyEUSRINFJSONEML",
                s"Got an invalid email address from IDP: ${problem.message}")))
      return
    })

    val authnStateWithIdentity = authnState.copy(extIdentity = Some(oauthDetails))

    val response: p_Result = authnStateWithIdentity.continueAtOrigSiteNonce match {
      case Some(origSiteNonce) =>
        // We're currently at the authn site, having authenticated at the IDP here
        // at this site, on behalf of another site — now we need to redirect
        // back to that other site, the login-to site.

        val nextSecretNonce = nextRandomString()
        authnStateCache.put(nextSecretNonce, authnStateWithIdentity.copy(
              lastStepAt = globals.now(),
              nextStep = "finish_at_orig"))

        val continueAtLoginToSiteUrl =
              authnStateWithIdentity.loginToSiteOrigin +
                  routes.LoginWithOpenAuthController.finishAtOrigSite(nextSecretNonce)

        p_Results.Redirect(continueAtLoginToSiteUrl, status = p_Status.SEE_OTHER)

      case None =>
        // We're at the correct site already — didn't need to redirect to any
        // authn origin, and now won't need to redirect back.
        tryLoginOrShowCreateUserDialog(
              redirBackRequest, authnStateWithIdentity, anyCustomIdp = Some(idp))
    }

    responseToBrowserPromise.success(response)
  }



  def finishAtOrigSite(secretNonce: St): Action[U] = GetActionIsLogin {
        finishAtOrigSiteRequest: GetRequest =>

    import finishAtOrigSiteRequest.{dao, siteId}

    throwForbiddenIf(globals.anyLoginOrigin.isEmpty,
          "TyE0AUTORIG", "There's no authn origin site")

    val currState = getAuthnStateOrThrow(secretNonce, "finish_at_orig",
          loginToSiteId = siteId,
          loginToSiteOrigin = finishAtOrigSiteRequest.origin,
          maxAgeSeconds = Some(AFewSeconds)) // or "isInstantRedirect = true" ?

    // We don't actually need the start authn state for anything —
    // all we need is in currState. But we can look for maybe-bugs:

    // The orig state might be old, if the user stopped at the IDP
    // and e.g. read some ToU or Privacy Policy — so skip maxAgeSeconds.
    val startStateNonce = currState.continueAtOrigSiteNonce getOrDie "TyE305MRKR2"
    val startState = getAuthnStateOrThrow(startStateNonce, "org_site_start_state",
          loginToSiteId = siteId,
          loginToSiteOrigin = finishAtOrigSiteRequest.origin)

    // Check that we're back at the original site with the same authn state
    // as when we started — just that now we also have an identity,
    // which we got from the external Identity Provider, when authenticating
    // over there, via our authn origin.
    dieIf(startState.continueAtAuthnSiteNonce.isEmpty, "TyE5J40MSDK3")
    dieIf(startState.continueAtAuthnSiteNonce != currState.continueAtAuthnSiteNonce,
          "TyE052MRKJY2")
    dieIf(startState.continueAtOrigSiteNonce.isNot(startStateNonce), "TyE5J40MSDK3")
    dieIf(startState.stateString != currState.stateString, "TyE052MRKJY4")
    dieIf(startState.protocol != currState.protocol, "TyE052MRKJY5")
    dieIf(startState.providerAlias != currState.providerAlias, "TyE052MRKJY6")
    dieIf(startState.returnToUrl != currState.returnToUrl, "TyE052MRKJY7")
    dieIf(startState.browserNonce != currState.browserNonce, "TyE052MRKJY8")
    dieIf(startState.extIdentity.isDefined, "TyE052MRKJY9")
    dieIf(currState.extIdentity.isEmpty, "TyE052MRKJYA")

    val idp: IdentityProvider = getIdentityProvider(currState, dao)

    tryLoginOrShowCreateUserDialog(
          finishAtOrigSiteRequest, currState, anyCustomIdp = Some(idp))
  }



  def authnLogout(): Action[U] = AsyncGetActionIsLogin { request: GetRequest =>
    Future.successful(NotImplementedResult("TyEOIDCLGO", "Not implemented"))
    // TODO backchannel logout from  /-/logout ?
  }




  // ======================================================================
  //   Old, with Silhouette   =============================================
  // ======================================================================


  def startAuthentication(providerName: St, returnToUrl: Opt[St]): Action[U] =
        AsyncGetActionIsLogin { request =>
    startAuthenticationImpl(providerName, returnToUrl.trimNoneIfBlank, request)
  }


  private def startAuthenticationImpl(providerName: St, returnToUrl: Opt[St],
        request: GetRequest): Future[Result] = {

    globals.loginOriginConfigErrorMessage foreach { message =>
      throwInternalError("DwE5WKU3", message)
    }

    var futureResult = startOrFinishAuthenticationWithSilhouette(providerName, request)
    if (returnToUrl.isDefined) {
      futureResult = futureResult map { result =>
        result.withCookies(
          // CLEAN_UP use OAuth2 state instead? skip the cookie.
          // That's how the new OIDC code (above) works instead, already.
          // Can save the returnToUrl in mem cache, also if redirs to login origin?
          SecureCookie(name = ReturnToUrlCookieName,
                value = returnToUrl.get, httpOnly = false))
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


  def finishAuthentication(providerName: St): Action[U] = AsyncGetActionIsLogin { request =>
    import controllers.Utils.ValidationImplicits._ // getFirst

    // Maybe we're migrating to ScribeJava? And use this endpoint only for
    // backwards compatibility, so all admins won't need to update their
    // OAuth2 redirection URIs right now. Then, jump to the ScribeJava code instead.
    val anyState = request.queryString.getFirst("state")
    if (anyState.exists(_.endsWith("_scribejava_"))) {   // [migr_to_scribejava]
      val anyCode = request.queryString.getFirst("code")
      val anySessionState = request.queryString.getFirst("session_state")
      authnRedirBackImpl(ProtoNameOAuth2, providerAlias = providerName,
            state = anyState.get, session_state = anySessionState, code = anyCode.getOrElse(""),
            request)
    }
    else {
      startOrFinishAuthenticationWithSilhouette(providerName, request)
    }
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
    throwForbiddenIf(settings.useOnlyCustomIdps,
      "TyECUIDPDEFOAU", o"""Default OpenAuth authentication disabled,
        when using only site custom IDP""")

    // This'll break Twitter authn, until they support OAuth2.
    throwForbiddenIf(globals.config.featureFlags.contains("ffSilhouetteOff"),
           "TyEOLDAUTHNOFF",
           o"""Login with $providerName disabled for now. Can you please login
              via email address instead? — Click 'Did you forget your password?'
              in the login dialog.  Or email:  ${
              globals.securityComplaintsEmailAddress} for help""")

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

    UX; COULD // handle 429 resource exhausted from an OAuth provider in a better way?:
    //  {"severity":"ERROR","context":{"reportLocation":{"filePath":
    //  "LoginWithOpenAuthController.scala","lineNumber":223, "functionName":"applyOrElse","className":
    //    "controllers.LoginWithOpenAuthController$$anonfun$startOrFinishAuthenticationWithSilhouette$14"}},
    //    "message":"Error during OAuth2 authentication with Silhouette [TYE0AUUNKN]
    //       \ncom.mohiva.play.silhouette.impl.exceptions.ProfileRetrievalException:
    //       [Silhouette][google] Error retrieving profile information.
    //      Error code: 429, message: Resource has been exhausted (e.g. check quota).
    //      \n\tat com.mohiva.play.silhouette.impl.providers.oauth2.BaseGoogleProvider
    //         .$anonfun$buildProfile$1(GoogleProvider.scala:69)\n\tat  ... }

    provider.authenticate()(request.request) flatMap {  // (529JZ24)
      case Left(result) =>
        // We're starting authentication.
        Future.successful(result)
      case Right(authInfo) =>
        // We're finishing authentication.
        val futureProfile: Future[SocialProfile] = provider.retrieveProfile(authInfo)
        futureProfile flatMap { profile: SocialProfile =>   // TalkyardSocialProfile?  (TYSOCPROF)
          Future.successful(
                handleAuthenticationData(request, profile, providerName))
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


  private def handleAuthenticationData(request: GetRequest, profile: SocialProfile,
        providerName: St): Result = {
    import request.{dao, siteId}
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
      return Forbidden(errorMessage).discardingCookies(
          DiscardingSecureCookie(ReturnToSiteOriginTokenCookieName),
          DiscardingSecureCookie(ReturnToUrlCookieName))
    }

    REFACTOR; CLEAN_UP // stop using CommonSocialProfile. Use ExternalSocialProfile instead,  (TYSOCPROF)
    // it has useful things like username, about user text, etc.
    var oauthDetails = profile match {
      case p: CommonSocialProfile =>
        OpenAuthDetails(
          confFileIdpId = Some(p.loginInfo.providerID),
          idpUserId = p.loginInfo.providerKey,
          username = None, // not incl in CommonSocialProfile
          firstName = p.firstName,
          lastName = p.lastName,
          fullName = p.fullName,
          email = p.email,
          avatarUrl = p.avatarURL)
      case p: ExternalSocialProfile =>
        OpenAuthDetails(
          confFileIdpId = Some(p.providerId),
          idpUserId = p.providerUserId,
          username = p.username,
          firstName = p.firstName,
          lastName = p.lastName,
          fullName = p.fullName,
          email = if (p.primaryEmailIsVerified is true) p.primaryEmail else None,  // [7KRBGQ20]
          avatarUrl = p.avatarUrl)
    }

    // Don't know about Facebook. Twitter has no emails at all.
    // We currently use only verified email addresses, from GitHub. [7KRBGQ20]
    // Gmail addresses have been verified by Google.  [gmail_verifd]
    // Facebook? Who knows what they do.
    // LinkedIn: Don't know if the email has been verified; exclude LinkedIn here.
    if ((oauthDetails.confFileIdpId.is(GoogleProvider.ID) &&
            oauthDetails.email.exists(_ endsWith "@gmail.com"))
        || oauthDetails.confFileIdpId.is(GitHubProvider.ID)) {
      oauthDetails = oauthDetails.copy(isEmailVerifiedByIdp = Some(true))
      COULD // include  [known_verified_email_domains]  too.
    }

    val authnState = OngoingAuthnState(
          // Silhouette always uses the old site global IDPs from play-framework.conf.
          useServerGlobalIdp = true,
          authnXsrfToken = "",
          authnViaSiteId = siteId,  // for now, will delete all this later anyway
          loginToSiteId = NoSiteId, // we don't know
          loginToSiteOrigin = "",   // don't know
          protocol =
                if (providerName == TwitterProvider.ID) ProtoNameOAuth10a
                else ProtoNameOAuth2,
          providerAlias = providerName,
          // ----
          // isInLoginPopup, mayCreateUser and returnToUrl values are from cookies,
          // and are missing here, if we're at the authn origin — then we'll
          // get them in continueAtOriginalSite() instead, see "finish_at_orig__silhouette".
          isInLoginPopup = request.cookies.get(IsInLoginPopupCookieName).nonEmpty,
          mayCreateUser = !request.cookies.get(MayCreateUserCookieName).map(
                _.value).contains("false"),
          returnToUrl = anyReturnToUrl.getOrElse(""),
          // ----
          browserNonce = "",  // empty —> browser code skips check  [br_authn_nonce]
          createdAt = When.Genesis,
          stateString = "",
          oauth2StateUseCount = new j_AtomicInteger(1),
          extIdentity = Some(oauthDetails),
          lastStepAt = globals.now(),
          nextStep = "")  // filled in later

    val result = anyReturnToSiteOrigin match {
      case Some(originalSiteOrigin) =>
        val xsrfToken = anyReturnToSiteXsrfToken getOrDie "DwE0F4C2"
        val cacheKey = nextRandomString()
        authnStateCache.put(cacheKey, authnState.copy(nextStep = "finish_at_orig__silhouette"))
        val continueAtOriginalSiteUrl =
          originalSiteOrigin + routes.LoginWithOpenAuthController.continueAtOriginalSite(
                cacheKey, xsrfToken)
        Redirect(continueAtOriginalSiteUrl)
          .discardingCookies(DiscardingSecureCookie(ReturnToSiteOriginTokenCookieName))

      case None =>
        tryLoginOrShowCreateUserDialog(request, authnState)
    }

    result
  }




  // ======================================================================
  //   After authn at IDP
  // ======================================================================


  // ------ Login, link accounts, or create new user:


  private def tryLoginOrShowCreateUserDialog(
        request: GetRequest,
        authnState: OngoingAuthnState,
        anyCustomIdp: Opt[IdentityProvider] = None): p_Result = {

    import request.{dao, siteId}

    val siteSettings = dao.getWholeSiteSettings()

    throwForbiddenIf(siteSettings.enableSso,
          "TyESSO0OAUTHLGI", "OpenAuth login disabled, because SSO enabled")

    if (siteSettings.useOnlyCustomIdps) {
      throwForbiddenIf(anyCustomIdp.isEmpty,
            "TyECUIDPOAULGI",
            s"Server default authentication with ${authnState.protoAlias
                } is disabled — using only site custom IDP")
      throwForbiddenIf(anyCustomIdp.exists(!_.isSiteCustom), "TyE305MRK24B",
            s"Not a site custom IDP: ${anyCustomIdp.map(_.protoAlias)}")
    }

    val oauthDetails: OpenAuthDetails = authnState.extIdentity.getOrThrowForbidden(
          "TyE305MRKGM2", "No cached ext identity")

    throwForbiddenIf(authnState.loginToSiteId != NoSiteId &&
              authnState.loginToSiteId != siteId, "TyEORGSITEID004",
          s"Logging in to wrong site: $siteId, should be: ${authnState.loginToSiteId}")

    if (anyCustomIdp.isEmpty) {
      // Old Silhouette code — skip the below check then.
      // Done in continueAtOriginalSite().
    }
    else {
      checkAuthnXsrfToken(authnState.authnXsrfToken, request)
    }

    val loginAttempt = OpenAuthLoginAttempt(
      ip = request.ip, date = globals.now().toJavaDate, oauthDetails)

    val mayCreateNewUser = authnState.mayCreateUser && {
      // This not needed? Already incl in authnState for all code paths, right.
      val mayCreateNewUserCookie = request.cookies.get(MayCreateUserCookieName)
      !mayCreateNewUserCookie.map(_.value).contains("false")
    }

    // COULD let tryLogin() return a LoginResult and use pattern matching, not exceptions.
    //var showsCreateUserDialog = false

    val result = dao.tryLoginAsMember(loginAttempt) match {
      case Good(loginGrant) =>
        createCookiesAndFinishLogin(request, dao.siteId, loginGrant.user,
              authnState = authnState)
      case Bad(problem) =>
        if (authnState.usesServerGlobalIdp) {
          // Is it Twitter? No more Twitter accounts allowed, or linking a Twitter
          // account to any existing account.  Twitter uses OAuth 1.0a which Talkyard
          // won't support once done migrating from Silhouette to ScribeJava.
          // Instead, let's wait for Twitter to start supporting OAuth2.
          if (authnState.providerAlias == TwitterProvider.ID) {
            throwForbiddenIf(globals.config.featureFlags.contains("ffTwitterSignUpOff"),
                  "TyE0TWITTERACCTS", o"""You cannot sign up via Twitter,
                  until Twitter supports OAuth2. Might take years, sorry.""")
          }
        }

        // For now. Later, anyException will disappear.
        if (problem.anyException.isEmpty) {
          // This currently "cannot" happen. [6036KEJ5]
          throwInternalError(
            "TyEUNEXEXC", s"Error logging in: ${problem.message}")
        }
        else problem.anyException.get match {
          case DbDao.IdentityNotFoundException =>
            // Let's check if the user already exists, and if so, create a IDP identity
            // and link it to the user.
            // Details: The user might exist, although no identity was found, if
            // the user has already 1) signed up as an email + password user,
            // or 2) accepted an invitation (when the user clicks the invitation
            // link in the invite email, a user account is created automatically,
            // without the user having to login).
            // Or 3) signed up via an external IDP identity, say, Twitter or FB,
            // that uses a, say, Google email address, like user@some.gsuite.domain
            // or gmail.com, and now later attempts to log in via the Google
            // email address instead of via Twitter or FB  — that is,
            // mixes [identities from different IDPs] that use the same
            // email address.

            // Save canonical email? [canonical-email]

            // (Could ask if the user wants to continue using the email
            // address and preferred username etc, from the IDP.
            // Or if hen wants to, say, use a different email address.
            // But no one has asked about such a feature, so skip for now.)

            // Maybe always verify any email addr provided by the IDP,  [email_privacy]
            // before loading member by username or email addr?
            // So an attacker cannot figure out if there's already an account
            // with the email hen specified — unless it's the attacker's own email.
            // Currently one has to use the email from the IDP anyway,
            // if it's been verified by the IDP.  [use_idp_email]

            BUG // loadMemberByEmailOrUsername() won't load any secondary  [2nd_email]
            // email addresses that has been verified — still, such an address
            // causes a unique key error, later when upserting the new user
            // (if its verified email addr is the same addr),
            // the db constraint: useremails_email_verified_u.
            oauthDetails.email.flatMap(dao.loadMemberByEmailOrUsername) match {
              case Some(user) =>
                val nextAuthnState = authnState.copy(matchingTyUser = Some(user))
                if (oauthDetails.isEmailVerifiedByIdp isNot true) {
                  verifyEmailAddrThenAskIfLinkIdentityToUser(nextAuthnState, request)
                }
                else {
                  askIfLinkIdentityToUser(nextAuthnState, request)
                }
              case None =>
                // Create new account?

                throwForbiddenIf(!siteSettings.allowSignup,
                    "TyE0SIGNUP02A", "Creation of new accounts is disabled")

                // Better let a site specific IDP check email domains itself?
                // Dupl check [alwd_eml_doms]
                throwForbiddenIf(!oauthDetails.isSiteCustomIdp &&
                      !siteSettings.isEmailAddressAllowed(
                          oauthDetails.emailLowercasedOrEmpty),
                      "TyEBADEMLDMN_-OAUTH_", o"""You cannot sign up with this email
                          address: '${oauthDetails.emailLowercasedOrEmpty}'""")

                UX; COULD // show a nice error dialog instead.
                UX; COULD // show identity provider name.
                throwForbiddenIf(!mayCreateNewUser, "DwE5FK9R2",
                      o"""Access denied. You don't have an account at this site
                      via that identity provider. And you may not
                      create a new account to access this resource.""")

                //showsCreateUserDialog = true
                showCreateUserDialog(request, authnState)
            }

          case ex: QuickMessageException =>
            logger.warn(s"Deprecated exception [TyEQMSGEX03]", ex)
            throwForbidden("TyEQMSGEX03", ex.getMessage)

          case ex: Exception =>
            logger.error(s"Unexpected exception [TyEQMSGEX04]", ex)
            throwInternalError("TyEQMSGEX03", ex.getMessage)
        }
    }

    // COULD avoid deleting cookies if we have now logged in (which we haven't, if
    // the create-user dialog is shown: showsCreateUserDialog == true). Otherwise,
    // accidentally reloading the page, results in weird errors, like the xsrf token
    // missing. But supporting page reload here requires fairly many mini fixes,
    // and maybe is marginally worse for security? since then someone else,
    // e.g. an "evil" tech support person, can ask for and reuse the url?
    result.discardingCookies(CookiesToDiscardAfterLogin: _*)
  }



  // ------ Login directly


  private def createCookiesAndFinishLogin(
        request: DebikiRequest[_], siteId: SiteId, member: User,
        authnState: OngoingAuthnState): Result = {

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
        // We're handling a create-user Ajax request from a showCreateUserDialog()
        // client side dialog. It already knows about any pending redirects.
        // See: handleCreateUserResponse() in client/app-more/.
        // (If getting logged in directly, `request` wouldn't be Ajax — instead,
        // it'd be a load-whole-html-page GET request, after having gotten
        // redirected back from the IDP.)
        //
        OkSafeJson(Json.obj(  // ts: AuthnResponse
          // Remove `origNonceBack` from here? Already checked before showing
          // the create user dialog:  create-user-dialog.more.ts  [br_authn_nonce].
          "origNonceBack" -> JsString(authnState.browserNonce),
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

        CSP_MISSING
        def handleResultInWinOpener: p_Result =
          Ok(views.html.authn.sendAuthnResultToOpenerCloseCurWin(
                origNonceBack = authnState.browserNonce,
                weakSessionId = weakSessionIdOrEmpty).body) as HTML // [NOCOOKIES]

        val returnToUrl: St = authnState.returnToUrl  // [49R6BRD2]
        if (returnToUrl.startsWith(
              LoginWithPasswordController.RedirectFromVerificationEmailOnly)) {
          // We are to redirect only from new account email address verification
          // emails, not from here.

          // But if we're in a login window, there's no window.opener, so
          // window.opener.debiki.internal.handleLoginResponse(..) would fail,
          // here: [login_cont_in_opnr], right?
          // Hmm but this bug-warn fails (!), although everything works fine.
          //bugWarnIf(!authnState.isInLoginPopup, "TyEWINOPNR5",
          //      s"s$siteId: In login win w/o opener? But redir-from-email-only: $member")

          handleResultInWinOpener
        }
        else if (authnState.isInLoginPopup) {
          // Javascript in the popup will call handleLoginResponse() which calls
          // continueAfterLogin().
          handleResultInWinOpener
        }
        else {
          // Currently only happens in the create site wizard (right?), and this
          // redirects to the next step in the wizard.
          Redirect(returnToUrl)   // + origNonceBack
        }
      }

    response.withCookies(sidAndXsrfCookies: _*)
  }



  // ------ Link accounts


  private def verifyEmailAddrThenAskIfLinkIdentityToUser(
          authnState: OngoingAuthnState, request: GetRequest): p_Result = {
    import request.{dao, siteId}

    val identity = authnState.extIdentity getOrDie "TyE5R7KG01"
    val user = authnState.matchingTyUser getOrDie "TyE305KG02"

    val emailToVerify = identity.email.getOrDie(
          "TyE40BKSRT53", s"s$siteId: No email: $identity")

    // But what about secondary addresses?  [2nd_email]
    dieIf(emailToVerify != user.primaryEmailAddress, "TyE39TKRSTRS20")

    val expMins = MaxEmailSecretLinkAgeMinutes
    val secretNonce = nextRandomString()
    authnStateCache.put(secretNonce, authnState.copy(nextStep = "ask_if_link"))

    COULD // use Redis instead
    //dao.redisCache.saveOneTimeSecretKeyVal(
    //      emailVerifSecret,  ...serialize-to-json..., expSecs = expMins * 60)

    val subject = "Verify your email address" // I18N
    val emailVerifUrl =
          originOf(request) +
          controllers.routes.LoginWithOpenAuthController.verifyEmailAskIfLinkAccounts(
              secretNonce).url
    val email = Email(
          EmailType.LinkAccounts,
          createdAt = globals.now(),
          sendTo = user.primaryEmailAddress,
          toUserId = Some(user.id),
          subject = s"[${dao.theSiteName()}] $subject",
          bodyHtmlText = _ => {
            views.html.login.verifyYourEmailAddrEmail(
                  name = user.nameOrUsername,
                  siteAddr = request.host,
                  emailVerifUrl = emailVerifUrl).body
          })
    dao.saveUnsentEmail(email)
    globals.sendEmail(email, dao.siteId)

    // + origNonceBack, would be good to check the nonce browser side,   [br_authn_nonce]
    // before sending the email?

    CSP_MISSING
    Ok(views.html.login.verifyYourEmailAddr(
          tpi = SiteTpi(request,
                // Not yet translated, no RTL support, so pretend is adm area —> English
                isAdminArea = true),
          subject = subject,
          emailToVerify = emailToVerify,
          expMins = expMins))
  }


  def verifyEmailAskIfLinkAccounts(secretNonce: St): Action[U] =
          GetActionAllowAnyoneRateLimited(RateLimits.LinkExtIdentity) { request =>

    // Now we know the email addr belongs to the current end user
    // — so it's ok to link hens external IDP identity to the existing
    // Talkyard user account with the same email.
    // But we don't yet have any Talkyard account for the end user (we have
    // not yet linked the end user's identity to the Ty account) so we cannot
    // currently save in the database that the email has been verified.

    val authnState = getAuthnStateOrThrow(secretNonce, "ask_if_link",
          loginToSiteId = request.siteId)
    logger.info(s"Email verified, nonce: $secretNonce, who: ${authnState.toLogString}")
    askIfLinkIdentityToUser(authnState, request)
  }


  private def askIfLinkIdentityToUser(authnState: OngoingAuthnState,   // [ask_ln_acts]
          request: ApiRequest[_]): Result = {
    import request.dao

    val user = authnState.matchingTyUser getOrDie "TyE05MR202"
    val userInclDetails = dao.loadTheUserInclDetailsById(user.id)

    val identity = authnState.extIdentity getOrDie "TyE6MSK201"
    val idpName = dao.getIdentityProviderNameFor(identity)
          .getOrThrowForbidden("TyEIDPGONE3905", "Identity provider was just deleted?")

    val linkSecret = nextRandomString()
    authnStateCache.put(linkSecret, authnState.copy(
          lastStepAt = globals.now(),
          nextStep = "ans_link_q"))

    // `identity`s email has been verified. But:
    // Note that it's safest if the old account also has verified
    // the email address! So we know it's the same person.
    // Otherwise someone, Mallory, could sign up with
    // another person's, Vic's, email address, not verify it
    // (couldn't — not Mallory's addr) and then, when Vic later signs up,
    // Vic's IDP identity would get linked to Mallory's old account
    // — and Mallory could thereafter login as Vic!
    // That'd be an "Account fixation attack"? [act_fx_atk]
    // Reminds of session fixation (it's not a session though, but an
    // account, that the attacker has prepared).
    //
    // That's why we incl oldEmailVerified = ...  below.
    //
    CSP_MISSING
    Ok(views.html.login.askIfLinkAccounts(
          tpi = SiteTpi(request,
                // Not yet translated, no RTL support, so pretend is adm area —> English
                isAdminArea = true),
          origNonceBack = authnState.browserNonce,
          oldEmailAddr = user.primaryEmailAddress,
          oldEmailVerified = user.emailVerified,
          oldUsername = user.theUsername,
          createdOnDate = toIso8601Day(userInclDetails.createdAt.toJavaDate),
          newIdentityNameOrEmailOrId = identity.nameOrUsername.orElse(
                identity.email).getOrElse(identity.idpUserId),
          idpName = idpName,
          linkSecret = linkSecret))
  }


  def answerLinkAccounts: Action[JsonOrFormDataBody] = JsonOrFormDataPostAction(
        RateLimits.LinkExtIdentity, maxBytes = 200, allowAnyone = true,
        skipXsrfCheck = true, // the linkSecret input is enough
        ) { request =>
    import request.{dao, siteId}

    val choiceStr = request.body.getOrThrowBadReq("choice")
    val shallLink = choiceStr match {
      case "YesLn" => true
      case "NoCancel" => false
      case bad => throwBadParam("TyE305RKFDJ3", "choice", bad)
    }

    val linkSecret = request.body.getOrThrowBadReq("linkSecret")
    val authnState = getAuthnStateOrThrow(linkSecret, "ans_link_q", loginToSiteId = siteId)

    val matchingTyUser = authnState.matchingTyUser getOrDie "TyE004MKP202"
    val extIdentity = authnState.extIdentity getOrDie "TyE6M9MXK201"

    val tryLoginAgainUrl =
          originOf(request) +
          controllers.routes.LoginWithOpenAuthController.authnStart(
              protocol = authnState.protocol,
              providerAlias = authnState.providerAlias,
              returnToUrl = authnState.returnToUrl,
              nonce = authnState.browserNonce,
              useServerGlobalIdp =
                    if (authnState.useServerGlobalIdp) Some(true) else None,
              // If the user didn't want to link hens IDP identity to the Ty user,
              // then, tell the IDP to let the user choose a different identity,
              // over at the IDP, so won't get the link-to-this-identity-to-that-user
              // question again.
              selectAccountAtIdp = Some(!shallLink)).url

    val idpName = dao.getIdentityProviderNameFor(extIdentity) getOrThrowForbidden(
          "TyEIDPGONE", s"IDP gone: ${extIdentity.prettyIdpId}")

    if (!shallLink) {
      // Send the user back to the IDP authn page, where hen can login
      // using a different IDP account or maybe create a new account.
      // What else is there to do?
      CSP_MISSING
      Ok(views.html.login.accountsNotLinkedPleaseLoginAgain(
            tpi = SiteTpi(request,
                // Not yet translated, no RTL support, so pretend is adm area —> English
                isAdminArea = true),
            origNonceBack = authnState.browserNonce,
            tryLoginAgainUrl = tryLoginAgainUrl,
            idpName = idpName))
    }
    else {
      // Don't login — it's better to ask hen to try again, so hen will notice
      // immediately if won't work, rather than some time later, when hen
      // has forgotten that hen (tried to) link the accounts, and cannot provide
      // the support staff with any meaningful info other than "it not work"?
      // (Also, could logging in here enable xsrf login attacks?)

      dao.saveIdentityLinkToUser(extIdentity, matchingTyUser)

      CSP_MISSING
      Ok(views.html.login.accountsLinkedPleaseLoginAgain(
            tpi = SiteTpi(request,
                // Not yet translated, no RTL support, so pretend is adm area —> English
                isAdminArea = true),
            origNonceBack = authnState.browserNonce,
            tryLoginAgainUrl = tryLoginAgainUrl,
            idpName = idpName))
    }
  }



  // ------ Create new user


  private def showCreateUserDialog(request: GetRequest, authnState: OngoingAuthnState)
          : Result = {
    import request.dao
    val oauthDetails: OpenAuthDetails = authnState.extIdentity getOrDie "TyE503MRKGGM"
    val idpName = dao.getIdentityProviderNameFor(oauthDetails)
          .getOrThrowForbidden("TyEIDPGONE3907", "Identity provider just deleted?")

    val nextNonce = nextRandomString()
    authnStateCache.put(nextNonce, authnState.copy(nextStep = "create_user"))

    val anyIsInLoginWindowCookieValue = request.cookies.get(IsInLoginWindowCookieName).map(_.value)

    val result = if (anyIsInLoginWindowCookieValue.isDefined) {
      // Continue running in the login window, by returning a complete HTML page that
      // shows a create-user dialog. (This happens if 1) we're in a create site
      // wizard, then there's a dedicated login step in a login window,
      // or 2) we're logging in to the admin pages, or 3) when logging in to a
      // login required site, or 4) we're visiting an embedded comments
      // site and attempted to login, then a login popup window opens (better than
      // showing a login dialog somewhere inside the iframe). ))
      CSP_MISSING
      Ok(views.html.authn.showCreateUserDialogInThisWin(
        SiteTpi(request, isAdminArea = authnState.isAdminArea),
        origNonceBack = authnState.browserNonce,
        idpName = idpName,
        idpHasVerifiedEmail = oauthDetails.isEmailVerifiedByIdp.is(true),
        serverAddress = s"//${request.host}",
        newUserUsername = oauthDetails.username getOrElse "",
        newUserFullName = oauthDetails.displayNameOrEmpty,
        newUserEmail = oauthDetails.emailLowercasedOrEmpty,
        authDataCacheKey = nextNonce,
        anyContinueToUrl = Some(authnState.returnToUrl)))
    }
    else {
      // The request is from an OAuth provider login popup. Run some Javascript in the
      // popup that continues execution in the main window (the popup's window.opener)
      // and closes the popup.  [2ABKW24T]
      CSP_MISSING
      Ok(views.html.authn.showCreateUserDialogInOpenerCloseCurWin(
        origNonceBack = authnState.browserNonce,
        idpName = idpName,
        idpHasVerifiedEmail = oauthDetails.isEmailVerifiedByIdp.is(true),
        newUserUsername = oauthDetails.username getOrElse "",
        newUserFullName = oauthDetails.displayNameOrEmpty,
        newUserEmail = oauthDetails.emailLowercasedOrEmpty,
        authDataCacheKey = nextNonce,
        anyContinueToUrl = Some(authnState.returnToUrl)))
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

    // A bit dupl code. [2FKD05]
    import request.{body, dao, siteId}

    val siteSettings = dao.getWholeSiteSettings()

    throwForbiddenIf(siteSettings.enableSso,
      "TyESSO0OAUTHNWUSR", "OpenAuth user creation disabled, because SSO enabled")
    // ... But `useOnlyCustomIdps` is fine — here's where we create users
    // via custom IDPs.
    throwForbiddenIf(!siteSettings.allowSignup,
      "TyE0SIGNUP04", "OpenAuth user creation disabled, because new signups not allowed")

    val fullName = (body \ "fullName").asOptStringNoneIfBlank
    val emailAddress = (body \ "email").as[St].trim
    val username = (body \ "username").as[St].trim
    // val anyReturnToUrl = (body \ "returnToUrl").asOpt[String]  CLEAN_UP REMOVE client side
    val secretNonce = (body \ "authDataCacheKey").asOpt[St]
          .getOrThrowBadRequest("TyE08GM6", "Authn state secret nonce missing")

    // Don't invalidate the nonce here — keep the authn state in the cache,
    // until we're done with this create-user dialog, so one can retry,
    // e.g. if typing a username that is in use already.
    // (We're done already with the authn over at the IDP and should be ok
    // to reuse the same nonce here — direct client-server communication,
    // nothing else involved.)
    val authnState = getAuthnStateOrThrow(
          secretNonce, "create_user", loginToSiteId = siteId, keepStateInCache = true)
    /* UX: A more user friendly message? Like:
        throwForbidden("DwE50VC4", o"""Bad auth data cache key — this happens if you wait
             rather long (many minutes) with submitting the dialog.
             Or if the server was just restarted. Please try to sign up again.""")
    */

    val oauthDetails = authnState.extIdentity getOrDie "TyE305MRKDM2"

    val emailVerifiedAt = oauthDetails.email flatMap { emailFromIdp =>
      // [use_idp_email]
      throwForbiddenIf(emailFromIdp.toLowerCase != emailAddress, "TyE523FU2",
            o"""When signing up, currently you cannot change your email address
            from the one you use at ${oauthDetails.confFileIdpId}, namely: ${
            oauthDetails.email}""")

      if (oauthDetails.isEmailVerifiedByIdp is true) {
        // However we don't know how long ago the IDP verified the email.
        Some(request.ctime)
      }
      else {
        None
      }
    }

    // IDPs can check email domains themselves.  Dupl check [alwd_eml_doms]
    throwForbiddenIf(!oauthDetails.isSiteCustomIdp &&
          !siteSettings.isEmailAddressAllowed(emailAddress),
          "TyEBADEMLDMN_-OAUTHB", "You cannot sign up using that email address")

    // More dupl code. [2FKD05]

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
        val (identity, userInclDetails) = dao.saveIdentityCreateUser(
              userData, request.theBrowserIdData)

        val newMember = userInclDetails.briefUser
        val loginGrant = MemberLoginGrant(
              Some(identity), newMember, isNewIdentity = true, isNewMember = true)

        dieIf(newMember.emailVerifiedAt != emailVerifiedAt, "EdE2WEP03")
        if (emailAddress.nonEmpty && emailVerifiedAt.isEmpty) {
          TESTS_MISSING
          val email = LoginWithPasswordController.createEmailAddrVerifEmailLogDontSend(
              newMember, Some(authnState.returnToUrl), request.host, request.dao)
          globals.sendEmail(email, dao.siteId)
        }

        if (emailVerifiedAt.isDefined || siteSettings.mayPostBeforeEmailVerified) {
          createCookiesAndFinishLogin(request, request.siteId, loginGrant.user,
                authnState)
        }
        else {
          // This'll show a "Verify your email address — check your email inbox"
          // message or sth like that. [new_user_verif_eml]
          OkSafeJson(Json.obj(  // ts: AuthnResponse
            "origNonceBack" -> authnState.browserNonce,
            "userCreatedAndLoggedIn" -> JsFalse,
            "emailVerifiedAndLoggedIn" -> JsFalse))
        }
      }
      catch {
        case _: DbDao.DuplicateUsername =>
          // If also same email address:
          SHOULD // instead ask if link IDP identity to this account  [oidc_missing]
          throwForbidden(
              "DwE6D3G8", "Username already taken, please try again with another username")
        case _: DbDao.DuplicateUserEmail =>
          // If different username, but same email:
          SHOULD // support many users per email address, if mayPostBeforeEmailVerified.
          // Or:
          SHOULD // ask if link IDP identity to this account  [oidc_missing]
                // and use the username from this account instead.
          if (emailVerifiedAt.isDefined) {
            // The user has been authenticated, so it's okay to tell him/her about the email address.
            throwForbidden(
              "DwE4BME8", "You already have an account with that email address")
          }
          // Don't indicate that there is already an account with this email.
          LoginWithPasswordController.sendYouAlreadyHaveAnAccountWithThatAddressEmail(
            request.dao, emailAddress, siteHostname = request.host, siteId = request.siteId)
          OkSafeJson(Json.obj(  // ts: AuthnResponse
            "origNonceBack" -> authnState.browserNonce,
            "userCreatedAndLoggedIn" -> JsFalse,
            "emailVerifiedAndLoggedIn" -> JsFalse))
      }

      // Done creating user account. Won't need to submit the dialog again,
      // so forget the authn state.
      authnStateCache.invalidate(secretNonce)

      result.discardingCookies(CookiesToDiscardAfterLogin: _*)
    }
  }



  // Old: Silhouette:

  // ------ Login via Login Origin


  def makeAuthnXsrfToken(request: RequestHeader): (St, Cookie) = {
    // Parallel logins? Is the same user logging in in two browser tabs, at the same time?
    // People sometimes do, for some reason, and if that won't work, they sometimes contact
    // the Talkyard developers and ask what's wrong. Only to avoid these support requests,
    // let's make parallel login work, by including xsrf tokens from all such ongoing logins,
    // in the cookie value. [PRLGIN]
    val anyCookie = request.cookies.get(ReturnToThisSiteXsrfTokenCookieName)
    val oldTokens: Opt[St] = anyCookie.map(_.value)

    val newXsrfToken = nextRandomString()
    val newCookieValue = newXsrfToken + Separator + oldTokens.getOrElse("")

    val xsrfCookie = SecureCookie(name = ReturnToThisSiteXsrfTokenCookieName,
          value = newCookieValue, maxAgeSeconds = Some(LoginTimeoutMins * 60),
          httpOnly = false)

    (newXsrfToken, xsrfCookie)
  }


  /** Redirects to and logs in via anyLoginOrigin; then redirects back to this site, with
    * a session id and xsrf token included in the GET request.
    */
  private def loginViaLoginOrigin(providerName: St, request: RequestHeader)
        : Future[Result] = {
    val (newXsrfToken, xsrfCookie) = makeAuthnXsrfToken(request)
    val loginEndpoint =
      globals.anyLoginOrigin.getOrDie("TyE830bF1") +
        routes.LoginWithOpenAuthController.loginAtLoginOriginThenReturnToOriginalSite(
          providerName, returnToOrigin = originOf(request), newXsrfToken)
    Future.successful(Redirect(loginEndpoint).withCookies(xsrfCookie))
  }


  /** Logs in, then redirects back to returnToOrigin, and specifies xsrfToken to prevent
    * XSRF attacks and session fixation attacks.
    *
    * The request origin must be the anyLoginOrigin, because that's the origin that the
    * OAuth 1 and 2 providers supposedly have been configured to use.
    */
  def loginAtLoginOriginThenReturnToOriginalSite(providerName: String,
          returnToOrigin: String, xsrfToken: String): Action[Unit] =
        AsyncGetActionIsLogin { request =>

    // The actual redirection back to the returnToOrigin happens in handleAuthenticationData()
    // — it checks the value of the return-to-origin cookie.
    if (globals.anyLoginOrigin isNot originOf(request))
      throwForbidden(
        "DwE50U2", s"You need to login via the login origin, which is: `${globals.anyLoginOrigin}'")

    val futureResponse = startOrFinishAuthenticationWithSilhouette(providerName, request)
    futureResponse map { response =>
      response.withCookies(
        SecureCookie(name = ReturnToSiteOriginTokenCookieName, value = s"$returnToOrigin$Separator$xsrfToken",
          httpOnly = false))
    }
  }


  def checkAuthnXsrfToken(xsrfToken: St, request: GetRequest): U = {
    dieIf(xsrfToken.isEmpty, "TyE305MRG245")
    // oauthDetailsCacheKey might be a cache key Mallory generated, when starting a login
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
        val tokens: Seq[St] = xsrfCookie.value.split(Separator)
        val okToken = tokens.contains(xsrfToken)
        throwForbiddenIf(!okToken,
              "TyEOAUXSRFTKN", o"""Bad XSRF token, not included in the
                  $ReturnToThisSiteXsrfTokenCookieName cookie""")
      case None =>
        throwForbidden("TyE0OAUXSRFCO", s"No $ReturnToThisSiteXsrfTokenCookieName xsrf cookie",
            o"""You need to finish logging in within $LoginTimeoutMins minutes,
                once you've started logging in.  Feel free to try again.""")
    }
  }


  def continueAtOriginalSite(oauthDetailsCacheKey: St, xsrfToken: St): Action[U] =
        GetActionIsLogin { request =>

    checkAuthnXsrfToken(xsrfToken, request)

    var authnState = getAuthnStateOrThrow(oauthDetailsCacheKey, "finish_at_orig__silhouette")
    authnState = authnState.copy(
          isInLoginPopup =
              request.cookies.get(IsInLoginPopupCookieName).nonEmpty,
          mayCreateUser =
              !request.cookies.get(MayCreateUserCookieName).map(_.value).contains("false"),
          returnToUrl =
              request.cookies.get(ReturnToUrlCookieName).map(_.value) getOrElse "")

    tryLoginOrShowCreateUserDialog(request, authnState)
      .discardingCookies(DiscardingSecureCookie(ReturnToThisSiteXsrfTokenCookieName))
  }


  def getIdentityProvider(authnState: OngoingAuthnState, dao: SiteDao)
          : IdentityProvider = {
    import authnState.{protocol, providerAlias, protoAlias}
    if (authnState.usesSiteCustomIdp) {
      dao.getSiteCustomIdentityProviderByAlias(protocol, providerAlias)
                .getOrThrowForbidden(
                    "TyE0SITEIDP", s"No such site custom IDP: $protoAlias")
    }
    else {
      getServerGlobalIdentityProvider(authnState, dao).getOrIfBad(problem =>
            throwForbidden("TyEGETGLOBIDP02", problem))
    }
  }


  private def getServerGlobalIdentityProvider(authnState: OngoingAuthnState, dao: SiteDao)
          : IdentityProvider Or ErrMsg = {
    import authnState.{protocol, providerAlias, protoAlias}

    // Currently all server global IDPs happen to use OAuth2.
    throwForbiddenIf(protocol != ProtoNameOAuth2, "TyE0SRVDEFIDP01",
          s"No such server default IDP: $protoAlias")
    dieIf(!authnState.usesServerGlobalIdp, "TyE305MRAKTD35")

    // We'll check in the site settings if the server global IDP that pat wants
    // to login with, is actually enabled [ck_glob_idp_enb].
    // First, here: [glob_idp_enb_1], we check if the IDP is enabled
    // at the login-to site.  Then, here: [glob_idp_enb_2], we check if it's
    // enabled at the authn-via site.
    val siteSettings = dao.getWholeSiteSettings()

    // Use the Silhouette config — until done migrating all sites, incl
    // other people's self hosted sites.
    import talkyard.server.authn.{ServerDefIdpAliases => SDIA}
    var trustVerifiedEmailAddr = false
    var userInfoUrl: St = ""

    val providerImpl = WellKnownIdpImpl.fromName(protocol, providerAlias)
          .getOrDie("TyE3056MRKT2")
    dieIf(providerImpl.name != providerAlias, "TyE306MRKTD")  // for now

    val s: OAuth2Settings = providerImpl match {
      case WellKnownIdpImpl.Facebook =>
        if (!siteSettings.enableFacebookLogin) return Bad("Facebook login not enabled")
        // FB Graph API docs aobut this endpoint:
        // https://developers.facebook.com/docs/graph-api/reference/user
        // v9.0 is the latest version, as of 2020-11-12.
        // - There was previously a 'username' field, but it's deprecated since v2.0.
        // - 'profile_pic' requires a Page access token — else, FB replies Error 403
        //   and a FB specific code 210.
        // - What's 'picture'? Maybe same as some 'picture.type(some-size)'  ?
        // - What about 'link'?
        userInfoUrl = "https://graph.facebook.com/v9.0/me" +  // [fb_oauth_user_fields]
              "?fields=" +
                  "id,email,name,first_name,middle_name,last_name,gender," +
                  // 50x50 px, how large is 'medium' and 'large'?
                  "picture.type(small)" +
              // Tell Facebook to use HTTPS for pictures — so no mixed contents warnings.
              "&return_ssl_resources=1"
        facebookProvider().settings

      case WellKnownIdpImpl.GitHub =>
        if (!siteSettings.enableGitHubLogin) return Bad("GitHub login not enabled")
        // We fetch a verified email addr (if any) in an OAuth2 extra request.
        trustVerifiedEmailAddr = true // [gmail_verifd]
        val s = githubProvider().settings
        var url = s.apiURL getOrElse "https://api.github.com/user" // keep configurable
        url = url.trim()
        // Old uri param, nowadays Basic Auth header instead.
        val accessTokenQueryParam = "?access_token=%s"
        if (url.contains(accessTokenQueryParam)) {
          url = url.replaceAllLiterally(accessTokenQueryParam, "")
          /*
          if (!warnedAboutOldAuth) {
            warnedAboutOldAuth = true
            logger.warn(o"""Deprecated GitHub auth conf: Remove "$accessTokenQueryParam" from
                the  github.apiURL  config value, in  $ProdConfFilePath  [TyMGHBAUTDPR].""")
          }*/
        }
        userInfoUrl = url
        s

      case WellKnownIdpImpl.Google =>
        // Any better way to find out if enabled, than having a separate settings
        // field per IDP? There can be a hundred!? [oh_so_many_idps]
        if (!siteSettings.enableGoogleLogin) return Bad("Google login not enabled")
        // Google's OAuth2 impl returns user info in OIDC format. [goog_oidc]
        userInfoUrl = "https://www.googleapis.com/oauth2/v3/userinfo"
        trustVerifiedEmailAddr = true // [gmail_verifd]
        googleProvider().settings

      case WellKnownIdpImpl.LinkedIn =>
        // ScribeJava + LinkedIn example:
        // https://github.com/scribejava/scribejava/blob/master/scribejava-apis/src/test/java/com/github/scribejava/apis/examples/LinkedIn20Example.java
        if (!siteSettings.enableLinkedInLogin) return Bad("LinkedIn login not enabled")
        userInfoUrl = "https://api.linkedin.com/v2/me"
        linkedinProvider().settings

      case WellKnownIdpImpl.Twitter =>
        if (!siteSettings.enableTwitterLogin) return Bad("Twitter login not enabled")
        return Bad("Twitter authn not impl via ScribeJava [TyEAUTTWTSCRJVA]")
        // Won't work — Twitter uses OAuth1, but Ty only supports OAuth2 via ScribeJava:
        // twitterProvider().settings

      case _ =>
        return Bad(s"IDP not yet impl with ScribeJava: $protoAlias  [TyEGLOBIDPUNSUP]")
    }

    // The dummy_TyE... below aren't needed — the correct endpoints are
    // included in ScribeJava already.
    val idp = IdentityProvider(
          confFileIdpId = Some(providerAlias),
          protocol = protocol,
          alias = providerAlias,
          wellKnownIdpImpl = Some(providerImpl),
          enabled = true,
          displayName = Some(providerAlias),
          description = None,
          adminComments = None,
          trustVerifiedEmail = trustVerifiedEmailAddr,
          // Maybe set to "gmail.com" for Google? [gmail_verifd]
          emailVerifiedDomains = None,
          linkAccountNoLogin = false,
          guiOrder = None,
          syncMode = 1, // ImportOnFirstLogin
          oauAuthorizationUrl = "dummy_TyESRIBEJAVA01",
          oauAccessTokenUrl =  "dummy_TyESRIBEJAVA02",
          oidcUserInfoUrl =
                if (userInfoUrl.nonEmpty) userInfoUrl
                else s.apiURL.getOrThrowForbidden(
                      "TyE402MSR4Y", s"No user info URL configured for $protoAlias"),
          oidcUserInfoFieldsMap = None,
          oidcLogoutUrl = None,
          oauClientId = s.clientID,
          oauClientSecret = s.clientSecret,
          oauIssuer = None,
          oauAuthReqScope = s.scope,
          oauAuthReqHostedDomain = None,
          oidcUserinfoReqSendUserIp = None)

    Good(idp)
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
      secureCookie = globals.secure, httpOnlyCookie = true, expirationTime = 5.minutes),
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


case class ExternalSocialProfile(   // RENAME to ExternalIdentity? It's from an Identity Provider (IDP)
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
          // Delete this dupl [old_github_code] soon, hopefully DO_AFTER 2021-01-01  REMOVE

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

    // Delete this dupl [old_linkedin_code] later / soon. hopefully DO_AFTER 2021-01-01  REMOVE

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
