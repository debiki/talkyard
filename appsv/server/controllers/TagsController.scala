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
import com.debiki.core.Prelude.{IfBadAbortReq, IfBadDie, throwUnimpl}
import debiki.{JsonMaker, RateLimits, SiteTpi}
import debiki.EdHttp._
import talkyard.server.{TyContext, TyController}
import play.api.libs.json._
import javax.inject.Inject
import play.api.mvc.{Action, ControllerComponents}
import talkyard.server.JsX


class TagsController @Inject()(cc: ControllerComponents, edContext: TyContext)
  extends TyController(cc, edContext) {

  import context.globals

  def redirect: Action[Unit] = GetAction { _ =>
    Redirect(routes.TagsController.tagsApp("").url)
  }


  // For now, admin only?
  def tagsApp(clientRoute: String): Action[Unit] = StaffGetAction { apiReq =>
    _root_.controllers.dieIfAssetsMissingIfDevTest()
    val siteTpi = SiteTpi(apiReq)
    CSP_MISSING
    val pageBody = views.html.adminPage(siteTpi, appId = "theTagsApp").body
    Ok(pageBody) as HTML
  }


  def createTagType: Action[JsValue] = StaffPostJsonAction(
        maxBytes = 2000) { req =>   // RateLimits.CreateTagCatPermGroup [to_rate_lim]
    import req.{dao, theRequester => reqer}
    // Pass a CheckThoroughly param to the mess aborter? And then check the tag name
    // too. [mess_aborter]. Or always do from inside JsX.parseTagType()
    val tagTypeMaybeId: TagType = JsX.parseTagType(req.body, Some(reqer.id))(IfBadAbortReq)
    val tagType = dao.createTagType(tagTypeMaybeId)(IfBadAbortReq)
    OkSafeJson(Json.obj(  // ts: StorePatch
      "tagTypes" -> Json.arr(JsX.JsTagType(tagType))))
  }



  def listTagTypes(forWhat: Opt[i32], tagNamePrefix: Opt[St]): Action[U] =
          GetActionRateLimited(RateLimits.ReadsFromCache) { req =>
    // Later, when there are access restricted tags, need to authz filter here. [priv_tags]
    // But tag stats isn't public, at least not now.
    val tagTypes = req.dao.getTagTypesSeq(forWhat, tagNamePrefix)
    val json = JsonMaker.makeStorePatch(Json.obj(
          "allTagTypes" -> JsArray(tagTypes map JsX.JsTagType)), globals.applicationVersion)
    OkSafeJson(json)
  }


  def loadTagsAndStats: Action[Unit] = StaffGetAction { request =>
    import request.dao
    val (tagTypes, tagStats) = dao.readTx { tx =>
      (tx.loadAllTagTypes(),
          tx.loadTagTypeStats())
    }

    val json = JsonMaker.makeStorePatch(Json.obj(
      "allTagTypes" -> JsArray(tagTypes map JsX.JsTagType),
      "allTagTypeStatsById" ->
            JsObject(tagStats.map(s => s.toString -> JsX.JsTagStats(s))),
      /* Old!:   CLEAN_UP ; REMOVE
      "tagsStuff" -> Json.obj( "tagsAndStats" -> JsArray(tagsAndStats.map(tagAndStats => {
        Json.obj(
          "label" -> tagAndStats.label,
          "numTotal" -> tagAndStats.numTotal,
          "numPages" -> tagAndStats.numPages,
          // Don't think everyone should know about this:
          "numSubscribers" -> (if (isStaff) tagAndStats.numSubscribers else JsNull),
          "numMuted" -> (if (isStaff) tagAndStats.numMuted else JsNull))
       })))*/
      ), globals.applicationVersion)

      OkSafeJson(json)
  }


  // Break out to [CatsAndTagsController]?
  def loadCatsAndTags: Action[U] = GetActionRateLimited(RateLimits.ReadsFromCache) { req =>
    val catsJsArr = ForumController.loadCatsJsArrayMaySee(req)
    val tagTypes = req.dao.getTagTypesSeq(forWhat = None, tagNamePrefix = None)
    val json = JsonMaker.makeCatsAndTagsPatch(catsJsArr, tagTypes, globals.applicationVersion)
    OkSafeJson(json)
  }


  /* Broken, after tags got reimplemented.
  def loadMyTagNotfLevels: Action[Unit] = GetActionRateLimited() { request =>
    val notfLevelsByTagLabel = request.dao.loadTagNotfLevels(request.theUserId, request.who)
    OkSafeJson(JsonMaker.makeCatsAndTagsPatch(catsJsArr = ...,
      // Long ago, won't work now:
      "myTagNotfLevels" -> JsObject(notfLevelsByTagLabel.toSeq.map({ labelAndLevel =>
        labelAndLevel._1 -> JsNumber(labelAndLevel._2.toInt)
      })),, globals.applicationVersion))
  } */


  @deprecated
  def setTagNotfLevel: Action[JsValue] = PostJsonAction(
          RateLimits.ConfigUser, maxBytes = 500) { request =>
    throwUnimpl("TyE406MRE23")
    val body = request.body
    val tagLabel = (body \ "tagLabel").as[String]
    val notfLevelInt = (body \ "notfLevel").as[Int]
    val notfLevel = NotfLevel.fromInt(notfLevelInt) getOrElse throwBadRequest(
      "EsE40GK2W4", s"Bad tag notf level: $notfLevelInt")
    request.dao.setTagNotfLevelIfAuth(userId = request.theRoleId, tagLabel, notfLevel,
      request.who)
    Ok
  }


  def addRemoveTags: Action[JsValue] = StaffPostJsonAction( // RateLimits.EditPost,
          maxBytes = 5000) { req =>
    import req.{body, dao}
    val toAddJsVals: Seq[JsValue] = debiki.JsonUtils.parseJsArray(body, "tagsToAdd")
    val toAdd = toAddJsVals.map(v => JsX.parseTag(v)(IfBadAbortReq))
    val toRemoveJsVals = debiki.JsonUtils.parseJsArray(body, "tagsToRemove")
    val toRemove = toRemoveJsVals.map(v => JsX.parseTag(v)(IfBadAbortReq))
    val affectedPostIds = dao.addRemoveTagsIfAuth(
          toAdd = toAdd, toRemove = toRemove, req.who)(IfBadAbortReq)

    val storePatch = dao.jsonMaker.makeStorePatchForPostIds(
          postIds = affectedPostIds, showHidden = true, inclUnapproved = true,
          maySquash = false, dao)

    OkSafeJson(storePatch)

    /* Old!:   CLEAN_UP ; REMOVE
    val pageId = (request.body \ "pageId").as[PageId]
    val postId = (request.body \ "postId").as[PostId]  // yes id not nr
    val tags = (request.body \ "tags").as[Set[TagLabel]]
    val patch = request.dao.addRemoveTagsIfAuth(pageId, postId, tags, request.who)
    OkSafeJson(patch) // or skip? or somehow include tags *only*? [5GKU0234]
     */
  }
}

