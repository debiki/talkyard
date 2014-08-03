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
import debiki.dao.SiteDao
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import requests.ApiRequest
import actions.ApiActions.JsonOrFormDataPostAction
import play.api.libs.json.JsObject



/** Logs in users via username and password.
  */
object LoginWithPasswordController extends mvc.Controller {


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

    val loginGrant: LoginGrant =
      try dao.saveLogin(loginAttempt)
      catch {
        case DbDao.BadPasswordException => deny()
        case ex: DbDao.IdentityNotFoundException => deny()
      }


    val (_, _, sidAndXsrfCookies) = Xsrf.newSidAndXsrf(Some(loginGrant))
    val userConfigCookie = ConfigUserController.userConfigCookie(loginGrant)

    userConfigCookie::sidAndXsrfCookies
  }


}
