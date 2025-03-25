/**
 * Copyright (c) 2012, 2018 Kaj Magnus Lindberg
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

import akka.actor.ActorSystem
import akka.stream.ActorMaterializer
import com.debiki.core._
import com.debiki.core.Prelude._
import talkyard.server.security.EdSecurity
import controllers.{LoginController, routes}
import java.{net => jn}
import play.api.libs.json.{JsLookupResult, JsValue, JsObject}
import play.{api => p}
import play.api.mvc._
import scala.concurrent.Await
import scala.concurrent.duration.Duration
import scala.util.Try



/**
 * HTTP utilities.
 */
object EdHttp {  // REFACTOR move to  talkyard.server.http object methods?

  // A Ty user agent string here?  [ty_user_agent]


  // ----- Limits

  // (The www.debiki.se homepage is 20 kb, and homepage.css 80 kb,
  // but it includes Twitter Bootstrap.)

  // 300 kb Javascript or CSS isn't totally crazy? If someone copy-pastes e.g. Prism.js,
  // unminified, to debug, that can be ~ 200 kb.
  val MaxPostSizeJsCss: Int = 300 * 1000

  val MaxPostSize: Int = 100 * 1000
  val MaxPostSizeForAuUsers: Int = 30 * 1000
  val MaxPostSizeForUnauUsers: Int = 15 * 1000
  val MaxDetailsSize: Int =  20 * 1000


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
    R.BadRequest(s"400 Bad Request\n$message [$errCode]")

  // There's currently no WWW-Authenticate header
  // field in the response though!
  def UnauthorizedResult(errCode: String, message: String): Result =
    R.Unauthorized(s"401 Unauthorized\n$message [$errCode]")

  def ForbiddenResult(errCode: String, message: String, details: String = ""): Result = {
    R.Forbidden(s"403 Forbidden\n$message [$errCode]\n\n$details").withHeaders("X-Error-Code" -> errCode)
    /* Doesn't work, the Som(reason) is ignored: (could fix later in Play 2.5 when Iterates = gone)
    Result(
      ResponseHeader(404, Map.empty, Some(s"Forbidden!!zz $errCode")),
      Enumerator(wString.transform(s"403 Forbidden bdy\n $message [$errCode]"))) */
  }

  def NotImplementedResult(errorCode: String, message: String): Result =
    R.NotImplemented(s"501 Not Implemented\n$message [$errorCode]")

  def NotFoundResult(errCode: String, message: String): Result =
    R.NotFound(s"404 Not Found\n$message [$errCode]")

  def ServiceUnavailableResult(errorCode: String, message: String): Result =
    R.ServiceUnavailable(s"503 Service Unavailable\n$message [$errorCode] [EsE5GK0Y2]")

  def MethodNotAllowedResult: Result =
    R.MethodNotAllowed("405 Method Not Allowed\nTry POST or GET instead please [DwE7KEF2]")

  def EntityTooLargeResult(errCode: String, message: String): Result =
    R.EntityTooLarge(s"413 Request Entity Too Large\n$message [$errCode]")

  def UnprocessableEntityResult(errCode: String, message: String): Result =
    R.UnprocessableEntity(s"422 Unprocessable Entity\n$message [$errCode]")

  def InternalErrorResult(errCode: String, message: String, moreDetails: String = ""): Result =
    R.InternalServerError(s"500 Internal Server Error\n$message [$errCode]\n\n$moreDetails")

  def InternalErrorResult2(message: String): Result =
    R.InternalServerError("500 Internal Server Error\n"+ message)

  def BadGatewayResult(errCode: St, message: St, moreDetails: St = ""): Result =
    R.BadGateway(s"502 Bad Gateway\n$message [$errCode]\n\n$moreDetails")

  private lazy val materializerActorSystem = ActorSystem("materializerActorSystem")
  private lazy val theMaterializer = ActorMaterializer()(materializerActorSystem)

