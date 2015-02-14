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

package controllers

import actions.ApiActions._
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.DebikiHttp._
import play.api._
import play.api.libs.json._
import play.api.libs.json.util._


/**
 * Changes the status of a page, e.g. from Draft to Published.
 */
object PageMetaController extends mvc.Controller {

  /* Accepts this JSON, shown as YAML:
   * - pageId: page-id
   *   newStatus: "Published"
   *   (pageVersion: SHA1-of-the-version-of-the-page-the-browser-knows-about)
   **/

  private case class NewPageMeta(pageId: String, newStatus: String)


  def changeMeta = AdminPostJsonAction(maxLength = 5000) { apiReq =>

    val changes: List[Map[String, String]] =
      apiReq.body.as[List[Map[String, String]]]

    val newMetas2: List[NewPageMeta] = for (change <- changes) yield {
      val pageId = change("pageId")
      val newStatus = change("newStatus")
      NewPageMeta(pageId = pageId, newStatus = newStatus)
    }

    for (metaChanges: NewPageMeta <- newMetas2) {
      val curMeta = apiReq.dao.loadPageMeta(metaChanges.pageId) getOrElse throwForbidden(
        "DwE50BKw2", s"Cannot change page meta: Page not found: ${metaChanges.pageId}")

      val newStatus = PageStatus.parse(metaChanges.newStatus)
      val newMeta: PageMeta = (curMeta.status, newStatus) match {
        case (x, y) if (x == y) =>
          curMeta
        case (PageStatus.Draft, PageStatus.Published) =>
          curMeta.copy(pubDati = Some(apiReq.ctime))
        case (PageStatus.Published, PageStatus.Draft) =>
          curMeta.copy(pubDati = None)
      }

      if (newMeta != curMeta)
        apiReq.dao.updatePageMeta(newMeta, old = curMeta)
    }

    Ok
  }

  /* How do I use Play 2.1's Json stuff??

  val body: JsValue = apiReq.body
  println("body: "+ body)

  val listOfPagesToChange: JsValue = (__ \ "changePageMeta")(body)
  println("listOfPagesToChange: "+ listOfPagesToChange)

  val listOfPagesToChange: JsValue = (__ \ "changePageMeta")(body)
  println("listOfPagesToChange: "+ listOfPagesToChange)

  val readNewMeta = (
    (__ \ "id").read[String] andThen
    (__ \ "status").read[String]
    ) tupled
  */

}

