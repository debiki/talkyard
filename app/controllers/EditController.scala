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
import debiki.EdHttp._
import ed.server.http._
import ed.server.{EdContext, EdController}
import ed.server.auth.Authz
import javax.inject.Inject
import play.api.mvc.{Action, ControllerComponents}
import play.api.libs.json._
import EditController._
import scala.concurrent.ExecutionContext
import talkyard.server.JsX.{JsStringOrNull, JsDraft, JsDraftOrNull}


/** Edits pages and posts.
  */
class EditController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.security.{throwNoUnless, throwIndistinguishableNotFound}
  def execCtx: ExecutionContext = context.executionContext


  REFACTOR // Move to DraftController?
  def loadDraftAndGuidelines(writingWhat: Int, draftType: Int, pageRole: Int,
        categoryId: Option[Int], toUserId: Option[UserId],
        pageId: Option[String], postNr: Option[Int]): Action[Unit] =
      GetActionRateLimited(RateLimits.ReadsFromDb) { request =>

    import request.{dao, requester}

    val theDraftType = DraftType.fromInt(draftType).getOrThrowBadArgument(
      "TyE5BKW2A0", "draftType")

    val anyDraftLocator: Option[DraftLocator] = theDraftType match {
      case DraftType.Scratch =>
        None
      case DraftType.Topic =>
        categoryId.map(catId =>
          DraftLocator(DraftType.Topic, categoryId = Some(catId), pageId = pageId))
      case DraftType.DirectMessage =>
        toUserId.map(userId =>
          DraftLocator(DraftType.DirectMessage, toUserId = Some(userId)))
      case DraftType.Edit =>
        throwBadRequest(
          "TyE2ABKS0", s"Call ${routes.EditController.loadDraftAndText("123", 123).url} instead")
      case DraftType.Reply =>
        val thePageId = pageId.getOrThrowBadArgument("TyE2AKB45", "pageId")
        val thePostNr = postNr.getOrThrowBadArgument("TyE2AKB46", "postNr")
        val thePost = dao.loadPost(thePageId, thePostNr) getOrElse {
          throwIndistinguishableNotFound("TyE8AKVR04")
        }
        Some(DraftLocator(
          DraftType.Reply,
          postId = Some(thePost.id),
          pageId = pageId,
          postNr = postNr))
    }

    val drafts = requester flatMap { theRequester =>
      anyDraftLocator map { draftLocator =>
        dao.readOnlyTransaction { tx =>
          tx.loadDraftsByLocator(theRequester.id, draftLocator)
        }
      }
    } getOrElse Nil

    val writeWhat = WriteWhat.fromInt(writingWhat)

    val thePageRole = PageType.fromInt(pageRole).getOrThrowBadArgument("TyE6PYK8", "pageRole")

    val guidelinesSafeHtml = writeWhat flatMap {
      case WriteWhat.ChatComment =>
        None
        // This is for progress-comments / chrono-comments / bottom-comments:
        //   Some(ChatCommentGuidelines)
      case WriteWhat.Reply =>
        if (thePageRole == PageType.MindMap) {
          // Then we're adding a mind map node — we aren't really replying to anyone.
          None
        }
        else {
          Some(ReplyGuidelines)
        }
      case WriteWhat.ReplyToOriginalPost =>
        if (thePageRole == PageType.MindMap) None // see just above
        else if (thePageRole == PageType.Critique) Some(GiveCritiqueGuidelines) // [plugin]
        else if (thePageRole == PageType.UsabilityTesting) Some(UsabilityTestingTextGuidelines) // [plugin]
        else Some(ReplyGuidelines)
      case WriteWhat.OriginalPost =>
        if (thePageRole == PageType.Critique) Some(AskForCritiqueGuidelines) // [plugin]
        else {
          if (thePageRole == PageType.FormalMessage) Some(DirectMessageGuidelines)
          else None // Some(OriginalPostGuidelines)
        }
    }

    OkSafeJson(Json.obj(
      "drafts" -> JsArray(drafts.map(JsDraft)),
      "guidelinesSafeHtml" -> JsStringOrNull(guidelinesSafeHtml)))
  }


  REFACTOR // Move to DraftController?
  /** Sends back a post's current CommonMark source to the browser.
    * SHOULD change to pageId + postId (not postNr)  [idnotnr]
    */
  def loadDraftAndText(pageId: String, postNr: Int): Action[Unit] =
        GetActionRateLimited(RateLimits.ReadsFromDb) { request =>

    import request.{dao, theRequester => requester}

    val pageMeta = dao.getPageMeta(pageId) getOrElse throwIndistinguishableNotFound("EdE4JBR01")
    val post = dao.loadPost(pageId, postNr) getOrElse throwIndistinguishableNotFound("EdE0DK9WY3")
    val categoriesRootLast = dao.loadAncestorCategoriesRootLast(pageMeta.categoryId)

    throwNoUnless(Authz.mayEditPost(
      request.theUserAndLevels, dao.getOnesGroupIds(request.theUser),
      post, pageMeta, dao.getAnyPrivateGroupTalkMembers(pageMeta),
      inCategoriesRootLast = categoriesRootLast,
      permissions = dao.getPermsOnPages(categoriesRootLast)), "EdEZBXKSM2")

    val draftLocator = DraftLocator(
      DraftType.Edit,
      postId = Some(post.id),
      pageId = Some(post.pageId),
      postNr = Some(post.nr))

    val anyDrafts = dao.readOnlyTransaction { tx =>
      tx.loadDraftsByLocator(requester.id, draftLocator)
    }

    // Not impossible that there're two drafts — if one has two browser tabs open at the same time,
    // and starts editing in both, at the same time. Weird. Just pick one. [manydrafts]
    val anyDraft = anyDrafts.headOption

    OkSafeJson(Json.obj( // LoadDraftAndTextResponse
      "pageId" -> pageId,
      "postNr" -> post.nr,
      "postUid" -> post.id,
      "currentText" -> post.currentSource,
      "currentRevisionNr" -> post.currentRevisionNr,
      "draft" -> JsDraftOrNull(anyDraft)))
  }


  /** Edits posts.
    */
  def edit: Action[JsValue] = PostJsonAction(RateLimits.EditPost, maxBytes = MaxPostSize) {
        request: JsonPostRequest =>
    import request.{dao, body}
    val pageId = (body \ "pageId").as[PageId]
    val postNr = (body \ "postNr").as[PostNr] ; SHOULD // change to id, in case moved to other page [idnotnr]
    val newText = (body \ "text").as[String]
    val deleteDraftNr = (body \ "deleteDraftNr").asOpt[DraftNr]

    if (postNr == PageParts.TitleNr)
      throwForbidden("DwE5KEWF4", "Edit the title via /-/edit-title-save-settings instead")

    if (newText.isEmpty)
      throwBadReq("DwE6KEFW8", EmptyPostErrorMessage)

    _throwIfTooMuchData(newText, request)

    val pageMeta = dao.getPageMeta(pageId) getOrElse throwIndistinguishableNotFound("EdEZWBR81")
    val post = dao.loadPost(pageId, postNr) getOrElse throwIndistinguishableNotFound("EdEBKWRWY9")
    val categoriesRootLast = dao.loadAncestorCategoriesRootLast(pageMeta.categoryId)

    throwNoUnless(Authz.mayEditPost(
      request.theUserAndLevels, dao.getOnesGroupIds(request.theUser),
      post, pageMeta, dao.getAnyPrivateGroupTalkMembers(pageMeta),
      inCategoriesRootLast = categoriesRootLast,
      permissions = dao.getPermsOnPages(categoriesRootLast)), "EdE4JBTYE8")

    val newTextAndHtml = dao.textAndHtmlMaker.forBodyOrComment(
      newText,
      allowClassIdDataAttrs = postNr == PageParts.BodyNr,
      // When follow links? Previously:
      // followLinks = postToEdit.createdByUser(page.parts).isStaff && editor.isStaff
      // But that won't work for wikis (staff might accidentally change a non-staff user's link
      // to rel=follow). For now, instead:
      followLinks = postNr == PageParts.BodyNr && pageMeta.pageType.shallFollowLinks)

    request.dao.editPostIfAuth(pageId = pageId, postNr = postNr, deleteDraftNr = deleteDraftNr,
      request.who, request.spamRelatedStuff, newTextAndHtml)

    OkSafeJson(dao.jsonMaker.postToJson2(postNr = postNr, pageId = pageId,
      includeUnapproved = true))
  }


  /** Downloads the linked resource via an external request to the URL (assuming it's
    * a trusted safe site) then creates and returns sanitized onebox html.
    */
  def onebox(url: String): Action[Unit] = AsyncGetActionRateLimited(RateLimits.LoadOnebox) { request =>
    context.oneboxes.loadRenderSanitize(url, javascriptEngine = None).transform(
      html => Ok(html),
      throwable => throwable match {
        case ex: DebikiException =>
          ResultException(BadReqResult("EdE4PKE0", s"Cannot onebox that link: ${ex.getMessage}"))
        case _ =>
          ResultException(BadReqResult("DwE4PKE2", "Cannot onebox that link"))
      })(execCtx)
  }


  def loadPostRevisions(postId: PostId, revisionNr: String): Action[Unit] =
        GetActionRateLimited(RateLimits.ExpensiveGetRequest) { request =>
    val revisionNrInt =
      if (revisionNr == "LastRevision") PostRevision.LastRevisionMagicNr
      else revisionNr.toIntOption getOrElse throwBadRequest("EdE8UFMW2", "Bad revision nr")
    val (revisionsRecentFirst, usersById) =
      request.dao.loadSomeRevisionsRecentFirst(postId, revisionNrInt, atLeast = 5,
          userId = request.user.map(_.id))
    val revisionsJson = revisionsRecentFirst map { revision =>
      val isStaffOrComposer = request.isStaff || request.user.map(_.id).contains(revision.composedById)
      JsonMaker.postRevisionToJson(revision, usersById, maySeeHidden = isStaffOrComposer)
    }
    OkSafeJson(JsArray(revisionsJson))
  }


  def changePostType: Action[JsValue] = PostJsonAction(RateLimits.EditPost, maxBytes = 300) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val postNr = (request.body \ "postNr").as[PostNr]
    val newTypeInt = (request.body \ "newType").as[Int]
    val newType = PostType.fromInt(newTypeInt) getOrElse throwBadArgument("DwE4EWL3", "newType")

    request.dao.changePostType(pageId = pageId, postNr = postNr, newType,
      changerId = request.theUser.id, request.theBrowserIdData)
    Ok
  }


  // Staff only, *for now*.
  def editPostSettings: Action[JsValue] = StaffPostJsonAction(maxBytes = 300) { request =>
    val postId = (request.body \ "postId").as[PostId]
    val branchSideways = (request.body \ "branchSideways").asOpt[Byte]
    val patch = request.dao.editPostSettings(postId, branchSideways, request.who)
    OkSafeJson(patch) // or skip? [5GKU0234]
  }


  def deletePost: Action[JsValue] = PostJsonAction(RateLimits.DeletePost, maxBytes = 5000) { request =>
    import request.dao
    val pageId = (request.body \ "pageId").as[PageId]
    val postNr = (request.body \ "postNr").as[PostNr]
    val repliesToo = (request.body \ "repliesToo").asOpt[Boolean] getOrElse false

    val action =
      if (repliesToo) PostStatusAction.DeleteTree
      else PostStatusAction.DeletePost(clearFlags = false)

    val result = dao.changePostStatus(postNr, pageId = pageId, action, userId = request.theUserId)

    OkSafeJson(Json.obj(
      "answerGotDeleted" -> result.answerGotDeleted,
      "deletedPost" ->
        // COULD: don't include post in reply? It'd be annoying if other unrelated changes
        // were loaded just because the post was toggled open? [5GKU0234]
        dao.jsonMaker.postToJson2(
          postNr = postNr, pageId = pageId, includeUnapproved = request.theUser.isStaff)))
  }


  def movePost: Action[JsValue] = StaffPostJsonAction(maxBytes = 300) { request =>
    val pageId = (request.body \ "pageId").as[PageId]   // apparently not used
    val postId = (request.body \ "postId").as[PostId]   // id not nr
    val newHost = (request.body \ "newHost").asOpt[String] // ignore for now though
    val newSiteId = (request.body \ "newSiteId").asOpt[SiteId] // ignore for now though
    val newPageId = (request.body \ "newPageId").as[PageId]
    val newParentNr = (request.body \ "newParentNr").asOpt[PostNr].getOrElse(PageParts.BodyNr)

    val (_, storePatch) = request.dao.movePostIfAuth(PagePostId(pageId, postId),
      newParent = PagePostNr(newPageId, newParentNr), moverId = request.theMember.id,
      request.theBrowserIdData)

    OkSafeJson(storePatch)
  }


  private def _throwIfTooMuchData(text: String, request: DebikiRequest[_]) {
    val postSize = text.length
    val user = request.user_!
    if (user.isAdmin) {
      // Allow up to MaxPostSize chars (see above).
    }
    else if (user.isAuthenticated) {
      if (postSize > MaxPostSizeForAuUsers)
        throwEntityTooLarge("DwE413kX5", "Please do not upload that much text")
    }
    else {
      if (postSize > MaxPostSizeForUnauUsers)
        throwEntityTooLarge("DwE413IJ1", "Please do not upload that much text")
    }
  }
}


