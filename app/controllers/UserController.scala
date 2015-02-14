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
import requests.{PageRequest, DebikiRequest}
import Utils.OkSafeJson
import Utils.ValidationImplicits._
import DebikiHttp.{throwForbidden, throwNotFound}



/** Handles requests related to users (guests, roles, groups).
 */
object UserController extends mvc.Controller {


  def viewUserPage() = GetAction { request =>
    val htmlStr = debiki.TemplateRenderer.renderThemeTemplate(
      template = "users", arguments = Seq(SiteTpi(request)))
    Ok(htmlStr) as HTML
  }


  def loadUserInfo(userId: String) = GetAction { request =>
    val userInfo = request.dao.loadUserInfoAndStats(userId) getOrElse throwNotFound(
      "DwE512WR8", s"User not found, id: $userId")
    val json = Json.obj("userInfo" -> userInfoToJson(userInfo))
    OkSafeJson(json)
  }


  def loadMyPageData(pageId: PageId) = GetAction { request =>
    val myPageData = PageRequest.forPageThatExists(request, pageId) match {
      case None =>
        // Might be an embedded comment page, not yet created because no comments posted.
        // Or we might be in the signup-to-become-owner step, when creating a new site.
        ReactJson.userNoPageToJson(request.user)
      case Some(request) =>
        ReactJson.userDataJson(request) getOrElse ReactJson.NoUserSpecificData
    }
    OkSafeJson(myPageData)
  }


  def listUserActions(userId: String) = GetAction { request =>
    val actionInfos: Seq[UserActionInfo] = request.dao.listUserActions(userId)
    val json = Json.obj("actions" -> actionInfos.map(actionToJson(_)))
    OkSafeJson(json)
  }


  def savePageNotfLevel = PostJsonAction(RateLimits.ConfigUser, maxLength = 500) { request =>
    val body = request.body
    val pageId = (body \ "pageId").as[PageId]
    val newNotfLevelStr = (body \ "pageNotfLevel").as[String]
    val newNotfLevel = PageNotfLevel.fromString(newNotfLevelStr)
    request.dao.saveRolePageSettings(roleId = request.theRoleId, pageId = pageId,
      RolePageSettings(newNotfLevel))
    Ok
  }


  def listUsernames(pageId: PageId, prefix: String) = GetAction { request =>
    val names = request.dao.listUsernames(pageId = pageId, prefix = prefix)
    val json = JsArray(
      names map { nameAndUsername =>
        Json.obj(
          "username" -> nameAndUsername.username,
          "fullName" -> nameAndUsername.fullName)
      })
    OkSafeJson(json)
  }


  def loadUserPreferences(userId: String) = GetAction { request =>
    checkUserPrefsAccess(request, userId)
    val prefs = request.dao.loadRolePreferences(userId) getOrElse throwNotFound(
      "DwE3EJ5O2", s"User not found, id: $userId")
    val json = Json.obj("userPreferences" -> userPrefsToJson(prefs))
    OkSafeJson(json)
  }


  def saveUserPreferences = PostJsonAction(RateLimits.ConfigUser, maxLength = 1000) { request =>
    val prefs = userPrefsFromJson(request.body)
    checkUserPrefsAccess(request, prefs.userId)

    // For now, don't allow people to change their username. In the future, changing
    // it should be alloowed, but only very infrequently? Or only the very first few days.
    if (request.theUser.username != prefs.username)
      throwForbidden("DwE44ELK9", "Must not modify one's username")

    // For now, don't allow the user to change his/her email. I haven't
    // implemented any related security checks, e.g. verifying with the old address
    // that this is okay, or sending an address confirmation email to the new address.
    if (request.theUser.email != prefs.emailAddress)
      throwForbidden("DwE44ELK9", "Must not modify one's email")

    request.dao.saveRolePreferences(prefs)
    Ok
  }


  private def checkUserPrefsAccess(request: DebikiRequest[_], prefsUserId: UserId) {
    val adminOrOwn = request.theUser.isAdmin || request.theUser.id == prefsUserId
    if (!adminOrOwn)
      throwForbidden("DwE15KFE5", "Not your preferences and you're no admin")
  }


