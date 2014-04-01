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



/** Shows the administrator, the moderator and the designer pages.
  */
object AdminController extends mvc.Controller {


  // Remove later.
  def viewAdminPageOld() = GetAction { apiReq =>
    if (apiReq.user.map(_.isAdmin) != Some(true))
      Ok(views.html.login.loginPage(xsrfToken = apiReq.xsrfToken.value,
        returnToUrl = apiReq.uri, title = "Login", message = Some(
          "Login as administrator to access this page.")))
    else
      Ok(views.html.adminPage(apiReq.host).body) as HTML withCookies (
        mvc.Cookie(
          DebikiSecurity.XsrfCookieName, apiReq.xsrfToken.value,
          httpOnly = false))
  }


  def viewAdminPage = redirectTo("admin.html")
  def viewModeratorPage = redirectTo("moderate.html")
  def viewDesignerPage = redirectTo("design.html")


  /** Redirects to a plain HTML file that loads Google Dart files that have been
    * converted to Javascript. The files are located in the asset versioning path;
    * they'll be cached by the browser forever (well, a month or a year perhaps).
    *
    * Currently I think it's not possible to serve a page filtered by Play's
    * Scala Templates, because such a page would break when debugging from within
    * Dart Editor, which serves the files as plain HTML. Later on, when Google
    * Chrome supports Dart, perhaps it'll be possible to debug Dart via
    * standard Chrome Play Framework generated Scala templates.
    */
  private def redirectTo(pageSlug: String) = GetAction { apiReq =>
    // In the future: Check moderator / designer permissions instead, depending on
    // which page is requested.
    if (apiReq.user.map(_.isAdmin) != Some(true)) {
      val message =
        apiReq.user match {
          case None =>
            "Login as administrator to access this page."
          case Some(user) =>
            o"""Login as administrator to access this page. You are logged in
              as user ${user.displayName}, but that is not an administrator."""
        }
      Ok(views.html.login.loginPage(xsrfToken = apiReq.xsrfToken.value,
        returnToUrl = apiReq.uri, title = "Login", message = Some(message)))
    }
    else {
      TemporaryRedirect(routes.Assets.at("/public/res", s"admin-dart-build/web/$pageSlug").url)
        .withCookies(mvc.Cookie(
          DebikiSecurity.XsrfCookieName, apiReq.xsrfToken.value,
          httpOnly = false))
    }
  }


  /** When debugging Dart apps, they run on DartEditor's built in web server's
    * port 3030, so we need to allow CORS requests from that origin to Debiki Server
    * on port 9000. This method is part of making such requests of type POST possible:
    * it handles the CORS preflight request. [DartEditor]
    * Related reading: http://stackoverflow.com/a/8689332/694469
    */
  def handleDartEditorCorsPreflight(path: String) = GetAction { request =>
    if (!Play.isDev)
      throwForbidden("DwE7730F0", "CORS only allowed in development mode")

    // Class SafeActions adds headers Access-Control-Allow-Origin and -Credentials.
    Ok.withHeaders(
      "Access-Control-Allow-Methods" -> "GET, POST, PUT, DELETE, HEAD",
      "Access-Control-Allow-Headers" ->
        request.headers.get("Access-Control-Request-Headers").getOrElse(""))
  }

}
