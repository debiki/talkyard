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
import com.debiki.core.{PostActionPayload => PAP}


/** Loads and saves pages and page parts (e.g. posts and patches).
  *
  * (There's also a class PageDao (with no 's' in the name) that focuses on
  * one specific single page.)
  *
  * TODO rename to PostsDao? And make the full text search indexer work again
  */
trait PagesDao {
  self: SiteDao =>


  def createPage2(pageRole: PageRole, pageStatus: PageStatus, anyParentPageId: Option[PageId],
        anyFolder: Option[String], titleSource: String, bodySource: String,
        showId: Boolean, pageSlug: String, authorId: UserId2): PagePath = {

    val bodyHtmlSanitized = siteDbDao.commonMarkRenderer.renderAndSanitizeCommonMark(bodySource,
      allowClassIdDataAttrs = true, followLinks = !pageRole.isWidelyEditable)

    val titleHtmlSanitized = siteDbDao.commonMarkRenderer.sanitizeHtml(titleSource)

    readWriteTransaction { transaction =>

      val pageId = transaction.nextPageId()

      // Authorize and determine approver user id. For now:
      val author = transaction.loadUser(authorId) getOrElse throwForbidden("DwE9GK32", "User gone")
      val approvedById =
        if (author.isAdmin) {
          author.id2
        }
        else {
          if (pageRole != PageRole.ForumTopic)
            throwForbidden("DwE0GK3w2", "You may create forum topics only")

          anyParentPageId match {
            case None =>
              throwForbidden("DwE8GKE4", "No parent forum or category specified")
            case Some(parentId) =>
              val parentMeta = loadPageMeta(parentId) getOrElse throwNotFound(
                "DwE78BI21", s"Parent forum or category does not exist, id: '$parentId'")

              if (parentMeta.pageRole != PageRole.ForumCategory &&
                  parentMeta.pageRole != PageRole.Forum)
                throwForbidden("DwE830BIR5", "Parent page is not a Forum or ForumCategory")

              // The System user currently approves all new forum topics.
              // TODO SECURITY COULD analyze the author's trust level and past actions, and
              // based on that, approve, reject or review later.
              SystemUserId
          }
        }

      val folder = anyFolder getOrElse {
        val anyParentPath = anyParentPageId flatMap { id =>
          transaction.loadPagePath(id)
        }
        anyParentPath.map(_.folder) getOrElse "/"
      }

      val pagePath = PagePath(siteId, folder = folder, pageId = Some(pageId),
        showId = showId, pageSlug = pageSlug)

      val titlePost = Post2.createTitle(
        siteId = siteId,
        pageId = pageId,
        createdAt = transaction.currentTime,
        createdById = authorId,
        source = titleSource,
        htmlSanitized = titleHtmlSanitized,
        approvedById = Some(approvedById))

      val bodyPost = Post2.createBody(
        siteId = siteId,
        pageId = pageId,
        createdAt = transaction.currentTime,
        createdById = authorId,
        source = bodySource,
        htmlSanitized = bodyHtmlSanitized,
        approvedById = Some(approvedById))

      val pageMeta = PageMeta.forNewPage(pageId, pageRole, authorId, transaction.currentTime,
        parentPageId = anyParentPageId, url = None, publishDirectly = true)

      transaction.insertPageMeta(pageMeta)
      transaction.insertPagePath(pagePath)
      transaction.insertPost(titlePost)
      transaction.insertPost(bodyPost)

      val notifications = NotificationGenerator(transaction)
        .generateForNewPost(PageDao(pageId, transaction), bodyPost)
      transaction.saveDeleteNotifications(notifications)

      pagePath
    }
  }


  def insertReply(text: String, pageId: PageId, replyToPostIds: Set[PostId],
        authorId: UserId2): PostId = {
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

      // Authorize. For now, no restrictions. Fix later TODO
      val author = transaction.loadUser(authorId) getOrElse throwNotFound("DwE404UF3", "Bad user")
      val approverId =
        if (author.isAdmin) {
          author.id2
        }
        else {
          SystemUserId
        }

      val parentStatuses = parentId match {
        case Some(parentId) => page.parts.derivePostStatuses(parentId)
        case None => PostStatuses.Default
      }

      var newPost = Post2.create(
        siteId = siteId,
        pageId = pageId,
        postId = postId,
        parentId = parentId,
        multireplyPostIds = replyToPostIds,
        createdAt = transaction.currentTime,
        createdById = authorId,
        source = text,
        htmlSanitized = htmlSanitized,
        approvedById = Some(approverId))

      newPost = newPost.copyWithParentStatuses(parentStatuses)

      //val oldMeta = page.meta
      //val newMeta = oldMeta.copy(numRepliesInclDeleted = page.parts.numRepliesInclDeleted + 1)
      transaction.insertPost(newPost)
      //transaction.savePageMeta(newMeta) // TODO

      val notifications = NotificationGenerator(transaction).generateForNewPost(page, newPost)
      transaction.saveDeleteNotifications(notifications)
      postId
    }

