package controllers

/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.mvc.{Action => _}
import Actions._
import Prelude._
import Utils.{OkHtml}


object AppEditHistory extends mvc.Controller {


  def showForm(pathIn: PagePath, pageRoot: PageRoot, postId: String)
        = PageGetAction(pathIn) { pageReq: PageGetRequest =>

    val page = pageReq.page_!
    val post = page.vipo(postId) getOrElse
      throwForbidden("DwE9kIJ4", "Post "+ safed(postId) +" not found")

    val (mayEdit, mayEditReason) =
      AppEdit.mayEdit(pageReq.user, post, pageReq.permsOnPage)

    val form = Utils.formHtml(pageReq, pageRoot).editsDialog(
      post, page, pageReq.sid.displayName, mayEdit = mayEdit)

    OkHtml(form)
  }


  def handleForm(pathIn: PagePath, pageRoot: PageRoot, postId: String)
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
    var actions = List[(HistoryEdit, String)]()
    for (seqNoAppOrDel <- appsAndDels) seqNoAppOrDel.split('-') match {
      case Array(seqNo, "delete", editAppId) =>
        actions ::= HistoryEdit.DeleteEditApp -> editAppId
      case Array(seqNo, "apply", editId) =>
        actions ::= HistoryEdit.ApplyEdit -> editId
      case _ =>
        throwBadReq("DwE0kr1x7476", "Bad dw-fi-appdel value: " +
           safed(seqNoAppOrDel))
    }
    actions = actions.reverse
    _applyAndUndoEdits(actions, pageReq)
    Utils.renderOrRedirect(pageReq, pageRoot)
  }


  sealed abstract class HistoryEdit
  object HistoryEdit {
    case object ApplyEdit extends HistoryEdit
    case object DeleteEditApp extends HistoryEdit
  }


  private def _applyAndUndoEdits(changes: List[(HistoryEdit, String)],
        pageReq: PageRequest[_]) {

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
            throwForbidden("DwE017v34", "EditApp not found: "+ safed(actionId))
          editApp.editId
      }

      val editAffected = page.editsById.get(editId) getOrElse
        throwForbidden("DwE03k23", "Edit not found: "+ safed(editId))

      val postAffected = page.vipo(editAffected.postId) getOrElse
        throwForbidden("DwE82U13k7", "Post not found: "+
           safed(editAffected.postId))

      val (mayEdit, mayEditReason) =
        AppEdit.mayEdit(pageReq.user, postAffected, pageReq.permsOnPage)
      if (!mayEdit)
        throwForbidden("DwE09253kr1", "Insufficient permissions")

      // ----- Yield list of changes to save

      histEdit match {
        case HistoryEdit.ApplyEdit =>
          EditApp(  // COULD rename to Appl
            id = "?"+ sno, editId = actionId,
            loginId = pageReq.loginId_!, newIp = pageReq.newIp,
            ctime = pageReq.ctime, result = "(TODO apply diff)")
        case HistoryEdit.DeleteEditApp =>
          Delete(
            id = "?"+ sno, postId = actionId,
            loginId = pageReq.loginId_!, newIp = pageReq.newIp,
            ctime = pageReq.ctime, wholeTree = false, reason = "")
      }
    }

    // ----- Save all changes

    Debiki.savePageActions(pageReq, actions)
  }

}
