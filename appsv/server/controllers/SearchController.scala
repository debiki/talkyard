/**
 * Copyright (c) 2013, 2016 Kaj Magnus Lindberg
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
import debiki.{RateLimits, SiteTpi}
import debiki.JsonUtils.{parseOptInt32}
import talkyard.server.search._
import talkyard.server.http._
import talkyard.server.authz.AuthzCtxOnForum
import debiki.EdHttp._
import scala.collection.immutable.Seq
import debiki.dao.SiteDao
import talkyard.{server => tysv}
import talkyard.server.JsX.{JsErrMsgCode, JsNumberOrNull, JsTag, JsTagTypeArray}
import talkyard.server.{TyContext, TyController}
import javax.inject.Inject
import play.api.libs.json.{JsObject, JsValue}
import play.api.mvc.{Action, ControllerComponents, Result}
import scala.concurrent.Future
import talkyard.server.api.ThingsFoundJson


/** Full text search, for a whole site, or for a site section, e.g. a single
  * forum (including all sub forums and topics), a single blog, or wiki.
  */
class SearchController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {


  /** 'q' not 'query', so urls becomes a tiny bit shorter, because people will sometimes
    * copy & paste search phrase urls in emails etc? Google uses 'q' not 'query' anyway.
    */
  def showSearchPage(q: Option[String]): Action[Unit] = AsyncGetAction { request =>
    val htmlStr = views.html.templates.search(
          // Incl cats and tags, so can be selected in the advanced search dropdowns.
          SiteTpi(request, inclCatsTagsSects_unimpl = true)).body
    ViewPageController.addVolatileJsonAndPreventClickjacking2(htmlStr,
        unapprovedPostAuthorIds = Set.empty, request)
  }


  def doSearch(): Action[JsValue] = AsyncPostJsonAction(RateLimits.FullTextSearch, maxBytes = 1000) {
        request: JsonPostRequest =>
    import request.dao

    val rawQuery = (request.body \ "rawQuery").as[String]
    val anyOffset = parseOptInt32(request.body, "offset")
    val searchQuery = SearchQueryParser.parseRawSearchQueryString(rawQuery, dao.readOnly)

    dao.fullTextSearch(searchQuery, anyRootPageId = None, request.authzContext,
            anyOffset = anyOffset, addMarkTagClasses = true) map {
          results: SearchResultsCanSee =>
      import play.api.libs.json._
      val tagTypeIds: Set[TagTypeId] = results.tagTypeIds
      val tagTypes = dao.getTagTypesForIds(tagTypeIds)
      val jsonMaker = new debiki.JsonMaker(dao)
      OkSafeJson(Json.obj(
          "thisIsAll" -> JsBoolean(results.pagesAndHits.size < BatchSize),
          "warnings" -> JsArray(searchQuery.warnings.map(JsErrMsgCode)),
          "storePatch" -> Json.obj(
            // Later, excl private-visibility tags here. [priv_tags]
            "tagTypes" -> JsTagTypeArray(tagTypes,
                              inclRefId = request.requester.exists(_.isStaff)), // [who_sees_refid]
            // And excl private users here, [private_pats]
            // and in  authorId & assigneeIds fields below.
            "usersBrief" -> JsArray.empty), // later: authors.map(JsPatNameAvatar))),
          "pagesAndHits" -> results.pagesAndHits.map((pageAndHits: PageAndHits) => {
            val pageMeta = pageAndHits.pageStuff.pageMeta
            val pageTags: Seq[Tag] = pageAndHits.pageStuff.pageTags
            COULD_OPTIMIZE // Do this (find ancestor cats) for all distinct categories in
            // the search result at the same time, just once. Instead of once per page hit.
            val ancCatsJsonRootFirst: collection.Seq[JsObject] =
                  jsonMaker.makeForumIdAndAncestorsJson(pageMeta)._2

            Json.obj(
              "pageId" -> pageAndHits.pageId,
              "pageTitle" -> pageAndHits.pageTitle,
              "pageType" -> pageAndHits.pageType.toInt,
              "pageRole" -> pageAndHits.pageType.toInt, // REMOVE later, renaming to ...Type
              "ancestorsRootFirst" -> ancCatsJsonRootFirst, // [incl_anc_cats]
              "pubTags" -> pageTags.map(JsTag),
              // Needs  usersBrief above.
              "authorId" -> JsNumber(pageAndHits.pageStuff.authorUserId),
              "urlPath" -> pageAndHits.pagePath.value,
              "hits" -> JsArray(pageAndHits.hitsByScoreDesc.map((hit: SearchHit) => Json.obj(
                "postId" -> hit.postId,
                "postNr" -> hit.postNr,
                "approvedRevisionNr" -> hit.approvedRevisionNr,
                "approvedTextWithHighlightsHtml" ->
                    Json.arr(hit.approvedTextWithHighligtsHtml),  // BUG: double array. Harmless, is waht the browse expects :- P
                "currentRevisionNr" -> hit.currentRevisionNr,
                // Later, see [post_to_json], and ThingsFoundJson.makePagesFoundSearchResponse:
                // "pubTags" -> JsArray(postTags map JsTag),
                // "authorIds" ->  ...  — needs  usersBrief above
                // "assigneeIds" -> ...
              ))))
          })
        ))
    }
  }


