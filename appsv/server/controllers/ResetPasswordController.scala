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
import talkyard.server.{TyContext, TyController}
import talkyard.server.http._
import javax.inject.Inject
import play.api.libs.json.{JsString, JsValue}
import play.api.mvc.{Action, ControllerComponents}
import talkyard.server.TyLogging


/** Resets the password of a PasswordIdentity, in case the user forgot it.
  */
class ResetPasswordController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) with TyLogging {

  import context.globals
  import context.security.createSessionIdAndXsrfToken


  def start = GetActionAllowAnyone { _ =>
    Redirect(routes.ResetPasswordController.showResetPasswordPage.url)
  }


  def showResetPasswordPage: Action[Unit] = GetActionAllowAnyone { request =>
    import request.dao
    throwForbiddenIf(!dao.getWholeSiteSettings().canLoginWithPassword,
          "TyE0PWDLGI210", "Password login disabled")
    CSP_MISSING
    Ok(views.html.resetpassword.specifyEmailAddress(
      SiteTpi(request), xsrfToken = request.xsrfToken.value))
  }


  /** If not logged in,  e.g. forgot password.
    */
  def handleResetPasswordForm: Action[JsonOrFormDataBody] =
        JsonOrFormDataPostAction(RateLimits.ResetPassword,
        maxBytes = 200, allowAnyone = true) { request =>

    import request.dao
    val emailOrUsername = request.body.getOrThrowBadReq("email") // WOULD rename 'email' param
    val anyUser = request.dao.loadMemberByEmailOrUsername(emailOrUsername)
    val isEmailAddress = emailOrUsername contains "@"
    val siteId = request.dao.siteId

    throwForbiddenIf(!dao.getWholeSiteSettings().canLoginWithPassword,
          "TyE0PWDLGI602", "Password login disabled")

    SECURITY; COULD // rate limit # pwd reset emails sent to the same address, per day.
    // (Currently only rate limiting ip addr, see above.)
    READ // http://www.troyhunt.com/2012/05/everything-you-ever-wanted-to-know.html  [ext-5KWBZU03]

    anyUser match {
      case Some(user) =>
        // This (TyE0F21J4). failed once — must have been mismatched case comparison?
        // The database lookup is lowercase (better do in db, maybe different
        // to-lowercase algorithm?).
        // So compare lowercase too (emailOrUnLower), + incl values in message.
        val emailOrUnLower = emailOrUsername.toLowerCase
        dieIf(user.email != emailOrUsername && user.theUsername != emailOrUsername &&
              user.email.toLowerCase != emailOrUnLower &&
              user.theUsername.toLowerCase != emailOrUnLower,
              "TyE0F21J4", o"""s$siteId: Specified email or username: '$emailOrUsername',
              actual: '${user.email}' and '${user.username}', user id ${user.id}""")
        var skip = false
        var isCreating = false
        if (user.isDeleted) {
          // Don't think this can happen? When deleted, one's email is deleted as well,
          // so the user instead won't be found (when looking up by email above).
          logger.warn(s"s$siteId: Not sending any password reset email to deleted user ${
                toWho(user)} — isn't this dead code? [TyE5MWKJ30]")
          // But if suspended — then it's ok to reset one's password? If nothing else,
          // only to log out everywhere.
          skip = true
        }
        else if (user.passwordHash.isDefined) {
          logger.info(s"s$siteId: Sending password reset email ${toWho(user)} [TyM2AKEG5]")
        }
        else {
          logger.info(s"s$siteId: Sending create password email ${toWho(user)} [TyM6WKBA20]")
          isCreating = true
        }
        if (!skip) {
          sendChangePasswordEmailTo(user, request, isCreating = isCreating)
        }

      case None =>
        // Don't tell the user that the email address or username doesn't exist; that'd be a
        // security issue. Just show the email sent page.
        // (Also usernames might be private, e.g. if a community is behind a login wall,
        // or if someone has hidden their user profile page. [private_pats])
        if (isEmailAddress) {
          logger.info(o"""s$siteId: Not sending password reset email to non-existing
                email address: $emailOrUsername  [TyMRSTPW_0EML]""")
        }
        else {
          logger.info(o"""s$siteId: Not sending password reset email to non-existing
                username: $emailOrUsername  [TyMRSTPW_0UN]""")
        }
    }

    Redirect(routes.ResetPasswordController.showEmailSentPage(isEmailAddress.toString).url)
  }

