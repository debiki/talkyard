package debiki

/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

import com.debiki.v0._
import com.debiki.v0.Prelude._
import controllers.Actions.PageRequest
import java.{net => jn}
import play.api._
import play.api.http.ContentTypes._
import play.api.mvc.{Action => _, _}
import xml.{NodeSeq}

/**
 * HTTP utilities.
 */
object DebikiHttp {


  // ----- Error handling

  private def R = Results

  def BadReqResult(errCode: String, message: String): PlainResult =
    R.BadRequest("400 Bad Request\n"+ message +" [error "+ errCode +"]")

  def UnauthorizedResult(errCode: String, message: String): PlainResult =
    R.Unauthorized("401 Unauthorized\n"+ message +" [error "+ errCode +"]")

  def ForbiddenResult(errCode: String, message: String): PlainResult =
    R.Forbidden("403 Forbidden\n"+ message +" [error "+ errCode +"]")

  def NotFoundResult(errCode: String, message: String): PlainResult =
    R.NotFound("404 Not Found\n"+ message +" [error "+ errCode +"]")

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

  def throwBadReq(errCode: String, message: String = "") =
    throw ResultException(BadReqResult(errCode, message))

  def throwUnauthorized(errCode: String, message: String = "") =
    throw ResultException(UnauthorizedResult(errCode, message))

  def throwForbidden(errCode: String, message: String = "") =
    throw ResultException(ForbiddenResult(errCode, message))

  def throwNotFound(errCode: String, message: String = "") =
    throw ResultException(NotFoundResult(errCode, message))

  def throwInternalError(errCode: String, message: String = "") =
    throw ResultException(InternalErrorResult(errCode, message))

  def throwBadReqDialog(
        errCode: String, title: String, summary: String, details: String) =
    throw ResultException(Results.BadRequest(
        errorDialogPage(errCode, title, summary, details)) as HTML)

  def throwForbiddenDialog(
        errCode: String, title: String, summary: String, details: String) =
    throw ResultException(Results.Forbidden(
      errorDialogPage(errCode, title, summary, details)) as HTML)


  // ----- HTML dialog responses

  // Javascript shows these dialogs as modal dialogs.

  def OkDialogResult(title: String, summary: String, details: String)
        : PlainResult =
    Results.Ok(<html><body>{
      FormHtml.respDlgOk(title, summary, details)
    }</body></html>) as HTML

  def errorDialogPage(
        errCode: String, title: String, summary: String, details: String) =
    <html><body>{
      FormHtml.respDlgError(debikiErrorCode = errCode, title = title,
        summary = summary, details = details)
    }</body></html>

  def ForbiddenDialogResult(
        errCode: String,  title: String, summary: String, details: String)
        : PlainResult =
    Results.Forbidden(errorDialogPage(errCode, title, summary, details)) as HTML


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

