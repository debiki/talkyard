/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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

import actions.PageActions._
import actions.ApiActions.PostJsonAction
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.mvc.{Action => _}
import requests.{DebikiRequest, JsonPostRequest}
import Utils.ValidationImplicits._
import EmailNotfPrefs.EmailNotfPrefs


/** Configures a user, can e.g. change receive-email preferences.
  */
object ConfigUserController extends mvc.Controller {

  /**
    * (It's not possible to choose the ForbiddenForever email preference via
    * this endpoint. ForbiddenForever is only available via email login, that is,
    * for the actual owner of the email address.)
    */
  def handleConfiguration = PostJsonAction(RateLimits.ConfigUser, maxLength = 500) {
        request: JsonPostRequest =>

    val body = request.body
    val userId = (body \ "userId").as[UserId]
    val user = request.user_!
    val anyEmailAddress = (body \ "emailAddress").asOpt[String]
    val beNotifiedViaEmailOfReplies = (body \ "beNotifiedViaEmailOfReplies").as[Boolean]

    if (user.id != userId)
      throwForbidden("DwE7733G0", "May configure oneself only")

    val emailNotfPrefs =
      if (beNotifiedViaEmailOfReplies) EmailNotfPrefs.Receive
      else EmailNotfPrefs.DontReceive

    val newEmailAddr =
      if (anyEmailAddress.isEmpty) None
      else {
        // For now, abort, if specified email differs from existing.
        // (You're currently not allowed to change your email via
        // this interface.)
        if (user.email.nonEmpty && user.email != anyEmailAddress.get)
          throwBadReq("DwE8RkL3", "Email differs from user.email")
        if (user.email.isEmpty)
          anyEmailAddress
        else
          None
      }

    if (user.isAuthenticated)
      configRoleUpdCookies(request, emailNotfPrefs, newEmailAddr)
    else
      configGuestUpdCookies(request, emailNotfPrefs, newEmailAddr)
  }


  private def configRoleUpdCookies(pageReq: DebikiRequest[_],
        emailNotfPrefs: EmailNotfPrefs, newEmailAddr: Option[String])
        : mvc.Result = {

    val user = pageReq.user_!
    require(user.isAuthenticated)

    // Update email preferences and email address.
    newEmailAddr match {
      case None =>
        if (user.email.isEmpty && emailNotfPrefs == EmailNotfPrefs.Receive)
          throwBadReqDialog(
            "DwE8kOJ5", "No Email Address", "",
            "Please specify an email address.")

        if (emailNotfPrefs != user.emailNotfPrefs) {
          pageReq.dao.configRole(
             roleId = user.id, emailNotfPrefs = Some(emailNotfPrefs))
        }
      case Some(addr) =>
        // Update DW1_USERS: add new email? and cofig notf prefs.
        // Add email prefs to user config cookie.
        throwForbidden(
          "DwE03921", "Changing DW1_USERS.EMAIL is currently not possible")
    }

    val userNewPrefs = user.copy(emailNotfPrefs = emailNotfPrefs)
    ??? // COULD fix... what? I've forgotten [nologin]
    // Ok
  }


  private def configGuestUpdCookies(pageReq: DebikiRequest[_],
        emailNotfPrefs: EmailNotfPrefs, newEmailAddr: Option[String])
        : mvc.Result = {
    ??? // COULD fix... what? I've forgotten [nologin]
    /*
    require(!pageReq.user_!.isAuthenticated)

    // Login again, if new email specified, because the email is part of the
    // unauthenticated identity (so we need a new login and identity).
    val (user, loginId, newSessCookies) = newEmailAddr match {
      case None =>
        (pageReq.user_!, pageReq.loginId_!, Nil)
      case Some(newAddr) =>
        val (loginGrant, newSessCookies) =
          LoginAsGuestController.loginGuestAgainWithNewEmail(pageReq, newAddr)
        (loginGrant.user, loginGrant.login.id, newSessCookies)
    }

    // Update email notification preferences.
    // (If no email addr specified: do nothing. Then, the next time that
    // that email is specified, the user will be asked again --
    // but not until the user logins again; the answer is rememberd
    // in a cookie. (You cannot config notf prefs for the empty email addr,
    // because that'd affect everyone that hasn't yet configd some addr.))
    if (user.email.isEmpty) {
      if (emailNotfPrefs == EmailNotfPrefs.Receive)
        throwBadReqDialog(
          "DwE82hQ2", "No Email Address", "",
          "Please specify an email address.")
    }
    else if (emailNotfPrefs != user.emailNotfPrefs) {
      pageReq.dao.configIdtySimple(loginId, pageReq.ctime,
        user.email, emailNotfPrefs)
    }

    val userNewPrefs = user.copy(emailNotfPrefs = emailNotfPrefs)
    Ok.withCookies(newSessCookies.toList: _*)
    */
  }

}
