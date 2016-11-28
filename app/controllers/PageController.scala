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

import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.Utils._
import debiki._
import debiki.DebikiHttp._
import debiki.ReactJson.JsLongOrNull
import io.efdi.server.http._
import java.{util => ju}
import play.api._
import play.api.libs.json.Json
import scala.concurrent.ExecutionContext.Implicits.global


/** Creates pages, toggles is-done, deletes them.
  */
object PageController extends mvc.Controller {


  def createPage = PostJsonAction(RateLimits.CreateTopic, maxLength = 20 * 1000) { request =>
    import request.body

    val anyCategoryId = (body \ "categoryId").asOpt[CategoryId]
    val pageRoleInt = (body \ "pageRole").as[Int]
    val pageRole = PageRole.fromInt(pageRoleInt) getOrElse throwBadArgument("DwE3KE04", "pageRole")
    val pageStatusStr = (body \ "pageStatus").as[String]
    val pageStatus = PageStatus.parse(pageStatusStr)
    val anyFolder = (body \ "folder").asOpt[String]
    val anySlug = (body \ "pageSlug").asOpt[String]
    val titleText = (body \ "pageTitle").as[String]
    val bodyText = (body \ "pageBody").as[String]
    val showId = (body \ "showId").asOpt[Boolean].getOrElse(true)

    val bodyTextAndHtml = TextAndHtml(bodyText, isTitle = false,
      allowClassIdDataAttrs = true, followLinks = !pageRole.isWidelyEditable)

    val titleTextAndHtml = TextAndHtml(titleText, isTitle = true)

    // COULD make the Dao transaction like, and run this inside the transaction. [transaction]
    // Non-staff users shouldn't be able to create anything outside the forum section(s)
    // — except for private messages.
    if (!request.theUser.isStaff && anyCategoryId.isEmpty && pageRole != PageRole.FormalMessage) {
      throwForbidden("DwE8GKE4", "No category specified")
    }

    val pagePath = request.dao.createPage(pageRole, pageStatus, anyCategoryId, anyFolder,
      anySlug, titleTextAndHtml, bodyTextAndHtml, showId, request.who, request.spamRelatedStuff)

    OkSafeJson(Json.obj("newPageId" -> pagePath.pageId.getOrDie("DwE8GIK9")))
  }


  def acceptAnswer = PostJsonAction(RateLimits.TogglePage, maxLength = 100) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val postUniqueId = (request.body \ "postId").as[UniquePostId]
    val acceptedAt: Option[ju.Date] = request.dao.ifAuthAcceptAnswer(
      pageId, postUniqueId, userId = request.theUserId, request.theBrowserIdData)
    OkSafeJson(JsLongOrNull(acceptedAt.map(_.getTime)))
  }


  def unacceptAnswer = PostJsonAction(RateLimits.TogglePage, maxLength = 100) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    request.dao.ifAuthUnacceptAnswer(pageId, userId = request.theUserId, request.theBrowserIdData)
    Ok
  }


  def cyclePageDone = PostJsonAction(RateLimits.TogglePage, maxLength = 100) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val newMeta = request.dao.cyclePageDoneIfAuth(pageId, userId = request.theUserId,
      request.theBrowserIdData)
    OkSafeJson(Json.obj(
      "plannedAtMs" -> JsLongOrNull(newMeta.plannedAt.map(_.getTime)),
      "doneAtMs" -> JsLongOrNull(newMeta.doneAt.map(_.getTime)),
      "closedAtMs" -> JsLongOrNull(newMeta.closedAt.map(_.getTime))))
  }


  def togglePageClosed = PostJsonAction(RateLimits.TogglePage, maxLength = 100) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val closedAt: Option[ju.Date] = request.dao.ifAuthTogglePageClosed(
      pageId, userId = request.theUserId, request.theBrowserIdData)
    OkSafeJson(JsLongOrNull(closedAt.map(_.getTime)))
  }

  def deletePages = StaffPostJsonAction(maxLength = 1000) { request =>
    val pageIds = (request.body \ "pageIds").as[Seq[PageId]]
    request.dao.deletePagesIfAuth(pageIds, deleterId = request.theUserId, request.theBrowserIdData,
      undelete = false)
    Ok
  }

  def undeletePages = StaffPostJsonAction(maxLength = 1000) { request =>
    val pageIds = (request.body \ "pageIds").as[Seq[PageId]]
    request.dao.deletePagesIfAuth(pageIds, deleterId = request.theUserId, request.theBrowserIdData,
      undelete = true)
    Ok
  }


  def addUsersToPage = PostJsonAction(RateLimits.JoinSomething, maxLength = 100) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val userIds = (request.body \ "userIds").as[Set[UserId]]
    request.dao.addUsersToPage(userIds, pageId, request.who)
    Ok
  }


  def removeUsersFromPage = PostJsonAction(RateLimits.JoinSomething, maxLength = 100) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val userIds = (request.body \ "userIds").as[Set[UserId]]
    request.dao.removeUsersFromPage(userIds, pageId, request.who)
    Ok
  }


  def joinPage = PostJsonAction(RateLimits.JoinSomething, maxLength = 100) { request =>
    joinOrLeavePage(join = true, request)
  }


  def leavePage = PostJsonAction(RateLimits.JoinSomething, maxLength = 100) { request =>
    joinOrLeavePage(join = false, request)
  }


  private def joinOrLeavePage(join: Boolean, request: JsonPostRequest) = {
    val pageId = (request.body \ "pageId").as[PageId]
    request.dao.joinOrLeavePageIfAuth(pageId, join = join, who = request.who) match {
      case Some(newWatchbar) =>
        val watchbarWithTitles = request.dao.fillInWatchbarTitlesEtc(newWatchbar)
        Ok(watchbarWithTitles.toJsonWithTitles)
      case None => Ok
    }
  }

}
