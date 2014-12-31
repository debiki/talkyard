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


  def userNoPageToJson(anyUser: Option[User]): JsObject = {
    // Warning: some dupl code, see `userDataJson()` below.
    val userData = anyUser match {
      case None => JsObject(Nil)
      case Some(user) =>
        Json.obj(
          "isLoggedIn" -> JsBoolean(true),
          "isAdmin" -> JsBoolean(user.isAdmin),
          "userId" -> JsString(user.id),
          "username" -> JsStringOrNull(user.username),
          "fullName" -> JsString(user.displayName),
          "isEmailKnown" -> JsBoolean(user.email.nonEmpty),
          "isAuthenticated" -> JsBoolean(user.isAuthenticated))
    }
    Json.obj("user" -> userData)
  }


  def pageToJson(pageReq: PageRequest[_], socialLinksHtml: String): JsObject = {
    val numPosts = pageReq.thePageParts.postCount
    val numPostsExclTitle =
      numPosts - (if (pageReq.thePageParts.titlePost.isDefined) 1 else 0)

    var allPostsJson = pageReq.thePageParts.getAllPosts.map { post =>
      post.id.toString -> postToJson(post)
    }

    if (pageReq.thePageRole == PageRole.EmbeddedComments) {
      allPostsJson +:=
        PageParts.BodyId.toString ->
          embeddedCommentsDummyRootPost(pageReq.thePageParts.topLevelComments)
    }

    val topLevelComments = pageReq.thePageParts.topLevelComments
    val topLevelCommentIdsSorted =
      Post.sortPosts(topLevelComments).map(reply => JsNumber(reply.id))

    Json.obj(
      "now" -> JsNumber((new ju.Date).getTime),
      "pageId" -> pageReq.thePageId,
      "pageRole" -> JsString(pageReq.thePageRole.toString),
      "numPosts" -> numPosts,
      "numPostsExclTitle" -> numPostsExclTitle,
      "isInEmbeddedCommentsIframe" -> JsBoolean(pageReq.pageRole == Some(PageRole.EmbeddedComments)),
      "categories" -> categoriesJson(pageReq),
      "user" -> NoUserSpecificData,
      "rootPostId" -> JsNumber(BigDecimal(pageReq.pageRoot getOrElse PageParts.BodyId)),
      "allPosts" -> JsObject(allPostsJson),
      "topLevelCommentIdsSorted" -> JsArray(topLevelCommentIdsSorted),
      "horizontalLayout" -> JsBoolean(pageReq.thePageSettings.horizontalComments.valueIsTrue),
      "socialLinksHtml" -> JsString(socialLinksHtml))
  }


  def postToJson(post: Post, includeUnapproved: Boolean = false): JsObject = {
    val lastEditAppliedAt = post.lastEditAppliedAt map { date =>
      JsNumber(date.getTime)
    } getOrElse JsNull

    val (sanitizedHtml, isApproved) =
      if (includeUnapproved)
        (Some(post.currentHtmlSanitized), post.currentVersionApproved)
      else
        (post.approvedHtmlSanitized, post.approvedHtmlSanitized.nonEmpty)

    JsObject(Vector(
      "postId" -> JsNumber(post.id),
      "parentId" -> post.parentId.map(JsNumber(_)).getOrElse(JsNull),
      "multireplyPostIds" -> JsArray(post.multireplyPostIds.toSeq.map(JsNumber(_))),
      "authorId" -> JsString(post.userId),
      "authorFullName" -> JsStringOrNull(Some(post.theUser.displayName)),
      "authorUsername" -> JsStringOrNull(post.theUser.username),
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
      "pinnedPosition" -> post.pinnedPosition.map(JsNumber(_)).getOrElse(JsNull),
      "likeScore" -> JsNumber(post.likeScore),
      "childIdsSorted" -> JsArray(Post.sortPosts(post.replies).map(reply => JsNumber(reply.id))),
      "sanitizedHtml" -> JsStringOrNull(sanitizedHtml)))
  }


  /** Creates a dummy root post, needed when rendering React elements. */
  def embeddedCommentsDummyRootPost(topLevelComments: Seq[Post]) = Json.obj(
    "postId" -> JsNumber(PageParts.BodyId),
    "childIdsSorted" -> JsArray(Post.sortPosts(topLevelComments).map(reply => JsNumber(reply.id))))


  val NoUserSpecificData = Json.obj(
    "permsOnPage" -> JsObject(Nil),
    "rolePageSettings" -> JsObject(Nil),
    "votes" -> JsObject(Nil),
    "unapprovedPosts" -> JsObject(Nil),
    "postIdsAutoReadLongAgo" -> JsArray(Nil),
    "postIdsAutoReadNow" -> JsArray(Nil),
    "marksByPostId" -> JsObject(Nil))


  def userDataJson(pageRequest: PageRequest[_]): Option[JsObject] = {
    val user = pageRequest.user getOrElse {
      return None
    }

    val rolePageSettings = user.anyRoleId map { roleId =>
      val settings = pageRequest.dao.loadRolePageSettings(
        roleId = roleId, pageId = pageRequest.thePageId)
      rolePageSettingsToJson(settings)
    } getOrElse JsNull

    // Warning: some dupl code, see `userNoPageToJson()` above.
    Some(Json.obj(
      "isLoggedIn" -> JsBoolean(true),
      "isAdmin" -> JsBoolean(user.isAdmin),
      "userId" -> JsString(user.id),
      "username" -> JsStringOrNull(user.username),
      "fullName" -> JsString(user.displayName),
      "isEmailKnown" -> JsBoolean(user.email.nonEmpty),
      "isAuthenticated" -> JsBoolean(user.isAuthenticated),
      "permsOnPage" -> permsOnPageJson(pageRequest.permsOnPage),
      "rolePageSettings" -> rolePageSettings,
      "votes" -> votesJson(pageRequest),
      "unapprovedPosts" -> unapprovedPostsJson(pageRequest),
      "postIdsAutoReadLongAgo" -> JsArray(Nil),
      "postIdsAutoReadNow" -> JsArray(Nil),
      "marksByPostId" -> JsObject(Nil)))
  }


  private def permsOnPageJson(perms: PermsOnPage): JsObject = {
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


  private def rolePageSettingsToJson(settings: RolePageSettings): JsObject = {
    Json.obj(
      "notfLevel" -> JsString(settings.notfLevel.toString))
  }


  private def votesJson(pageRequest: PageRequest[_]): JsObject = {
    val userVotesMap = pageRequest.thePageParts.userVotesMap(pageRequest.userIdData)
    val votesByPostId = userVotesMap map { case (postId, votes) =>
      var voteStrs = Vector[String]()
      if (votes.votedLike) voteStrs = voteStrs :+ "VoteLike"
      if (votes.votedWrong) voteStrs = voteStrs :+ "VoteWrong"
      if (votes.votedOffTopic) voteStrs = voteStrs :+ "VoteOffTopic"
      postId.toString -> Json.toJson(voteStrs)
    }
    JsObject(votesByPostId.toSeq)
  }


  private def unapprovedPostsJson(request: PageRequest[_]): JsObject = {
    val relevantPosts =
      if (request.theUser.isAdmin) request.thePageParts.getAllPosts
      else request.thePageParts.postsByUser(request.theUser.id)

    val unapprovedPosts = relevantPosts filter { post =>
      !post.currentVersionApproved
    }

    val json = JsObject(unapprovedPosts.map { post =>
      post.id.toString -> postToJson(post, includeUnapproved = true)
    })

    json
  }


  private def categoriesJson(request: PageRequest[_]): JsArray = {
    if (request.pageRole != Some(PageRole.Forum))
      return JsArray(Nil)

    val categories: Seq[Category] = request.dao.loadCategoryTree(request.thePageId)
    val categoriesJson = JsArray(categories map { category =>
      JsObject(Seq(
        "name" -> JsString(category.categoryName),
        "pageId" -> JsString(category.pageId),
        "slug" -> JsString(controllers.ForumController.categoryNameToSlug(category.categoryName)),
        "subCategories" -> JsArray()))
    })
    categoriesJson
  }


  private def JsStringOrNull(value: Option[String]) =
    value.map(JsString(_)).getOrElse(JsNull)

}

