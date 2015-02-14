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

import actions.ApiActions._
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.libs.json._
import play.api.mvc.{Action => _, _}
import requests._
import Utils.{OkSafeJson, parseIntOrThrowBadReq}


/** Edits pages.
  *
 * SECURITY BUG I think it's possible to use edit GET/POST requests
 * to access and *read* hidden pages. I don't think I do any access control
 * when sending the current markup source back to the browser? Only when
 * actually saving something ...?
 *  -- I'm doing it *sometimes* when loading PermsOnPage via
 *  PageActions.PageReqAction?
 */
object EditController extends mvc.Controller {


  /** Sends back a post's current CommonMark source to the browser.
    */
  def loadCurrentText(pageId: String, postId: String) = GetAction { request =>
    val postIdAsInt = parseIntOrThrowBadReq(postId, "DwE1Hu80")
    val page = request.dao.loadPageParts(pageId) getOrElse
      throwNotFound("DwE7SKE3", "Page not found")
    val post = page.getPost(postIdAsInt) getOrElse
      throwNotFound("DwE4FKW2", "Post not found")
    val currentText = post.currentText
    val json = Json.obj("currentText" -> currentText)
    OkSafeJson(json)
  }


  /** Edits posts.
    */
  def edit = PostJsonAction(RateLimits.EditPost, maxLength = MaxPostSize) {
        request: JsonPostRequest =>
    val pageId = (request.body \ "pageId").as[PageId]
    val postId = (request.body \ "postId").as[PostId]
    val newText = (request.body \ "text").as[String]

    val pageRequest =
        PageRequest.forPageThatExists(request, pageId) getOrElse throwBadReq(
          "DwE47ZI2", s"Page `$pageId' does not exist")

    _throwIfTooMuchData(newText, pageRequest)

    val postAfter = saveEdit(pageRequest, postId = postId, newText = newText)

    OkSafeJson(ReactJson.postToJson(postAfter, includeUnapproved = true))
  }


  private def _throwIfTooMuchData(text: String, request: DebikiRequest[_]) {
    val postSize = text.size
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


  /** Saves an edit in the database. Returns the edited post.
    */
  private def saveEdit(pageReq: PageRequest[_],
        postId: PostId, newText: String): Post = {

    val post = pageReq.thePageParts.thePost(postId)

    if (newText == post.currentText)
      return post

    val patchText = makePatch(from = post.currentText, to = newText)

    val (mayEdit, mayEditReason) =
      EditController.mayEdit(pageReq.user, post, pageReq.permsOnPage)

    def editsOwnPost = pageReq.user_!.id == post.userId

    val approval =
        if (mayEdit) {
          if (editsOwnPost && post.currentVersionPrelApproved) {
            // Let the user continue editing his/her preliminarily approved comment.
            Some(Approval.Preliminary)
          }
          else {
            AutoApprover.perhapsApprove(pageReq)
          }
        }
        else None

    val edit = RawPostAction.toEditPost(
      id = PageParts.UnassignedId, postId = post.id, ctime = pageReq.ctime,
      userIdData = pageReq.userIdData,
      text = patchText, approval = approval, autoApplied = mayEdit)

    val actions = edit :: Nil
    val (pageAfter, _) = pageReq.dao.savePageActionsGenNotfs(pageReq, actions)
    val partsInclEditor = pageAfter.parts ++ pageReq.anyMeAsPeople
    val postAfter = partsInclEditor.thePost(postId)
    postAfter
  }


  /**
   * Returns (true/false, reason) if the user may/not edit `vipo'.
   */
  def mayEdit(user: Option[User], post: Post, perms: PermsOnPage)
        : (Boolean, String) = {

    def isOwnPost = user.map(_.id) == Some(post.userId)
    def isPage = post.id == PageParts.BodyId || post.id == PageParts.TitleId

    if (post.id == PageParts.ConfigPostId && !perms.editPageTemplate)
      (false, "May not edit page template")
    else if (isOwnPost)
      (true, "May edit own post")
    else if (perms.editAnyReply && !isPage)
      (true, "May edit any reply")
    else if (perms.editPage && isPage)
      (true, "May edit root post")
    else
      (false, "")
  }

}

