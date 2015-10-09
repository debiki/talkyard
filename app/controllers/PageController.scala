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

import actions.ApiActions._
import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.Utils._
import debiki._
import debiki.DebikiHttp._
import debiki.ReactJson.JsLongOrNull
import debiki.antispam.AntiSpam.throwForbiddenIfSpam
import java.{util => ju}
import play.api._
import play.api.libs.json.Json
import scala.concurrent.ExecutionContext.Implicits.global


/** Creates pages, toggles is-done, deletes them.
  */
object PageController extends mvc.Controller {


  def createPage = AsyncPostJsonAction(RateLimits.CreateTopic, maxLength = 20 * 1000) { request =>
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

    Globals.antiSpam.detectNewPageSpam(request, titleTextAndHtml, bodyTextAndHtml) map {
        isSpamReason =>
      throwForbiddenIfSpam(isSpamReason, "DwE4CKB9")

      val pagePath = request.dao.createPage(pageRole, pageStatus, anyCategoryId, anyFolder,
        anySlug, titleTextAndHtml, bodyTextAndHtml, showId, authorId = request.theUserId,
        request.theBrowserIdData)

      OkSafeJson(Json.obj("newPageId" -> pagePath.pageId.getOrDie("DwE8GIK9")))
    }
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


  def cyclePageDone = StaffPostJsonAction(maxLength = 100) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val newMeta = request.dao.cyclePageDone(pageId, userId = request.theUserId,
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

}
