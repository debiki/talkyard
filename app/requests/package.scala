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

import play.api.Play
import play.api.Play.current
import play.api.libs.json.JsValue
import debiki.DebikiHttp.throwForbidden


package object requests {


  /** A request with no post data.
    */
  type GetRequest = ApiRequest[Unit]


  /** A request with form data.
    * @deprecated Use ApiRequest[JsonOrFormDataBody] instead.
    */
  type FormDataPostRequest = ApiRequest[Map[String, Seq[String]]]


  type JsonPostRequest = ApiRequest[JsValue]


  /**
   * A PageRequest with no post data.
   */
  type PageGetRequest = PageRequest[Unit]


  /**
   * A PageRequest with post data.
   */
  @deprecated
  type PagePostRequest = PageRequest[Map[String, Seq[String]]]


  /** The real ip address of the client, unless a fakeIp url param or dwCoFakeIp cookie specified
    * In prod mode, an e2e test password cookie is required.
    *
    * (If 'fakeIp' is specified, actions.SafeActions.scala copies the value to
    * the dwCoFakeIp cookie.)
    */
  def realOrFakeIpOf(request: play.api.mvc.Request[_]): String = {
    val fakeIp = request.queryString.get("fakeIp").flatMap(_.headOption).orElse(
      request.cookies.get("dwCoFakeIp").map(_.value))  getOrElse {
        return request.remoteAddress
      }

    if (Play.isProd) {
      val password = getE2eTestPassword(request) getOrElse {
        throwForbidden(
          "DwE6KJf2", "Fake ip specified, but no e2e test password cookie — required in prod mode")
      }
      val correctPassword = debiki.Globals.e2eTestPassword getOrElse {
        throwForbidden(
          "DwE7KUF2", "Fake ips not allowed, because no e2e test password has been configured")
      }
      if (password != correctPassword) {
        throwForbidden(
          "DwE2YUF2", "Fake ip forbidden: Wrong e2e test password")
      }
    }

    // Dev or test mode, or correct password, so:
    fakeIp
  }


  def getE2eTestPassword(request: play.api.mvc.Request[_]): Option[String] =
    request.queryString.get("e2eTestPassword").flatMap(_.headOption).orElse(
      request.cookies.get("dwCoE2eTestPassword").map(_.value)).orElse( // dwXxx obsolete. esXxx now
      request.cookies.get("esCoE2eTestPassword").map(_.value))


  def hasOkE2eTestPassword(request: play.api.mvc.Request[_]): Boolean = {
    getE2eTestPassword(request) match {
      case None => false
      case Some(password) =>
        val correctPassword = debiki.Globals.e2eTestPassword getOrElse throwForbidden(
          "EsE5GUM2", "There's an e2e test password in the request, but not in any config file")
        if (password != correctPassword) {
          throwForbidden("EsE2FWK4", "The e2e test password in the request is wrong")
        }
        true
    }
  }
}