  /** RespEx means Response Exception.
    *
   * Thrown on error, caught in Global.onError, which returns the wrapped
   * result to the browser.
   */
  case class ResultException(result: Result) extends QuickException { RENAME; // to RespEx?
    override def toString = s"Status ${result.header.status}: $bodyToString"
    override def getMessage: String = toString

    def statusCode: Int = result.header.status

    def bodyToString: String = {
      val futureByteString = result.body.consumeData(theMaterializer)
      val byteString = Await.result(futureByteString, Duration.fromNanos(1000*1000*1000))
      byteString.utf8String
    }

    // ScalaTest prints the stack trace but not the exception message. However this is
    // a QuickException — it has no stack trace. Let's create a helpful fake stack trace
    // that shows the exception message, so one knows what happened.
    if (!Globals.isProd) {
      val message = s"ResultException, status $statusCode [EsMRESEX]:\n$bodyToString"
      setStackTrace(Array(new StackTraceElement(message, "", "", 0)))
    }
  }

  type RespEx = ResultException
  val RespEx: ResultException.type = ResultException

  type Resp = play.api.mvc.Result
  val Resp: play.api.mvc.Result.type = play.api.mvc.Result

  def throwTemporaryRedirect(url: String) =
    throw RespEx(R.Redirect(url))

  /** Sets a Cache-Control max-age = 1 week, so that permanent redirects can be undone. [7KEW2Z]
    * Otherwise browsers might cache them forever.
    *
    * No, set just a few days: 3 instead of 7. It's annoying when someone moves
    * a Talkyard site from A to B and then wants to move it back to A, but the browsers
    * have cache an A —> B redirect response.
    */
  def throwPermanentRedirect(url: String) =
    throw RespEx(R.Redirect(url).withHeaders(
      p.http.HeaderNames.CACHE_CONTROL -> ("public, max-age=" + 3600 * 24 * 3)))
    // Test that the above cache control headers work, before I redirect permanently,
    // otherwise browsers might cache the redirect *forever*, can never be undone.
    // So, right now, don't:
    //   p.http.Status.MOVED_PERMANENTLY

  @deprecated("Now", "use throwOkJson instead")
  def throwOkSafeJson(json: JsValue): Nothing =
    throw ResultException(controllers.OkSafeJsValue(json))

  def throwOkJson(json: JsObject): Nothing =
    throw ResultException(controllers.OkSafeJson(json))

  def throwBadRequest(errCode: String, message: String = ""): Nothing =
    throwBadReq(errCode, message)

  def throwBadRequest(errorMessageCode: ErrorMessageCode): Nothing =
    throwBadReq(errorMessageCode.code, errorMessageCode.message)

  def throwBadRequestIf(condition: Boolean, errCode: String, message: => String = ""): Unit =
    if (condition) throwBadRequest(errCode, message)

  def throwBadReqIf(condition: Bo, errCode: St, message: St = ""): U =
    if (condition) throwBadReq(errCode, message)

  def throwBadReqIfLowEntropy(value: St, paramName: St, errCode: St): U =
    throwBadReqIf(EdSecurity.tooLowEntropy(value), errCode,
          s"Param '$paramName' has low entropy, value: '$value' [$errCode]")

  def throwBadReq(errCode: String, message: String = ""): Nothing =
    throw ResultException(BadReqResult(errCode, message))

  def throwUnprocessableEntity(errCode: String, message: String = "") =
    throw ResultException(UnprocessableEntityResult(errCode, message))

  def throwBadArgIf(test: Bo, errCode: St, paramName: St, problemOrValue: St = ""): U =
    throwBadParamIf(test, errCode, paramName, problemOrValue)

  RENAME // use throwBadArgIf just above instead
  def throwBadParamIf(test: Bo, errCode: St, paramName: St, problemOrValue: St = ""): U =
    if (test)
      throwBadParam(errCode, paramName, problemOrValue)

  RENAME // use throwBadArg instead
  def throwBadParam(errCode: St, paramName: St, problemOrValue: St = ""): Nothing =
    throwBadArgument(errCode, paramName, problemOrValue)

  // RENAME to throwBadParam? started, see above. <—— NO! Instead, this comment:
  /** Specific values passed to a function are called 'arguments', while inside the
    * function, the values it accepts, are called parameters.  But when showing an
    * error message, it's from the perspective of the caller and because of
    * specific values, so "argument" is the correct word to use. Hence,
    * 'paramName', but '...ThrowBadArg',  not '...ThrowBadParam'.
    */
  def throwBadArg(errCode: St, paramName: St, problemOrValue: St = ""): Nothing =
    throwBadArgument(errCode, paramName, problemOrValue)

