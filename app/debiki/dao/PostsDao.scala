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

package debiki.dao

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.User.SystemUserId
import debiki._
import debiki.DebikiHttp._
import java.{util => ju}
import scala.collection.{mutable, immutable}


/** Loads and saves pages and page parts (e.g. posts and patches).
  *
  * (There's also a class PageDao (with no 's' in the name) that focuses on
  * one specific single page.)
  *
  * SHOULD make the full text search indexer work again
  */
trait PostsDao {
  self: SiteDao =>


  def insertReply(text: String, pageId: PageId, replyToPostIds: Set[PostId],
        authorId: UserId): PostId = {
    val htmlSanitized = siteDbDao.commonMarkRenderer.renderAndSanitizeCommonMark(
      text, allowClassIdDataAttrs = false, followLinks = false)

    val postId = readWriteTransaction { transaction =>
      val page = PageDao(pageId, transaction)
      val postId = page.parts.highestReplyId.map(_ + 1) getOrElse PageParts.FirstReplyId
      val commonAncestorId = page.parts.findCommonAncestorId(replyToPostIds.toSeq)
      val parentId =
        if (commonAncestorId == PageParts.NoId) {
          if (page.role == PageRole.EmbeddedComments) {
            // There is no page body. Allow new comment threads with no parent post.
            None
          }
          else {
            throwBadReq("DwE260G8", "Not an embedded discussion. You must reply to something")
          }
        }
        else if (page.parts.post(commonAncestorId).isDefined) {
          Some(commonAncestorId)
        }
        else {
          throwBadReq("DwEe8HD36", o"""Cannot reply to common ancestor post '$commonAncestorId';
            it does not exist""")
        }
      val anyParent = parentId.map(page.parts.thePost)
      if (anyParent.map(_.deletedStatus.isDeleted) == Some(true))
        throwForbidden(
          "The parent post has been deleted; cannot reply to a deleted post", "DwE5KDE7")

      // SHOULD authorize. For now, no restrictions.
      val isApproved = true // for now
      val author = transaction.loadUser(authorId) getOrElse throwNotFound("DwE404UF3", "Bad user")
      val approverId =
        if (author.isAdmin) {
          author.id
        }
        else {
          SystemUserId
        }

      val newPost = Post.create(
        siteId = siteId,
        pageId = pageId,
        postId = postId,
        parent = anyParent,
        multireplyPostIds = replyToPostIds,
        createdAt = transaction.currentTime,
        createdById = authorId,
        source = text,
        htmlSanitized = htmlSanitized,
        approvedById = Some(approverId))

      val oldMeta = page.meta
      val newMeta = oldMeta.copy(
        bumpedAt = Some(transaction.currentTime),
        numRepliesVisible = page.parts.numRepliesVisible + (isApproved ? 1 | 0),
        numRepliesTotal = page.parts.numRepliesTotal + 1)

      transaction.insertPost(newPost)
      transaction.updatePageMeta(newMeta, oldMeta = oldMeta)

      val notifications = NotificationGenerator(transaction).generateForNewPost(page, newPost)
      transaction.saveDeleteNotifications(notifications)
      postId
    }

    refreshPageInAnyCache(pageId)
    postId
  }


