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
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.mvc.{Action => _, _}
import requests.{PageGetRequest, PageRequest}


/** Resets the password of a PasswordIdentity, in case the user forgot it.
  */
object EmbeddedTopicsController extends mvc.Controller {


  def isUrlFromEmbeddingUrl(anyPageUrl: String, embeddingUrl: Option[String]): Boolean =
    embeddingUrl.nonEmpty // for now. COULD implement if people post comments to the wrong site


  /** Derives the discussion id based on the url of the embedding site.
    * This is done by taking the 16 first characters of a base 64 encoded SHA1 sum,
    * but with - and _ removed.
    *
    * How these ids are derived must never be changed, because then all old ids
    * will become invalid. There's a test case for this function in
    * test/controllers/EmbeddedTopicsControllerSpec.scala.
    *
    * Why the first 16? (1 - (10^10/(36^16))) ^ (10^10) = 0.9999878, see http://web2.0calc.com/,
    * that is, if a website with 1 page per human (10e9 humans) adds Debiki's
    * comment system, the probability of an id clash is roughly 1 / 100 000.
    * ((Also, 16 is a good size, from an in-memory point of view? The underlying
    * char array is padded to a multiple of 16 anyway, and (16*2 + 38) = 70,
    * round up to 8 boundary -> 72, see:
    *   http://www.javamex.com/tutorials/memory/string_memory_usage.shtml  ))
    * **Edit** Now I use 62 digits (= 64 - 2 chars) instead of 36 so the probability of an id
    * collision is even lower.
    */
  def deriveTopicIdFromUrl(url: String): String = {

    val urlNoScheme =
      if (url startsWith "http://") url drop "http://".length
      else if (url startsWith "https://") url drop "https://".length
      else if (url startsWith "//") url drop 2
      else url

    // On my computer:
    // SHA1 + Base 64 encoding takes 4 microseconds.
    // SHA1 + Base 62 encoding takes 3 times longer than SHA1 + Base64 (i.e 12 us).
    // SHA1 + Base 64 + remove - and _ takes 1.5 times longer than SHA1 + Base64, but
    // can be optimized to be as fast.
    // So lets use SHA1 + Base 64 but remove - and _, because _ looks ugly and - is a
    // magic character in Debiki's URLs (it terminates any id part of the url).
    // Using mixed case should be fine (i.e. not base 36) because people cannot remember
    // 16 chars anyway so they need to copy paste anyway.
    val base64 = hashSha1Base64UrlSafe(urlNoScheme)
    val withoutDashAndUnderscore =
      if (base64.exists(ch => ch == '-' || ch == '_'))
        base64.filterNot(ch => ch == '-' || ch == '_' || ch == '=')
      else
        base64
    val id = withoutDashAndUnderscore take 16
    id
  }


  def showTopic = GetAction { request =>
    import controllers.Utils.ValidationImplicits._
    val topicId = request.queryString.getNoneAsEmpty("topicId")
    val topicUrl = request.queryString.getNoneAsEmpty("topicUrl")

    val theId =
      if (topicId.length > 16) {
        // Why would anyone manually specify such a long id? The id is a primary
        // key and I don't want to waste too much storage space storing ids.
        throwBadReq("DwE9053fHE3", s"Too long topic id: `$topicId'")
      }
      else if (topicId.nonEmpty) {
        topicId
      }
      else if (topicUrl.nonEmpty) {
        deriveTopicIdFromUrl(topicUrl)
      }
      else {
        throwBadReq("DwE2594Fk9", "Neither topic id nor url specified")
      }

    if (!Page.isOkayId(theId))
      throwBadReq("DwE77GJ12", s"Bad topic id: `$theId'")

    val topicPagePath = PagePath(
      tenantId = request.siteId,
      folder = "/",
      pageId = Some(theId),
      showId = true,
      pageSlug = "")

    val pageReqDefaultRoot: PageGetRequest = PageRequest.forPageThatMightExist(
      request, pagePathStr = topicPagePath.value, pageId = theId)

    // Include all top level comments, by specifying no particular root comment.
    val pageReqNoRoot = pageReqDefaultRoot.copyWithNewPageRoot(None)

    if (pageReqNoRoot.pageExists) {
      ViewPageController.viewPostImpl(pageReqNoRoot)
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

    ViewPageController.viewPostImpl(pageReq)
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
