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
import requests.{DebikiRequest, PageRequest}


/** Resets the password of a PasswordIdentity, in case the user forgot it.
  */
object EmbeddedTopicsController extends mvc.Controller {


  private val UrlRegex = "^https?://([^#]+)".r
  private val IdRegex = "^([a-z0-9_]+)$".r

  def isUrlFromEmbeddingUrl(anyPageUrl: String, embeddingUrl: Option[String]): Boolean =
    embeddingUrl.nonEmpty // for now. COULD implement if people post comments to the wrong site


  /** Derives the discussion id based on the url of the embedding site.
    * This is done by taking the 16 first characters of a base 36 encoded SHA1 sum.
    *
    * Why the first 16? (1 - (10^10/(36^16))) ^ (10^10) = 0.9999878, see http://web2.0calc.com/,
    * that is, if a website with 1 page per human (10e9 humans) adds Debiki's
    * comment system, the probability of an id clash is roughly 1 / 100 000.
    * ((Also, 16 is a good size, from an in-memory point of view? The underlying
    * char array is padded to a multiple of 16 anyway, and (16*2 + 38) = 70,
    * round up to 8 boundary -> 72, see:
    *   http://www.javamex.com/tutorials/memory/string_memory_usage.shtml  ))
    */
  def deriveTopicIdFromAnyEmbeddingUrl(topicIdOrUrl: String): PageId = {
    topicIdOrUrl match {
      case UrlRegex(urlNoScheme) =>
        hashSha1Base36DontPad(urlNoScheme) take 16
      case IdRegex(id) =>
        id
      case _ =>
        throwBadReq("DwE55FU03", s"Bad id or url: `$topicIdOrUrl'")
    }
  }


  def showTopic(topicIdOrUrl: String) = GetAction { request =>

    val topicId = deriveTopicIdFromAnyEmbeddingUrl(topicIdOrUrl)

    val topicPagePath = PagePath(
      tenantId = request.siteId,
      folder = "/",
      pageId = Some(topicId),
      showId = true,
      pageSlug = "")

    val pageReqDefaultRoot: PageGetRequest = PageRequest.forPageThatMightExist(
      request, pagePathStr = topicPagePath.path, pageId = topicId)

    // Include all top level comments, by specifying no particular root comment.
    val pageReqNoRoot = pageReqDefaultRoot.copyWithNewPageRoot(None)

    if (pageReqNoRoot.pageExists) {
      PageViewer.viewPostImpl(pageReqNoRoot)
    }
    else {
      showNonExistingPage(pageReqNoRoot, topicPagePath)
    }
  }


  private def showNonExistingPage(pageReqNoPage: PageGetRequest, topicPagePath: PagePath) = {
    val author = SystemUser.User
    val topicId = topicPagePath.pageId.get

    val newTopicMeta = PageMeta.forNewPage(
      PageRole.EmbeddedComments,
      author = author,
      parts = PageParts(topicId),
      creationDati = new ju.Date,
      parentPageId = None,
      publishDirectly = true)

    val pageReq = pageReqNoPage.copyWithPreloadedPage(
      Page(newTopicMeta, topicPagePath, ancestorIdsParentFirst = Nil, PageParts(topicId)),
      pageExists = false)

    PageViewer.viewPostImpl(pageReq)
  }


  /*
  def showTopic(forumId: PageId, topicId: PageId) = GetAction { request =>
    val forumPathAndMeta: PagePathAndMeta = request.dao.loadEmbeddedForumMeta(forumId)
    val topicMeta: PageMeta = request.dao.loadEmbeddedTopicMeta(topicId)

    if (topicMeta.parentForumId != forumMeta.pageId)
      throwForbidden("DwE7GEf0", s"Topic `$topicId' is not part of forum `$forumId'")

    // and then:
    ???
  } */

}
