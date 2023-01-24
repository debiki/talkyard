/**
 * Copyright (c) 2022 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

package talkyard.server.events

import com.debiki.core._
import com.debiki.core.Prelude._
import talkyard.server.authz.{AuthzCtxOnForum, AuthzCtxOnPats}
import talkyard.server.JsX
import talkyard.server.parser.JsonConf
import debiki.dao.{LoadPostsResult, PageStuff, SiteDao}

import play.api.libs.json._


case class EventAndJson(event: Event, json: JsObject)


/** Parses and serializes JSON for events  (software events, e.g. a new comment,
  * or a user joined etc. Not in-real-life events).
  */
object EventsParSer {


  def makeEventsListJson(events: ImmSeq[Event], dao: SiteDao, reqer: Opt[Pat],
          avatarUrlPrefix: St, authzCtx: AuthzCtxOnForum): ImmSeq[EventAndJson] = {

    // --- Load posts and pages

    val (postsById: collection.Map[PostId, Post],
          origPostsByPageId: collection.Map[PageId, Post],
          pageStuffById: collection.Map[PageId, PageStuff],
          patIds: ImmSeq[PatId]) = {

      val pagePostNrs: ImmSeq[PagePostNr] = events collect {
        case ev: PageEvent if ev.eventType == PageEventType.PageCreated =>
          PagePostNr(ev.pageId, BodyNr)
      }

      val otherPageIds: MutArrBuf[PageId] = (events collect {
        case ev: PageEvent if ev.eventType != PageEventType.PageCreated =>
          ev.pageId
      }).to[MutArrBuf]

      val postIds: ImmSeq[PostId] = events collect {
        case ev: PostEvent => ev.postId
      }

      val patIds: ImmSeq[PatId] = events collect {
        case ev: PatEvent => ev.patId
      }

      val postsById = MutHashMap[PostId, Post]()
      val origPostsByPageId = MutHashMap[PageId, Post]()
      val pageStuffById = MutHashMap[PageId, PageStuff]()

      val loadPostsByIdResult: LoadPostsResult = dao.loadPostsMaySeeByIdOrNrs(
            reqer, postIds = Some(postIds.toSet), pagePostNrs = None)
      loadPostsByIdResult.posts foreach { p =>
        postsById += p.id -> p
        // Load the page too, so we can include the page title and URL path
        // in the post JSON, see JsPostListFound.
        otherPageIds append p.pageId
      }

      val loadPostsByPageNrResult: LoadPostsResult = dao.loadPostsMaySeeByIdOrNrs(
            reqer, postIds = None, pagePostNrs = Some(pagePostNrs.toSet))

      loadPostsByPageNrResult.posts foreach { p => origPostsByPageId += p.pageId -> p }
      pageStuffById ++= loadPostsByPageNrResult.pageStuffById

      val pageStuffByIdInclForbidden: Map[PageId, PageStuff] =
            dao.getPageStuffById(otherPageIds)

      pageStuffByIdInclForbidden.foreach({ case (_, pageStuff: PageStuff) =>
        if (dao.maySeePageUseCache(pageStuff.pageMeta, reqer).maySee) {
          pageStuffById += pageStuff.pageId -> pageStuff
        }
      })

      (postsById,  origPostsByPageId, pageStuffById, patIds)
    }

    // --- Load categories

    val catIdsToLoad: Set[CatId] = pageStuffById.values.flatMap(_.pageMeta.categoryId).toSet
    val catsById: Map[CatId, Cat] = dao.getCatsById(catIdsToLoad)

    // --- Load authors

    val authorIds = MutHashSet[PatId]()
    // (Loading anonyms, not the real users, so they'll stay anonymous.)
    authorIds ++= postsById.values.map(_.createdById.curId)
    authorIds ++= origPostsByPageId.values.map(_.createdById.curId)
    authorIds ++= pageStuffById.values.map(_.authorUserId)
    authorIds ++= patIds

    val authorsById: Map[UserId, Pat] = dao.getParticipantsAsMap(authorIds)

    // --- Load page paths
    // Could skip here, if: [incl_path_in_page_stuff].

    val pagePaths = pageStuffById.values.flatMap(p => dao.getPagePath2(p.pageId)).toSeq
    val pagePathsById: Map[PageId, PagePathWithId] = Map(pagePaths.map(p => p.pageId -> p): _*)

    // --- Lastly, build json

    // Later: Sort by id/time, so oldest first, if including more than one event
    // in the same request.  [whks_1_event]

    val result: ImmSeq[EventAndJson] = events flatMap {
      case pageEvent: PageEvent if pageEvent.eventType == PageEventType.PageCreated =>
        for {
          page: PageStuff <- pageStuffById.get(pageEvent.pageId)
          post: Post <- origPostsByPageId.get(pageEvent.pageId)
          cat: Opt[Cat] = page.categoryId flatMap catsById.get
        }
        yield {
          val json = JsPageEvent_apiv0(pageEvent, page, cat, anyOrigPost = Some(post),
                pagePathsById, authorsById, avatarUrlPrefix = avatarUrlPrefix, authzCtx)
          EventAndJson(pageEvent, json)
        }

      case pageEvent: PageEvent if pageEvent.eventType == PageEventType.PageUpdated =>
        for {
          page: PageStuff <- pageStuffById.get(pageEvent.pageId)
          cat: Opt[Cat] = page.categoryId flatMap catsById.get
        }
        yield {
          val json = JsPageEvent_apiv0(pageEvent, page, cat, anyOrigPost = None,
                pagePathsById, authorsById, avatarUrlPrefix = avatarUrlPrefix, authzCtx)
          EventAndJson(pageEvent, json)
        }

      case postEvent: PostEvent =>
        for {
          post: Post <- postsById.get(postEvent.postId)
          page: PageStuff <- pageStuffById.get(post.pageId)
        }
        yield {
          val json = JsPostEvent_apiv0(postEvent, post, page, authorsById,
                avatarUrlPrefix = avatarUrlPrefix, authzCtx)
          EventAndJson(postEvent, json)
        }

      case patEvent: PatEvent =>
        for {
          pat: Pat <- authorsById.get(patEvent.patId).logBugIfEmpty("TyEPARSEV0PAT")
        }
        yield {
          val json = JsPatEvent_apiv0(patEvent, pat, authzCtx)
          EventAndJson(patEvent, json)
        }
    }

    result
  }



