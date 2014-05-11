/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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
import collection.mutable
import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import java.{util => ju}
import play.api.mvc
import play.api.libs.json._
import play.api.mvc.{Action => _, _}
import requests.GetRequest
import Utils.OkSafeJson
import Utils.ValidationImplicits._
import DebikiHttp.throwBadReq



/** Handles requests related to users (guests, roles, groups).
 */
object UserController extends mvc.Controller {


  def viewUserPage() = GetAction { request =>
    // For now, always use the default theme.
    val htmlStr = debiki.TemplateRenderer.renderThemeTemplate(
      theme = TemplateRenderer.DefaultThemeFullName,
      template = "users",
      arguments = Seq(SiteTpi(request)))
    Ok(htmlStr) as HTML
  }


  def loadUserInfo(userId: String) = GetAction { request =>
    val userInfo = DummyUserInfo //request.dao.loadUserInfo(userId)
  val json = Json.obj("userInfo" -> userInfoToJson(userInfo))
    OkSafeJson(json)
  }


  def listUserActions(userId: String) = GetAction { request =>
    val actionInfos: Seq[UserActionInfo] = Seq(DummyActionInfo)//request.dao.listUserActions(userId)
    val json = Json.obj("actions" -> actionInfos.map(actionToJson(_)))
    OkSafeJson(json)
  }


  private def userInfoToJson(userInfo: UserInfo): JsObject = {
    Json.obj(
      "userId" -> userInfo.userId,
      "displayName" -> userInfo.displayName)
  }


  private def actionToJson(actionInfo: UserActionInfo): JsObject = {
    Json.obj(
      "pageUrl" -> JsString(actionInfo.pageUrl),
      "pageTitle" -> JsString(actionInfo.pageTitle),
      "postId" -> JsNumber(actionInfo.postId),
      "actionId" -> JsNumber(actionInfo.actionId),
      "actingUserId" -> JsString(actionInfo.actingUserId),
      "actingUserDisplayName" -> JsString(actionInfo.actingUserDisplayName),
      "targetUserId" -> JsString(actionInfo.targetUserId),
      "targetUserDisplayName" -> JsString(actionInfo.targetUserDisplayName),
      "createdAtEpoch" -> JsNumber(actionInfo.createdAt.getTime),
      "excerpt" -> JsString(actionInfo.postExcerpt),
      "repliedToPostId" -> actionInfo.repliedToPostId.map(JsNumber(_)),
      "votedLike" -> JsBoolean(actionInfo.votedLike),
      "votedWrong" -> JsBoolean(actionInfo.votedWrong),
      "votedOffTopic" -> JsBoolean(actionInfo.votedOffTopic))
  }


  val DummyUserInfo = UserInfo(userId = "123", displayName = "Uber Gruber")


  val DummyActionInfo = UserActionInfo(
    userId = "123",
    pageUrl = "/ab/cd",
    pageTitle = "Boo Bää",
    postId = 123,
    postExcerpt = "Kvitter kvitter kvack",
    actionId = 123,
    actingUserId = "123",
    actingUserDisplayName = "Casper Camel",
    targetUserId = "345",
    targetUserDisplayName = "Bo Bofink",
    createdAt = new ju.Date,
    repliedToPostId = Some(123),
    votedLike = true,
    votedWrong = true,
    votedOffTopic = true)

}

