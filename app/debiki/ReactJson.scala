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
    val numPostsExclTitle = pageReq.page_!.postCount - (if (pageReq.page_!.titlePost.isDefined) 1 else 0)

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
      "user" -> NoUserSpecificData,
      "horizontalLayout" -> JsBoolean(true),
      "rootPostId" -> JsNumber(1),
      "allPosts" -> JsObject(allPostsJson),
      // This stuff isn't rendered server side because then we couldn't cache
      // the rendered html, because it would be user specific.
      "renderLaterInBrowserOnly" -> Json.obj(
        "user" -> userDataJson(pageReq)))
  }


  def postToJson(post: Post, includeUnapproved: Boolean = false): JsObject = {
    val lastEditAppliedAt = post.lastEditAppliedAt map { date =>
      JsNumber(date.getTime)
    } getOrElse JsNull

    val (text, isApproved) =
      if (includeUnapproved)
        (Some(post.currentText), post.currentVersionApproved)
      else
        (post.approvedText, post.approvedText.nonEmpty)

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
      "numPendingEditSuggestions" -> JsNumber(post.numPendingEditSuggestions),
      "isTreeDeleted" -> JsBoolean(post.isTreeDeleted),
      "isPostDeleted" -> JsBoolean(post.isPostDeleted),
      "isTreeCollapsed" -> JsBoolean(post.isTreeCollapsed),
      "isPostCollapsed" -> JsBoolean(post.isPostCollapsed),
      "isTreeClosed" -> JsBoolean(post.isTreeClosed),
      "isApproved" -> JsBoolean(isApproved),
      "childIds" -> JsArray(post.replies.map(reply => JsNumber(reply.id))),
      "text" -> safeStringOrNull(text)))
  }


  val NoUserSpecificData = Json.obj(
    "permsOnPage" -> JsObject(Nil),
    "rolePageSettings" -> JsObject(Nil),
    "votes" -> JsObject(Nil),
    "unapprovedPosts" -> JsObject(Nil))


  def userDataJson(pageRequest: PageRequest[_]): JsObject = {
    val user = pageRequest.user getOrElse {
      return NoUserSpecificData
    }

    val rolePageSettings = user.anyRoleId map { roleId =>
      val settings = pageRequest.dao.loadRolePageSettings(
        roleId = roleId, pageId = pageRequest.thePageId)
      rolePageSettingsToJson(settings)
    } getOrElse JsNull

    Json.obj(
      "isLoggedIn" -> JsBoolean(true),
      "isAdmin" -> JsBoolean(user.isAdmin),
      "userId" -> safeJsString(user.id),
      "username" -> safeStringOrNull(user.username),
      "fullName" -> safeJsString(user.displayName),
      "isEmailKnown" -> JsBoolean(user.email.nonEmpty),
      "isAuthenticated" -> JsBoolean(user.isAuthenticated),
      "permsOnPage" -> permsOnPageJson(pageRequest.permsOnPage),
      "rolePageSettings" -> rolePageSettings,
      "votes" -> votesJson(pageRequest),
      "unapprovedPosts" -> unapprovedPostsJson(pageRequest))
  }


  def permsOnPageJson(perms: PermsOnPage): JsObject = {
    Json.obj(
      "accessPage" -> JsBoolean(perms.accessPage),
      "createPage" -> JsBoolean(perms.createPage),
      "moveRenamePage" -> JsBoolean(perms.moveRenamePage),
      "hidePageIdInUrl" -> JsBoolean(perms.hidePageIdInUrl),
      "editPageTemplate" -> JsBoolean(perms.editPageTemplate),
      "editPage" -> JsBoolean(perms.editPage),
      "editAnyReply" -> JsBoolean(perms.editAnyReply),
      "editGuestReply" -> JsBoolean(perms.editUnauReply),
      "collapseThings" -> JsBoolean(perms.collapseThings),
      "deleteAnyReply" -> JsBoolean(perms.deleteAnyReply),
      "pinReplies" -> JsBoolean(perms.pinReplies))
  }


  def rolePageSettingsToJson(settings: RolePageSettings): JsObject = {
    Json.obj(
      "notfLevel" -> safeJsString(settings.notfLevel.toString))
  }


  def votesJson(pageRequest: PageRequest[_]): JsObject = {
    val userVotesMap = pageRequest.thePage.userVotesMap(pageRequest.userIdData)
    val votesByPostId = userVotesMap map { case (postId, votes) =>
      var voteStrs = Vector[String]()
      if (votes.votedLike) voteStrs = voteStrs :+ "VoteLike"
      if (votes.votedWrong) voteStrs = voteStrs :+ "VoteWrong"
      if (votes.votedOffTopic) voteStrs = voteStrs :+ "VoteOffTopic"
      postId.toString -> Json.toJson(voteStrs)
    }
    JsObject(votesByPostId.toSeq)
  }


  def unapprovedPostsJson(request: PageRequest[_]): JsObject = {
    val relevantPosts =
      if (request.theUser.isAdmin) request.thePage.getAllPosts
      else request.thePage.postsByUser(request.theUser.id)

    val unapprovedPosts = relevantPosts filter { post =>
      !post.currentVersionApproved
    }

    val json = JsObject(unapprovedPosts.map { post =>
      post.id.toString -> postToJson(post, includeUnapproved = true)
    })

    json
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

