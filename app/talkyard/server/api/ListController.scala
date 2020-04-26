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
import debiki.dao.{PageStuff, SiteDao}
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
    import request.{body, dao}

    val pretty = (body \ "pretty").asOpt[Boolean].getOrElse(false)
    val listQueryJson = (body \ "listQuery").as[JsObject]

    val findWhat = (listQueryJson \ "findWhat").as[String]
    throwUnimplementedIf(findWhat != "Pages",
      "TyE3056KTM7", "'findWhat' must be 'pages' right now")

    val lookWhere = (listQueryJson \ "lookWhere").asOpt[JsObject]

    val lookInWhichCategories: Seq[Ref] =
      if (lookWhere.isEmpty) Nil
      else (lookWhere.get \ "inCategories").asOpt[Seq[Ref]] getOrElse Nil

    throwUnimplementedIf(lookInWhichCategories.size >= 2,
      "TyE205KDT53", "Currently at most one lookWhere.inCategories can be specified")

    val categoryRef = lookInWhichCategories.headOption getOrElse {
      throwNotImplemented(
        "TyE205KDT56", "Currently lookWhere.inCategories needs to be one category")
    }

    val parsedCatRef = com.debiki.core.parseRef(
          categoryRef, allowParticipantRef = false) getOrIfBad { problem =>
      throwForbidden("TyE603KSJL3", s"Bad category ref: $problem")
    }

    val category = dao.getCategoryByParsedRef(parsedCatRef) getOrElse {
      // Don't return any Not Found — that could help an attacker figure
      // out which hidden categories exist. Instead:
      return ThingsFoundJson.makePagesFoundListResponse(Nil, dao, pretty)
    }

    // Public API, no authentication needed.
    val authzCtx = dao.getForumPublicAuthzContext()
    val pageQuery = PageQuery(
      // Score and bump time, if nothing else specified. [TyT025WKRGJ]
      PageOrderOffset.ByScoreAndBumpTime(offset = None, TopTopicsPeriod.Week),
      PageFilter(PageFilterType.AllTopics, includeDeleted = false),
      includeAboutCategoryPages = false)

    val topics = dao.listMaySeeTopicsInclPinned(category.id, pageQuery,
      includeDescendantCategories = true, authzCtx, limit = 12)

    ThingsFoundJson.makePagesFoundListResponse(topics, dao, pretty)
  }

}



