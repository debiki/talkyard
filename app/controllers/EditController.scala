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
import debiki.ReactJson.JsStringOrNull
import debiki.onebox.Onebox
import io.efdi.server.http._
import play.api._
import play.api.libs.json._
import play.api.mvc.{Action => _, _}
import scala.concurrent.ExecutionContext.Implicits.global
import Utils.{parseIntOrThrowBadReq}


/** Edits pages and posts.
  */
object EditController extends mvc.Controller {

  val EmptyPostErrorMessage =
    o"""Cannot save empty posts. If you want to delete this post, please click
        More just below the post, and then Delete. However only the post author
        and staff members can do this."""


  def loadDraftAndGuidelines(writingWhat: String, categoryId: Option[Int], pageRole: String) =
        GetAction { request =>

    val writeWhat = writingWhat.toIntOption.flatMap(WriteWhat.fromInt) getOrElse throwBadArgument(
      "DwE4P6CK0", "writingWhat")

    val thePageRole = pageRole.toIntOption.flatMap(PageRole.fromInt) getOrElse throwBadArgument(
      "DwE6PYK8", "pageRole")

    val guidelinesSafeHtml = writeWhat match {
      case WriteWhat.ChatComment =>
        Some(ChatCommentGuidelines)
      case WriteWhat.Reply =>
        Some(ReplyGuidelines)
      case WriteWhat.ReplyToOriginalPost =>
        if (thePageRole == PageRole.Critique) Some(GiveCritiqueGuidelines) // [plugin]
        else if (thePageRole == PageRole.UsabilityTesting) Some(UsabilityTestingVideoGuidelines) // [plugin]
        else Some(ReplyGuidelines)
      case WriteWhat.OriginalPost =>
        if (thePageRole == PageRole.Critique) Some(AskForCritiqueGuidelines) // [plugin]
        else {
          if (thePageRole == PageRole.FormalMessage) Some(DirectMessageGuidelines)
          else None // Some(OriginalPostGuidelines)
        }
    }

    OkSafeJson(Json.obj(
      "guidelinesSafeHtml" -> JsStringOrNull(guidelinesSafeHtml)))
  }


  /** Sends back a post's current CommonMark source to the browser.
    * SHOULD change to pageId + postId (not postNr)  [idnotnr]
    */
  def loadCurrentText(pageId: String, postNr: Int) = GetAction { request =>
    val post = request.dao.loadPost(pageId, postNr) getOrElse
      throwNotFound("DwE7SKE3", "Post not found")

    if (!debiki.dao.PostsDao.userMayEdit(request.theUser, post))
      throwForbidden("DwE8FKY0", "Not your post")

    OkSafeJson(Json.obj(
      "postUid" -> post.id,
      "currentText" -> post.currentSource,
      "currentRevisionNr" -> post.currentRevisionNr))
  }


  /** Edits posts.
    */
  def edit = PostJsonAction(RateLimits.EditPost, maxBytes = MaxPostSize) {
        request: JsonPostRequest =>
    val pageId = (request.body \ "pageId").as[PageId]
    val postNr = (request.body \ "postNr").as[PostNr] ; SHOULD // change to id, in case moved to other page [idnotnr]
    val newText = (request.body \ "text").as[String]

    if (postNr == PageParts.TitleNr)
      throwForbidden("DwE5KEWF4", "Edit the title via /-/edit-title-save-settings instead")

    if (newText.isEmpty)
      throwBadReq("DwE6KEFW8", EmptyPostErrorMessage)

    _throwIfTooMuchData(newText, request)

    val newTextAndHtml = TextAndHtml(newText, isTitle = false,
      allowClassIdDataAttrs = postNr == PageParts.BodyNr)
      // When follow links? Previously:
      // followLinks = postToEdit.createdByUser(page.parts).isStaff && editor.isStaff

    request.dao.editPostIfAuth(pageId = pageId, postNr = postNr, request.who,
      request.spamRelatedStuff, newTextAndHtml)

    OkSafeJson(ReactJson.postToJson2(postNr = postNr, pageId = pageId,
      request.dao, includeUnapproved = true))
  }


