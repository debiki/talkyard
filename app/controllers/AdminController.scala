/**
 * Copyright (C) 2013-2014 Kaj Magnus Lindberg (born 1979)
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
import actions.PageActions._
import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.Utils.OkSafeJson
import debiki._
import java.{util => ju, io => jio}
import play.api._
import play.api.mvc.{Action => _, _}
import play.api.Play.current
import requests.PageRequest
import DebikiHttp._
import Utils.ValidationImplicits._
import Utils.{OkHtml, OkXml}



/** Loads the admin app page.
  */
object AdminController extends mvc.Controller {


  def redirectToAdminPage() = GetAction { request =>
    Redirect(routes.AdminController.viewAdminPage().url)
  }


  def viewAdminPage() = GetAction { apiReq =>
    if (!apiReq.user.exists(_.isStaff)) {
      Ok(views.html.login.loginPopup(
        mode = "LoginToAdministrate",
        serverAddress = s"//${apiReq.host}",
        returnToUrl = apiReq.uri)) as HTML
      // "Login as administrator to access this page."
    }
    else {
      val siteTpi = SiteTpi(apiReq)
      val adminPageBody = views.html.adminPage(siteTpi).body
      Ok(adminPageBody) as HTML withCookies (
        mvc.Cookie(
          DebikiSecurity.XsrfCookieName, apiReq.xsrfToken.value,
          httpOnly = false))
    }
  }


  // Remove later. (Dupl code, but I'm going to remove it anyway)
  def viewAdminPageOld() = GetAction { apiReq =>
    if (apiReq.user.map(_.isAdmin) != Some(true)) {
      Ok(views.html.login.loginPopup(
        mode = "LoginToAdministrate",
        serverAddress = s"//${apiReq.host}",
        returnToUrl = apiReq.uri)) as HTML
      // "Login as administrator to access this page."
    }
    else {
      Ok(views.html.adminPageOld(apiReq.host).body) as HTML withCookies (
        mvc.Cookie(
          DebikiSecurity.XsrfCookieName, apiReq.xsrfToken.value,
          httpOnly = false))
    }
  }

}
