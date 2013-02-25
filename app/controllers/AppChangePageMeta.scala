/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki.DebikiHttp._
import play.api._
import play.api.libs.json._
import play.api.libs.json.util._
import ApiActions._
import Prelude._



/**
 * Changes the status of a page, e.g. from Draft to Published.
 */
object AppChangePageMeta extends mvc.Controller {

  /* Accepts this JSON, shown as YAML:
   * - pageId: page-id
   *   newStatus: "Published"
   *   (pageVersion: SHA1-of-the-version-of-the-page-the-browser-knows-about)
   **/

  private case class NewPageMeta(pageId: String, newStatus: String)


  def changeMeta = PostJsonAction(maxLength = 5000) { apiReq =>

    SECURITY; BUG // I've forgotten user permisson control?

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

