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

import actions.ApiActions.JsonOrFormDataPostAction
import actions.ApiActions.PostJsonAction
import actions.ApiActions.GetAction
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.dao.SiteDao
import debiki.DebikiHttp._
import java.{util => ju}
import org.scalactic.{Good, Bad}
import play.api._
import play.api.mvc.{Action => _, _}
import play.api.libs.json.JsObject
import requests.ApiRequest
import requests.JsonPostRequest



/** Logs in users via username and password.
  */
object LoginWithPasswordController extends mvc.Controller {

  private val MaxAddressVerificationEmailAgeInHours = 25


  def login = JsonOrFormDataPostAction(maxBytes = 1000) { request =>
    val email = request.body.getOrThrowBadReq("email")
    val password = request.body.getOrThrowBadReq("password")
    val anyReturnToUrl = request.body.getFirst("returnToUrl")

    val siteId = DebikiHttp.lookupTenantIdOrThrow(request, Globals.systemDao)
    val dao = Globals.siteDao(siteId, ip = request.ip)

    val cookies = doLogin(request, dao, email, password)

    val response = anyReturnToUrl match {
      case None => Ok
      case Some(url) => Redirect(url)
    }

    response.withCookies(cookies: _*)
  }


  def doLogin(request: ApiRequest[_], dao: SiteDao, email: String, password: String)
        : Seq[Cookie] = {
    val loginAttempt = PasswordLoginAttempt(
      ip = request.ip,
      date = request.ctime,
      email = email,
      password = password)

    def deny() = throwForbidden("DwE403GJk9", "Bad username or password")

    // WOULD have `tryLogin` return a LoginResult and stop using exceptions!
    val loginGrant: LoginGrant =
      try dao.tryLogin(loginAttempt)
      catch {
        case DbDao.BadPasswordException => deny()
        case ex: DbDao.IdentityNotFoundException => deny()
        case DbDao.EmailNotVerifiedException =>
          throwForbidden("DwE4UBM2", o"""You have not yet confirmed your email address.
            Please check your email inbox — you should find an email from us with a
            verification link; please click it.""")
      }

    val (_, _, sidAndXsrfCookies) = Xsrf.newSidAndXsrf(loginGrant.user)
    val userConfigCookie = ConfigUserController.userConfigCookie(loginGrant.user)

    userConfigCookie::sidAndXsrfCookies
  }


  def handleCreateUserDialog = PostJsonAction(maxLength = 1000) { request: JsonPostRequest =>
    val body = request.body
    val name = (body \ "name").as[String]
    val emailAddress = (body \ "email").as[String]
    val username = (body \ "username").as[String]
    val password = (body \ "password").asOpt[String] getOrElse
      throwBadReq("DwE85FX1", "Password missing")

    val userData =
      NewPasswordUserData.create(name = name, email = emailAddress, username = username,
          password = password) match {
        case Good(data) => data
        case Bad(errorMessage) =>
          throwUnprocessableEntity("DwE805T4", s"$errorMessage, please try again.")
      }

    val dao = daoFor(request.request)
    var anyUser: Option[User] = None
    try anyUser = Some(dao.createPasswordUser(userData))
    catch {
      case DbDao.DuplicateUsername =>
        throwForbidden(
          "DwE65EF0", "Username already taken, please try again with another username")
      case DbDao.DuplicateUserEmail =>
        // Send account reminder email. But don't otherwise indicate that the account exists,
        // so no email addresses are leaked.
        sendYouAlreadyHaveAnAccountWithThatAddressEmail(
          dao, emailAddress, siteHostname = request.host, siteId = request.siteId)
    }

    // This dialog is always submitted via Ajax, need not include any HTML in the reply.
    assErrIf(!isAjax(request.request), "DwEDK3903")

    // Log any newly created user in. This will allow him/her to post just one comment,
    // but any such comment won't appear until s/he has verified his/her email address.
    anyUser match {
      case Some(user) =>
        val (_, _, sidAndXsrfCookies) = debiki.Xsrf.newSidAndXsrf(user)
        val userConfigCookie = ConfigUserController.userConfigCookie(user)
        val newSessionCookies = userConfigCookie :: sidAndXsrfCookies
        Ok.withCookies(userConfigCookie::newSessionCookies: _*)
      case None =>
        Ok
    }
  }



  def sendEmailAddressVerificationEmail = PostJsonAction(maxLength = 200) { request =>
    val anyReturnToUrl = (request.body \ "returnToUrl").asOpt[String]
    val anyViewPostId = (request.body \ "viewPostId").asOpt[String]
    val user = request.theUser
    val email = Email(
      EmailType.CreateAccount,
      sendTo = user.email,
      toUserId = Some(user.id),
      subject = "Confirm your email address",
      bodyHtmlText = (emailId: String) => {
        views.html.createaccount.createAccountLinkEmail(
          siteAddress = request.host,
          username = user.username.getOrElse(user.displayName),
          emailId = emailId,
          returnToUrl = anyReturnToUrl getOrElse "/",
          viewPostId = anyViewPostId getOrElse "",
          expirationTimeInHours = MaxAddressVerificationEmailAgeInHours).body
      })
    request.dao.saveUnsentEmail(email)
    Globals.sendEmail(email, request.dao.siteId)
    Ok
  }


  def sendYouAlreadyHaveAnAccountWithThatAddressEmail(
        dao: SiteDao, emailAddress: String, siteHostname: String, siteId: SiteId) {
    val email = Email(
      EmailType.Notification,
      sendTo = emailAddress,
      toUserId = None,
      subject = "You already have an account at " + siteHostname,
      bodyHtmlText = (emailId: String) => {
        views.html.createaccount.accountAlreadyExistsEmail(
          emailAddress = emailAddress,
          siteAddress = siteHostname).body
      })
    dao.saveUnsentEmail(email)
    Globals.sendEmail(email, siteId)
  }


  def confirmEmailAddressAndLogin(confirmationEmailId: String, returnToUrl: String,
        viewPostId: String) = GetAction { request =>

    val userId = finishEmailAddressVerification(confirmationEmailId, request)
    val user = request.dao.loadUser(userId) getOrElse {
      throwInternalError("DwE7GJ0", "I've deleted the account")
    }

    // Log the user in.
    val (_, _, sidAndXsrfCookies) = debiki.Xsrf.newSidAndXsrf(user)
    val userConfigCookie = ConfigUserController.userConfigCookie(user)
    val newSessionCookies = userConfigCookie :: sidAndXsrfCookies

    val anyReturnToUrl: Option[String] = if (returnToUrl.nonEmpty) Some(returnToUrl) else None
    val anyViewPostId: Option[String] = if (viewPostId.nonEmpty) Some(viewPostId) else None

    Ok(views.html.createaccount.welcomePage(anyReturnToUrl, viewPostId = anyViewPostId))
      .withCookies(userConfigCookie::newSessionCookies: _*)
  }


  def finishEmailAddressVerification(emailId: String, request: ApiRequest[_]): UserId = {
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
      case Some(date) =>
        /* COULD restrict email age:
        val emailAgeInMillis = new ju.Date().getTime - date.getTime
        val emailAgeInHours = emailAgeInMillis / 1000 / 3600
        if (MaxAddressVerificationEmailAgeInHours < emailAgeInHours)
          return a response like "Registration link expired, please signup again"
        */
    }

    val roleId = email.toRoleId getOrElse {
      assErr("DwE8XK5", "Email was not sent to a role")
    }

    request.dao.verifyEmail(roleId, request.ctime)
    roleId
  }

}
