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
import debiki.dao.{SiteDao, PageDao}
import play.api.libs.json._
import scala.collection.immutable
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
    userData
  }


  def pageToJson(pageReq: PageRequest[_], socialLinksHtml: String): JsObject = {
    pageReq.dao.readOnlyTransaction(pageToJsonImpl(pageReq, socialLinksHtml, _))
  }


  private def pageToJsonImpl(pageReq: PageRequest[_], socialLinksHtml: String,
        transaction: SiteTransaction): JsObject = {
    val page = PageDao(pageReq.thePageId, transaction)
    val pageParts = page.parts
    pageParts.loadAllPosts()
    var allPostsJson = pageParts.allPosts.filter { post =>
      post.deletedStatus.isEmpty || (
        post.deletedStatus == Some(DeletedStatus.PostDeleted) &&
        pageParts.hasNonDeletedSuccessor(post.id))
    } map { post: Post2 =>
      post.id.toString -> postToJsonImpl(post, page)
    }
    val numPosts = allPostsJson.length
    val numPostsExclTitle = numPosts - (if (pageParts.titlePost.isDefined) 1 else 0)

    if (pageReq.thePageRole == PageRole.EmbeddedComments) {
      allPostsJson +:=
        PageParts.BodyId.toString ->
          embeddedCommentsDummyRootPost(pageParts.topLevelComments)
    }

    val topLevelComments = pageParts.topLevelComments
    val topLevelCommentIdsSorted =
      Post.sortPosts2(topLevelComments).map(reply => JsNumber(reply.id))

    val anyLatestTopics: Seq[JsObject] =
      if (pageReq.thePageRole == PageRole.Forum) {
        val orderOffset = PageOrderOffset.ByBumpTime(None)
        var topics =
          pageReq.dao.listTopicsInTree(rootPageId = pageReq.thePageId,
            orderOffset, limit = controllers.ForumController.NumTopicsToList)
        topics.map(controllers.ForumController.topicToJson(_))
      }
      else {
        Nil
      }

    val siteStatusString = pageReq.dao.loadSiteStatus() match {
      case SiteStatus.OwnerCreationPending(adminEmail) =>
        var obfuscatedEmail = adminEmail.takeWhile(_ != '@')
        obfuscatedEmail = obfuscatedEmail.dropRight(3).take(4)
        s"AdminCreationPending:$obfuscatedEmail"
      case x => x.toString
    }

    Json.obj(
      "now" -> JsNumber((new ju.Date).getTime),
      "siteStatus" -> JsString(siteStatusString),
      "pageId" -> pageReq.thePageId,
      "pageRole" -> JsString(pageReq.thePageRole.toString),
      "pagePath" -> JsString(pageReq.pagePath.value),
      "numPosts" -> numPosts,
      "numPostsExclTitle" -> numPostsExclTitle,
      "isInEmbeddedCommentsIframe" -> JsBoolean(pageReq.pageRole == Some(PageRole.EmbeddedComments)),
      "categories" -> categoriesJson(pageReq),
      "topics" -> JsArray(anyLatestTopics),
      "user" -> NoUserSpecificData,
      "rootPostId" -> JsNumber(BigDecimal(pageReq.pageRoot getOrElse PageParts.BodyId)),
      "allPosts" -> JsObject(allPostsJson),
      "topLevelCommentIdsSorted" -> JsArray(topLevelCommentIdsSorted),
      "horizontalLayout" -> JsBoolean(pageReq.thePageSettings.horizontalComments.valueAsBoolean),
      "socialLinksHtml" -> JsString(socialLinksHtml))
  }


  def postToJson2(postId: PostId, pageId: PageId, dao: SiteDao, includeUnapproved: Boolean = false)
        : JsObject = {
    dao.readOnlyTransaction { transaction =>
      // COULD optimize: don't load the whole page, load only postId and the author and last editor.
      val page = PageDao(pageId, transaction)
      postToJsonImpl(page.parts.thePost(postId), page, includeUnapproved = includeUnapproved)
    }
  }


  /** Private, so it cannot be called outside a transaction.
    */
  private def postToJsonImpl(post: Post2, page: Page2, includeUnapproved: Boolean = false)
        : JsObject = {
    val people = page.parts
    val lastApprovedEditAt = post.lastApprovedEditAt map { date =>
      JsNumber(date.getTime)
    } getOrElse JsNull

    val (anySanitizedHtml: Option[String], isApproved: Boolean) =
      if (includeUnapproved)
        (Some(post.currentHtmlSanitized(ReactRenderer, page.role)),
          post.currentVersionIsApproved)
      else
        (post.approvedHtmlSanitized, post.approvedAt.isDefined)

    val childrenSorted = {
      val children = page.parts.childrenOf(post.id)
      Post.sortPosts2(children)
    }

    JsObject(Vector(
      "postId" -> JsNumber(post.id),
      "parentId" -> post.parentId.map(JsNumber(_)).getOrElse(JsNull),
      "multireplyPostIds" -> JsArray(post.multireplyPostIds.toSeq.map(JsNumber(_))),
      "authorId" -> JsString(post.createdById.toString),
      "authorFullName" -> JsString(post.createdByUser(people).displayName),
      "authorUsername" -> JsStringOrNull(post.createdByUser(people).username),
      "createdAt" -> JsNumber(post.createdAt.getTime),
      "lastEditAppliedAt" -> lastApprovedEditAt, // TODO rename JSON field
      "numEditors" -> JsNumber(post.numDistinctEditors),
      "numLikeVotes" -> JsNumber(post.numLikeVotes),
      "numWrongVotes" -> JsNumber(post.numWrongVotes),
      "numOffTopicVotes" -> JsNumber(0), // remove off-topic votes? post.numOffTopicVotes
      "numPendingEditSuggestions" -> JsNumber(post.numPendingEditSuggestions),
      "isTreeDeleted" -> JsBoolean(post.deletedStatus == Some(DeletedStatus.TreeDeleted)),
      "isPostDeleted" -> JsBoolean(post.deletedStatus == Some(DeletedStatus.PostDeleted)),
      "isTreeCollapsed" -> JsBoolean(post.collapsedStatus == Some(CollapsedStatus.TreeCollapsed)),
      "isPostCollapsed" -> JsBoolean(post.collapsedStatus == Some(CollapsedStatus.PostCollapsed)),
      "isTreeClosed" -> JsBoolean(post.closedStatus == Some(ClosedStatus.TreeClosed)),
      "isApproved" -> JsBoolean(isApproved),
      "pinnedPosition" -> post.pinnedPosition.map(JsNumber(_)).getOrElse(JsNull),
      "likeScore" -> JsNumber(post.likeScore),
      "childIdsSorted" -> JsArray(childrenSorted.map(reply => JsNumber(reply.id))),
      "sanitizedHtml" -> JsStringOrNull(anySanitizedHtml)))
  }


  /** Creates a dummy root post, needed when rendering React elements. */
  def embeddedCommentsDummyRootPost(topLevelComments: Seq[Post2]) = Json.obj(
    "postId" -> JsNumber(PageParts.BodyId),
    "childIdsSorted" -> JsArray(Post.sortPosts2(topLevelComments).map(reply => JsNumber(reply.id))))


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
    pageRequest.dao.readOnlyTransaction { transaction =>
      userDataJsonImpl(user, pageRequest.thePageId, pageRequest.permsOnPage, transaction)
    }
  }


  private def userDataJsonImpl(user: User, pageId: PageId, permsOnPage: PermsOnPage,
        transaction: SiteTransaction): Option[JsObject] = {
    val rolePageSettings = user.anyRoleId map { roleId =>
      val anySettings = transaction.loadRolePageSettings(roleId = roleId, pageId = pageId)
      rolePageSettingsToJson(anySettings getOrElse RolePageSettings.Default)
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
      "permsOnPage" -> permsOnPageJson(permsOnPage),
      "rolePageSettings" -> rolePageSettings,
      "votes" -> votesJson(user.id2, pageId, transaction),
      "unapprovedPosts" -> unapprovedPostsJson(user.id, pageId, transaction),
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


  private def votesJson(userId: UserId2, pageId: PageId, transaction: SiteTransaction): JsObject = {
    val actions = transaction.loadActionsByUserOnPage(userId, pageId)
    val votes = actions.filter(_.isInstanceOf[PostVote]).asInstanceOf[immutable.Seq[PostVote]]
    val userVotesMap = UserPostVotes.makeMap(votes)
    val votesByPostId = userVotesMap map { case (postId, votes) =>
      var voteStrs = Vector[String]()
      if (votes.votedLike) voteStrs = voteStrs :+ "VoteLike"
      if (votes.votedWrong) voteStrs = voteStrs :+ "VoteWrong"
      if (votes.votedOffTopic) voteStrs = voteStrs :+ "VoteOffTopic"
      postId.toString -> Json.toJson(voteStrs)
    }
    JsObject(votesByPostId.toSeq)
  }


  private def unapprovedPostsJson(userId: UserId, pageId: PageId, transaction: SiteTransaction)
        : JsObject = {
    // I'm rewriting/refactoring and right now all posts are approved directly, so for now:
    JsObject(Nil)
    /* Previously:
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
    */
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

