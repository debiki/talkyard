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

import actions.ApiActions._
import actions.ApiActions.JsonOrFormDataPostAction
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import requests.ApiRequest


/** Resets the password of a PasswordIdentity, in case the user forgot it.
  */
object ResetPasswordController extends mvc.Controller {

  val MaxResetPasswordEmailAgeInHours = 24


  def showResetPasswordPage = GetAction { request =>
    Ok(views.html.resetpassword.specifyEmailAddress(xsrfToken = request.xsrfToken.value))
  }


  def handleResetPasswordForm = JsonOrFormDataPostAction(maxBytes = 100) { request =>
    val emailAddress = request.body.getOrThrowBadReq("email")
    val anyIdentityAndUser = request.dao.loadIdtyDetailsAndUser(forEmailAddr = emailAddress)

    anyIdentityAndUser match {
      case Some((identity, user)) =>
        Logger.info(s"Sending password reset email to: $emailAddress")
        sendResetPasswordEmailTo(user, emailAddress, request)
      case None =>
        // Don't tell the user that this account doesn't exist; that'd be a
        // security issue.
        Logger.info(s"Not sending password reset email to non-existing user: $emailAddress")
    }

    Redirect(routes.ResetPasswordController.showEmailSentPage())
  }


  private def sendResetPasswordEmailTo(user: User, emailAddress: String, request: ApiRequest[_]) {
    val email = Email(
      EmailType.ResetPassword,
      sendTo = emailAddress,
      subject = "Reset Password",
      bodyHtmlText = (emailId: String) => {
        views.html.resetpassword.resetPasswordEmail(
          userName = user.displayName,
          emailId = emailId,
          siteAddress = request.host,
          expirationTimeInHours = MaxResetPasswordEmailAgeInHours).body
      })
    request.dao.saveUnsentEmail(email)
    Globals.sendEmail(email, request.dao.siteId)
  }


  def showEmailSentPage = GetAction { request =>
    Ok(views.html.resetpassword.emailSent())
  }


  def showChooseNewPasswordPage(resetPasswordEmailId: String) = GetAction { request =>

    val loginAttempt = EmailLoginAttempt(
      ip = request.ip, date = new ju.Date, emailId = resetPasswordEmailId)

    val loginGrant =
      try request.dao.saveLogin(loginAttempt)
      catch {
        case ex: DbDao.EmailNotFoundException =>
          throwForbidden("DwE7PWE7", "Email not found")
      }

    Ok(views.html.resetpassword.chooseNewPassword(
      xsrfToken = request.xsrfToken.value,
      anyResetPasswordEmailId = resetPasswordEmailId))
  }


  def handleNewPasswordForm(anyResetPasswordEmailId: String) =
        JsonOrFormDataPostAction(maxBytes = 100) { request =>
    val newPassword = request.body.getOrThrowBadReq("newPassword")
    // ... change password ...
    Ok(views.html.resetpassword.passwordHasBeenChanged())
  }


  def showPasswordChangedPage = GetAction { request =>
    Ok(views.html.resetpassword.passwordHasBeenChanged())
  }

}
