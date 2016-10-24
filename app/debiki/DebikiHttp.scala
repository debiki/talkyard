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

package debiki

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.SystemDao
import io.efdi.server.http.{GetRequest, DebikiRequest}
import java.{net => jn}
import play.api._
import play.api.libs.iteratee.Iteratee
import play.{api => p}
import play.api.mvc.{Action => _, _}
import play.api.Play.current
import scala.concurrent.Await
import scala.concurrent.duration.Duration


/**
 * HTTP utilities.
 */
object DebikiHttp {


  // ----- Limits

  // (The www.debiki.se homepage is 20 kb, and homepage.css 80 kb,
  // but it includes Twitter Bootstrap.)

  val MaxPostSize = 100 * 1000
  val MaxPostSizeForAuUsers = 30 * 1000
  val MaxPostSizeForUnauUsers = 10 * 1000
  val MaxDetailsSize =  20 * 1000


  // ----- Content type matchers

  // (Cannot use Play's, they depend on the codec.)

  abstract sealed class ContentType
  object ContentType {
    case object Json extends ContentType
    case object Html extends ContentType
  }


  // ----- Error handling

  private def R = Results

  def BadReqResult(errCode: String, message: String): Result =
    R.BadRequest("400 Bad Request\n"+ message +" [error "+ errCode +"]")

  // There's currently no WWW-Authenticate header
  // field in the response though!
  def UnauthorizedResult(errCode: String, message: String): Result =
    R.Unauthorized("401 Unauthorized\n"+ message +" [error "+ errCode +"]")

  def ForbiddenResult(errCode: String, message: String): Result =
    R.Forbidden("403 Forbidden\n"+ message +" [error "+ errCode +"]").withHeaders(
      "X-Error-Code" -> errCode)
    /* Doesn't work, the Som(reason) is ignored: (could fix later in Play 2.5 when Iterates = gone)
    Result(
      ResponseHeader(404, Map.empty, Some(s"Forbidden!!zz $errCode")),
      Enumerator(wString.transform(s"403 Forbidden bdy\n $message [$errCode]"))) */

  def NotImplementedResult(errorCode: String, message: String): Result =
    R.NotImplemented(s"501 Not Implemented\n$message [$errorCode]")

  def NotFoundResult(errCode: String, message: String): Result =
    R.NotFound("404 Not Found\n"+ message +" [error "+ errCode +"]")

  def ServiceUnavailableResult(errorCode: String, message: String): Result =
    R.ServiceUnavailable(s"503 Service Unavailable\n$message [$errorCode] [EsE5GK0Y2]")

  def MethodNotAllowedResult: Result =
    R.MethodNotAllowed("405 Method Not Allowed\nTry POST or GET instead please [DwE7KEF2]")

  def EntityTooLargeResult(errCode: String, message: String): Result =
    R.EntityTooLarge("413 Request Entity Too Large\n"+
       message +" [error "+ errCode +"]")

  def UnprocessableEntityResult(errCode: String, message: String): Result =
    R.UnprocessableEntity("422 Unprocessable Entity\n"+ message +" [error "+ errCode +"]")

  def InternalErrorResult(errCode: String, message: String): Result =
    R.InternalServerError(
      "500 Internal Server Error\n"+ message +" [error "+ errCode +"]")

  def InternalErrorResult2(message: String): Result =
    R.InternalServerError("500 Internal Server Error\n"+ message)

  /**
   * Thrown on error, caught in Global.onError, which returns the wrapped
   * result to the browser.
   */
  case class ResultException(result: Result) extends QuickException {
    override def toString = s"Status ${result.header.status}: $bodyToString"
    override def getMessage = toString

    def statusCode = result.header.status

    def bodyToString: String = {
      implicit val materializer = play.api.Play.materializer  // what is that [6KFW02G]
      val futureByteString = result.body.consumeData(materializer)
      val byteString = Await.result(futureByteString, Duration.fromNanos(1000*1000*1000))
      byteString.utf8String
    }

    // ScalaTest prints the stack trace but not the exception message. However this is
    // a QuickException — it has no stack trace. Let's create a helpful fake stack trace
    // that shows the exception message, so one knows what happened.
    if (Play.isTest) {
      val message = s"ResultException, status $statusCode [EsM0FST0]:\n$bodyToString"
      setStackTrace(Array(new StackTraceElement(message, "", "", 0)))
    }
  }

  def throwTemporaryRedirect(url: String) =
    throw ResultException(R.Redirect(url))

  /** Sets a Cache-Control max-age = 1 week, so that permanent redirects can be undone. [7KEW2Z]
    * Otherwise browsers might cache them forever.
    */
  def throwPermanentRedirect(url: String) =
    throw ResultException(R.Redirect(url).withHeaders(
      p.http.HeaderNames.CACHE_CONTROL -> ("public, max-age=" + 3600 * 24 * 7)))
    // Test that the above cache control headers work, before I redirect permanently,
    // otherwise browsers might cache the redirect *forever*, can never be undone.
    // So, right now, don't:
    //   p.http.Status.MOVED_PERMANENTLY

