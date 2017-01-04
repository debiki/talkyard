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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.DebikiHttp._
import io.efdi.server.http._
import java.{util => ju}
import play.{api => p}



/** Pins a comment by position, or pins votes to it.
  *
  * Old comment from somewhere else:
  *   Pins a post at e.g. position 3. This pushes any other posts already pinned
  * at e.g. positions 3, 4, and 5 one step to the right, to positions 4, 5 and 6.
  * So after a while, the effective position of a pinned post might have changed
  * from X to X + Y where Y is the number of new posts pinned at or before X.
  * The effective position of a post is computed lazily when the page is rendered.
  *
  * @param position 1 means place first, 2 means place first but one, and so on.
  *   -1 means place last, -2 means last but one, and so on.
  */
object PinController extends p.mvc.Controller {


  def pinAtPosition = PostJsonAction(RateLimits.PinPost, maxLength = 1000) { apiReq =>
    throwNotImplemented("DwE5JKEG3", "Pinning posts") /*

    val pageIdsAndActions: Seq[(PageId, RawPostAction[PAP.PinPostAtPosition])] =
      for (pinPostJson <- apiReq.body.as[Vector[JsObject]]) yield {
        val pageId = (pinPostJson \ "pageId").as[PageId]
        val postId = (pinPostJson \ "postId").as[PostId]  want id or nr?
        val position = (pinPostJson \ "position").as[Int]
        val payload = PAP.PinPostAtPosition(position)
        val action = RawPostAction(
          PageParts.UnassignedId, apiReq.ctime, payload, postId = postId,
          userIdData = apiReq.userIdData)
        (pageId, action)
      }

    /* Stop using crazy groupedByPageId. Now I deleted it :-)
    pageIdsAndActions.groupedByPageId foreach { case (pageId, actions) =>
      val permsOnPage = apiReq.dao.loadPermsOnPage(apiReq, pageId)
      if (!permsOnPage.pinReplies)
        throwForbidden("DwE95Xf2", "Insufficient permissions to pin post")

      // apiReq.dao.savePageActionsGenNotfs(pageId, actions, apiReq.meAsPeople_!)
    }
    */

    // The client already knows where to place the pinned post, so simply:
    Ok
    */
  }

}