object EditController {

  val EmptyPostErrorMessage =
    o"""Cannot save empty posts. If you want to delete this post, please use
        the buttons below the post."""

  val ReplyGuidelines = i"""
    |<p>Be kind to the others.
    |<p>Criticism is welcome — and criticize ideas, not people.
    |"""

  val ChatCommentGuidelines = i"""
    |<p>Your comment will be appended at the bottom of the page.</p>
    |<p>Be kind to the others.</p>
    |"""

  val DirectMessageGuidelines = i"""
    |<p>Administrators can view private messages. They need to be able to do that,
    |in case someone posts offensive messages — then the admins
    |can review the messages and suspend that user.
    |</p>
    |"""

  val GiveCritiqueGuidelines = /* [plugin] */ i"""
    |<p>This is a public forum — anyone can read your critique.
    |You give critique to help the poster improve his/her work:
    |<ul>
    |<li>Tell what you think won't work and should be improved, perhaps removed.
    |<li>Try to suggest improvements.
    |<li>Be friendly and polite.
    |<li>Mention things you like.
    |</ul>
    |"""

  val UsabilityTestingTextGuidelines = /* [plugin] */ i"""
    |<p>Give honest feedback, formulated in a <b>friendly</b> and <b>encouraging</b> way,
    |so the receiver will want to <i>continue learning and experimenting</i>.
    |</p>
    |<p>This is a public forum — anyone can see your feedback. To say something in private,
    |post a <i>direct message</i>, by clicking the relevant person's name.
    |</p>
    |"""

  val AskForCritiqueGuidelines = /* [plugin] */ i"""
    |<p>This is a public forum — anyone is welcome to help you.</p>
    |"""

  // This advice actually feels mostly annoying to me: (so currently not in use)
  val OriginalPostGuidelines = i"""
    |<p>In order for more people to reply to you:
    |<ul>
    |<li>Choose a good title, so others will understand what this is about.
    |<li>Including good search words can help others find your topic.
    |</ul>
    |"""
}

