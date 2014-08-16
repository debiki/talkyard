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


  def handleCreateUserDialog(returnToUrl: String) = PostJsonAction(maxLength = 1000) {
        request: JsonPostRequest =>
    val body = request.body
    val name = (body \ "name").as[String]
    val email = (body \ "email").as[String]
    val username = (body \ "username").as[String]
    val password = (body \ "password").asOpt[String] getOrElse
      throwBadReq("DwE85FX1", "Password missing")

    // COULD avoid replying 500 Internal Error if user already exists!
    val dao = daoFor(request.request)
    val userData =
      NewPasswordUserData.create(name = name, email = email, username = username,
          password = password) match {
        case Good(data) => data
        case Bad(errorMessage) =>
          throwUnprocessableEntity("DwE805T4", s"$errorMessage, please try again.")
      }

    val user = dao.createPasswordUser(userData)

    val (_, _, sidAndXsrfCookies) = debiki.Xsrf.newSidAndXsrf(user)
    val userConfigCookie = ConfigUserController.userConfigCookie(user)
    val newSessionCookies = userConfigCookie :: sidAndXsrfCookies

    // This dialog is always submitted via Ajax.
    assErrIf(!isAjax(request.request), "DwEDK3903")
    val result =
      if (returnToUrl.nonEmpty)
        Redirect(returnToUrl, AjaxFriendlyRedirectStatusCode)
      else
        Ok

    result.withCookies(newSessionCookies: _*)
  }

}
