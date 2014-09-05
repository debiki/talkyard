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

import actions.ApiActions.PostJsonAction
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import play.api._
import play.api.libs.json.Json
import Utils._


/** Creates pages.
  */
object CreatePageController extends mvc.Controller {


  def createPage = PostJsonAction(maxLength = 20 * 1000) { request =>
    import request.{dao, body}

    val anyParentPageId = (body \ "parentPageId").asOpt[PageId]
    val pageRoleStr = (body \ "pageRole").as[String]
    val pageRole = PageRole.parse(pageRoleStr)
    val pageStatusStr = (body \ "pageStatus").as[String]
    val pageStatus = PageStatus.parse(pageStatusStr)
    val anyFolder = (body \ "folder").asOpt[String]
    val titleText = (body \ "pageTitle").as[String]
    val bodyText = (body \ "pageBody").as[String]

    val approval: Approval = AutoApprover.perhapsApproveNewPage(
      request, pageRole, anyParentPageId) getOrElse
        throwForbidden("DwE53KVE0", "Page creation request rejected")

    val pageId = request.dao.nextPageId()

    val folder = anyFolder getOrElse {
      val anyParentPath = anyParentPageId flatMap { id =>
        request.dao.lookupPagePath(id)
      }
      anyParentPath.map(_.folder) getOrElse "/"
    }

    val showId = true // for now. Should depend on page role: hide for forums, show for topics?
    val pageSlug = "new-forum-topic" // for now. Ought to slugify the title.

    val newPath = PagePath(dao.siteId, folder = folder, pageId = Some(pageId),
      showId = showId, pageSlug = pageSlug)

    val ancestorIdsParentFirst: List[PageId] =
      anyParentPageId map { parentId =>
        val parentsAncestorIds = dao.loadAncestorIdsParentFirst(parentId)
        parentId :: parentsAncestorIds
      } getOrElse Nil

    val pageMeta = PageMeta.forNewPage(
      pageRole, request.user_!, PageParts(pageId), request.ctime,
      parentPageId = ancestorIdsParentFirst.headOption,
      publishDirectly = pageStatus == PageStatus.Published)

    val titlePost = RawPostAction.forNewTitle(
      titleText, request.ctime, request.userIdData, Some(approval))
    val bodyPost = RawPostAction.forNewPageBody(
      bodyText, request.ctime, pageRole, request.userIdData, Some(approval))
    val pageParts = PageParts(pageMeta.pageId, rawActions = titlePost::bodyPost::Nil)

    val newPage = dao.createPage(Page(pageMeta, newPath, ancestorIdsParentFirst, pageParts))

    OkSafeJson(Json.obj("newPageId" -> newPage.id))
  }

}
