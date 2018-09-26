/**
 * Copyright (c) 2013-2014, 2018 Kaj Magnus Lindberg
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

import debiki._
import ed.server._
import ed.server.http.ApiRequest
import ed.server.security.EdSecurity
import javax.inject.Inject
import play.api.mvc.{Action, ControllerComponents, Result}
import scala.concurrent.Future



/** Loads the admin app page.
  */
class AdminController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.security.SecureCookie


  def redirectToAdminPage(): Action[Unit] = GetAction { _ =>
    Redirect(routes.AdminController.viewAdminPage("").url)
  }


  def viewAdminPage(whatever: String): Action[Unit] = AsyncGetAction { apiReq =>
    dieIfAssetsMissingIfDevTest()

    if (!apiReq.user.exists(_.isStaff)) {
      Future.successful(Ok(views.html.login.loginPopup(
        SiteTpi(apiReq),
        mode = "LoginToAdministrate",
        serverAddress = s"//${apiReq.host}",
        returnToUrl = apiReq.uri)) as HTML)
    }
    else {
      showAdminApp(apiReq)
    }
  }


  def testSso(): Action[Unit] = AsyncGetAction { apiReq =>
    showAdminApp(apiReq)
  }


  def showAdminApp(apiReq: ApiRequest[_]): Future[Result] = {
    val siteTpi = SiteTpi(apiReq, isAdminArea = true)
    val adminPageHtmlStr = views.html.adminPage(siteTpi, appId = "dw-react-admin-app").body
    ViewPageController.addVolatileJsonAndPreventClickjacking2(adminPageHtmlStr,
      unapprovedPostAuthorIds = Set.empty, apiReq) map { response =>
      response withCookies SecureCookie(
        EdSecurity.XsrfCookieName, apiReq.xsrfToken.value)
    }
  }

}
