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
import debiki._
import debiki.EdHttp.throwForbidden
import talkyard.server.http._
import talkyard.server.{TyContext, TyController}
import javax.inject.Inject
import play.api._
import play.api.libs.json.JsValue
import play.api.mvc.{Action, ControllerComponents}


/** Closes and collapses trees and posts.
  */
class CloseCollapseController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {


  def hidePost: Action[JsValue] = PostJsonAction(RateLimits.CloseCollapsePost, maxBytes = 100) { apiReq =>
    val hide = (apiReq.body \ "hide").as[Boolean]
    changeStatus(apiReq, if (hide) PostStatusAction.HidePost else PostStatusAction.UnhidePost)
  }


  def collapsePost: Action[JsValue] = PostJsonAction(RateLimits.CloseCollapsePost, maxBytes = 100) {
        apiReq =>
    changeStatus(apiReq, PostStatusAction.CollapsePost)
  }


  def collapseTree: Action[JsValue] = PostJsonAction(RateLimits.CloseCollapsePost, maxBytes = 100) {
        apiReq =>
    changeStatus(apiReq, PostStatusAction.CollapseTree)
  }


  def closeTree: Action[JsValue] = PostJsonAction(RateLimits.CloseCollapsePost, maxBytes = 100) {
        apiReq =>
    changeStatus(apiReq, PostStatusAction.CloseTree)
  }


  private def changeStatus(apiReq: JsonPostRequest, action: PostStatusAction): mvc.Result = {
    import apiReq.dao

    if (!apiReq.user_!.isAdmin)
      throwForbidden("DwE95Xf2", "Insufficient permissions to change post or thread status")

    val pageId = (apiReq.body \ "pageId").as[PageId]
    val postNr = (apiReq.body \ "postNr").as[PostNr]

    ANON_UNIMPL // hide, close, collapse comment trees
    // Later:  SiteDao.checkAliasOrThrowForbidden

    dao.changePostStatus(postNr, pageId = pageId, action, apiReq.reqrIds, asAlias = None)

    OkSafeJson(dao.jsonMaker.postToJson2(postNr, pageId = pageId, // COULD stop including post in reply? It'd be annoying if other unrelated changes were loaded just because the post was toggled open?
      includeUnapproved = true))
  }

}