  RENAME // too long name, use throwBadArg instead
  def throwBadArgument(errCode: St, paramName: St, problemOrValue: St = ""): Nothing =
    throwBadReq(errCode, s"Bad '$paramName' value" + (
          if (problemOrValue.nonEmpty) s": $problemOrValue" else ""))

  def throwBadConfigFile(errCode: String, message: String): Nothing =
    throwNotFound(errCode, message)

  def throwParamMissing(errCode: String, paramName: String): Nothing =
    throwBadReq(errCode, "Parameter missing: "+ paramName)

  // There's currently no WWW-Authenticate header
  // field in the response though!
  def throwUnauthorized(errCode: String, message: String = "") =
    throw ResultException(UnauthorizedResult(errCode, message))

  def throwForbidden(err: ErrMsgCode) =
    throw ResultException(ForbiddenResult(err.code, err.message))

  def throwForbidden(errCode: String, message: String = "", details: String = "") =
    throw ResultException(ForbiddenResult(errCode, message, details))

  def throwForbiddenIf(test: Boolean, errorCode: String, message: => String): Unit =
    if (test) throwForbidden(errorCode, message)

  def throwForbiddenUnless(test: Boolean, errorCode: String, message: => String): Unit =
    if (!test) throwForbidden(errorCode, message)

  def throwNotImplemented(errorCode: String, message: String = "") =
    throw ResultException(NotImplementedResult(errorCode, message))

  def throwUnimplementedIf(test: Boolean, errorCode: String, message: => String = ""): Unit =
    if (test) throwNotImplemented(errorCode, message)

  def throwServiceUnavailable(errorCode: String, message: String = "") =
    throw ResultException(ServiceUnavailableResult(errorCode, message))

  def throwNotFound(errCode: String, message: String = ""): Nothing =
    throw ResultException(NotFoundResult(errCode, message))

  def throwSiteNotFound(hostname: String, debugCode: => String = ""): Nothing = {
    throw ResultException(SiteNotFoundResult(hostname, debugCode))
  }

  def SiteNotFoundResult(hostname: String, debugCode: => String = ""): Result = {
    val dashDebug = if (Globals.isProd || debugCode.isEmpty) "" else "-" + debugCode
    NotFoundResult("TyE404HOSTNAME" + dashDebug, s"There is no site with hostname '$hostname'")
  }

  def throwEntityTooLargeIf(condition: Boolean, errCode: String, message: String): Unit =
    if (condition) throwEntityTooLarge(errCode, message)

  def throwEntityTooLarge(errCode: String, message: String): Nothing =
    throw ResultException(EntityTooLargeResult(errCode, message))

  def throwTooManyRequests(message: String): Nothing =
    throw ResultException(R.TooManyRequests(message))

  /** Happens e.g. if the user attempts to upvote his/her own comment or
    * vote twice on another comment.
    */
  def throwConflict(errCode: String, message: String) =
    throw ResultException(R.Conflict(s"409 Conflict\n$message [$errCode]"))

  def logAndThrowInternalError(errCode: String, message: String = "")
        (implicit logger: play.api.Logger): Nothing = {
    logger.error("Internal error: "+ message +" ["+ errCode +"]")
    throwInternalError(errCode, message)
  }

  def logAndThrowForbidden(errCode: String, message: String = "")
        (implicit logger: play.api.Logger): Nothing = {
    logger.warn("Forbidden: "+ message +" ["+ errCode +"]")
    throwForbidden(errCode, message)
  }

  def logAndThrowBadReq(errCode: String, message: String = "")
        (implicit logger: play.api.Logger): Nothing = {
    logger.warn("Bad request: "+ message +" ["+ errCode +"]")
    throwBadReq(errCode, message)
  }

  def throwInternalError(errCode: String, message: String = "", moreDetails: String = "") =
    throw ResultException(InternalErrorResult(errCode, message, moreDetails = moreDetails))



  def throwForbidden2(errorCode: String, message: String, details: String = ""): Nothing =
    throwForbidden(errorCode , message, details)

  def throwNotImplementedIf(test: Boolean, errorCode: String, message: => String = ""): Unit = {
    if (test) throwNotImplemented(errorCode, message)
  }

