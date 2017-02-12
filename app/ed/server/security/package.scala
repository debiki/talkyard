/**
 * Copyright (C) 2011-2017 Kaj Magnus Lindberg
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
import com.debiki.core.Prelude._
import debiki.DebikiHttp._
import debiki.ReactRenderer
import ed.server.http.{JsonOrFormDataBody, realOrFakeIpOf}
import java.{util => ju}
import play.api.mvc.Cookie
import play.api.Logger
import scala.util.Try


package object security {

  /**
   * Finds the session id and any xsrf token in the specified request;
   * throws an error if this is not a GET request and the xsrf token is bad.
   * @return The current SID and xsrf token. Or new ones if needed (with no
   * no user, no display name), and a new SID and xsrf cookie.
   * @throws DebikiHttp.ResultException, for non-GET requests,
   * if the SID or the XSRF token is bad.
   *
   * However, for GET request where `maySetCookies` is false, and there
   * is no XSRF cookie, creates no new cookies, and returns XsrfOk("").
   * (No cookies should be set if the response might be cached by a proxy
   * server.)
   */
  def checkSidAndXsrfToken(request: play.api.mvc.Request[_], siteId: SiteId,
        maySetCookies: Boolean)
        : (SidStatus, XsrfOk, List[Cookie]) = {

    val sidCookieValOpt = urlDecodeCookie(SessionIdCookieName, request)
    val sidStatus: SidStatus =
      sidCookieValOpt.map(checkSessionId(siteId, _)) getOrElse SidAbsent

    // On GET requests, simply accept the value of the xsrf cookie.
    // (On POST requests, however, we check the xsrf form input value)
    val xsrfCookieValOpt = urlDecodeCookie(XsrfCookieName, request)

    val sidXsrfNewCookies: (SidStatus, XsrfOk, List[Cookie]) =
      if (request.method == "GET") {
        // Accept this request, and create new XSRF token if needed.

        if (!sidStatus.isOk)
          Logger.warn(s"Bad SID: $sidStatus, from IP: ${realOrFakeIpOf(request)}")

        val (xsrfOk: XsrfOk, anyNewXsrfCookie: List[Cookie]) =
          if (xsrfCookieValOpt.isDefined) {
            (XsrfOk(xsrfCookieValOpt.get), Nil)
          }
          else if (!maySetCookies) {
            // No XSRF token available, and none needed, since this
            // a GET request.
            (XsrfOk(""), Nil)
          }
          else {
            val newXsrfOk = createXsrfToken()
            val cookie = urlEncodeCookie(XsrfCookieName, newXsrfOk.value)
            (newXsrfOk, List(cookie))
          }

        (sidStatus, xsrfOk, anyNewXsrfCookie)
      }
      else {
        // Reject this request if the XSRF token is invalid,
        // or if the SID is corrupt (but not if simply absent).

        if (request.method != "POST")
          throwForbidden("DwE44FJ50", s"Bad request method: ${request.method}")

        assert(maySetCookies)

        // There must be an xsrf token in a certain header, or in a certain
        // input in any POST:ed form data. Check the header first, in case
        // this is a JSON request (then there is no form data).
        var xsrfToken = request.headers.get(AngularJsXsrfHeaderName) orElse {
          if (request.body.isInstanceOf[Map[String, Seq[String]]]) {
            val params = request.body.asInstanceOf[Map[String, Seq[String]]]
            params.get(debiki.HtmlUtils.XsrfTokenInputName).map(_.head)
          }
          else if (request.body.isInstanceOf[JsonOrFormDataBody]) {
            val body = request.body.asInstanceOf[JsonOrFormDataBody]
            body.getFirst(debiki.HtmlUtils.XsrfTokenInputName)
          }
          else if (request.body.isInstanceOf[String]) {
            val xsrfToken = request.body.asInstanceOf[String].takeWhile(_ != '\n') // [7GKW20TD]
            if (xsrfToken.nonEmpty) Some(xsrfToken)
            else None
          }
          else {
            None
          }
        } getOrElse
            throwForbidden("DwE0y321", "No XSRF token")

        val xsrfOk = {
          val xsrfStatus = checkXsrfToken(xsrfToken, xsrfCookieValOpt)

          if (!xsrfStatus.isOk) {
            // Create a new XSRF cookie so whatever-the-user-attempted
            // will work, should s/he try again.
            // (If Javascript is enabled, debiki.js should detect logins
            // in other browser tabs, and then check the new SID cookie and
            // refresh XSRF tokens in any <form>s.)
            val newXsrfCookie =
              urlEncodeCookie(XsrfCookieName, createXsrfToken().value)

            // If this request is indeed part of one of Mallory's XSRF attacks,
            // the cookie still won't be sent to Mallory's web page, so creating
            // a new token should be safe. However, it makes it possible for
            // Mallory to conduct a DoS attack against [the user that makes
            // this request], if the user has Javascript disabled (since
            // Malory can change the user's XSRF token by attempting an XSRF
            // attack, but the web page cannot update the XSRF form <input>s
            // with the new value). This feels rather harmless though, and I
            // think it's more likely that I change the server side code in
            // some manner (e.g. I'm thinking about rejecting XSRF tokens that
            // are very old) and then it's a good thing that a new valid
            // token be created here. (?)

            val theProblem = xsrfCookieValOpt.isDefined ? "Bad XSRF token" | "No XSRF cookie"
            throw ResultException(ForbiddenResult(
              "DwE35k3kU9", i"""
              |Security issue: $theProblem. Please try again:
              |  - Click any button you just clicked, again.
              |  - Or reload the page.
              |  - Or return to the previous page and reload it.
              |
              |If you reload the page, copy-paste any unsaved text to a text editor,
              |or it'll be lost on reload.
              |
              |(You now have a new XSRF token.)
              """).withCookies(newXsrfCookie))
          }
          xsrfStatus.asInstanceOf[XsrfOk]
        }

        (sidStatus) match {
          case sidOk: SidOk => (sidOk, xsrfOk, Nil)
          case SidAbsent => (SidAbsent, xsrfOk, Nil)
          case _ => throwForbidden("DwE530Rstx90", "Bad SID")
        }
      }

    sidXsrfNewCookies
  }


  /**
   * A HTTP header in which AngularJS sends any xsrf token, when AngularJS
   * posts JSON. (So you cannot rename this header.)
   */
  val AngularJsXsrfHeaderName = "X-XSRF-TOKEN"

  /** Don't rename. Is used by AngularJS: AngularJS copies the value of
    * this cookie to the HTTP header just above.
    * See: http://docs.angularjs.org/api/ng.$http, search for "XSRF-TOKEN".
    */
  val XsrfCookieName = "XSRF-TOKEN"


  def throwErrorIfPasswordTooWeak(
        password: String, username: String, fullName: Option[String], email: String) {
    val passwordStrength = ReactRenderer.calcPasswordStrength(
      password = password, username = username, fullName = fullName, email = email)
    if (!passwordStrength.isStrongEnough)
      throwBadReq("DwE4KFEK8", o"""Password not strong enough. Please go back and try again.
          Estimated crack time: ${passwordStrength.crackTimeDisplay}, for someone with
          100 computers and access to the scrypt hash.""")
  }


  /** Cleartext password allowed in tests only. Cleartext passwords must start with 'public'
    * so whenever one sees a cleartext password, one knows that it is
    * really intended to be public, for tests only (or, if not 'public...', it shouldn't be there).
    */
  def throwIfBadPassword(passwordHash: String, isTest: Boolean) {
    val array = passwordHash.split(":")
    if (array.length != 2)
      throwIllegalArgument("EsE2YPU5", "Bad password hash: no prefix")
    val prefix = array(0)
    val hash = array(1)

    if (prefix == DbDao.CleartextPrefix && !hash.startsWith("public"))
      throwIllegalArgument("EsE2YPU5",
        "Cleartext password does not start with 'public'")

    if (!isTest && prefix != DbDao.ScryptPrefix)
      throwIllegalArgument("EsE5YMP2", "Password type not allowed: " + prefix.dropRight(1))
  }



  sealed abstract class XsrfStatus { def isOk = false }
  case object XsrfAbsent extends XsrfStatus
  case object XsrfNoSid extends XsrfStatus
  case object XsrfBad extends XsrfStatus
  case class XsrfOk(value: String) extends XsrfStatus {
    override def isOk = true
  }


  private def checkXsrfToken(xsrfToken: String, xsrfCookieValue: Option[String]): XsrfStatus = {
    // COULD check date, and hash, to find out if the token is too old.
    // (Perhaps shouldn't accept e.g. 1 year old tokens?)
    // However, if we don't care about the date, this is enough:
    if (Some(xsrfToken) != xsrfCookieValue) XsrfBad
    else XsrfOk(xsrfToken)
  }


  /**
   * Generates a new XSRF token, based on the current dati and a random number.
   *
   * If the hash is correct, and the dati not too old, the token is okay.
   *
   * (The token is not based on the SID, because when a user loads his/her
   * very first page and logins for the first time, no SID is available.)
   */
  private def createXsrfToken(): XsrfOk =
    XsrfOk(
      (new ju.Date).getTime +"."+ nextRandomString().take(10))


  def createSessionIdAndXsrfToken(siteId: SiteId, userId: UserId): (SidOk, XsrfOk, List[Cookie]) = {
    // Note that the xsrf token is created using the non-base64 encoded cookie value.
    val sidOk = createSessionId(siteId, userId)
    val xsrfOk = createXsrfToken()
    val sidCookie = urlEncodeCookie(SessionIdCookieName, sidOk.value)
    val xsrfCookie = urlEncodeCookie(XsrfCookieName, xsrfOk.value)
    (sidOk, xsrfOk, sidCookie::xsrfCookie::Nil)
  }



