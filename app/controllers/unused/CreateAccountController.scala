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

// Parts of this class might become useful again in the future if I start verifying
// email addresses.

/* The related routes:
GET   /-/create-account/specify-email-address/:returnToUrl  controllers.CreateAccountController.showCreateAccountPage(returnToUrl)
POST  /-/create-account/specify-email-address/:returnToUrl  controllers.CreateAccountController.handleEmailAddress(returnToUrl)
GET   /-/create-account/user-details/:emailId/:returnToUrl  controllers.CreateAccountController.showUserDetailsPage(emailId, returnToUrl)
POST  /-/create-account/user-details/:emailId/:returnToUrl  controllers.CreateAccountController.handleUserDetails(emailId, returnToUrl)
GET   /-/create-account/welcome/:returnToUrl                controllers.CreateAccountController.showWelcomePage(returnToUrl)
*/

/*
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


/** Creates email/password accounts. When the account has been created,
  * redirects to a page that continues whatever the user was doing before,
  * e.g. creating a new website.
  */
object CreateAccountController extends mvc.Controller {

  val MaxRegistrationEmailAgeInDays = 8


  def showCreateAccountPage(returnToUrl: String) = GetAction { request =>
    throwIfMayNotCreateAccount(request)
    Ok(views.html.createaccount.specifyEmailAddress(
      xsrfToken = request.xsrfToken.value, returnToUrl = returnToUrl))
  }


  def handleEmailAddress(returnToUrl: String) = JsonOrFormDataPostAction(maxBytes = 200) {
        request =>
    throwIfMayNotCreateAccount(request)

    val emailAddress = request.body.getOrThrowBadReq("emailAddress")
    val anyIdentityAndUser = request.dao.loadIdtyDetailsAndUser(forEmailAddr = emailAddress)

    val email: Email = anyIdentityAndUser match {
      case Some((identity, user)) =>
        // Send account reminder email. But don't otherwise indicate that account exist
        // (doing that would be a security issue: would encourage brute force password
        // breaking attempts).
        Email(EmailType.Notification, sendTo = emailAddress, toUserId = Some(user.id),
          subject = "You already have an account at " + request.host,
          bodyHtmlText = (emailId: String) => {
            views.html.createaccount.accountAlreadyExistsEmail(
                user.displayName, emailAddress = emailAddress, siteAddress = request.host).body
          })
      case None =>
        // Send create account email.
        Email(EmailType.CreateAccount, sendTo = emailAddress, toUserId = None,
          subject = "Create Account",
          bodyHtmlText = (emailId: String) => {
            views.html.createaccount.createAccountLinkEmail(
                siteAddress = request.host, emailId = emailId, returnToUrl = returnToUrl,
                expirationTimeInDays = MaxRegistrationEmailAgeInDays).body
          })
    }

    request.dao.saveUnsentEmail(email)
    Globals.sendEmail(email, request.dao.siteId)

    // Ooops ought to redirect, then get, so reloading the page becomes harmless?
    Ok(views.html.createaccount.registrationEmailSent())
  }


  def showUserDetailsPage(emailId: String, returnToUrl: String) = GetAction { request =>
    loadAndCheckVerificationEmail(emailId, request)
    // (Note that account might already exist. If so, unique key should prevent dupl account.)
    Ok(views.html.createaccount.userDetails(
      xsrfToken = request.xsrfToken.value, emailId = emailId, returnToUrl = returnToUrl))
  }


  def handleUserDetails(emailId: String, returnToUrl: String) =
        JsonOrFormDataPostAction(maxBytes = 1000) { request =>
    val email = loadAndCheckVerificationEmail(emailId, request)
    val displayName = request.body.getOrThrowBadReq("displayName")
    val fullName = request.body.getOrThrowBadReq("fullName")
    val country = request.body.getOrThrowBadReq("country")
    val password = request.body.getOrThrowBadReq("password")
    val passwordAgain = request.body.getOrThrowBadReq("passwordAgain")

    if (password != passwordAgain)
      throwBadReq("DwE7REf1", "The password and the repeated password differs")

    val roleNoId = User(id = "?u", displayName = displayName, email = email.sentTo,
      emailNotfPrefs = EmailNotfPrefs.Receive, country = country, website = "")

    val hash = DbDao.saltAndHashPassword(password)
    val identityNoId = PasswordIdentity(
      id = "?i", userId = "?u", email = email.sentTo, passwordSaltHash = hash)

    val (identity, role) = request.dao.createPasswordIdentityAndRole(identityNoId, roleNoId)
    val cookies = controllers.LoginWithPasswordController.doLogin(
      request, request.dao, email.sentTo, password)

    Redirect(routes.CreateAccountController.showWelcomePage(returnToUrl)).withCookies(cookies: _*)
  }


  def showWelcomePage(returnToUrl: String) = GetAction { request =>
    request.user_! // verifies user is logged in
    Ok(views.html.createaccount.welcomePage(returnToUrl))
  }


  def throwIfMayNotCreateAccount(request: ApiRequest[_]) {
    // Check quota, e.g. if 9999 accounts already created from this IP
  }


  def loadAndCheckVerificationEmail(emailId: String, request: ApiRequest[_]): Email = {
    val anyEmail = request.dao.loadEmailById(emailId)
    val email = anyEmail getOrElse throwForbidden("DwE7GJP903", "Bad email id; email not found")

    if (email.tyype != EmailType.CreateAccount)
      throwForbidden("DwE2DKP9", s"Bad email type: ${email.tyype}")

    email.sentOn match {
      case None =>
        Logger.warn(o"""Got a registration email ID, although email not yet sent,
            site: ${request.siteId}, email id: $emailId""")
        throwForbidden("DwE8Gfh32", "Registration email not yet sent")
      case Some(date) =>
        /* COULD restrict email age:
        val emailAgeInMillis = new ju.Date().getTime - date.getTime
        val emailAgeInDays = emailAgeInMillis / 1000 / 3600 / 24
        if (MaxRegistrationEmailAgeInDays < emailAgeInDays)
          return Left(a response like: "Registration link expired, please signup again")
          */
    }
    email
  }

}
*/
