/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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
import com.debiki.core.Prelude.unimplemented
import debiki._
import debiki.EdHttp._
import ed.server.{EdContext, EdController}
import javax.inject.Inject
import play.api.mvc._
import ed.server.auth.Authz
import play.api.libs.json.JsValue



// RENAME to FlagController?
// Or add  FlagUser fn, so can flag user with offensive username?
// Or move to PostController?, and add flagUser() in UserController?
class Application @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.security._


  def mobileAppWebmanifest(): Action[Unit] = GetActionAllowAnyone { _ =>  // [sw]
    unimplemented("TyE7KAESW")
    // See:  https://github.com/discourse/discourse/blob/master/app/controllers/metadata_controller.rb
    // or display: browser ?
    // But:  Use `display: browser` in webmanifest for iOS devices
    //       https://meta.discourse.org/t/back-button-in-responsive-app/93909/5
    //       Otherwise, will be no Back button in iOS.
    //
    // Also compare with: (root)/images/web/ty-media/favicon/site.webmanifest.
    //
    Ok(s"""
      |{
      |  "name": "The Most Awesome Dragon Site",
      |  "short_name": "ððð",
      |  "display": "minimal-ui",
      |  "start_url": "/",
      |  "theme_color": "#673ab6",
      |  "background_color": "#111111",
      |  "orientation": "any",
      |  "icons": [
      |    {
      |      "src": "icon-192.png",
      |      "sizes": "192x192",
      |      "type": "image/png"
      |    }
      |  ]
      |}
    """.stripMargin) as "application/manifest+json"  // TODO cache 1 day only, for now?
    // needs to be that content type, see:
    // https://github.com/discourse/discourse/commit/8fc08aad09d0db9bc176a9f2376f05b3c9cebc6b#diff-d73ec52fd8b68ed588bf337398eee53d
    // cache max 1 day? later, maybe half a week?
    //   "max-age=86400, s-maxage=86400, public"
  }


  def flag: Action[JsValue] = PostJsonAction(RateLimits.FlagPost, maxBytes = 2000) { request =>
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
    val categoriesRootLast = dao.loadAncestorCategoriesRootLast(pageMeta.categoryId)

    throwNoUnless(Authz.mayFlagPost(
      request.theMember, dao.getGroupIds(request.theUser),
      post, pageMeta, dao.getAnyPrivateGroupTalkMembers(pageMeta),
      inCategoriesRootLast = categoriesRootLast,
      permissions = dao.getPermsOnPages(categoriesRootLast)), "EdEZBXKSM2")

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