  def editPost(pageId: PageId, postId: PostId, editorId: UserId, newText: String) {
    readWriteTransaction { transaction =>
      val page = PageDao(pageId, transaction)
      var postToEdit = page.parts.post(postId).getOrElse(
        throwNotFound("DwE404GKF2", s"Post not found, id: '$postId'"))

      if (postToEdit.currentSource == newText)
        return

      val editor = transaction.loadUser(editorId).getOrElse(
        throwNotFound("DwE30HY21", s"User not found, id: '$editorId'"))

      // For now: (add back edit suggestions later. And should perhaps use PermsOnPage.)
      val editsOwnPost = editorId == postToEdit.createdById
      val mayEdit = editsOwnPost || editor.isAdmin
      if (!mayEdit)
        throwForbidden("DwE8KF32", "Currently you may edit your own posts only.")

      //val appliedDirectly = true // for now, add back edit suggestions later
      //val approvedDirectly = true // later: && editor.isWellBehavedUser

      var editedPost = postToEdit.copy(
        lastEditedAt = Some(transaction.currentTime),
        lastEditedById = Some(editorId))

      val approvedHtmlSanitized =
        if (postId == PageParts.TitleId) {
          siteDbDao.commonMarkRenderer.sanitizeHtml(newText)
        }
        else {
          siteDbDao.commonMarkRenderer.renderAndSanitizeCommonMark(newText,
            allowClassIdDataAttrs = postId == PageParts.BodyId,
            followLinks = postToEdit.createdByUser(page.parts).isAdmin && editor.isAdmin)
        }

      val approverId = if (editor.isAdmin) editor.id else SystemUserId
      val nextVersion = postToEdit.currentVersion + 1

      // COULD send current version from browser to server, reject edits if != oldPost.currentVersion
      // to stop the lost update problem.

      // Later, if post not approved directly: currentSourcePatch = makePatch(from, to)

      editedPost = editedPost.copy(
        lastApprovedEditAt = Some(transaction.currentTime),
        lastApprovedEditById = Some(editorId),
        approvedSource = Some(newText),
        approvedHtmlSanitized = Some(approvedHtmlSanitized),
        approvedAt = Some(transaction.currentTime),
        approvedById = Some(approverId),
        approvedVersion = Some(nextVersion),
        currentSourcePatch = None,
        currentVersion = nextVersion)

      if (editorId != editedPost.createdById) {
        editedPost = editedPost.copy(numDistinctEditors = 2)  // for now
      }

      transaction.updatePost(editedPost)

      if (editedPost.isCurrentVersionApproved) {
        val notfs = NotificationGenerator(transaction).generateForEdits(postToEdit, editedPost)
        transaction.saveDeleteNotifications(notfs)
      }

      // Bump the page, if the article / original post was edited.
      // (This is how Discourse works and people seems to like it. However,
      // COULD add a don't-bump option for minor edits.)
      if (postId == PageParts.BodyId && editedPost.isCurrentVersionApproved) {
        val oldMeta = page.meta
        val newMeta = oldMeta.copy(bumpedAt = Some(transaction.currentTime))
        transaction.updatePageMeta(newMeta, oldMeta = oldMeta)
      }
    }

    refreshPageInAnyCache(pageId)
  }


  def changePostStatus(postId: PostId, pageId: PageId, action: PostStatusAction, userId: UserId) {
    import com.debiki.core.{PostStatusAction => PSA}
    readWriteTransaction { transaction =>
      val page = PageDao(pageId, transaction)

      val postBefore = page.parts.thePost(postId)
      val user = transaction.loadUser(userId) getOrElse throwForbidden("DwE3KFW2", "Bad user id")

      // Authorization.
      if (!user.isAdmin) {
        if (postBefore.createdById != userId)
          throwForbidden("DwE0PK24", "You may not modify that post, it's not yours")

        if (!action.isInstanceOf[PSA.DeletePost] && action != PSA.CollapsePost)
          throwForbidden("DwE5JKF7", "You may not modify the whole tree")
      }

      val isChangingDeletePostToDeleteTree =
        postBefore.deletedStatus.onlyThisDeleted && action == PSA.DeleteTree
      if (postBefore.isDeleted && !isChangingDeletePostToDeleteTree)
        throwForbidden("DwE5GUK5", "This post has been deleted")

      var numRepliesGone = 0

      // Update the directly affected post.
      val postAfter = action match {
        case PSA.CloseTree =>
          postBefore.copyWithNewStatus(transaction.currentTime, userId, treeClosed = true)
        case PSA.CollapsePost =>
          postBefore.copyWithNewStatus(transaction.currentTime, userId, postCollapsed = true)
        case PSA.CollapseTree =>
          postBefore.copyWithNewStatus(transaction.currentTime, userId, treeCollapsed = true)
        case PSA.DeletePost(clearFlags) =>
          if (postBefore.isReply) {
            numRepliesGone += 1
          }
          postBefore.copyWithNewStatus(transaction.currentTime, userId, postDeleted = true)
        case PSA.DeleteTree =>
          if (postBefore.isReply) {
            numRepliesGone += 1
          }
          postBefore.copyWithNewStatus(transaction.currentTime, userId, treeDeleted = true)
      }

      transaction.updatePost(postAfter)

      // Update any indirectly affected posts, e.g. subsequent comments in the same
      // thread that are being deleted recursively.
      for (successor <- page.parts.successorsOf(postId)) {
        val anyUpdatedSuccessor: Option[Post] = action match {
          case PSA.CloseTree =>
            if (successor.closedStatus.areAncestorsClosed) None
            else Some(successor.copyWithNewStatus(
              transaction.currentTime, userId, ancestorsClosed = true))
          case PSA.CollapsePost =>
            None
          case PSA.CollapseTree =>
            if (successor.collapsedStatus.areAncestorsCollapsed) None
            else Some(successor.copyWithNewStatus(
              transaction.currentTime, userId, ancestorsCollapsed = true))
          case PSA.DeletePost(clearFlags) =>
            None
          case PSA.DeleteTree =>
            if (!successor.deletedStatus.isDeleted && successor.isReply) {
              numRepliesGone += 1
            }
            if (successor.deletedStatus.areAncestorsDeleted) None
            else Some(successor.copyWithNewStatus(
              transaction.currentTime, userId, ancestorsDeleted = true))
        }

        anyUpdatedSuccessor foreach { updatedSuccessor =>
          transaction.updatePost(updatedSuccessor)
        }
      }

      if (numRepliesGone > 0) {
        val oldMeta = page.meta
        val newMeta = oldMeta.copy(
          numRepliesVisible = oldMeta.numRepliesVisible - numRepliesGone)
        transaction.updatePageMeta(newMeta, oldMeta = oldMeta)
      }

      // In the future: if is a forum topic, and we're restoring the OP, then bump the topic.
    }

    refreshPageInAnyCache(pageId)
  }


