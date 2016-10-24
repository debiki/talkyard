/**
 * Copyright (c) 2013-2015 Kaj Magnus Lindberg
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

package io.efdi.server

import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.{routes, LoginController}
import debiki._
import debiki.DebikiHttp._
import debiki.RateLimits.NoRateLimits
import java.{util => ju}
import debiki.dao.SiteDao
import play.api._
import play.api.libs.Files.TemporaryFile
import play.api.libs.json.{JsLookupResult, JsValue}
import play.{api => p}
import play.api.mvc._
import play.api.Play.current
import scala.concurrent.Future
import scala.util.Try


package object http {

  def OkSafeJson(json: JsValue) =
    _root_.controllers.Utils.OkSafeJson(json)


  import io.efdi.server.http.PlainApiActions._


  implicit class RichString2(value: String) {
    def toIntOrThrow(errorCode: String, errorMessage: String) =
      value.toIntOption getOrElse throwBadRequest(errorCode, errorMessage)

    def toLongOrThrow(errorCode: String, errorMessage: String) =
      Try(value.toLong).toOption getOrElse throwBadRequest(errorCode, errorMessage)
  }


  implicit class RichJsLookupResult(val underlying: JsLookupResult) {
    def asOptStringTrimmed = underlying.asOpt[String].map(_.trim)

    def asOptStringNoneIfBlank = underlying.asOpt[String].map(_.trim) match {
      case Some("") => None
      case x => x
    }
  }


  case class ApiRequest[A](
    siteIdAndCanonicalHostname: SiteBrief,
    sid: SidStatus,
    xsrfToken: XsrfOk,
    browserId: BrowserId,
    user: Option[User],
    dao: SiteDao,
    request: Request[A]) extends DebikiRequest[A] {
  }

  /** A request with no post data. */
  type GetRequest = ApiRequest[Unit]

  type PageGetRequest = PageRequest[Unit]

  /** A request with form data.
    *
    * @deprecated Use ApiRequest[JsonOrFormDataBody] instead — no, use JsonPostRequest.
    */
  type FormDataPostRequest = ApiRequest[Map[String, Seq[String]]]

  type JsonPostRequest = ApiRequest[JsValue]


  val ExceptionAction = SafeActions.ExceptionAction


  def AsyncGetAction(f: GetRequest => Future[Result]): mvc.Action[Unit] =
    PlainApiAction(NoRateLimits).async(BodyParsers.parse.empty)(f)

  def AsyncGetActionAllowAnyone(f: GetRequest => Future[Result]): mvc.Action[Unit] =
    PlainApiAction(NoRateLimits, allowAnyone = true).async(BodyParsers.parse.empty)(f)

  def AsyncGetActionIsLogin(f: GetRequest => Future[Result]): mvc.Action[Unit] =
    PlainApiAction(NoRateLimits, isLogin = true).async(BodyParsers.parse.empty)(f)

  def AsyncGetActionRateLimited(rateLimits: RateLimits)(f: GetRequest => Future[Result])
        : mvc.Action[Unit] =
    PlainApiAction(rateLimits).async(BodyParsers.parse.empty)(f)

  def GetAction(f: GetRequest => Result) =
    PlainApiAction(NoRateLimits)(BodyParsers.parse.empty)(f)

  def GetActionAllowAnyone(f: GetRequest => Result) =
    PlainApiAction(NoRateLimits, allowAnyone = true)(BodyParsers.parse.empty)(f)

  def GetActionIsLogin(f: GetRequest => Result) =
    PlainApiAction(NoRateLimits, isLogin = true)(BodyParsers.parse.empty)(f)

  def GetActionRateLimited(rateLimits: RateLimits, allowAnyone: Boolean = false)(
        f: GetRequest => Result) =
    PlainApiAction(rateLimits, allowAnyone = allowAnyone)(BodyParsers.parse.empty)(f)

  def StaffGetAction(f: GetRequest => Result) =
    PlainApiActionStaffOnly(BodyParsers.parse.empty)(f)

  def AdminGetAction(f: GetRequest => Result) =
    PlainApiActionAdminOnly(BodyParsers.parse.empty)(f)

  def SuperAdminGetAction(f: GetRequest => Result) =
    PlainApiActionSuperAdminOnly(BodyParsers.parse.empty)(f)


  def JsonOrFormDataPostAction
        (rateLimits: RateLimits, maxBytes: Int, allowAnyone: Boolean = false,
         isLogin: Boolean = false)
        (f: ApiRequest[JsonOrFormDataBody] => Result) =
    PlainApiAction(rateLimits, allowAnyone = allowAnyone, isLogin = isLogin)(
      JsonOrFormDataBody.parser(maxBytes = maxBytes))(f)

  // CLEAN_UP RENAME maxLength to maxBytes, here and elsewhere
  def AsyncPostJsonAction(rateLimits: RateLimits, maxLength: Int, allowAnyone: Boolean = false)(
        f: JsonPostRequest => Future[Result]) =
  PlainApiAction(rateLimits, allowAnyone = allowAnyone).async(
    BodyParsers.parse.json(maxLength = maxLength))(f)

  def PostJsonAction(rateLimits: RateLimits, maxLength: Int, allowAnyone: Boolean = false)(
        f: JsonPostRequest => Result) =
    PlainApiAction(rateLimits, allowAnyone = allowAnyone)(
      BodyParsers.parse.json(maxLength = maxLength))(f)

  def StaffPostJsonAction(maxLength: Int)(f: JsonPostRequest => Result) =
    PlainApiActionStaffOnly(
      BodyParsers.parse.json(maxLength = maxLength))(f)

  def AdminPostJsonAction(maxLength: Int)(f: JsonPostRequest => Result) =
    PlainApiActionAdminOnly(
      BodyParsers.parse.json(maxLength = maxLength))(f)

  def SuperAdminPostJsonAction(maxLength: Int)(f: JsonPostRequest => Result) =
    PlainApiActionSuperAdminOnly(
      BodyParsers.parse.json(maxLength = maxLength))(f)


  def PostFilesAction(rateLimits: RateLimits, maxLength: Int, allowAnyone: Boolean = false)(
        f: ApiRequest[Either[p.mvc.MaxSizeExceeded, MultipartFormData[TemporaryFile]]] => Result) = {
    // BodyParsers.parse.maxLength wants a "Materializer", whatever is that?. Later, when
    // using dependency injection, seems needs to do this instead:
    //   class MyController @Inject() (implicit val mat: Materializer) {}
    // read more here:
    //   http://stackoverflow.com/questions/36004414/play-2-5-migration-error-custom-action-with-bodyparser-could-not-find-implicit
    implicit val materializer = play.api.Play.materializer  // [6KFW02G]
    PlainApiAction(rateLimits, allowAnyone = allowAnyone)(
        BodyParsers.parse.maxLength(maxLength, BodyParsers.parse.multipartFormData))(f)
  }



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
      return request.remoteAddress
    }

    if (Play.isProd) {
      def where = fakeIpQueryParam.isDefined ? "in query param" | "in cookie"
      val password = getE2eTestPassword(request) getOrElse {
        throwForbidden(
          "DwE6KJf2", s"Fake ip specified $where, but no e2e test password — required in prod mode")
      }
      val correctPassword = debiki.Globals.e2eTestPassword getOrElse {
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
        val correctPassword = debiki.Globals.e2eTestPassword getOrElse throwForbidden(
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
        val correctPassword = debiki.Globals.forbiddenPassword getOrElse throwForbidden(
          "EsE48YC2", "There's a forbidden-password in the request, but not in any config file")
        if (password != correctPassword) {
          throwForbidden("EsE7UKF2", "The forbidden-password in the request is wrong")
        }
        true
    }
  }


  /** Use this if page not found, or the page is private and we don't want strangers
    * to find out that it exists. [7C2KF24]
    */
  def throwIndistinguishableNotFound(devModeErrCode: String = "") = {
    val suffix =
      if (!Play.isProd && devModeErrCode.nonEmpty) s"-$devModeErrCode"
      else ""
    throwNotFound("EsE404" + suffix, "Page not found")
  }

  def throwForbidden2 = DebikiHttp.throwForbidden _

  def throwForbiddenIf(test: Boolean, errorCode: String, message: => String) {
    if (test) throwForbidden2(errorCode, message)
  }

  def throwNotImplementedIf(test: Boolean, errorCode: String, message: => String = "") {
    if (test) DebikiHttp.throwNotImplemented(errorCode, message)
  }

  def throwLoginAsSuperAdmin(request: Request[_]) =
    if (DebikiHttp.isAjax(request)) throwForbidden2("EsE54YK2", "Not super admin")
    else throwLoginAsSuperAdminTo(request.uri)

  def throwLoginAsSuperAdminTo(path: String) =
    throwLoginAsTo(LoginController.AsSuperadmin, path)


  def throwLoginAsAdmin(request: Request[_]) =
    if (DebikiHttp.isAjax(request)) throwForbidden2("EsE6GP21", "Not admin")
    else throwLoginAsAdminTo(request.uri)

  def throwLoginAsAdminTo(path: String) =
    throwLoginAsTo(LoginController.AsAdmin, path)


  def throwLoginAsStaff(request: Request[_]) =
    if (DebikiHttp.isAjax(request)) throwForbidden2("EsE4GP6D", "Not staff")
    else throwLoginAsStaffTo(request.uri)

  def throwLoginAsStaffTo(path: String) =
    throwLoginAsTo(LoginController.AsStaff, path)


  private def throwLoginAsTo(as: String, to: String) =
    throwTemporaryRedirect(routes.LoginController.showLoginPage(as = Some(as), to = Some(to)).url)

}
