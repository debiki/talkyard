/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

import scala.collection.Seq
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.EdHttp._
import talkyard.server.spam.SpamChecker
import debiki.dao.SiteDao
import talkyard.server.{TyContext, TyController}
import talkyard.server.http._
import javax.inject.Inject
import org.scalactic.{Bad, Good}
import play.api.mvc._
import play.api.libs.json._
import talkyard.server.security.{EdSecurity, SidOk, XsrfOk}
import org.owasp.encoder.Encode
import talkyard.server.TyLogging
import talkyard.server.authn.LoginWithSecretController



/** Logs in users via username and password.
  */
class LoginWithPasswordController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) with TyLogging {

  RENAME // to  AuthnWithPassword

  import context.globals
  import context.security.createSessionIdAndXsrfToken


  def login: Action[JsValue] = PostJsonAction(
        RateLimits.Login, maxBytes = 1000, isLogin = true) { request =>

    import request.body

    val email: String = (body \ "email").as[String]
    val password: String = (body \"password").as[String]
    val anyReturnToUrl: Option[String] = (body \"returnToUrl").asOpt[String]

    val maybeCannotUseCookies =
      request.headers.get(EdSecurity.AvoidCookiesHeaderName) is EdSecurity.Avoid

    val site = globals.lookupSiteOrThrow(request.request)
    val dao = globals.siteDao(site.id)

    val (sid, xsrfToken, cookies) = _doLogin(request, dao, email, password)

    val response = anyReturnToUrl match {
      case None =>
        OkSafeJson({
          if (maybeCannotUseCookies)
            Json.obj(
                "weakSessionId" -> JsString(sid.value),               // [NOCOOKIES]
                "xsrfTokenIfNoCookies" -> JsString(xsrfToken.value))  // [emb_forum_xsrf_token]
          else
            Json.obj(
                "weakSessionId" -> JsString(""),
                "xsrfTokenIfNoCookies" -> JsString(""))
        })
      case Some(url) =>
        // (We aren't in an iframe — we don't login and *redirect* in iframes. So cookies
        // are 1st party cookies and should work.)
        Redirect(url)
    }

    response.withCookies(cookies: _*)
  }


  private def _doLogin(request: ApiRequest[_], dao: SiteDao, emailOrUsername: St, password: St)
        : (SidOk, XsrfOk, ImmSeq[Cookie]) = {
    val loginAttempt = PasswordLoginAttempt(
      ip = request.ip,
      date = request.ctime,
      emailOrUsername = emailOrUsername,
      password = password)

    def deny(debugCode: String) = throwForbidden(
      "_TyE403BPWD" + (if (globals.isProd) "" else s"-$debugCode"), "Bad username or password")

    // Someone might open a password login dialog, and submit a bit later
    // just after an admin has disabled password login. (A race.)
    val settings = dao.getWholeSiteSettings()
    throwForbiddenIf(settings.useOnlyCustomIdps, "TyEOAU0PW",
          "Password login disabled — login via custom IDP instead")
    throwForbiddenIf(settings.enableSso, "TyESSO0PWD01",
          "Password login disabled — Talkyard Single Sign-On API in use")

    // WOULD have `tryLogin` return a LoginResult and stop using exceptions!
    val loginGrant: MemberLoginGrant = dao.tryLoginAsMember(loginAttempt) getOrIfBad { problem =>
      // For now. Later, anyException will disappear.
      if (problem.anyException.isEmpty) {
        // Currently "cannot" happen [6036KEJ5].
        throwInternalError("TyE306KSD", s"Login problem: ${problem.message}")
      }
      problem.anyException.get match {
        case DbDao.NoSuchEmailOrUsernameException => deny("NO_MEM_W_EML")
        case DbDao.BadPasswordException => deny("BAD_PWD")
        case DbDao.IdentityNotFoundException => deny("IDTY_0_FOUND")
        case DbDao.UserDeletedException => deny("USR_DELD")
        case DbDao.MemberHasNoPasswordException =>
          // This'll open a dialog that tells the user to choose a password. [5WJBNR2]
          // (The message text "You haven't ..." will actually get ignored.)
          throwForbidden("_TyMCHOOSEPWD", "You haven't choosen a password yet")
        case DbDao.EmailNotVerifiedException =>
          throwForbidden("TyEEML0VERIF_", o"""You have not yet confirmed your email address.
            Please check your email inbox — you should find an email from us with a
            verification link; please click it.""")
        case ex: QuickMessageException =>
          logger.warn(s"Deprecated exception [TyEQMSGEX02]", ex)
          throwForbidden("TyEQMSGEX02", ex.getMessage)
      }
    }

    dao.pubSub.userIsActive(request.siteId, loginGrant.user, request.theBrowserIdData)
    val (sid: SidOk, xsrfToken: XsrfOk, sidAndXsrfCookies) =
          createSessionIdAndXsrfToken(request, loginGrant.user.id)
    (sid, xsrfToken, sidAndXsrfCookies)
  }


