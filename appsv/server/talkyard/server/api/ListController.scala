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
import debiki.RateLimits
import debiki.dao.PagesCanSee  // MOVE to core?
import talkyard.server.http._
import talkyard.server.events.EventsParSer
import debiki.EdHttp._
import Prelude._
import debiki.dao.LoadPostsResult
import talkyard.server.{TyContext, TyController}
import javax.inject.Inject
import play.api.libs.json.{JsObject, JsValue, Json}
import play.api.mvc.{Action, ControllerComponents, Result}
import talkyard.server.parser.JsonConf
import debiki.JsonUtils._


/** The ListQuery API, see: (project root)/tests/e2e/pub-api.ts
  */
class ListController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {


  def apiV0_list(): Action[JsValue] = PostJsonAction(  // [PUB_API]
          RateLimits.ReadsFromDb, maxBytes = 2000) { request: JsonPostRequest =>
    listThingsImpl(request)
  }


  private def listThingsImpl(request: JsonPostRequest): Result = {
    import request.{body, dao, requester, reqrInf}

    val pretty = (body \ "pretty").asOpt[Bo].getOrElse(false)
    val listQueryJson = (body \ "listQuery").as[JsObject]

    val listWhat = (listQueryJson \ "listWhat").asOpt[St].getOrElse(
          (listQueryJson \ "findWhat").as[St])  ; DEPRECATED
    val Pages = "Pages"
    val Posts = "Posts"
    val Events = "Events"

    throwBadReqIf(listWhat != Pages && listWhat != Posts && listWhat != Events,
      "TyE3056KTM7", "'listWhat' must be 'Pages' or 'Posts' or 'Events'")

    val lookWhere = (listQueryJson \ "lookWhere").asOpt[JsObject]

    val lookInWhichCategories: Seq[Ref] =
      if (lookWhere.isEmpty) Nil
      else (lookWhere.get \ "inCategories").asOpt[Seq[Ref]] getOrElse Nil

    throwUnimplementedIf(lookInWhichCategories.size >= 2,
      "TyE205KDT53", "Currently at most one lookWhere.inCategories can be specified")

    throwUnimplementedIf(lookInWhichCategories.nonEmpty && listWhat == Events,
      "TyE205KDT54", "Currently lookWhere.inCategories not supported, for events")

    val anyCategoryRef = lookInWhichCategories.headOption

    val anyFilter = (listQueryJson \ "filter").asOpt[JsObject]

    throwUnimplementedIf(anyFilter.isDefined && (listWhat == Posts || listWhat == Events),
          "TyE603MRD4", "No filters implemented for posts and events")

    val (
      isAuthorWaitingFilter: Opt[Bo],
      isOpenFilter: Opt[Bo],
      pageTypeFilter: Set[PageType]) =
          anyFilter match {
            case None => (None, None, Set.empty)
            case Some(jsFilter) =>
              val isAuthorWaiting = parseOptBo(jsFilter, "isAuthorWaiting")
              val isOpen = parseOptBo(jsFilter, "isOpen")

              // Break out fn later, place where?
              // Maybe:  TyJson.parsePageTypes(json): Set[PageTyp] ?
              val pageTypesAr = parseOptJsObject(jsFilter, "pageType") map { jsOb =>
                parseJsArray(jsOb, "_in") flatMap {
                  case play.api.libs.json.JsString(typeSt) => Some(typeSt)
                  case _ => None
                }
              } getOrElse Nil
              var pageTypes = Set[PageType]()
              // Typescript type: PageTypeSt
              if (pageTypesAr.contains("Question")) pageTypes += PageType.Question
              if (pageTypesAr.contains("Problem")) pageTypes += PageType.Problem
              if (pageTypesAr.contains("Idea")) pageTypes += PageType.Idea
              if (pageTypesAr.contains("Discussion")) pageTypes += PageType.Discussion

              (isAuthorWaiting, isOpen, pageTypes)
          }

    // Later: Maybe reuse ListPagesQueryParser, break out FormInpReader to
    // trait ParamsParser?  [pg_sort_ord]
    val pageSortOrder = parseOptSt(listQueryJson, "sortOrder").getOrElse("") match {
      case "ActiveFirst" =>   // internal name: "ByBumpedAtDesc"
        PageOrderOffset.ByBumpTime(offset = None)
      case "NewestFirst" =>   // internal name: "ByCreatedAtDesc"
        PageOrderOffset.ByCreatedAt(offset = None)
      //case "ByOpLikesDesc" =>
      //  PageOrderOffset.ByLikesAndBumpTime(offset = None)
      //case "ByTotLikesDesc" =>
      //  PageOrderOffset.ByLikesAndBumpTime(offset = None)
      case "PopularFirst" | _ =>  // internal name: "ByScoreDescThenBumpedAtDesc" ?
        // Score and bump time, if nothing else specified. [TyT025WKRGJ]
        PageOrderOffset.ByScoreAndBumpTime(offset = None, TopTopicsPeriod.Week)
    }

    val limitMax100: Opt[i32] = parseOptI32(listQueryJson, "limit", min = Some(1), max = Some(100))
    val newerOrAt: Opt[When] = parseOptWhen(listQueryJson, "newerOrAt")
    val olderOrAt: Opt[When] = parseOptWhen(listQueryJson, "olderOrAt")

    COULD_OPTIMIZE // currently needlessly created again, when checking page perms.
    // Could reuse this one.  [reuse_authz_ctx]
    val authzCtx = dao.getForumAuthzContext(requester)

    def nothingFound = ThingsFoundJson.makePagesFoundListResponse(
          PagesCanSee.empty, dao, JsonConf.v0_0(pretty = pretty), authzCtx)

    val anyCategory: Option[Category] = anyCategoryRef map { catRef =>
      val parsedRef = parseRef(catRef, allowPatRef = false) getOrIfBad { problem =>
        throwForbidden("TyE603KSJL3", s"Bad category ref: $problem")
      }
      dao.getCategoryByParsedRef(parsedRef) getOrElse {
        // Don't return any Not Found — that could help an attacker figure
        // out which hidden categories exist. Instead:
        return nothingFound
      }
    }

    lazy val catOrRootCat = anyCategory getOrElse {
      val rootCats = dao.getRootCategories()
      throwUnimplementedIf(rootCats.length >= 2, "TyE0450WKTD")  // [subcomms]
      rootCats.headOption getOrElse {
        return nothingFound
      }
    }

    // Site origin.  Dupl code [603RKDJL5]
    val siteIdsOrigins = dao.theSiteIdsOrigins()
    val avatarUrlPrefix =
          siteIdsOrigins.uploadsOrigin +
           talkyard.server.UploadsUrlBasePath + siteIdsOrigins.pubId + '/'

    listWhat match {
      case Events =>
        // Maybe break out to own fn?  Dao.loadEvents()?  [load_events_fn]
        val events: ImmSeq[Event] = dao.readTx { tx =>
          val limit = limitMax100 getOrElse 33
          val newestFirst = parseOptSt(listQueryJson, "sortOrder").getOrElse("") match {
            case "NewestFirst" => true
            case "OldestFirst" => false
            case _ =>
              ( // 1) If pat wants events up to a date, hen probably wants those closest to
                // that date, meaning, set newestFirst to true.
                olderOrAt.isDefined || {
                  // 2) But if pat wants events *after* a date, hen probably wants the *oldest*
                  // ones after that date — since they're closest to that date.
                  // 3) If nothing specified, the most recent events are probably more relevant,
                  // that is, make newestFirst true.
                  val wantOldestFirst = newerOrAt.isDefined
                  !wantOldestFirst
                })
          }
          val auditLogItems: ImmSeq[AuditLogEntry] =
                tx.loadEventsFromAuditLog(newerOrAt = newerOrAt, olderOrAt = olderOrAt,
                      limit = limit, newestFirst = newestFirst)
          // Hmm, might yield an empty list, if all events are of the wrong types
          // (then, fromAuditLogItem() returns None).
          auditLogItems.flatMap(Event.fromAuditLogItem)
        }
        val eventsJson = EventsParSer.makeEventsListJson(
              events, dao, reqer = requester, avatarUrlPrefix = avatarUrlPrefix, authzCtx)

        // Typescript: SearchQueryResults, and ListQueryResults
        controllers.Utils.OkApiJson(Json.obj(
            "origin" -> siteIdsOrigins.siteOrigin,
            "thingsFound" -> eventsJson.map(_.json)), pretty)

      case Pages =>
        val pageQuery = PageQuery(pageSortOrder,
              PageFilter(PageFilterType.AllTopics, includeDeleted = false),
              includeAboutCategoryPages = false)

        // Just for now: get some more topics, if we're filtering, so less
        // likely we'll get 0 back.
        SHOULD; UX; REMINDER // 2021-05-01 Move limit to API param + SQL query.
        val limit = (isAuthorWaitingFilter.isDefined
              || isOpenFilter.isDefined || pageTypeFilter.nonEmpty) ? 62 | 18


        val anyCatsCanSee: Opt[debiki.dao.CatsCanSee] =
              dao.listMaySeeCategoriesInSameSectionAs(catOrRootCat.id, authzCtx,
              // An admin needs to undelete a deleted category, for the API
              // to include it in the responses. (Over complicated with HTTP request
              // params that specifies if to include or not?)
              inclDeleted = false)
        val catsCanSee = anyCatsCanSee getOrElse {
          return nothingFound
        }

        val topicsUnfiltered: PagesCanSee =
              dao.listPagesCanSeeInCatsCanSee(
                  catsCanSee, pageQuery, inclPinned = true, limit = limit,
                  inSubTree = Some(catOrRootCat.id))

        // For simplicity, just this for now:
        val topicsFiltered: PagesCanSee = topicsUnfiltered filter { topic =>
          if (isOpenFilter.isSomethingButNot(topic.meta.isOpen)) false
          // else if (isAuthorWaitingFilter.isSomethingButNot(
          //       topic.meta.isAuthorWaiting)) false
          else if (pageTypeFilter.nonEmpty
                && !pageTypeFilter.contains(topic.pageType)) false
          else true
        }

        ThingsFoundJson.makePagesFoundListResponse(
              topicsFiltered, dao, JsonConf.v0_0(pretty = pretty), authzCtx)

      case Posts =>
        val result: LoadPostsResult = dao.loadPostsMaySeeByQuery(PostQuery.AllPosts(
              reqrInf, orderBy = OrderBy.MostRecentFirst, limit = 25,
              // API consumers probably want only approved posts. [4946RKTT2]
              inclUnapproved = false,
              // But they do want unlisted post, probably? Only if is staff.
              inclUnlistedPagePosts = requester.map(_.isStaff) is true,
              // Or maybe not include title posts? The fact that titles are posts, is an
              // implementation detail? Not impossible this'll change, and there'll
              // be a posts3 title field, instead. [DONTLISTTTL]
              inclTitles = true, onlyEmbComments = false,
              ))

        PostsListFoundJson.makePostsListFoundResponse(result, dao,
              JsonConf.v0_0(pretty = pretty), authzCtx)

      case _ =>
        die("TyE502AKTUDT5", s"listWhat: $listWhat")
    }
  }

}



