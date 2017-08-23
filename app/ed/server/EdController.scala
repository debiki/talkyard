package ed.server

import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.RateLimits.NoRateLimits
import debiki.RateLimits
import ed.server.http._
import play.api._
import play.api.libs.Files.TemporaryFile
import play.api.libs.json.JsValue
import play.api.mvc._
import play.{api => p}
import scala.concurrent.Future



class EdController(cc: ControllerComponents, val context: EdContext)
  extends AbstractController(cc) {

  import context.globals
  import context.plainApiActions._


  def AsyncGetAction(f: GetRequest => Future[Result]): mvc.Action[Unit] =
    PlainApiAction(BodyParsers.parse.empty, NoRateLimits).async(f)

  def AsyncGetActionAllowAnyone(f: GetRequest => Future[Result]): mvc.Action[Unit] =
    PlainApiAction(BodyParsers.parse.empty, NoRateLimits, allowAnyone = true).async(f)

  def AsyncGetActionIsLogin(f: GetRequest => Future[Result]): mvc.Action[Unit] =
    PlainApiAction(BodyParsers.parse.empty, NoRateLimits, isLogin = true).async(f)

  def AsyncGetActionRateLimited(rateLimits: RateLimits)(f: GetRequest => Future[Result])
        : mvc.Action[Unit] =
    PlainApiAction(BodyParsers.parse.empty, rateLimits).async(f)

  def GetAction(f: GetRequest => Result): Action[Unit] =
    PlainApiAction(BodyParsers.parse.empty, NoRateLimits)(f)

  def GetActionAllowAnyone(f: GetRequest => Result): Action[Unit] =
    PlainApiAction(BodyParsers.parse.empty, NoRateLimits, allowAnyone = true)(f)

  def GetActionAllowAnyoneRateLimited(rateLimits: RateLimits)(f: GetRequest => Result): Action[Unit] =
    PlainApiAction(BodyParsers.parse.empty, rateLimits, allowAnyone = true)(f)

  def GetActionIsLogin(f: GetRequest => Result): Action[Unit] =
    PlainApiAction(BodyParsers.parse.empty, NoRateLimits, isLogin = true)(f)

  def GetActionRateLimited(rateLimits: RateLimits, allowAnyone: Boolean = false)(
        f: GetRequest => Result): Action[Unit] =
    PlainApiAction(BodyParsers.parse.empty, rateLimits, allowAnyone = allowAnyone)(f)

  def StaffGetAction(f: GetRequest => Result): Action[Unit] =
    PlainApiActionStaffOnly(BodyParsers.parse.empty)(f)

  def AsyncAdminGetAction(f: GetRequest => Future[Result]): Action[Unit] =
    PlainApiActionAdminOnly(BodyParsers.parse.empty).async(f)

  def AdminGetAction(f: GetRequest => Result): Action[Unit] =
    PlainApiActionAdminOnly(BodyParsers.parse.empty)(f)

  def SuperAdminGetAction(f: GetRequest => Result): Action[Unit] =
    PlainApiActionSuperAdminOnly(BodyParsers.parse.empty)(f)


  def JsonOrFormDataPostAction(rateLimits: RateLimits, maxBytes: Int,
        allowAnyone: Boolean = false, isLogin: Boolean = false)
  (f: ApiRequest[JsonOrFormDataBody] => Result): Action[JsonOrFormDataBody] =
    PlainApiAction(JsonOrFormDataBody.parser(maxBytes = maxBytes),
      rateLimits, allowAnyone = allowAnyone, isLogin = isLogin)(f)

  def AsyncPostJsonAction(rateLimits: RateLimits, maxBytes: Int, allowAnyone: Boolean = false)(
        f: JsonPostRequest => Future[Result]): Action[JsValue] =
    PlainApiAction(BodyParsers.parse.json(maxLength = maxBytes),
      rateLimits, allowAnyone = allowAnyone).async(f)

  def PostJsonAction(rateLimits: RateLimits, maxBytes: Int, allowAnyone: Boolean = false)(
        f: JsonPostRequest => Result): Action[JsValue] =
    PlainApiAction(BodyParsers.parse.json(maxLength = maxBytes),
      rateLimits, allowAnyone = allowAnyone)(f)

  def PostTextAction(rateLimits: RateLimits, maxBytes: Int, allowAnyone: Boolean = false)(
        f: ApiRequest[String] => Result): Action[String] =
    PlainApiAction(BodyParsers.parse.text(maxLength = maxBytes),
      rateLimits, allowAnyone = allowAnyone)(f)

  def StaffPostJsonAction(maxBytes: Int)(f: JsonPostRequest => Result): Action[JsValue] =
    PlainApiActionStaffOnly(
      BodyParsers.parse.json(maxLength = maxBytes))(f)

  def AdminPostJsonAction(maxBytes: Int)(f: JsonPostRequest => Result): Action[JsValue] =
    PlainApiActionAdminOnly(
      BodyParsers.parse.json(maxLength = maxBytes))(f)

  def SuperAdminPostJsonAction(maxBytes: Int)(f: JsonPostRequest => Result): Action[JsValue] =
    PlainApiActionSuperAdminOnly(
      BodyParsers.parse.json(maxLength = maxBytes))(f)


  def PostFilesAction(rateLimits: RateLimits, maxBytes: Int, allowAnyone: Boolean = false)(
        f: ApiRequest[Either[p.mvc.MaxSizeExceeded, MultipartFormData[TemporaryFile]]] => Result)
      : Action[Either[MaxSizeExceeded, MultipartFormData[TemporaryFile]]] = {
    // BodyParsers.parse.maxLength wants a "Materializer", whatever is that?. Later, when
    // using dependency injection, seems needs to do this instead:
    //   class MyController @Inject() (implicit val mat: Materializer) {}
    // read more here:
    //   http://stackoverflow.com/questions/36004414/play-2-5-migration-error-custom-action-with-bodyparser-could-not-find-implicit
    implicit val materializer = context.akkaStreamMaterializer  // [6KFW02G]
    PlainApiAction(BodyParsers.parse.maxLength(maxBytes, BodyParsers.parse.multipartFormData),
      rateLimits, allowAnyone = allowAnyone)(f)
  }



  // ----- Site id lookup


  def originOf(request: GetRequest) =
    globals.originOf(request.underlying)

  def originOf(request: Request[_]) =
    globals.originOf(request)


  def daoFor(request: Request[_]) = {
    val site = globals.lookupSiteOrThrow(originOf(request))
    globals.siteDao(site.id)
  }


}