sealed abstract class SidStatus {
  def isOk = false
  def userId: Option[UserId] = None
  def roleId: Option[UserId] = None
  def displayName: Option[String] = None
}

case object SidAbsent extends SidStatus { override def isOk = true }
case object SidBadFormat extends SidStatus
case object SidBadHash extends SidStatus
//case class SidExpired(millisAgo: Long) extends SidStatus


case class SidOk(
  value: String,
  ageInMillis: Long,
  override val userId: Option[UserId]) extends SidStatus {

  override def isOk = true

  override def roleId: Option[UserId] = userId.filter(User.isRoleId)
}


/**
 * A session id cookie is created on the first page view.
 * It is cleared on logout, and a new one generated on login.
 * Lift-Web's cookies and session state won't last across server
 * restarts and I want to be able to restart the app servers at
 * any time so I don't use Lift's stateful session stuff so very much.
 */
  val SessionIdCookieName = "dwCoSid"

  private val sidHashLength = 14
  private def secretSalt = debiki.Globals.applicationSecret
  private val _sidMaxMillis = 2 * 31 * 24 * 3600 * 1000  // two months
  //private val _sidExpireAgeSecs = 5 * 365 * 24 * 3600  // five years


  def checkSessionId(siteId: SiteId, value: String): SidStatus = {
    // Example value: 88-F7sAzB0yaaX.1312629782081.1c3n0fgykm  - no, obsolete
    if (value.length <= sidHashLength) return SidBadFormat
    val (hash, dotUseridDateRandom) = value splitAt sidHashLength
    val realHash = hashSha1Base64UrlSafe(
      s"$secretSalt.$siteId$dotUseridDateRandom") take sidHashLength
    if (hash != realHash) return SidBadHash
    dotUseridDateRandom.drop(1).split('.') match {
      case Array(userIdString, dateStr, randVal) =>
        val userId: Option[UserId] =
          if (userIdString.isEmpty) None
          else Try(userIdString.toInt).toOption orElse {
            return SidBadFormat
          }
        val ageMillis = (new ju.Date).getTime - dateStr.toLong
        SECURITY //if (ageMillis > _sidMaxMillis)  SHOULD expire the sid
        //  return SidExpired(ageMillis - _sidMaxMillis)
        SidOk(
          value = value,
          ageInMillis = ageMillis,
          userId = userId)
      case _ => SidBadFormat
    }
  }


  def createSessionId(siteId: SiteId, userId: UserId): SidOk = {
    // For now, create a SID value and *parse* it to get a SidOk.
    // This is stupid and inefficient.
    val uid = "" // for now
    val useridDateRandom =
         userId +"."+
         (new ju.Date).getTime +"."+
         (nextRandomString() take 10)
    // If the site id wasn't included in the hash, then an admin from site A would
    // be able to login as admin at site B (if they have the same user id and username).
    val saltedHash = hashSha1Base64UrlSafe(
      s"$secretSalt.$siteId.$useridDateRandom") take sidHashLength
    val value = s"$saltedHash.$useridDateRandom"

    checkSessionId(siteId, value).asInstanceOf[SidOk]
  }

}

