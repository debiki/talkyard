/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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

package debiki

import com.debiki.core._
import com.debiki.core.Prelude._
import java.{util => ju}
import play.api.libs.json._
import requests.PageRequest


object ReactJson {

  def pageToJson(pageReq: PageRequest[_]): JsObject = {
    val anyUser = pageReq.user
    val userNameJson: JsValue = safeStringOrNull(anyUser.map(_.displayName))
    val numPostsExclTitle = pageReq.page_!.postCount - (if (pageReq.page_!.titlePost.isDefined) 1 else 0)
    val rolePageSettings = anyUser.flatMap(_.anyRoleId) map { roleId =>
      val settings = pageReq.dao.loadRolePageSettings(roleId = roleId, pageId = pageReq.thePageId)
      rolePageSettingsToJson(settings)
    } getOrElse JsNull

    // SHOULD sort by score
    val allPostsJson = pageReq.thePage.getAllPosts.map { post =>
      post.id.toString -> postToJson(post)
    }

    Json.obj(
      "now" -> JsNumber((new ju.Date).getTime),
      "pageId" -> pageReq.thePageId,
      "pageRole" -> JsString(pageReq.thePageRole.toString),
      "numPostsExclTitle" -> numPostsExclTitle,
      "isInEmbeddedCommentsIframe" -> JsBoolean(pageReq.pageRole == Some(PageRole.EmbeddedComments)),
      "user" -> Json.obj(
        "isAdmin" -> JsBoolean(false),
        "userId" -> safeStringOrNull(anyUser.map(_.id)),
        "username" -> safeStringOrNull(anyUser.flatMap(_.username)),
        "fullName" -> safeStringOrNull(anyUser.map(_.displayName)),
        // "permsOnPage" -> d.i.Me.getPermsOnPage(),
        "isEmailKnown" -> JsBoolean(anyUser.map(_.email.nonEmpty).getOrElse(false)),
        "rolePageSettings" -> rolePageSettings,
        "isAuthenticated" -> JsBoolean(anyUser.map(_.isAuthenticated).getOrElse(false))),
      "horizontalLayout" -> JsBoolean(true),
      "rootPostId" -> JsNumber(1),
      "allPosts" -> JsObject(allPostsJson))
  }


  def postToJson(post: Post): JsObject = {
    val lastEditAppliedAt = post.lastEditAppliedAt map { date =>
      JsNumber(date.getTime)
    } getOrElse JsNull

    JsObject(Vector(
      "postId" -> JsNumber(post.id),
      "parentId" -> post.parentId.map(JsNumber(_)).getOrElse(JsNull),
      "authorId" -> JsString(post.userId),
      "authorFullName" -> safeStringOrNull(Some(post.theUser.displayName)),
      "authorUsername" -> safeStringOrNull(post.theUser.username),
      "createdAt" -> JsNumber(post.creationDati.getTime),
      "lastEditAppliedAt" -> lastEditAppliedAt,
      "numEditors" -> JsNumber(post.numDistinctEditors),
      "numLikeVotes" -> JsNumber(post.numLikeVotes),
      "numWrongVotes" -> JsNumber(post.numWrongVotes),
      "numOffTopicVotes" -> JsNumber(post.numOffTopicVotes),
      "isTreeDeleted" -> JsBoolean(post.isTreeDeleted),
      "isPostDeleted" -> JsBoolean(post.isPostDeleted),
      "isTreeCollapsed" -> JsBoolean(post.isTreeCollapsed),
      "isPostCollapsed" -> JsBoolean(post.isPostCollapsed),
      "isTreeClosed" -> JsBoolean(post.isTreeClosed),
      "childIds" -> JsArray(post.replies.map(reply => JsNumber(reply.id))),
      "text" -> safeStringOrNull(post.approvedText)))
  }


  def rolePageSettingsToJson(settings: RolePageSettings): JsObject = {
    Json.obj(
      "notfLevel" -> safeJsString(settings.notfLevel.toString))
  }


  private def safeStringOrNull(value: Option[String]) =
    value.map(safeJsString(_)).getOrElse(JsNull)


  /** Makes a string safe for embedding in a JSON doc in a HTML doc.
    * From http://stackoverflow.com/a/4180424/694469: """escape  < with \u003c and --> with --\>
    * you need to escape the HTML characters <, >, & and = to make your json string safe to embed"""
    * (Note that the JSON serializer itself takes care of double quotes '"'.)
    */
  private def safeJsString(string: String): JsString = {
    var safeString = string
    safeString = safeString.replaceAllLiterally("<", "\u003c") // and? ">", "\u003e"
    safeString = safeString.replaceAllLiterally("-->", "--\\>")
    safeString = safeString.replaceAllLiterally("=", "\u003d")
    safeString = safeString.replaceAllLiterally("&", "%26")
    JsString(safeString)
  }

}

