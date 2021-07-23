/**
 * Copyright (c) 2016 Kaj Magnus Lindberg
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
import debiki.{JsonMaker, RateLimits, SiteTpi}
import debiki.EdHttp._
import ed.server.{EdContext, EdController}
import play.api.libs.json._
import javax.inject.Inject
import play.api.mvc.{Action, ControllerComponents}


class TagsController @Inject()(cc: ControllerComponents, edContext: EdContext)
  extends EdController(cc, edContext) {

  import context.globals

  def redirect: Action[Unit] = GetAction { apiReq =>
    Redirect(routes.TagsController.tagsApp("").url)
  }


  def tagsApp(clientRoute: String): Action[Unit] = GetAction { apiReq =>
    _root_.controllers.dieIfAssetsMissingIfDevTest()
    val siteTpi = SiteTpi(apiReq)
    CSP_MISSING
    val pageBody = views.html.adminPage(siteTpi, appId = "theTagsApp").body
    Ok(pageBody) as HTML
  }


  def loadAllTags: Action[Unit] = GetAction { request =>
    val tags = request.dao.loadAllTagsAsSet()
    OkSafeJson(JsArray(tags.toSeq.map(JsString)))
  }


  def loadTagsAndStats: Action[Unit] = GetAction { request =>
    val tagsAndStats = request.dao.loadTagsAndStats()
    val isStaff = request.isStaff
    OkSafeJson(JsonMaker.makeTagsStuffPatch(Json.obj(
      "tagsAndStats" -> JsArray(tagsAndStats.map(tagAndStats => {
        Json.obj(
          "label" -> tagAndStats.label,
          "numTotal" -> tagAndStats.numTotal,
          "numPages" -> tagAndStats.numPages,
          // Don't think everyone should know about this:
          "numSubscribers" -> (if (isStaff) tagAndStats.numSubscribers else JsNull),
          "numMuted" -> (if (isStaff) tagAndStats.numMuted else JsNull))
      }))), globals.applicationVersion))
  }


  def loadMyTagNotfLevels: Action[Unit] = GetAction { request =>
    val notfLevelsByTagLabel = request.dao.loadTagNotfLevels(request.theUserId, request.who)
    OkSafeJson(JsonMaker.makeTagsStuffPatch(Json.obj(
      "myTagNotfLevels" -> JsObject(notfLevelsByTagLabel.toSeq.map({ labelAndLevel =>
        labelAndLevel._1 -> JsNumber(labelAndLevel._2.toInt)
      }))), globals.applicationVersion))
  }


  def setTagNotfLevel: Action[JsValue] = PostJsonAction(RateLimits.ConfigUser, maxBytes = 500) { request =>
    val body = request.body
    val tagLabel = (body \ "tagLabel").as[String]
    val notfLevelInt = (body \ "notfLevel").as[Int]
    val notfLevel = NotfLevel.fromInt(notfLevelInt) getOrElse throwBadRequest(
      "EsE40GK2W4", s"Bad tag notf level: $notfLevelInt")
    request.dao.setTagNotfLevelIfAuth(userId = request.theRoleId, tagLabel, notfLevel,
      request.who)
    Ok
  }


  def addRemoveTags: Action[JsValue] = PostJsonAction(RateLimits.EditPost, maxBytes = 5000) { request =>
    val pageId = (request.body \ "pageId").as[PageId]
    val postId = (request.body \ "postId").as[PostId]  // yes id not nr
    val tags = (request.body \ "tags").as[Set[TagLabel]]
    val patch = request.dao.addRemoveTagsIfAuth(pageId, postId, tags, request.who)
    OkSafeJson(patch) // or skip? or somehow include tags *only*? [5GKU0234]
  }
}

