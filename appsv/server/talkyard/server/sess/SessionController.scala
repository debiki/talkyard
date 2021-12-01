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

package talkyard.server.sess

import com.debiki.core._
import debiki.RateLimits
import debiki.dao.SiteDao
import debiki.EdHttp._
import ed.server.{EdContext, EdController}
import controllers.Utils.OkApiJson
import play.api.libs.json._
import javax.inject.Inject
import play.api.mvc.{Action, ControllerComponents}
import talkyard.server.JsX._
import debiki.JsonUtils._


class SessionController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {


  def listSessions(patId: PatId): Action[U] = GetAction { req =>
    import req.{dao, theRequester => reqer}
    throwForbiddenIfMayNot("view", dao, reqer, patId)
    val activeSessions = dao.listPatsSessions(patId)
    val json = Json.obj("sessions" -> JsArray(activeSessions.map(s => JsSession(s))))
    OkApiJson(json)
  }


  def terminateSessions: Action[JsValue] = PostJsonAction(RateLimits.ConfigUser,
        maxBytes = 2000) { req =>
    import req.{dao, theRequester => reqer}

    val body = asJsObject(req.body, "The request body")
    val forPatId = parseInt32(body, "forPatId")

    throwForbiddenIfMayNot("terminate", dao, reqer, forPatId)

    val terminateAllOthers: Bo = parseOptBo(body, "all") getOrElse false
    val allButNot = if (!terminateAllOthers) None else Some(req.tySession.createdAt)

    val sessionsStartedAtArr: Seq[JsValue] = parseOptJsArray(
          body, "sessionsStartedAt") getOrElse Nil

    val startTimesMs: Seq[When] = sessionsStartedAtArr map { jsVal =>
      When.fromMillis(asInt64(jsVal, "Session start date-time"))
    }

    throwBadReqIf(startTimesMs.nonEmpty && allButNot.isDefined, "TyE4MWJ0202",
          "Don't specify both 'all' and 'sessionsStartedAt'")

    throwBadReqIf(startTimesMs.isEmpty && allButNot.isEmpty, "TyE4MWJ0203",
          "Specify one of 'all' and 'sessionsStartedAt'")

    val terminatedSessions = dao.terminateSessions(
          forPatId, thoseStartedAt = startTimesMs, allButNot)

    val json = Json.obj(
        "terminatedSessions" -> JsArray(terminatedSessions.map(s => JsSession(s))))

    OkApiJson(json)
  }


  private def throwForbiddenIfMayNot(doWhat: St, dao: SiteDao, reqer: Pat, patId: PatId): U = {
    throwForbiddenIf(reqer.id != patId && !reqer.isStaff, "TyE0YOURSESS",
          s"Cannot $doWhat other people's sessions")
    val pat = dao.getTheParticipant(patId)
    throwForbiddenIf(pat.isAdmin && !reqer.isAdmin, "TyEADMINSESS_",
          s"Cannot $doWhat an admin's sessions")
  }

}