  def apiV0_search_get(/*freetext: Opt[St], pretty: Opt[Bo]*/): Action[Unit] =  // [PUB_API]
         AsyncGetActionRateLimited( RateLimits.FullTextSearch) { request: GetRequest =>
    // Allow POST only. However it's nice to get this developer
    // friendly No message, rather than an "endpoint not found" error. [devfriendly]
    throwForbidden("TyEUSEPOST",
          "You did a GET request to /-/v0/search, please use POST instead")
    /*
    // Developer friendly. Otherwise, if freetext: String (not Option), then Play
    // replies with lots of HTML and CSS with an error message, but that's hard to read
    // when having sent the request from Dev Tools or Bash + curl.
    val theText = freetext.getOrThrowBadRequest("TyEAPI0QUERY",
          o"""You did a GET request, but  ?freetext=... query param missing.
            Or you can send a POST request with JSON body""")
    */
  }


  def apiV0_search_post(): Action[JsValue] = AsyncPostJsonAction(  // [PUB_API]
          RateLimits.FullTextSearch, maxBytes = 1000) { request: JsonPostRequest =>
    import request.{body, dao}

    val pretty = (body \ "pretty").asOpt[Boolean].getOrElse(false)
    val searchQueryJson = (body \ "searchQuery").as[JsObject]
    val q = (searchQueryJson \ "freetext").as[String]

    // Right now, only { freetext: ... } supported — same as: GET /-/v0/search?freetext=...  .
    val searchQuery = SearchQueryParser.parseRawSearchQueryString(q, dao.readOnly)

    // Public API — run the search query as a not logged in user.
    val pubAuthzCtx = dao.getForumPublicAuthzContext()

    doSearchPubApiImpl(searchQuery, dao, request, pubAuthzCtx, pretty)
  }



  private def doSearchPubApiImpl(searchQuery: SearchQuery,
        dao: SiteDao, request: ApiRequest[_], authzCtx: AuthzCtxOnForum,
        pretty: Bo): Future[Result] = {
    // No <mark> tag class. Instead, just: " ... <mark>text hit</mark> ...",
    // that is, don't:  <mark class="...">  — so people cannot write code that
    // relies on those classes.
    dao.fullTextSearch(searchQuery, anyRootPageId = None, authzCtx,
          anyOffset = None, addMarkTagClasses = false) map { results: SearchResultsCanSee =>

      // We're using the authz ctx below not to filter pages and comments, but to
      // know if names of other users should be included — in the future, some
      // members might be private [private_pats].
      WOULD_OPTIMIZE // reuse authzCtx, but currently it's for pages only (not for
      // see-user perms).
      val authzCtxOnPats = dao.getAuthzContextOnPats(request.reqer)

      ThingsFoundJson.makePagesFoundSearchResponse(results, dao,
            tysv.JsonConf.v0_0(pretty = pretty), authzCtxOnPats)
    }
  }

}