  def handleCreateUserDialog: Action[JsValue] = AsyncPostJsonAction(
        RateLimits.CreateUser, maxBytes = 1000,
        // COULD set isLogin (or isLoginOrSignup)= true but currently that'd mean people
        // could sign up for SiteStatus.HiddenUnlessStaff/Admin. So, not right now.
        // Perhaps later though, if staff can be invited directly via invite emails. [5PY8FD2]
        allowAnyone = true) { request: JsonPostRequest =>

    // A bit dupl code. [2FKD05]
    import request.{body, dao}

    val fullName: Opt[St] = (body \ "fullName").asOptStringNoneIfBlank
    val anyEmailAddress: Opt[St] = (body \ "email").asOptStringNoneIfBlank
    val username: St = (body \ "username").as[String].trim
    val password: St = (body \ "password").asOpt[String] getOrElse
      throwBadReq("DwE85FX1", "Password missing")
    val anyReturnToUrl = (body \ "returnToUrl").asOpt[String]

    // Oddly enough, long ago I thought "" was better than None.  [silly_empty_email]
    // [Scala_3] Opaque type, check looks like an email ("...@...") and disallow Some("").
    val emailAddress = anyEmailAddress.getOrElse("")

    val maybeCannotUseCookies =
      request.headers.get(EdSecurity.AvoidCookiesHeaderName) is EdSecurity.Avoid

    val siteSettings = dao.getWholeSiteSettings()

    val itsDisabled = "Creation of local password accounts is disabled"
    throwForbiddenIf(siteSettings.enableSso, "TyESSO0PW", itsDisabled +
          ", because Single Sign-On is enabled")
    throwForbiddenIf(siteSettings.useOnlyCustomIdps, "TyECUSTIDP0PW", itsDisabled +
          " — using only site custom IDP")
    throwForbiddenIf(!siteSettings.allowSignup, "TyE0SIGNUP01",
          "Creation of new accounts is disabled")
    throwForbiddenIf(!siteSettings.allowLocalSignup, "TyE0LCALSIGNUP", itsDisabled)
    throwForbiddenIf(!siteSettings.isEmailAddressAllowed(emailAddress),
          "TyEBADEMLDMN_-PW_", "You cannot sign up using that email address")

    val becomeOwner = LoginController.shallBecomeOwner(request, emailAddress)

    // If the server was just installed, and this is the first site being created, then the admin's
    // email address was specified in the config file, in the talkyard.becomeOwnerEmailAddress conf val,
    // and the current user, is the person that installs the software, probably root on the host OS.
    // Let's assume hens email is correct (after all, hen typed it twice — also in the signup
    // dialog in the browser), and send no verification email because at this point
    // no email server has been configured (see the installation instructions in
    // modules/ed-prod-one-test/README.md).
    val isServerInstaller = request.siteId == FirstSiteId && becomeOwner
    val requireVerifiedEmail = (becomeOwner || siteSettings.requireVerifiedEmail) && !isServerInstaller

    val mayPostBeforeEmailVerified = !becomeOwner && siteSettings.mayPostBeforeEmailVerified

    // More dupl code. [2FKD05]

    if (!requireVerifiedEmail && emailAddress.isEmpty) {
      // Fine. If needn't verify email, then people can specify non-existing addresses,
      // so then we might as well accept no-email-at-all. [users_w_0_email]
    }
    else if (emailAddress.isEmpty) {
      throwUnprocessableEntity("EdE1GUR0", "Email address missing")
    }
    else {
      anyEmailAddressError(emailAddress) foreach { errMsg =>
        throwUnprocessableEntity("TyEBADEMLADR_-PWD", s"Bad email address: $errMsg")
      }
    }

    if ( talkyard.server.security.ReservedNames.isUsernameReserved(username))  // [5LKKWA10]
      throwForbidden("EdE5PKW01", s"Username is reserved: '$username'; choose another username")

    val spamCheckTask = SpamCheckTask(
      createdAt = globals.now(),
      siteId = request.siteId,
      postToSpamCheck = None,
      reqrId = request.requesterOrUnknown.id,
      requestStuff = request.spamRelatedStuff.copy(
        userName = Some((username + " " + fullName.getOrElse("")).trim),
        userEmail = anyEmailAddress,
        userTrustLevel = Some(TrustLevel.NewMember)))

    globals.spamChecker.detectRegistrationSpam(spamCheckTask) map {
          spamCheckResults: SpamCheckResults =>
      SpamChecker.throwForbiddenIfSpam(spamCheckResults, "TyEPWREGSPM_")

      // Password strength tested in createPasswordUserCheckPasswordStrong() below.

      val now = globals.now()
      val emailVerifiedAt =
        if (isServerInstaller && emailAddress.nonEmpty) {
          // Then email settings probably not yet configured, cannot send verification email.
          // The address has been typed manually twice already — let's assume it's correct
          // (for now at least).
          Some(now)
        }
        else None

      val userData =  // [5LKKWA10]
        NewPasswordUserData.create(
              name = fullName, email = emailAddress, username = username,
              password = Some(password), createdAt = now,
              isAdmin = becomeOwner, isOwner = becomeOwner,
              emailVerifiedAt = emailVerifiedAt,
              requireVerifiedEmail = requireVerifiedEmail) match {
          case Good(data) => data
          case Bad(errorMessage) =>
            throwUnprocessableEntity("DwE805T4", s"$errorMessage, please try again.")
        }

      val (anySid: Opt[SidOk], anyXsrfToken: Opt[XsrfOk], loginCookies: List[Cookie]) = try {
        val newMember = dao.createPasswordUserCheckPasswordStrong(userData, request.theBrowserIdData)
        if (newMember.email.nonEmpty && !isServerInstaller) {
          sendEmailAddressVerificationEmail(newMember, anyReturnToUrl, request.host, request.dao)
        }
        if (newMember.email.nonEmpty && !mayPostBeforeEmailVerified && !isServerInstaller) {
          TESTS_MISSING // no e2e tests for this
          // Apparently the staff wants to know that all email addresses actually work.
          // (But if no address specifeid — then, just below, we'll log the user in directly.)
          (None, None, Nil)
        }
        else {
          dieIf(newMember.email.isEmpty && requireVerifiedEmail, "EdE2GKF06")
          dao.pubSub.userIsActive(request.siteId, newMember, request.theBrowserIdData)
          val (sid: SidOk, xsrfToken: XsrfOk, sidAndXsrfCookies) =
                createSessionIdAndXsrfToken(request, newMember.id)
          (Some(sid), Some(xsrfToken), sidAndXsrfCookies)
        }
      }
      catch {
        case _: DbDao.DuplicateUsername =>
          throwForbidden(
            "DwE65EF0", "Username already taken, please try again with another username")
        case _: DbDao.DuplicateUserEmail =>
          // Send account reminder email. But don't otherwise indicate that the account exists,
          // so no email addresses are leaked.
          LoginWithPasswordController.sendYouAlreadyHaveAnAccountWithThatAddressEmail(
                dao, emailAddress, siteHostname = request.host, siteId = request.siteId)
          (None, Nil)
      }

      val (weakSessionId: St, xsrfToken: St) =
        if (maybeCannotUseCookies) {
          // If pat is now logged in, we need to incl the sid-parts-1-and-2 and the xsrf-token
          // in the json, since the browser can't access or send-them-back via cookies.
          //
          // But if anySid is absent because one needs to verify one's email before logging in,
          // and this is for embedded blog comments, and 3rd party cookies are blocked — then,
          // when one clicks the verify-email-address link, one will get redirected
          // back to the blog, with a one-time-login-secret included the hash fragment.
          // Talkyard's javascript on the embedding blog post page then sends this secret
          // to the iframe, which sends it to the server, and gets back a session id
          // — without logging in again. [TyT072FKHRPJ5]
          //
          (anySid.map(_.value).getOrElse(""),           // [NOCOOKIES]
              anyXsrfToken.map(_.value).getOrElse(""))  // [emb_forum_xsrf_token]
        }
        else {
          // The browser gets the sid and xsrf token in cookies, no need to incl in
          // the json response.
          ("", "")
        }

      val responseJson = Json.obj(  // ts: AuthnResponse
        "userCreatedAndLoggedIn" -> JsBoolean(loginCookies.nonEmpty),
        "emailVerifiedAndLoggedIn" -> JsBoolean(emailVerifiedAt.isDefined),
        "weakSessionId" -> JsString(weakSessionId),
        "xsrfTokenIfNoCookies" -> JsString(xsrfToken))

      COULD_OPTIMIZE // Clear login related cookies? [clear_aun_cookies]
      // Done already in the OAuth login controller; it clears these: CookiesToDiscardAfterLogin.

      OkSafeJson(responseJson).withCookies(loginCookies: _*)
    }
  }


