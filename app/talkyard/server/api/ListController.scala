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


/** The ListQuery API, see: (project root)/tests/e2e/pub-api.ts
  */
class ListController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {



  def listThingsPubApi(): Action[JsValue] = PostJsonAction(  // [PUB_API]
          RateLimits.ReadsFromDb, maxBytes = 200) { request: JsonPostRequest =>
    listThingsPubApiImpl(request)
  }


  def listThingsPubApiImpl(request: JsonPostRequest): Result = {
    import request.{body, dao, requester}

    val pretty = (body \ "pretty").asOpt[Boolean].getOrElse(false)
    val listQueryJson = (body \ "listQuery").as[JsObject]

    val findWhat = (listQueryJson \ "findWhat").as[String]
    val Pages = "Pages"
    val Posts = "Posts"

    throwUnimplementedIf(findWhat != Pages && findWhat != Posts,
      "TyE3056KTM7", "'findWhat' must be 'Pages' or 'Posts' right now")

    val lookWhere = (listQueryJson \ "lookWhere").asOpt[JsObject]

    val lookInWhichPages: Seq[Ref] =
      if (lookWhere.isEmpty) Nil
      else (lookWhere.get \ "inPages").asOpt[Seq[Ref]] getOrElse Nil

    val lookInWhichCategories: Seq[Ref] =
      if (lookWhere.isEmpty) Nil
      else (lookWhere.get \ "inCategories").asOpt[Seq[Ref]] getOrElse Nil

    throwUnimplementedIf(lookInWhichCategories.size >= 2,
      "TyE205KDT53", "Currently at most one lookWhere.inCategories can be specified")

    throwUnimplementedIf(lookInWhichCategories.nonEmpty && lookInWhichPages.nonEmpty,
      "TyE205KDT55", "Currently cannot search pages and categories at the same time")

    val anyCategoryRef = lookInWhichCategories.headOption

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

    val authzCtx = dao.getForumAuthzContext(requester)

    findWhat match {
      case Pages if lookInWhichPages.nonEmpty =>

        val topics = lookInWhichPages.flatMap(dao.getPagePathAndMeta)
        ThingsFoundJson.makePagesFoundListResponse(topics, dao, pretty)

      case Pages if lookInWhichPages.isEmpty =>

        val catOrRootCat = anyCategory getOrElse {
          val rootCats = dao.getRootCategories()
          throwUnimplementedIf(rootCats.length >= 2, "TyE0450WKTD")  // [subcats]
          rootCats.headOption getOrElse {
            return nothingFound
          }
        }

        val pageQuery = PageQuery(
              // Score and bump time, if nothing else specified. [TyT025WKRGJ]
              PageOrderOffset.ByScoreAndBumpTime(offset = None, TopTopicsPeriod.Week),
              PageFilter(PageFilterType.AllTopics, includeDeleted = false),
              includeAboutCategoryPages = false)

        val topics = dao.listMaySeeTopicsInclPinned(catOrRootCat.id, pageQuery,
              includeDescendantCategories = true, authzCtx, limit = 12)

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
        die("TyE502AKTUDT5", s"findWhat: $findWhat")
    }
  }

}



