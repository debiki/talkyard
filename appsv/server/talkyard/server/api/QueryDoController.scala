/**
 * Copyright (c) 2021 Kaj Magnus Lindberg
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
import debiki.EdHttp._
import debiki.JsonUtils._
import Prelude._
import debiki.dao.SiteDao
import ed.server.{EdContext, EdController}
import javax.inject.Inject
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents, Result}


/** The Query API, Do API and Query-Do API, see: tests/e2e-wdio7/pub-api.ts
  */
class QueryDoController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {


  def apiV0_query(): Action[JsValue] = ApiSecretPostJsonAction(  // [PUB_API]
          RateLimits.ReadsFromDb, maxBytes = 2000) { request: JsonPostRequest =>
    queryDoImpl(request, queryOnly = true)
  }


  def apiV0_do(): Action[JsValue] = ApiSecretPostJsonAction(  // [PUB_API]
          // For now, may do just a few things. [do_api_limits]
          RateLimits.UpsertFew, maxBytes = 2000) { request: JsonPostRequest =>
    queryDoImpl(request, doOnly = true)
  }


  def apiV0_queryDo(): Action[JsValue] = ApiSecretPostJsonAction(  // [PUB_API]
          // Just a few things only. [do_api_limits]
          RateLimits.UpsertFew, maxBytes = 2000) { request: JsonPostRequest =>
    queryDoImpl(request)
  }


  private def queryDoImpl(request: JsonPostRequest, doOnly: Bo = false,
        queryOnly: Bo = false): Result = {
    import request.{body, dao}
    val pretty = parseOptBo(body, "pretty")
    val mainField =
          if (doOnly) "doActions"
          else if (queryOnly) "manyQueries"
          else "queriesAndActions"

    val taskJsValList: Seq[JsValue] = parseJsArray(body, mainField)
    var itemNr = -1

    // [do_api_limits]
    throwForbiddenIf(taskJsValList.length > 5, "TyEAPI2MNYTSKS",
          "Too many API tasks — at most 5, for now")

    val tasks: Seq[ApiTask] = taskJsValList map { jsVal =>
      itemNr += 1
      val jsOb = asJsObject(jsVal, s"$mainField list item")
      val doWhatSt = parseOptSt(jsOb, "doWhat")
      val getQueryJsOb = parseOptJsObject(jsOb, "getQuery")
      val listQueryJsOb = parseOptJsObject(jsOb, "listQuery")
      val searchQueryJsOb = parseOptJsObject(jsOb, "searchQuery")
      // Any nested queries or actions? (E.g. for fine grained transaction control.)
      val nestedQueries: Opt[JsArray] = parseOptJsArray(jsVal, "manyQueries")
      val nestedActions: Opt[JsArray] = parseOptJsArray(jsVal, "doActions")

      val anyQueryDefined =
            getQueryJsOb.isDefined || listQueryJsOb.isDefined ||
            searchQueryJsOb.isDefined || nestedQueries.isDefined

      val anyActionDefined =
            doWhatSt.isDefined || nestedActions.isDefined

      val anyNestedQueriesActions  =
            nestedQueries.isDefined || nestedActions.isDefined

      throwForbiddenIf(doOnly && anyQueryDefined,
            "TyEWRONGENDP1", o"""Cannot run queries via the Do API /-/v0/do.
               Use  /-/v0/query  or  /-/v0/query-do  instead""")

      throwForbiddenIf(queryOnly && anyActionDefined,
            "TyEWRONGENDP2", o"""Cannot do actions via the Query API /-/v0/query.
               Use  /-/v0/do  or  /-/v0/query-do  instead""")

      throwUnimplementedIf(anyQueryDefined,
            "TyEQUERYUNIMPL", "Not implemented:  /-/v0/query  and  /-/v0/query-do")

      throwUnimplementedIf(anyNestedQueriesActions,
            "TyEQUERYUNIMPL2", o"""Not implemented:  /-/v0/query-do
                  and nested queries or actions""")

      def whatItem = s"Item nr $itemNr in the $mainField list (zero indexed)"

      val queryOrAction = {
        if (doWhatSt.isDefined) {
          ActionParser(dao).parseAction(doWhatSt.get, jsOb) getOrIfBad { problem =>
            throwBadReq("TyEAPIACTN", s"$whatItem is a bad action: $problem")
          }
        } /*
        else if (getQueryJsOb.isDefined) {
          parseGetQuery(jsOb)
        }
        else if (listQueryJsOb.isDefined) {
          parseLitQuery(jsOb)
        }
        else if (searchQueryJsOb.isDefined) {
          parseSearchQuery(jsOb)
        } */
        else {
          throwForbidden("TyEAPIUNKTASK", o"""$whatItem has no doWhat, getQuery,
                listQuery, searchQuery, manyQueries or doActions field""")
        }
      }

      queryOrAction
    }

    val results = queryAndDo(tasks, dao, request.reqrId)

    OkApiJson(Json.obj(
          "results" -> JsArray(results)))
  }


  private def queryAndDo(tasks: Seq[ApiTask], dao: SiteDao, reqerId: ReqrId)
          : Seq[JsObject] = {
    var itemNr = -1
    val actionDoer = ActionDoer(dao, reqerId)  // later: singleTransaction = true
    tasks map { task =>
      itemNr += 1
      task match {
        case a: ApiAction =>
          // Later:  actionDoer.startTransactionIfNotDone
          actionDoer.doAction(a) match {
            case p: Problem =>  // (message, siteId, adminInfo, debugInfo, anyException)
              // For now, just abort everything.
              throwBadReq("TyEAPIERR", s"Error doing ${a.doWhat.toString} action: ${
                    p.message}")
            case Fine =>
              Json.obj("ok" -> JsTrue)
          }
      }
    }

    // Later:  actionDoer.tryCommitAnyTransaction
    //
    // Or is there any  using(ActionDoer) { ... }  that auto closes it?
  }

}



