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
import com.debiki.core.Prelude.{IfBadAbortReq, IfBadDie, JsEmptyObj2, throwUnimpl}
import debiki.{JsonMaker, RateLimits, SiteTpi}
import debiki.JsonUtils.parseJsArray
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


  def tagsApp(whatever: St): Action[Unit] = AsyncGetAction { req =>
    _root_.controllers.dieIfAssetsMissingIfDevTest()
    RENAME // templates.users  to maybe  templates.moreApp?
    val htmlStr = views.html.templates.users(SiteTpi(req)).body
    ViewPageController.addVolatileJsonAndPreventClickjacking2(htmlStr,
          unapprovedPostAuthorIds = Set.empty, req)
  }


  // Later: Trusted or Core Members should by default be allowed to do this?  [tag_perms]
  def upsertType: Action[JsValue] = StaffPostJsonAction2(
        RateLimits.CreateTagCatPermGroup, maxBytes = 2000) { req =>
    import req.{dao, theRequester => reqer}
    // Pass a CheckThoroughly param to the mess aborter? And then check the tag name
    // too. [mess_aborter]. Or always do from inside JsX.parseTagType()
    val tagTypeMaybeId: TagType = JsX.parseTagType(
          req.body, createdById = Some(reqer.id))(IfBadAbortReq)
    val tagType = dao.upsertTypeIfAuZ(
          tagTypeMaybeId, req.reqrTargetSelf.denyUnlessStaff())(IfBadAbortReq)
    OkSafeJson(Json.obj(  // ts: StorePatch
        "tagTypes" -> Json.arr(JsX.JsTagTypeMaybeRefId(tagType,
            // Ooops, only for admins (not mod) here:  AuthzCtx.maySeeExtIds: Bo
            inclRefId = true))))  // [who_sees_refid]  HMM  search for inclRefId everywhere
  }



  def listTagTypes(forWhat: Opt[i32], tagNamePrefix: Opt[St]): Action[U] =
          GetActionRateLimited(RateLimits.ReadsFromCache) { req =>
    import req.{theReqer}
    // Later, when there are access restricted tags, need to authz filter here. [priv_tags]
    val tagTypes = req.dao.getTagTypesSeq(forWhat, tagNamePrefix)
    val json = JsonMaker.makeStorePatch(Json.obj(
          "allTagTypes" -> JsX.JsTagTypeArray(tagTypes, inclRefId = theReqer.isStaff)), // [who_sees_refid] HMM
          globals.applicationVersion)
    OkSafeJson(json)
  }


  def loadTagsAndStats: Action[Unit] = GetActionRateLimited(RateLimits.ReadsFromDb) {
          request =>
    // Later, filter may-see-tags.  [priv_tags]
    import request.{dao, reqer}

    val isStaff = reqer.exists(_.isStaff)
    val (tagTypes, tagStats) = dao.readTx { tx =>
      (tx.loadAllTagTypes(),
          // For now, stats can be for staff only.  [priv_tags]
          if (isStaff) tx.loadTagTypeStats() else Nil)
    }

    val json = JsonMaker.makeStorePatch(Json.obj(
      "allTagTypes" -> JsX.JsTagTypeArray(tagTypes, inclRefId = isStaff), // [who_sees_refid] HMM
      "allTagTypeStatsById" -> (
            JsObject(tagStats.map(s => s.tagTypeId.toString -> JsX.JsTagStats(s)))),
      ), globals.applicationVersion)

      OkSafeJson(json)
  }


  // Break out to [CatsAndTagsController]?  Or better:
  REFACTOR; MOVE // to SearchController?
  /** For the search page, so can list and choose which cats & tags to search in & for.
    */
  def loadCatsAndTags: Action[U] = GetActionRateLimited(RateLimits.ReadsFromDb) { req =>
    // Later, filter may-see-tags.  [priv_tags]
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
    // If reimplemented, check if may see tag.  [priv_tags]
    val body = request.body
    val tagLabel = (body \ "tagLabel").as[String]
    val notfLevelInt = (body \ "notfLevel").as[Int]
    val notfLevel = NotfLevel.fromInt(notfLevelInt) getOrElse throwBadRequest(
      "EsE40GK2W4", s"Bad tag notf level: $notfLevelInt")
    request.dao.setTagNotfLevelIfAuth(userId = request.theRoleId, tagLabel, notfLevel,
      request.who)
    Ok
  }


  def updateTags: Action[JsValue] = PostJsonAction(
          RateLimits.EditPost, maxBytes = 5000) { req =>
    // Later, more granular access control.  [priv_tags]
    import req.{body, dao}
    val toAddJsVals: Seq[JsValue] = parseJsArray(body, "tagsToAdd")
    val toAdd = toAddJsVals.map(v => JsX.parseTag(v)(IfBadAbortReq))
    val toRemoveJsVals = parseJsArray(body, "tagsToRemove")
    val toRemove = toRemoveJsVals.map(v => JsX.parseTag(v)(IfBadAbortReq))
    val toEditJsVals = parseJsArray(body, "tagsToEdit")
    val toEdit = toEditJsVals.map(v => JsX.parseTag(v)(IfBadAbortReq))

    val reqrTgt = req.reqrTargetSelf.denyUnlessMember()

    val affectedPostIds =
          dao.updateTagsIfAuZ(
              toAdd = toAdd, toRemove = toRemove, toEdit = toEdit, reqrTgt)(IfBadAbortReq)

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

