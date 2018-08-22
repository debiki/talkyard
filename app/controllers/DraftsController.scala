/**
 * Copyright (c) 2018 Kaj Magnus Lindberg
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
import debiki.EdHttp._
import ed.server.{EdContext, EdController}
import ed.server.auth.Authz
import ed.server.http._
import javax.inject.Inject
import play.api._
import play.api.libs.json._
import play.api.mvc._
import scala.util.Try
import JsX.JsDraft
import scala.collection.immutable


class DraftsController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.globals
  import context.security.{throwNoUnless, throwIndistinguishableNotFound}


  def upsertDraft: Action[JsValue] = PostJsonAction(RateLimits.DraftSomething, maxBytes = MaxPostSize) {
        request: JsonPostRequest =>
    import request.{body, dao, theRequester => requester}

    throwForbiddenIf(requester.isGroup, "EdE65AFRDJ2", "Groups may not save drafts")

    val locatorJson = (body \ "forWhat").asOpt[JsObject] getOrThrowBadArgument(
      "TyE4AKBP20", "No draft locator: forWhat missing")

    val draftNr = (body \ "draftNr").asOpt[DraftNr].getOrElse(NoDraftNr)
    val draftTypeInt = (locatorJson \ "draftType").as[Int]
    val draftType = DraftType.fromInt(draftTypeInt) getOrThrowBadArgument(
      "TyE4AKBP22", s"Draft type not specified: ${locatorJson.toString}")

    val pageId = (locatorJson \ "pageId").asOpt[PageId]
    val postNr = (locatorJson \ "postNr").asOpt[PostNr]
    val postId = (locatorJson \ "postId").asOpt[PostId] orElse {
      if (pageId.isDefined && postNr.isDefined) {
        // The browser currently doesn't send the post id, for new replies. [4BKG0BKR0]
        dao.loadPost(pageId.get, postNr.get).map(_.id)
      }
      else {
        None
      }
    }

    // This currently rejects drafts for the very first comment, on an embedded comments page
    // — because the page hasn't yet been created; there's no page id, so no locator can
    // be constructed. COULD add an embeddingPageAltId field? as part of the locator?
    // UX SHOULD save draft also for this 1st blog post comment.  [BLGCMNT1]
    val draftLocator = Try(
      DraftLocator(
        draftType,
        categoryId = (locatorJson \ "categoryId").asOpt[CategoryId],
        toUserId = (locatorJson \ "toUserId").asOpt[UserId],
        postId = postId,
        pageId = pageId,
        postNr = postNr)) getOrIfFailure { ex =>
      throwBadRequest("TyEBDDRFTLC", ex.getMessage)
    }

    val draft = Try(
      Draft(
        byUserId = requester.id,
        draftNr = draftNr,
        forWhat = draftLocator,
        createdAt = (body \ "createdAt").asOptWhen.getOrElse(globals.now()),
        lastEditedAt = (body \ "lastEditedAt").asOptWhen,
        deletedAt = (body \ "deletedAt").asOptWhen,
        topicType = (body \ "topicType").asOpt[Int].flatMap(PageRole.fromInt),
        postType = (body \ "postType").asOpt[Int].flatMap(PostType.fromInt),
        title = (body \ "title").asOptStringNoneIfBlank.getOrElse(""),
        text = (body \ "text").as[String].trim())) getOrIfFailure { ex =>
      throwBadRequest("TyEBDDRFTDT", ex.getMessage)
    }

    throwForbiddenIf(draft.text.isEmpty && draft.title.isEmpty,
      "TyE4RBK02R9", "Draft empty. Delete it instead")

    if (draft.isNewTopic) {
      // For now, check later, when posting topic. The user can just pick another category,
      // in the categories dropdown, if current category turns out to be not allowed, when
      // trying to post.
    }
    else if (draft.isReply) {
      // Maybe good to know, directly, if not allowed to reply to this post?

      val pageMeta = dao.getThePageMeta(draftLocator.pageId getOrDie "TyE2ABS049S")
      val categoriesRootLast = dao.loadAncestorCategoriesRootLast(pageMeta.categoryId)
      val postType = draft.postType getOrDie "TyER35SKS02GU"
      val replyToPost =
        dao.loadPost(pageMeta.pageId, draftLocator.postNr getOrDie "TyESRK0437")
          .getOrElse(throwIndistinguishableNotFound("TyE4WEB93"))

      throwNoUnless(Authz.mayPostReply(
        request.theUserAndLevels, dao.getGroupIds(requester),
        postType, pageMeta, Vector(replyToPost), dao.getAnyPrivateGroupTalkMembers(pageMeta),
        inCategoriesRootLast = categoriesRootLast,
        permissions = dao.getPermsOnPages(categoriesRootLast)), "EdEZBXK3M2")
    }
    else if (draft.isEdit) {
      // Maybe good to know, directly, if may not edit?

      val post = dao.loadPostByUniqueId(draftLocator.postId.get) getOrElse throwIndistinguishableNotFound("TyE0DK9WRR")
      val pageMeta = dao.getPageMeta(post.pageId) getOrElse throwIndistinguishableNotFound("TyE2AKBRE5")
      val categoriesRootLast = dao.loadAncestorCategoriesRootLast(pageMeta.categoryId)

      throwNoUnless(Authz.mayEditPost(
        request.theUserAndLevels, dao.getGroupIds(requester),
        post, pageMeta, dao.getAnyPrivateGroupTalkMembers(pageMeta),
        inCategoriesRootLast = categoriesRootLast,
        permissions = dao.getPermsOnPages(categoriesRootLast)), "EdEZBXK3M2")
    }

    val draftWithNr = dao.readWriteTransaction { tx =>
      val draftWithNr =
        if (draft.draftNr != NoDraftNr) draft else {
          val nr = tx.nextDraftNr(requester.id)
          draft.copy(draftNr = nr)
        }
      tx.upsertDraft(draftWithNr)
      draftWithNr
    }

    OkSafeJson(
      JsDraft(draftWithNr))
  }


  def listDrafts(userId: UserId): Action[Unit] = GetAction { request: GetRequest =>
    import request.{dao, theRequester => requester}

    TESTS_MISSING // [7WKABZP2]

    throwForbiddenIf(!requester.isAdmin && requester.id != userId,
      "TyE2RDGWA8", "May not view other's drafts")

    SHOULD; OPTIMIZE // cache per user? don't want to touch the db all the time?
    SECURITY; COULD // rate limit? max 1 cache-miss req per 5 seconds on average?

    val (drafts: immutable.Seq[Draft], pagePostNrsByPostId: Map[PostId, PagePostNr], pageIds) =
        dao.readOnlyTransaction { tx =>
      val ds = tx.listDraftsRecentlyEditedFirst(userId)
      val postIds = ds.flatMap(_.forWhat.postId).toSet
      val pagePostNrsByPostId = tx.loadPagePostNrsByPostIds(postIds)
      val pageIdsToReplyTo = ds.flatMap(_.forWhat.pageId).toSet
      val allPageIds: Set[PageId] = pageIdsToReplyTo ++ pagePostNrsByPostId.values.map(_.pageId)
      (ds, pagePostNrsByPostId, allPageIds)
    }

    val pageStuffById = dao.getPageStuffById(pageIds)

    val pagePostNrs: Seq[(String, JsValue)] = pagePostNrsByPostId.map({
        case (postId, ppnr) => (postId.toString, Json.arr(ppnr.pageId, ppnr.postNr))
      }).toSeq

    // Typescript: ListDraftsResponse.
    OkSafeJson(Json.obj(
      "drafts" -> JsArray(drafts map JsDraft),
      "pagePostNrsByPostId" -> JsObject(pagePostNrs),
      "pageTitlesById" -> JsObject(pageStuffById.mapValues(stuff => JsString(stuff.title)))))
  }


  def deleteDrafts: Action[JsValue] = PostJsonAction(RateLimits.DraftSomething, maxBytes = 1000) {
      request: JsonPostRequest =>
    import request.{body, dao, theRequester => requester}

    val byUserId = requester.id
    val draftNrs = body.as[Seq[DraftNr]]

    val foundAndDeleted = dao.readWriteTransaction { tx =>
      draftNrs.foreach(nr => tx.deleteDraft(byUserId, nr))
    }

    Ok
  }

}
