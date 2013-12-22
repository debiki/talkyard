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

import actions.ApiActions.PostJsonAction
import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.{PostActionPayload => PAP}
import controllers.Utils.OkSafeJson
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.data._
import play.api.data.Forms._
import play.api.mvc.{Action => _, _}
import requests.{DebikiRequest, PageRequest}
import actions.ApiActions.JsonPostRequest
import Utils.{OkHtml, OkHtmlBody}
import BrowserPagePatcher.TreePatchSpec


/** Handles reply form submissions. Lazily creates pages for embedded discussions
  * — such pages aren't created until the very first reply is posted.
  */
object AppReply extends mvc.Controller {


  def handleReply = PostJsonAction(maxLength = MaxPostSize) { request: JsonPostRequest =>
    val body = request.body
    val pageId = (body \ "pageId").as[PageId]
    val anyParentPageId = (body \ "parentPageId").asOpt[PageId]
    val postId = (body \ "postId").as[PostId]
    val text = (body \ "text").as[String]
    val wherePerhapsEmpty = (body \ "where").asOpt[String]
    val whereOpt = if (wherePerhapsEmpty == Some("")) None else wherePerhapsEmpty

    // Construct a request that concerns the specified page. Create the page
    // lazily if it's supposed to be a discussion embedded on a static HTML page.
    val pageReq = PageRequest.forPageThatExists(request, pageId = pageId) match {
      case Some(req) => req
      case None =>
        val parentPageId = anyParentPageId getOrElse throwNotFound(
          "DwE7GU38", s"Page `$pageId' does not exist")
        val page = tryCreateEmbeddedCommentsPage(request, pageId)
          .getOrElse(throwNotFound("Dw2XEG60", s"Page `$pageId' does not exist"))
        PageRequest.forPageThatExists(request, pageId = page.id) getOrDie "DwE77PJE0"
    }

    val json = saveReply(pageReq, replyTo = postId, text, whereOpt)
    OkSafeJson(json)
  }


  def saveReply(pageReqNoMeOnPage: PageRequest[_], replyTo: PostId, text: String,
        whereOpt: Option[String] = None) = {

    val postIdToReplyTo = replyTo

    val pageReq = pageReqNoMeOnPage.copyWithMeOnPage_!
    if (pageReq.oldPageVersion.isDefined)
      throwBadReq("DwE72XS8", "Can only reply to latest page version")

    // Todo: Do allow no parent post, if it's an embedded forum topic.
    if (pageReq.page_!.getPost(postIdToReplyTo) isEmpty)
      throwBadReq("DwEe8HD36", s"Cannot reply to post `$postIdToReplyTo'; it does not exist")

    val approval = AutoApprover.perhapsApprove(pageReq)

    val postNoId = PostActionDto(id = PageParts.UnassignedId, postId = PageParts.UnassignedId,
      creationDati = pageReq.ctime, loginId = pageReq.loginId_!, userId = pageReq.user_!.id,
      newIp = pageReq.newIp, payload = PAP.CreatePost(
        parentPostId = Some(postIdToReplyTo), text = text, markup = Markup.DefaultForComments.id,
        where = whereOpt, approval = approval))

    val (pageWithNewPost, List(postWithId: PostActionDto[PAP.CreatePost])) =
      pageReq.dao.savePageActionsGenNotfs(pageReq, postNoId::Nil)

    val patchSpec = TreePatchSpec(postWithId.id, wholeTree = true)
    BrowserPagePatcher(pageReq).jsonForTrees(pageWithNewPost.parts, patchSpec)
  }


  private def tryCreateEmbeddedCommentsPage(
        request: DebikiRequest[_], pageId: PageId): Option[Page] = {

    val site = request.dao.loadSite()
    val shallCreateEmbeddedTopic = EmbeddedTopicsController.isRequestFromEmbeddingUrl(
      request.request, site.embeddingSiteUrl)

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
      author = SystemUser.User)

    val newPage = request.dao.createPage(pageToCreate)
    Some(newPage)
  }

}
