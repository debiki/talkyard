/**
 * Copyright (c) 2011-2017, 2021 Kaj Magnus Lindberg
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

package talkyard.server.security

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{EdHttp, EffectiveSettings, Globals}
import talkyard.server.http.{DebikiRequest, JsonOrFormDataBody}
import play.api.mvc.{Cookie, DiscardingCookie, RequestHeader}
import scala.util.Try
import EdSecurity._
import talkyard.server.authz.MayMaybe
import play.api.http.{HeaderNames => p_HNs}
import play.api.libs.json.{JsObject, JsString, JsValue}
import talkyard.server.TyLogger
import talkyard.server.sess.SessionSiteDaoMixin
import talkyard.server.http
import talkyard.server.http.AuthnReqHeader


sealed abstract class XsrfStatus { def isOk = false }
case object XsrfExpired extends XsrfStatus
case object XsrfBad extends XsrfStatus
case object XsrfBadEmpty extends XsrfStatus
case class XsrfOk(value: St) extends XsrfStatus {
  override def isOk = true
}


private case class CheckSidResult(
  anyTySession: Opt[TySession],
  sidStatus: SidStatus,
  createCookies: List[Cookie] = Nil,
  discardCookies: List[DiscardingCookie] = Nil)


private object CheckSidResult {
  def noSession(
        sidStatus: SidStatus,
        // discardAllSessionCookies: Bo = false,
        discardCookies: List[DiscardingCookie] = Nil): CheckSidResult = {
    dieIf(sidStatus.canUse && sidStatus != SidAbsent, "TyE2MFKJ063I")
    //dieIf(discardAllSessionCookies && discardCookies.nonEmpty, "TyE2MFKJ0632")
    CheckSidResult(
          anyTySession = None, sidStatus, discardCookies = discardCookies)
          /* Cannot access here:
              if (discardAllSessionCookies) EdSecurity.DiscardingSessionCookies.toList
              else discardCookies) */
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
case class SidExpired(
  minutesOld: i64,
  maxAgeMins: i64,
  wasForPatId: Opt[PatId]) extends SidStatus

case class SidDeleted(
  value: St,
  wasForPatId: Opt[PatId]) extends SidStatus {
}



// CLEAN_UP REFACTOR REMOVE this class? Use only TySession instead.
case class SidOk(
  // If fancy sid, is part 1 + 2 = 16 + 24 = 40 chars.
  value: String,
  ageInMillis: Long,
  override val userId: Option[UserId]) extends SidStatus {

  // We should never include session id part 3 — so check that the length is just part 1 + 2
  // or that there's a '.' — then it's an old silly sid.
  dieIf(value.length != TySession.SidLengthCharsPart12 && !value.contains('.'),
        "TyEBADSID12LEN", s"Bad session id parts 1 + 2: '$value'")

  def part1CompId: St = value take TySession.SidLengthCharsPart1

  override def canUse = true
}



/** The value of Debiki's browser id cookie, which is used e.g. to count unique page
  * visits and to mitigate vote fraud.
  * @param isNew The cookie was just set, this very HTTP request, which means
  *              it's possible that the browser has disabled cookies?
  */
case class BrowserId(cookieValue: String, isNew: Boolean)


case class CheckSidAndXsrfResult(
  anyTySession: Opt[TySession],
  sidStatus: SidStatus,
  xsrfStatus: XsrfOk,
  cookiesToAdd: List[Cookie],
  cookiesToDelete: List[DiscardingCookie])


object EdSecurity {

  /** Tracker blockers and iOS and security settings, might block cookies [NOCOOKIES],
    * might break embedded comments. So we sometimes send back headers instead, and remember
    * client side, for the current page view only.
    *
    * This header tells the server to send back the session id not as a cookie, but
    * as json in the response.
    *
    * COULD RENAME: Add suffix: "...-In-Iframe" because that's where cookies can be
    * blocked / cause the browser to not show the iframe at all.
    */
  val AvoidCookiesHeaderName = "X-Ty-Avoid-Cookies"
  val Avoid = "Avoid"

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

  // See TySession [cookie_theory].
  val SessionIdPart123CookieName = "TyCoSid123"
  val SessionIdPart4HttpOnlyCookieName = "TyCoSid4"
  val SessionIdPart5StrictCookieName = "TyCoSid5"

  val XsrfCookieName = "TyCoXsrf"

  /** Don't rename. Is used by AngularJS: AngularJS copies the value of
    * this cookie to the HTTP header just above.
    * See: http://docs.angularjs.org/api/ng.$http, search for "XSRF-TOKEN".
    *
    * REMOVE_AFTER 2025-03-01, not using Angular any more, and this cookie
    * caused collissoins with someone's custom javascript that set a cookie
    * with the same name on Ty's domain  (but with an unexpected value).
    * [old_xsrf_cookie_name]
    */
  private val OldXsrfCookieName = "XSRF-TOKEN"

  /** A HTTP header in which the browser sends any XSRF token, together with
    * POSTS requests.
    *
    * Could rename to X-Ty-Xsrf?  The current name is from when Angular was in use.
    * But maybe might as well continue using this name — what if proxies have
    * been configured to remove any unexpected headers? But since this header
    * is pretty commonly used (AngularJS uses it), it's less likely to get removed?
    */
  private val XsrfTokenHeaderName = "X-XSRF-TOKEN"

  private val BrowserIdCookieName = "dwCoBrId"

  def tooLowEntropy(value: St): Bo = {
    SECURITY // make more fancy. For now, just this:
    value.length < 10
  }

}


sealed abstract class CorsInfo {
  def isCrossOrigin: Boolean = false
  def hasCorsCreds: Boolean = false
  def isPreFlight: Boolean = false
}

object CorsInfo {
  case object NotCorsNoOriginHeader extends CorsInfo
  case class SameOrigins(requestAndTargetOrigin: String) extends CorsInfo

  case class OkayCrossOrigin(
    requestOrigin: String,
    override val hasCorsCreds: Boolean,
    override val isPreFlight: Boolean,
  ) extends CorsInfo {
    override def isCrossOrigin: Boolean = true

    // Should return Forbidden before this, then.
    dieIf(hasCorsCreds && isPreFlight, "TyE6933KR445")
  }
}


class EdSecurity(globals: Globals) {

  import EdHttp._

  private val logger = TyLogger("TySecurity")

  private val CookiePrefix = globals.cookiePrefix

  private val XsrfTokenInputName = "dw-fi-xsrf"

  /** Let the xsrf token one gets when logging in, expire a bit after the session,
    * so there won't be any weird xsrf error, before one gets logged out
    * because the sid expired. Hmm?
    */
  private val XsrfAliveExtraSeconds = 3600

