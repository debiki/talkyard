/**
 * Copyright (c) 2013-2015 Kaj Magnus Lindberg
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

package ed.server

import com.debiki.core._
import debiki.dao.SiteDao
import ed.server.security.{BrowserId, SidStatus, XsrfOk}
import play.api.libs.json.JsValue
import play.api.mvc._


package object http {

  def OkSafeJson(json: JsValue) =
    _root_.controllers.Utils.OkSafeJson(json)


  case class ApiRequest[A](
    siteIdAndCanonicalHostname: SiteBrief,
    sid: SidStatus,
    xsrfToken: XsrfOk,
    browserId: BrowserId,
    user: Option[User],
    dao: SiteDao,
    request: Request[A]) extends DebikiRequest[A] {
  }

  /** A request with no post data. */
  type GetRequest = ApiRequest[Unit]

  type PageGetRequest = PageRequest[Unit]

  /** A request with form data.
    *
    * @deprecated Use ApiRequest[JsonOrFormDataBody] instead — no, use JsonPostRequest.
    */
  type FormDataPostRequest = ApiRequest[Map[String, Seq[String]]]

  type JsonPostRequest = ApiRequest[JsValue]


}
