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
import controllers.Utils._
import debiki.DebikiHttp._
import debiki.{ReactJson, ThingsToReview}
import io.efdi.server.http._
import java.{util => ju}
import play.api._
import play.api.libs.json._
import play.api.libs.json.Json.toJson
import play.api.mvc.{Action => _, _}
import scala.collection.{mutable, immutable}


/** Lists posts for the moderation page, and approves/rejects/deletes posts
  * that are new or have been flagged.
  *
  * BUG race condition, the lost update bug: The admin might e.g. clear flags s/he hasn't seen,
  * namely flags created after s/he loaded the admin page. Fix things like this by sending
  * a post version number to the server and most-recent-seen-flag date?
  */
object ModerationController extends mvc.Controller {


  val ActionCountLimit = 100
  val PostTextLengthLimit = 500


  def loadReviewTasks = StaffGetAction { request =>
    val (reviewStuff, usersById) = request.dao.loadReviewStuff(olderOrEqualTo = new ju.Date,
      limit = 100)
    OkSafeJson(JsArray(reviewStuff.map(ReactJson.reviewStufToJson(_, usersById))))
  }


  def completeReviewTask = StaffPostJsonAction(maxBytes = 100) { request =>
    val taskId = (request.body \ "taskId").as[ReviewTaskId]
    val anyRevNr = (request.body \ "revisionNr").asOpt[Int]
    val actionInt = (request.body \ "action").as[Int]
    val action = ReviewAction.fromInt(actionInt) getOrElse throwBadArgument("EsE5GYK2", "action")
    request.dao.completeReviewTask(taskId, completedById = request.theUserId, anyRevNr = anyRevNr,
      action, request.theBrowserIdData)
    Ok
  }


  /*
  def approve = StaffPostJsonAction(maxBytes = 5000) { request =>
    SECURITY ; COULD // restrict approval of edits of any homepage or about page to admins only.
    val PagePostNr(pageId, postNr) = parseBody(request)
    request.dao.approvePost(pageId, postNr = postNr, approverId = request.theUserId)
    Ok
  }


  def hideNewPostSendPm = StaffPostJsonAction(maxBytes = 5000) { apiReq =>
    ???
  }


  def hideFlaggedPostSendPm = StaffPostJsonAction(maxBytes = 5000) { request =>
    val PagePostNr(pageId, postNr) = parseBody(request)
    ??? // request.dao.hidePostClearFlag(pageId, postId = postId, hiddenById = request.theUserId)
    Ok
  }


  def deletePost = StaffPostJsonAction(maxBytes = 5000) { request =>
    val PagePostNr(pageId, postNr) = parseBody(request)
    request.dao.deletePost(pageId, postNr = postNr, deletedById = request.theUserId,
        request.theBrowserIdData)
    Ok
  }


  def deleteFlaggedPost = StaffPostJsonAction(maxBytes = 5000) { request =>
    // COULD add a specific method deleteFlaggedPost, that also ... marks the flags as accepted?
    // Like Discourse does it. For now:
    val PagePostNr(pageId, postNr) = parseBody(request)
    request.dao.deletePost(pageId, postNr = postNr, deletedById = request.theUserId,
        request.theBrowserIdData)
    Ok
  }


  def clearFlags = StaffPostJsonAction(maxBytes = 5000) { request =>
    val PagePostNr(pageId, postNr) = parseBody(request)
    request.dao.clearFlags(pageId, postNr = postNr, clearedById = request.theUserId)
    Ok
  }


  def rejectEdits = StaffPostJsonAction(maxBytes = 5000) { request =>
    val PagePostNr(pageId, postNr) = parseBody(request)
    ??? // request.dao.rejectEdits(pageId, postId = postId, rejectedById = request.theUserId)
    Ok
  }


  private def parseBody(request: JsonPostRequest): PagePostNr = {
    val pageId = (request.body \ "pageId").as[PageId]
    val postNr = (request.body \ "postNr").as[PostNr]
    PagePostNr(pageId, postNr)
  }


  private def makeJsonSinglePost(post: Post, thingsToReview: ThingsToReview): JsValue = {
    //val pageMeta = thingsToReview.thePage(post.pageId)
    val author = thingsToReview.theUser(post.createdById)
    val flags = thingsToReview.theFlagsFor(post.nr)

    val pageName = "SHOULD load page name"
    var data = immutable.HashMap[String, JsValue](
      "id" -> JsNumber(post.nr),
      "pageId" -> JsString(post.pageId),
      "pageName" -> JsString(pageName),
      "type" -> JsString("Post"),
      "userId" -> JsString(post.createdById.toString),  // User2
      "userDisplayName" -> JsString(author.displayName),
      "cdati" -> JsString(toIso8601T(post.createdAt)))

    post.approvedSource foreach { text =>
      data += "approvedText" -> JsString(text take PostTextLengthLimit)
    }
    post.unapprovedSource foreach { text =>
      data += "unapprovedText" -> JsString(text take PostTextLengthLimit)
    }

    post.deletedAt foreach { date =>
      // COULD use deletedStatus instead
      data += "postDeletedAt" -> JsString(toIso8601T(date))
    }

    post.hiddenAt foreach { date =>
      data += "postHiddenAt" -> JsString(toIso8601T(date))
    }

    val status =
      if (post.deletedStatus.isDeleted) "Deleted"
      else if (post.isHidden) "Hidden"
      // else if (post.currentVersionPrelApproved) {
      //  if (post.someVersionPermanentlyApproved) "EditsPrelApproved"  // TODO remove JS
      //  else "NewPrelApproved"
      // }
      else if (post.isCurrentVersionApproved) "Approved"
      //else if (post.currentVersionRejected) {
      //  if (post.someVersionPermanentlyApproved) "EditsRejected"   // TODO when use this?
      //  else "Rejected"
      //}
      //else if (post.someVersionPermanentlyApproved) "NewEdits"
      else "New"

    data += "status" -> JsString(status)

    if (post.numEditsToReview > 0) {
      data += "numEditsToReview" -> JsNumber(post.numEditsToReview)
    }
    if (post.numPendingEditSuggestions > 0) {
      data += "numPendingEditSuggestions" -> JsNumber(post.numPendingEditSuggestions)
    }
    if (post.numFlags > 0) {
      data += "numPendingFlags" -> JsNumber(post.numPendingFlags)
      data += "numHandledFlags" -> JsNumber(post.numHandledFlags)
    }

    if (post.numPendingFlags > 0) {
      val jsFlags = flags map { flag => // .filter(_.deletedAt.isEmpty) // TODO add deletedAt
        val flagger = thingsToReview.theUser(flag.flaggerId)
        val flaggerName = flagger.usernameOrGuestName
        Json.obj(
          "flaggerId" -> flag.flaggerId,
          "flaggerDisplayName" -> flaggerName,
          "flagType" -> flag.flagType.toString)
          // "flagReason" -> ?
      }
      data += "pendingFlags" -> JsArray(jsFlags)
    }

    toJson(data)
  }*/

}