  def JsPageEventTypeString_apiv0(eventType: PageEventType): JsString = {
    val asStr = eventType match {
      case PageEventType.PageCreated => "PageCreated"
      case PageEventType.PageUpdated => "PageUpdated"
    }
    assert(asStr startsWith "Page")
    JsString(asStr)
  }



  def JsPostEventTypeString_apiv0(eventType: PostEventType): JsString = {
    val asStr = eventType match {
      case PostEventType.PostCreated => "PostCreated"
      case PostEventType.PostUpdated => "PostUpdated"
    }
    assert(asStr startsWith "Post")
    JsString(asStr)
  }



  def JsPatEventTypeString_apiv0(eventType: PatEventType): JsString = {
    val asStr = eventType match {
      case PatEventType.PatCreated => "PatCreated"
      //se PatEventType.PatUpdated => "PatUpdated"
    }
    assert(asStr startsWith "Pat")
    JsString(asStr)
  }



  def JsPageEvent_apiv0(event: PageEvent, page: PageStuff, anyCat: Opt[Cat],
          anyOrigPost: Opt[Post], pagePathsById: Map[PageId, PagePathWithId],
          authorsById: Map[PatId, Pat], avatarUrlPrefix: St, authzCtx: AuthzCtxOnForum,
          ): JsObject = {
    import talkyard.server.api.ThingsFoundJson
    import talkyard.server.api.PostsListFoundJson.JsPostListFound

    val pageFoundStuff = new ThingsFoundJson.PageFoundStuff(
          pagePath = pagePathsById.getOrElse(page.pageId, PagePathWithId.fromIdOnly(page.pageId,
              // Since there's no other path, this should be the canonical path.
              canonical = true)),
          pageStuff = page,
          pageAndSearchHits = None)

    var pageJson = ThingsFoundJson.JsPageFound(
          pageFoundStuff,
          authorIdsByPostId = Map.empty, // only needed for search hits
          authorsById = authorsById,
          avatarUrlPrefix = avatarUrlPrefix,
          anyCategory = anyCat,
          JsonConf.v0_1(), authzCtx)

    anyOrigPost foreach { origPost =>
      val origPostJson = JsPostListFound(
            origPost, page, authorsById, avatarUrlPrefix = avatarUrlPrefix,
            JsonConf.v0_1(), authzCtx, isWrappedInPage = true)
      pageJson += "posts" -> Json.arr(origPostJson)
    }

    Json.obj(  // ts: Event_, in tests/e2e-wdio7/pub-api.ts.
        "id" -> event.id,
        "atMs" -> JsX.JsWhenMs(event.when),
        "eventType" -> JsPageEventTypeString_apiv0(event.eventType),
        //"eventSubtypes" ->
        "eventData" -> Json.obj(
          "page" -> pageJson
        ))
  }



  def JsPostEvent_apiv0(event: PostEvent, post: Post, page: PageStuff,
        authorsById: Map[PatId, Pat], avatarUrlPrefix: St, authzCtx: AuthzCtxOnForum,
        ): JsObject = {
    import talkyard.server.api.PostsListFoundJson.JsPostListFound
    val postJson = JsPostListFound(post, page, authorsById, avatarUrlPrefix = avatarUrlPrefix,
          JsonConf.v0_1(), authzCtx, isWrappedInPage = false)
    Json.obj(  // ts: Event_, in tests/e2e-wdio7/pub-api.ts.
        "id" -> event.id,
        "atMs" -> JsX.JsWhenMs(event.when),
        "eventType" -> JsPostEventTypeString_apiv0(event.eventType),
        "eventData" -> Json.obj(
          "post" -> postJson
        ))
  }



  def JsPatEvent_apiv0(event: PatEvent, pat: Pat, authzCtx: AuthzCtxOnPats): JsObject = {
    Json.obj(  // ts: Event_, in tests/e2e-wdio7/pub-api.ts.
        "id" -> event.id,
        "atMs" -> JsX.JsWhenMs(event.when),
        "eventType" -> JsPatEventTypeString_apiv0(event.eventType),
        "eventData" -> Json.obj(
          "pat" -> JsX.JsUserApiV0(pat, brief = true, authzCtx)
        ))
  }

}
