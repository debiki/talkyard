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
import debiki.dao.{PagePartsDao, PageStuff, PagesCanSee, SiteDao}
import controllers.OkApiJson
import Prelude._
import talkyard.server.api.PostsListFoundJson.JsPostListFound
import talkyard.server.authz.{AuthzCtx, AuthzCtxOnPats}
import talkyard.server.parser.{JsonConf, PageParSer}
import talkyard.server.search.{PageAndHits, SearchHit, SearchResultsCanSee}
import play.api.libs.json._
import play.api.libs.json.JsArray
import play.api.mvc.{Result => p_Result}
import talkyard.server.JsX._

import scala.collection.{immutable => imm}


/** The Get, List and Search APIs use this to render pages to json.
  * (See: GetController, ListController, SearchController.)
  */
object ThingsFoundJson {  RENAME // to  PagesFoundJson ?

  def makePagesJsArr(pagesCanSee: PagesCanSee, dao: SiteDao,
          inclFields: InclPageFields, jsonConf: JsonConf, authzCtx: AuthzCtxOnPats,
          ): Seq[(PageFoundStuff, JsObject)] = {
    _makePagesJs(
          pagesCanSee.pages, anySearchResults = Nil, dao, inclFields, jsonConf, authzCtx)
  }


  def makePagesFoundListResponse(pagesCanSee: PagesCanSee, dao: SiteDao,
        inclFields: InclPageFields, jsonConf: JsonConf, authzCtx: AuthzCtxOnPats,
        ): p_Result = {
    val pagesJs = _makePagesJs(
          pagesCanSee.pages, anySearchResults = Nil, dao, inclFields, jsonConf, authzCtx)
    _makeThingsFoundResp(dao.theSiteIdsOrigins(), pagesJs.map(_._2), jsonConf)
  }


  def makePagesFoundSearchResponse(searchResults: SearchResultsCanSee, dao: SiteDao,
         jsonConf: JsonConf, authzCtx: AuthzCtxOnPats,
         ): p_Result = {
    val pagesJs = _makePagesJs(
          anyPagePathsMetas = Nil, searchResults.pagesAndHits, dao,
          InclPageFields.Default, jsonConf, authzCtx)
    _makeThingsFoundResp(dao.theSiteIdsOrigins(), pagesJs.map(_._2), jsonConf)
  }


