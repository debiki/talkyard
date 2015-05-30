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
import debiki.DebikiHttp.throwNotFound
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
          "userId" -> JsNumber(user.id),
          "username" -> JsStringOrNull(user.username),
          "fullName" -> JsString(user.displayName),
          "isEmailKnown" -> JsBoolean(user.email.nonEmpty),
          "isAuthenticated" -> JsBoolean(user.isAuthenticated))
    }
    userData
  }


  def pageToJson(pageReq: PageRequest[_], socialLinksHtml: String): JsObject = {
    if (pageReq.pageExists) {
      pageReq.dao.readOnlyTransaction(pageToJsonImpl(pageReq, socialLinksHtml, _))
    }
    else {
      if (pageReq.pagePath.value == HomepageUrlPath) {
        newEmptySitePageJson(pageReq)
      }
      else {
        throwNotFound("DwE404KGF2", "Page not found")
      }
    }
  }


  private def newEmptySitePageJson(pageReq: PageRequest[_]): JsObject = {
    val siteStatusString = loadSiteStatusString(pageReq)
    val siteSettings = pageReq.dao.loadWholeSiteSettings()
    Json.obj(
      "now" -> JsNumber((new ju.Date).getTime),
      "siteStatus" -> JsString(siteStatusString),
      "guestLoginAllowed" -> JsBoolean(siteSettings.guestLoginAllowed),
      "userMustBeAuthenticated" -> JsBoolean(siteSettings.userMustBeAuthenticated.asBoolean),
      "userMustBeApproved" -> JsBoolean(siteSettings.userMustBeApproved.asBoolean),
      "pageId" -> pageReq.thePageId,
      "pageRole" -> JsString(pageReq.thePageRole.toString),
      "pagePath" -> JsString(pageReq.pagePath.value),
      "numPosts" -> JsNumber(0),
      "numPostsExclTitle" -> JsNumber(0),
      "isInEmbeddedCommentsIframe" -> JsBoolean(false),
      "categories" -> JsArray(),
      "topics" -> JsArray(),
      "user" -> NoUserSpecificData,
      "rootPostId" -> JsNumber(PageParts.BodyId),
      "allPosts" -> JsObject(Nil),
      "topLevelCommentIdsSorted" -> JsArray(),
      "horizontalLayout" -> JsBoolean(false),
      "socialLinksHtml" -> JsNull)
  }


  def loadSiteStatusString(pageReq: PageRequest[_]): String =
    pageReq.dao.loadSiteStatus() match {
      case SiteStatus.OwnerCreationPending(adminEmail) =>
        var obfuscatedEmail = adminEmail.takeWhile(_ != '@')
        obfuscatedEmail = obfuscatedEmail.dropRight(3).take(4)
        s"AdminCreationPending:$obfuscatedEmail"
      case x => x.toString
    }


  private def pageToJsonImpl(pageReq: PageRequest[_], socialLinksHtml: String,
        transaction: SiteTransaction): JsObject = {
    val page = PageDao(pageReq.thePageId, transaction)
    val pageParts = page.parts
    pageParts.loadAllPosts()
    var allPostsJson = pageParts.allPosts.filter { post =>
      !post.deletedStatus.isDeleted || (
        post.deletedStatus.onlyThisDeleted && pageParts.hasNonDeletedSuccessor(post.id))
    } map { post: Post =>
      post.id.toString -> postToJsonImpl(post, page, pageReq.ctime)
    }
    val numPosts = allPostsJson.length
    val numPostsExclTitle = numPosts - (if (pageParts.titlePost.isDefined) 1 else 0)

    if (page.role == PageRole.EmbeddedComments) {
      allPostsJson +:=
        PageParts.BodyId.toString ->
          embeddedCommentsDummyRootPost(pageParts.topLevelComments)
    }

    val topLevelComments = pageParts.topLevelComments
    val topLevelCommentIdsSorted =
      Post.sortPosts(topLevelComments).map(reply => JsNumber(reply.id))

    val anyLatestTopics: Seq[JsObject] =
      if (page.role == PageRole.Forum) {
        val orderOffset = PageOrderOffset.ByBumpTime(None)
        var topics =
          pageReq.dao.listTopicsInTree(rootPageId = pageReq.thePageId,
            orderOffset, limit = controllers.ForumController.NumTopicsToList)
        val pageStuffById = pageReq.dao.loadPageStuff(topics.map(_.pageId))
        topics.map(controllers.ForumController.topicToJson(_, pageStuffById))
      }
      else {
        Nil
      }

    val siteStatusString = loadSiteStatusString(pageReq)
    val siteSettings = pageReq.dao.loadWholeSiteSettings()

    Json.obj(
      "now" -> JsNumber((new ju.Date).getTime),
      "siteStatus" -> JsString(siteStatusString),
      "guestLoginAllowed" -> JsBoolean(siteSettings.guestLoginAllowed),
      "userMustBeAuthenticated" -> JsBoolean(siteSettings.userMustBeAuthenticated.asBoolean),
      "userMustBeApproved" -> JsBoolean(siteSettings.userMustBeApproved.asBoolean),
      "pageId" -> pageReq.thePageId,
      "pageRole" -> JsString(page.role.toString),
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
      postToJsonImpl(page.parts.thePost(postId), page, transaction.currentTime,
        includeUnapproved = includeUnapproved)
    }
  }


  /** Private, so it cannot be called outside a transaction.
    */
  private def postToJsonImpl(post: Post, page: Page, currentTime: ju.Date,
        includeUnapproved: Boolean = false): JsObject = {
    val people = page.parts
    val lastApprovedEditAt = post.lastApprovedEditAt map { date =>
      JsNumber(date.getTime)
    } getOrElse JsNull

    val (anySanitizedHtml: Option[String], isApproved: Boolean) =
      if (includeUnapproved)
        (Some(post.currentHtmlSanitized(ReactRenderer, page.role)),
          post.isCurrentVersionApproved)
      else
        (post.approvedHtmlSanitized, post.approvedAt.isDefined)

    val childrenSorted = {
      val children = page.parts.childrenOf(post.id)
      Post.sortPosts(children)
    }

    val author = post.createdByUser(people)

    var fields = Vector(
      "uniqueId" -> JsNumber(post.uniqueId),
      "postId" -> JsNumber(post.id),
      "parentId" -> post.parentId.map(JsNumber(_)).getOrElse(JsNull),
      "multireplyPostIds" -> JsArray(post.multireplyPostIds.toSeq.map(JsNumber(_))),
      "authorId" -> JsString(post.createdById.toString),
      "authorFullName" -> JsString(author.displayName),
      "authorUsername" -> JsStringOrNull(author.username),
      "createdAt" -> JsNumber(post.createdAt.getTime),
      "lastApprovedEditAt" -> lastApprovedEditAt,
      "numEditors" -> JsNumber(post.numDistinctEditors),
      "numLikeVotes" -> JsNumber(post.numLikeVotes),
      "numWrongVotes" -> JsNumber(post.numWrongVotes),
      "numBuryVotes" -> JsNumber(post.numBuryVotes),
      "numPendingEditSuggestions" -> JsNumber(post.numPendingEditSuggestions),
      "isTreeDeleted" -> JsBoolean(post.deletedStatus.isTreeDeleted),
      "isPostDeleted" -> JsBoolean(post.deletedStatus.isPostDeleted),
      "isTreeCollapsed" -> JsBoolean(post.collapsedStatus.isTreeCollapsed),
      "isPostCollapsed" -> JsBoolean(post.collapsedStatus.isPostCollapsed),
      "isTreeClosed" -> JsBoolean(post.closedStatus.isTreeClosed),
      "isApproved" -> JsBoolean(isApproved),
      "pinnedPosition" -> post.pinnedPosition.map(JsNumber(_)).getOrElse(JsNull),
      "likeScore" -> JsNumber(post.likeScore),
      "childIdsSorted" -> JsArray(childrenSorted.map(reply => JsNumber(reply.id))),
      "sanitizedHtml" -> JsStringOrNull(anySanitizedHtml))

    if (author.isSuspendedAt(currentTime)) {
      author.suspendedTill match {
        case None => fields :+= "authorSuspendedTill" -> JsString("Forever")
        case Some(date) => fields :+= "authorSuspendedTill" -> JsNumber(date.getTime)
      }
    }

    JsObject(fields)
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
      "userId" -> JsNumber(user.id),
      "username" -> JsStringOrNull(user.username),
      "fullName" -> JsString(user.displayName),
      "isEmailKnown" -> JsBoolean(user.email.nonEmpty),
      "isAuthenticated" -> JsBoolean(user.isAuthenticated),
      "permsOnPage" -> permsOnPageJson(permsOnPage),
      "rolePageSettings" -> rolePageSettings,
      "votes" -> votesJson(user.id, pageId, transaction),
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


  private def votesJson(userId: UserId, pageId: PageId, transaction: SiteTransaction): JsObject = {
    val actions = transaction.loadActionsByUserOnPage(userId, pageId)
    val votes = actions.filter(_.isInstanceOf[PostVote]).asInstanceOf[immutable.Seq[PostVote]]
    val userVotesMap = UserPostVotes.makeMap(votes)
    val votesByPostId = userVotesMap map { case (postId, votes) =>
      var voteStrs = Vector[String]()
      if (votes.votedLike) voteStrs = voteStrs :+ "VoteLike"
      if (votes.votedWrong) voteStrs = voteStrs :+ "VoteWrong"
      if (votes.votedBury) voteStrs = voteStrs :+ "VoteBury"
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
    val pageStuffById = request.dao.loadPageStuff(categories.map(_.pageId))
    val categoriesJson = JsArray(categories map { category =>
      val pageStuff = pageStuffById.get(category.pageId) getOrDie "DwE3KE78"
      val categoryName = pageStuff.title
      JsObject(Seq(
        "name" -> JsString(categoryName),
        "pageId" -> JsString(category.pageId),
        "slug" -> JsString(controllers.ForumController.categoryNameToSlug(categoryName)),
        "subCategories" -> JsArray()))
    })
    categoriesJson
  }


  def JsStringOrNull(value: Option[String]) =
    value.map(JsString(_)).getOrElse(JsNull)

  def JsBooleanOrNull(value: Option[Boolean]) =
    value.map(JsBoolean(_)).getOrElse(JsNull)

  def JsNumberOrNull(value: Option[Int]) =
    value.map(JsNumber(_)).getOrElse(JsNull)

  def JsLongOrNull(value: Option[Long]) =
    value.map(JsNumber(_)).getOrElse(JsNull)

  def DateEpochOrNull(value: Option[ju.Date]) =
    value.map(date => JsNumber(date.getTime)).getOrElse(JsNull)

}

