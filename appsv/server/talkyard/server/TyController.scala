package talkyard.server

import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.RateLimits.NoRateLimits
import debiki.{RateLimits, TextAndHtmlMaker}
import talkyard.server.http._
import talkyard.server.security.WhatApiSecret
import play.api._
import play.api.libs.Files.TemporaryFile
import play.api.libs.json.JsValue
import play.api.mvc._
import play.{api => p}
import scala.concurrent.{ExecutionContext, Future}
import talkyard.server.authn.MinAuthnStrength



class TyController(cc: ControllerComponents, val context: TyContext)
  extends AbstractController(cc) {

  import context.globals
  import context.plainApiActions._

  implicit val executionContext: ExecutionContext = context.executionContext

  def AsyncGetAction(f: GetRequest => Future[Result]): mvc.Action[Unit] =
    PlainApiAction(cc.parsers.empty, NoRateLimits).async(f)

  def AsyncGetActionMaybeSkipCookies(avoidCookies: Boolean)(f: GetRequest => Future[Result])
        : mvc.Action[Unit] =
    PlainApiAction(cc.parsers.empty, NoRateLimits, avoidCookies = avoidCookies).async(f)

  def AsyncGetActionAllowAnyone(f: GetRequest => Future[Result]): mvc.Action[Unit] =
    PlainApiAction(cc.parsers.empty, NoRateLimits, MinAuthnStrength.EmbeddingStorageSid12,
          allowAnyone = true).async(f)

  def AsyncGetActionIsLogin(f: GetRequest => Future[Result]): mvc.Action[Unit] =
    PlainApiAction(cc.parsers.empty, NoRateLimits, isLogin = true).async(f)

  def AsyncGetActionIsLoginRateLimited(f: GetRequest => Future[Result]): mvc.Action[Unit] =
    PlainApiAction(cc.parsers.empty, RateLimits.Login, isLogin = true).async(f)

  def AsyncGetActionRateLimited(rateLimits: RateLimits,
        minAuthnStrength: MinAuthnStrength = MinAuthnStrength.Normal,
        )(f: GetRequest => Future[Result])
        : mvc.Action[Unit] =
    PlainApiAction(cc.parsers.empty, rateLimits, minAuthnStrength).async(f)

  @deprecated("Use GetActionRateLimited instead, remove this, and rename it to this", "")
  def GetAction(f: GetRequest => Result): Action[Unit] =
    PlainApiAction(cc.parsers.empty, NoRateLimits)(f)

  def GetAction2(  // use GetActionRateLimited instead!
        rateLimits: RateLimits,
        minAuthnStrength: MinAuthnStrength = MinAuthnStrength.Normal,
        )(f: GetRequest => Result): Action[Unit] =
    PlainApiAction(cc.parsers.empty, rateLimits, minAuthnStrength)(f)

  SECURITY; COULD // let MinAuthnStrength be a param, so it's more explicitly visible
  // in the endpoint fn declaration, here and everywhere — don't let EmbeddedHalfSidOld
  // be the default anywhere?
  def GetActionAllowAnyone(f: GetRequest => Result): Action[Unit] =
    PlainApiAction(cc.parsers.empty, NoRateLimits, MinAuthnStrength.EmbeddingStorageSid12,
          allowAnyone = true)(f)

  def GetActionAllowAnyoneRateLimited(rateLimits: RateLimits, avoidCookies: Boolean = false)
        (f: GetRequest => Result): Action[Unit] =
    PlainApiAction(cc.parsers.empty, rateLimits, MinAuthnStrength.EmbeddingStorageSid12,
          allowAnyone = true, avoidCookies = avoidCookies)(f)

  def GetActionIsLogin(f: GetRequest => Result): Action[Unit] =
    PlainApiAction(cc.parsers.empty, NoRateLimits, isLogin = true)(f)

  def GetActionRateLimited(
        rateLimits: RateLimits = RateLimits.ExpensiveGetRequest,
        minAuthnStrength: MinAuthnStrength = MinAuthnStrength.Normal,
        allowAnyone: Boolean = false)(f: GetRequest => Result): Action[Unit] =
    PlainApiAction(cc.parsers.empty, rateLimits, minAuthnStrength, allowAnyone = allowAnyone)(f)

  def StaffGetAction(f: GetRequest => Result): Action[Unit] =
    PlainApiActionStaffOnly(NoRateLimits, cc.parsers.empty)(f)

  def AsyncAdminGetAction(f: GetRequest => Future[Result]): Action[Unit] =
    PlainApiActionAdminOnly(NoRateLimits, cc.parsers.empty).async(f)

  def AdminGetAction(f: GetRequest => Result): Action[Unit] =
    PlainApiActionAdminOnly(NoRateLimits, cc.parsers.empty)(f)

  def ApiSecretGetJsonAction(whatSecret: WhatApiSecret, rateLimits: RateLimits)(
          f: GetRequest => Result): Action[Unit] =
    PlainApiActionApiSecretOnly(whatSecret, rateLimits, cc.parsers.empty)(f)

  def SuperAdminGetAction(f: GetRequest => Result): Action[Unit] =
    PlainApiActionSuperAdminOnly(cc.parsers.empty)(f)

  def AsyncSuperAdminGetAction(f: GetRequest => Future[Result]): Action[Unit] =
    PlainApiActionSuperAdminOnly(cc.parsers.empty).async(f)


  def JsonOrFormDataPostAction(rateLimits: RateLimits, maxBytes: Int,
        allowAnyone: Bo = false, isLogin: Bo = false, skipXsrfCheck: Bo = false)
  (f: ApiRequest[JsonOrFormDataBody] => Result): Action[JsonOrFormDataBody] =
    PlainApiAction(new JsonOrFormDataBodyParser(executionContext, cc).parser(maxBytes = maxBytes),
          rateLimits, allowAnyone = allowAnyone, isLogin = isLogin,
          skipXsrfCheck = skipXsrfCheck)(f)

  def AsyncPostJsonAction(rateLimits: RateLimits, maxBytes: Int,
        allowAnyone: Boolean = false, avoidCookies: Boolean = false)(
        f: JsonPostRequest => Future[Result]): Action[JsValue] =
    PlainApiAction(cc.parsers.json(maxLength = maxBytes),
      rateLimits, allowAnyone = allowAnyone, avoidCookies = avoidCookies).async(f)

  def PostJsonAction(rateLimits: RateLimits,
        minAuthnStrength: MinAuthnStrength = MinAuthnStrength.Normal,
        maxBytes: Int,
        allowAnyone: Boolean = false, isLogin: Boolean = false)(
        f: JsonPostRequest => Result): Action[JsValue] =
    PlainApiAction(cc.parsers.json(maxLength = maxBytes),
        rateLimits, minAuthnStrength, allowAnyone = allowAnyone, isLogin = isLogin)(f)

  def AsyncUserPostJsonAction(rateLimits: RateLimits, maxBytes: i32,
        avoidCookies: Bo = false)(
        f: JsonPostRequest => Future[Result]): Action[JsValue] =
    PlainApiAction(cc.parsers.json(maxLength = maxBytes),
      rateLimits, authnUsersOnly = true, avoidCookies = avoidCookies).async(f)

  def UserPostJsonAction(rateLimits: RateLimits, maxBytes: i32)(
        f: JsonPostRequest => Result): Action[JsValue] =
    PlainApiAction(cc.parsers.json(maxLength = maxBytes),
      rateLimits, authnUsersOnly = true)(f)

  def PostTextAction(rateLimits: RateLimits,
        minAuthnStrength: MinAuthnStrength = MinAuthnStrength.Normal,
        maxBytes: Int, allowAnyone: Boolean = false)(
        f: ApiRequest[String] => Result): Action[String] =
    PlainApiAction(cc.parsers.text(maxLength = maxBytes),
      rateLimits, minAuthnStrength, allowAnyone = allowAnyone)(f)

  SECURITY // add rate limits for staff too. Started, use  StaffPostJsonAction2  below.
  def StaffPostJsonAction(
        minAuthnStrength: MinAuthnStrength = MinAuthnStrength.Normal,
        maxBytes: Int)(f: JsonPostRequest => Result): Action[JsValue] =
    PlainApiActionStaffOnly(
      NoRateLimits, cc.parsers.json(maxLength = maxBytes), minAuthnStrength)(f)

  def StaffPostJsonAction2(
        rateLimits: RateLimits, minAuthnStrength: MinAuthnStrength = MinAuthnStrength.Normal,
        maxBytes: Int)(f: JsonPostRequest => Result): Action[JsValue] =
    PlainApiActionStaffOnly(
      rateLimits, cc.parsers.json(maxLength = maxBytes), minAuthnStrength)(f)

  SECURITY // add rate limits for admins — use AdminPostJsonAction2, then remove this & rm '2' from name.
  def AdminPostJsonAction(maxBytes: Int)(f: JsonPostRequest => Result): Action[JsValue] =
    PlainApiActionAdminOnly(
      NoRateLimits, cc.parsers.json(maxLength = maxBytes))(f)

  def AdminPostJsonAction2(rateLimits: RateLimits, maxBytes: Int)(
        f: JsonPostRequest => Result): Action[JsValue] =
    PlainApiActionAdminOnly(
      rateLimits, cc.parsers.json(maxLength = maxBytes))(f)

  def ApiSecretPostJsonAction(whatSecret: WhatApiSecret, rateLimits: RateLimits, maxBytes: i32)(
        f: JsonPostRequest => Result): Action[JsValue] =
    PlainApiActionApiSecretOnly(
          whatSecret, rateLimits, cc.parsers.json(maxLength = maxBytes))(f)

  def SuperAdminPostJsonAction(maxBytes: Int)(f: JsonPostRequest => Result): Action[JsValue] =
    PlainApiActionSuperAdminOnly(
      cc.parsers.json(maxLength = maxBytes))(f)

  def PostFormAction_unused(rateLimits: RateLimits, maxBytes: i32, allowAnyone: Bo = false,
          skipXsrfCheck: Bo = false)(
          f: ApiRequest[Either[p.mvc.MaxSizeExceeded, Map[St, Seq[St]]]] => Result)
          : Action[Either[MaxSizeExceeded, Map[St, Seq[St]]]] = {
    implicit val materializer = context.akkaStreamMaterializer  // [6KFW02G]
    PlainApiAction(cc.parsers.maxLength(maxBytes, cc.parsers.formUrlEncoded(maxBytes)),
          rateLimits, allowAnyone = allowAnyone, skipXsrfCheck = skipXsrfCheck)(f)
  }


  def PostFilesAction(rateLimits: RateLimits, maxBytes: Int, allowAnyone: Boolean = false)(
        f: ApiRequest[Either[p.mvc.MaxSizeExceeded, MultipartFormData[TemporaryFile]]] => Result)
      : Action[Either[MaxSizeExceeded, MultipartFormData[TemporaryFile]]] = {
    // BodyParsers.parse.maxLength wants a "Materializer", whatever is that?. Later, when
    // using dependency injection, seems needs to do this instead:
    //   class MyController @Inject() (implicit val mat: Materializer) {}
    // read more here:
    //   http://stackoverflow.com/questions/36004414/play-2-5-migration-error-custom-action-with-bodyparser-could-not-find-implicit
    implicit val materializer = context.akkaStreamMaterializer  // [6KFW02G]
    PlainApiAction(cc.parsers.maxLength(maxBytes, cc.parsers.multipartFormData),
      rateLimits, allowAnyone = allowAnyone)(f)
  }



  // ----- Site id lookup


  def originOf(request: DebikiRequest[_]): St =
    globals.originOf(request.underlying)

  def originOf(request: RequestHeader): St =
    globals.originOf(request)


}
