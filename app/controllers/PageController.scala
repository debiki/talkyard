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
import debiki._
import debiki.EdHttp._
import debiki.JsX.JsLongOrNull
import ed.server.{EdContext, EdController}
import ed.server.auth.Authz
import ed.server.http._
import java.{util => ju}
import javax.inject.Inject
import play.api.libs.json.{JsValue, Json}
import play.api.mvc.{Action, ControllerComponents}


/** Creates pages, toggles is-done, deletes them.
  */
class PageController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.security.throwNoUnless

  def createPage: Action[JsValue] = PostJsonAction(RateLimits.CreateTopic, maxBytes = 20 * 1000) {
        request =>
    import request.{body, dao, theRequester => requester}

    throwForbiddenIf(requester.isGroup, "EdE3FDK7M6", "Groups may not create pages")

    val anyCategoryId = (body \ "categoryId").asOpt[CategoryId]
    val pageRoleInt = (body \ "pageRole").as[Int]
    val pageRole = PageRole.fromInt(pageRoleInt) getOrElse throwBadArgument("DwE3KE04", "pageRole")
    val pageStatusStr = (body \ "pageStatus").as[String]
    val pageStatus = PageStatus.parse(pageStatusStr)
    val anyFolder = (body \ "folder").asOptStringNoneIfBlank
    val anySlug = (body \ "pageSlug").asOptStringNoneIfBlank
    val titleText = (body \ "pageTitle").as[String]
    val bodyText = (body \ "pageBody").as[String]
    val showId = (body \ "showId").asOpt[Boolean].getOrElse(true)

    val bodyTextAndHtml = dao.textAndHtmlMaker.forBodyOrComment(bodyText,
      allowClassIdDataAttrs = true, followLinks = pageRole.shallFollowLinks)

    val titleTextAndHtml = dao.textAndHtmlMaker.forTitle(titleText)

    if (!requester.isStaff) {
      // Showing id —> page slug cannot be mistaken for forum sort order [5AQXJ2].
      throwForbiddenIf(!showId, "TyE2PKDQC", "Only staff may hide page id")
      throwForbiddenIf(anyFolder.isDefined, "TyE4GHW2", "Only staff may specify folder")
      throwForbiddenIf(pageRole.isSection, "TyE6LUMR2", "Only staff may create new site sections")
    }

    // COULD make the Dao transaction like, and run this inside the transaction. [transaction]
    // Non-staff users shouldn't be able to create anything outside the forum section(s)
    // — except for private messages.
    if (!request.theUser.isStaff && anyCategoryId.isEmpty && pageRole != PageRole.FormalMessage) {
      throwForbidden("DwE8GKE4", "No category specified")
    }

    val categoriesRootLast = dao.loadAncestorCategoriesRootLast(anyCategoryId)

    throwNoUnless(Authz.mayCreatePage(
      request.theUserAndLevels, dao.getGroupIds(request.theUser),
      pageRole, PostType.Normal, pinWhere = None, anySlug = anySlug, anyFolder = anyFolder,
      inCategoriesRootLast = categoriesRootLast,
      permissions = dao.getPermsOnPages(categories = categoriesRootLast)),
      "EdE5KW20A")

    val pagePath = dao.createPage(pageRole, pageStatus, anyCategoryId, anyFolder,
      anySlug, titleTextAndHtml, bodyTextAndHtml, showId, request.who, request.spamRelatedStuff)

    OkSafeJson(Json.obj("newPageId" -> pagePath.pageId.getOrDie("DwE8GIK9")))
  }


  def pinPage: Action[JsValue] = StaffPostJsonAction(maxBytes = 1000) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val pinWhereInt = (request.body \ "pinWhere").as[Int]
    val pinOrder = (request.body \ "pinOrder").as[Int]

    if (!PageMeta.isOkPinOrder(pinOrder))
      throwBadReq("DwE4KEF82", o"""Bad pin order. Please enter a number
           between ${PageMeta.MinPinOrder} and ${PageMeta.MaxPinOrder}""")

    val pinWhere = PinPageWhere.fromInt(pinWhereInt) getOrElse throwBadArgument(
      "DwE4KE28", "pinWhere")

    request.dao.pinPage(pageId, pinWhere, pinOrder, request.theRequester)
    Ok
  }


  def unpinPage: Action[JsValue] = StaffPostJsonAction(maxBytes = 1000) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    request.dao.unpinPage(pageId, request.theRequester)
    Ok
  }


  def acceptAnswer: Action[JsValue] = PostJsonAction(RateLimits.TogglePage, maxBytes = 100) {
        request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val postUniqueId = (request.body \ "postId").as[PostId]   // id not nr
    val acceptedAt: Option[ju.Date] = request.dao.ifAuthAcceptAnswer(
      pageId, postUniqueId, userId = request.theUserId, request.theBrowserIdData)
    OkSafeJson(JsLongOrNull(acceptedAt.map(_.getTime)))
  }


  def unacceptAnswer: Action[JsValue] = PostJsonAction(RateLimits.TogglePage, maxBytes = 100) {
        request =>
    val pageId = (request.body \ "pageId").as[PageId]
    request.dao.ifAuthUnacceptAnswer(pageId, userId = request.theUserId, request.theBrowserIdData)
    Ok
  }


  def cyclePageDone: Action[JsValue] = PostJsonAction(RateLimits.TogglePage, maxBytes = 100) {
        request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val newMeta = request.dao.cyclePageDoneIfAuth(pageId, userId = request.theUserId,
      request.theBrowserIdData)
    OkSafeJson(Json.obj(
      "plannedAtMs" -> JsLongOrNull(newMeta.plannedAt.map(_.getTime)),
      "startedAtMs" -> JsLongOrNull(newMeta.startedAt.map(_.getTime)),
      "doneAtMs" -> JsLongOrNull(newMeta.doneAt.map(_.getTime)),
      "closedAtMs" -> JsLongOrNull(newMeta.closedAt.map(_.getTime))))
  }


  def togglePageClosed: Action[JsValue] = PostJsonAction(RateLimits.TogglePage, maxBytes = 100) {
        request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val closedAt: Option[ju.Date] = request.dao.ifAuthTogglePageClosed(
      pageId, userId = request.theUserId, request.theBrowserIdData)
    OkSafeJson(JsLongOrNull(closedAt.map(_.getTime)))
  }

  def deletePages: Action[JsValue] = StaffPostJsonAction(maxBytes = 1000) { request =>
    val pageIds = (request.body \ "pageIds").as[Seq[PageId]]
    request.dao.deletePagesIfAuth(pageIds, deleterId = request.theUserId, request.theBrowserIdData,
      undelete = false)
    Ok
  }

  def undeletePages: Action[JsValue] = StaffPostJsonAction(maxBytes = 1000) { request =>
    val pageIds = (request.body \ "pageIds").as[Seq[PageId]]
    request.dao.deletePagesIfAuth(pageIds, deleterId = request.theUserId, request.theBrowserIdData,
      undelete = true)
    Ok
  }


  def addUsersToPage: Action[JsValue] = PostJsonAction(RateLimits.JoinSomething, maxBytes = 100) {
        request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val userIds = (request.body \ "userIds").as[Set[UserId]]
    request.dao.addUsersToPage(userIds, pageId, request.who)
    Ok
  }


  def removeUsersFromPage: Action[JsValue] = PostJsonAction(RateLimits.JoinSomething,
        maxBytes = 100) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val userIds = (request.body \ "userIds").as[Set[UserId]]
    request.dao.removeUsersFromPage(userIds, pageId, request.who)
    Ok
  }


  def joinPage: Action[JsValue] = PostJsonAction(RateLimits.JoinSomething, maxBytes = 100) {
        request =>
    joinOrLeavePage(join = true, request)
  }


  def leavePage: Action[JsValue] = PostJsonAction(RateLimits.JoinSomething, maxBytes = 100) {
        request =>
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
