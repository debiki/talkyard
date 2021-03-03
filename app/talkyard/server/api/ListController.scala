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
import ed.server.http._
import debiki.EdHttp._
import Prelude._
import debiki.dao.{LoadPostsResult, PageStuff, SiteDao}
import ed.server.{EdContext, EdController}
import javax.inject.Inject
import play.api.libs.json.{JsObject, JsValue, Json}
import play.api.mvc.{Action, ControllerComponents, Result}
import talkyard.server.JsX
import debiki.JsonUtils._


/** The ListQuery API, see: (project root)/tests/e2e/pub-api.ts
  */
class ListController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {



  def listThingsPubApi(): Action[JsValue] = PostJsonAction(  // [PUB_API]
          RateLimits.ReadsFromDb, maxBytes = 2000) { request: JsonPostRequest =>
    listThingsPubApiImpl(request)
  }


  def listThingsPubApiImpl(request: JsonPostRequest): Result = {
    import request.{body, dao, requester}

    val pretty = (body \ "pretty").asOpt[Bo].getOrElse(false)
    val listQueryJson = (body \ "listQuery").as[JsObject]

    val listWhat = (listQueryJson \ "listWhat").asOpt[St].getOrElse(
          (listQueryJson \ "findWhat").as[St])  ; DEPRECATED
    val Pages = "Pages"
    val Posts = "Posts"

    throwUnimplementedIf(listWhat != Pages && listWhat != Posts,
      "TyE3056KTM7", "'listWhat' must be 'Pages' or 'Posts' right now")

    val lookWhere = (listQueryJson \ "lookWhere").asOpt[JsObject]

    val lookInWhichCategories: Seq[Ref] =
      if (lookWhere.isEmpty) Nil
      else (lookWhere.get \ "inCategories").asOpt[Seq[Ref]] getOrElse Nil

    throwUnimplementedIf(lookInWhichCategories.size >= 2,
      "TyE205KDT53", "Currently at most one lookWhere.inCategories can be specified")

    val anyCategoryRef = lookInWhichCategories.headOption

    val anyFilter = (listQueryJson \ "filter").asOpt[JsObject]

    throwUnimplementedIf(anyFilter.isDefined && listWhat == Posts,
          "TyE603MRD4", "No filters implemented for posts")

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

    //val limit = parseOptI32(listQueryJson, "limit")

    def nothingFound = ThingsFoundJson.makePagesFoundListResponse(Nil, dao, pretty)

    val anyCategory: Option[Category] = anyCategoryRef map { catRef =>
      val parsedRef = parseRef(catRef, allowParticipantRef = false) getOrIfBad { problem =>
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

    lazy val authzCtx = dao.getForumAuthzContext(requester)

    listWhat match {
      case Pages =>
        val pageQuery = PageQuery(pageSortOrder,
              PageFilter(PageFilterType.AllTopics, includeDeleted = false),
              includeAboutCategoryPages = false)

        // Just for now: get some more topics, if we're filtering, so less
        // likely we'll get 0 back.
        SHOULD; UX; REMINDER // 2021-05-01 Move limit to API param + SQL query.
        val limit = (isAuthorWaitingFilter.isDefined
              || isOpenFilter.isDefined || pageTypeFilter.nonEmpty) ? 62 | 18

        var topics = dao.listMaySeeTopicsInclPinned(catOrRootCat.id, pageQuery,
              includeDescendantCategories = true, authzCtx, limit = limit)

        // For simplicity, just this for now:
        topics = topics filter { topic =>
          if (isOpenFilter.isSomethingButNot(topic.meta.isOpen)) false
          // else if (isAuthorWaitingFilter.isSomethingButNot(
          //       topic.meta.isAuthorWaiting)) false
          else if (pageTypeFilter.nonEmpty
                && !pageTypeFilter.contains(topic.pageType)) false
          else true
        }

        ThingsFoundJson.makePagesFoundListResponse(topics, dao, pretty)

      case Posts =>
        val result: LoadPostsResult = dao.loadPostsMaySeeByQuery(
              requester, OrderBy.MostRecentFirst, limit = 25,
              // API consumers probably want only approved posts. [4946RKTT2]
              inclUnapprovedPosts = false,
              // But they do want unlisted post, probably? Only if is staff.
              inclUnlistedPagePosts = requester.map(_.isStaff) is true,
              // Or maybe not include title posts? The fact that titles are posts, is an
              // implementation detail? Not impossible this'll change, and there'll
              // be a posts3 title field, instead. [DONTLISTTTL]
              inclTitles = true, onlyEmbComments = false,
              writtenById = None)

        PostsListFoundJson.makePostsListFoundResponse(result, dao, pretty)

      case _ =>
        die("TyE502AKTUDT5", s"listWhat: $listWhat")
    }
  }

}



