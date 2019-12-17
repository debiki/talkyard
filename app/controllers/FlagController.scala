/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg
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
import debiki.EdHttp._
import ed.server.{EdContext, EdController}
import javax.inject.Inject
import play.api.mvc._
import ed.server.auth.Authz
import play.api.libs.json.JsValue



// Add  flagUser() fn, so can flag user with offensive username?
//
class FlagController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.security._


  def flagPost: Action[JsValue] = PostJsonAction(RateLimits.FlagPost, maxBytes = 2000) { request =>
    import request.{body, dao}
    SHOULD // change from page-id + post-nr to post-id.
    val pageId = (body \ "pageId").as[PageId]
    val postNr = (body \ "postNr").as[PostNr]
    val typeStr = (body \ "type").as[String]
    //val reason = (body \ "reason").as[String]

    val flagType = typeStr match {
      case "Spam" => PostFlagType.Spam
      case "Inapt" => PostFlagType.Inapt
      case "Other" => PostFlagType.Other
      case x => throwBadReq("DwE7PKTS3", s"Bad flag type: '$x'")
    }

    // COULD save `reason` somewhere, but where? Where does Discourse save it?

    val pageMeta = dao.getPageMeta(pageId) getOrElse throwIndistinguishableNotFound("EdE3FJB8W2")
    val post = dao.loadPost(pageId, postNr) getOrElse throwIndistinguishableNotFound("EdE5PJB2R8")
    val categoriesRootLast = dao.getAncestorCategoriesRootLast(pageMeta.categoryId)

    throwNoUnless(Authz.mayFlagPost(
      request.theMember, dao.getOnesGroupIds(request.theUser),
      post, pageMeta, dao.getAnyPrivateGroupTalkMembers(pageMeta),
      inCategoriesRootLast = categoriesRootLast,
      tooManyPermissions = dao.getPermsOnPages(categoriesRootLast)), "EdEZBXKSM2")

    val postsHidden = try {
      dao.flagPost(pageId = pageId, postNr = postNr, flagType,
        flaggerId = request.theUser.id)
    }
    catch {
      case DbDao.DuplicateVoteException =>
        throwForbidden("EdE5PKY02", "You have already flagged this post")
    }

    // If some posts got hidden, then rerender them as hidden, so the flagger sees they got hidden.
    val json = dao.jsonMaker.makeStorePatchForPosts(
      postsHidden.map(_.id).toSet, showHidden = false, dao)
    OkSafeJson(json)
  }

}
