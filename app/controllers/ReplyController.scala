/**
 * Copyright (c) 2012-2013, 2018 Kaj Magnus Lindberg
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
import debiki.EdHttp._
import ed.server.{EdContext, EdController}
import ed.server.auth.Authz
import ed.server.http._
import javax.inject.Inject
import play.api._
import play.api.libs.json.{JsObject, JsString, JsValue}
import play.api.mvc._


/** Saves replies. Lazily creates pages for embedded discussions
  * — such pages aren't created until the very first reply is posted.
  */
class ReplyController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.security.{throwNoUnless, throwIndistinguishableNotFound}


  def handleReply: Action[JsValue] = PostJsonAction(RateLimits.PostReply, maxBytes = MaxPostSize) {
        request: JsonPostRequest =>
    import request.{body, dao, theRequester => requester}
    val anyPageId = (body \ "pageId").asOpt[PageId]
    val anyAltPageId = (body \ "altPageId").asOpt[AltPageId]
    val anyEmbeddingUrl = (body \ "embeddingUrl").asOpt[String]
    val replyToPostNrs = (body \ "postNrs").as[Set[PostNr]]
    val text = (body \ "text").as[String].trim
    val postType = PostType.fromInt((body \ "postType").as[Int]) getOrElse throwBadReq(
      "DwE6KG4", "Bad post type")
    val deleteDraftNr = (body \ "deleteDraftNr").asOpt[DraftNr]

    throwBadRequestIf(text.isEmpty, "EdE85FK03", "Empty post")
    throwForbiddenIf(requester.isGroup, "EdE4GKRSR1", "Groups may not reply")
    throwBadRequestIf(anyEmbeddingUrl.exists(_ contains '#'), "EdE0GK3P4",
        s"Don't include any URL #hash in the embedding page URL: ${anyEmbeddingUrl.get}")

    DISCUSSION_QUALITY; COULD // require that the user has spent a reasonable time reading
    // the topic, in comparison to # posts in the topic, before allowing hen to post a reply.

    val (pageId, anyNewPagePath) = EmbeddedCommentsPageCreator.getOrCreatePageId(
      anyPageId = anyPageId, anyAltPageId = anyAltPageId,
      anyEmbeddingUrl = anyEmbeddingUrl, request)

    val pageMeta = dao.getPageMeta(pageId) getOrElse throwIndistinguishableNotFound("EdE5FKW20")
    val replyToPosts = dao.loadPostsAllOrError(pageId, replyToPostNrs) getOrIfBad { missingPostNr =>
      throwNotFound(s"Post nr $missingPostNr not found", "EdEW3HPY08")
    }
    val categoriesRootLast = dao.loadAncestorCategoriesRootLast(pageMeta.categoryId)

    throwNoUnless(Authz.mayPostReply(
      request.theUserAndLevels, dao.getOnesGroupIds(request.theUser),
      postType, pageMeta, replyToPosts, dao.getAnyPrivateGroupTalkMembers(pageMeta),
      inCategoriesRootLast = categoriesRootLast,
      permissions = dao.getPermsOnPages(categoriesRootLast)),
      "EdEZBXK3M2")

    REFACTOR; COULD // intstead: [5FLK02]
    // val authzContext = dao.getPageAuthzContext(requester, pageMeta)
    // throwNoUnless(Authz.mayPostReply(authzContext, postType, "EdEZBXK3M2")

    // For now, don't follow links in replies. COULD rel=follow if all authors + editors = trusted.
    val textAndHtml = dao.textAndHtmlMaker.forBodyOrComment(text, followLinks = false)

    val result = dao.insertReply(textAndHtml, pageId = pageId, replyToPostNrs,
      postType, deleteDraftNr, request.who, request.spamRelatedStuff)

    var patchWithNewPageId: JsObject = result.storePatchJson
    if (anyNewPagePath.isDefined) {
      patchWithNewPageId = patchWithNewPageId + ("newlyCreatedPageId" -> JsString(pageId))
    }
    OkSafeJson(patchWithNewPageId)
  }


  def handleChatMessage: Action[JsValue] = PostJsonAction(RateLimits.PostReply,
        maxBytes = MaxPostSize) { request =>
    import request.{body, dao}
    val pageId = (body \ "pageId").as[PageId]
    val text = (body \ "text").as[String].trim
    val deleteDraftNr = (body \ "deleteDraftNr").asOpt[DraftNr]


    throwBadRequestIf(text.isEmpty, "EsE0WQCB", "Empty chat message")

    val pageMeta = dao.getPageMeta(pageId) getOrElse {
      throwIndistinguishableNotFound("EdE7JS2")
    }
    val replyToPosts = Nil  // currently cannot reply to specific posts, in the chat [7YKDW3]
    val categoriesRootLast = dao.loadAncestorCategoriesRootLast(pageMeta.categoryId)

    throwNoUnless(Authz.mayPostReply(
      request.theUserAndLevels, dao.getOnesGroupIds(request.theMember),
      PostType.ChatMessage, pageMeta, replyToPosts, dao.getAnyPrivateGroupTalkMembers(pageMeta),
      inCategoriesRootLast = categoriesRootLast,
      permissions = dao.getPermsOnPages(categoriesRootLast)),
      "EdEHDETG4K5")

    // Don't follow links in chat mesages — chats don't work with search engines anyway.
    val textAndHtml = dao.textAndHtmlMaker.forBodyOrComment(text, followLinks = false)
    val result = dao.insertChatMessage(
      textAndHtml, pageId = pageId, deleteDraftNr, request.who, request.spamRelatedStuff)

    OkSafeJson(result.storePatchJson)
  }


}



