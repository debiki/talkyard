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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.EdHttp._
import ed.server.spam.SpamChecker
import debiki.dao.SiteDao
import ed.server.{EdContext, EdController}
import ed.server.http._
import javax.inject.Inject
import org.scalactic.{Bad, Good}
import play.api._
import play.api.mvc._
import play.api.libs.json.{JsBoolean, JsValue, Json}
import LoginWithPasswordController._



/** Logs in users via username and password.
  */
class LoginWithPasswordController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.globals
  import context.security.createSessionIdAndXsrfToken


  def login: Action[JsonOrFormDataBody] = JsonOrFormDataPostAction(
        RateLimits.Login, maxBytes = 1000, isLogin = true) { request =>
    val email = request.body.getOrThrowBadReq("email")
    val password = request.body.getOrThrowBadReq("password")
    val anyReturnToUrl = request.body.getFirst("returnToUrl")

    val site = globals.lookupSiteOrThrow(request.request)
    val dao = globals.siteDao(site.id)

    val cookies = doLogin(request, dao, email, password)

    val response = anyReturnToUrl match {
      case None => Ok
      case Some(url) => Redirect(url)
    }

    response.withCookies(cookies: _*)
  }


  private def doLogin(request: ApiRequest[_], dao: SiteDao, email: String, password: String)
        : Seq[Cookie] = {
    val loginAttempt = PasswordLoginAttempt(
      ip = request.ip,
      date = request.ctime,
      email = email,
      password = password)

    // The browser checks for 'EsE403BPWD' so don't change it.
    def deny() = throwForbidden("EsE403BPWD", "Bad username or password")

    // WOULD have `tryLogin` return a LoginResult and stop using exceptions!
    val loginGrant: MemberLoginGrant =
      try dao.tryLoginAsMember(loginAttempt)
      catch {
        case DbDao.NoMemberWithThatEmailException => deny()
        case DbDao.BadPasswordException => deny()
        case DbDao.IdentityNotFoundException => deny()
        case DbDao.EmailNotVerifiedException =>
          throwForbidden("DwE4UBM2", o"""You have not yet confirmed your email address.
            Please check your email inbox — you should find an email from us with a
            verification link; please click it.""")
      }

    dao.pubSub.userIsActive(request.siteId, loginGrant.user, request.theBrowserIdData)
    val (_, _, sidAndXsrfCookies) = createSessionIdAndXsrfToken(request.siteId, loginGrant.user.id)
    sidAndXsrfCookies
  }


  def handleCreateUserDialog: Action[JsValue] = AsyncPostJsonAction(
        RateLimits.CreateUser, maxBytes = 1000,
        // COULD set isLogin (or isLoginOrSignup)= true but currently that'd mean people
        // could sign up for SiteStatus.HiddenUnlessStaff/Admin. So, not right now.
        // Perhaps later though, if staff can be invited directly via invite emails. [5PY8FD2]
        allowAnyone = true) { request: JsonPostRequest =>
    val body = request.body
    val fullName = (body \ "fullName").asOptStringNoneIfBlank
    val emailAddress = (body \ "email").as[String].trim
    val username = (body \ "username").as[String].trim
    val password = (body \ "password").asOpt[String] getOrElse
      throwBadReq("DwE85FX1", "Password missing")
    val anyReturnToUrl = (body \ "returnToUrl").asOpt[String]

    val dao = daoFor(request.request)
    val siteSettings = dao.getWholeSiteSettings()

    // Some dupl code. [2FKD05]
    if (!siteSettings.requireVerifiedEmail && emailAddress.isEmpty) {
      // Fine. If needn't verify email, then people can specify non-existing addresses,
      // so then we might as well accept no-email-at-all.
    }
    else if (emailAddress.isEmpty) {
      throwUnprocessableEntity("EdE1GUR0", "Email address missing")
    }
    else if (!isValidNonLocalEmailAddress(emailAddress))
      throwUnprocessableEntity("EdE80KFP2", "Bad email address")

    if (ed.server.security.ReservedNames.isUsernameReserved(username))
      throwForbidden("EdE5PKW01", s"Username is reserved: '$username'; choose another username")

    globals.spamChecker.detectRegistrationSpam(request, name = username, email = emailAddress) map {
        isSpamReason =>
      SpamChecker.throwForbiddenIfSpam(isSpamReason, "EdE7KVF2_")

      // Password strength tested in createPasswordUserCheckPasswordStrong() below.

      val becomeOwner = LoginController.shallBecomeOwner(request, emailAddress)

      val userData =
        NewPasswordUserData.create(name = fullName, email = emailAddress, username = username,
            password = password, createdAt = globals.now(),
            isAdmin = becomeOwner, isOwner = becomeOwner) match {
          case Good(data) => data
          case Bad(errorMessage) =>
            throwUnprocessableEntity("DwE805T4", s"$errorMessage, please try again.")
        }

      val loginCookies: List[Cookie] = try {
        val newMember = dao.createPasswordUserCheckPasswordStrong(userData)
        if (newMember.email.nonEmpty) {
          sendEmailAddressVerificationEmail(newMember, anyReturnToUrl, request.host, request.dao)
        }
        if (newMember.email.nonEmpty && !siteSettings.mayPostBeforeEmailVerified) {
          TESTS_MISSING // no e2e tests for this
          // Apparently the staff wants to know that all email addresses actually work.
          // (But if no address specifeid — then, just below, we'll log the user in directly.)
          Nil
        }
        else {
          dieIf(newMember.email.isEmpty && siteSettings.requireVerifiedEmail, "EdE2GKF06")
          dao.pubSub.userIsActive(request.siteId, newMember, request.theBrowserIdData)
          val (_, _, sidAndXsrfCookies) = createSessionIdAndXsrfToken(dao.siteId, newMember.id)
          sidAndXsrfCookies
        }
      }
      catch {
        case DbDao.DuplicateUsername =>
          throwForbidden(
            "DwE65EF0", "Username already taken, please try again with another username")
        case DbDao.DuplicateUserEmail =>
          // Send account reminder email. But don't otherwise indicate that the account exists,
          // so no email addresses are leaked.
          sendYouAlreadyHaveAnAccountWithThatAddressEmail(
            dao, emailAddress, siteHostname = request.host, siteId = request.siteId)
          Nil
      }

      OkSafeJson(Json.obj(
        "userCreatedAndLoggedIn" -> JsBoolean(loginCookies.nonEmpty),
        "emailVerifiedAndLoggedIn" -> JsBoolean(false)))
          .withCookies(loginCookies: _*)
    }
  }


  def sendEmailAddressVerificationEmail(user: Member, anyReturnToUrl: Option[String],
        host: String, dao: SiteDao) {
    val email = createEmailAddrVerifEmailLogDontSend(user, anyReturnToUrl, host, dao)
    globals.sendEmail(email, dao.siteId)
  }


  def confirmEmailAddressAndLogin(confirmationEmailId: String, returnToUrl: String): Action[Unit] =
        GetActionRateLimited(RateLimits.ConfirmEmailAddress, allowAnyone = true) { request =>
    import request.dao

    val userId = finishEmailAddressVerification(confirmationEmailId, request)
    val user = dao.getUser(userId) getOrElse {
      throwInternalError("DwE7GJ0", "I've deleted the account")
    }

    // Log the user in.
    dao.pubSub.userIsActive(request.siteId, user, request.theBrowserIdData)
    val (_, _, sidAndXsrfCookies) = createSessionIdAndXsrfToken(request.siteId, user.id)
    val newSessionCookies = sidAndXsrfCookies

    val anyReturnToUrl: Option[String] = if (returnToUrl.nonEmpty) Some(returnToUrl) else None

    Ok(views.html.createaccount.welcomePage(SiteTpi(request), anyReturnToUrl))
      .withCookies(newSessionCookies: _*)
  }


  private def finishEmailAddressVerification(emailId: String, request: ApiRequest[_]): UserId = {
    SECURITY // don't let the same email verif url be used more than once?
    val email = request.dao.loadEmailById(emailId) getOrElse {
      throwForbidden("DwE7GJP03", "Link expired? Bad email id; email not found.")
    }

    if (email.tyype != EmailType.CreateAccount)
      throwForbidden("DwE2DKP9", s"Bad email type: ${email.tyype}")

    email.sentOn match {
      case None =>
        Logger.warn(o"""Got an address verification email ID, although email not yet sent,
            site: ${request.siteId}, email id: $emailId""")
        throwForbidden("DwE8Gfh32", "Address verification email not yet sent")
      case Some(_) =>
        /* COULD restrict email age:
        val emailAgeInMillis = new ju.Date().getTime - date.getTime
        val emailAgeInHours = emailAgeInMillis / 1000 / 3600
        if (MaxAddressVerificationEmailAgeInHours < emailAgeInHours)
          return a response like "Registration link expired, please signup again"
        */
    }

    val roleId = email.toUserId getOrElse {
      assErr("DwE8XK5", "Email was not sent to a role")
    }

    request.dao.verifyEmail(roleId, request.ctime)
    roleId
  }

}


