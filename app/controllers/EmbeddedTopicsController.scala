/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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
import actions.PageActions.PageGetRequest
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import requests.PageRequest


/** Resets the password of a PasswordIdentity, in case the user forgot it.
  */
object EmbeddedTopicsController extends mvc.Controller {


  def showTopic(forumId: PageId, topicId: PageId) = GetAction { request =>
    /*
    val forumPathAndMeta: PagePathAndMeta = request.dao.loadEmbeddedForumMeta(forumId)
    val topicMeta: PageMeta = request.dao.loadEmbeddedTopicMeta(topicId)

    if (topicMeta.parentForumId != forumMeta.pageId)
      throwForbidden("DwE7GEf0", s"Topic `$topicId' is not part of forum `$forumId'")
    */

    val topicPagePath = PagePath(
      tenantId = request.siteId,
      folder = "/embedded-forum-test/", // forumPathAndMeta.folder,
      pageId = Some(topicId),
      showId = true,
      pageSlug = "")

    val pageReq = PageRequest.forPageThatMightExist(
      request, pagePathStr = topicPagePath.path, pageId = topicId)

    if (pageReq.pageExists) {
      PageViewer.viewPostImpl(pageReq)
    }
    else {
      showNonExistingPage(pageReq, forumId, topicPagePath)
    }
  }


  def showNonExistingPage(pageReq: PageGetRequest, forumId: PageId, topicPagePath: PagePath) = {
    val author = SystemUser.User
    val topicId = topicPagePath.pageId.get

    val newTopicMeta = PageMeta.forNewPage(
      PageRole.EmbeddedTopic,
      author = author,
      parts = PageParts(topicId),
      creationDati = new ju.Date,
      parentPageId = Some(forumId),
      publishDirectly = true)

    val ancestorIds = List(forumId)

    val pageReqNewPageBadRoot = pageReq.copyWithPreloadedPage(
      Page(newTopicMeta, topicPagePath, ancestorIds, PageParts(topicId)),
      pageExists = false)

    // Include all top level comments, by specifying no particular root comment.
    val pageReqNewPage = pageReqNewPageBadRoot.copyWithNewPageRoot(None)

    PageViewer.viewPostImpl(pageReqNewPage)
  }

}
