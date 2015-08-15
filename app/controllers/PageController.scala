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

import actions.ApiActions.{PostJsonAction, StaffPostJsonAction}
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import debiki.ReactJson.JsLongOrNull
import java.{util => ju}
import play.api._
import play.api.libs.json.Json
import Utils._


/** Creates pages, toggles is-done, deletes them.
  */
object PageController extends mvc.Controller {


  def createPage = PostJsonAction(RateLimits.CreateTopic, maxLength = 20 * 1000) { request =>
    import request.body

    val anyParentPageId = (body \ "parentPageId").asOpt[PageId]
    val pageRoleInt = (body \ "pageRole").as[Int]
    val pageRole = PageRole.fromInt(pageRoleInt) getOrElse throwBadArgument("DwE3KE04", "pageRole")
    val pageStatusStr = (body \ "pageStatus").as[String]
    val pageStatus = PageStatus.parse(pageStatusStr)
    val anyFolder = (body \ "folder").asOpt[String]
    val anySlug = (body \ "pageSlug").asOpt[String]
    val titleText = (body \ "pageTitle").as[String]
    val bodyText = (body \ "pageBody").as[String]
    val showId = (body \ "showId").asOpt[Boolean].getOrElse(true)

    val pagePath = request.dao.createPage(pageRole, pageStatus, anyParentPageId, anyFolder,
      anySlug, titleText, bodyText, showId, authorId = request.theUserId,
      request.theBrowserIdData)

    OkSafeJson(Json.obj("newPageId" -> pagePath.pageId.getOrDie("DwE8GIK9")))
  }


  def togglePageDone = StaffPostJsonAction(maxLength = 100) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val doneAt: Option[ju.Date] = request.dao.togglePageDone(pageId, userId = request.theUserId,
      request.theBrowserIdData)
    OkSafeJson(JsLongOrNull(doneAt.map(_.getTime)))
  }


  def togglePageClosed = PostJsonAction(RateLimits.TogglePage, maxLength = 100) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val closedAt: Option[ju.Date] = request.dao.ifAuthTogglePageClosed(
      pageId, userId = request.theUserId, request.theBrowserIdData)
    OkSafeJson(JsLongOrNull(closedAt.map(_.getTime)))
  }

}
