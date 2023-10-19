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
import debiki.dao.PagesCanSee
import talkyard.server.api.ThingsFoundJson.PageFoundStuff
import talkyard.server.http._
import talkyard.server.authz.MayMaybe
import talkyard.server.parser.JsonConf
import debiki.EdHttp._
import Prelude._
import talkyard.server.{TyContext, TyController}
import javax.inject.Inject
import play.api.libs.json.{JsValue, JsArray, JsObject, Json}
import play.api.mvc.{Action, ControllerComponents, Result}
import org.scalactic.{Bad, Good, Or}


/** The ListQuery API, see: (project root)/tests/e2e/pub-api.ts
  */
class GetController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {



  def apiV0_get(): Action[JsValue] = PostJsonAction(  // [PUB_API]
          RateLimits.ReadsFromDb, maxBytes = 2000) { request: JsonPostRequest =>
    getThingsImpl(request)
  }


  private def getThingsImpl(req: JsonPostRequest): Result = {
    import debiki.JsonUtils._
    val body = asJsObject(req.body, "The request body")
    val pretty = parseOptBo(body, "pretty") getOrElse false
    val getQueryJson = parseJsObject(body, "getQuery")
    val getWhat: RawRef = parseSt(getQueryJson, "getWhat")

    val refsArr = parseOptJsArray(getQueryJson, "getRefs") getOrElse Nil
    val refs = refsArr.map(asString(_, "getRefs list item"))

    // There's an O(n^2) loop, and db queries, let's set a max length. [get_req_max_items].
    throwBadReqIf(refs.size > 50,
          "TyE603MRT4", "Currently you can include at most 50 refs")

    // Later: Look at  inclFields: { ... } to find out what info to include about
    // the things requested. See:  interface GetPagesQuery  in  pub-api.ts  [get_what_fields]

    val thingsOrErrsJsArr = getWhat match {
      case "Pages" =>
        // Currently allowed, so blog comment Like vote counts can be shown.
        getPagesImpl(req, refs, pretty = pretty)

      case "Posts" =>
        throwUnimpl("Getting posts hasn'b been implemenetd [TyE02MSRD37]")

      case "Pats" =>
        // For now.  [get_pat_api_secr]
        // In private communities, names are private, so it's simpler to just
        // disallow these requests always, unless there's an API secret.
        throwForbiddenIf(!req.isViaApiSecret, "TyE0APISECR_", "API secret missing")

        GetPatsImpl.getPats(req, getQueryJson, refs) getOrIfBad { problem =>
          return BadReqResult("TyEGETPATS", problem)
        }
      case _ =>
        throwBadReq("TyE2R502MWD", "Bad 'getWhat', must be one of: 'Pages', 'Posts', 'Pats'")
    }

    val siteIdsOrigins = req.dao.theSiteIdsOrigins()
    OkApiJson(Json.obj(
          "origin" -> siteIdsOrigins.siteOrigin,
          "thingsOrErrs" -> thingsOrErrsJsArr,
          ), pretty)
  }


  // Break out to file  GetPagesImpl? Like GetPatsImpl, see above.
  private def getPagesImpl(request: JsonPostRequest, pageRefs: Seq[Ref], pretty: Bo)
          : JsArray = {
    import request.{dao, requester}

    val authzCtx = dao.getForumAuthzContext(requester)

    dieIf(pageRefs.length > 50, "TyE4MREJ703")

    def notFoundMsg(embUrl: St, pageId: PageId = NoPageId): ErrMsg = {
      s"No page with that embedding url or discussion id: $embUrl"
    }

    type PageRefAndId = (St, PageId)
    val refsAndIds: Seq[PageRefAndId Or ErrMsg] = pageRefs map { rawRef: St =>
      parseRef(rawRef, allowPatRef = false) flatMap {
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

    val topicsOrErrs: Seq[PagePathAndMeta Or ErrMsg]  = refsAndIds map { refAndIdOrErr =>
      refAndIdOrErr flatMap {
        case (rawRef: St, pageId) => dao.getPagePathAndMeta(pageId) match {
          case Some(page: PagePathAndMeta) =>
            COULD_OPTIMIZE // will typically always be same cat, for emb cmts.
            val categories = dao.getAncestorCategoriesRootLast(page.categoryId)
            val may = talkyard.server.authz.Authz.maySeePage(  // _access_control
                  page.meta,
                  user = authzCtx.requester,
                  groupIds = authzCtx.groupIdsUserIdFirst,
                  pageMembers = Set.empty, // getAnyPrivateGroupTalkMembers(page.meta),
                  catsRootLast = categories,
                  tooManyPermissions = authzCtx.tooManyPermissions,
                  // Embedded discussion topics are typically unlisted, so need to
                  // allow see-unlisted, for embedded comment counts to work.
                  // Also, getting by precise page ids, is not listing things.
                  maySeeUnlisted = true)
           if (may == MayMaybe.Yes) Good(page)
           else Bad(notFoundMsg(rawRef))  // or if dev/test: s"Cannot find page $pageId"
          case None =>
            Bad(notFoundMsg(rawRef))      // ... here too?  + err code
        }
      }
    }

    // Default:  extId, title, author, excerpt, orig post   ?
    // But currently the emb comments get and need only the below (num likes & votes), hmm.

    // If the request is via an API secret, then, the requester typically wants
    // lots of details about the page  (but not just vote counts, like when displaying
    // embedded comment votes).  If so, let's construct more detailed page json:
    val pagesJs: Seq[(PageFoundStuff, JsObject)] =
          if (!request.isViaApiSecret) Nil
          else {
            val pages: Seq[PagePathAndMeta] = topicsOrErrs collect { case Good(p) => p }
            ThingsFoundJson.makePagesJsArr(
                  // Already done _access_control.
                  PagesCanSee(pages.to[Vec]), dao, JsonConf.v0_1(), authzCtx)
          }

    var bugWarned = false
    val pageJsIter = pagesJs.iterator
    var cur: Opt[(PageFoundStuff, JsObject)] = None

    val thingsOrErrsJson = JsArray(
            topicsOrErrs.map({
              case Good(pagePathAndMeta) =>
                val jOb = Json.obj(
                    // NOTE: if adding anything more here, don't include that in
                    // responses to public API requests. But these are ok,
                    // for blog comments:
                    // Could allow only if page type is EmbeddedDiscussion?
                    "numOpDoItVotes" -> pagePathAndMeta.meta.numOrigPostDoItVotes,
                    "numOpDoNotVotes" -> pagePathAndMeta.meta.numOrigPostDoNotVotes,
                    "numOpLikeVotes" -> pagePathAndMeta.meta.numOrigPostLikeVotes,
                    "numTotRepliesVisible" -> pagePathAndMeta.meta.numRepliesVisible)
                // A bit messy, oh well. Can refactor later when know more.
                if (cur.isEmpty && pageJsIter.hasNext) {
                  cur = Some(pageJsIter.next())
                }
                cur match {
                  case None => jOb
                  case Some(stuffAndPageJs) =>
                    if (stuffAndPageJs._1.pageId != pagePathAndMeta.pageId) jOb else {
                      cur = None
                      jOb ++ stuffAndPageJs._2
                    }
                }
              case Bad(errMsg) =>
                Json.obj("errMsg" -> errMsg, "errCode" -> "TyEPGNF")
            }))
    thingsOrErrsJson
  }

}