  private def userInfoToJson(userInfo: UserInfoAndStats): JsObject = {
    Json.obj(
      "userId" -> userInfo.info.id,
      "displayName" -> userInfo.info.displayName,
      "username" -> userInfo.info.username.getOrElse(null),
      "isAdmin" -> userInfo.info.isAdmin,
      "isModerator" -> false, // userInfo.info.isModerator,
      "numPages" -> userInfo.stats.numPages,
      "numPosts" -> userInfo.stats.numPosts,
      "numReplies" -> userInfo.stats.numReplies,
      "numLikesGiven" -> userInfo.stats.numLikesGiven,
      "numLikesReceived" -> userInfo.stats.numLikesReceived,
      "numWrongsGiven" -> userInfo.stats.numWrongsGiven,
      "numWrongsReceived" -> userInfo.stats.numWrongsReceived,
      "numOffTopicsGiven" -> userInfo.stats.numOffTopicsGiven,
      "numOffTopicsReceived" -> userInfo.stats.numOffTopicsReceived)

    /* Discourse also includes:
      "avatar_template": ...
      "badge_count" : 0,
      "bio_cooked" : "<p>Hi <strong>everybody</strong>! </p>",
      "bio_excerpt" : "Hi everybody!",
      "bio_raw" : "\nHi **everybody**! ",
      "can_edit" : false,
      "can_edit_email" : false,
      "can_edit_name" : false,
      "can_edit_username" : false,
      "can_send_private_message_to_user" : true,
      "created_at" : "2013-02-17T15:09:06.675-05:00",
       group membership info
      "featured_user_badge_ids" : [  ],
      "invited_by" : null,
      "last_posted_at" : "2014-05-10T02:47:06.860-04:00",
      "last_seen_at" : "2014-05-10T03:42:16.842-04:00",
      "profile_background" : "/uploads/default/4870/f95c8f5b0817f799.jpg",
      "stats" : [ { "action_type" : 4,
              "count" : 5,
              "id" : null
            },
            { "action_type" : 5,
              "count" : 217,
              "id" : null
            },
            ... 11 stats
          ],
        "title" : "designerator",
        "trust_level" : 2,
        "username" : "awesomerobot",
        "website" : "http://"
      },
      "user_badges" : [ ]
     */
  }


  private def actionToJson(actionInfo: UserActionInfo): JsObject = {
    Json.obj(
      "pageUrl" -> s"/-${actionInfo.pageId}", // redirects to the page
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
      "editedPostId" -> actionInfo.editedPostId.map(JsNumber(_)),
      "approved" -> JsBoolean(actionInfo.approved),
      "deleted" -> JsBoolean(actionInfo.deleted),
      "pinned" -> JsBoolean(actionInfo.pinned),
      "collapsed" -> JsBoolean(actionInfo.collapsed),
      "closed" -> JsBoolean(actionInfo.closed),
      "votedLike" -> JsBoolean(actionInfo.votedLike),
      "votedWrong" -> JsBoolean(actionInfo.votedWrong),
      "votedOffTopic" -> JsBoolean(actionInfo.votedOffTopic))
    /* Discourse also includes:
      - usernames
      - the user that wrote the relevant post (avatar, display name, username, id)
      - action type (instead of votedLike, repliedTo...)
      - avatars: "//www.gravatar.com/avatar/....png?s={size}&r=pg&d=identicon",
      - deleted : false,
      - edit_reason : null,
      - hidden : false,
      - moderator_action : false,
     */
  }


  private def userPrefsToJson(prefs: UserPreferences): JsObject = {
    Json.obj(
      "userId" -> prefs.userId,
      "fullName" -> prefs.fullName,
      "username" -> prefs.username,
      "emailAddress" -> prefs.emailAddress,
      "url" -> prefs.url,
      "emailForEveryNewPost" -> prefs.emailForEveryNewPost)
  }


  private def userPrefsFromJson(json: JsValue): UserPreferences = {
    var anyUsername = (json \ "username").asOpt[String]
    if (anyUsername == Some("")) {
      anyUsername = None
    }
    UserPreferences(
      userId = (json \ "userId").as[UserId],
      fullName = (json \ "fullName").as[String],
      username = anyUsername,
      emailAddress = (json \ "emailAddress").as[String],
      url = (json \ "url").as[String],
      emailForEveryNewPost = (json \ "emailForEveryNewPost").as[Boolean])
  }

}