  private def toWho(member: UserBase): St =
    s"to ${member.usernameHashId}, addr: ${member.primaryEmailAddress}"


  /** If already logged in  (then, one's account is not deleted or suspended).
    */
  def sendResetPasswordEmail: Action[JsValue] = PostJsonAction(RateLimits.ResetPassword, maxBytes = 100) {
        request =>
    import request.{dao, siteId, theRequester => requester}
    val forUserId = (request.body \ "toUserId").as[UserId]

    throwForbiddenIf(!dao.getWholeSiteSettings().canLoginWithPassword,
          "TyE0PWDLGI402", "Password login disabled")

    throwForbiddenIf(requester.id != forUserId && !requester.isStaff,
      "TyE305MRKT2", "Cannot reset password for other people")

    val member =
          try dao.loadTheUserInclDetailsById(forUserId)
          catch {
            case _: GotAGroupException =>
              throwForbidden("TyE50AMWG5", s"User $forUserId is a group not a user")
          }

    throwForbiddenIf(member.isAdmin && !requester.isAdmin,
      "TyE607MAST2", "Cannot reset password for admins")

    // Later, ask for current pwd, if no email addr available. [7B4W20]
    throwForbiddenIf(member.primaryEmailAddress.isEmpty, "TyE5KBRE20", "No primary email address")
    throwForbiddenIf(member.emailVerifiedAt.isEmpty, "TyE5KBRE21", "Email address not verified")

    if (member.passwordHash.isDefined) {
      logger.info(s"s$siteId: Sending password reset email ${toWho(member)} [TyM5BKFW0]")
    }
    else {
      logger.info(s"s$siteId: Sending create password email ${toWho(member)} [TyM2AKBP05]")
    }
    sendChangePasswordEmailTo(member.briefUser, request, isCreating = member.passwordHash.isEmpty)
    OkSafeJsValue(JsString("Ok."))
  }


  private def sendChangePasswordEmailTo(user: User, req: ApiRequest[_], isCreating: Bo): U = {
    import req.dao

    dieIf(user.isDeleted, "TyE7U3SRKJLF4")
    val subject = if (isCreating) "Choose a Password" else "Reset Password"  // I18N

    val lang = dao.getWholeSiteSettings().languageCode
    val emailTexts = talkyard.server.emails.out.Emails.inLanguage(lang)

    val email = Email.createGenIdAndSecret(
      EmailType.ResetPassword,
      createdAt = globals.now(),
      sendTo = user.email,
      toUserId = Some(user.id),
      subject = s"[${dao.theSiteName()}] $subject",
      bodyHtmlWithSecret = (secret: St) => {
        emailTexts.resetPasswordEmail(
              userName = user.theUsername,
              secret = secret,
              siteAddress = req.host,
              expiresInMinutes = EmailType.ResetPassword.secretsExpireHours * 60,
              globals = globals)
      })
    dao.saveUnsentEmail(email)
    globals.sendEmail(email, dao.siteId)
  }


  def showEmailSentPage(isEmailAddress: String): Action[Unit] = GetActionAllowAnyone { request =>
    CSP_MISSING
    Ok(views.html.resetpassword.emailSent(SiteTpi(request), isEmailAddress == "true"))
  }


