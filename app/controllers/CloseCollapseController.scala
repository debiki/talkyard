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
import javax.inject.Inject
import play.api._


/** Closes and collapses trees and posts.
  */
class CloseCollapseController @Inject() extends mvc.Controller {


  def hidePost = PostJsonAction(RateLimits.CloseCollapsePost, maxLength = 100) { apiReq =>
    val hide = (apiReq.body \ "hide").as[Boolean]
    changeStatus(apiReq, if (hide) PostStatusAction.HidePost else PostStatusAction.UnhidePost)
  }


  def collapsePost = PostJsonAction(RateLimits.CloseCollapsePost, maxLength = 100) { apiReq =>
    changeStatus(apiReq, PostStatusAction.CollapsePost)
  }


  def collapseTree = PostJsonAction(RateLimits.CloseCollapsePost, maxLength = 100) { apiReq =>
    changeStatus(apiReq, PostStatusAction.CollapseTree)
  }


  def closeTree = PostJsonAction(RateLimits.CloseCollapsePost, maxLength = 100) { apiReq =>
    changeStatus(apiReq, PostStatusAction.CloseTree)
  }


  private def changeStatus(apiReq: JsonPostRequest, action: PostStatusAction): mvc.Result = {
    if (!apiReq.user_!.isAdmin)
      throwForbidden("DwE95Xf2", "Insufficient permissions to change post or thread status")

    val pageId = (apiReq.body \ "pageId").as[PageId]
    val postNr = (apiReq.body \ "postNr").as[PostNr]

    apiReq.dao.changePostStatus(postNr, pageId = pageId, action, userId = apiReq.theUserId)

    OkSafeJson(ReactJson.postToJson2(postNr = postNr, pageId = pageId, // COULD stop including post in reply? It'd be annoying if other unrelated changes were loaded just because the post was toggled open?
      apiReq.dao, includeUnapproved = true))
  }

}

