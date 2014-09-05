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
    *
    * JSON format, as Yaml:
    *  editPosts:
    *    - pageId
    *      postId
    *      text
    *      markup
    *    - ...more edits
    */
  def edit = PostJsonAction(maxLength = MaxPostSize) {
        request: JsonPostRequest =>

    val ErrPrefix = "/-/edit: Bad JSON:"

    def getIntOrThrow(map: Map[String, JsValue], key: String): Int =
      parseIntOrThrowBadReq(getTextOrThrow(map, key), "DwE38XU7")

    def getTextOrThrow(map: Map[String, JsValue], key: String): String =
      getTextOptOrThrow(map, key).getOrElse(throwBadReq(
        "DwE390IR7", s"$ErrPrefix Entry missing: $key"))

    def getTextOptOrThrow(map: Map[String, JsValue], key: String): Option[String] =
      map.get(key).map(_ match {
        case s: JsString => s.value
        case x => throwBadReq("DwE77dY0", o"""$ErrPrefix Entry `$key' is no string: `$x',
            it is a ${classNameOf(x)}""")
      })

    val jsonBody = request.body.as[Map[String, List[Map[String, JsValue]]]]

    // ----- Edit posts

    val editMapsUnsorted: List[Map[String, JsValue]] =
      jsonBody.getOrElse("editPosts", Nil)

    val editMapsByPageId: Map[String, List[Map[String, JsValue]]] =
      editMapsUnsorted.groupBy(map => getTextOrThrow(map, "pageId"))
    var editIdsAndPages = List[(List[ActionId], PageParts)]()

    for ((pageId, editMaps) <- editMapsByPageId) {

      val pageReqPerhapsNoMe =
          PageRequest.forPageThatExists(request, pageId) getOrElse throwBadReq(
            "DwE47ZI2", s"Page `$pageId' does not exist")

      // Include current user on the page to be edited, or it won't be
      // possible to render the page to html, later, because the current
      // user's name might be included in the generated html: "Edited by: ..."
      // (but if this is the user's first contribution to the page, s/he
      // is currently not included in the associated People).
      val pageRequest = pageReqPerhapsNoMe.copyWithMeOnPage_!

      var actions = List[RawPostAction[_]]()
      var idsOfEditedPosts = List[ActionId]()

      for (editMap <- editMaps) {
        val newText = getTextOrThrow(editMap, "text")
        val newMarkupOpt = getTextOptOrThrow(editMap, "markup")
        val postId = getIntOrThrow(editMap, "postId")

        _throwIfTooMuchData(newText, pageRequest)

        _saveEdits(pageRequest, postId = postId, newText = newText,
            newMarkupOpt = newMarkupOpt) match {
          case None =>
            // No changes made. (newText is the current text.)
          case Some(edit) =>
            actions :::= edit :: Nil
            idsOfEditedPosts ::= edit.id
        }
      }

      val page = pageRequest.page_! ++ actions
      editIdsAndPages ::= (idsOfEditedPosts, page)
    }

    // Show the unapproved version of this post, so any applied edits are included.
    // (An edit suggestion, however, won't be included, until it's been applied.)
    OkSafeJson(
      BrowserPagePatcher(request, showAllUnapproved = true)
        .jsonForMyEditedPosts(editIdsAndPages))
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


  /** Saves an edit in the database.
    * Returns 1) any lazily created post, and 2) the edit that was saved.
    * Returns None if no changes was made (if old text == new text).
    */
  private def _saveEdits(pageReq: PageRequest[_],
        postId: ActionId, newText: String, newMarkupOpt: Option[String])
        : Option[RawPostAction[_]] = {

    val post = pageReq.page_!.getPost(postId) getOrElse
      throwNotFound("DwE3k2190", s"Post not found: $postId")

    val markupChanged =
      newMarkupOpt.isDefined && newMarkupOpt != Some(post.markup)
    if (newText == post.currentText && !markupChanged)
      return None  // need do nothing

    // Don't allow any kind of html in replies.
    //if (markupChanged && pid != Page.BodyId && !Markup.isPlain(newMarkup))
    // reply forbidden
    // (and also when *creating* a post)

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
      text = patchText, newMarkup = newMarkupOpt,
      approval = approval, autoApplied = mayEdit)

    val actions = edit :: Nil
    val (_, actionsWithIds) = pageReq.dao.savePageActionsGenNotfs(pageReq, actions)

    Some(actionsWithIds.last)
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

