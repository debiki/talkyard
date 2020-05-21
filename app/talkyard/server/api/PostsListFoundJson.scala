/**
 * Copyright (c) 2020 Kaj Magnus Lindberg
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

package talkyard.server.api

import com.debiki.core._
import controllers.OkApiJson
import Prelude._
import debiki.dao.{LoadPostsResult, PageStuff, SiteDao}
import play.api.libs.json._
import play.api.mvc.Result
import talkyard.server.JsX._



object PostsListFoundJson {


  def makePostsListFoundResponse(postsFound: LoadPostsResult, dao: SiteDao,
          pretty: Boolean): Result = {
    makePostsFoundResponseImpl(
          Some(postsFound), anySearchResults = None, dao, pretty = pretty)
  }


  type PostsSearchResult = AnyRef // ??

  /*
  def makePagesFoundSearchResponse(searchResults: Seq[PostsSearchResult], dao: SiteDao,
          pretty: Boolean): Result = {
    makePostsFoundResponseImpl(
          anyPagePathsMetas = Nil, searchResults, dao, pretty = pretty)
  } */


  private def makePostsFoundResponseImpl(
      anyPostsFound: Option[LoadPostsResult], anySearchResults: Option[_],
      dao: SiteDao, pretty: Boolean): Result = {

    dieIf(anyPostsFound.nonEmpty && anySearchResults.nonEmpty, "TyE60WKTH5")

    val LoadPostsResult(postsFound: Seq[Post], pageStuffById: Map[PageId, PageStuff]) =
          anyPostsFound getOrDie "TyE405RKDD"

    // --- Load authors

    val authorIds = postsFound.map(_.createdById).toSet
    val authorsById: Map[UserId, Participant] = dao.getParticipantsAsMap(authorIds)

    // --- Site origin   dupl code [603RKDJL5]

    val siteIdsOrigins = dao.theSiteIdsOrigins()
    val avatarUrlPrefix =
          siteIdsOrigins.uploadsOrigin +
          ed.server.UploadsUrlBasePath + siteIdsOrigins.pubId + '/'

    // --- The result

    val jsPostsFound: Seq[JsObject] = for {
      post <- postsFound
      pageStuff <- pageStuffById.get(post.pageId)
    }
    yield {
      JsPostListFound(post, pageStuff, authorsById, avatarUrlPrefix = avatarUrlPrefix)
    }

    // Typescript: SearchQueryResults, and ListQueryResults
    OkApiJson(Json.obj(
      "origin" -> siteIdsOrigins.siteOrigin,
      "thingsFound" -> jsPostsFound), pretty)
  }


  def JsPostListFound(post: Post, pageStuff: PageStuff, ppsById: Map[UserId, Participant],
          avatarUrlPrefix: String): JsObject = {

    val anyAuthor = ppsById.get(post.createdById)

    // Currently always approved. [4946RKTT2]
    val approvedHtmlSanitized = post.approvedHtmlSanitized.getOrDie(
          "TyE603RKDL4", s"Post not approved: ${post.id}")

    Json.obj(  // Typescript: PostListed
      "id" -> JsNumber(post.id),
      "nr" -> JsNumber(post.nr),
      "parentNr" -> JsNumberOrNull(post.parentNr),
      "pageId" -> JsString(post.pageId),
      "pageTitle" -> pageStuff.title,
      "isPageTitle" -> JsBoolean(post.nr == PageParts.TitleNr),
      "isPageBody" -> JsBoolean(post.nr == PageParts.BodyNr),
      // COULD use the page's actual path (folder + slug).
      "urlPath" -> JsString(s"/-${post.pageId}#post-${post.nr}"),
      "author" -> ThingsFoundJson.JsParticipantFoundOrNull(anyAuthor, avatarUrlPrefix),
      "approvedHtmlSanitized" -> JsString(approvedHtmlSanitized))
  }

}