  def throwBadRequest(errCode: String, message: String = "") = throwBadReq(errCode, message)

  def throwBadRequestIf(condition: Boolean, errCode: String, message: String = "") =
    if (condition) throwBadRequest(errCode, message)

  def throwBadReq(errCode: String, message: String = "") =
    throw ResultException(BadReqResult(errCode, message))

  def throwUnprocessableEntity(errCode: String, message: String = "") =
    throw ResultException(UnprocessableEntityResult(errCode, message))

  def throwBadArgument(errCode: String, parameterName: String, problem: String = "") =
    throwBadReq(errCode, "Bad `"+ parameterName +"` value" + (
      if (problem.nonEmpty) ": " + problem else ""))

  def throwBadConfigFile(errCode: String, message: String) =
    throwNotFound(errCode, message)

  def throwParamMissing(errCode: String, paramName: String) =
    throwBadReq(errCode, "Parameter missing: "+ paramName)

  // There's currently no WWW-Authenticate header
  // field in the response though!
  def throwUnauthorized(errCode: String, message: String = "") =
    throw ResultException(UnauthorizedResult(errCode, message))

  def throwForbidden(errCode: String, message: String = "") =
    throw ResultException(ForbiddenResult(errCode, message))

  def throwNotImplemented(errorCode: String, message: String = "") =
    throw ResultException(NotImplementedResult(errorCode, message))

  def throwServiceUnavailable(errorCode: String, message: String = "") =
    throw ResultException(ServiceUnavailableResult(errorCode, message))

  def throwNotFound(errCode: String, message: String = "") =
    throw ResultException(NotFoundResult(errCode, message))

  def throwEntityTooLargeIf(condition: Boolean, errCode: String, message: String) =
    if (condition) throwEntityTooLarge(errCode, message)

  def throwEntityTooLarge(errCode: String, message: String) =
    throw ResultException(EntityTooLargeResult(errCode, message))

  def throwTooManyRequests(message: String) =
    throw ResultException(R.TooManyRequest(message))

  /** Happens e.g. if the user attempts to upvote his/her own comment or
    * vote twice on another comment.
    */
  def throwConflict(errCode: String, message: String) =
    throw ResultException(R.Conflict(s"409 Conflict\n$message [error $errCode]"))

  def logAndThrowInternalError(errCode: String, message: String = "")
        (implicit logger: play.api.Logger) = {
    logger.error("Internal error: "+ message +" ["+ errCode +"]")
    throwInternalError(errCode, message)
  }

  def logAndThrowForbidden(errCode: String, message: String = "")
        (implicit logger: play.api.Logger) = {
    logger.warn("Forbidden: "+ message +" ["+ errCode +"]")
    throwForbidden(errCode, message)
  }

  def logAndThrowBadReq(errCode: String, message: String = "")
        (implicit logger: play.api.Logger) = {
    logger.warn("Bad request: "+ message +" ["+ errCode +"]")
    throwBadReq(errCode, message)
  }

  def throwInternalError(errCode: String, message: String = "") =
    throw ResultException(InternalErrorResult(errCode, message))


  // ----- Tenant ID lookup


  def originOf(request: GetRequest) =
    Globals.originOf(request.underlying)

  def originOf(request: Request[_]) =
    Globals.originOf(request)


  def daoFor(request: Request[_]) = {
    val site = lookupSiteOrThrow(originOf(request), debiki.Globals.systemDao)
    debiki.Globals.siteDao(site.id)
  }


  /** Looks up a site by hostname, or directly by id.
    *
    * By id: If a HTTP request specifies a hostname like "site-<id>.<baseDomain>",
    * for example:  site-123.debiki.com,
    * then the site is looked up directly by id. This is useful for embedded
    * comment sites, since their address isn't important, and if we always access
    * them via site id, we don't need to ask the side admin to come up with any
    * site address.
    */
  def lookupSiteOrThrow(request: RequestHeader, systemDao: SystemDao): SiteBrief = {
    lookupSiteOrThrow(request.secure, request.host, request.uri, systemDao)
  }

  def lookupSiteOrThrow(url: String, systemDao: SystemDao): SiteBrief = {
    val (scheme, separatorHostPathQuery) = url.span(_ != ':')
    val secure = scheme == "https"
    val (host, pathAndQuery) =
      separatorHostPathQuery.drop(3).span(_ != '/') // drop(3) drops "://"
    lookupSiteOrThrow(secure, host = host, pathAndQuery, systemDao)
  }