  // Is this an allowed (CORS) Cross-Origin-Resource-Sharing request?
  def checkIfCorsRequest(request: RequestHeader, siteSettings: EffectiveSettings): CorsInfo = {

    val isPreFlight = request.method == "OPTIONS"

    // *For now*, only handle CORS requests to /-/v0/... so won't
    // accidentally break other endpoints, now when trying out CORS.
    if (request.path.indexOf("/-/v0/") != 0) {
      throwForbiddenIf(isPreFlight, "TyCORSPATH", "CORS only allowed in /-/v0/") // [CORSPATH]
      // We'll check cookie and xsrf token, just like before CORS support got added.
      return CorsInfo.NotCorsNoOriginHeader // (690732856Y)
    }

    // If the Origin header is *absent*, this cannot be a CORS request, because:
    // ""The `Origin` header is a version of the `Referer` [sic] header that
    //   does not reveal a path. It is used for all HTTP fetches whose
    //   request’s response tainting is "cors", as well as those where
    //   request’s method is neither `GET` nor `HEAD`. Due to compatibility
    //   constraints it is not included in all fetches.""
    // https://fetch.spec.whatwg.org/#origin-header  2020-05
    //
    // (About the Origin header:
    // ""the Origin header field indicates the origin(s) that "caused"
    //   the user agent [browser] to issue the request [...]
    //   For example, consider [a browser] that executes scripts on behalf of
    //   origins.  If one of those scripts causes the [browser] to issue an
    //   HTTP request, [the browser] MAY use the Origin header field to
    //   [tell the server from where the request comes]""
    // https://tools.ietf.org/html/rfc6454#section-7.2  2020-05
    // All modern browsers do the above, incl IE11, https://caniuse.com/#feat=cors 2020-05  )
    //
    // (Theoretically, some GET requests without Origin can be from another server,
    // e.g. for loading an image or script tag — but any script sending such requests,
    // cannot see the response. Such requests aren't CORS requests. Although there's
    // a trick with scripts called JSONP — it's obsoleted by CORS.)
    //
    val requestOrigin: String = request.headers.get(p_HNs.ORIGIN) getOrElse {
      return CorsInfo.NotCorsNoOriginHeader
    }

    // Nginx sends the host in the Host header. [ngx_host_hdr]
    // For now: (this uses the Host header too — there's no host in the request line)
    val targetHost: String = request.host
    // Later:
    //val targetHost: String = request.headers.get(p_HNs.HOST) getOrElse {
    //  throwForbidden("TyE0HOSTHDR", "Host header missing")
    //}

    throwForbiddenIf(
          isPreFlight && request.headers.get(p_HNs.ACCESS_CONTROL_REQUEST_METHOD).isEmpty,
          "TyENOTPREFL01", o"""All OPTIONS requests to here must be CORS
              pre-flight requests — but this is no pre-flight request? It has
              no ${p_HNs.ACCESS_CONTROL_REQUEST_METHOD} header""")

    // Could convert hostname to lowercase — Play Framework does that, here:
    // filters-helpers_2.12-2.8.1-sources.jar!/play/filters/cors/AbstractCORSPolicy.scala
    // in isSameOrigin() — but feels unnecessary, maybe slightly risky?
    // (Play Fmw does this:
    //    val x = new URI((if (request.secure) "https://" else "http://") +
    //        request.host.toLowerCase(Locale.ENGLISH))
    //    ...  == (x.getScheme, x.getHost, x.getPort)  )
    //
    // Require exact match instead.
    //
    // ----- Port
    //
    // Don' append:  globals.colonPort  — the Host header should include the port
    // number already, if it's non-standard:
    // >  A "host" without any trailing port information implies the default
    // >  port for the service requested (e.g., "80" for an HTTP URL).
    // https://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.23
    //
    // The Origin header also includes the port if non-standard:
    // >  <port> Optional
    // >  TCP port number on which the server is listening. If no port is given,
    // >  the default port for the service requested (e.g., "80" for an HTTP URL)
    // >  is implied.
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Origin
    //
    // (However, some programs include the port also if it's the standard one,
    // e.g. the Baidu Spider: https://stackoverflow.com/a/19169789/694469.
    // So, could:   if targetHost ends with ':80' or ':443'  also compare with
    // requestOrigin + standard port.)
    //
    val targetOrigin = globals.schemeColonSlashSlash + targetHost
    val isSameOrigin = targetOrigin == requestOrigin


    // This'd be weird?
    throwForbiddenIf(isPreFlight && isSameOrigin,
          "TyEPREFLSAMEORG", o"""I don't want pre-flight requests to the same
              origin: $targetOrigin  (and target host was: $targetHost,
              request origin: $requestOrigin)""")

    if (isSameOrigin)
      return CorsInfo.SameOrigins(requestAndTargetOrigin = targetOrigin)

    // Ok request method?
    throwForbiddenIf(!isPreFlight && request.method != "GET" && request.method != "POST",
          "TyECORSMTD", s"Forbidden CORS request method: ${request.method}")

    // Ok URL path?  (currently dead code (690732856Y)) [CORSPATH]
    throwForbiddenIf(request.path.indexOf("/-/v0/") != 0,
          "TyECORSPATH", o"""CORS requests only allowed to url path: ${request.path},
            but you requested: ${request.path}""")

    // From an allowed external website?
    val okOrigins: Seq[String] = siteSettings.allowCorsFromParsed

    // (If this is a pre-flight request and CORS not allowed, then could reply
    // with CORS info headers and status 204, but why? Replying Forbidden is simpler.)
    throwForbiddenIf(!okOrigins.contains(requestOrigin),
          "TyECORSORIG", o"""This looks like a CORS (Cross-Origin) request,
            but this site doesn't allow CORS requests from your origin. Your origin is:
            $requestOrigin.  This site: $targetOrigin  (and target host was: $targetHost)""")

    // Without cookies?
    // ""By default, in cross-site XMLHttpRequest or Fetch invocations,
    //   browsers will not send credentials. A specific flag has to be set [...]""
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#Requests_with_credentials
    //   2020-05
    val hasCookies = request.cookies.nonEmpty
    val hasSidHeader = request.headers.hasHeader(SessionIdHeaderName)

    val (errCode, credsType) =
          if (hasCookies) ("TyECORSCOOKIES", "cookies")
          else if (hasSidHeader) ("TyECORSSIDHDR", "a Talkyard session id header")
          else ("", "")

    throwForbiddenIf(credsType.nonEmpty && !siteSettings.allowCorsCreds,
          errCode, o"""This looks like a CORS (Cross-Origin) request,
          but it includes credentials: $credsType, which this site doesn't allow.""")
    // If allowCorsCreds: Won't work anyway, because cross-origin requests
    // with credentials hasn't been implemented. [CORSCREDSUNIMPL]

    throwForbiddenIf(hasCookies && isPreFlight,
          "TyEPREFLCREDS", "CORS pre-flight request *with cookies* — not allowed.")

    // Don't think this can happen, but anyway:
    throwForbiddenIf(hasSidHeader && isPreFlight,
          "TyEPREFLCREDS2", "CORS pre-flight request *with SID header* — not allowed.")

    // This cross-origin request is okay.
    CorsInfo.OkayCrossOrigin(
          requestOrigin, hasCorsCreds = hasCookies || hasSidHeader,
          isPreFlight = isPreFlight)
  }


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
   *
   * WebSocket: xsrf token checked in 1st message from the client instead [WSXSRF]
   * but not here (the WebSocket upgrade request has no body, no custom headers).
   */
  def checkSidAndXsrfToken[A](request: RequestHeader, anyRequestBody: Option[A],
        site: SiteBrief, dao: SessionSiteDaoMixin,
        expireIdleAfterMins: i64, maySetCookies: Bo, skipXsrfCheck: Bo)
        : CheckSidAndXsrfResult = {


    // ----- Check session id

    val expireIdleAfterMillis: Long = expireIdleAfterMins * MillisPerMinute

    // If we cannot use cookies, then the sid is sent in a header. [NOCOOKIES]
    val anySillySidInCookie: Opt[St] = urlDecodeCookie(SessionIdCookieName, request)
    val anySidHeaderValue: Opt[St] = request.headers.get(SessionIdHeaderName)
    val (anySillySidInHeader, anyFancySidPart12Maybe3InHeader) = anySidHeaderValue match {
      case None => (None, None)
      case Some(value) =>
        if (value.contains('.')) {
          // It's the old silly sid.
          (Some(value), None)
        }
        else {
          // It's the new fancy sid (Base64, no '.'), not the old silly sid.
          (None, Some(value))
        }
    }

    val anySillySid = anySillySidInCookie orElse anySillySidInHeader

    // New better sid:  [btr_sid]
    val anyFancySidPart123CookieVal = urlDecodeCookie(SessionIdPart123CookieName, request)
    val anyFancySidPart12Maybe3: Opt[St] =
                            anyFancySidPart123CookieVal orElse anyFancySidPart12Maybe3InHeader
    val anyFancySidPart4: Opt[St] = urlDecodeCookie(SessionIdPart4HttpOnlyCookieName, request)
    val anyFancySidPart5: Opt[St] = urlDecodeCookie(SessionIdPart5StrictCookieName, request)

    val now = globals.now()

    val checkSidResult: CheckSidResult =
          checkSessionId(
                site,
                anySillySid = anySillySid,
                anyFancySidPart12Maybe3 = anyFancySidPart12Maybe3,
                anyFancySidPart4 = anyFancySidPart4,
                anyFancySidPart5 = anyFancySidPart5,
                dao,
                now,
                expireIdleAfterMillis = expireIdleAfterMillis)

    val sessionIdStatus = checkSidResult.sidStatus
    val upgrToFancySidCookies = checkSidResult.createCookies
    val deleteFancySidCookies = checkSidResult.discardCookies  // rename? deleteFancySidCookies


    // ----- Check xsrf token

    // On GET requests, simply accept the value of the xsrf cookie.
    // (On POST requests, however, we check the xsrf form input value)
    val anyXsrfCookieValue = urlDecodeCookie(XsrfCookieName, request).orElse(
            urlDecodeCookie(OldXsrfCookieName, request))

    val isGet = request.method == "GET"
    val isPost = request.method == "POST"
    val cookies = request.cookies // nice to see in debugger
    val maybeCredentials = cookies.nonEmpty || anySidHeaderValue.isDefined
    val definitelyNoCreds = !maybeCredentials
    dieIf(definitelyNoCreds && sessionIdStatus != SidAbsent,
          "TyE50RMEG24", s"No creds, still, session id != SidAbsent: $sessionIdStatus")

    val (xsrf, newCookies): (XsrfOk, List[Cookie]) = {
      if (isGet || skipXsrfCheck) {
        // Accept this request, and create new XSRF token if needed.
        // Don't throw anything (for now at least). [GETNOTHROW]

        if (!sessionIdStatus.canUse && !sessionIdStatus.isInstanceOf[SidExpired])
          logger.warn(s"Bad SID: $sessionIdStatus, from IP: ${realOrFakeIpOf(request)}")

        val (xsrfOk: XsrfOk, anyNewXsrfCookie: List[Cookie]) =
          if (anyXsrfCookieValue.isDefined) {
            (XsrfOk(anyXsrfCookieValue.get), Nil)
          }
          else if (!maySetCookies) {
            // No XSRF token available, and none needed, since this a GET request. [2WKA40]
            // (If is WebSocket, then, xsrf handled elsewhere: [WSXSRF].)
            // Also, this makes [privacy-badger] happy. [NOCOOKIES]
            // Could set the xsrf token to any xsrf header value? But then ought to check if
            // it's been properly crypto hash signed — would be better to avoid (don't want to
            // compute hashes if not needed anyway).
            (XsrfOk(""), Nil)
          }
          else {
            val newXsrfOk = createXsrfToken(siteId = site.id)
            val cookie = urlEncodeCookie(XsrfCookieName, newXsrfOk.value)
            (newXsrfOk, List(cookie))
          }
        (xsrfOk, anyNewXsrfCookie)
      }
      else if (!isPost) {
        // Sometimes people do `curl -I http://...` which sends a HEAD
        // request — but only GET and POST, sometimes OPTIONS,
        // are allowed.  It's nice, though, if in the X-Error-Code response
        // header there's an easy to read error code, so the cURL user
        // won't need to visit Ty's support forum and ask what's happening.
        // Hence the below unusually long "TyE_..." error codes with underscores:
        val details = s"Request method not allowed: ${request.method}"
        throwForbiddenIf(request.method == "HEAD",
              "TyE_REQUEST_METHOD__HEAD__NOT_ALLOWED", details)
        throwForbidden( "TyE_REQUEST_METHOD_NOT_ALLOWED", details)
      }
      else if (isPost && definitelyNoCreds) {
        // This might be from a backend server, fetching publicly available data.
        // Example: An Electron or iOS app, calling /-/v0/search, to show
        // in-app help.
        // No credentials are included in the request, so there's no xsrf risk.
        dieIf(sessionIdStatus != SidAbsent, "TyE502MWEG")
        (XsrfOk(""), Nil)
      }
      else {
        // Reject this request if the XSRF token is invalid,
        // or if the SID is corrupt (but not if simply absent).

        // There must be an xsrf token in a certain header, or in a certain
        // input in any POST:ed form data. Check the header first, in case
        // this is a JSON request (then there is no form data).
        val xsrfTokenInHdrOrBdy = request.headers.get(XsrfTokenHeaderName) orElse {
          if (anyRequestBody.isEmpty) None else anyRequestBody.get match {
            case params: Map[St, Seq[St]] =>
              params.get(XsrfTokenInputName).map(_.head)
            case body: JsonOrFormDataBody =>
              body.getFirst(XsrfTokenInputName)
            case str: St =>
              val token = str.takeWhile(_ != '\n') // [7GKW20TD]
              if (token.nonEmpty) Some(token)
              else None
            case _ =>
              None
          }
        } getOrElse
            throwForbidden("TyE0XSRFTKN_", "No xsrf token")

        val gotAnyCookie =
              anySillySidInCookie.isDefined ||
              anyFancySidPart123CookieVal.isDefined ||
              anyFancySidPart4.isDefined ||
              anyFancySidPart5.isDefined

        val xsrfOk = {
          // Developer friendly _xsrf_error_messages:
          throwForbiddenIf(xsrfTokenInHdrOrBdy == "null",
                "TyEXSRFNULL", "xsrf token is 'null'")
          throwForbiddenIf(xsrfTokenInHdrOrBdy == "undefined",
                "TyEXSRFUNDF", "xsrf token is 'undefined'")

          val xsrfStatus =
                checkXsrfToken(
                    xsrfTokenInHdrOrBdy, anyXsrfCookieValue,
                    thereIsASidCookie = gotAnyCookie,
                    now, expireIdleAfterMillis = expireIdleAfterMillis,
                    mustBeSiteId = site.id)

          def helpText(theProblem: String, nowHaveOrWillGet: String): String = i"""
            |Security issue: $theProblem. Please try again:
            |  - Click any button you just clicked, again.
            |  - Or reload the page.
            |  - Or return to the previous page and reload it.
            |
            |If you reload the page, copy-paste any unsaved text to a text editor,
            |or it'll be lost on reload.
            |
            |(You $nowHaveOrWillGet a new XSRF token.)  """

          if (xsrfStatus.isOk) {
            // Fine, don't abort.
          }
          else if (!maySetCookies) {
            // XSRF error, when using the signed token pattern.
            // More developer friendly _xsrf_error_messages:
            val (theProblem, errorCode)  =
              // If a browser window is open for very long, `typs.xsrfTokenIfNoCookies`
              // (in the session iframe) might expire.
              if (xsrfStatus == XsrfExpired) ("xsrf token expired", "TyEXSRFEXP1")
              else if (xsrfStatus == XsrfBadEmpty) ("xsrf token empty", "TyEXSRFEMPTY1")
              else ("bad xsrf token", "TyEXSRFBAD1")

            throwForbidden(
                errorCode, helpText(theProblem, "will get"))
          }
          else {
            // XSRF error, when using a _Double_Submit_Cookie.
            // Can happen for example if the xsrf token expires. Or if the server restarts,
            // with a new app secret.

            // Create a new XSRF cookie so whatever-the-user-attempted
            // will work, should s/he try again.
            // (If Javascript is enabled, debiki.js should detect logins
            // in other browser tabs, and then check the new SID cookie and
            // refresh XSRF tokens in any <form>s.)
            val newXsrfCookie =
                  urlEncodeCookie(XsrfCookieName, createXsrfToken(siteId = site.id).value)

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

            // See _xsrf_error_messages above — that's if cookies don't work (they typically
            // don't, if Talkyard is embedded in an iframe), while this (below) is
            // if cookies do work.
            val (theProblem, errorCode) =
              if (xsrfStatus == XsrfExpired) ("xsrf token expired", "TyEXSRFEXP_")
              else if (xsrfStatus == XsrfBadEmpty) ("xsrf token empty", "TyEXSRFEMPTY2")
              else if (anyXsrfCookieValue.isEmpty) ("no xsrf double submit cookie", "TyE0XSRFCO")
              else if (anyXsrfCookieValue is "null") ("xsrf cookie is 'null'", "TyEXSRFNULL2")
              else if (anyXsrfCookieValue is "undefined") ("xsrf cookie is 'undefined'", "TyEXSRFUNDF2")
              else ("xsrf token doesn't match double submit cookie", "TyEXSRFCOMISM")

            throw ResultException(ForbiddenResult(
              errorCode, helpText(theProblem, "now have")).withCookies(newXsrfCookie))
          }

          xsrfStatus.asInstanceOf[XsrfOk]
        }

        sessionIdStatus match {
          case SidBadFormat | SidBadHash =>
            throw ResultException(
              ForbiddenResult("TyEBADSID", "Bad session ID",
                  "You can try again — I just deleted the bad session ID.")
                .discardingCookies(
                      DiscardingSessionCookies: _*))
          case _ => // fine
        }

        (xsrfOk, Nil)
      }
    }

    dieIf(upgrToFancySidCookies.nonEmpty && deleteFancySidCookies.nonEmpty, "TyE5A6MRE25")

    val allCookiesToAdd =
          if (!maySetCookies) Nil
          else upgrToFancySidCookies:::newCookies

    CheckSidAndXsrfResult(
          checkSidResult.anyTySession,  // [btr_sid]
          sessionIdStatus,  // old, will remove later
          xsrf,
          cookiesToAdd = allCookiesToAdd,
          cookiesToDelete = deleteFancySidCookies)
  }


