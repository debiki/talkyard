/**
 * Copyright (c) 2022 Kaj Magnus Lindberg
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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

package talkyard.server.api

import com.debiki.core._
import com.debiki.core.Prelude._
import talkyard.server.http._
import play.api.libs.json.{JsObject, JsArray, Json}
import org.scalactic.{Bad, Good, Or}
import talkyard.server.parser.JsonConf


object GetPatsImpl {


  def getPats(req: JsonPostRequest, getQueryJson: JsObject, rawRefs: Seq[RawRef])
        : JsArray Or ErrMsg = {
    import req.{dao, reqer}

    //  O(n2) below; a max length should have bee checked by the caller. [get_req_max_items]
    dieIf(rawRefs.length > 50, "TyE4MREJ702")

    val patRefsOrErrs: Seq[PatRef Or ErrMsg] = rawRefs.map(parsePatRef)
    val patRefs = patRefsOrErrs.collect({ case gr: Good[PatRef] => gr.get })

    val authzCtx = dao.getAuthzContextOnPats(reqer)

    // Using ext ids and sso ids is only for API integrations — that is, for user sysbot,
    // and admins (for troubleshooting).
    patRefs foreach { ref =>
      if (!authzCtx.maySeeExtIds && ref.isSsoOrExtId) {
        return Bad(o"""Bad ref: '$ref', only admins and sysbot may get users via sso id
                or ext id. Did you forget to include a sysbot API secret?
                Or could you lookup via 'username:___' refs instead?""")
      }
    }

    // ----- Look up in database

    val members = req.dao.loadMembersVbMaySeeByRef(patRefs, authzCtx)

    // ----- Match pat to ref, same order

    val patsOrErrs: Seq[PatVb Or ErrMsg] = patRefsOrErrs map {
      case b: Bad[ErrMsg] => b
      case Good(ref: PatRef) =>
        ref.findMatchingPat(members) match {  // [On2] but max 50  [get_req_max_items]
          case None => Bad(s"Pat not found, ref: '$ref'")
          case Some(pat) =>
            if (pat.isMember) Good(pat)
            else {
              // Or is this an internal error? Log sth?
              // (Currently /-/get returns members only, not guests.)
              Bad(s"Pat found but not a member, ref: '$ref'")
            }
        }
    }

    // ----- Generate json

    val thingsOrErrsJson = patsOrErrs map {
      case Bad(errMsg) =>
        Json.obj("errMsg" -> errMsg, "errCode" -> "TyEPATNF_")
      case Good(pat) =>
        ThingsFoundJson.JsPatFoundOrNull(
              Some(pat), avatarUrlPrefix = None, JsonConf.v0_1(), authzCtx)
    }

    Good(JsArray(thingsOrErrsJson))
  }

}