  def approvePost(pageId: PageId, postId: PostId, approverId: UserId) {
    readWriteTransaction { transaction =>
      val page = PageDao(pageId, transaction)
      val pageMeta = page.meta
      val postBefore = page.parts.thePost(postId)
      if (postBefore.isCurrentVersionApproved)
        throwForbidden("DwE4GYUR2", "Post already approved")

      // If this version is being approved by a human, then it's safe.
      val safeVersion =
        if (approverId != SystemUserId) Some(postBefore.currentVersion)
        else postBefore.safeVersion

      val postAfter = postBefore.copy(
        safeVersion = safeVersion,
        approvedVersion = Some(postBefore.currentVersion),
        approvedAt = Some(transaction.currentTime),
        approvedById = Some(approverId),
        approvedSource = Some(postBefore.currentSource),
        approvedHtmlSanitized = Some(postBefore.currentHtmlSanitized(
          siteDbDao.commonMarkRenderer, pageMeta.pageRole)))
      transaction.updatePost(postAfter)

      val isApprovingPageBody = postId == PageParts.BodyId
      val isApprovingNewPost = postBefore.approvedVersion.isEmpty

      // Bump page if new post added, or page body edited.
      if (isApprovingNewPost || isApprovingPageBody) {
        val numNewReplies = (isApprovingNewPost && postAfter.isReply) ? 1 | 0
        val newMeta = pageMeta.copy(
          numRepliesVisible = pageMeta.numRepliesVisible + numNewReplies,
          bumpedAt = Some(transaction.currentTime))
        transaction.updatePageMeta(newMeta, oldMeta = pageMeta)
      }

      val notifications =
        if (isApprovingNewPost) {
          NotificationGenerator(transaction).generateForNewPost(page, postAfter)
        }
        else {
          NotificationGenerator(transaction).generateForEdits(postBefore, postAfter)
        }
      transaction.saveDeleteNotifications(notifications)
    }

    refreshPageInAnyCache(pageId)
  }


  def deletePost(pageId: PageId, postId: PostId, deletedById: UserId) {
    changePostStatus(pageId = pageId, postId = postId,
      action = PostStatusAction.DeletePost(clearFlags = false), userId = deletedById)
  }


  def deleteVote(pageId: PageId, postId: PostId, voteType: PostVoteType, voterId: UserId) {
    readWriteTransaction { transaction =>
      transaction.deleteVote(pageId, postId, voteType, voterId = voterId)
      updateVoteCounts(pageId, postId = postId, transaction)
      /* FRAUD SHOULD delete by cookie too, like I did before:
      var numRowsDeleted = 0
      if ((userIdData.anyGuestId.isDefined && userIdData.userId != UnknownUser.Id) ||
        userIdData.anyRoleId.isDefined) {
        numRowsDeleted = deleteVoteByUserId()
      }
      if (numRowsDeleted == 0 && userIdData.browserIdCookie.isDefined) {
        numRowsDeleted = deleteVoteByCookie()
      }
      if (numRowsDeleted > 1) {
        assErr("DwE8GCH0", o"""Too many votes deleted, page `$pageId' post `$postId',
          user: $userIdData, vote type: $voteType""")
      }
      */
    }
    refreshPageInAnyCache(pageId)
  }


  def voteOnPost(pageId: PageId, postId: PostId, voteType: PostVoteType,
        voterId: UserId, voterIp: String, postIdsRead: Set[PostId]) {
    readWriteTransaction { transaction =>
      val post = transaction.loadThePost(pageId, postId)
      if (voteType == PostVoteType.Like) {
        if (post.createdById == voterId)
          throwForbidden("DwE84QM0", "Cannot like own post")
      }

      try { transaction.insertVote(pageId, postId, voteType, voterId = voterId) }
      catch {
        case DbDao.DuplicateVoteException =>
          throwForbidden("Dw403BKW2", "You have already voted")
      }

      // Update post read stats.
      // Downvotes (wrong, boring) should result in only the downvoted post
      // being marked as read, because a post *not* being downvoted shouldn't
      // give that post worse rating. (Remember that the rating of a post is
      // roughly the number of Like votes / num-times-it's-been-read.)
      val postsToMarkAsRead =
        if (voteType == PostVoteType.Like)
          postIdsRead  // those posts were not upvoted
        else
          Set(postId)  // that post was downvoted

      transaction.updatePostsReadStats(pageId, postsToMarkAsRead, readById = voterId,
        readFromIp = voterIp)

      updateVoteCounts(post, transaction)
    }
    refreshPageInAnyCache(pageId)
  }


