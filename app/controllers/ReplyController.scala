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

import actions.ApiActions.PostJsonAction
import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.{PostActionPayload => PAP}
import controllers.Utils.OkSafeJson
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.mvc.{Action => _, _}
import requests._


/** Handles reply form submissions. Lazily creates pages for embedded discussions
  * — such pages aren't created until the very first reply is posted.
  */
object ReplyController extends mvc.Controller {


  def handleReply = PostJsonAction(RateLimits.PostReply, maxLength = MaxPostSize) {
        request: JsonPostRequest =>
    val body = request.body
    val pageId = (body \ "pageId").as[PageId]
    val anyPageUrl = (body \ "pageUrl").asOpt[String]
    val postIds = (body \ "postIds").as[Set[PostId]]
    val text = (body \ "text").as[String]
    val wherePerhapsEmpty = (body \ "where").asOpt[String]
    val whereOpt = if (wherePerhapsEmpty == Some("")) None else wherePerhapsEmpty

    // Construct a request that concerns the specified page. Create the page
    // lazily if it's supposed to be a discussion embedded on a static HTML page.
    val pageReq = PageRequest.forPageThatExists(request, pageId = pageId) match {
      case Some(req) => req
      case None =>
        val page = tryCreateEmbeddedCommentsPage(request, pageId, anyPageUrl)
          .getOrElse(throwNotFound("Dw2XEG60", s"Page `$pageId' does not exist"))
        PageRequest.forPageThatExists(request, pageId = page.id) getOrDie "DwE77PJE0"
    }

    if (text.isEmpty)
      throwBadReq("DwE85FK03", "Empty post")

    val post = saveReply(pageReq, replyToPostIds = postIds, text, whereOpt)

    val json = ReactJson.postToJson(post, includeUnapproved = true)
    OkSafeJson(json)
  }


  private def saveReply(pageReq: PageRequest[_], replyToPostIds: Set[PostId],
        text: String, whereOpt: Option[String] = None) = {

    if (pageReq.oldPageVersion.isDefined)
      throwBadReq("DwE72XS8", "Can only reply to latest page version")

    val commonAncestorPostId = pageReq.thePageParts.findCommonAncestorPost(replyToPostIds.toSeq)
    val anyParentPostId =
      if (commonAncestorPostId == PageParts.NoId) {
        if (pageReq.thePageRole == PageRole.EmbeddedComments) {
          // There is no page body. Allow new comment threads with no parent post.
          None
        }
        else {
          throwBadReq(
            "DwE260G8", "This is not an embedded discussion; must reply to an existing post")
        }
      }
      else if (pageReq.thePageParts.getPost(commonAncestorPostId).isDefined) {
        Some(commonAncestorPostId)
      }
      else {
        throwBadReq("DwEe8HD36", o"""Cannot reply to common ancestor post `$commonAncestorPostId';
          it does not exist""")
      }

    val approval = AutoApprover.perhapsApprove(pageReq)
    val multireplyPostIds = if (replyToPostIds.size == 1) Set[PostId]() else replyToPostIds

    val rawPostNoId = RawPostAction(id = PageParts.UnassignedId, postId = PageParts.UnassignedId,
      creationDati = pageReq.ctime, userIdData = pageReq.userIdData,
      payload = PAP.CreatePost(
        parentPostId = anyParentPostId, text = text,
        multireplyPostIds = multireplyPostIds, where = whereOpt, approval = approval))

    val (pageWithNewPost, List(rawPostWithId: RawPostAction[PAP.CreatePost])) =
      pageReq.dao.savePageActionsGenNotfs(pageReq, rawPostNoId::Nil)

    val partsInclAuthor = pageWithNewPost.parts ++ pageReq.anyMeAsPeople
    partsInclAuthor.thePost(rawPostWithId.id)
  }


  private def tryCreateEmbeddedCommentsPage(
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

}
