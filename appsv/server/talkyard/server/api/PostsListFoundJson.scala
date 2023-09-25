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
import talkyard.server.parser.JsonConf
import talkyard.server.authz.AuthzCtxOnPats



object PostsListFoundJson {


  def makePostsListFoundResponse(postsFound: LoadPostsResult, dao: SiteDao,
        jsonConf: JsonConf, authzCtx: AuthzCtxOnPats): Result = {
    makePostsFoundResponseImpl(
          Some(postsFound), anySearchResults = None, dao, jsonConf, authzCtx)
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
      dao: SiteDao, jsonConf: JsonConf, authzCtx: AuthzCtxOnPats): Result = {

    dieIf(anyPostsFound.nonEmpty && anySearchResults.nonEmpty, "TyE60WKTH5")

    val LoadPostsResult(postsFound: Seq[Post], pageStuffById: Map[PageId, PageStuff]) =
          anyPostsFound getOrDie "TyE405RKDD"

    // --- Load authors

    // Later also load assignees, not just authors?  [incl_assignees]
    // For that, use  addVisiblePatIdsTo().  Should that be a param?
    val authorIds = postsFound.map(_.createdById).toSet
    val authorsById: Map[UserId, Participant] = dao.getParticipantsAsMap(authorIds)

    // --- Site origin   dupl code [603RKDJL5]

    val siteIdsOrigins = dao.theSiteIdsOrigins()
    val avatarUrlPrefix =
          siteIdsOrigins.uploadsOrigin +
           talkyard.server.UploadsUrlBasePath + siteIdsOrigins.pubId + '/'

    // --- The result

    val jsPostsFound: Seq[JsObject] = for {
      post <- postsFound
      pageStuff <- pageStuffById.get(post.pageId)
    }
    yield {
      JsPostListFound(post, pageStuff, authorsById, avatarUrlPrefix = avatarUrlPrefix,
            jsonConf, authzCtx)
    }

    // Typescript: SearchQueryResults, and ListQueryResults
    OkApiJson(Json.obj(
      "origin" -> siteIdsOrigins.siteOrigin,
      "thingsFound" -> jsPostsFound), jsonConf.pretty)
  }


  def JsPostListFound(post: Post, pageStuff: PageStuff, ppsById: Map[UserId, Participant],
          avatarUrlPrefix: St, jsonConf: JsonConf, authzCtx: AuthzCtxOnPats,
          isWrappedInPage: Bo = false
          ): JsObject = {

    val anyAuthor = ppsById.get(post.createdById)

    // Currently always approved. [4946RKTT2]
    val approvedHtmlSanitized = post.approvedHtmlSanitized.getOrDie(
          "TyE603RKDL4", s"Post not approved: ${post.id}")

    var json = Json.obj(  // Typescript: PostListed
      "id" -> JsNumber(post.id),
      "nr" -> JsNumber(post.nr),
      "parentNr" -> JsNumberOrNull(post.parentNr),
      "approvedHtmlSanitized" -> JsString(approvedHtmlSanitized))

    if (authzCtx.maySeeExtIds) {
      post.extImpId.foreach(json += "extId" -> JsString(_))
    }

    if (post.isTitle) {
      json += "isPageTitle" -> JsTrue
    }

    if (post.isOrigPost) {
      json += "isPageBody" -> JsTrue
    }

    if (isWrappedInPage && (post.isOrigPost || post.isTitle)) {
      // The orig post author is incl in the page json already.
    }
    else {
      json += "author" -> ThingsFoundJson.JsPatFoundOrNull(
            anyAuthor, avatarUrlPrefix = Some(avatarUrlPrefix), jsonConf, authzCtx)
    }

    // If not in a page { ... } obj, with the page id and name, then, more context needed
    // — so the remote server won't need to fetch page details via separate requests.
    if (!isWrappedInPage) {
      // Also see [posts_0_page_json] and Typescript: PostWithPage.
      json += "pageId" -> JsString(post.pageId)
      json += "pageTitle" -> JsString(pageStuff.title)
      // COULD use the page's actual path (folder + slug).
      json += "urlPath" -> JsString(s"/-${post.pageId}#post-${post.nr}")
    }

    json
  }

}


