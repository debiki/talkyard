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
import controllers.Utils.{OkHtml, ForbiddenHtml, BadReqHtml}
import debiki.dao.SystemDao
import java.{net => jn}
import play.api._
import play.api.http.ContentTypes._
import play.api.mvc.{Action => _, _}
import play.api.Play.current
import requests.DebikiRequest
import xml.{NodeSeq}


/**
 * HTTP utilities.
 */
object DebikiHttp {


  // ----- Limits

  // (The www.debiki.se homepage is 20 kb, and homepage.css 80 kb,
  // but it includes Twitter Bootstrap.)

  val MaxPostSize = 400 * 1000
  val MaxPostSizeForAuUsers = 40 * 1000
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
    R.Forbidden("403 Forbidden\n"+ message +" [error "+ errCode +"]")

  def NotFoundResult(errCode: String, message: String): Result =
    R.NotFound("404 Not Found\n"+ message +" [error "+ errCode +"]")

  def EntityTooLargeResult(errCode: String, message: String): Result =
    R.EntityTooLarge("413 Request Entity Too Large\n"+
       message +" [error "+ errCode +"]")

  def UnprocessableEntityResult(errCode: String, message: String): Result =
    R.UnprocessableEntity("422 Unprocessable Entity\n"+ message +" [error "+ errCode +"]")

  def InternalErrorResult(errCode: String, message: String): Result =
    R.InternalServerError(
      "500 Internal Server Error\n"+ message +" [error "+ errCode +"]")

  /**
   * Thrown on error, caught in Global.onError, which returns the wrapped
   * result to the browser.
   */
  case class ResultException(result: Result) extends QuickException

  def throwRedirect(url: String) =
    throw ResultException(R.Redirect(url))

  def throwBadReq(errCode: String, message: String = "") =
    throw ResultException(BadReqResult(errCode, message))

  def throwUnprocessableEntity(errCode: String, message: String = "") =
    throw ResultException(UnprocessableEntityResult(errCode, message))

  def throwBadParamValue(errCode: String, paramName: String) =
    throwBadReq(errCode, "Bad `"+ paramName +"` value")

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

  def throwNotFound(errCode: String, message: String = "") =
    throw ResultException(NotFoundResult(errCode, message))

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

  def throwBadReqDialog(
        errCode: String, title: String, summary: String, details: String) =
    throw ResultException(BadReqHtml(
        errorDialogXml(errCode, title, summary, details)))

  def throwForbiddenDialog(
        errCode: String, title: String, summary: String, details: String,
        withCookie: Option[Cookie] = None) = {
    var result = ForbiddenHtml(errorDialogXml(errCode, title, summary, details))
    if (withCookie.isDefined)
      result = result withCookies withCookie.get

    throw ResultException(result)
  }


  // ----- Tenant ID lookup


  def originOf(request: Request[_]) = {
    val scheme = if (request.secure) "https" else "http"
    s"$scheme://${request.host}"
  }


  def daoFor(request: Request[_]) = {
    val siteId = lookupTenantIdOrThrow(originOf(request), debiki.Globals.systemDao)
    debiki.Globals.siteDao(siteId, ip = request.remoteAddress)
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
  def lookupTenantIdOrThrow(request: DebikiRequest[_], systemDao: SystemDao): String =
    lookupTenantIdOrThrow(request.request, systemDao)

  def lookupTenantIdOrThrow(request: RequestHeader, systemDao: SystemDao): String = {
    lookupTenantIdOrThrow(request.secure, request.host, request.uri, systemDao)
  }

  def lookupTenantIdOrThrow(url: String, systemDao: SystemDao): String = {
    val (scheme, separatorHostPathQuery) = url.span(_ != ':')
    val secure = scheme == "https"
    val (host, pathAndQuery) =
      separatorHostPathQuery.drop(3).span(_ != '/') // drop(3) drops "://"
    lookupTenantIdOrThrow(secure, host = host, pathAndQuery, systemDao)
  }

  val anyFirstSiteHostname: Option[String] =
    Play.configuration.getString("debiki.hostname")

  def lookupTenantIdOrThrow(secure: Boolean, host: String, pathAndQuery: String,
        systemDao: SystemDao): String = {

    // Do this:
    // - Test if the hostname matches any main site hostname in the config files.
    // - If the hostname is like: site-<id>.<baseDomain>, e.g. site-123.debiki.com if
    //   then we have the site id already. Then 1) verify that it's correct, and
    //   2) if theres' any canonical address for the site, and if so include a
    //   <link rel='canonical'> to that address (not implemented).
    // - If the hostname is <whatever> then lookup site id by hostname.

    val siteId = host match {
      case x if Some(x) == anyFirstSiteHostname =>
        Site.FirstSiteId
      case debiki.Globals.siteByIdHostnameRegex(siteId) =>
        systemDao.loadSite(siteId) match {
          case None =>
            throwNotFound("DwE72SF6", s"No site with id `$siteId'")
          case Some(site) =>
            if (site.hosts.find(_.role == TenantHost.RoleCanonical).isDefined)
              Logger.warn("Should <link rel='canonical'> to the canonical address [DwE1U80]")
        }
        siteId
      case _ =>
        val scheme = if (secure) "https" else "http"
        systemDao.lookupTenant(scheme, host = host) match {
          case found: FoundChost =>
            found.tenantId
          case found: FoundAlias =>
            found.role match {
              case TenantHost.RoleRedirect =>
                throwRedirect(found.canonicalHostUrl + pathAndQuery)
              case TenantHost.RoleLink =>
                unimplemented("<link rel='canonical'>")
              case TenantHost.RoleDuplicate =>
                found.tenantId
              case _ =>
                // lookupTenant should have returned FoundChost instead
                // of FoundAlias with RoleCanonical/Duplicate.
                assErr("DwE01k5Bk08")
          }
          case FoundNothing =>
            throwNotFound("DwEI5F2", "There is no site with that hostname")
        }
    }

    siteId
  }


  // ----- HTML dialog responses

  // Javascript shows these dialogs as modal dialogs.

  def OkDialogResult(title: String, summary: String, details: String): Result =
    OkHtml(<html><body>{
      HtmlForms.respDlgOk(title, summary, details)
    }</body></html>)

  def errorDialogXml(
        errCode: String, title: String, summary: String, details: String) =
    <html><body>{
      HtmlForms.respDlgError(debikiErrorCode = errCode, title = title,
        summary = summary, details = details)
    }</body></html>

  def ForbiddenDialogResult(
        errCode: String,  title: String, summary: String, details: String): Result =
    ForbiddenHtml(errorDialogXml(errCode, title, summary, details))


  // ----- Cookies

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
      secure = false,
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

