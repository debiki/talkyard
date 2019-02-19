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

package ed.server.security

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{EdHttp, Globals}
import ed.server.http.{DebikiRequest, JsonOrFormDataBody}
import play.api.mvc.{Cookie, DiscardingCookie, Request}
import play.api.Logger
import scala.util.Try
import EdSecurity._
import ed.server.auth.MayMaybe


sealed abstract class XsrfStatus { def isOk = false }
case object XsrfExpired extends XsrfStatus
case object XsrfBad extends XsrfStatus
case object XsrfBadEmpty extends XsrfStatus
case class XsrfOk(value: String) extends XsrfStatus {
  override def isOk = true
  def unixSeconds: Long = {
    dieIf(!value.contains('.'), "TyE2ABK49Z3", value)
    value.takeWhile(_ != '.').toLong
  }
}


// RENAME to AuthnMethod,
// and AuthnMethod.ApiSecret [5BKRH02], SidOk –> SessionId, None, BadSessionIdFormat, BadSessionIdHash?
sealed abstract class SidStatus {
  def canUse = false
  def userId: Option[UserId] = None
}

case object SidAbsent extends SidStatus {
  // It's ok to do a request as a not-logged-in someone, without a session id.
  override def canUse = true
}

case object SidBadFormat extends SidStatus
case object SidBadHash extends SidStatus
case class SidExpired(minutesOld: Long, maxAgeMins: Long) extends SidStatus


case class SidOk(
  value: String,
  ageInMillis: Long,
  override val userId: Option[UserId]) extends SidStatus {

  override def canUse = true
}


/** The value of Debiki's browser id cookie, which is used e.g. to count unique page
  * visits and to mitigate vote fraud.
  * @param isNew The cookie was just set, this very HTTP request, which means
  *              it's possible that the browser has disabled cookies?
  */
case class BrowserId(cookieValue: String, isNew: Boolean)


object EdSecurity {

  /** Tracker blockers and iOS and security settings, might block cookies [NOCOOKIES],
    * might break embedded comments. So we sometimes send back headers instead, and remember
    * client side, for the current page view only.
    *
    * This header tells the server to send back the session id not as a cookie, but
    * as json in the response.
    */
  val AvoidCookiesHeaderName = "X-Ty-Avoid-Cookies"

  /** All browsers without cookie id, are rate limited together, for now.
    */
  val NoCookiesBrowserId = "NoCoBrId"

  /** If cannot use cookies.
    */
  val SessionIdHeaderName = "X-Ty-Sid"

  /**
    * A session id cookie is created on the first page view.
    * It is cleared on logout, and a new one generated on login.
    * Lift-Web's cookies and session state won't last across server
    * restarts and I want to be able to restart the app servers at
    * any time so I don't use Lift's stateful session stuff so very much.
    */
  val SessionIdCookieName = "dwCoSid"

  /** Don't rename. Is used by AngularJS: AngularJS copies the value of
    * this cookie to the HTTP header just above.
    * See: http://docs.angularjs.org/api/ng.$http, search for "XSRF-TOKEN".
    * CLEAN_UP do rename to tyCoXsrf, Angular is since long gone.
    */
  val XsrfCookieName = "XSRF-TOKEN"

  /**
    * A HTTP header in which AngularJS sends any xsrf token, when AngularJS
    * posts JSON. (So you cannot rename this header.)
    * CLEAN_UP rename to X-Ty-Xsrf, Angular is since long gone.
    */
  val XsrfTokenHeaderName = "X-XSRF-TOKEN"

  private val BrowserIdCookieName = "dwCoBrId"
}


class EdSecurity(globals: Globals) {

  import EdHttp._

  private val XsrfTokenInputName = "dw-fi-xsrf"

