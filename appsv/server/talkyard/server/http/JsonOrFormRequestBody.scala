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

package talkyard.server.http

import com.debiki.core.Prelude._
import debiki.EdHttp._
import play.api.mvc.{BodyParser, ControllerComponents}
import play.api.libs.json._
import scala.concurrent.ExecutionContext


/**
 * HTTP post data, either posted as form-data or as JSON.
 *
 * Debiki's Javascripts usually post JSON, but plain old HTML <form>s send
 * form-data. This class unifies access to form-data and simple JSON
 * objects.
 */
// CLEAN_UP try to delete, not really in use?
case class JsonOrFormDataBody(
  formDataBody: Option[Map[String, Seq[String]]],
  jsonBody: Option[JsObject]) {

  require(formDataBody.isDefined ^ jsonBody.isDefined)


  def parseFormDataOrJson[A](
        parseFormData: (Map[String, Seq[String]]) => A,
        parseJson: (JsObject) => A): A = {
    if (formDataBody isDefined)
      parseFormData(formDataBody.get)
    else
      parseJson(jsonBody.get)
  }


  def getFirst(param: String): Option[String] =
    parseFormDataOrJson(
      _.get(param).map(_.head),
      _.value.get(param).map(_.as[String]))


  def getBool(param: String): Option[Boolean] =
    parseFormDataOrJson(
      _.get(param).map(_.head == "t"),
      _.value.get(param).map(_.as[Boolean]))

  def getBoolOrFalse(param: String): Boolean =
    getBool(param) getOrElse false

  def getBoolOrTrue(param: String): Boolean =
    getBool(param) getOrElse true

  def getOrThrowBadReq(param: String): String =
    parseFormDataOrJson(
      _.get(param).map(_.head),
      _.value.get(param).map(_.as[String])) getOrElse throwBadReq(
      "DwE03Jk5", "Parameter missing: "+ param)


  def getBoolOrThrowBadReq(param: String): Boolean =
    getBool(param) getOrElse throwBadReq(
      "DwE40IZQ3", "Boolaen parameter missing: "+ param)


  def getEmptyAsNone(param: String): Option[String] =
    getFirst(param) match {
      case None => None
      case Some("") => None
      case s @ Some(_: String) => s
    }


  def getNoneAsEmpty(param: String): String =
    getFirst(param) match {
      case None => ""
      case Some(s) => s
    }


  def listSkipEmpty(param: String): Seq[String] = {
    parseFormDataOrJson(
      _.get(param),
      _.value.get(param).map(_.as[List[String]]))
      match {
        case None => Nil
        case Some(values) => values.filterNot(_.isEmpty)
      }
  }
}


class JsonOrFormDataBodyParser(
  val executionContext: ExecutionContext,
  val cc: ControllerComponents) {

  def parser(maxBytes: Long): BodyParser[JsonOrFormDataBody] =
        BodyParser("json-or-form-urlencoded") { request =>

    request.contentType match {
      case Some("application/x-www-form-urlencoded") =>
        cc.parsers.formUrlEncoded(maxLength = maxBytes)(request).map(_.right.map(
          (formDataBody: Map[String, Seq[String]]) =>
            JsonOrFormDataBody(Some(formDataBody), jsonBody = None)))(executionContext)
      case Some("application/json") =>
        cc.parsers.json(maxLength = maxBytes)(request).map(_.right.map {
          case jsObject: JsObject =>
            JsonOrFormDataBody(formDataBody = None, jsonBody = Some(jsObject))
          case jsOther =>
            throwBadReq(
              "DwE48BW72",
              s"JSON data is not an object but a ${classNameOf(jsOther)}")
        })(executionContext)
      case Some(x) =>
        throwBadReq("TyE40IZ35", "Unsupported content type: "+ x)
      case None =>
        throwBadReq("TyE40UX93", "No content type specified")
    }
  }

}