  def lookupSiteOrThrow(secure: Boolean, host: String, pathAndQuery: String,
        systemDao: SystemDao): SiteBrief = {

    // Play supports one HTTP and one HTTPS port only, so it makes little sense
    // to include any port number when looking up a site.
    val hostname = if (host contains ':') host.span(_ != ':')._1 else host
    def firstSiteIdAndHostname =
      SiteBrief(Site.FirstSiteId, hostname = Globals.firstSiteHostname getOrElse {
        throwForbidden("EsE5UYK2", "No first site hostname configured (debiki.hostname)")
      }, systemDao.theSite(FirstSiteId).status)

    if (Globals.firstSiteHostname.contains(hostname))
      return firstSiteIdAndHostname

    // If the hostname is like "site-123.example.com" then we'll just lookup id 123.
    hostname match {
      case debiki.Globals.siteByIdHostnameRegex(siteId) =>
        systemDao.getSite(siteId) match {
          case None =>
            throwNotFound("DwE72SF6", s"No site with id `$siteId'")
          case Some(site) =>
            COULD // link to canonical host if (site.hosts.exists(_.role == SiteHost.RoleCanonical))
            // Let the config file hostname have precedence over the database.
            if (site.id == FirstSiteId && Globals.firstSiteHostname.isDefined)
              return site.brief.copy(hostname = Globals.firstSiteHostname.get)
            else
              return site.brief
        }
      case _ =>
    }

    // Id unknown so we'll lookup the hostname instead.
    val lookupResult = systemDao.lookupCanonicalHost(hostname) match {
      case Some(result) =>
        if (result.thisHost == result.canonicalHost)
          result
        else result.thisHost.role match {
          case SiteHost.RoleDuplicate =>
            result
          case SiteHost.RoleRedirect =>
            throwPermanentRedirect(Globals.originOf(result.canonicalHost.hostname) + pathAndQuery)
          case SiteHost.RoleLink =>
            die("DwE2KFW7", "Not implemented: <link rel='canonical'>")
          case _ =>
            die("DwE20SE4")
        }
      case None =>
        if (Site.Ipv4AnyPortRegex.matches(hostname)) {
          // Make it possible to access the server before any domain has been connected
          // to it and when we still don't know its ip, just after installation.
          return firstSiteIdAndHostname
        }
        throwNotFound("DwE0NSS0", "There is no site with that hostname")
    }
    val site = systemDao.getSite(lookupResult.siteId) getOrDie "EsE2KU503"
    site.brief
  }


  // ----- Cookies

  def SecureCookie(name: String, value: String, maxAgeSeconds: Option[Int] = None,
        httpOnly: Boolean = false) =
    Cookie(name, value, maxAge = maxAgeSeconds, secure = Globals.secure, httpOnly = httpOnly)

  def DiscardingSecureCookie(name: String) =
    DiscardingCookie(name, secure = Globals.secure)

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
  def urlEncodeCookie(name: String, value: String, maxAgeSecs: Option[Int] = None) =
    Cookie(
      name = name,
      value = urlEncode(convertEvil(value)),  // see comment above
      maxAge = maxAgeSecs,
      path = "/",
      domain = None,
      secure = Globals.secure,
      httpOnly = false)

  def urlDecodeCookie(name: String, request: Request[_]): Option[String] =
    request.cookies.get(name).map(cookie => urlDecode(cookie.value))

  def urlEncode(in: String) = {
    // java.net.URLEncoder unfortunately converts ' ' to '+', so change '+' to
    // a percent encoded ' ', because the browsers seem to decode '+' to '+'
    // not ' '. And they should do so, i.e. decode '+' to '+', here is
    // more info on URL encoding and the silly space-to-plus conversion:
    //   <http://www.lunatech-research.com/archives/2009/02/03/
    //   what-every-web-developer-must-know-about-url-encoding>
    // see #HandlingURLscorrectlyinJava and also search for "plus".
    // Could also use Google API Client Library for Java, which has
    // a class  com.google.api.client.escape.PercentEscaper
    // <http://javadoc.google-api-java-client.googlecode.com/hg/1.0.10-alpha/
    //  com/google/api/client/escape/PercentEscaper.html>
    // that correctly encodes ' ' to '%20' not '+'.
    jn.URLEncoder.encode(in, "UTF-8").replaceAll("\\+", "%20")
  }

  def urlDecode(in : String) = jn.URLDecoder.decode(in, "UTF-8")

  /**
   * Converts dangerous characters (w.r.t. xss attacks) to "~".
   * Perhaps converts a few safe characters as well.
   * COULD simply URL encode instead?!
   */
  def convertEvil(value: String) =  // XSS test that implementation is ok
    value.replaceAll("""<>\(\)\[\]\{\}"!#\$\%\^\&\*\+=,;:/\?""", "~")
  //value.filter(c => """<>()[]{}"!#$%^&*+=,;:/?""".count(_ == c) == 0)
  // but these are okay:  `’'-@._
  // so email addresses are okay.


  // ----- Miscellaneous

  def isAjax(request: Request[_]) =
    request.headers.get("X-Requested-With") == Some("XMLHttpRequest")

}

