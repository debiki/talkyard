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

import actions.PageActions._
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.mvc.{Action => _}
import Utils.{OkHtml}
import Utils.parseIntOrThrowBadReq


/** Shows edit history, and applies edit/improvement suggestions.
  */
object AppEditHistory extends mvc.Controller {


  def showForm(pathIn: PagePath, postId: ActionId)
        = PageGetAction(pathIn) { pageReq: PageGetRequest =>

    val page = pageReq.page_!
    val post = page.getPost(postId) getOrElse
      throwForbidden("DwE9kIJ4", s"Post `$postId' not found")

    val (mayEdit, mayEditReason) =
      AppEdit.mayEdit(pageReq.user, post, pageReq.permsOnPage)

    val form = Utils.formHtml(pageReq).editsDialog(
      post, page, pageReq.sid.displayName, mayEdit = mayEdit)

    OkHtml(form)
  }


  def handleForm(pathIn: PagePath)
        = PagePostAction(MaxPostSize)(pathIn) {
      pageReq: PagePostRequest =>

    import Utils.ValidationImplicits._

    // The form input is a list of values that identifies edits
    // to be applied or deleted.
    // Each input value is prefixed by a sequence number, which specifies
    // in which order the values are to be considered.
    // E.g. "12-delete-r0m84610qy".
    // For "-delete-", the id is an edit application id.
    // For "-apply-", it is an edit id.
    val appsAndDels = pageReq.listSkipEmpty("dw-fi-appdel").sorted
    var actions = List[(HistoryEdit, ActionId)]()
    for (seqNoAppOrDel <- appsAndDels) seqNoAppOrDel.split('-') match {
      case Array(seqNo, "delete", editAppId) =>
        actions ::= HistoryEdit.DeleteEditApp -> parseIntOrThrowBadReq(editAppId, "DwE71bF4")
      case Array(seqNo, "apply", editId) =>
        actions ::= HistoryEdit.ApplyEdit -> parseIntOrThrowBadReq(editId, "DwE65fB7")
      case _ =>
        throwBadReq("DwE0kr1x7476", "Bad dw-fi-appdel value: " +
           safed(seqNoAppOrDel))
    }
    actions = actions.reverse
    _applyAndUndoEdits(actions, pageReq)
    Utils.renderOrRedirect(pageReq)
  }


  sealed abstract class HistoryEdit
  object HistoryEdit {
    case object ApplyEdit extends HistoryEdit
    case object DeleteEditApp extends HistoryEdit
  }


  private def _applyAndUndoEdits(changes: List[(HistoryEdit, ActionId)],
        pageReq: PageRequest[_]) {

    val approval = AutoApprover.perhapsApprove(pageReq)

    val page = pageReq.page_!
    var sno = 0
    var actions = for ((histEdit, actionId) <- changes) yield {
      sno += 1

      // ----- Check permissions

      // First, find the id of the edit to apply or revert,
      // and then the id of the post that was edited.
      // Finally, verify that the user may edit that post.
      // (Could extract function: findPostAffectedBy(edit/editApp/undo) ?)

      val editId = histEdit match {
        case HistoryEdit.ApplyEdit => actionId
        case HistoryEdit.DeleteEditApp =>
          // Look up the EditApp to find the Edit id.
          val editApp = page.editApp(withId = actionId) getOrElse
            throwForbidden("DwE017v34", s"EditApp not found: `$actionId'")
          editApp.editId
      }

      val editAffected = page.getPatch(editId) getOrElse
        throwForbidden("DwE03k23", s"Edit not found: `$editId'")

      val postAffected = page.getPost(editAffected.postId) getOrElse
        throwForbidden("DwE82U13k7", s"Post not found: `${editAffected.postId}'")

      val (mayEdit, mayEditReason) =
        AppEdit.mayEdit(pageReq.user, postAffected, pageReq.permsOnPage)
      if (!mayEdit)
        throwForbidden("DwE09253kr1", "Insufficient permissions")

      // ----- Yield list of changes to save

      histEdit match {
        case HistoryEdit.ApplyEdit =>
          EditApp(  // COULD rename to Appl
            id = PageParts.UnassignedId - sno, editId = actionId, postId = postAffected.id,
            loginId = pageReq.loginId_!, userId = pageReq.user_!.id,
            newIp = pageReq.newIp,
            ctime = pageReq.ctime, result = "(Could apply diff)",
            approval = approval)
        case HistoryEdit.DeleteEditApp =>
          unimplemented("Undoing applied edits.")
          /*
          // Should probably replace `Delete`:s of `EditApp`:s
          // with a `Restore` or `Undelete` class whose target is
          // the actual edit, not the `EditApp`.
          // Right now, however, ignore any `approval` — therefore,
          // for now, deletions are always auto approved.
          Delete( // Should be renamed to Undo? ...
            id = "?"+ sno, postId = actionId, // And `postId to actionId?
            loginId = pageReq.loginId_!, userId = pageReq.user_!.id,
            newIp = pageReq.newIp, ctime = pageReq.ctime, wholeTree = false, reason = "")
          */
      }
    }

    // ----- Save all changes

    pageReq.dao.savePageActionsGenNotfs(pageReq, actions)
  }

}
