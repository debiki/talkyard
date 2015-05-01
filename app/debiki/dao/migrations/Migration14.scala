/**
 * Copyright (C) 2015 Kaj Magnus Lindberg (born 1979)
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

package debiki.dao.migrations

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.PostStatusBits._
import java.{util => ju}
import scala.collection.mutable


object Migration14 {

  var siteTransaction: SiteTransaction = null

  /** Does nothing nowadays, because this migration has already been completed
    * everywhere, it's needed no more.
    */
  def run(systemTransaction: SystemTransaction) {
    return /*
    val allSites = systemTransaction.loadSites()
    for (site <- allSites) {
      siteTransaction = systemTransaction.siteTransaction(site.id)
      val allPageMetas = siteTransaction.loadAllPageMetas()
      for (pageMeta <- allPageMetas) {
        migratePage(pageMeta)
      }
      */
    }

    /*
    def migratePage(pageMeta: PageMeta) {
      val partsOld: PageParts =
        siteTransaction.loadPagePartsOld(pageMeta.pageId) getOrDie "DwE0Pk3W2"

      var numRepliesVisible = 0
      var numRepliesTotal = 0

      // Migrate posts.
      for (oldPost <- partsOld.getAllPosts) {
        val newPost = upgradePost(pageMeta.pageId, oldPost)
        if (newPost.isReply) {
          numRepliesTotal += 1
          if (newPost.isVisible) {
            numRepliesVisible += 1
          }
        }
        siteTransaction.insertPost(newPost)
      }

      // Migrate Like and Wrong votes. Ditch off-topic votes — replace them with Rude and Boring?
      val alreadyVoted = mutable.HashSet[String]()
      val postIdsWithVotes = mutable.HashSet[PostId]()
      for (postActionOld <- partsOld.getAllActions) postActionOld.payload match {
        case vote: PostActionPayload.Vote if vote != PostActionPayload.VoteOffTopic =>
          val voteType = vote match {
            case PostActionPayload.VoteLike => PostVoteType.Like
            case PostActionPayload.VoteWrong => PostVoteType.Wrong
            case PostActionPayload.VoteOffTopic => die("DwE0gKFF3")
          }
          val voterId = postActionOld.userId.toInt
          val postId = postActionOld.postId
          val voteKey = s"$postId:$voteType:$voterId"
          if (!alreadyVoted.contains(voteKey)) {
            alreadyVoted.add(voteKey)
            postIdsWithVotes.add(postId)
            siteTransaction.insertVote(pageMeta.pageId, postId, voteType, voterId = voterId)
          }
        case _ =>
          // skip
      }

      // Don't migrate flags and pinned positions.

      // Update vote counts
      var numLikeVotesOnPage = 0
      var numWrongVotesOnPage = 0
      for (postId <- postIdsWithVotes) {
        val postNoCounts = siteTransaction.loadThePost(pageMeta.pageId, postId)
        val actions = siteTransaction.loadActionsDoneToPost(pageMeta.pageId, postId)
        val readStats = siteTransaction.loadPostsReadStats(pageMeta.pageId, Some(postId))
        val postWithCounts = postNoCounts.copyWithUpdatedVoteAndReadCounts(actions, readStats)
        numLikeVotesOnPage += postWithCounts.numLikeVotes
        numWrongVotesOnPage += postWithCounts.numWrongVotes
        siteTransaction.updatePost(postWithCounts)
      }

      // Update page meta.
      val newPageMeta = pageMeta.copy(
        numLikes = numLikeVotesOnPage,
        numWrongs = numWrongVotesOnPage,
        numRepliesVisible = numRepliesVisible,
        numRepliesTotal = numRepliesTotal)
      siteTransaction.updatePageMeta(newPageMeta, oldMeta = pageMeta)
    }


    def upgradePost(pageId: PageId, oldPost: Post): Post2 = {
      val ancestors = oldPost.ancestorPosts
      val ancestorsCollapsedBit = if (ancestors.exists(_.isTreeCollapsed)) AncestorsBit else 0
      val ancestorsClosedBit = if (ancestors.exists(_.isTreeClosed)) AncestorsBit else 0
      val ancestorsDeletedBit = if (ancestors.exists(_.isTreeDeleted)) AncestorsBit else 0

      val collapsedStatus = new CollapsedStatus(
        if (oldPost.isTreeCollapsed) TreeBits | ancestorsCollapsedBit
        else if (oldPost.isPostCollapsed) SelfBit | ancestorsCollapsedBit
        else ancestorsCollapsedBit)

      val (collapsedAt, collapsedById) =
        if (collapsedStatus.isCollapsed)
          (Some(oldPost.creationDati), Some(SystemUser.User.id))
        else
          (None, None)

      val closedStatus = new ClosedStatus(
        if (oldPost.isTreeClosed) TreeBits | ancestorsClosedBit
        else ancestorsClosedBit)

      val (closedAt, closedById) =
        if (closedStatus.isClosed)
          (Some(oldPost.creationDati), Some(SystemUser.User.id))
        else
          (None, None)

      val deletedStatus = new DeletedStatus(
        if (oldPost.isTreeDeleted) TreeBits | ancestorsDeletedBit
        else if (oldPost.isPostDeleted) SelfBit | ancestorsDeletedBit
        else ancestorsDeletedBit)

      val (deletedAt, deletedById) =
        if (deletedStatus.isDeleted)
          (Some(oldPost.creationDati), Some(SystemUser.User.id))
        else
          (None, None)

      var safeVersion =
        if (oldPost.lastApprovalDati.isDefined) Some(Post2.FirstVersion) else None

      // Add some dummy text to empty posts. Empty posts are no longer allowed.
      var approvedSource = oldPost.approvedText
      var approvedHtmlSanitized = oldPost.approvedHtmlSanitized
      var approvedById = oldPost.lastManuallyApprovedById.map(_.toInt) orElse
        oldPost.lastApprovalDati.map(_ => SystemUser.User.id)
      var approvedAt = oldPost.lastApprovalDati
      val isEmpty =
        approvedSource.map(_.trim.length > 0) != Some(true) ||
          approvedHtmlSanitized.map(_.trim.length > 0) != Some(true)
      if (isEmpty) {
        safeVersion = Some(Post2.FirstVersion)
        approvedSource = Some("(empty post)")
        approvedHtmlSanitized = Some("<p>(empty post)</p>")
        approvedById = Some(SystemUser.User.id)
        approvedAt = Some(oldPost.creationDati)
      }

      Post2(
        siteId = siteTransaction.siteId,
        pageId = pageId,
        id = oldPost.id,
        parentId = oldPost.parentId,
        multireplyPostIds = oldPost.multireplyPostIds,
        createdAt = oldPost.creationDati,
        createdById = oldPost.userId.toInt,
        // Let's delete all edit history.
        lastEditedAt = None,
        lastEditedById = None,
        lastApprovedEditAt = None,
        lastApprovedEditById = None,
        numDistinctEditors = 0,
        safeVersion = safeVersion,
        approvedSource = approvedSource,
        approvedHtmlSanitized = approvedHtmlSanitized,
        approvedAt = approvedAt,
        approvedById = approvedById,
        approvedVersion = safeVersion,
        currentSourcePatch = None, // ignore unapproved edits
        currentVersion = Post2.FirstVersion,
        collapsedStatus = collapsedStatus,
        collapsedAt = collapsedAt,
        collapsedById = collapsedById,
        closedStatus = closedStatus,
        closedAt = closedAt,
        closedById = closedById,
        hiddenAt = None,
        hiddenById = None,
        deletedStatus = deletedStatus,
        deletedAt = deletedAt,
        deletedById = deletedById,
        pinnedPosition = None,
        numPendingFlags = 0,
        numHandledFlags = 0,
        numPendingEditSuggestions = 0,
        numLikeVotes = 0,
        numWrongVotes = 0,
        numTimesRead = 0)
    }
  }
    */
}