  // Vaguely similar code: ForumController.makeTopicsResponse()  and
  // EventsParSer.makeEventsListJson().  [406RKD2JB]
  // GetController & ListController & SearchController already use this, fortunately :-)
  //
  private def _makePagesJs(
      anyPagePathsMetas: Seq[PagePathAndMeta], anySearchResults: Seq[PageAndHits],
      dao: SiteDao, inclFields: InclPageFields, jsonConf: JsonConf, authzCtx: AuthzCtxOnPats
      ): Seq[(PageFoundStuff, JsObject)] = {

    dieIf(anyPagePathsMetas.nonEmpty && anySearchResults.nonEmpty, "TyE40RKUPJR2")
    val settings = dao.getWholeSiteSettings()

    val pageIds = (
      if (anyPagePathsMetas.nonEmpty) anyPagePathsMetas.map(_.pageId)
      else anySearchResults.map(_.pageId)).toSet

    // --- Posts or search hits

    // Stuff needed for creating the json — except for authors and categories.
    // Depending on if this is a ListQuery or a SearchQuery, we have different
    // things available already — let's load the remaining stuff:
    val pageFoundStuffs: Seq[PageFoundStuff] =
      if (anyPagePathsMetas.nonEmpty) {
        val pageStuffById = dao.getPageStuffById(pageIds)

        // --- Posts

        val postsByPageId: Map[PageId, Vec[Post]] =
              if (!inclFields.posts) Map.empty
              else dao.readTx { tx =>
          // Don't use mapValues() — it does things lazily, but then tx has already ended.
          pageStuffById transform { (pageId, stuff: PageStuff) =>
            // If many comments, then look at:
            //   loadPopularPostsByPageExclAggs
            // however it won't load the title or OP.
            if (stuff.pageMeta.numRepliesVisible > 25) {
              // Later: Load any accepted solutions & the most interesting comments?
              // For now, just skip — just trying all this out, for AI LLM integrations.
              Vec.empty
            }
            else {
              val pageParts = PagePartsDao(pageId = stuff.pageId, settings, tx, Some(dao))
              COULD_OPTIMIZE // Load all at once, look at:  loadPopularPostsByPageExclAggs
              // — however, we want tags & assignees too?
              // Or, if combined with say top N posts per page & their ancestors, would need
              // some fancy recursive SQL query?
              // Later, when there are [priv_comts], excl those.
              pageParts.activePosts
            }
          }
        }

        anyPagePathsMetas flatMap { pagePathMeta: PagePathAndMeta =>
          pageStuffById.get(pagePathMeta.pageId) map { pageStuff =>
             new PageFoundStuff(
                   pagePath = pagePathMeta.path.toNew(
                     // I hope it's the canonical path? If not, barely matters.
                     canonical =  true),
                   pageStuff = pageStuff,
                   posts = postsByPageId.get(pageStuff.pageId).getOrElse(Nil),
                   pageAndSearchHits = None)
          }
        }
      }
      else {
        // --- Search hits

        anySearchResults map { pageAndHits =>
          new PageFoundStuff(
                pagePath = pageAndHits.pagePath,
                pageStuff = pageAndHits.pageStuff,
                posts = Nil,
                pageAndSearchHits = Some(pageAndHits))
        }
      }

    // --- Load categories

    COULD_OPTIMIZE // We've loaded the cats already, when doing access control.
    // Could remember, so need not lookup here too.  [search_results_extra_cat_lookup]

    val categoryIdsToLoad: Set[CategoryId] =
          pageFoundStuffs.flatMap(_.pageMeta.categoryId).toSet

    val categoriesById: Map[CategoryId, Category] =
          Map.apply(categoryIdsToLoad.flatMap(id => {
            dao.getCategory(id).map(id -> _)
          }).toSeq : _*)

    // --- Load authors

    COULD // also [incl_assignees], not just authors.
    // But exclude private users or fields e.g. name.  [private_pats]

    val someAuthorIds = pageFoundStuffs.map(_.pageStuff.authorUserId).toSet ++
                        pageFoundStuffs.flatMap(_.posts.map(_.createdById))

    val postIdsFound: Set[PostId] =
          anySearchResults.flatMap(_.hitsByScoreDesc.map(_.postId)).toSet

    COULD_OPTIMIZE // cache authors by post id?
    val authorIdsByPostId: Map[PostId, UserId] = dao.loadAuthorIdsByPostId(postIdsFound)

    val allAuthorIds: Set[UserId] = someAuthorIds ++ authorIdsByPostId.values

    val authorsById = dao.getParticipantsAsMap(allAuthorIds)

    // --- Site origin   dupl code [603RKDJL5]

    val siteIdsOrigins = dao.theSiteIdsOrigins()
    val avatarUrlPrefix =
          siteIdsOrigins.uploadsOrigin +
           talkyard.server.UploadsUrlBasePath + siteIdsOrigins.pubId + '/'

    // --- Generate JSON

    val result: Seq[(PageFoundStuff, JsObject)] = pageFoundStuffs map { stuff =>
      val anyCategory = stuff.pageMeta.categoryId.flatMap(categoriesById.get)
      stuff -> JsPageFound(
            stuff, authorIdsByPostId, authorsById,
            avatarUrlPrefix = avatarUrlPrefix, anyCategory,
            inclFields, jsonConf, authzCtx)
    }

    result
  }


  private def _makeThingsFoundResp(origins: SiteIdOrigins, jsPagesFound: Seq[JsObject],
          jsonConf: JsonConf): p_Result = {
    // Typescript: SearchQueryResults, and ListQueryResults
    OkApiJson(Json.obj(
      "origin" -> origins.siteOrigin,
      "thingsFound" -> jsPagesFound), jsonConf.pretty)
  }


  // Things needed by JsPageFound().
  class PageFoundStuff(
    val pagePath: PagePathWithId,
    val pageStuff: PageStuff,
    val pageAndSearchHits: Option[PageAndHits],
    val posts: imm.Seq[Post]) {
    def pageMeta: PageMeta = pageStuff.pageMeta
    def pageId: PageId = pagePath.pageId
  }


