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
import controllers.EditController
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


  def insertReply(textAndHtml: TextAndHtml, pageId: PageId, replyToPostIds: Set[PostId],
        postType: PostType, authorId: UserId, browserIdData: BrowserIdData): PostId = {
    if (textAndHtml.safeHtml.trim.isEmpty)
      throwBadReq("DwE6KEF2", "Empty reply")

    val postId = readWriteTransaction { transaction =>
      val page = PageDao(pageId, transaction)
      val uniqueId = transaction.nextPostId()
      val postId = page.parts.highestReplyId.map(_ + 1) getOrElse PageParts.FirstReplyId
      val commonAncestorId = page.parts.findCommonAncestorId(replyToPostIds.toSeq)
      val anyParent =
        if (commonAncestorId == PageParts.NoId) {
          // Flat chat comments might not reply to anyone in particular.
          // On embedded comments pages, there's no Original Post, so top level comments
          // have no parent post.
          if (postType != PostType.Flat && page.role != PageRole.EmbeddedComments)
            throwBadReq("DwE2CGW7", "Non-flat non-embedded comment with no parent post id")
          else
            None
        }
        else {
          val anyParent = page.parts.post(commonAncestorId)
          if (anyParent.isEmpty) {
            throwBadReq("DwEe8HD36", o"""Cannot reply to common ancestor post '$commonAncestorId';
                it does not exist""")
          }
          anyParent
        }
      if (anyParent.map(_.deletedStatus.isDeleted) == Some(true))
        throwForbidden(
          "The parent post has been deleted; cannot reply to a deleted post", "DwE5KDE7")

      // SHOULD authorize. For now, no restrictions.
      val isApproved = true // for now
      val author = transaction.loadUser(authorId) getOrElse throwNotFound("DwE404UF3", "Bad user")
      val approverId =
        if (author.isStaff) {
          author.id
        }
        else {
          SystemUserId
        }

      val newPost = Post.create(
        siteId = siteId,
        uniqueId = uniqueId,
        pageId = pageId,
        postId = postId,
        parent = anyParent,
        multireplyPostIds = (replyToPostIds.size > 1) ? replyToPostIds | Set.empty,
        postType = postType,
        createdAt = transaction.currentTime,
        createdById = authorId,
        source = textAndHtml.text,
        htmlSanitized = textAndHtml.safeHtml,
        approvedById = Some(approverId))

      val numNewOrigPostReplies = (isApproved && newPost.isOrigPostReply) ? 1 | 0
      val oldMeta = page.meta
      val newMeta = oldMeta.copy(
        bumpedAt = Some(transaction.currentTime),
        lastReplyAt = Some(transaction.currentTime),
        numRepliesVisible = page.parts.numRepliesVisible + (isApproved ? 1 | 0),
        numRepliesTotal = page.parts.numRepliesTotal + 1,
        numOrigPostRepliesVisible = page.parts.numOrigPostRepliesVisible + numNewOrigPostReplies,
        version = oldMeta.version + 1)

      val auditLogEntry = AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.NewPost,
        doerId = authorId,
        doneAt = transaction.currentTime,
        browserIdData = browserIdData,
        pageId = Some(pageId),
        uniquePostId = Some(newPost.uniqueId),
        postNr = Some(newPost.id),
        targetUniquePostId = anyParent.map(_.uniqueId),
        targetPostNr = anyParent.map(_.id),
        targetUserId = anyParent.map(_.createdById))

      transaction.insertPost(newPost)
      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = isApproved)
      insertAuditLogEntry(auditLogEntry, transaction)

      val notifications = NotificationGenerator(transaction).generateForNewPost(page, newPost)
      transaction.saveDeleteNotifications(notifications)
      postId
    }

    refreshPageInAnyCache(pageId)
    postId
  }


  def editPost(pageId: PageId, postId: PostId, editorId: UserId, browserIdData: BrowserIdData,
        newTextAndHtml: TextAndHtml) {

    if (newTextAndHtml.safeHtml.trim.isEmpty)
      throwBadReq("DwE4KEL7", EditController.EmptyPostErrorMessage)

    readWriteTransaction { transaction =>
      val page = PageDao(pageId, transaction)
      val postToEdit = page.parts.post(postId) getOrElse {
        page.meta // this throws page-not-fount if the page doesn't exist
        throwNotFound("DwE404GKF2", s"Post not found, id: '$postId'")
      }

      if (postToEdit.isDeleted)
        throwForbidden("DwE6PK2", "The post has been deleted")

      if (postToEdit.currentSource == newTextAndHtml.text)
        return

      val editor = transaction.loadUser(editorId).getOrElse(
        throwNotFound("DwE30HY21", s"User not found, id: '$editorId'"))

      // For now: (add back edit suggestions later. And should perhaps use PermsOnPage.)
      val editsOwnPost = editorId == postToEdit.createdById
      val mayEditWiki = editor.isAuthenticated && postToEdit.tyype == PostType.CommunityWiki
      val mayEdit = editsOwnPost || editor.isStaff || mayEditWiki
      if (!mayEdit)
        throwForbidden("DwE8KF32", "You may not edit that post")

      //val appliedDirectly = true // for now, add back edit suggestions later
      //val approvedDirectly = true // later: && editor.isWellBehavedUser

      var editedPost = postToEdit.copy(
        lastEditedAt = Some(transaction.currentTime),
        lastEditedById = Some(editorId))

      val approverId = if (editor.isStaff) editor.id else SystemUserId
      val nextVersion = postToEdit.currentVersion + 1

      // COULD send current version from browser to server, reject edits if != oldPost.currentVersion
      // to stop the lost update problem.

      // Later, if post not approved directly: currentSourcePatch = makePatch(from, to)

      editedPost = editedPost.copy(
        lastApprovedEditAt = Some(transaction.currentTime),
        lastApprovedEditById = Some(editorId),
        approvedSource = Some(newTextAndHtml.text),
        approvedHtmlSanitized = Some(newTextAndHtml.safeHtml),
        approvedAt = Some(transaction.currentTime),
        approvedById = Some(approverId),
        approvedVersion = Some(nextVersion),
        currentSourcePatch = None,
        currentVersion = nextVersion)

      if (editorId != editedPost.createdById) {
        editedPost = editedPost.copy(numDistinctEditors = 2)  // for now
      }

      val anyEditedCategory =
        if (page.role != PageRole.AboutCategory || !editedPost.isOrigPost) {
          // Later: Go here also if new text not yet approved.
          None
        }
        else {
          if (newTextAndHtml.text == Category.UncategorizedDescription) {
            // We recognize Uncategorized categories via the magic text tested for above.
            throwForbidden("DwE4KEP8", "Forbidden magic text")
          }
          // COULD reuse the same transaction, when loading the category. Barely matters.
          val category = loadTheCategory(page.meta.categoryId getOrDie "DwE2PKF0")
          val newDescription = ReactJson.htmlToExcerpt(
            newTextAndHtml.safeHtml, Category.DescriptionExcerptLength)
          Some(category.copy(description = Some(newDescription)))
        }

      val auditLogEntry = AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.EditPost,
        doerId = editorId,
        doneAt = transaction.currentTime,
        browserIdData = browserIdData,
        pageId = Some(pageId),
        uniquePostId = Some(postToEdit.uniqueId),
        postNr = Some(postId),
        targetUserId = Some(postToEdit.createdById))

      transaction.updatePost(editedPost)
      insertAuditLogEntry(auditLogEntry, transaction)
      anyEditedCategory.foreach(transaction.updateCategoryMarkSectionPageStale)

      if (!postToEdit.isSomeVersionApproved && editedPost.isSomeVersionApproved) {
        unimplemented("Updating visible post counts when post approved via an edit", "DwE5WE28")
      }

      if (editedPost.isCurrentVersionApproved) {
        val notfs = NotificationGenerator(transaction).generateForEdits(postToEdit, editedPost)
        transaction.saveDeleteNotifications(notfs)
      }

      val oldMeta = page.meta
      var newMeta = oldMeta.copy(version = oldMeta.version + 1)
      var makesSectionPageHtmlStale = false
      // Bump the page, if the article / original post was edited.
      // (This is how Discourse works and people seems to like it. However,
      // COULD add a don't-bump option for minor edits.)
      if (postId == PageParts.BodyId && editedPost.isCurrentVersionApproved) {
        newMeta = newMeta.copy(bumpedAt = Some(transaction.currentTime))
        makesSectionPageHtmlStale = true
      }
      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, makesSectionPageHtmlStale)
    }

    refreshPageInAnyCache(pageId)
  }


  def changePostType(pageId: PageId, postNr: PostId, newType: PostType,
        changerId: UserId, browserIdData: BrowserIdData) {
    readWriteTransaction { transaction =>
      val page = PageDao(pageId, transaction)
      val postBefore = page.parts.thePost(postNr)
      val postAfter = postBefore.copy(tyype = newType)
      val Seq(author, changer) = transaction.loadTheUsers(postBefore.createdById, changerId)

      // Test if the changer is allowed to change the post type in this way.
      if (changer.isStaff) {
        (postBefore.tyype, postAfter.tyype) match {
          case (before, after)
            if before == PostType.Normal && after.isWiki => // Fine, staff wikifies post.
          case (before, after)
            if before.isWiki && after == PostType.Normal => // Fine, staff removes wiki status.
          case (before, after) =>
            throwForbidden("DwE7KFE2", s"Cannot change post type from $before to $after")
        }
      }
      else {
        // All normal users may do is to remove wiki status of their own posts.
        if (postBefore.isWiki && postAfter.tyype == PostType.Normal) {
          if (changer.id != author.id)
            throwForbidden("DwE5KGPF2", o"""You are not the author and not staff,
                so you cannot remove the Wiki status of this post""")
        }
        else {
            throwForbidden("DwE4KXB2", s"""Cannot change post type from
                ${postBefore.tyype} to ${postAfter.tyype}""")
        }
      }

      val auditLogEntry = AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.ChangePostType,
        doerId = changerId,
        doneAt = transaction.currentTime,
        browserIdData = browserIdData,
        pageId = Some(pageId),
        uniquePostId = Some(postBefore.uniqueId),
        postNr = Some(postNr),
        targetUserId = Some(postBefore.createdById))

      val oldMeta = page.meta
      val newMeta = oldMeta.copy(version = oldMeta.version + 1)

      transaction.updatePost(postAfter)
      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = false)
      insertAuditLogEntry(auditLogEntry, transaction)
      // COULD generate some notification? E.g. "Your post was made wiki-editable."
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
      if (!user.isStaff) {
        if (postBefore.createdById != userId)
          throwForbidden("DwE0PK24", "You may not modify that post, it's not yours")

        if (!action.isInstanceOf[PSA.DeletePost] && action != PSA.CollapsePost)
          throwForbidden("DwE5JKF7", "You may not modify the whole tree")
      }

      val isChangingDeletePostToDeleteTree =
        postBefore.deletedStatus.onlyThisDeleted && action == PSA.DeleteTree
      if (postBefore.isDeleted && !isChangingDeletePostToDeleteTree)
        throwForbidden("DwE5GUK5", "This post has already been deleted")

      var numVisibleRepliesGone = 0
      var numOrigPostVisibleRepliesGone = 0

      // Update the directly affected post.
      val postAfter = action match {
        case PSA.HidePost =>
          postBefore.copyWithNewStatus(transaction.currentTime, userId, postHidden = true)
        case PSA.UnhidePost =>
          postBefore.copyWithNewStatus(transaction.currentTime, userId, postUnhidden = true)
        case PSA.CloseTree =>
          postBefore.copyWithNewStatus(transaction.currentTime, userId, treeClosed = true)
        case PSA.CollapsePost =>
          postBefore.copyWithNewStatus(transaction.currentTime, userId, postCollapsed = true)
        case PSA.CollapseTree =>
          postBefore.copyWithNewStatus(transaction.currentTime, userId, treeCollapsed = true)
        case PSA.DeletePost(clearFlags) =>
          if (postBefore.isVisible && postBefore.isReply) {
            numVisibleRepliesGone += 1
            if (postBefore.isOrigPostReply) {
              numOrigPostVisibleRepliesGone += 1
            }
          }
          postBefore.copyWithNewStatus(transaction.currentTime, userId, postDeleted = true)
        case PSA.DeleteTree =>
          if (postBefore.isVisible && postBefore.isReply) {
            numVisibleRepliesGone += 1
            if (postBefore.isOrigPostReply) {
              numOrigPostVisibleRepliesGone += 1
            }
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
            if (successor.isVisible && successor.isReply) {
              numVisibleRepliesGone += 1
              if (successor.isOrigPostReply) {
                // Was the orig post + all replies deleted recursively? Weird.
                numOrigPostVisibleRepliesGone += 1
              }
            }
            if (successor.deletedStatus.areAncestorsDeleted) None
            else Some(successor.copyWithNewStatus(
              transaction.currentTime, userId, ancestorsDeleted = true))
        }

        anyUpdatedSuccessor foreach { updatedSuccessor =>
          transaction.updatePost(updatedSuccessor)
        }
      }

      val oldMeta = page.meta
      var newMeta = oldMeta.copy(version = oldMeta.version + 1)
      var markSectionPageStale = false
      if (numVisibleRepliesGone > 0) {
        newMeta = newMeta.copy(
          numRepliesVisible = oldMeta.numRepliesVisible - numVisibleRepliesGone,
          numOrigPostRepliesVisible =
            // For now: use max() because the db field was just added so some counts are off.
            math.max(oldMeta.numOrigPostRepliesVisible - numOrigPostVisibleRepliesGone, 0))
        markSectionPageStale = true
      }
      transaction.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale)

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

      var newMeta = pageMeta.copy(version = pageMeta.version + 1)
      // Bump page and update reply counts if a new post was approved and became visible,
      // or if the original post was edited.
      var makesSectionPageHtmlStale = false
      if (isApprovingNewPost || isApprovingPageBody) {
        val (numNewReplies, numNewOrigPostReplies, newLastReplyAt) =
          if (isApprovingNewPost && postAfter.isReply)
            (1, postAfter.isOrigPostReply ? 1 | 0, Some(transaction.currentTime))
          else
            (0, 0, pageMeta.lastReplyAt)

        newMeta = newMeta.copy(
          numRepliesVisible = pageMeta.numRepliesVisible + numNewReplies,
          numOrigPostRepliesVisible = pageMeta.numOrigPostRepliesVisible + numNewOrigPostReplies,
          lastReplyAt = newLastReplyAt,
          bumpedAt = Some(transaction.currentTime))
        makesSectionPageHtmlStale = true
      }
      transaction.updatePageMeta(newMeta, oldMeta = pageMeta, makesSectionPageHtmlStale)

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


  def deletePost(pageId: PageId, postId: PostId, deletedById: UserId,
        browserIdData: BrowserIdData) {
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


  def ifAuthAddVote(pageId: PageId, postId: PostId, voteType: PostVoteType,
        voterId: UserId, voterIp: String, postIdsRead: Set[PostId]) {
    readWriteTransaction { transaction =>
      val page = PageDao(pageId, transaction)
      val post = page.parts.thePost(postId)
      val voter = transaction.loadTheUser(voterId)

      if (voteType == PostVoteType.Bury && !voter.isStaff)
        throwForbidden("DwE2WU74", "Only staff and regular members may Bury-vote")

      if (voteType == PostVoteType.Unwanted && !voter.isStaff && page.meta.authorId != voterId)
        throwForbidden("DwE5JUK0", "Only staff and the page author may Unwanted-vote")

      if (voteType == PostVoteType.Like) {
        if (post.createdById == voterId)
          throwForbidden("DwE84QM0", "Cannot like own post")
      }

      try {
        transaction.insertVote(post.uniqueId, pageId, postId, voteType, voterId = voterId)
      }
      catch {
        case DbDao.DuplicateVoteException =>
          throwForbidden("Dw403BKW2", "You have already voted")
      }

      // Update post read stats.
      val postsToMarkAsRead =
        if (voteType == PostVoteType.Like) {
          // Upvoting a post shouldn't affect its ancestors, because they're on the
          // path to the interesting post so they are a bit useful/interesting. However
          // do mark all earlier siblings as read since they weren't upvoted (this time).
          val ancestorIds = page.parts.ancestorsOf(postId).map(_.id)
          postIdsRead -- ancestorIds.toSet
        }
        else {
          // The post got a non-like vote: wrong, bury or unwanted.
          // This should result in only the downvoted post
          // being marked as read, because a post *not* being downvoted shouldn't
          // give that post worse rating. (Remember that the rating of a post is
          // roughly the number of Like votes / num-times-it's-been-read.)
          Set(postId)
        }

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
      transaction.insertFlag(postBefore.uniqueId, pageId, postId, flagType, flaggerId)
      transaction.updatePost(postAfter)
      // Need not update page version: flags aren't shown (except perhaps for staff users).
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
      // Need not update page version: flags aren't shown (except perhaps for staff users).
    }
    // In case the post gets unhidden now when flags gone:
    refreshPageInAnyCache(pageId)
  }


  def loadPostsReadStats(pageId: PageId): PostsReadStats =
    siteDbDao.loadPostsReadStats(pageId)


  def loadPost(pageId: PageId, postId: PostId): Option[Post] =
    readOnlyTransaction(_.loadPost(pageId, postId))


  private def updateVoteCounts(pageId: PageId, postId: PostId, transaction: SiteTransaction) {
    val post = transaction.loadThePost(pageId, postId = postId)
    updateVoteCounts(post, transaction)
  }


  private def updateVoteCounts(post: Post, transaction: SiteTransaction) {
    val actions = transaction.loadActionsDoneToPost(post.pageId, postId = post.id)
    val readStats = transaction.loadPostsReadStats(post.pageId, Some(post.id))
    val postAfter = post.copyWithUpdatedVoteAndReadCounts(actions, readStats)

    val numNewLikes = postAfter.numLikeVotes - post.numLikeVotes
    val numNewWrongs = postAfter.numWrongVotes - post.numWrongVotes
    val numNewBurys = postAfter.numBuryVotes - post.numBuryVotes
    val numNewUnwanteds = postAfter.numUnwantedVotes - post.numUnwantedVotes

    val (numNewOpLikes, numNewOpWrongs, numNewOpBurys, numNewOpUnwanteds) =
      if (post.isOrigPost)
        (numNewLikes, numNewWrongs, numNewBurys, numNewUnwanteds)
      else
        (0, 0, 0, 0)

    val pageMetaBefore = transaction.loadThePageMeta(post.pageId)
    val pageMetaAfter = pageMetaBefore.copy(
      numLikes = pageMetaBefore.numLikes + numNewLikes,
      numWrongs = pageMetaBefore.numWrongs + numNewWrongs,
      numBurys = pageMetaBefore.numBurys + numNewBurys,
      numUnwanteds = pageMetaBefore.numUnwanteds + numNewUnwanteds,
      // For now: use max() because the db fields were just added so some counts are off.
      // (but not for Unwanted, that vote was added after the vote count fields)
      numOrigPostLikeVotes = math.max(0, pageMetaBefore.numOrigPostLikeVotes + numNewOpLikes),
      numOrigPostWrongVotes = math.max(0, pageMetaBefore.numOrigPostWrongVotes + numNewOpWrongs),
      numOrigPostBuryVotes = math.max(0, pageMetaBefore.numOrigPostBuryVotes + numNewOpBurys),
      numOrigPostUnwantedVotes = pageMetaBefore.numOrigPostUnwantedVotes + numNewOpUnwanteds,
      version = pageMetaBefore.version + 1)

    transaction.updatePost(postAfter)
    transaction.updatePageMeta(pageMetaAfter, oldMeta = pageMetaBefore,
      markSectionPageStale = true)

    // COULD split e.g. num_like_votes into ..._total and ..._unique? And update here.
  }

}



trait CachingPostsDao extends PagesDao {
  self: CachingSiteDao =>

  override def refreshPageInAnyCache(pageId: PageId) {
    firePageSaved(SitePageId(siteId = siteId, pageId = pageId))
  }

  override def emptyCache() {
    siteDbDao.bumpSiteVersion()
    emptyCache(siteId)
  }

}

