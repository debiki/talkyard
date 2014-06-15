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

import actions.ApiActions.PostJsonAction
import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.Utils.OkSafeJson
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import play.api._
import play.api.libs.json._
import requests.JsonPostRequest
import Utils.ValidationImplicits._
import BrowserPagePatcher.TreePatchSpec


/** Closes and collapses trees and posts.
  */
object CloseCollapseController extends mvc.Controller {


  def collapsePost = PostJsonAction(maxLength = 5000) { apiReq =>
    closeOrReopenTree(apiReq, PostActionPayload.CollapsePost)
  }


  def collapseTree = PostJsonAction(maxLength = 5000) { apiReq =>
    closeOrReopenTree(apiReq, PostActionPayload.CollapseTree)
  }


  def closeTree = PostJsonAction(maxLength = 5000) { apiReq =>
    closeOrReopenTree(apiReq, PostActionPayload.CloseTree)
  }


  private def closeOrReopenTree(apiReq: JsonPostRequest, payload: PostActionPayload)
        : mvc.PlainResult = {

    if (!apiReq.user_!.isAdmin)
      throwForbidden("DwE95Xf2", "Insufficient permissions to close and reopen threads")

    // Play throws java.util.NoSuchElementException: key not found: pageId
    // and e.g. new RuntimeException("String expected")
    // on invalid JSON structure. COULD in some way convert to 400 Bad Request
    // instead of failing with 500 Internal Server Error in Prod mode.
    val pageActionIds = apiReq.body.as[List[Map[String, String]]]

    val actionsByPageId = Utils.parsePageActionIds(pageActionIds) { actionId =>
      RawPostAction(PageParts.UnassignedId, apiReq.ctime, payload, postId = actionId,
        userIdData = apiReq.userIdData)
    }

    var pagesAndPatchSpecs = List[(PageParts, List[TreePatchSpec])]()

    actionsByPageId foreach { case (pageId, actions) =>
      val (pageWithNewActions, _) =
        apiReq.dao.savePageActionsGenNotfs(pageId, actions, apiReq.meAsPeople_!)

      val patchSpecs = actions.map(a => TreePatchSpec(a.postId, wholeTree = true))
      pagesAndPatchSpecs ::= (pageWithNewActions.parts, patchSpecs)
    }

    OkSafeJson(
      BrowserPagePatcher(apiReq).jsonForTrees(pagesAndPatchSpecs))
  }

}