  /**
   * Finds the session id and any xsrf token in the specified request;
   * throws an error if this is not a GET request and the xsrf token is bad.
   * @return The current SID and xsrf token. Or new ones if needed (with no
   * no user, no display name), and a new SID and xsrf cookie.
   * @throws ResultException, for non-GET requests,
   * if the SID or the XSRF token is bad.
   *
   * However, for GET request where `maySetCookies` is false, and there
   * is no XSRF cookie, creates no new cookies, and returns XsrfOk("").
   * (No cookies should be set if the response might be cached by a proxy
   * server.)
   */
  def checkSidAndXsrfToken(request: play.api.mvc.Request[_], siteId: SiteId,
        expireIdleAfterMins: Long, maySetCookies: Boolean)
        : (SidStatus, XsrfOk, List[Cookie]) = {

    val expireIdleAfterMillis: Long = expireIdleAfterMins * 60L * 1000L

    // If we cannot use cookies, then the sid is sent in a header. [NOCOOKIES]
    val anySessionIdCookieValue =
      urlDecodeCookie(SessionIdCookieName, request) orElse request.headers.get(SessionIdHeaderName)

    val now = globals.now()

    val sessionIdStatus: SidStatus =
      anySessionIdCookieValue.map(
        checkSessionId(
          siteId, _, now, expireIdleAfterMillis = expireIdleAfterMillis)) getOrElse SidAbsent

    // On GET requests, simply accept the value of the xsrf cookie.
    // (On POST requests, however, we check the xsrf form input value)
    val anyXsrfCookieValue = urlDecodeCookie(XsrfCookieName, request)

    val sidXsrfNewCookies: (SidStatus, XsrfOk, List[Cookie]) =
      if (request.method == "GET") {
        // Accept this request, and create new XSRF token if needed.

        if (!sessionIdStatus.canUse && !sessionIdStatus.isInstanceOf[SidExpired])
          Logger.warn(s"Bad SID: $sessionIdStatus, from IP: ${realOrFakeIpOf(request)}")

        val (xsrfOk: XsrfOk, anyNewXsrfCookie: List[Cookie]) =
          if (anyXsrfCookieValue.isDefined) {
            (XsrfOk(anyXsrfCookieValue.get), Nil)
          }
          else if (!maySetCookies) {
            // No XSRF token available, and none needed, since this a GET request. [2WKA40]
            // Also, this makes [privacy-badger] happy. [NOCOOKIES]
            // Could set the xsrf token to any xsrf header value? But then ought to check if
            // it's been properly crypto hash signed — would be better to avoid (don't want to
            // compute hashes if not needed anyway).
            (XsrfOk(""), Nil)
          }
          else {
            val newXsrfOk = createXsrfToken()
            val cookie = urlEncodeCookie(XsrfCookieName, newXsrfOk.value)
            (newXsrfOk, List(cookie))
          }

        (sessionIdStatus, xsrfOk, anyNewXsrfCookie)
      }
      else {
        // Reject this request if the XSRF token is invalid,
        // or if the SID is corrupt (but not if simply absent).

        if (request.method != "POST")
          throwForbidden("TyEBADREQMTD", s"Bad request method: ${request.method}")

        // There must be an xsrf token in a certain header, or in a certain
        // input in any POST:ed form data. Check the header first, in case
        // this is a JSON request (then there is no form data).
        var xsrfToken = request.headers.get(XsrfTokenHeaderName) orElse {
          request.body match {
            case params: Map[String, Seq[String]] =>
              params.get(XsrfTokenInputName).map(_.head)
            case body: JsonOrFormDataBody =>
              body.getFirst(XsrfTokenInputName)
            case str: String =>
              val xsrfToken = str.takeWhile(_ != '\n') // [7GKW20TD]
              if (xsrfToken.nonEmpty) Some(xsrfToken)
              else None
            case _ =>
              None
          }
        } getOrElse
            throwForbidden("TyE0XSRFTKN", "No xsrf token")

        val xsrfOk = {
          val xsrfStatus =
            checkXsrfToken(
              xsrfToken, anyXsrfCookieValue, now, expireIdleAfterMillis = expireIdleAfterMillis)

          def helpText(theProblem: String, nowHaveOrWillGet: String): String = i"""
            |Security issue: $theProblem. Please try again:
            |  - Click any button you just clicked, again.
            |  - Or reload the page.
            |  - Or return to the previous page and reload it.
            |
            |If you reload the page, copy-paste any unsaved text to a text editor,
            |or it'll be lost on reload.
            |
            |(You $nowHaveOrWillGet a new XSRF token.)
            """

          if (!xsrfStatus.isOk && !maySetCookies) {
            // This can happen if the same browser window is open so long, so that the
            // xsrfTokenIfNoCookies expires.
            val (theProblem, errorCode)  =
              if (xsrfStatus == XsrfExpired) ("xsrf token expired", "TyEXSRFEXP1")
              else if (xsrfStatus == XsrfBadEmpty) ("xsrf token empty", "TyEXSRFEMPTY1")
              else ("bad xsrf token", "TyEXSRFBAD1")

            throwForbidden(
                errorCode, helpText(theProblem, "will get"))
          }
          else if (!xsrfStatus.isOk) {
            // Can happen for example if the xsrf token expires. Or if the server restarts,
            // with a new app secret.

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

            val (theProblem, errorCode) =
              if (xsrfStatus == XsrfExpired) ("xsrf token expired", "TyEXSRFEXP_")
              else if (xsrfStatus == XsrfBadEmpty) ("xsrf token empty", "TyEXSRFEMPTY2")
              else if (anyXsrfCookieValue.isEmpty) ("no xsrf double submit cookie", "TyE0XSRFCO")
              else ("xsrf token doesn't match double submit cookie", "TyEXSRFCOMISM")

            throw ResultException(ForbiddenResult(
              errorCode, helpText(theProblem, "now have")).withCookies(newXsrfCookie))
          }

          xsrfStatus.asInstanceOf[XsrfOk]
        }

        sessionIdStatus match {
          case s: SidOk => (s, xsrfOk, Nil)
          case SidAbsent => (SidAbsent, xsrfOk, Nil)
          case s: SidExpired => (s, xsrfOk, Nil)
          case _ => throwForbidden("TyEBADSID", "Bad SID")
        }
      }

    sidXsrfNewCookies
  }