  private val MinOwnerPasswordLength = 10

  def throwErrorIfPasswordBad(
        password: String, username: String, fullName: Option[String], email: String,
        minPasswordLength: Int, isForOwner: Boolean): Unit = {

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
  def throwIfBadPassword(passwordHash: String, isTest: Boolean): Unit = {
    val array = passwordHash.split(':')
    if (array.length != 2)
      throwIllegalArgument("EsE2YPU5", "Bad password hash: no prefix")
    val prefix = array(0) + ":"
    val hash = array(1)

    if (prefix == DbDao.CleartextPrefix && !isTest && !hash.startsWith("public"))
      throwIllegalArgument("TyE502TKRD2",
        "Cleartext password does not start with 'public'")

    if (!isTest && prefix != DbDao.ScryptPrefix)
      throwIllegalArgument("EsE5YMP2", "Password type not allowed: " + prefix)
  }



  private def checkXsrfToken(xsrfTokenInHdrOrBdy: St, anyXsrfCookieValue: Opt[St],
        thereIsASidCookie: Bo, now: When, expireIdleAfterMillis: i64,
        mustBeSiteId: SiteId): XsrfStatus = {
    SECURITY; TESTS_MISSING // that tests if the wrong hashes are rejected

    val xsrfToken = xsrfTokenInHdrOrBdy

    // Check matches cookie, or that there's an ok crypto hash.
    anyXsrfCookieValue foreach { xsrfCookieValue =>
        // The _Double_Submit_Cookie pattern, usually also the Custom Request Header pattern, see:
        // https://www.owasp.org/index.php/Cross-Site_Request_Forgery_(CSRF)_Prevention_Cheat_Sheet
        if (xsrfCookieValue != xsrfToken) {
          return XsrfBad
        }
        if (xsrfToken.isEmpty) {
          return XsrfBadEmpty // probably cannot happen
        }

      // Continue below, with checking the hash. (The _Encrypted_Token_Pattern.)
      //
      // We could skip checking the XSRF token format and hash below, since the
      // header (or request body) token and cookie token match, and that's enough.
      // But OWASP thinks it's nice to check the hash too nevertheless, see:
      // https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#signed-double-submit-cookie
      //
      // And seems it's good to do this — also rejects accidentally malformed & possibly
      // less safe tokens:  There was some third party Javascript an admin added to
      // their own Talkyard site, which set a XSRF-TOKEN cookie to something unexpected
      // which made Talkyard error out in the XSRF check, back when Talkyard used that
      // cookie name.
    }

    // If the browser could send a session id cookie, it can also send a xsrf cookie?
    dieIf(Globals.isDevOrTest && thereIsASidCookie && anyXsrfCookieValue.isEmpty,
          "TyESID0XTKN", "Got a sid cookie but no xsrf cookie, weird")

    SECURITY; AUDIT_LOG // any suspicious xsrf tokens?

    val xsrfOk: XsrfOk = {
        // The _Encrypted_Token_Pattern, usually also the Custom Request Header pattern.
        //
        // This is actually not needed, if !thereIsASidCookie, because then xsrf
        // requests aren't possible (since no automatic credentials were included).
        // (If using HTTP Basic Auth or Digest Auth, the browser would include such
        // credentials, just like cookies, right. But Ty doesn't use those auth
        // methods.)
        // Do this check anyway, also if !thereIsASidCookie  (can be used for
        // rate limiting, if nothing else?).
        //
        // The format is "siteId . time . random . hash": "123.12345.randomChars.123def",
        // see siteIdTimeRandomHash(). The hash length is always the same, but maybe
        // we'll sometimes change the number of random chars, so let's find the start
        // of the hash by counting from the end:
        val hashIndex: Int = xsrfToken.length - HashLength
        if (hashIndex < 1) {
          return XsrfBad
        }
        val value = xsrfToken.take(hashIndex - 1) // '-1' drops the dot between value and hash
        val actualHash = xsrfToken.drop(hashIndex)

        val xsrfParts: Array[St] = value.split('.')
        if (xsrfParts.length != 3)
          return XsrfBad

        // Same as in siteIdTimeRandomHash():
        val correctHashFullLength = hashSha1Base64UrlSafe(value + secretSalt)
        val correctHash = correctHashFullLength take HashLength
        if (correctHash != actualHash) {
          return XsrfBad
        }

        // Check it's for this site (it is, since we're using __Host-cookies, but
        // it's nice to double check).
        val siteIdStr: St = xsrfParts(0)
        val siteIdInToken = siteIdStr.toInt64Option getOrElse {
          return XsrfBad
        }
        if (siteIdInToken != mustBeSiteId) {
          return XsrfBad
        }

        // Check isn't too old.
        val timeStr = xsrfParts(1)
        val unixSeconds: i64 = timeStr.toInt64Option getOrElse {
          return XsrfBad
        }
        val millisAgo = now.millisSince(When.fromMillis(unixSeconds * MillisPerSecond))
        if (millisAgo > expireIdleAfterMillis + XsrfAliveExtraSeconds * MillisPerSecond)
          return XsrfExpired

        XsrfOk(value)
    }

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
  def createXsrfToken(siteId: SiteId): XsrfOk = {
    // Could skip the secure hash, when using the _Double_Submit_Cookie pattern
    // — but don't, because now year 2023, OWASP recommends signed double submit cookies,
    // see:  https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#signed-double-submit-cookie

    SECURITY; COULD // include any user id in the value, so it's bound to one user only.
    // Not needed, since we use __Host-cookies, but would be nice to double-verify.

    XsrfOk(siteIdTimeRandomHash(siteId))  // [2AB85F2]
  }



  def createSessionIdAndXsrfToken(req: AuthnReqHeader, userId: PatId)
        : (SidOk, XsrfOk, List[Cookie]) = {

    AUDIT_LOG // Maybe log session id creation?

    val site = req.site
    val dao = req.dao

    val useOldSid = site.isFeatureEnabled("ffUseOldSid", globals.config.featureFlags)

    val ppt = dao.getParticipant(userId)
    throwForbiddenIf(ppt.exists(_.isGroup), "TyELGIGRP", "Cannot login as a group")  // [imp-groups]

    val settings = dao.getWholeSiteSettings()
    val expireIdleAfterSecs = settings.expireIdleAfterMins * 60

    val xsrfOk = createXsrfToken(siteId = site.id)
    val xsrfCookie = urlEncodeCookie(XsrfCookieName, xsrfOk.value,
          maxAgeSecs = Some(expireIdleAfterSecs + XsrfAliveExtraSeconds))

    // New better sid  [btr_sid]
    // ----------------------------------------

    if (!useOldSid) {
      val (newSidCookies, session) = genAndSaveFancySid(req, patId = userId,
            expireIdleAfterSecs = expireIdleAfterSecs, dao.now(),
            dao.asInstanceOf[SessionSiteDaoMixin])
      val sidOk = SidOk(session.part1And2, ageInMillis = 0, Some(userId))
      return (sidOk, xsrfOk, xsrfCookie :: newSidCookies)
    }

    // Old style sid  (signed cookie)
    // ----------------------------------------

    var sidOk = createSessionId(site, userId)
    val sidCookie = urlEncodeCookie(SessionIdCookieName, sidOk.value,
      maxAgeSecs = Some(expireIdleAfterSecs))

    COULD_OPTIMIZE // use ArrBuf
    (sidOk, xsrfOk, sidCookie::xsrfCookie::Nil)
  }


  private def genAndSaveFancySid(req: AuthnReqHeader, patId: PatId, expireIdleAfterSecs: i32,
          now: When, dao: SessionSiteDaoMixin): (List[Cookie], TySession) = {

    import com.debiki.core.{TySession => S}
    val totalEntropy = S.SidLengthCharsTotal * S.SidEntropyPerChar
    assert(totalEntropy == 96 + 144 + 144 + 144 + 96)
    val wholeSid = nextRandomString(totalEntropy, base36 = false, base64UrlSafe = true)
    dieIf(wholeSid.length != S.SidLengthCharsTotal, "TyESIDLEN538RMD",
          s"Generated a ${wholeSid.length} chars session id, but should be ${
          S.SidLengthCharsTotal} chars long. Here it is: '$wholeSid' (won't get used)")

    val lenUpTo1 = S.SidLengthCharsPart1
    val lenUpTo2 = lenUpTo1 + S.SidLengthCharsPart2
    val lenUpTo3 = lenUpTo2 + S.SidLengthCharsPart3
    val lenUpTo4 = lenUpTo3 + S.SidLengthCharsPart4

    val part1 = wholeSid.substring(0, lenUpTo1)
    val part2 = wholeSid.substring(lenUpTo1, lenUpTo2)
    val part3 = wholeSid.substring(lenUpTo2, lenUpTo3)
    val part4 = wholeSid.substring(lenUpTo3, lenUpTo4)
    val part5 = wholeSid.substring(lenUpTo4, S.SidLengthCharsTotal)

    assert(part1.length == S.SidLengthCharsPart1)
    assert(part2.length == S.SidLengthCharsPart2)
    assert(part3.length == S.SidLengthCharsPart3)
    assert(part4.length == S.SidLengthCharsPart4)
    assert(part5.length == S.SidLengthCharsPart5)

    val newSidPart123Cookie = urlEncodeCookie(
          SessionIdPart123CookieName, part1 + part2 + part3,
          maxAgeSecs = Some(expireIdleAfterSecs), httpOnly = false)

    val newSidPart4Cookie = urlEncodeCookie(
          SessionIdPart4HttpOnlyCookieName, part4,
          maxAgeSecs = Some(expireIdleAfterSecs), httpOnly = true)

    val newSidPart5Cookie = urlEncodeCookie(
          SessionIdPart5StrictCookieName, part5,
          maxAgeSecs = Some(expireIdleAfterSecs), httpOnly = true, sameSiteStrict = true)

    val startHeaders = {
      import http.{HeaderNamesLowercase => H}
      // New & nice:
      val chUserAgent = req.headers.get(H.ClientHintUserAgent).trimNoneIfBlank
      val chUaMobile = req.headers.get(H.ClientHintUaMobile).trimNoneIfBlank
      val chUaPlatform = req.headers.get(H.ClientHintUaPlatform).trimNoneIfBlank
      // Old & verbose:
      val userAgent = req.headers.get(H.UserAgent).trimNoneIfBlank

      val mapBuilder = Map.newBuilder[St, JsValue]
      val maxLen = 200 // header max length. 200 is a lot?
      val mobLen = 20  // should be just "?0" or "?1"
      chUserAgent.foreach(v => mapBuilder += H.ClientHintUserAgent -> JsString(v take maxLen))
      chUaMobile.foreach(v => mapBuilder += H.ClientHintUaMobile -> JsString(v take mobLen))
      chUaPlatform.foreach(v => mapBuilder += H.ClientHintUaPlatform -> JsString(v take maxLen))

      // Skip the verbose User-Agent header if we got the new & better client hint header.
      if (chUserAgent.isEmpty) {
        userAgent.foreach(v => mapBuilder += H.UserAgent -> JsString(v take maxLen))
      }
      JsObject(mapBuilder.result)
    }

    val session = TySession(
          patId = patId,
          createdAt = now,
          version = TySession.CurVersion,
          startIp = Some(req.ip),
          startBrowserId = req.browserId.map(_.cookieValue),
          startHeaders = startHeaders,
          part1CompId = part1,
          part2ForEmbgStorage = part2,
          part2Hash = hashSha512FirstHalf32Bytes(part2),
          part3ForDirJs = Some(part3),
          part3Hash = hashSha512FirstHalf32Bytes(part3),
          part4HttpOnly = Some(part4),
          part4Hash = hashSha512FirstHalf32Bytes(part4),
          part5Strict = Some(part5),
          part5Hash = hashSha512FirstHalf32Bytes(part5))

    dao.insertValidSession(session)

    (List(newSidPart123Cookie, newSidPart4Cookie, newSidPart5Cookie), session)
  }


  // 15 chars is 90 bits entropy (15 * 6 bits, using Base64) — that's more than enough:
  // https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
  // >  The session ID value must provide at least 64 bits of entropy
  // 11 chars is 66 bits entropy (with a perfect rand num gen).
  private val HashLength: i32 = 15

  private def secretSalt: St = globals.applicationSecret


  private def checkSessionId(
        site: SiteBrief,
        anySillySid: Opt[St],
        anyFancySidPart12Maybe3: Opt[St],
        anyFancySidPart4: Opt[St],
        anyFancySidPart5: Opt[St],
        dao: SessionSiteDaoMixin,
        now: When,
        expireIdleAfterMillis: i64): CheckSidResult = {

    val hasFancySid = anyFancySidPart12Maybe3.isDefined || anyFancySidPart4.isDefined ||
          anyFancySidPart5.isDefined
    val useOldSid = site.isFeatureEnabled("ffUseOldSid", globals.config.featureFlags)

    if (!useOldSid) {
      var result = checkFancySessionId(anyPart12Maybe3 = anyFancySidPart12Maybe3,
            anyPart4 = anyFancySidPart4, anyPart5 = anyFancySidPart5,
            dao, now, expireIdleAfterMillis = expireIdleAfterMillis)
      if (anySillySid.isDefined) {
        result = result.copy(
              discardCookies = DiscardingSillySidCookie :: result.discardCookies)
      }
      result
    }
    else {
      var result = checkSillySessionId(site, anySillySid, dao, now, expireIdleAfterMillis)
      if (hasFancySid) {
        result = result.copy(
              discardCookies = DiscardingFancySidCookies ::: result.discardCookies)
      }
      result
    }
  }


  private def checkFancySessionId(  // [btr_sid]
        anyPart12Maybe3: Opt[St], anyPart4: Opt[St], anyPart5: Opt[St],
        dao: SessionSiteDaoMixin, now: When,
        expireIdleAfterMillis: i64): CheckSidResult = {

    val anySession = anyPart12Maybe3 flatMap dao.getSessionByPart1
    val anyPart4Hash = anyPart4.map(hashSha512FirstHalf32Bytes)

    val session: TySessionInDbMaybeBad = anySession getOrElse {
      // If pat has logged out client side, when offline, the not-HttpOnly session parts
      // would be gone, whilst we'd still get the 4th and 5th parts in HttpOnly cookies.
      // If so, we should delete the session server side too —
      // so, let's look it up by part 4 — there's an index on part 4 (not part 5), because
      // part 4 should always be present, if part 5 is present (part 4 is SameSite Lax,
      // part 5 Strict).

      // Maybe maybe Safari will sometimes mistakenly auto clear localStorage?
      // See [ios_itp] in maybe-later.txt.

      anyPart4Hash.flatMap(dao.loadSessionByPart4(_, maybeActiveOnly = true)) foreach { s =>
        // Test: sso-test  TyT4ABKRW0268.TyTESESS123GONE
        AUDIT_LOG // client side logout
        val sessionDeleted = s.copy(deletedAt = Some(now))
        dao.updateSession(sessionDeleted)
      }

      // Session gone. Delete any cookies.
      val gotCookies = anyPart12Maybe3.isDefined || anyPart4.isDefined || anyPart5.isDefined

      return CheckSidResult.noSession(
            SidAbsent,
            discardCookies = if (gotCookies) DiscardingFancySidCookies else Nil)
    }

    import TySession._

    val thePart12Maybe3: St = anyPart12Maybe3 getOrDie "TyE3MG70QFM2"
    val thePart2: St = thePart12Maybe3.substring(SidLengthCharsPart1, SidLengthCharsPart12)
    val hashPart2: Array[i8] = hashSha512FirstHalf32Bytes(thePart2)
    val part3IsPresent = thePart12Maybe3.length > TySession.SidLengthCharsPart12
    val anyPart3: Opt[St] =
          if (!part3IsPresent) None
          else Some(thePart12Maybe3.substring(SidLengthCharsPart12, SidLengthCharsPart123))

    val (anyPart3Hash, anyPart5Hash) =
          if (session.isDeleted || session.hasExpired) {
            // Then we won't use parts 3 and 5 anyway. (But we'll check part 4.)
            (None, None)
          }
          else {
            (anyPart3.map(hashSha512FirstHalf32Bytes),
                anyPart5.map(hashSha512FirstHalf32Bytes))
          }

    // Part 2, and 3, 4, 5 if present, must be from the same session.
    // We've checked part 1 already — we found the session via part 1.

    val badPart2 = !hashPart2.sameElements(session.part2HashForEmbgStorage)
    val badPart3 = anyPart3Hash.map(_ sameElements session.part3HashForDirJs) is false
    val badPart4 = anyPart4Hash.map(_ sameElements session.part4HashHttpOnly) is false
    val badPart5 = anyPart5Hash.map(_ sameElements session.part5HashStrict) is false

    if (badPart2 || badPart3 || badPart4 || badPart5) {
      AUDIT_LOG // this is suspicious?

      val sessionDeleted = session.copy(deletedAt = Some(now))
      dao.updateSession(sessionDeleted)

      // Maybe part 4 is from another older/newer session somehow? That'd be weird.
      // Then, invalidate that session too.
      // (Since parts 123 are not-HttpOnly, but parts 4 and 5 are HttpOnly,
      // they could get out of sync maybe because of some unknown bug, or if a script
      // or a person manipulates their cookies.)
      if (badPart4) {
        dao.loadSessionByPart4(anyPart4Hash.get, maybeActiveOnly = true) foreach {
              differentSession =>
          // The database should prevent any parts being the same (unique indexes,
          // on parts 1 and 4, but not 2, 3 or 5).
          AUDIT_LOG // that we're deleting another session?
          UNTESTED ; TESTS_MISSING  // TyTSESSHALFBAD

          warnDevDieIf(differentSession.part1CompId == session.part1CompId, "TyE603MSEJ56")
          warnDevDieUnless(differentSession.part4HashHttpOnly sameElements
                session.part4HashHttpOnly, "TyE603MSEJ56")

          val differentSessionDeleted = differentSession.copy(deletedAt = Some(now))
          dao.updateSession(differentSessionDeleted)
        }
      }

      return CheckSidResult.noSession(SidAbsent, discardCookies = DiscardingSessionCookies)
    }

    if (session.isDeleted || session.hasExpired)
      return CheckSidResult.noSession(SidAbsent, discardCookies = DiscardingSessionCookies)

    // Did the session expire just now?  [lazy_expire_sessions]
    //
    // Maybe instead:
    // val justExpired = session.expiresNow(now, expireIdleAfterMillis / MillisPerMinute)

    UX; SHOULD // bump lastSeenAt somehow, and add idle time to that? [bump_sid_last_use]

    val expiresAt = expireIdleAfterMillis + session.createdAt.millis
    if (expiresAt < now.millis) {
      AUDIT_LOG // session lazy-expired
      // Then don't allow using the session any more, even if the server time gets
      // changed back to before when it expired.
      val sessionExpired = session.copy(expiredAt = Some(now))
      dao.updateSession(sessionExpired)
      // or use SidExpired instead of SidAbsent. But why?
      return CheckSidResult.noSession(SidAbsent, discardCookies = DiscardingSessionCookies)
    }

    val sidOk = SidOk(value = thePart12Maybe3.take(SidLengthCharsPart12),
          ageInMillis = now.millis - session.createdAt.millis,
          userId = Some(session.patId))

    CheckSidResult(
          Some(session.copyAsValid(
              // Parts 3, 4, 5 are optional. (Parts 1 and 2? We found the session via part 1,
              // and part 2 is required, and we have compared it with the session
              // in the database already, above.)
              part2 = thePart2,
              part3 = anyPart3,
              part4 = anyPart4,
              part5 = anyPart5)),
          sidOk)
  }


  private def checkSillySessionId(site: SiteBrief, anyOldSid: Opt[St],
        dao: SessionSiteDaoMixin, now: When,
        expireIdleAfterMillis: i64): CheckSidResult = {

    val value = anyOldSid getOrElse {
      return CheckSidResult.noSession(SidAbsent)
    }

    // Example value: 88-F7sAzB0yaaX.1312629782081.1c3n0fgykm  - no, obsolete
    if (value.length <= HashLength)
      return CheckSidResult.noSession(SidBadFormat)

    val (hash, dotUseridDateRandom) = value splitAt HashLength
    val realHash = hashSha1Base64UrlSafe(
      s"$secretSalt.${site.id}$dotUseridDateRandom") take HashLength

    if (hash != realHash)
      return CheckSidResult.noSession(SidBadHash)

    val oldOkSid = dotUseridDateRandom.drop(1).split('.') match {
      case Array(userIdString, dateStr, randVal) =>
        val userId: Option[UserId] =
          if (userIdString.isEmpty) None
          else Try(userIdString.toInt).toOption orElse {
            return CheckSidResult.noSession(SidBadFormat)
          }
        val ageMillis = now.millis - dateStr.toLong
        UX; BUG; COULD; // [EXPIREIDLE] this also expires *active* sessions. Instead,
        // lookup the user, and consider only time elapsed, since hens last visit.
        // ... Need to have a SiteDao here then. And pass the Participant back to the
        // caller, so it won't have to look it up again.
        // Not urgent though — no one will notice: by default, one stays logged in 1 year [7AKR04].
        if (ageMillis > expireIdleAfterMillis) {
          val expiredSid = SidExpired(
                  minutesOld = ageMillis / MillisPerMinute,
                  maxAgeMins = expireIdleAfterMillis / MillisPerMinute,
                  wasForPatId = userId)
          return CheckSidResult.noSession(expiredSid)
        }
        SidOk(
          value = value,
          ageInMillis = ageMillis,
          userId = userId)
      case _ => SidBadFormat
    }

    var newSidCookies: List[Cookie] = Nil

    // Upgrade old sid to new style sid:  [btr_sid]
    // ----------------------------------------

    /* Maybe skip this. Hard to test?
    if ((tryFancySid || useFancySid) && oldOkSid.userId.isDefined) {
      val dao = anyDao getOrDie "TyE50FREN68"
      val patId = oldOkSid.userId getOrDie "TyE602MTEGPH"
      val settings = dao.getWholeSiteSettings()
      val expireIdleAfterSecs = settings.expireIdleAfterMins * 60
      val (newCookies, sidPart1, sidPart2) =
            genAndSaveFancySid(patId = patId, expireIdleAfterSecs, dao.redisCache,
                isOldUpgraded = true)
      // cookies = newSidPart1Cookie::newSidPart2Cookie::cookies
      result = SidOk(sidPart1,
            expireIdleAfterSecs * 1000, Some(patId))
      newSidCookies = newCookies
    }
    */

    CheckSidResult(anyTySession = None, oldOkSid, createCookies = newSidCookies)
  }


  @deprecated("Now", "Use the fancy session id instead.")
  private def createSessionId(site: SiteBrief, userId: PatId): SidOk = {
    val now = globals.now()
    val useridDateRandom =
         userId +"."+
         now.millis +"."+
         (nextRandomString() take 10)

    // If the site id wasn't included in the hash, then an admin from site A could
    // login as admin at site B, if they have the same user id and username.
    val saltedHash = hashSha1Base64UrlSafe(
      s"$secretSalt.${site.id}.$useridDateRandom") take HashLength

    val value = s"$saltedHash.$useridDateRandom"
    SidOk(value, ageInMillis = 0, Some(userId))
  }


  // ----- Secure cookies

  RENAME // to HostCookie
  // (Also rename DiscardingSecureCookie to DiscardingHostCookie.)
  def SecureCookie(name: St, value: St, maxAgeSeconds: Opt[i32] = None,
        httpOnly: Bo = false): Cookie =
    Cookie(
      CookiePrefix + name,
      value,
      maxAge = maxAgeSeconds,
      path = "/",
      secure = globals.secure,
      httpOnly = httpOnly,
      sameSite = anySameSiteCookieValue())

  /**
    * Later, could change to Lax or even Strict, for session id cookie,
    * and, when embedded, always send session id via header instead?
    * Or now directly? There are SameSite: None incompatible browsers:
    * https://www.chromium.org/updates/same-site/incompatible-clients
    *   ??? copy-paste that Apache 2 to here ???
    * Ok explanation of Strict, Lax and None:
    *   https://web.dev/samesite-cookies-explained/
    */
  private def anySameSiteCookieValue(): Option[Cookie.SameSite] = {  // [SAMESITE]
    // SameSite.None only works with https.
    SECURITY // Remove this? No longer needed — instead, session parts 1-5,
    // and 5 is always strict.
    if (globals.secure && globals.config.sameSiteNone) {
      Some(Cookie.SameSite.None)
    }
    else if (globals.config.sameSiteLax) {
      Some(Cookie.SameSite.Lax)
    }
    else {
      None
    }
  }


  RENAME // to DiscardingHostCookie, and never use DiscardingCookie directly anywhere.
  // (Also rename SecureCookie to HostCookie.)
  def DiscardingSecureCookie(name: String) =
    DiscardingCookie(CookiePrefix + name, secure = globals.secure)

  def DiscardingSessionCookies: List[DiscardingCookie] =
    List(DiscardingSecureCookie(SessionIdCookieName),
        DiscardingSecureCookie(SessionIdPart123CookieName),
        DiscardingSecureCookie(SessionIdPart4HttpOnlyCookieName),
        DiscardingSecureCookie(SessionIdPart5StrictCookieName))

  def DiscardingSillySidCookie: DiscardingCookie =
    DiscardingSecureCookie(SessionIdCookieName)

  def DiscardingFancySidCookies: List[DiscardingCookie] =
    List(DiscardingSecureCookie(SessionIdPart123CookieName),
        DiscardingSecureCookie(SessionIdPart4HttpOnlyCookieName),
        DiscardingSecureCookie(SessionIdPart5StrictCookieName))

  // Maybe also always delete:  ImpersonationCookieName  ?
  // Well, things work fine anyway as of now (Mars 2020).

  // Two comments on the encoding of the cookie value:
  // 1. If the cookie contains various special characters
  // (whitespace, any of: "[]{]()=,"/\?@:;") it will be
  // sent as a Version 1 cookie (by javax.servlet.http.Cookie),
  // then it is surrounded with quotes.
  // the jQuery cookie plugin however expects an urlencoded value:
  // 2. urlEncode(value) results in these cookies being sent:
  //    Set-Cookie: dwCoUserEmail="someone%40exaple.com";Path=/
  //    Set-Cookie: dwCoUserName="space%20text";Path=/
  // No encoding results in these cookies:
  //    Set-Cookie: dwCoUserEmail=someone@example.com;Path=/
  //    Set-Cookie: dwCoUserName="space text";Path=/
  // So it seems a % encoded string is surrounded with double quotes, by
  // javax.servlet.http.Cookie? Why? Not needed!, '%' is safe.
  // So I've modified jquery-cookie.js to remove double quotes when
  // reading cookie values.
  private def urlEncodeCookie(name: St, value: St, maxAgeSecs: Opt[i32] = None,
        httpOnly: Bo = false, sameSiteStrict: Bo = false) =
    Cookie(
      name = CookiePrefix + name,
      value = urlEncode(convertEvil(value)),  // see comment above
      maxAge = maxAgeSecs,
      path = "/",
      // Don't set — if set to, say, example.com, then, vulnerabilities at
      // www.example.com might allow an attacker to get access to cookies
      // from secure.example.com
      // https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#domain-and-path-attributes
      domain = None,
      secure = globals.secure,
      sameSite =
            // If debugging on localhost over http, does Strict work?
            if (sameSiteStrict) Some(Cookie.SameSite.Strict)
            else anySameSiteCookieValue(),
      httpOnly = httpOnly)


  def urlDecodeCookie(name: St, reqHdr: RequestHeader): Opt[St] =
    reqHdr.cookies.get(CookiePrefix + name).map(cookie => urlDecode(cookie.value))


  /** Extracts any browser id cookie from the request, or creates it if absent
    * and is a POST request.
    */
  def getBrowserIdCreateCookieIfMissing(request: RequestHeader, isLogin: Boolean)
        : (Option[BrowserId], List[Cookie]) = {
    val anyBrowserId = getAnyBrowserId(request)
    if (anyBrowserId.isDefined) {
      return (Some(anyBrowserId.get), Nil)
    }

    // No id needed?
    val method = request.method
    if (method == "GET" || method == "OPTIONS" || method == "HEAD") {
      // Some one-time secret endpoints make things happen via GET requests
      // — then we want a cookie, although is GET, [GETLOGIN]
      // since the request makes thing happen in the server and database,
      // then, should remember the browser so simpler to detect abuse / attacks / etc.
      if (!isLogin) {
        // Probably harmless, don't need to remember the browser.
        return (None, Nil)
      }
    }

    // This request tries to do something (POST request, or GET login). Try to remember
    // the browser, so can maybe block or rate limit it, if needed. And maybe
    // detect astroturfing.
    createBrowserIdCookie()
  }

  def getAnyBrowserId(request: RequestHeader): Option[BrowserId] =
    request.cookies.get(CookiePrefix + BrowserIdCookieName) map { cookie =>
      BrowserId(cookie.value, isNew = false)
    }


  private def createBrowserIdCookie(): (Some[BrowserId], List[Cookie]) = {
    val cookieValue = siteIdTimeRandomHash(siteId = NoSiteId)  // [2AB85F2]
    val newCookie = SecureCookie(
          name = BrowserIdCookieName,
          value = cookieValue,
          maxAgeSeconds = Some(3600 * 24 * 365 * 5),
          httpOnly = true)
    (Some(BrowserId(cookieValue, isNew = true)), List(newCookie))
  }


  /** Returns something like:  123.12345.randomChars.123def — the first part,
    * is the site id, the second is the unix time in seconds. The third part is
    * random chars. The last is a crypto hash of [the first parts + the app secret].
    */
  private def siteIdTimeRandomHash(siteId: SiteId): St = {
    val idDotTimeDotRandom = s"$siteId.${globals.now().seconds}.${nextRandomString().take(12)}"
    val hash = hashSha1Base64UrlSafe(idDotTimeDotRandom + secretSalt).take(HashLength)
    s"$idDotTimeDotRandom.$hash"  // does *not* incl the secretSalt
  }

  // ----- Secure Not-fond and No-may-not

  /** Use this if page not found, or the page is private and we don't want strangers
    * to find out that it exists. [7C2KF24]
    */
  def throwIndistinguishableNotFound(devModeErrCode: St = "",
          showErrCodeAnyway: Bo = false): Nothing = {
    val suffix =
      if (showErrCodeAnyway || !globals.isProd && devModeErrCode.nonEmpty) s"-$devModeErrCode"
      else ""
    throwNotFound("TyE404_" + suffix, "Not found")
  }

  def throwNoUnless(mayMaybe: MayMaybe, errorCode: String): Unit = {
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
  def realOrFakeIpOf(request: RequestHeader): String = {
    val fakeIpQueryParam = request.queryString.get("fakeIp").flatMap(_.headOption)
    val fakeIp = fakeIpQueryParam.orElse(
      request.cookies.get(CookiePrefix + "dwCoFakeIp").map(_.value))  getOrElse {
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


  def getE2eTestPassword(request: RequestHeader): Option[String] =
    request.queryString.get("e2eTestPassword").flatMap(_.headOption).orElse(
      request.cookies.get(CookiePrefix + "dwCoE2eTestPassword").map(_.value)).orElse( // dwXxx obsolete. esXxx now
      request.cookies.get(CookiePrefix + "esCoE2eTestPassword").map(_.value))


  def hasOkE2eTestPassword(request: RequestHeader): Boolean = {
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


  def getForbiddenPassword(request: RequestHeader): Option[String] =
    request.queryString.get("forbiddenPassword").flatMap(_.headOption).orElse(
      request.cookies.get(CookiePrefix + "esCoForbiddenPassword").map(_.value))


  def hasOkForbiddenPassword(request: DebikiRequest[_]): Boolean =
    hasOkForbiddenPassword(request.request)


  def hasOkForbiddenPassword(request: RequestHeader): Boolean = {
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
