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
import talkyard.server.http._
import debiki.EdHttp._
import debiki.JsonUtils._
import Prelude._
import debiki.dao.SiteDao
import talkyard.server.{TyContext, TyController}
import talkyard.server.security.WhatApiSecret
import javax.inject.Inject
import play.api.libs.json._
import play.api.mvc.{Action, ControllerComponents, Result}
import org.scalactic.{Good, Or, Bad}


/** The Query API, Do API and Query-Do API, see: tests/e2e-wdio7/pub-api.ts
  */
class QueryDoController @Inject()(cc: ControllerComponents, tyContext: TyContext)
  extends TyController(cc, tyContext) {


  def apiV0_query(): Action[JsValue] = ApiSecretPostJsonAction(  // [PUB_API]
          WhatApiSecret.SiteSecret, RateLimits.ReadsFromDb, maxBytes = 2000,
          ) { req: JsonPostRequest =>
    queryDoImpl(req, queryOnly = true)
  }


  def apiV0_do(): Action[JsValue] = ApiSecretPostJsonAction(  // [PUB_API]
          // For now, may do just a few things. [do_api_limits]
          WhatApiSecret.SiteSecret, RateLimits.UpsertFew, maxBytes = 2000,
          ) { req: JsonPostRequest =>
    queryDoImpl(req, doOnly = true)
  }


  def apiV0_queryDo(): Action[JsValue] = ApiSecretPostJsonAction(  // [PUB_API]
          // Just a few things only. [do_api_limits]
          WhatApiSecret.SiteSecret, RateLimits.UpsertFew, maxBytes = 2000) {
          req: JsonPostRequest =>
    queryDoImpl(req)
  }


  private def queryDoImpl(request: JsonPostRequest, doOnly: Bo = false,
        queryOnly: Bo = false): Result = {
    import request.{body, dao}
    val pretty = parseOptBo(body, "pretty")
    val (mainField, altName) =
          if (doOnly) ("doActions", "")
          else if (queryOnly) ("runQueries", "manyQueries")
          else ("queriesAndActions", "")

    // See [api_do_as] in ../../../../../docs/ty-security.adoc .
    // But there's also:  UserDao._editMemberThrowUnlessSelfStaff — which does
    // similar checks. Maybe reuse that fn instead?
    // If changing this, review & fix:  [vote_as_otr] & [do_as_otr]  first.
    val mayDoOnlyAs: Opt[Pat] =
          if (request.theReqer.isSysbot) None  // No restriction. (Or .isAdmin instead?)
          else Some(request.theReqer)  // Some restriction: This user only

    val taskJsValList: Seq[JsValue] = parseJsArray(body, mainField, altName = altName)
    var itemNr = 0

    // [do_api_limits]
    throwForbiddenIf(taskJsValList.length > 7, "TyEAPI2MNYTSKS",
          "Too many API tasks — at most 7, for now")

    val tasks: Seq[ApiTask] = taskJsValList map { jsVal =>
      itemNr += 1
      val jsOb = asJsObject(jsVal, s"$mainField list item")
      val doWhatSt = parseOptSt(jsOb, "doWhat")
      val getQueryJsOb = parseOptJsObject(jsOb, "getQuery")
      val listQueryJsOb = parseOptJsObject(jsOb, "listQuery")
      val searchQueryJsOb = parseOptJsObject(jsOb, "searchQuery")
      // Any nested queries or actions? (E.g. for fine grained transaction control.)
      val nestedQueries: Opt[IndexedSeq[JsValue]] = parseOptJsArray(jsVal, "runQueries", altName = "manyQueries")
      val nestedActions: Opt[IndexedSeq[JsValue]] = parseOptJsArray(jsVal, "doActions")

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

      def whatItem = s"Item nr $itemNr in the $mainField list"

      val queryOrAction: ApiAction = {
        val parser = ActionParser(dao, mayDoOnlyAs = mayDoOnlyAs, IfBadAbortReq)
        if (doWhatSt.isDefined) {
          parser.parseAction(doWhatSt.get, jsOb) getOrIfBad { msg =>
            throwBadReq("TyEAPIACTN", s"$whatItem of type ${doWhatSt.get} is a bad action: $msg")
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

      // Hmm, dupl check. The other one allows Sysbot only, oh well. [api_do_as]
      if (queryOrAction.asWho.id != request.theReqer.id) {
        throwForbiddenIf(!request.theReqer.isAdmin,
              "TyEDOA_DOASOTHR", "Only Sysbot and admins may do things on behalf of others")
      }

      queryOrAction
    }

    val results = queryAndDo(tasks, dao, request.reqrInf)

    OkApiJson(Json.obj(
          "results" -> JsArray(results)))
  }


  private def queryAndDo(tasks: Seq[ApiTask], dao: SiteDao, reqrInf: ReqrInf)
          : Seq[JsObject] = {
    var itemNr = 0
    val actionDoer = ActionDoer(dao, reqrInf, IfBadAbortReq)  // later: singleTransaction = true
    tasks map { task =>
      itemNr += 1
      task match {
        case a: ApiAction =>
          // Later:  actionDoer.startTransactionIfNotDone
          actionDoer.doAction(a) match {
            case Bad(msg) =>  // (message, siteId, adminInfo, debugInfo, anyException)
              // For now, just abort everything.
              throwBadReq("TyEAPIERR", s"Error doing task nr $itemNr, ${
                                                        a.doWhat.toString}: $msg")
            case Good(jsOb) =>
              Json.obj("ok" -> JsTrue, "res" -> jsOb)
          }
      }
    }

    // Later:  actionDoer.tryCommitAnyTransaction
    //
    // Or is there any  using(ActionDoer) { ... }  that auto closes it?
  }

}