  def throwLoginAsSuperAdmin(request: RequestHeader): Nothing =
    if (isAjax(request)) throwForbidden2("EsE54YK2", "Not super admin")
    else throwLoginAsSuperAdminTo(request.uri)

  def throwLoginAsSuperAdminTo(path: String): Nothing =
    throwLoginAsTo(LoginController.AsSuperadmin, path)


  def throwLoginAsAdmin(request: RequestHeader): Nothing =
    if (isAjax(request)) throwForbidden2("TyE0LGIADM_", "You need to be logged in as an admin, for this")
    else throwLoginAsAdminTo(request.uri)

  def throwLoginAsAdminTo(path: String): Nothing =
    throwLoginAsTo(LoginController.AsAdmin, path)


  def throwLoginAsStaff(request: RequestHeader): Nothing =
    if (isAjax(request)) throwForbidden2("EsE4GP6D", "Not staff")
    else throwLoginAsStaffTo(request.uri)

  def throwLoginAsStaffTo(path: String): Nothing =
    throwLoginAsTo(LoginController.AsStaff, path)


  private def throwLoginAsTo(as: String, to: String): Nothing =
    throwTemporaryRedirect(routes.LoginController.showLoginPage(Some(as), to = Some(to)).url)

  def urlEncode(in: String): String = {
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

  def urlDecode(in : String): String = jn.URLDecoder.decode(in, "UTF-8")

  /**
   * Converts dangerous characters (w.r.t. xss attacks) to "~".
   * Perhaps converts a few safe characters as well.
   * COULD simply URL encode instead?!
   */
  def convertEvil(value: String): String =  // XSS test that implementation is ok
    value.replaceAll("""<>\(\)\[\]\{\}"!#\$\%\^\&\*\+=,;:/\?""", "~")
  //value.filter(c => """<>()[]{}"!#$%^&*+=,;:/?""".count(_ == c) == 0)
  // but these are okay:  `’'-@._
  // so email addresses are okay.



  // ----- Request "getters" and payload parsing helpers


  implicit class RichString2(value: String) {
    def toIntOrThrow(errorCode: String, errorMessage: String): Int =
      value.toIntOption getOrElse throwBadRequest(errorCode, errorMessage)

    def toFloatOrThrow(errorCode: String, errorMessage: String): Float =
      value.toFloatOption getOrElse throwBadRequest(errorCode, errorMessage)

    def toLongOrThrow(errorCode: String, errorMessage: String): Long =
      Try(value.toLong).toOption getOrElse throwBadRequest(errorCode, errorMessage)
  }


  implicit class RichJsLookupResult(val underlying: JsLookupResult) {
    def asTrimmedSt: St = underlying.asOpt[St].map(_.trim) getOrElse ""
    def asOptStringNoneIfBlank: Opt[St] = underlying.asOpt[St].map(_.trim) match {
      case Some("") => None
      case x => x
    }
    def asWhen: When = When.fromMillis(underlying.as[Long])
    def asOptWhen: Option[When] = underlying.asOpt[Long].map(When.fromMillis)
  }


  implicit class GetOrThrowBadArgument[A](val underlying: Option[A]) {
    def getOrThrowForbidden(errorCode: String, message: => String = ""): A = {
      underlying getOrElse {
        throwForbidden(errorCode, message)
      }
    }

    def getOrThrowBadRequest(errorCode: String, message: => String = ""): A = {
      underlying getOrElse {
        throwBadRequest(errorCode, message)
      }
    }

    def getOrThrowBadArg(errCode: St, paramName: St, msg: => St = ""): A = {
      getOrThrowBadArgument(errCode, paramName, msg)
    }

    REMOVE // too long name, use getOrThrowBadArg instead? (it's just above)
    def getOrThrowBadArgument(errorCode: String, parameterName: String, message: => String = ""): A = {
      underlying getOrElse {
        throwBadArg(errorCode, parameterName, message)
      }
    }
  }


  def parseIntOrThrowBadReq(text: String, errorCode: String = "DwE50BK7"): Int = {
    try {
      text.toInt
    }
    catch {
      case ex: NumberFormatException =>
        throwBadReq(s"Not an integer: ``$text''", errorCode)
    }
  }



  def isAjax(request: RequestHeader): Boolean =
    request.headers.get("X-Requested-With").contains("XMLHttpRequest")



}