  // Typescript: PageFound
  // Vaguely similar code: ForumController.topicToJson()  [4026RKCN2]
  def JsPageFound(
        pageFoundStuff: PageFoundStuff,
        authorIdsByPostId: Map[PostId, PatId],
        authorsById: Map[PatId, Pat],
        avatarUrlPrefix: St,
        anyCategory: Opt[Cat],
        inclFields: InclPageFields,
        jsonConf: JsonConf,
        authzCtx: AuthzCtxOnPats): JsObject = {

    val pageStuff = pageFoundStuff.pageStuff
    val anyPageAuthor = authorsById.get(pageStuff.authorUserId)
    val pageMeta = pageStuff.pageMeta

    // [def_pg_fields]
    var json = Json.obj()

    if (inclFields.id)
      json += "id" -> JsString(pageStuff.pageId)

    if (inclFields.title)
      json += "title" -> JsString(pageStuff.title)

    if (inclFields.urlPath)
      // Unnecessary to include the origin everywhere.
      json += "urlPath" -> JsString(pageFoundStuff.pagePath.value)

    if (inclFields.excerpt)
      json += "excerpt" -> JsStringOrNull(pageStuff.bodyExcerpt)

    if (inclFields.author)
      json += "author" ->
                JsPatFoundOrNull(anyPageAuthor, Some(avatarUrlPrefix), jsonConf, authzCtx)

    // For now, only the leaf category — but later, SHOULD incl ancestor categories
    // the the requester can see, too — so this is an array.  [incl_anc_cats]
    if (inclFields.categoriesMainFirst)
      json += "categoriesMainFirst" ->
                Json.arr(JsCategoryFoundOrNull(anyCategory, jsonConf, authzCtx))

    if (inclFields.pageType)
      json += "pageType" -> JsString(PageParSer.pageTypeSt_apiV0(pageMeta.pageType))

    if (inclFields.answerPostId)
      json += "answerPostId" -> JsNum32OrNull(pageMeta.answerPostId)

    if (inclFields.doingStatus)
      PageParSer.pageDoingStatusSt_apiV0(pageMeta.doingStatus).foreach(st =>
            json += "doingStatus" -> JsString(st))

    if (inclFields.closedStatus)
      PageParSer.pageClosedStatusSt_apiV0(pageMeta).foreach(st =>
            json += "closedStatus" -> JsString(st))

    if (inclFields.deletedStatus)
      PageParSer.pageDeletedStatusSt_apiV0(pageMeta).foreach(st =>
            json += "deletedStatus" -> JsString(st))

    if (inclFields.id && jsonConf.inclOldPageIdField)
      json += "pageId" -> JsString(pageStuff.pageId)

    if (inclFields.refId && authzCtx.maySeeExtIds) {
      pageMeta.extImpId foreach { rid =>
        json += "extId" -> JsString(rid)
        json += "refId" -> JsString(rid)  // renaming to refId
      }
    }

    // If this is a SearchQuery for posts, include those posts (always, no inclFields needed).
    pageFoundStuff.pageAndSearchHits.foreach { pageAndHits: PageAndHits =>
      json += "postsFound" -> JsArray(pageAndHits.hitsByScoreDesc map { hit =>
        val anyAuthor: Option[Participant] =
              authorIdsByPostId.get(hit.postId) flatMap authorsById.get
        JsPostFound(hit, anyAuthor, avatarUrlPrefix, jsonConf, authzCtx)
      })
    }

    // Else, if we're including all posts (or the top post, or just the orig post):
    if (inclFields.posts) {
      devDieIf(pageFoundStuff.posts.isEmpty, "TyE0POST402", "Really no posts on the whole page?")
      json += "posts" -> JsArray(pageFoundStuff.posts map { post: Post =>
        JsPostListFound(
              post, pageStuff, anyCat = None /* in pageJson already */,
              authorsById, avatarUrlPrefix = avatarUrlPrefix,
              jsonConf, authzCtx, isWrappedInPage = true)
      })
    }
    else {
      devDieIf(pageFoundStuff.posts.nonEmpty, "TyEPOSTS6205", "Loaded posts but needs none?")
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
      category.extImpId foreach { res += "refId" -> JsString(_) }  // renaming to refId
    }

    if (jsonConf.inclOldCategoryIdField) {
      res += "categoryId" -> JsNumber(category.id)  // REMOVE  [ty_v1]
    }

    res
  }


  // Typescript: PostFound. Maybe RENAME to PostSearchFound?
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
      pat.extId.foreach(json += "refId" -> JsString(_))  // renaming to refId
      pat match {
        case user: UserBase => user.ssoId.foreach(json += "ssoId" -> JsString(_))
        case _ => ()
      }
    }

    // Later, excl e.g. name, if is private.  [private_pats]
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
