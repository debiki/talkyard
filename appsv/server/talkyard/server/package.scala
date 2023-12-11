/**
 * Copyright (c) 2016, 2021 Kaj Magnus Lindberg
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

package talkyard

import com.debiki.core._
import debiki.Globals
import play.api.libs.json._



package object server {

  type JsonConf = parser.JsonConf
  val JsonConf: parser.JsonConf.type = parser.JsonConf

  type p_Result = play.api.mvc.Result
  val p_Results: play.api.mvc.Results.type = play.api.mvc.Results
  val p_Status: play.api.http.Status.type = play.api.http.Status

  type p_Logger = play.api.Logger

  type j_NoRouteToHostException = java.net.NoRouteToHostException
  type j_IOException = java.io.IOException
  type j_ExecutionException = java.util.concurrent.ExecutionException


  val ProdConfFilePath = "/opt/talkyard/conf/play-framework.conf"

  def isDevOrTest: Boolean = Globals.isDevOrTest

  def TyLogger(name: St, anySiteId: Opt[SiteId] = None): play.api.Logger = {
    logging.TyLogger(name, anySiteId)
  }


  type TyLogging = logging.TyLogging


  def newLogger(clazz: Class[_], anySiteId: Opt[SiteId] = None): play.api.Logger =
    logging.newLogger(clazz, anySiteId)


  implicit class RichResult(val underlying: play.api.mvc.Result) {
    def statusCode: Int = underlying.header.status

    def bodyAsUtf8String: String = {
      import play.api.http.HttpEntity
      underlying.body match {
        case HttpEntity.Strict(byteString, _) =>
          byteString.utf8String
        case _: HttpEntity.Chunked =>
          "(chunked response)"
        case _: HttpEntity.Streamed =>
          "(streamed response)"
      }
    }
  }


  val Whatever = "*"

  val UploadsUrlBasePath = "/-/u/"
  val CustomAssetsUrlBasePath = "/-/site/"

  {
    val uploadsUrlPath: St = controllers.routes.UploadsController.servePublicFile("").url
    assert(uploadsUrlPath == UploadsUrlBasePath, "TyEBADUPLPATH9564")
  }


  /** @param html Html for the whole page.
    * @param unapprovedPostAuthorIds Ids of authors who have posted stuff that hasn't yet been
    *   approved. If one of these authors views the page, hens unapproved posts should
    *   be loaded too, so hen can edit them. (Normally, unapproved posts aren't loaded.)
    */
  case class RenderedPage(
    html: String,
    reactStoreJsonString: String,
    unapprovedPostAuthorIds: Set[UserId],
    anonsByRealId: Map[PatId, Seq[Anonym]])


  REMOVE // ?
  implicit object WhenFormat extends Format[When] {
    def reads(json: JsValue): JsResult[When] = JsSuccess(When.fromMillis(json.as[Long]))
    def writes(when: When): JsValue = JsNumber(when.millis)
  }


  REMOVE // ?
  implicit object OptWhenFormat extends Format[Option[When]] {
    def reads(json: JsValue): JsResult[Option[When]] =
      if (json == JsNull) JsSuccess(None)
      else JsSuccess(Some(When.fromMillis(json.as[Long])))

    def writes(when: Option[When]): JsValue = when match {
      case None => JsNull
      case Some(w) => JsNumber(w.millis)
    }
  }

}