  /** Downloads the linked resource via an external request to the URL (assuming it's
    * a trusted safe site) then creates and returns sanitized onebox html.
    */
  def onebox(url: String) = AsyncGetActionRateLimited(RateLimits.LoadOnebox) { request =>
    Onebox.loadRenderSanitize(url, javascriptEngine = None).transform(
      html => Ok(html),
      throwable => ResultException(BadReqResult("DwE4PKE2", "Cannot onebox that link")))
  }


  def loadPostRevisions(postId: PostId, revisionNr: String) = GetAction { request =>
    val revisionNrInt =
      if (revisionNr == "LastRevision") PostRevision.LastRevisionMagicNr
      else revisionNr.toIntOption getOrElse throwBadRequest("EdE8UFMW2", "Bad revision nr")
    val (revisionsRecentFirst, usersById) =
      request.dao.loadSomeRevisionsRecentFirst(postId, revisionNrInt, atLeast = 5,
          userId = request.user.map(_.id))
    val revisionsJson = revisionsRecentFirst map { revision =>
      val isStaffOrComposer = request.isStaff || request.theUserId == revision.composedById
      ReactJson.postRevisionToJson(revision, usersById, maySeeHidden = isStaffOrComposer)
    }
    OkSafeJson(JsArray(revisionsJson))
  }


  def changePostType = PostJsonAction(RateLimits.EditPost, maxBytes = 100) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val postNr = (request.body \ "postNr").as[PostNr]
    val newTypeInt = (request.body \ "newType").as[Int]
    val newType = PostType.fromInt(newTypeInt) getOrElse throwBadArgument("DwE4EWL3", "newType")

    request.dao.changePostType(pageId = pageId, postNr = postNr, newType,
      changerId = request.theUser.id, request.theBrowserIdData)
    Ok
  }


  // Staff only, *for now*.
  def editPostSettings = StaffPostJsonAction(maxBytes = 100) { request =>
    val postId = (request.body \ "postId").as[PostId]
    val branchSideways = (request.body \ "branchSideways").asOpt[Byte]
    val patch = request.dao.editPostSettings(postId, branchSideways, request.who)
    OkSafeJson(patch) // or skip? [5GKU0234]
  }


  def deletePost = PostJsonAction(RateLimits.DeletePost, maxBytes = 5000) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val postNr = (request.body \ "postNr").as[PostNr]
    val repliesToo = (request.body \ "repliesToo").as[Boolean]

    val action =
      if (repliesToo) PostStatusAction.DeleteTree
      else PostStatusAction.DeletePost(clearFlags = false)

    request.dao.changePostStatus(postNr, pageId = pageId, action, userId = request.theUserId)

    OkSafeJson(ReactJson.postToJson2(postNr = postNr, pageId = pageId, // COULD: don't include post in reply? It'd be annoying if other unrelated changes were loaded just because the post was toggled open? [5GKU0234]
      request.dao, includeUnapproved = request.theUser.isStaff))
  }


  def movePost = StaffPostJsonAction(maxBytes = 100) { request =>
    val pageId = (request.body \ "pageId").as[PageId]   // apparently not used
    val postId = (request.body \ "postId").as[PostId]   // id not nr
    val newHost = (request.body \ "newHost").as[SiteId] // ignore for now though
    val newPageId = (request.body \ "newPageId").as[PageId]
    val newParentNr = (request.body \ "newParentNr").as[PostNr]

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


  val ReplyGuidelines = i"""
    |<p>Be kind to the others.
    |<p>Criticism is welcome — and criticize ideas, not people.
    |"""

  val ChatCommentGuidelines = i"""
    |<p>In a chat comment, you can:</p>
    |<ul>
    |<li>Talk lightly and causally about this topic.</li>
    |<li>Ask the Original Poster for clarifications.</li>
    |<li>Post a topic status update.</li>
    |</ul>
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

  val UsabilityTestingVideoGuidelines = /* [plugin] */ i"""
    |<p>Here you can link to any video you've recorded. However, this is a public forum;
    |anyone can see your link. If you don't like that, then instead post a <i>private message</>
    |to the Original Post author instead (click his/her name). And, here, just reply someting
    |like "Video submitted" so other people know about that.
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

