/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package controllers

import com.debiki.v0._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.libs.json._
import ApiActions._
import Prelude._
import Utils.OkSafeJson
import Utils.ValidationImplicits._


/**
 * Approves and rejects comments and edits of comments, and new pages,
 * etcetera.
 */
object AppReview extends mvc.Controller {


  def approve = PostJsonAction(maxLength = 5000) { apiReq =>
    _review(apiReq, shallApprove = true)
  }


  def reject = PostJsonAction(maxLength = 5000) { apiReq =>
    _review(apiReq, shallApprove = false)
  }


  private def _review(apiReq: JsonPostRequest, shallApprove: Boolean)
        : mvc.PlainResult = {

    if (!apiReq.user_!.isAdmin)
      throwForbidden("DwE4LU90", "Insufficient permissions to review posts")

    // *WARNING* duplicated code, see AppSimple. Resolve like so: Rewrite
    // ReviewPostAction to a PostActionPayload and add approvePost/rejectPost
    // functions to AppSimple.

    // Play throws java.util.NoSuchElementException: key not found: pageId
    // and e.g. new RuntimeException("String expected")
    // on invalid JSON structure. COULD in some way convert to 400 Bad Request
    // instead of failing with 500 Internal Server Error in Prod mode.
    val reviewsByPageId: Map[String, List[ReviewPostAction]] =
      Utils.parsePageActionIds(apiReq.body.as[List[Map[String, String]]]) { actionId =>
        ReviewPostAction(
          id = "?", targetId = actionId, loginId = apiReq.loginId_!,
          newIp = None, ctime = apiReq.ctime,
          approval = (if (shallApprove) Some(Approval.Manual) else None))
      }

    reviewsByPageId foreach { case (pageId, reviews) =>
      val pageWithoutMe = apiReq.dao.loadPage(pageId) getOrElse throwBadReq(
        "DwE93JQ3", "Page not found: "+ pageId +", only some reviews saved")
      val page = pageWithoutMe ++ apiReq.meAsPeople_!

      apiReq.dao.savePageActionsGenNotfs(page, reviews)
    }

    Ok
  }


  /*
  /**
   * Intended  for developing and debugging.
   */
  def showForm(pathIn: PagePath, actionIdsStr: String)
        = PageGetAction(pathIn) { pageReq: PageGetRequest =>
    val isApproval = checkIfIsApproval(pageReq)
    val question = isApproval ? "Approve these posts" | "Reject these posts"
    Utils.OkHtml(
      <p>{question}?</p>
      <p>{actionIdsStr}</p>
      <form>
        <input type="hidden" name="dw-fi-xsrf"
               value={pageReq.xsrfToken.value}></input>
        <input type="hidden" name="action-ids" value={actionIdsStr}></input>
        <input type="submit" value="Yes"></input>
      </form>)
  }


  def handleForm(pathIn: PagePath)
        = PagePostAction(4000)(pathIn) { pageReq: PagePostRequest =>

    val isApproval = checkIfIsApproval(pageReq)
    val actionIdsStr = pageReq.body.getOrThrowBadReq("action-ids")
    val actionIds = actionIdsStr.split(",").toList
    val reviews = actionIds map { actionId =>
      ReviewPostAction(id = "?", targetId = actionId, loginId = pageReq.loginId_!,
        newIp = pageReq.newIp, ctime = pageReq.ctime,
        isApproved = isApproval)
    }

    pageReq.dao.savePageActions(pageReq, reviews)
    Ok("Done.")
  }


  def checkIfIsApproval(pageReq: PageRequest[_]): Boolean = {
    val isApproval = pageReq.queryString.getFirst("approve").isDefined
    val isRejection = pageReq.queryString.getFirst("reject").isDefined

    if (isApproval && isRejection)
      throwBadReq("DwE903IK31", "Cannot approve and reject at the same time")

    if (!isApproval && !isRejection)
      throwBadReq("DwE93KW39", "Please specify &approve or &reject")

    isApproval
  }
  */

}

