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

package actions

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.libs.json.JsValue
import play.api.mvc.{Action => _, _}
import requests._
import controllers.Utils


/** Play Framework Actions for requests to Debiki's HTTP API.
  *
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

  def GetAction(f: GetRequest => Result) =
    _PlainApiAction(BodyParsers.parse.empty)(f)


  def JsonOrFormDataPostAction
        (maxBytes: Int)
        (f: ApiRequest[JsonOrFormDataBody] => Result) =
    _PlainApiAction[JsonOrFormDataBody](
      JsonOrFormDataBody.parser(maxBytes = maxBytes))(f)


  /**
   * @deprecated Use ApiRequest[JsonOrFormDataBody] instead
   */
  def PostFormDataAction
        (maxUrlEncFormBytes: Int)
        (f: FormDataPostRequest => Result) =
    _PlainApiAction[Map[String, Seq[String]]](
      BodyParsers.parse.urlFormEncoded(maxLength = maxUrlEncFormBytes))(f)


  /**
   * If the JSON data is rather complex and cannot be represented as form-data,
   * then you cannot use JsonOrFormDataPostAction, and that's when you should
   * use this function.
   */
  def PostJsonAction
        (maxLength: Int)
        (f: JsonPostRequest => Result) =
    _PlainApiAction[JsValue](
      BodyParsers.parse.json(maxLength = maxLength))(f)


  private def _PlainApiAction[A]
        (parser: BodyParser[A])
        (f: ApiRequest[A] => Result) =
      _ApiActionImpl[A](parser)(f)


  private def _ApiActionImpl[A]
        (parser: BodyParser[A])
        (f: ApiRequest[A] => Result) =
    SafeActions.CheckSidAction[A](parser) { (sidOk, xsrfOk, browserId, request) =>

      val tenantId = DebikiHttp.lookupTenantIdOrThrow(request, Globals.systemDao)

      val dao = Globals.siteDao(siteId = tenantId,
         ip = request.remoteAddress, sidOk.roleId)

      val (identity, user) = Utils.loadIdentityAndUserOrThrow(sidOk, dao)

      val apiRequest = ApiRequest[A](
        sidOk, xsrfOk, browserId, identity, user, dao, request)

      val result = f(apiRequest)
      result
    }

}

