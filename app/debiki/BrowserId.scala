/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

package debiki

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.DebikiHttp.SecureCookie
import java.{util => ju}
import play.api.mvc.Cookie
import play.api.mvc.Request


/** The value of Debiki's browser id cookie, which is used e.g. to count unique page
  * visits and to mitigate vote fraud.
  * @param isNew The cookie was just set, this very HTTP request, which means
  *              it's possible that the browser has disabled cookies?
  */
case class BrowserId(cookieValue: String, isNew: Boolean)


object BrowserId {

  val CookieName = "dwCoBrId"


  /** Extracts the browser id cookie from the request, or creates it if absent.
    */
  def checkBrowserId(request: Request[_]): (BrowserId, List[Cookie]) = {
    val anyBrowserIdCookieValue = request.cookies.get(CookieName).map(_.value)
    if (anyBrowserIdCookieValue.isDefined)
      (BrowserId(anyBrowserIdCookieValue.get, isNew = false), Nil)
    else
      createNewCookie()
  }


  private def createNewCookie(): (BrowserId, List[Cookie]) = {
    val unixTimeSeconds = Globals.now().seconds
    // Let's separate the timestamp from the random stuff by adding an a-z letter.
    val randomString = nextRandomAzLetter() + nextRandomString() take 7

    // SECURITY COULD prevent evil programs from submitting fake browser id cookies:
    //val hash = hashSha1Base64UrlSafe(s"$unixTimeSeconds$randomString") take 13
    //val cookieValue = s"$unixTimeSeconds$randomString$hash"
    val cookieValue = s"$unixTimeSeconds$randomString"

    val newCookie = SecureCookie(
      name = CookieName,
      value = cookieValue,
      maxAgeSeconds = Some(3600 * 24 * 365 * 20),
      httpOnly = true)

    (BrowserId(cookieValue, isNew = true), newCookie :: Nil)
  }

}

