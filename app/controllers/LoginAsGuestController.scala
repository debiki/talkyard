/**
 * Copyright (c) 2012, 2018 Kaj Magnus Lindberg
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
import ed.server._
import ed.server.security.EdSecurity
import javax.inject.Inject
import play.api.mvc._
import play.api.libs.json._


/** Logs in guest users, creates them first, if needed.
  */
class LoginAsGuestController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.globals
  import context.security


  def loginGuest: Action[JsValue] = AsyncPostJsonAction(
        RateLimits.Login, maxBytes = 1000, avoidCookies = true) { request =>

    val json = request.body.as[JsObject]
    val name = (json \ "name").as[String].trim
    val email = (json \ "email").as[String].trim

    val canUseCookies = request.headers.get(EdSecurity.AvoidCookiesHeaderName) isNot "Avoid"

    val settings = request.dao.getWholeSiteSettings()

    throwForbiddenIf(settings.enableSso, "TyESSO0GST", "Guest login disabled, when SSO enabled")
    throwForbiddenIf(!settings.allowSignup, "TyE0SIGNUP03", "Creation of new accounts is disabled")
    throwForbiddenIf(!settings.isGuestLoginAllowed,
      "TyE4K5FW2", "Guest login disabled; you cannot login as guest here")

    throwForbiddenIf(Participant nameIsWeird name, "TyE82CW19", "Weird name. Please use no weird characters")
    throwForbiddenIf(name.isEmpty, "TyE872Y90", "Please fill in your name")
    throwForbiddenIf(email.nonEmpty && Participant.emailIsWeird(email),
      "TyE04HK83", "Weird email. Please use a real email address")

    // A browser id should be set, at the start of all POST requests. [5JKWQ21]
    val theBrowserId: String = request.theBrowserIdData.idCookie getOrElse throwForbidden(
      "TyE0BRIDGST", "Browser id missing when logging in as guest")

    globals.spamChecker.detectRegistrationSpam(request, name = name, email = email) map {
        isSpamReason =>
      SpamChecker.throwForbiddenIfSpam(isSpamReason, "EdE5KJU3_")

      val loginAttempt = GuestLoginAttempt(
        ip = request.ip,
        date = globals.now().toJavaDate,
        name = name,
        email = email,
        guestBrowserId = theBrowserId)

      val guestUser = request.dao.loginAsGuest(loginAttempt)

      val (sid, _, sidAndXsrfCookies) = security.createSessionIdAndXsrfToken(request.siteId, guestUser.id)

      var responseJson = Json.obj(  // GuestLoginResponse
        "userCreatedAndLoggedIn" -> JsTrue,
        "emailVerifiedAndLoggedIn" -> JsFalse)

      if (canUseCookies) {
        // Don't incl session id in the json — use cookie instead, so works across page loads.
      }
      else {
        // This'll work only for the current page load. And happens only for embedded comments pages,
        // and then this is typically totally fine (people rarely post blog comments, and if they
        // do, probably they reply to only one blog post).
        responseJson += "currentPageSessionId" -> JsString(sid.value)  // [NOCOOKIES]
      }

      val response = OkSafeJson(responseJson)

      if (canUseCookies) response.withCookies(sidAndXsrfCookies: _*)
      else response
    }
  }

}
