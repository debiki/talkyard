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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import io.efdi.server.http._
import javax.inject.Inject
import play.api._
import play.api.mvc.{Action => _, _}
import DebikiHttp._



/** Loads the admin app page.
  */
class AdminController @Inject() extends mvc.Controller {


  def redirectToAdminPage() = GetAction { request =>
    Redirect(routes.AdminController.viewAdminPage("").url)
  }


  def viewAdminPage(whatever: String) = GetAction { apiReq =>
    dieIfAssetsMissingIfDevTest()

    if (!apiReq.user.exists(_.isStaff)) {
      Ok(views.html.login.loginPopup(
        SiteTpi(apiReq),
        mode = "LoginToAdministrate",
        serverAddress = s"//${apiReq.host}",
        returnToUrl = apiReq.uri)) as HTML
      // "Login as administrator to access this page."
    }
    else {
      val siteTpi = SiteTpi(apiReq)
      val adminPageBody = views.html.adminPage(siteTpi, appId = "dw-react-admin-app").body
      Ok(adminPageBody) as HTML withCookies (
        SecureCookie(
          DebikiSecurity.XsrfCookieName, apiReq.xsrfToken.value))
    }
  }

}
