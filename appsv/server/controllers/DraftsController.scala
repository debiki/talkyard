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

import scala.collection.Seq
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.EdHttp._
import talkyard.server.{TyContext, TyController}
import talkyard.server.authz.Authz
import talkyard.server.http._
import javax.inject.Inject
import play.api.libs.json._
import play.api.mvc._
import scala.collection.immutable
import talkyard.server.JsX.JsDraft
import talkyard.server.authn.MinAuthnStrength



class DraftsController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {

  import context.globals
  import context.security.{throwNoUnless, throwIndistinguishableNotFound}


  def upsertDraft: Action[JsValue] = PostJsonAction(RateLimits.DraftSomething,
        MinAuthnStrength.EmbeddingStorageSid12, maxBytes = MaxPostSize,
        // We remember which persona this draft should be posted as, independently
        // of any current persona mode (since there's a post-as dropdown in the
        // editor that can be set to sth else than any current persona mode). [_See_ignoreAlias]
        ignoreAlias = true) {
        request: JsonPostRequest =>
    upsertDraftImpl(request.body, request)
  }


  /** In the browser, navigator.sendBeacon insists on sending plain text. So need this text handler.
    */
  def upsertDraftBeacon: Action[String] = PostTextAction(
        RateLimits.DraftSomething,
        MinAuthnStrength.EmbeddingStorageSid12, maxBytes = MaxPostSize,
        // _See_ignoreAlias in upsertDraft() above.
        ignoreAlias = true) { request =>
    val bodyXsrfTokenRemoved = request.body.dropWhile(_ != '\n') // [7GKW20TD]
    val json = Json.parse(bodyXsrfTokenRemoved)
    upsertDraftImpl(json, request)
  }


  private def upsertDraftImpl(body: JsValue, request: ApiRequest[_]): Result = {
    import request.{dao, theRequester => requester}

    throwForbiddenIf(requester.isGroup, "TyE65AFRDJ2", "Groups may not save drafts")
    throwForbiddenIf(0 <= requester.id && requester.id <= 9, "TyE2ABKG5",
      "Special users may not save drafts")

    // Better use the server time? In case the client's clock is wrong? [SERVERTIME]
    // Also, without this, some e2e tests fail (race conditions [DRAFTWAIT]).
    val now = globals.now()
    val parser = talkyard.server.sitepatch.SitePatchParser(context)
    var draft = parser.readDraftOrBad(body, Some(now)) getOrIfBad { problem =>
      throwBadRequest("TyEBDDRFTDT", s"Bad Draft json, problem: $problem")
    }

    throwForbiddenIf(
      !globals.isProd &&  // enable later, a bit untested
      draft.byUserId != NoUserId && draft.byUserId != requester.id,
      "TyE50652TKDU3", o"""Cannot save a draft on behalf of another user:
        requester.id = ${requester.id}, but draft.byUserId = ${draft.byUserId}""")

    draft = draft.copy(
      byUserId = requester.id)  // [602KDGRE20]

    CHECK_AUTHN_STRENGTH

    // Early access control, if possible:
    //
    if (draft.isNewTopic) {
      // For now, authorize this later, when posting topic. The user can just pick another category,
      // in the categories dropdown, if current category turns out to be not allowed, when
      // trying to post.
    }
    else if (draft.isReply && !draft.forWhat.postId.isDefined) {
      // We're replying to a post that doesn't yet exits. This happens
      // if one clicks Reply on an embedded comments page that hasn't yet
      // been lazy-created — it won't get created until the first reply has been
      // posted, or there's a Like vote, etc.
      // For now: Don't do any access control check, until later.
    }
    else if (draft.isReply || draft.isEdit) {
      // Maybe good to know, directly, if not allowed to reply to or edit this post?
      val post = dao.loadPostByUniqueId(draft.forWhat.postId.get
        ) getOrElse throwIndistinguishableNotFound("TyE0DK9WRR")
      val pageMeta = dao.getPageMeta(post.pageId) getOrElse throwIndistinguishableNotFound("TyE2AKBRE5")
      val categoriesRootLast = dao.getAncestorCategoriesRootLast(pageMeta.categoryId)

      if (draft.isReply) {
        val postType = draft.postType getOrDie "TyER35SKS02GU"
        val pageAuthor =
              if (pageMeta.authorId == requester.id) requester
              else dao.getTheParticipant(pageMeta.authorId)
        throwNoUnless(Authz.mayPostReply(
              request.theUserAndLevels, asAlias = None, dao.getOnesGroupIds(requester),
              postType, pageMeta, pageAuthor = pageAuthor,
              Vector(post), dao.getAnyPrivateGroupTalkMembers(pageMeta),
              inCategoriesRootLast = categoriesRootLast,
              tooManyPermissions = dao.getPermsOnPages(categoriesRootLast)), "EdEZBXK3M2")
      }
      else {
        // Won't need later, when true id stored in posts3/nodes_t? [posts3_true_id]
        val postAuthor: Pat =
              if (post.createdById == requester.id) requester
              else dao.getParticipant(post.createdById) getOrDie "TyE2FLU58"
        val pageAuthor =
              if (pageMeta.authorId == requester.id) requester
              else dao.getTheParticipant(pageMeta.authorId)
        throwNoUnless(Authz.mayEditPost(
              request.theUserAndLevels, asAlias = None, dao.getOnesGroupIds(requester),
              post, postAuthor = postAuthor, pageMeta, pageAuthor = pageAuthor,
              dao.getAnyPrivateGroupTalkMembers(pageMeta),
              inCategoriesRootLast = categoriesRootLast,
              tooManyPermissions = dao.getPermsOnPages(categoriesRootLast),
              // We're just saving a draft, can choose an ok alias later if needed.
              ignoreAlias = true), "TyEZBXK3M3")
      }
    }
    else {
      // Don't think this can happen. Doesn't matter, will check authz later when
      // submitting draft, anyway.
    }

    val draftWithNr = dao.readWriteTransaction { tx =>
      val draftWithNr =
        if (draft.draftNr != NoDraftNr) draft else {
          // Stop DoS attacks: don't let people create an unlimited number of drafts. For now,
          // count drafts the last week, max 30 per day?
          COULD_OPTIMIZE // load only the Xth draft?
          val limit = 7 * 30
          val oldDrafts = tx.listDraftsRecentlyEditedFirst(requester.id, limit = limit)
          if (oldDrafts.length >= limit) oldDrafts.lastOption foreach { oldDraft =>
            val daysOld = now.daysSince(oldDraft.lastEditedAt getOrElse oldDraft.createdAt)
            if (daysOld < 7)
              throwTooManyRequests("Saving too many drafts [TyE7BKP32]")
          }
          val nr = tx.nextDraftNr(requester.id)
          draft.copy(draftNr = nr)
        }
      tx.upsertDraft(draftWithNr)
      draftWithNr
    }

    OkSafeJson(
      JsDraft(draftWithNr))
  }


