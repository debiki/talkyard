/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

package controllers

import actions.ApiActions._
import com.debiki.core._
import com.debiki.core.{PostActionPayload => PAP}
import controllers.Utils.{OkSafeJson, ActionsByPageIdGrouper}
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.libs.json.JsObject



/** Pins a comment by position, or pins votes to it.
  */
object PinController extends mvc.Controller {


  def pinAtPosition = PostJsonAction(RateLimits.PinPost, maxLength = 1000) { apiReq =>

    val pageIdsAndActions: Seq[(PageId, RawPostAction[PAP.PinPostAtPosition])] =
      for (pinPostJson <- apiReq.body.as[Vector[JsObject]]) yield {
        val pageId = (pinPostJson \ "pageId").as[PageId]
        val postId = (pinPostJson \ "postId").as[PostId]
        val position = (pinPostJson \ "position").as[Int]
        val payload = PAP.PinPostAtPosition(position)
        val action = RawPostAction(
          PageParts.UnassignedId, apiReq.ctime, payload, postId = postId,
          userIdData = apiReq.userIdData)
        (pageId, action)
      }

    pageIdsAndActions.groupedByPageId foreach { case (pageId, actions) =>
      val permsOnPage = apiReq.dao.loadPermsOnPage(apiReq, pageId)
      if (!permsOnPage.pinReplies)
        throwForbidden("DwE95Xf2", "Insufficient permissions to pin post")

      apiReq.dao.savePageActionsGenNotfs(pageId, actions, apiReq.meAsPeople_!)
    }

    // The client already knows where to place the pinned post, so simply:
    Ok
  }

}

