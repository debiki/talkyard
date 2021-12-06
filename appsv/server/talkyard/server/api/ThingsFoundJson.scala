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
import debiki.dao.{PageStuff, SiteDao}
import talkyard.server.authz.{AuthzCtx, AuthzCtxOnPats}
import talkyard.server.parser.{JsonConf, PageParSer}
import talkyard.server.search.{PageAndHits, SearchHit}
import play.api.libs.json._
import play.api.libs.json.JsArray
import play.api.mvc.Result
import talkyard.server.JsX._



object ThingsFoundJson {  RENAME // to  PagesFoundJson ?


  def makePagesFoundListResponse(topics: Seq[PagePathAndMeta], dao: SiteDao,
        jsonConf: JsonConf, authzCtx: AuthzCtxOnPats): Result = {
    makePagesFoundResponseImpl(
        topics, anySearchResults = Nil, dao, jsonConf, authzCtx)
  }


  def makePagesFoundSearchResponse(searchResults: Seq[PageAndHits], dao: SiteDao,
        jsonConf: JsonConf, authzCtx: AuthzCtxOnPats): Result = {
    makePagesFoundResponseImpl(
        anyPagePathsMetas = Nil, searchResults, dao, jsonConf, authzCtx)
  }


  // Vaguely similar code: ForumController.makeTopicsResponse()  [406RKD2JB]
  //
  private def makePagesFoundResponseImpl(
      anyPagePathsMetas: Seq[PagePathAndMeta], anySearchResults: Seq[PageAndHits],
      dao: SiteDao, jsonConf: JsonConf, authzCtx: AuthzCtxOnPats): Result = {

    dieIf(anyPagePathsMetas.nonEmpty && anySearchResults.nonEmpty, "TyE40RKUPJR2")

    val pageIds = (
      if (anyPagePathsMetas.nonEmpty) anyPagePathsMetas.map(_.pageId)
      else anySearchResults.map(_.pageId)).toSet

    // Stuff needed for creating the json — except for authors and categories.
    // Depending on if this is a ListQuery or a SearchQuery, we have different
    // things available already — let's load the remaining stuff:
    val pageFoundStuffs: Seq[PageFoundStuff] =
      if (anyPagePathsMetas.nonEmpty) {
        val pageStuffById = dao.getPageStuffById(pageIds)
        anyPagePathsMetas flatMap { pagePathMeta: PagePathAndMeta =>
          pageStuffById.get(pagePathMeta.pageId) map { pageStuff =>
             new PageFoundStuff(
                   pagePath = pagePathMeta.path.toNew(
                     // I hope it's the canonical path? If not, barely matters.
                     canonical =  true),
                   pageStuff = pageStuff,
                   pageAndSearchHits = None)
          }
        }
      }
      else {
        anySearchResults map { pageAndHits =>
          new PageFoundStuff(
                pagePath = pageAndHits.pagePath,
                pageStuff = pageAndHits.pageStuff,
                pageAndSearchHits = Some(pageAndHits))
        }
      }

    // --- Load categories

    val categoryIdsToLoad: Set[CategoryId] =
          pageFoundStuffs.flatMap(_.pageMeta.categoryId).toSet

    val categoriesById: Map[CategoryId, Category] =
          Map.apply(categoryIdsToLoad.flatMap(id => {
            dao.getCategory(id).map(id -> _)
          }).toSeq : _*)

    // --- Load authors

    val pageAuthorIds = pageFoundStuffs.map(_.pageStuff.authorUserId).toSet

    val postIdsFound: Set[PostId] =
          anySearchResults.flatMap(_.hitsByScoreDesc.map(_.postId)).toSet

    COULD_OPTIMIZE // cache authors by post id?
    val authorIdsByPostId: Map[PostId, UserId] = dao.loadAuthorIdsByPostId(postIdsFound)

    val allAuthorIds: Set[UserId] = pageAuthorIds ++ authorIdsByPostId.values

    val authorsById = dao.getParticipantsAsMap(allAuthorIds)

    // --- Site origin   dupl code [603RKDJL5]

    val siteIdsOrigins = dao.theSiteIdsOrigins()
    val avatarUrlPrefix =
          siteIdsOrigins.uploadsOrigin +
           talkyard.server.UploadsUrlBasePath + siteIdsOrigins.pubId + '/'

    // --- The result

    val jsPagesFound: Seq[JsObject] = pageFoundStuffs map { stuff =>
      val anyCategory = stuff.pageMeta.categoryId.flatMap(categoriesById.get)
      JsPageFound(
            stuff, authorIdsByPostId, authorsById,
            avatarUrlPrefix = avatarUrlPrefix, anyCategory, jsonConf, authzCtx)
    }

    // Typescript: SearchQueryResults, and ListQueryResults
    OkApiJson(Json.obj(
      "origin" -> siteIdsOrigins.siteOrigin,
      "thingsFound" -> jsPagesFound), jsonConf.pretty)
  }


  // Things needed by JsPageFound().
  class PageFoundStuff(
    val pagePath: PagePathWithId,
    val pageStuff: PageStuff,
    val pageAndSearchHits: Option[PageAndHits]) {
    def pageMeta: PageMeta = pageStuff.pageMeta
  }


