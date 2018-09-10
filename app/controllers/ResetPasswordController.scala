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
import ed.server.{EdContext, EdController}
import ed.server.http._
import javax.inject.Inject
import play.api._
import play.api.libs.json.{JsString, JsValue}
import play.api.mvc.{AbstractController, Action, ControllerComponents}


/** Resets the password of a PasswordIdentity, in case the user forgot it.
  */
class ResetPasswordController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.globals
  import context.security.createSessionIdAndXsrfToken

  val MaxResetPasswordEmailAgeInHours = 24


  def start = mvc.Action { _ =>
    Redirect(routes.ResetPasswordController.showResetPasswordPage().url)
  }


  def showResetPasswordPage: Action[Unit] = GetActionAllowAnyone { request =>
    Ok(views.html.resetpassword.specifyEmailAddress(
      SiteTpi(request), xsrfToken = request.xsrfToken.value))
  }


  def handleResetPasswordForm: Action[JsonOrFormDataBody] =
        JsonOrFormDataPostAction(RateLimits.ResetPassword,
        maxBytes = 200, allowAnyone = true) { request =>
    val emailOrUsername = request.body.getOrThrowBadReq("email") // WOULD rename 'email' param
    val anyUser = request.dao.loadMemberByEmailOrUsername(emailOrUsername)
    val isEmailAddress = emailOrUsername contains "@"
    val siteId = request.dao.siteId

    SECURITY; COULD // rate limit # pwd reset emails sent to the same address, per day.
    // (Currently only rate limiting ip addr, see above.)
    READ // http://www.troyhunt.com/2012/05/everything-you-ever-wanted-to-know.html  [ext-5KWBZU03]

    anyUser match {
      case Some(user) =>
        dieIf(user.email != emailOrUsername && user.theUsername != emailOrUsername, "DwE0F21")
        var isCreating = false
        if (user.passwordHash.isDefined) {
          Logger.info(s"s$siteId: Sending password reset email to: $emailOrUsername [TyM2AKEG5]")
        }
        else {
          Logger.info(s"s$siteId: Sending create password email to: $emailOrUsername [TyM6WKBA20]")
          isCreating = true
        }
        sendChangePasswordEmailTo(user, request, isCreating = isCreating)
      case None =>
        Logger.info(o"""s$siteId: Not sending password reset email to non-existing
             user or email address: $emailOrUsername""")
        if (isEmailAddress) {
          // Don't tell the user that this email address doesn't exist; that'd be a
          // security issue. Just show the email sent page.
        }
        else {
          // Usernames are publicly visible.
          throwForbidden("DwE4KFE03", "There is no user with that username")
        }
    }

    Redirect(routes.ResetPasswordController.showEmailSentPage(isEmailAddress.toString).url)
  }


  def sendResetPasswordEmail: Action[JsValue] = PostJsonAction(RateLimits.ResetPassword, maxBytes = 10) {
        request =>
    import request.{dao, siteId, theRequester => requester}
    val member = dao.loadTheMemberInclDetailsById(requester.id)

    // Later, ask for current pwd, if no email addr available. [7B4W20]
    throwForbiddenIf(member.primaryEmailAddress.isEmpty, "TyE5KBRE20", "No primary email address")
    throwForbiddenIf(member.emailVerifiedAt.isEmpty, "TyE5KBRE21", "Email address not verified")

    if (member.passwordHash.isDefined) {
      Logger.info(s"s$siteId: Sending password reset email to: ${member.idSpaceName} [TyM5BKFW0]")
    }
    else {
      Logger.info(s"s$siteId: Sending create password email to: ${member.idSpaceName} [TyM2AKBP05")
    }
    sendChangePasswordEmailTo(member.briefUser, request, isCreating = member.passwordHash.isEmpty)
    OkSafeJson(JsString("Ok."))
  }


  private def sendChangePasswordEmailTo(user: Member, request: ApiRequest[_], isCreating: Boolean) {
    import request.dao

    val subject = if (isCreating) "Choose a Password" else "Reset Password"  // I18N

    val email = Email(
      EmailType.ResetPassword,
      createdAt = globals.now(),
      sendTo = user.email,
      toUserId = Some(user.id),
      subject = s"[${dao.theSiteName()}] $subject",
      bodyHtmlText = (emailId: String) => {
        views.html.resetpassword.resetPasswordEmail(
          userName = user.theUsername,
          emailId = emailId,
          siteAddress = request.host,
          expirationTimeInHours = MaxResetPasswordEmailAgeInHours,
          globals = globals).body
      })
    dao.saveUnsentEmail(email)
    globals.sendEmail(email, dao.siteId)
  }


  def showEmailSentPage(isEmailAddress: String): Action[Unit] = GetActionAllowAnyone { request =>
    Ok(views.html.resetpassword.emailSent(SiteTpi(request), isEmailAddress == "true"))
  }


  def showChooseNewPasswordPage(resetPasswordEmailId: String): Action[Unit] =
        GetActionAllowAnyoneRateLimited(RateLimits.NewPasswordPage) { request =>
    SECURITY; COULD // check email type: ResetPassword or InvitePassword.
    val loginGrant = loginByEmailOrThrow(resetPasswordEmailId, request)
    Ok(views.html.resetpassword.chooseNewPassword(
      SiteTpi(request),
      user = loginGrant.user,
      anyResetPasswordEmailId = resetPasswordEmailId))
  }


  def handleNewPasswordForm(anyResetPasswordEmailId: String): Action[JsonOrFormDataBody] =
        JsonOrFormDataPostAction(RateLimits.ChangePassword, maxBytes = 200,
          allowAnyone = true) { request =>
    val newPassword = request.body.getOrThrowBadReq("newPassword")

    val loginGrant = loginByEmailOrThrow(anyResetPasswordEmailId, request)
    request.dao.changePasswordCheckStrongEnough(loginGrant.user.id, newPassword)

    SECURITY // SHOULD test if reset password email too old, expired
    SECURITY // SHOULD mark reset password email as used, so cannot be used again

    // Log the user in and show password changed message.
    request.dao.pubSub.userIsActive(request.siteId, loginGrant.user, request.theBrowserIdData)
    val (_, _, sidAndXsrfCookies) = createSessionIdAndXsrfToken(request.siteId, loginGrant.user.id)
    val newSessionCookies = sidAndXsrfCookies
    Ok(views.html.resetpassword.passwordHasBeenChanged(SiteTpi(request)))
      .withCookies(newSessionCookies: _*)
  }


  private def loginByEmailOrThrow(resetPasswordEmailId: String, request: ApiRequest[_])
        : MemberLoginGrant = {
    val loginAttempt = EmailLoginAttempt(
      ip = request.ip, date = globals.now().toJavaDate, emailId = resetPasswordEmailId)
    // TODO: Check email type !
    val loginGrant =
      try request.dao.tryLoginAsMember(loginAttempt)
      catch {
        case _: DbDao.EmailNotFoundException =>
          throwForbidden("DwE7PWE7", "Email not found")
      }
    loginGrant
  }

}