  private def sendEmailAddressVerificationEmail(user: User, anyReturnToUrl: Opt[St],
          host: St, dao: SiteDao): U = {
    val email = LoginWithPasswordController.createEmailAddrVerifEmailLogDontSend(
      user, anyReturnToUrl, host, dao)
    globals.sendEmail(email, dao.siteId)
  }


  def confirmEmailAddressAndLogin(confirmationEmailId: String, returnToUrl: String): Action[Unit] =
        GetActionRateLimited(RateLimits.ConfirmEmailAddress, allowAnyone = true) { request =>
    import request.dao

    val userId = finishEmailAddressVerification(confirmationEmailId, request)
    val user = dao.getParticipant(userId) getOrElse {
      throwInternalError("DwE7GJ0", "I've deleted the account")
    }

    dao.pubSub.userIsActive(request.siteId, user, request.theBrowserIdData)

    // Log the user in. If hen is logging in from an embedding page,
    // e.g. a blog post that uses Talkyard for blog comments,
    // then create a one-time login secret and include in the url when
    // redirecting the user back to the blog post — Talkyard's
    // Javascript over at the blog will then handle login, there
    // (but setting a cookie directly for the Talkyard server won't work
    // on Safari or FF, because of ITP and ETP tracking prevention
    // that blocks cookies in iframes).

    val isOk = LoginWithSecretController.isAllowedRedirectUrl(
      returnToUrl, request.origin, request.siteSettings.allowEmbeddingFromBetter, globals.secure)

    throwForbiddenIf(!globals.isProd && !isOk,  // also see [306SKTGR43]
      "TyEEXTREDIR2", o"""Bad returnToUrl url: '$returnToUrl' — it's to a different server
          not in the Allow-Embedding-From list ( /-/admin/settings/embedded-comments ).
          This could be a phishing attempt.""")

    val returnToOtherServer =
      urlIsToDifferentOrigin(returnToUrl, thisServerOrigin = request.origin)

    val (newCookies, anyReturnToUrl) =
      if (returnToOtherServer) {
        // Talkyard is embedded somewhere? Then cookies generally won't work:
        // they'd be 3rd party, in an iframe, would get blocked by Safari and FF.
        // Tested here: [TyT072FKHRPJ5].
        dieIf(returnToUrl.isEmpty, "TyE06KFUD2")
        val loginSecret = nextRandomString()

        dao.redisCache.saveOneTimeLoginSecret(
          loginSecret, user.id, Some(globals.config.oneTimeSecretSecondsToLive))

        // This might result in two '#' in the URL (if there's a #comment-123 already),
        // should be fine. Don't include a real session id, instead, Talkyard
        // javascript on the destination page will send the one-time secret to
        // the server, and get back a session id. [306KUD244]
        (Nil, Some(returnToUrl + s"#talkyardOneTimeLoginSecret=$loginSecret"))
      }
      else {
        val (_, _, sidAndXsrfCookies) = createSessionIdAndXsrfToken(request, user.id)
        val anyReturnToUrl: Option[String] =
          if (returnToUrl.nonEmpty) Some(returnToUrl) else None
        (sidAndXsrfCookies, anyReturnToUrl)
      }

    val lang = dao.getWholeSiteSettings().languageCode
    val emailTexts = talkyard.server.emails.out.Emails.inLanguage(lang)
    CSP_MISSING
    Ok(emailTexts.welcomePage(SiteTpi(request), anyReturnToUrl))
          .withCookies(newCookies: _*)
  }


