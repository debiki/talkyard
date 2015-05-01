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

package requests

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import debiki.dao.SiteDao
import java.{util => ju}
import play.api.mvc
import play.api.mvc.{Action => _, _}


/**
 */
abstract class DebikiRequest[A] {

  def sid: SidStatus
  def xsrfToken: XsrfOk
  def browserId: Option[BrowserId]
  def user: Option[User]
  def dao: SiteDao
  def request: Request[A]

  def tenantId = dao.siteId
  def siteId = dao.siteId

  def siteSettings = dao.loadWholeSiteSettings()

  def browserIdData = BrowserIdData(ip = ip, idCookie = browserId.map(_.cookieValue),
    fingerprint = 0) // skip for now

  def browserIdIsNew = browserId.map(_.isNew) == Some(true)

  def theUser = user_!
  def theUserId = theUser.id

  def user_! : User =
    user getOrElse throwForbidden("DwE86Wb7", "Not logged in")

  def anyRoleId = user.flatMap(_.anyRoleId)
  def theRoleId = anyRoleId getOrElse throwForbidden("DwE86Wb7", "Not authenticated")

  /**
   * The display name of the user making the request. Throws 403 Forbidden
   * if not available, i.e. if not logged in (shouldn't happen normally).
   */
  def displayName_! : String =
    sid.displayName getOrElse throwForbidden("DwE97Ik3", "Not logged in")

  def session: mvc.Session = request.session

  def ip = realOrFakeIpOf(request)

  /**
   * Approximately when the server started serving this request.
   */
  lazy val ctime: ju.Date = new ju.Date

  /**
   * The scheme, host and port specified in the request.
   *
   * For now, the scheme is hardcoded to http.
   */
  def origin: String = "http://"+ request.host

  def host = request.host

  def uri = request.uri

  def queryString = request.queryString

  def rawQueryString = request.rawQueryString

  def body = request.body

  def headers = request.headers

  def isAjax = DebikiHttp.isAjax(request)

  def isHttpPostRequest = request.method == "POST"

  def httpVersion = request.version

}

