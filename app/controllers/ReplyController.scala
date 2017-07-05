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
import debiki._
import debiki.DebikiHttp._
import ed.server.auth.Authz
import ed.server.http._
import play.api._
import play.api.libs.json.JsValue
import play.api.mvc._


/** Saves replies. Lazily creates pages for embedded discussions
  * — such pages aren't created until the very first reply is posted.
  */
object ReplyController extends mvc.Controller {


  def handleReply: Action[JsValue] = PostJsonAction(RateLimits.PostReply, maxBytes = MaxPostSize) {
        request: JsonPostRequest =>
    import request.{body, dao, theRequester => requester}
    val pageId = (body \ "pageId").as[PageId]
    //val anyPageUrl = (body \ "pageUrl").asOpt[String]
    val replyToPostNrs = (body \ "postNrs").as[Set[PostNr]]
    val text = (body \ "text").as[String].trim
    val postType = PostType.fromInt((body \ "postType").as[Int]) getOrElse throwBadReq(
      "DwE6KG4", "Bad post type")

    throwBadRequestIf(text.isEmpty, "EdE85FK03", "Empty post")
    throwForbiddenIf(requester.isGroup, "EdE4GKRSR1", "Groups may not reply")

    DISCUSSION_QUALITY; COULD // require that the user has spent a reasonable time reading
    // the topic, in comparison to # posts in the topic, before allowing hen to post a reply.

    val pageMeta = dao.getPageMeta(pageId) getOrElse throwIndistinguishableNotFound("EdE5FKW20")
    val replyToPosts = dao.loadPostsAllOrError(pageId, replyToPostNrs) getOrIfBad { missingPostNr =>
      throwNotFound(s"Post nr $missingPostNr not found", "EdEW3HPY08")
    }
    val categoriesRootLast = dao.loadAncestorCategoriesRootLast(pageMeta.categoryId)
      /* Old, from when embedded comments were still in use & working, will somehow add back later:
      val page = tryCreateEmbeddedCommentsPage(request, pageId, anyPageUrl)
        .getOrElse(throwNotFound("Dw2XEG60", s"Page `$pageId' does not exist"))
      PageRequest.forPageThatExists(request, pageId = page.id) getOrDie "DwE77PJE0"  */

    throwNoUnless(Authz.mayPostReply(
      request.theUserAndLevels, dao.getGroupIds(request.theUser),
      postType, pageMeta, replyToPosts, dao.getAnyPrivateGroupTalkMembers(pageMeta),
      inCategoriesRootLast = categoriesRootLast,
      permissions = dao.getPermsOnPages(categoriesRootLast)),
      "EdEZBXK3M2")

    REFACTOR; COULD // intsetad: [5FLK02]
    // val authzContext = dao.getPageAuthzContext(requester, pageMeta)
    // throwNoUnless(Authz.mayPostReply(authzContext, postType, "EdEZBXK3M2")

    // For now, don't follow links in replies. COULD rel=follow if all authors + editors = trusted.
    val textAndHtml = TextAndHtml.forBodyOrComment(text, followLinks = false)
    val result = dao.insertReply(textAndHtml, pageId = pageId, replyToPostNrs,
      postType, request.who, request.spamRelatedStuff)

    OkSafeJson(result.storePatchJson)
  }


  def handleChatMessage: Action[JsValue] = PostJsonAction(RateLimits.PostReply,
        maxBytes = MaxPostSize) { request =>
    import request.{body, dao}
    val pageId = (body \ "pageId").as[PageId]
    val text = (body \ "text").as[String].trim

    throwBadRequestIf(text.isEmpty, "EsE0WQCB", "Empty chat message")

    val pageMeta = dao.getPageMeta(pageId) getOrElse {
      throwIndistinguishableNotFound("EdE7JS2")
    }
    val replyToPosts = Nil  // currently cannot reply to specific posts, in the chat [7YKDW3]
    val categoriesRootLast = dao.loadAncestorCategoriesRootLast(pageMeta.categoryId)

    throwNoUnless(Authz.mayPostReply(
      request.theUserAndLevels, dao.getGroupIds(request.theMember),
      PostType.ChatMessage, pageMeta, replyToPosts, dao.getAnyPrivateGroupTalkMembers(pageMeta),
      inCategoriesRootLast = categoriesRootLast,
      permissions = dao.getPermsOnPages(categoriesRootLast)),
      "EdEHDETG4K5")

    // Don't follow links in chat mesages — chats don't work with search engines anyway.
    val textAndHtml = TextAndHtml.forBodyOrComment(text, followLinks = false)
    val result = dao.insertChatMessage(
      textAndHtml, pageId = pageId, request.who, request.spamRelatedStuff)

    OkSafeJson(result.storePatchJson)
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