object EmbeddedCommentsPageCreator {


  def getOrCreatePageId(  // [4AMJX7]
        anyPageId: Option[PageId],
        anyAltPageId: Option[String],
        anyEmbeddingUrl: Option[String],
        request: DebikiRequest[_]): (PageId, Option[PagePathWithId]) = {
    anyPageId foreach { pageId =>
      if (pageId != NoPageId)
        return (pageId, None)
    }
    (anyAltPageId orElse anyEmbeddingUrl).flatMap(request.dao.getRealPageId) foreach { pageId =>
      return (pageId, None)
    }
    // Create a new embedded discussion page.
    // It hasn't yet been created, and is needed, so we can associate the thing
    // we're currently saving (e.g. a reply) with a page.
    val embeddingUrl = anyEmbeddingUrl getOrElse {
      throwNotFound("TyE0ID0EMBURL", "Page not found and no embedding url specified")
    }
    val newPagePath = tryCreateEmbeddedCommentsPage(request, embeddingUrl, anyAltPageId)
    (newPagePath.pageId, Some(newPagePath))
  }


  private def tryCreateEmbeddedCommentsPage(request: DebikiRequest[_], embeddingUrl: String,
        anyAltPageId: Option[String]): PagePathWithId = {
    import request.{dao, requester, context}

    // (Security, fine: I don't think we need to verify that there is actually a page at
    // the embedding url. Theoretically it's possible for Mallory to post comments to an url,
    // where he knows a page will get auto-published later at a certain date-time. Then,
    // when the page gets auto-published, his possibly weird comments will be there, waiting.
    // But he might as well write a bot that posts the comments, the moments the page gets published?
    // The real solution to this, is instead to moderate new users' first comments, right?)

    val siteSettings = dao.getWholeSiteSettings()
    if (siteSettings.allowEmbeddingFrom.isEmpty) {
      SECURITY; SHOULD // Later, check that allowEmbeddingFrom origin matches... the referer? [4GUYQC0].
      throwForbidden2("EdE2WTKG8", "Embedded comments allow-from origin not configured")
    }

    val slug = None
    val folder = None
    val categoryId = {
      val id = siteSettings.embeddedCommentsCategoryId
      if (id != NoCategoryId) id
      else dao.getDefaultCategoryId()
    }
    val categoriesRootLast = dao.loadAncestorCategoriesRootLast(categoryId)
    val pageRole = PageType.EmbeddedComments

    context.security.throwNoUnless(Authz.mayCreatePage(
      request.theUserAndLevels, dao.getGroupIdsOwnFirst(requester),
      pageRole, PostType.Normal, pinWhere = None, anySlug = slug, anyFolder = folder,
      inCategoriesRootLast = categoriesRootLast,
      permissions = dao.getPermsOnPages(categories = categoriesRootLast)),
      "EdE7USC2R8")

    dao.createPage(pageRole, PageStatus.Published,
      anyCategoryId = Some(categoryId), anyFolder = slug, anySlug = folder,
      titleTextAndHtml = dao.textAndHtmlMaker.forTitle(s"Comments for $embeddingUrl"),
      bodyTextAndHtml = dao.textAndHtmlMaker.forBodyOrComment(s"Comments for: $embeddingUrl"),
      showId = true, deleteDraftNr = None,  // later, there'll be a draft to delete? [BLGCMNT1]
      Who.System, request.spamRelatedStuff, altPageId = anyAltPageId, embeddingUrl = Some(embeddingUrl))
  }

}
