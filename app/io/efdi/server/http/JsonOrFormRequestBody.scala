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

package io.efdi.server.http

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import play.api.libs.json._
import scala.concurrent.ExecutionContext.Implicits.global


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
        case Some(values) => values.filterNot(_ isEmpty)
      }
  }
}


object JsonOrFormDataBody {

  import BodyParsers.parse

  def parser(maxBytes: Int) = parse.using { requestHeader =>
    requestHeader.contentType match {
      case Some("application/x-www-form-urlencoded") =>
        parse.urlFormEncoded(maxLength = maxBytes) map {
          formDataBody: Map[String, Seq[String]] =>
            JsonOrFormDataBody(Some(formDataBody), jsonBody = None)
        }
      case Some("application/json") =>
        parse.json(maxLength = maxBytes) map { jsValue: JsValue =>
          jsValue match {
            case jsObject: JsObject =>
              JsonOrFormDataBody(formDataBody = None, jsonBody = Some(jsObject))
            case _ =>
              throwBadReq("DwE48BW72", "JSON data is not an object but a " +
                  classNameOf(jsValue))
          }
        }
      case Some(x) =>
        throwBadReq("DwE40IZ35", "Unsupported content type: "+ x)
      case None =>
        throwBadReq("DwE40UX93", "No content type specified")
    }
  }

}

