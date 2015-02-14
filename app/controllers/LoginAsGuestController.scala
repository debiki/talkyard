/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import requests.DebikiRequest
import actions.ApiActions.PostJsonAction
import play.api.libs.json.JsObject


/** Logs in guest users.
  */
object LoginAsGuestController extends mvc.Controller {


  def loginGuest = PostJsonAction(RateLimits.Login, maxLength = 1000) { request =>
    val json = request.body.as[JsObject]
    val name = (json \ "name").as[String]
    val email = (json \ "email").as[String]
    val url = (json \ "url").as[String]

    def failLogin(errCode: String, summary: String, details: String) =
      throwForbiddenDialog(errCode, "Login Failed", summary, details)

    if (User nameIsWeird name)
      failLogin("DwE82ckWE19", "Weird name.",
        "Please specify another name, with no weird characters.")
    if (name isEmpty)
      failLogin("DwE873k2e90", "No name specified.",
        "Please fill in your name.")
    if (email.nonEmpty && User.emailIsWeird(email))
      failLogin("DwE0432hrsk23", "Weird email.",
        "Please specify an email address with no weird characters.")

    if (User urlIsWeird url)
      failLogin("DwE734krsn215", "Weird URL.",
        "Please specify a website address with no weird characters.")

    val addr = request.ip
    val tenantId = DebikiHttp.lookupTenantIdOrThrow(request, Globals.systemDao)

    val loginAttempt = GuestLoginAttempt(
      ip = addr,
      date = new ju.Date,
      name = name,
      email = email,
      location = "",
      website = url)

    val guestUser = Globals.siteDao(tenantId, ip = addr).loginAsGuest(loginAttempt)

    val (_, _, sidAndXsrfCookies) = Xsrf.newSidAndXsrf(guestUser)

    // Could include a <a href=last-page>Okay</a> link, see the
    // Logout dialog below. Only needed if javascript disabled though,
    // otherwise a javascript welcome dialog is shown instead.
    Ok.withCookies(sidAndXsrfCookies: _*)
  }


  /*
  def loginGuestAgainWithNewEmail(pageReq: DebikiRequest[_],
        newEmailAddr: String): (LoginGrant, Seq[Cookie]) = {
    import pageReq._

    if (User.emailIsWeird(newEmailAddr))
      throwForbiddenDialog("DwE83ZJ1", "Weird Email", "",
        "Please specify a real email address.")
    if (newEmailAddr.isEmpty)
      throwForbiddenDialog("DwE7PUX2", "No Email", "",
        "No email address specified")

    val guestIdentity = identity_!.asInstanceOf[IdentitySimple]

    val loginAttempt = GuestLoginAttempt(
      ip = pageReq.ip,
      date = pageReq.ctime,
      name = guestIdentity.name,
      email = newEmailAddr,
      location = guestIdentity.location,
      website = guestIdentity.website)

    val loginGrant = pageReq.dao.tryLogin(loginAttempt)
    val (_, _, sidAndXsrfCookies) = Xsrf.newSidAndXsrf(Some(loginGrant))

    (loginGrant, sidAndXsrfCookies)
  } */

}