    refreshPageInAnyCache(pageId)
    postId
  }


  def editPost(pageId: PageId, postId: PostId, editorId: UserId2, newText: String) {
    readWriteTransaction { transaction =>
      val page = PageDao(pageId, transaction)
      var postToEdit = page.parts.post(postId).getOrElse(
        throwNotFound("DwE404GKF2", s"Post not found, id: '$postId'"))

      if (postToEdit.currentSource == newText)
        return

      val editor = transaction.loadUser(editorId.toString).getOrElse(
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

      val approverId = if (editor.isAdmin) editor.id2 else SystemUserId
      val nextVersion = postToEdit.currentVersion + 1

      // TODO send current version from browser to server, reject edits if != oldPost.currentVersion
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

      if (postId == PageParts.TitleId) {
        val oldMeta = page.meta
        val newMeta = oldMeta.copy(cachedTitle = Some(newText))
        transaction.updatePageMeta(newMeta, oldMeta = oldMeta)
      }
  
      if (editedPost.currentVersionIsApproved) {
        val notfs = NotificationGenerator(transaction).generateForEdits(postToEdit, editedPost)
        transaction.saveDeleteNotifications(notfs)
      }
    }

    refreshPageInAnyCache(pageId)
  }


  def changePostStatus(postId: PostId, pageId: PageId, action: PostActionPayload, userId: UserId2) {
    readWriteTransaction { transaction =>
      val page = PageDao(pageId, transaction)

      val postBefore = page.parts.thePost(postId)
      val user = transaction.loadUser(userId) getOrElse throwForbidden("DwE3KFW2", "Bad user id")

      // Authorization.
      if (!user.isAdmin) {
        if (postBefore.createdById != userId)
          throwForbidden("DwE0PK24", "You may not modify that post, it's not yours")

        if (!action.isInstanceOf[PAP.DeletePost] && action != PAP.CollapsePost)
          throwForbidden("DwE5JKF7", "You may not modify the whole tree")
      }

      // Update the directly affected post.
      val postAfter = action match {
        case PAP.CloseTree =>
          if (postBefore.closedStatus.isDefined)
            return
          postBefore.copy(
            closedAt = Some(transaction.currentTime),
            closedById = Some(userId),
            closedStatus = Some(ClosedStatus.TreeClosed))
        case PAP.CollapsePost =>
          if (postBefore.collapsedStatus.isDefined)
            return
          postBefore.copy(
            collapsedAt = Some(transaction.currentTime),
            collapsedById = Some(userId),
            collapsedStatus = Some(CollapsedStatus.PostCollapsed))
        case PAP.CollapseTree =>
          if (postBefore.collapsedStatus.isDefined)
            return
          postBefore.copy(
            collapsedAt = Some(transaction.currentTime),
            collapsedById = Some(userId),
            collapsedStatus = Some(CollapsedStatus.TreeCollapsed))
        case PAP.DeletePost(clearFlags) =>
          if (postBefore.deletedStatus.isDefined)
            return
          postBefore.copy(
            deletedAt = Some(transaction.currentTime),
            deletedById = Some(userId),
            deletedStatus = Some(DeletedStatus.PostDeleted))
        case PAP.DeleteTree =>
          if (postBefore.deletedStatus.isDefined)
            return
          postBefore.copy(
            deletedAt = Some(transaction.currentTime),
            deletedById = Some(userId),
            deletedStatus = Some(DeletedStatus.TreeDeleted))
      }

      transaction.updatePost(postAfter)

      // Update any indirectly affected posts, e.g. subsequent comments in the same
      // thread that are being deleted recursively.
      for (successor <- page.parts.successorsOf(postId)) {
        val anyUpdatedSuccessor: Option[Post2] = action match {
          case PAP.CloseTree =>
            if (successor.closedStatus.isDefined) None
            else Some(successor.copy(
              closedStatus = Some(ClosedStatus.AncestorClosed),
              closedById = Some(userId),
              closedAt = Some(transaction.currentTime)))
          case PAP.CollapsePost =>
            None
          case PAP.CollapseTree =>
            if (successor.collapsedStatus.isDefined) None
            else Some(successor.copy(
              collapsedStatus = Some(CollapsedStatus.AncestorCollapsed),
              collapsedById = Some(userId),
              collapsedAt = Some(transaction.currentTime)))
          case PAP.DeletePost(clearFlags) =>
            None
          case PAP.DeleteTree =>
            if (successor.deletedStatus.isDefined) None
            else Some(successor.copy(
              deletedStatus = Some(DeletedStatus.AncestorDeleted),
              deletedById = Some(userId),
              deletedAt = Some(transaction.currentTime)))
        }

        anyUpdatedSuccessor foreach { updatedSuccessor =>
          transaction.updatePost(updatedSuccessor)
        }
      }

      // TODO: update page meta post counts.
      //val oldMeta = page.meta
      //val newMeta = oldMeta.copy(...)
      //transaction.updatePageMeta(newMeta, oldMeta = oldMeta)
    }

    refreshPageInAnyCache(pageId)
  }


  def approvePost(pageId: PageId, postId: PostId, approverId: UserId2) {
    readWriteTransaction { transaction =>
      val page = PageDao(pageId, transaction)
      val pageMeta = page.meta
      val postBefore = page.parts.thePost(postId)
      if (postBefore.currentVersionIsApproved)
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

      val isApprovingNewPost = postBefore.approvedVersion.isEmpty
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


  def deletePost(pageId: PageId, postId: PostId, deletedById: UserId2): Unit = {
    readWriteTransaction { transaction =>
      val postBefore = transaction.loadThePost(pageId, postId)
      if (postBefore.isDeleted && postBefore.deletedStatus != Some(DeletedStatus.AncestorDeleted))
        throwForbidden("DwE8FKW2", "Post already deleted")

      val postAfter = postBefore.copy(
        deletedStatus = Some(DeletedStatus.PostDeleted),
        deletedAt = Some(transaction.currentTime),
        deletedById = Some(deletedById))
      transaction.updatePost(postAfter)
    }
    refreshPageInAnyCache(pageId)
  }


  def deleteVote(pageId: PageId, postId: PostId, voteType: PostVoteType, voterId: UserId2) {
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
        voterId: UserId2, voterIp: String, postIdsRead: Set[PostId]) {
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
      val userIds = mutable.HashSet[UserId2]()
      userIds ++= posts.map(_.createdById)
      userIds ++= posts.flatMap(_.lastEditedById)
      userIds ++= flags.map(_.flaggerId)
      val users = transaction.loadUsers(userIds.toSeq)
      ThingsToReview(posts, pageMetas, users, flags)
    }
  }


  def flagPost(pageId: PageId, postId: PostId, flagType: PostFlagType, flaggerId: UserId2) {
    readWriteTransaction { transaction =>
      val postBefore = transaction.loadThePost(pageId, postId)
      // TODO if >= 2 pending flags, then hide post until reviewed? And unhide, if flags cleared.
      val postAfter = postBefore.copy(numPendingFlags = postBefore.numPendingFlags + 1)
      transaction.insertFlag(pageId, postId, flagType, flaggerId)
      transaction.updatePost(postAfter)
    }
    refreshPageInAnyCache(pageId)
  }


  def clearFlags(pageId: PageId, postId: PostId, clearedById: UserId2): Unit = {
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


  def loadPost(pageId: PageId, postId: PostId): Option[Post2] =
    readOnlyTransaction(_.loadPost(pageId, postId))


  private def updateVoteCounts(pageId: PageId, postId: PostId, transaction: SiteTransaction): Unit = {
    val post = transaction.loadThePost(pageId, postId = postId)
    updateVoteCounts(post, transaction)
  }


  private def updateVoteCounts(post: Post2, transaction: SiteTransaction) {
    val actions = transaction.loadActionsDoneToPost(post.pageId, postId = post.id)
    val readStats = transaction.loadPostsReadStats(post.pageId, Some(post.id))
    val postAfter = post.copyWithUpdatedVoteAndReadCounts(actions, readStats)
    transaction.updatePost(postAfter)
    // TODO split e.g. num_like_votes into ..._total and ..._unique? And update here.
  }


  protected def refreshPageInAnyCache(pageId: PageId) {}

}



trait CachingPagesDao extends PagesDao {
  self: CachingSiteDao =>


  override def createPage2(pageRole: PageRole, pageStatus: PageStatus,
        anyParentPageId: Option[PageId], anyFolder: Option[String],
        titleSource: String, bodySource: String,
        showId: Boolean, pageSlug: String, authorId: UserId2): PagePath = {
    val pagePath = super.createPage2(pageRole, pageStatus, anyParentPageId,
      anyFolder, titleSource, bodySource, showId, pageSlug, authorId)
    firePageCreated(pagePath)
    pagePath
  }


  protected override def refreshPageInAnyCache(pageId: PageId) {
    firePageSaved(SitePageId(siteId = siteId, pageId = pageId))
  }

}

