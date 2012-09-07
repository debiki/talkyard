package debiki

/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

import com.debiki.v0._
import com.debiki.v0.Prelude._
import controllers.PageRequest
import controllers.Utils.{OkHtml, ForbiddenHtml, BadReqHtml}
import java.{net => jn}
import play.api._
import play.api.http.ContentTypes._
import play.api.mvc.{Action => _, _}
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

  def BadReqResult(errCode: String, message: String): PlainResult =
    R.BadRequest("400 Bad Request\n"+ message +" [error "+ errCode +"]")

  // There's currently no WWW-Authenticate header
  // field in the response though!
  def UnauthorizedResult(errCode: String, message: String): PlainResult =
    R.Unauthorized("401 Unauthorized\n"+ message +" [error "+ errCode +"]")

  def ForbiddenResult(errCode: String, message: String): PlainResult =
    R.Forbidden("403 Forbidden\n"+ message +" [error "+ errCode +"]")

  def NotFoundResult(errCode: String, message: String): PlainResult =
    R.NotFound("404 Not Found\n"+ message +" [error "+ errCode +"]")

  def EntityTooLargeResult(errCode: String, message: String): PlainResult =
    R.EntityTooLarge("413 Request Entity Too Large\n"+
       message +" [error "+ errCode +"]")

  def InternalErrorResult(errCode: String, message: String): PlainResult =
    R.InternalServerError(
      "500 Internal Server Error\n"+ message +" [error "+ errCode +"]")

  /**
   * Thrown on error, caught in Global.onError, which returns the wrapped
   * result to the browser.
   */
  case class ResultException(result: PlainResult) extends RuntimeException("") {
    // Fill in no stack trace. Calculating the stack trace is very expensive,
    // and this is a control flow exception rather than an error condition.
    // (Well, actually, the end user has made an error, or is evil. Or some
    // internal bug happened.)
    override def fillInStackTrace(): Throwable = this
  }

  def throwRedirect(url: String) =
    throw ResultException(R.Redirect(url))

  def throwBadReq(errCode: String, message: String = "") =
    throw ResultException(BadReqResult(errCode, message))

  def throwBadParamValue(errCode: String, paramName: String) =
    throw throwBadReq(errCode, "Bad `"+ paramName +"` value")

  def throwParamMissing(errCode: String, paramName: String) =
    throw throwBadReq(errCode, "Parameter missing: "+ paramName)

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

  def logAndThrowInternalError(errCode: String, message: String = "")
        (implicit logger: play.api.Logger) = {
    logger.error("Internal error: "+ message +" ["+ errCode +"]")
    throwInternalError(errCode, message)
  }

  def throwInternalError(errCode: String, message: String = "") =
    throw ResultException(InternalErrorResult(errCode, message))

  def throwBadReqDialog(
        errCode: String, title: String, summary: String, details: String) =
    throw ResultException(BadReqHtml(
        errorDialogXml(errCode, title, summary, details)))

  def throwForbiddenDialog(
        errCode: String, title: String, summary: String, details: String) =
    throw ResultException(ForbiddenHtml(
      errorDialogXml(errCode, title, summary, details)))


  // ----- Tenant ID lookup

  def lookupTenantIdOrThrow(request: RequestHeader, systemDao: SystemDao)
        : String = {

    val tenantId = systemDao.lookupTenant(scheme = "http", // for now
         host = request.host) match {
      case found: FoundChost =>
        found.tenantId
      case found: FoundAlias =>
        found.role match {
          case TenantHost.RoleRedirect =>
            throwRedirect(found.canonicalHostUrl + request.path)
          case TenantHost.RoleLink =>
            unimplemented("<link rel='canonical'>")
          case _ =>
            // lookupTenant should have returned FoundChost instead
            // of FoundAlias with RoleCanonical/Duplicate.
            assErr("DwE01k5Bk08")
      }
      case FoundNothing =>
        throwNotFound("DwEI5F2", "The specified host name maps to no tenant.")
    }

    tenantId
  }


  // ----- HTML dialog responses

  // Javascript shows these dialogs as modal dialogs.

  def OkDialogResult(title: String, summary: String, details: String)
        : PlainResult =
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
        errCode: String,  title: String, summary: String, details: String)
        : PlainResult =
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
  // So the client needs to remove any double quotes.
  // TODO Modify the jQuery cookie plugin to remove double quotes when
  // reading cookie values.
  def urlEncodeCookie(name: String, value: String, maxAgeSecs: Int = -1) =
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


  // ----- Old stuff

  // Could get rid of, completely? Or clean up, delete members.

  def newUrlConfig(pageReq: PageRequest[_]): HtmlConfig =
    newUrlConfig(pageReq.request.host)

  def newUrlConfig(_hostAndPort: String) = new HtmlConfig {
    override val loginActionSimple = "/-/api/login-simple"
    override val loginActionOpenId = "/-/api/login-openid"
    override val logoutAction = "/-/api/logout"
    override val hostAndPort = _hostAndPort
    override def termsOfUseUrl = "/terms-of-use"
  }

}

