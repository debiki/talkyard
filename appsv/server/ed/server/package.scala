/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
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

package ed

import com.debiki.core._
import play.api.libs.json._


package object server {

  val Whatever = "*"

  val UploadsUrlBasePath = "/-/u/"


  /** @param html Html for the whole page.
    * @param unapprovedPostAuthorIds Ids of authors who have posted stuff that hasn't yet been
    *   approved. If one of these authors views the page, hens unapproved posts should
    *   be loaded too, so hen can edit them. (Normally, unapproved posts aren't loaded.)
    */
  case class RenderedPage(
    html: String,
    reactStoreJsonString: String,
    unapprovedPostAuthorIds: Set[UserId])


  implicit object WhenFormat extends Format[When] {
    def reads(json: JsValue): JsResult[When] = JsSuccess(When.fromMillis(json.as[Long]))
    def writes(when: When): JsValue = JsNumber(when.millis)
  }


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

