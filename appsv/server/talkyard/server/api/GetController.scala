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
import debiki.RateLimits
import ed.server.http._
import talkyard.server.authz.MayMaybe
import debiki.EdHttp._
import Prelude._
import debiki.dao.{LoadPostsResult, PageStuff, SiteDao}
import ed.server.{EdContext, EdController}
import javax.inject.Inject
import play.api.libs.json.{JsObject, JsValue, JsArray, Json}
import play.api.mvc.{Action, ControllerComponents, Result}
import talkyard.server.JsX
import org.scalactic.{Bad, ErrorMessage, Good, Or}


/** The ListQuery API, see: (project root)/tests/e2e/pub-api.ts
  */
class GetController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {



  def apiV0_get(): Action[JsValue] = PostJsonAction(  // [PUB_API]
          RateLimits.ReadsFromDb, maxBytes = 2000) { request: JsonPostRequest =>
    getThingsImpl(request)
  }


  private def getThingsImpl(request: JsonPostRequest): Result = {
    import request.body
    val pretty = (body \ "pretty").asOpt[Bo].getOrElse(false)
    val getQueryJson = (body \ "getQuery").as[JsObject]
    val anyGetWhat = (getQueryJson \ "getWhat").asOpt[Ref]
    throwUnimplementedIf(anyGetWhat.isNot("Pages"),
          "TyE2R502MWD", "Can only get pages as of now; 'getWhat' must be 'Pages'")
    val refs = (getQueryJson \ "getRefs").asOpt[Seq[Ref]] getOrElse Nil
    getPagesImpl(request, refs, pretty = pretty)
  }


  private def getPagesImpl(request: JsonPostRequest, pageRefs: Seq[Ref], pretty: Bo)
          : Result = {
    import request.{dao, requester}

    val authzCtx = dao.getForumAuthzContext(requester)

    throwUnimplementedIf(pageRefs.size > 50,
          "TyE603MRT4", "Currently at most 50 at a time")

    def notFoundMsg(embUrl: St, pageId: PageId = NoPageId): St = {
      s"No page with that embedding url or discussion id: $embUrl"
    }

    type PageRefAndId = (St, PageId)
    val refsAndIds: Seq[PageRefAndId Or ErrMsg] = pageRefs map { rawRef: St =>
      parseRef(rawRef, allowParticipantRef = false) flatMap {
        case parsedRef @ (_: ParsedRef.DiscussionId | _: ParsedRef.EmbeddingUrl) =>
          val anyPageId: Opt[PageId] = dao.getRealPageIdByDiidOrEmbUrl(parsedRef)
          anyPageId match {
            case Some(id) => Good((rawRef, id))
            case None => Bad(notFoundMsg(rawRef))
          }
        case _ =>
          Bad(s"Not an embedding url or discussion id: $rawRef [TyE0EMBURLORDIID]")
      }
    }

    val topicsOrErrs = refsAndIds map { refAndIdOrErr =>
      refAndIdOrErr flatMap {
        case (rawRef: St, pageId) => dao.getPagePathAndMeta(pageId) match {
          case Some(page: PagePathAndMeta) =>
            COULD_OPTIMIZE // will typically always be same cat, for emb cmts.
            val categories = dao.getAncestorCategoriesRootLast(page.categoryId)
            val may = talkyard.server.authz.Authz.maySeePage(
                  page.meta,
                  user = authzCtx.requester,
                  groupIds = authzCtx.groupIdsUserIdFirst,
                  pageMembers = Set.empty, // getAnyPrivateGroupTalkMembers(page.meta),
                  catsRootLast = categories,
                  tooManyPermissions = authzCtx.tooManyPermissions,
                  // Embedded discussion topics are typically unlisted.
                  maySeeUnlisted = true)
           if (may == MayMaybe.Yes) Good(page)
           else Bad(notFoundMsg(rawRef))  // or if dev/test: s"Cannot find page $pageId"
          case None =>
            Bad(notFoundMsg(rawRef))      // ... here too?  + err code
        }
      }
    }

    // Later, reuse?:
    // ThingsFoundJson.makePagesFoundListResponse(topicsOrErrs, dao, pretty)
    // For now:
    // Typescript: SearchQueryResults, and ListQueryResults
    val siteIdsOrigins = dao.theSiteIdsOrigins()
    OkApiJson(Json.obj(
          "origin" -> siteIdsOrigins.siteOrigin,
          "thingsOrErrs" -> JsArray(
            topicsOrErrs.map({
              case Good(pagePathAndMeta) =>
                Json.obj(
                    "numOpDoItVotes" -> pagePathAndMeta.meta.numOrigPostDoItVotes,
                    "numOpDoNotVotes" -> pagePathAndMeta.meta.numOrigPostDoNotVotes,
                    "numOpLikeVotes" -> pagePathAndMeta.meta.numOrigPostLikeVotes,
                    "numTotRepliesVisible" -> pagePathAndMeta.meta.numRepliesVisible)
              case Bad(errMsg) =>
                Json.obj("errMsg" -> errMsg, "errCode" -> "TyEPGNF")
            }))
          ), pretty)
  }

}