  private def finishEmailAddressVerification(emailId: String, request: ApiRequest[_]): UserId = {

    REFACTOR // A bit dupl code. [4KDPREU2]  looks 100% fine to break out fn, & place in UserDao.
    // and delete dao.verifyPrimaryEmailAddres(). [clean_up_emails]

    val email: EmailOut = request.dao.loadEmailCheckSecret(
          emailId, mustBeOfType = EmailType.VerifyAddress) .getOrIfBad { err =>
      throwForbidden("TyE2G60MEG", s"Error checking email verification link: $err")
    }

    val roleId = email.toUserId getOrElse {
      die("TyE8XK5", "Email was not sent to a role")
    }

    request.dao.verifyPrimaryEmailAddress(roleId, request.ctime)
    roleId
  }

}


object LoginWithPasswordController extends TyLogging {

  val RedirectFromVerificationEmailOnly = "_RedirFromVerifEmailOnly_"


  def createEmailAddrVerifEmailLogDontSend(
        user: User, anyReturnToUrl: Option[String],
        host: String, dao: SiteDao): Email = {

    import dao.context.globals
    val (siteName, origin) = dao.theSiteNameAndOrigin()

    val returnToUrl = anyReturnToUrl match {
      case Some(url) => url.replaceAllLiterally(RedirectFromVerificationEmailOnly, "")
      case None => "/"
    }
    val returnToUrlEscapedHash = returnToUrl.replaceAllLiterally("#", "__dwHash__")
    val emailId = Email.generateRandomId()

    // A bit dupl code. [4CUJQT4]
    val safeEmailAddrVerifUrl =
      globals.originOf(host) +
        routes.LoginWithPasswordController.confirmEmailAddressAndLogin(
          emailId, // safe, generated by the server
          Encode.forHtmlAttribute(returnToUrlEscapedHash))

    val lang = dao.getWholeSiteSettings().languageCode
    val emailTexts = talkyard.server.emails.out.Emails.inLanguage(lang)
    val email = Email.newWithId(
      emailId,
      EmailType.VerifyAddress,
      createdAt = globals.now(),
      sendTo = user.email,
      toUserId = Some(user.id),
      subject = s"[$siteName] Confirm your email address",
      bodyHtmlText =
        emailTexts.createAccountLinkEmail(
          siteAddress = host,
          username = user.theUsername,
          safeVerificationUrl = safeEmailAddrVerifUrl,
          expirationTimeInHours = EmailType.VerifyAddress.secretsExpireHours,
          globals))

    dao.saveUnsentEmail(email)

    if (user.isOwner) {
      logger.info(i"""
        |
        |————————————————————————————————————————————————————————————
        |Copy this site-owner-email-address-verification-URL into your web browser: [EdM5KF0W2]
        |  $safeEmailAddrVerifUrl
        |————————————————————————————————————————————————————————————
        |""")
    }

    email
  }

  import talkyard.server.emails.out.Emails

  def sendYouAlreadyHaveAnAccountWithThatAddressEmail(
          dao: SiteDao, emailAddress: St, siteHostname: St, siteId: SiteId): U = {
    val lang = dao.getWholeSiteSettings().languageCode
    val emailTexts = Emails.inLanguage(lang)
    val globals = dao.globals
    val email = Email.createGenId(
      EmailType.Notification,
      createdAt = globals.now(),
      sendTo = emailAddress,
      toUserId = None,
      subject = s"[${dao.theSiteName()}] You already have an account at " + siteHostname,
      bodyHtml =
          emailTexts.accountAlreadyExistsEmail(
              emailAddress = emailAddress,
              siteAddress = siteHostname,
              globals))
    dao.saveUnsentEmail(email)
    globals.sendEmail(email, siteId)
  }


}
