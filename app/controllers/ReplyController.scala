/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import debiki.antispam.AntiSpam.throwForbiddenIfSpam
import io.efdi.server.http._
import play.api._
import play.api.libs.json.JsArray
import play.api.mvc.{Action => _, _}
import scala.concurrent.ExecutionContext.Implicits.global


/** Saves replies. Lazily creates pages for embedded discussions
  * — such pages aren't created until the very first reply is posted.
  */
object ReplyController extends mvc.Controller {


  def handleReply = AsyncPostJsonAction(RateLimits.PostReply, maxLength = MaxPostSize) {
        request: JsonPostRequest =>
    val body = request.body
    val pageId = (body \ "pageId").as[PageId]
    val anyPageUrl = (body \ "pageUrl").asOpt[String]
    val replyToPostNrs = (body \ "postIds").as[Set[PostNr]]
    val text = (body \ "text").as[String].trim
    val wherePerhapsEmpty = (body \ "where").asOpt[String]
    val whereOpt = if (wherePerhapsEmpty == Some("")) None else wherePerhapsEmpty
    val postType = PostType.fromInt((body \ "postType").as[Int]) getOrElse throwBadReq(
      "DwE6KG4", "Bad post type")

    // Construct a request that concerns the specified page. Create the page
    // lazily if it's supposed to be a discussion embedded on a static HTML page.
    SECURITY ; COULD // avoid revealing that a page exists: forPageThatExists below might throw
    // a unique NotFound for example.  [7C2KF24]
    val pageReq = PageRequest.forPageThatExists(request, pageId = pageId) match {
      case Some(req) => req
      case None =>
        unimplemented("Creating embedded comments page [DwE5UYK4]") /*
        val page = tryCreateEmbeddedCommentsPage(request, pageId, anyPageUrl)
          .getOrElse(throwNotFound("Dw2XEG60", s"Page `$pageId' does not exist"))
        PageRequest.forPageThatExists(request, pageId = page.id) getOrDie "DwE77PJE0"
        */
    }

    if (text.isEmpty)
      throwBadReq("DwE85FK03", "Empty post")

    val textAndHtml = TextAndHtml(text, isTitle = false)
    Globals.antiSpam.detectPostSpam(request, pageId, textAndHtml) map { isSpamReason =>
      throwForbiddenIfSpam(isSpamReason, "DwE5JGY0")

      val result = pageReq.dao.insertReply(textAndHtml, pageId = pageId, replyToPostNrs,
        postType, pageReq.who)

      OkSafeJson(result.storePatchJson)
    }
  }


  def handleChatMessage = AsyncPostJsonAction(RateLimits.PostReply, maxLength = MaxPostSize) {
        request =>
    val body = request.body
    val pageId = (body \ "pageId").as[PageId]
    val text = (body \ "text").as[String].trim

    SECURITY ; COULD // avoid revealing that a page exists: forPageThatExists below might throw
    // a unique NotFound for example.  [7C2KF24]
    val pageReq = PageRequest.forPageThatExists(request, pageId = pageId) match {
      case Some(req) => req
      case None =>
        throwNotImplemented("EsE2UYK7", "Creating embedded chat channel")
    }

    if (text.isEmpty)
      throwBadReq("EsE0WQCB", "Empty chat message")

    val textAndHtml = TextAndHtml(text, isTitle = false)
    Globals.antiSpam.detectPostSpam(request, pageId, textAndHtml, quickButLessSafe = true) map {
        isSpamReason =>
      throwForbiddenIfSpam(isSpamReason, "EsE4J7U27")

      val result = pageReq.dao.insertChatMessage(textAndHtml, pageId = pageId, pageReq.who)

      OkSafeJson(result.storePatchJson)
    }
  }


  def handleCustomForm = PostJsonAction(RateLimits.PostReply, maxLength = MaxPostSize) {
        request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val formInputs = (request.body \ "formInputs").as[JsArray]
    val textAndHtml = TextAndHtml.withCompletedFormData(formInputs) getOrIfBad { errorMessage =>
      throwBadRequest("EsE7YK4W0", s"Bad form inputs JSON: $errorMessage")
    }
    request.dao.insertReply(textAndHtml, pageId, Set.empty, PostType.CompletedForm,
        request.whoOrUnknown)
    Ok
  }


  /*
  private def tryCreateEmbeddedCommentsPage(  -- embedded comments disabled [5EU0232]
        request: DebikiRequest[_], pageId: PageId, anyPageUrl: Option[String]): Option[Page] = {

    if (anyPageUrl.isEmpty)
      throwBadReq("Cannot create embedded page: embedding page URL unknown")

    val site = request.dao.loadSite()
    val shallCreateEmbeddedTopic = EmbeddedTopicsController.isUrlFromEmbeddingUrl(
      anyPageUrl.get, site.embeddingSiteUrl)

    if (!shallCreateEmbeddedTopic)
      return None

    val topicPagePath = PagePath(
      request.siteId,
      folder = "/",
      pageId = Some(pageId),
      showId = true,
      pageSlug = "")

    val pageToCreate = Page.newPage(
      PageRole.EmbeddedComments,
      topicPagePath,
      PageParts(pageId),
      publishDirectly = true,
      author = SystemUser.User,
      url = anyPageUrl)

    val newPage = request.dao.createPage(pageToCreate)
    Some(newPage)
  }
    */

}