  private val MinOwnerPasswordLength = 10

  def throwErrorIfPasswordBad(
        password: String, username: String, fullName: Option[String], email: String,
        minPasswordLength: Int, isForOwner: Boolean) {

    // **The below checks aren't so important** — this is already done client side via zxcvbn.
    // Here, just quick double checks. (Only maybe reserved-words isn't totally done
    // by zxcvbn?)

    throwBadRequestIf(isForOwner && password.length < MinOwnerPasswordLength,
        "TyEADMPWMIN_", o"""Password too short, should be min $MinOwnerPasswordLength chars
        for you, because you're the community owner. (And at least $minPasswordLength for others.)""")

    throwBadRequestIf(password.length < minPasswordLength,
      "TyEPWMIN_", s"Password too short, should be $minPasswordLength chars")

    def fairlyMuchLongerThan(word: String) =
      (password.length - word.length) >= (if (isForOwner) 6 else 4)

    ReservedNames.includesReservedWord(password) foreach { theWord =>
      throwBadRequestIf(!fairlyMuchLongerThan(theWord),
          "TyE3WKB10", s"Password too simple, includes a reserved word: '$theWord' [TyEPWDSMPL]")
    }

    val lowercasePwd = password.toLowerCase

    if (lowercasePwd.indexOf(username.toLowerCase) >= 0 && !fairlyMuchLongerThan(username))
      throwBadReq("TyE3WKB10", s"The password includes your username: '$username' [TyEPWDUSN]")

    // Client side, zxcvbn does a better check.
    if (fullName.isDefined && lowercasePwd.indexOf(fullName.get.toLowerCase) >= 0
        && !fairlyMuchLongerThan(fullName.get))
      throwBadReq("TyE3WKB10", "The password includes your name [TyEPWDFLN]")

    if (lowercasePwd.indexOf(email.toLowerCase) >= 0 && !fairlyMuchLongerThan(email))
      throwBadReq("TyE3WKB10", "Password includes email [TyEPWDEML]")

    // If it's too long, then it's not a password? It's some other weird thing, perhaps bad?
    if (password.length > 80)
      throwBadReq("Password too long (80 chars max) [TyEPWDMAX]")

    /* Server side pwd check disabled  CLEAN_UP remove
    val passwordStrength = Nashorn.calcPasswordStrength(
      password = password, username = username, fullName = fullName, email = email)
    if (!passwordStrength.isStrongEnough)
      throwBadReq("DwE4KFEK8", o"""Password not strong enough. Please go back and try again.
          Estimated crack time: ${passwordStrength.crackTimeDisplay}, for someone with
          100 computers and access to the scrypt hash.""")
          */
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



  private def checkXsrfToken(xsrfToken: String, anyXsrfCookieValue: Option[String],
      now: When, expireIdleAfterMillis: Long): XsrfStatus = {
    SECURITY; TESTS_MISSING // that tests if the wrong hashes are rejected

    // Check matches cookie, or that there's an ok crypto hash.
    var xsrfOk: XsrfOk = anyXsrfCookieValue match {
      case Some(xsrfCookieValue) =>
        // The Double Submit Cookie pattern [4AW2J7], usually also the Custom Request Header pattern, see:
        // https://www.owasp.org/index.php/Cross-Site_Request_Forgery_(CSRF)_Prevention_Cheat_Sheet
        if (xsrfCookieValue != xsrfToken) {
          return XsrfBad
        }
        if (xsrfToken.isEmpty) {
          return XsrfBadEmpty // probably cannot happen
        }
        XsrfOk(xsrfToken)
      case None =>
        // The Encrypted Token Pattern, usually also the Custom Request Header pattern.
        val hashIndex: Int = xsrfToken.length - HashLength
        if (hashIndex < 1) {
          return XsrfBad
        }
        val value = xsrfToken.take(hashIndex - 1) // drops the dot between value and hash
        val actualHash = xsrfToken.drop(hashIndex)
        val correctHashFullLength = hashSha1Base64UrlSafe(value + secretSalt)
        val correctHash = correctHashFullLength take HashLength
        if (correctHash != actualHash) {
          return XsrfBad
        }
        XsrfOk(value)
    }

    // Check isn't too old.
    val unixSeconds = xsrfOk.unixSeconds
    val millisAgo = now.millisSince(When.fromMillis(unixSeconds * 1000L))
    if (millisAgo > expireIdleAfterMillis)
      return XsrfExpired

    xsrfOk
  }


  /**
   * Generates a new XSRF token, based on the current date-time and a random number.
   *
   * If the hash is correct, and the date-time not too old, the token is okay.
   *
   * (The token is not based on the SID, because when a user loads his/her
   * very first page and logins for the first time, no SID is available.)
   */
  def createXsrfToken(): XsrfOk = {
    COULD_OPTIMIZE // skip the secure hash, when using the Double Submit Cookie pattern [4AW2J7].
    XsrfOk(timeDotRandomDotHash())  // [2AB85F2]
  }


  def createSessionIdAndXsrfToken(siteId: SiteId, userId: UserId): (SidOk, XsrfOk, List[Cookie]) = {
    COULD_OPTIMIZE // pass settings or a dao to here instead? so won't need to create this 2nd one.
                    // (the caller always already has one)
    val dao = globals.siteDao(siteId)
    val settings = dao.getWholeSiteSettings()
    val expireIdleAfterSecs = settings.expireIdleAfterMins * 60

    // Note that the xsrf token is created using the non-base64 encoded cookie value.
    val sidOk = createSessionId(siteId, userId)
    val xsrfOk = createXsrfToken()
    val sidCookie = urlEncodeCookie(SessionIdCookieName, sidOk.value,
      maxAgeSecs = Some(expireIdleAfterSecs))
    val xsrfCookie = urlEncodeCookie(XsrfCookieName, xsrfOk.value)
    (sidOk, xsrfOk, sidCookie::xsrfCookie::Nil)
  }


  private val HashLength: Int = 15
  private def secretSalt = globals.applicationSecret


  private def checkSessionId(siteId: SiteId, value: String, now: When, expireIdleAfterMillis: Long)
      : SidStatus = {
    // Example value: 88-F7sAzB0yaaX.1312629782081.1c3n0fgykm  - no, obsolete
    if (value.length <= HashLength) return SidBadFormat
    val (hash, dotUseridDateRandom) = value splitAt HashLength
    val realHash = hashSha1Base64UrlSafe(
      s"$secretSalt.$siteId$dotUseridDateRandom") take HashLength
    if (hash != realHash) return SidBadHash
    dotUseridDateRandom.drop(1).split('.') match {
      case Array(userIdString, dateStr, randVal) =>
        val userId: Option[UserId] =
          if (userIdString.isEmpty) None
          else Try(userIdString.toInt).toOption orElse {
            return SidBadFormat
          }
        val ageMillis = now.millis - dateStr.toLong
        UX; BUG; COULD; // [EXPIREIDLE] this also expires *active* sessions. Instead,
        // lookup the user, and consider only time elapsed, since hens last visit.
        // ... Need to have a SiteDao here then. And pass the Participant back to the
        // caller, so it won't have to look it up again.
        // Not urgent though — no one will notice: by default, one stays logged in 1 year [7AKR04].
        if (ageMillis > expireIdleAfterMillis)
          return SidExpired(
            minutesOld = ageMillis / MillisPerMinute,
            maxAgeMins = expireIdleAfterMillis / MillisPerMinute)
        SidOk(
          value = value,
          ageInMillis = ageMillis,
          userId = userId)
      case _ => SidBadFormat
    }
  }


  private def createSessionId(siteId: SiteId, userId: UserId): SidOk = {
    // For now, create a SID value and *parse* it to get a SidOk.
    // This is stupid and inefficient.
    val now = globals.now()
    val uid = "" // for now
    val useridDateRandom =
         userId +"."+
         now.millis +"."+
         (nextRandomString() take 10)
    // If the site id wasn't included in the hash, then an admin from site A would   [4WKRQ1A]
    // be able to login as admin at site B (if they have the same user id and username).
    val saltedHash = hashSha1Base64UrlSafe(
      s"$secretSalt.$siteId.$useridDateRandom") take HashLength
    val value = s"$saltedHash.$useridDateRandom"

    checkSessionId(siteId, value, now, expireIdleAfterMillis = Long.MaxValue).asInstanceOf[SidOk]
  }


  // ----- Secure cookies

  def SecureCookie(name: String, value: String, maxAgeSeconds: Option[Int] = None,
        httpOnly: Boolean = false) =
    Cookie(name, value, maxAge = maxAgeSeconds, secure = globals.secure, httpOnly = httpOnly)

  def DiscardingSecureCookie(name: String) =
    DiscardingCookie(name, secure = globals.secure)

  def DiscardingSessionCookie: DiscardingCookie = DiscardingSecureCookie("dwCoSid")

  // Two comments on the encoding of the cookie value:
  // 1. If the cookie contains various special characters
  // (whitespace, any of: "[]{]()=,"/\?@:;") it will be
  // sent as a Version 1 cookie (by javax.servlet.http.Cookie),
  // then it is surrounded with quotes.
  // the jQuery cookie plugin however expects an urlencoded value:
  // 2. urlEncode(value) results in these cookies being sent:
  //    Set-Cookie: dwCoUserEmail="kajmagnus79%40gmail.com";Path=/
  //    Set-Cookie: dwCoUserName="Kaj%20Magnus";Path=/
  // No encoding results in these cookies:
  //    Set-Cookie: dwCoUserEmail=kajmagnus79@gmail.com;Path=/
  //    Set-Cookie: dwCoUserName="Kaj Magnus";Path=/
  // So it seems a % encoded string is surrounded with double quotes, by
  // javax.servlet.http.Cookie? Why? Not needed!, '%' is safe.
  // So I've modified jquery-cookie.js to remove double quotes when
  // reading cookie values.
  def urlEncodeCookie(name: String, value: String, maxAgeSecs: Option[Int] = None) = Cookie(
    name = name,
    value = urlEncode(convertEvil(value)),  // see comment above
    maxAge = maxAgeSecs,
    path = "/",
    domain = None,
    secure = globals.secure,
    httpOnly = false)


  /** Extracts any browser id cookie from the request, or creates it if absent
    * and is a POST request.
    */
  def getBrowserIdCookieMaybeCreate(request: Request[_]): (Option[BrowserId], List[Cookie]) = {
    val anyBrowserIdCookieValue = getAnyBrowserIdCookieValue(request)
    if (anyBrowserIdCookieValue.isDefined) {
      (Some(BrowserId(anyBrowserIdCookieValue.get, isNew = false)), Nil)
    }
    else if (request.method == "GET" || request.method == "OPTIONS" || request.method == "HEAD") {
      // Probably harmless, don't need to remember the browser.
      (None, Nil)
    }
    else {
      // This request tries to do something (POST request). Try to remember the browser, so
      // can maybe block or rate limit it, if needed. And maybe detect astroturfing.
      createBrowserIdCookie()
    }
  }

  def getAnyBrowserIdCookieValue(request: Request[_]): Option[String] =
    request.cookies.get(BrowserIdCookieName).map(_.value)


  private def createBrowserIdCookie(): (Some[BrowserId], List[Cookie]) = {
    val cookieValue = timeDotRandomDotHash()  // [2AB85F2]
    val newCookie = SecureCookie(
      name = BrowserIdCookieName,
      value = cookieValue,
      maxAgeSeconds = Some(3600 * 24 * 365 * 5),
      httpOnly = true)
    (Some(BrowserId(cookieValue, isNew = true)), List(newCookie))
  }


  /** Returns something like:  12345.randomChars.123def — the first part, is the unix time,
    * in seconds. The second part is random chars. The last is a dot and
    * a crypto hash of the two first parts + the app secret.
    */
  private def timeDotRandomDotHash(): String = {
    val timeDotRandom = globals.now().seconds + "." + nextRandomString().take(12)
    val hash = hashSha1Base64UrlSafe(timeDotRandom + secretSalt).take(HashLength)
    s"$timeDotRandom.$hash"  // does *not* incl the secretSalt
  }

  // ----- Secure Not-fond and No-may-not

  /** Use this if page not found, or the page is private and we don't want strangers
    * to find out that it exists. [7C2KF24]
    */
  def throwIndistinguishableNotFound(devModeErrCode: String = ""): Nothing = {
    val suffix =
      if (!globals.isProd && devModeErrCode.nonEmpty) s"-$devModeErrCode"
      else ""
    throwNotFound("EsE404" + suffix, "Page not found")
  }

  def throwNoUnless(mayMaybe: MayMaybe, errorCode: String) {
    import MayMaybe._
    mayMaybe match {
      case Yes => // fine
      case NoNotFound(debugCode) => throwIndistinguishableNotFound(debugCode)
      case NoMayNot(code2, reason) => throwForbidden(s"$errorCode-$code2", reason)
    }
  }


  // ----- Magic passwords


  /** The real ip address of the client, unless a fakeIp url param or dwCoFakeIp cookie specified
    * In prod mode, an e2e test password cookie is required.
    *
    * (If 'fakeIp' is specified, actions.SafeActions.scala copies the value to
    * the dwCoFakeIp cookie.)
    */
  def realOrFakeIpOf(request: play.api.mvc.Request[_]): String = {
    val fakeIpQueryParam = request.queryString.get("fakeIp").flatMap(_.headOption)
    val fakeIp = fakeIpQueryParam.orElse(
      request.cookies.get("dwCoFakeIp").map(_.value))  getOrElse {
      return request.headers.get("X-Real-IP") getOrElse request.remoteAddress
    }

    if (globals.isProd) {
      def where = fakeIpQueryParam.isDefined ? "in query param" | "in cookie"
      val password = getE2eTestPassword(request) getOrElse {
        throwForbidden(
          "DwE6KJf2", s"Fake ip specified $where, but no e2e test password — required in prod mode")
      }
      val correctPassword = globals.e2eTestPassword getOrElse {
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
        val correctPassword = globals.e2eTestPassword getOrElse throwForbidden(
          "EsE5GUM2", "There's an e2e test password in the request, but not in any config file")
        if (password != correctPassword) {
          throwForbidden("EsE2FWK4", "The e2e test password in the request is wrong")
        }
        true
    }
  }


  def getForbiddenPassword(request: DebikiRequest[_]): Option[String] =
    request.queryString.get("forbiddenPassword").flatMap(_.headOption).orElse(
      request.cookies.get("esCoForbiddenPassword").map(_.value))


  def hasOkForbiddenPassword(request: DebikiRequest[_]): Boolean = {
    getForbiddenPassword(request) match {
      case None => false
      case Some(password) =>
        val correctPassword = globals.forbiddenPassword getOrElse throwForbidden(
          "EsE48YC2", "There's a forbidden-password in the request, but not in any config file")
        if (password != correctPassword) {
          throwForbidden("EsE7UKF2", "The forbidden-password in the request is wrong")
        }
        true
    }
  }
}