  def listDrafts(userId: UserId): Action[Unit] = GetActionRateLimited(RateLimits.ReadsFromDb) {
        request: GetRequest =>
    import request.{dao, theRequester => requester}

    // Tested here: [7WKABZP2]

    throwForbiddenIf(!requester.isAdmin && requester.id != userId,
      "TyE2RDGWA8", "May not view other's drafts")

    SHOULD; OPTIMIZE // cache per user? don't want to touch the db all the time?

    // Load drafts.
    // The drafts don't included the page title (that'd be dupl data) so we'll also
    // look up the page title and incl in the response.
    val (drafts: immutable.Seq[Draft], pagePostNrsByPostId: Map[PostId, PagePostNr], pageIds) =
        dao.readOnlyTransaction { tx =>
      val ds = tx.listDraftsRecentlyEditedFirst(userId, limit = 500)
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
      "pageTitlesById" -> JsObject(
            pageStuffById.mapValues(stuff => JsString(stuff.title)).toMap)))
  }


  def deleteDrafts: Action[JsValue] = PostJsonAction(RateLimits.DraftSomething,
        MinAuthnStrength.EmbeddingStorageSid12, maxBytes = 1000, ignoreAlias = true) {
        request: JsonPostRequest =>
    deleteDraftsImpl(request.body, request)
  }


  def deleteDraftsBeacon: Action[String] = PostTextAction(RateLimits.DraftSomething,
        MinAuthnStrength.EmbeddingStorageSid12, maxBytes = 1000, ignoreAlias = true) {
        request: ApiRequest[String] =>
    val bodyXsrfTokenRemoved = request.body.dropWhile(_ != '\n') // [7GKW20TD]
    val json = Json.parse(bodyXsrfTokenRemoved)
    deleteDraftsImpl(json, request)
  }


  private def deleteDraftsImpl(json: JsValue, request: ApiRequest[_]): Result = {
    import request.{dao, theRequester => requester}
    val byUserId = requester.id
    val draftNrs = json.as[Seq[DraftNr]]

    CHECK_AUTHN_STRENGTH
    dao.readWriteTransaction { tx =>
      draftNrs.foreach(nr => tx.deleteDraft(byUserId, nr))
    }
    Ok
  }

}