  def showChooseNewPasswordPage(resetPasswordEmailId: String): Action[Unit] =
        GetActionAllowAnyoneRateLimited(RateLimits.NewPasswordPage) { request =>
    // Tested here: TyT6HJ2RD1
    // (Note that we don't login for real here — we don't set any session cookie.)
    val loginGrant = loginByEmailOrThrow(resetPasswordEmailId, request,
      // So the request to handleNewPasswordForm() below works:
      mayLoginAgain = true)
    CSP_MISSING
    Ok(views.html.resetpassword.chooseNewPassword(
      SiteTpi(request),
      user = loginGrant.user,
      anyResetPasswordEmailId = resetPasswordEmailId))
  }


  def handleNewPasswordForm(anyResetPasswordEmailId: String): Action[JsonOrFormDataBody] =
        JsonOrFormDataPostAction(RateLimits.ChangePassword, maxBytes = 200,
          allowAnyone = true) { request =>
    import request.dao
    val newPassword = request.body.getOrThrowBadReq("newPassword")

    val loginGrant = loginByEmailOrThrow(anyResetPasswordEmailId, request,
          // So someone who might e.g. see the reset-pwd url in some old log file or wherever,
          // will be unable to reuse it:
          mayLoginAgain = false)
    dao.changePasswordCheckStrongEnough(loginGrant.user.id, newPassword)

    // Expire all old sessions, so in case pat is resetting hans password
    // because han suspects a hacker has logged in to hans account elsewhere,
    // any such hacker is kicked out.
    //
    // Tests:
    //  - password-login-reset.2br.f  TyT5KAES20W.TyT_PWDRST_LGOUT
    //
    UX; COULD // Ask the user if they want to terminate old sessions — because if han
    // just forgot hans password, han migh *not* want to get logged out everywhere.
    // If han doesn't reply in 20? seconds, then terminate all sessions in any case?
    // So, there needs to be a do-later task saved in the db, in case pat disconnects
    // abruptly.
    //
    val terminatedSessions = dao.terminateSessions(forPatId = loginGrant.user.id, all = true)

    UX; COULD // reply: """Done. You're now logged out from  ${terminatedSessions.length - 1 ?}
    // other sessions."""  (-1 depends on if logged in on the current device or not.)

    // Log the user in and show password changed message.
    dao.pubSub.userIsActive(request.siteId, loginGrant.user, request.theBrowserIdData)
    val (_, _, sidAndXsrfCookies) = createSessionIdAndXsrfToken(request, loginGrant.user.id)
    val newSessionCookies = sidAndXsrfCookies

    CSP_MISSING
    Ok(views.html.resetpassword.passwordHasBeenChanged(SiteTpi(request)))
          .withCookies(newSessionCookies: _*)
  }


  private def loginByEmailOrThrow(resetPasswordEmailId: String, request: ApiRequest[_],
        mayLoginAgain: Boolean): MemberLoginGrant = {

    import request.dao
    throwForbiddenIf(!dao.getWholeSiteSettings().canLoginWithPassword,
          "TyE0PWDLGI285", "Password login disabled")

    val loginAttempt = EmailLoginAttempt(
      ip = request.ip, date = globals.now().toJavaDate, emailId = resetPasswordEmailId,
      mayLoginAgain = mayLoginAgain)
    val loginGrant = dao.tryLoginAsMember(loginAttempt) getOrIfBad { problem =>
      // For now. Later, anyException will disappear.
      if (problem.anyException.isEmpty) {
        // Currently "cannot" happen. [6036KEJ5]
        throwInternalError("TyE406@KUTHF", s"Login-by-email problem: ${problem.message}")
      }
      problem.anyException.get match {
        case _: DbDao.EmailNotFoundException =>
          throwForbidden("DwE7PWE7", "Email not found")
        case DbDao.UserDeletedException =>
          // But not if is only suspended. [susp_see_pub]
          throwForbidden("TyEUSRDLD02_", "User deleted")
        case ex: QuickMessageException =>
          logger.warn(s"Deprecated exception [TyEQMSGEX01]", ex)
          throwForbidden("TyEQMSGEX01", ex.getMessage)
        case ex =>
          throw ex
      }
    }
    loginGrant
  }

}