  def loadThingsToReview(): ThingsToReview = {
    readOnlyTransaction { transaction =>
      val posts = transaction.loadPostsToReview()
      val pageMetas = transaction.loadPageMetas(posts.map(_.pageId))
      val flags = transaction.loadFlagsFor(posts.map(_.pagePostId))
      val userIds = mutable.HashSet[UserId]()
      userIds ++= posts.map(_.createdById)
      userIds ++= posts.flatMap(_.lastEditedById)
      userIds ++= flags.map(_.flaggerId)
      val users = transaction.loadUsers(userIds.toSeq)
      ThingsToReview(posts, pageMetas, users, flags)
    }
  }


  def flagPost(pageId: PageId, postId: PostId, flagType: PostFlagType, flaggerId: UserId) {
    readWriteTransaction { transaction =>
      val postBefore = transaction.loadThePost(pageId, postId)
      // SHOULD if >= 2 pending flags, then hide post until reviewed? And unhide, if flags cleared.
      val postAfter = postBefore.copy(numPendingFlags = postBefore.numPendingFlags + 1)
      transaction.insertFlag(pageId, postId, flagType, flaggerId)
      transaction.updatePost(postAfter)
    }
    refreshPageInAnyCache(pageId)
  }


  def clearFlags(pageId: PageId, postId: PostId, clearedById: UserId): Unit = {
    readWriteTransaction { transaction =>
      val postBefore = transaction.loadThePost(pageId, postId)
      val postAfter = postBefore.copy(
        numPendingFlags = 0,
        numHandledFlags = postBefore.numHandledFlags + postBefore.numPendingFlags)
      transaction.updatePost(postAfter)
      transaction.clearFlags(pageId, postId, clearedById = clearedById)
    }
    // In case the post gets unhidden now when flags gone:
    refreshPageInAnyCache(pageId)
  }


  def loadPostsReadStats(pageId: PageId): PostsReadStats =
    siteDbDao.loadPostsReadStats(pageId)


  def loadPost(pageId: PageId, postId: PostId): Option[Post] =
    readOnlyTransaction(_.loadPost(pageId, postId))


  private def updateVoteCounts(pageId: PageId, postId: PostId, transaction: SiteTransaction): Unit = {
    val post = transaction.loadThePost(pageId, postId = postId)
    updateVoteCounts(post, transaction)
  }


  private def updateVoteCounts(post: Post, transaction: SiteTransaction) {
    val actions = transaction.loadActionsDoneToPost(post.pageId, postId = post.id)
    val readStats = transaction.loadPostsReadStats(post.pageId, Some(post.id))
    val postAfter = post.copyWithUpdatedVoteAndReadCounts(actions, readStats)

    val numNewLikes = postAfter.numLikeVotes - post.numLikeVotes
    val numNewWrongs = postAfter.numWrongVotes - post.numWrongVotes
    val pageMetaBefore = transaction.loadThePageMeta(post.pageId)
    val pageMetaAfter = pageMetaBefore.copy(
      numLikes = pageMetaBefore.numLikes + numNewLikes,
      numWrongs = pageMetaBefore.numWrongs + numNewWrongs)

    transaction.updatePost(postAfter)
    transaction.updatePageMeta(pageMetaAfter, oldMeta = pageMetaBefore)

    // COULD split e.g. num_like_votes into ..._total and ..._unique? And update here.
  }


  protected def refreshPageInAnyCache(pageId: PageId) {}

}



trait CachingPostsDao extends PagesDao {
  self: CachingSiteDao =>


  override def createPage2(pageRole: PageRole, pageStatus: PageStatus,
        anyParentPageId: Option[PageId], anyFolder: Option[String],
        titleSource: String, bodySource: String,
        showId: Boolean, pageSlug: String, authorId: UserId): PagePath = {
    val pagePath = super.createPage2(pageRole, pageStatus, anyParentPageId,
      anyFolder, titleSource, bodySource, showId, pageSlug, authorId)
    firePageCreated(pagePath)
    pagePath
  }


  protected override def refreshPageInAnyCache(pageId: PageId) {
    firePageSaved(SitePageId(siteId = siteId, pageId = pageId))
  }

}

