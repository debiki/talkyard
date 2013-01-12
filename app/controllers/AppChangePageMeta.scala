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
        apiReq.dao.updatePageMeta(newMeta)
    }

    Ok

    /*
    SECURITY; BUG // I've forgotten user permisson control?

    // Play throws java.util.NoSuchElementException: key not found: pageId
    // and e.g. new RuntimeException("String expected")
    // on invalid JSON structure. COULD in some way convert to 400 Bad Request
    // instead of failing with 500 Internal Server Error in Prod mode.
    val actionObjs: List[Map[String, String]] =
       apiReq.body.as[List[Map[String, String]]]

    val reviewsList: List[(String, Review)] = actionObjs map { actionObj =>
      val pageId = actionObj("pageId")
      val actionId = actionObj("actionId")
      pageId -> Review(
          id = "?", targetId = actionId, loginId = apiReq.loginId_!,
          newIp = None, ctime = apiReq.ctime,
          approval = (if (shallApprove) Some(Approval.Manual) else None))
    }

    val reviewsByPageId: Map[String, List[Review]] =
      reviewsList groupBy (_._1) mapValues {
        pageIdAndReviews: List[(String, Review)] => pageIdAndReviews.map(_._2)
      }

    reviewsByPageId foreach { case (pageId, reviews) =>
      val pageWithoutMe = apiReq.dao.loadPage(pageId) getOrElse throwBadReq(
        "DwE93JQ3", "Page not found: "+ pageId +", only some reviews saved")
      val page = pageWithoutMe ++ apiReq.meAsPeople_!

      apiReq.dao.savePageActions(page, reviews)
    }
    */


    /*
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


}

