/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.libs.json.JsValue
import play.api.mvc.{Action => _, _}
import Prelude._


/**
 * Use PageRequest instead iff the request concerns one specific page only.
 */
object ApiActions {

  /**
   * A request with no post data.
   */
  type GetRequest = ApiRequest[Option[Any]]


  /**
   * A request with form data.
   * @deprecated Use ApiRequest[JsonOrFormDataBody] instead.
   */
  type FormDataPostRequest = ApiRequest[Map[String, Seq[String]]]


  type JsonPostRequest = ApiRequest[JsValue]

  def GetAction(f: GetRequest => PlainResult) =
    _PlainApiAction(BodyParsers.parse.empty)(f)


  def JsonOrFormDataPostAction
        (maxBytes: Int)
        (f: ApiRequest[JsonOrFormDataBody] => PlainResult) =
    _PlainApiAction[JsonOrFormDataBody](
      JsonOrFormDataBody.parser(maxBytes = maxBytes))(f)


  /**
   * @deprecated Use ApiRequest[JsonOrFormDataBody] instead
   */
  def PostFormDataAction
        (maxUrlEncFormBytes: Int)
        (f: FormDataPostRequest => PlainResult) =
    _PlainApiAction[Map[String, Seq[String]]](
      BodyParsers.parse.urlFormEncoded(maxLength = maxUrlEncFormBytes))(f)


  /**
   * If the JSON data is rather complex and cannot be represented as form-data,
   * then you cannot use JsonOrFormDataPostAction, and that's when you should
   * use this function.
   */
  def PostJsonAction
        (maxLength: Int)
        (f: JsonPostRequest => PlainResult) =
    _PlainApiAction[JsValue](
      BodyParsers.parse.json(maxLength = maxLength))(f)


  private def _PlainApiAction[A]
        (parser: BodyParser[A])
        (f: ApiRequest[A] => PlainResult) =
      _ApiActionImpl[A](parser)(f)


  // Currently not possible because CheckSidAction wants a PlainResult.
  /* def AsyncApiAction[A]
        (parser: BodyParser[A])
        (f: ApiRequest[A] => AsyncResult) =
    _ApiActionImpl[A, AsyncResult](parser)(f) */


  private def _ApiActionImpl[A]
        (parser: BodyParser[A])
        (f: ApiRequest[A] => PlainResult) =
    SafeActions.CheckSidAction[A](parser) { (sidOk, xsrfOk, request) =>

      val tenantId = DebikiHttp.lookupTenantIdOrThrow(request,
         Debiki.SystemDao)

      val dao = Debiki.tenantDao(tenantId = tenantId,
         ip = request.remoteAddress, sidOk.roleId)

      val (identity, user) = Utils.loadIdentityAndUserOrThrow(sidOk, dao)

      val apiRequest = ApiRequest[A](
        sidOk, xsrfOk, identity, user, dao, request)

      val result = f(apiRequest)
      result
    }

}