object LoginWithPasswordController {

  val RedirectFromVerificationEmailOnly = "_RedirFromVerifEmailOnly_"

  private val MaxAddressVerificationEmailAgeInHours = 25


  def createEmailAddrVerifEmailLogDontSend(user: Member, anyReturnToUrl: Option[String],
    host: String, dao: SiteDao): Email = {

    import dao.context.globals
    val (siteName, origin) = dao.theSiteNameAndOrigin()

    val returnToUrl = anyReturnToUrl match {
      case Some(url) => url.replaceAllLiterally(RedirectFromVerificationEmailOnly, "")
      case None => "/"
    }
    val returnToUrlEscapedHash = returnToUrl.replaceAllLiterally("#", "__dwHash__")
    val emailId = Email.generateRandomId()

    val emailAddrVerifUrl =
      globals.originOf(host) +
        routes.LoginWithPasswordController.confirmEmailAddressAndLogin(
          emailId, returnToUrlEscapedHash)

    val email = Email.newWithId(
      emailId,
      EmailType.CreateAccount,
      createdAt = globals.now(),
      sendTo = user.email,
      toUserId = Some(user.id),
      subject = s"[$siteName] Confirm your email address",
      bodyHtmlText =
        views.html.createaccount.createAccountLinkEmail(
          siteAddress = host,
          username = user.theUsername,
          verificationUrl = emailAddrVerifUrl,
          expirationTimeInHours = MaxAddressVerificationEmailAgeInHours,
          globals).body)

    dao.saveUnsentEmail(email)

    if (user.isOwner) {
      play.api.Logger.info(i"""
        |
        |————————————————————————————————————————————————————————————
        |Copy this site-owner-email-address-verification-URL into your web browser: [EdM5KF0W2]
        |  $emailAddrVerifUrl
        |————————————————————————————————————————————————————————————
        |""")
    }

    email
  }


  def sendYouAlreadyHaveAnAccountWithThatAddressEmail(
        dao: SiteDao, emailAddress: String, siteHostname: String, siteId: SiteId) {
    val globals = dao.globals
    val email = Email(
      EmailType.Notification,
      createdAt = globals.now(),
      sendTo = emailAddress,
      toUserId = None,
      subject = s"[${dao.theSiteName()}] You already have an account at " + siteHostname,
      bodyHtmlText = (_: String) => {
        views.html.createaccount.accountAlreadyExistsEmail(
          emailAddress = emailAddress,
          siteAddress = siteHostname,
          globals).body
      })
    dao.saveUnsentEmail(email)
    globals.sendEmail(email, siteId)
  }


}
