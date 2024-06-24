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
import play.api.libs.json.{JsValue, JsNumber, JsArray, JsObject, Json}
import play.api.mvc.{Action, ControllerComponents, Result}
import org.scalactic.{Bad, Good, Or}
import scala.collection.{mutable => mut}


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
    val inclFieldsJs: Opt[JsObject] = parseOptJsObject(getQueryJson, "inclFields")

    val refsArr = parseOptJsArray(getQueryJson, "getRefs") getOrElse Nil
    val refs = refsArr.map(asString(_, "getRefs list item"))

    // There's an O(n^2) loop, and db queries, let's set a max length. [get_req_max_items].
    throwBadReqIf(refs.size > 50,
          "TyE603MRT4", "Currently you can include at most 50 refs")

    val thingsOrErrsJsArr = getWhat match {
      case "Pages" =>
        getPagesImpl(req, refs, inclFieldsJs, pretty = pretty)

      case "Posts" =>
        throwUnimpl("Getting posts hasn'b been implemenetd [TyE02MSRD37]")

      case "Pats" =>
        // For now.  [get_pat_api_secr]
        // In private communities, names are private, so it's simpler to just
        // disallow these requests always, unless there's an API secret.
        throwForbiddenIf(!req.isViaApiSecret, "TyE0APISECR_", "API secret missing")

        GetPatsImpl.getPats(req, getQueryJson, refs, inclFieldsJs) getOrIfBad { problem =>
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
  private def getPagesImpl(request: JsonPostRequest, pageRefs: Seq[Ref],
          inclFieldsJs: Opt[JsObject], pretty: Bo)
          : JsArray = {
    import request.{dao, requester}

    val authzCtx = dao.getForumAuthzContext(requester)

    dieIf(pageRefs.length > 50, "TyE4MREJ703")

    def notFoundMsg(embUrl: St, pageId: PageId = NoPageId): ErrMsg = {
      s"No page with that embedding url or discussion id: $embUrl"
    }

    WOULD_OPTIMIZE // Look up PageStuff directly, if PageStuff is needed, instead
    // of first looking up PageMeta and then PageStuff later?  [_lookup_stuff]

    type PageRefAndId = (St, PageId)
    val refsAndIds: Seq[PageRefAndId Or ErrMsg] = pageRefs map { rawRef: St =>
      parseRef(rawRef, allowPatRef = false) flatMap {
        case r @ (_: ParsedRef.DiscussionId | _: ParsedRef.EmbeddingUrl |
                  _: ParsedRef.TalkyardId | _: ParsedRef.PageId) =>
          val anyPageId: Opt[PageId] = dao.getRealPageIdByDiidOrEmbUrl(r)
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
        case (rawRef: St, pageId) => dao.getPagePathAndMeta(pageId) match {  // [_lookup_stuff]
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
    val inclFields: InclPageFields =
          inclFieldsJs.map(InclFieldsParSer.parsePageFields) getOrElse {
            // If there's no API secret, then, the browser is likely showing blog comment
            // reply & Like vote counts —  so let's include those fields.
            // Don't remove anything! That'd be a major API version bump.
            // (We've done _access_control already.)
            if (request.isViaApiSecret) InclPageFields.Default
            else InclPageFields.DefaultForBlogComments
          }

    // If the request is via an API secret, then, the requester typically wants
    // lots of details about the page  (but not just vote counts, like when displaying
    // embedded comment votes).  If so, let's construct more detailed page json:
    val pagesJs: Seq[(PageFoundStuff, JsObject)] =
          if (!request.isViaApiSecret) Nil
          else {
            val pages: Seq[PagePathAndMeta] = topicsOrErrs collect { case Good(p) => p }
            // (This looks up PageStuff, which includes PageMeta already looked
            // up above. A tiny bit inefficient. [_lookup_stuff])
            ThingsFoundJson.makePagesJsArr(
                  // Already done _access_control.
                  PagesCanSee(pages.to(Vec)), dao, inclFields, JsonConf.v0_1(), authzCtx)
          }

    val pageJsIter = pagesJs.iterator
    var cur: Opt[(PageFoundStuff, JsObject)] = None

    val thingsOrErrsJson = JsArray(
            topicsOrErrs.map({
              case Good(pagePathAndMeta: PagePathAndMeta) =>
                var jOb = Json.obj()
                val page = pagePathAndMeta.meta

                if (inclFields.numOpDoItVotes)
                  jOb += "numOpDoItVotes" -> JsNumber(page.numOrigPostDoItVotes)

                if (inclFields.numOpDoNotVotes)
                  jOb += "numOpDoNotVotes" -> JsNumber(page.numOrigPostDoNotVotes)

                if (inclFields.numOpLikeVotes)
                  jOb += "numOpLikeVotes" -> JsNumber(page.numOrigPostLikeVotes)

                if (inclFields.numTotRepliesVisible)
                  jOb += "numTotRepliesVisible" -> JsNumber(page.numRepliesVisible)

                // A bit messy, oh well. Can refactor later when know more.
                if (cur.isEmpty && pageJsIter.hasNext) {
                  cur = Some(pageJsIter.next())
                }
                cur match {
                  case None =>
                    jOb
                  case Some(stuffAndPageJs) =>
                    if (stuffAndPageJs._1.pageId != pagePathAndMeta.pageId) {
                      // Can't happen? The map() loop we're in, and `pageJsIter`, both
                      // traverse topicsOrErrs in the same way & order.
                      dieIf(!context.globals.isProd, "TyE4FWMJC60G")
                      jOb
                    } else {
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