  // Typescript: PageFound
  // Vaguely similar code: ForumController.topicToJson()  [4026RKCN2]
  def JsPageFound(
        pageFoundStuff: PageFoundStuff,
        authorIdsByPostId: Map[PostId, PatId],
        authorsById: Map[PatId, Pat],
        avatarUrlPrefix: St,
        anyCategory: Opt[Cat],
        jsonConf: JsonConf,
        authzCtx: AuthzCtxOnPats): JsObject = {

    val pageStuff = pageFoundStuff.pageStuff
    val anyPageAuthor = authorsById.get(pageStuff.authorUserId)
    val pageMeta = pageStuff.pageMeta

    var json = Json.obj(
      "id" -> pageStuff.pageId,
      "title" -> pageStuff.title,
      // Unnecessary to include the origin everywhere.
      "urlPath" -> pageFoundStuff.pagePath.value,
      "excerpt" -> JsStringOrNull(pageStuff.bodyExcerpt),
      "author" -> JsPatFoundOrNull(anyPageAuthor, Some(avatarUrlPrefix), jsonConf, authzCtx),
      // For now, only the leaf category — but later, SHOULD incl ancestor categories
      // too — so this is an array.
      "categoriesMainFirst" -> Json.arr(JsCategoryFoundOrNull(anyCategory, jsonConf, authzCtx)),
      "pageType" -> PageParSer.pageTypeSt_apiV0(pageMeta.pageType),
      "answerPostId" -> JsNum32OrNull(pageMeta.answerPostId),
      "doingStatus" -> PageParSer.pageDoingStatusSt_apiV0(pageMeta.doingStatus),
      "closedStatus" -> PageParSer.pageClosedStatusSt_apiV0(pageMeta),
      "deletedStatus" -> PageParSer.pageDeletedStatusSt_apiV0(pageMeta),
      )

    if (jsonConf.inclOldPageIdField) {
      json += "pageId" -> JsString(pageStuff.pageId)
    }

    if (authzCtx.maySeeExtIds) {
      pageMeta.extImpId foreach { json += "extId" -> JsString(_) }
    }

    // If this is a SearchQuery for posts, include those posts.
    pageFoundStuff.pageAndSearchHits.foreach { pageAndHits: PageAndHits =>
      json += "postsFound" -> JsArray(pageAndHits.hitsByScoreDesc map { hit =>
        val anyAuthor: Option[Participant] =
              authorIdsByPostId.get(hit.postId) flatMap authorsById.get
        JsPostFound(hit, anyAuthor, avatarUrlPrefix, jsonConf, authzCtx)
      })
    }

    json
  }


  // Typescript: CategoryFound
  def JsCategoryFoundOrNull(anyCategory: Option[Category], jsonConf: JsonConf,
          authzCtx: AuthzCtx): JsValue = {
    val category = anyCategory getOrElse { return JsNull }
    // Later, with different forums or sub communities [subcomms] [4GWRQA28] in the same
    // main site — would need to prefix the category's url path with the forum
    // page's url path.
    var res = Json.obj(
      "id" -> JsNumber(category.id),
      "name" -> JsString(category.name),
      "urlPath" -> JsString(s"/latest/${category.slug}"))

    if (authzCtx.maySeeExtIds) {
      category.extImpId foreach { res += "extId" -> JsString(_) }
    }

    if (jsonConf.inclOldCategoryIdField) {
      res += "categoryId" -> JsNumber(category.id)  // REMOVE  [ty_v1]
    }

    res
  }


  // Typescript: PostFound
  def JsPostFound(hit: SearchHit, anyAuthor: Opt[Pat], avatarUrlPrefix: St,
        jsonConf: JsonConf, authzCtx: AuthzCtxOnPats): JsObject = {
    Json.obj(
      "isPageTitle" -> JsBoolean(hit.postNr == PageParts.TitleNr),
      "isPageBody" -> JsBoolean(hit.postNr == PageParts.BodyNr),
      "author" -> JsPatFoundOrNull(anyAuthor, Some(avatarUrlPrefix), jsonConf, authzCtx),
      "htmlWithMarks" -> JsArray(hit.approvedTextWithHighligtsHtml map JsString))
  }


  // Typescript: ParticipantFound
  // A bit dupl code. [dupl_pat_json_apiv0]
  def JsPatFoundOrNull(anyPat: Opt[Pat], avatarUrlPrefix: Opt[St],
        jsonConf: JsonConf, authzCtx: AuthzCtxOnPats): JsValue = {

    val pat = anyPat getOrElse { return JsNull }
    var json = Json.obj("id" -> JsNumber(pat.id))

    if (authzCtx.maySeeExtIds) {
      pat.extId.foreach(json += "extId" -> JsString(_))
      pat match {
        case user: UserBase => user.ssoId.foreach(json += "ssoId" -> JsString(_))
        case _ => ()
      }
    }

    pat.anyUsername.foreach(json += "username" -> JsString(_))
    pat.anyName.foreach(json += "fullName" -> JsString(_))

    if (pat.isGroup) json += "isGroup" -> JsTrue
    if (pat.isGuest) json += "isGuest" -> JsTrue
    if (pat.isAnon) json += "isAnon" -> JsTrue

    avatarUrlPrefix foreach { avUrlPerf =>
      pat.tinyAvatar foreach { tinyAv =>
        json += "tinyAvatarUrl" -> JsString(avUrlPerf + tinyAv.hashPath)
      }
    }

    if (jsonConf.inclOldPpIdField) {
      json += "ppId" -> JsNumber(pat.id)  // REMOVE  [ty_v1]
    }

    json
  }

}
