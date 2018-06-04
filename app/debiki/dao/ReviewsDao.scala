/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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
import com.debiki.core.EditedSettings.MaxNumFirstPosts
import debiki.EdHttp._
import java.{util => ju}
import scala.collection.mutable.ArrayBuffer
import scala.collection.{mutable, immutable}


/** Review stuff: a ReviewTask and the users and posts it refers to.
  */
case class ReviewStuff(
  id: ReviewTaskId,
  reasons: immutable.Seq[ReviewReason],
  createdAt: ju.Date,
  createdBy: User,
  moreReasonsAt: Option[ju.Date],
  completedAt: Option[ju.Date],
  completedBy: Option[User],
  invalidatedAt: Option[ju.Date],
  decidedAt: Option[When],
  decision: Option[ReviewDecision],
  maybeBadUser: User, // remove? or change to a list, the most recent editors?
  pageId: Option[PageId],
  pageTitle: Option[String],
  post: Option[Post],
  flags: Seq[PostFlag])




trait ReviewsDao {
  self: SiteDao =>


  def makeReviewDecision(taskId: ReviewTaskId, requester: Who, anyRevNr: Option[Int],
        decision: ReviewDecision) {
    readWriteTransaction { tx =>
      val task = tx.loadReviewTask(taskId) getOrElse
        throwNotFound("EsE7YMKR25", s"Review task not found, id $taskId")

      // The post might have been moved to a different page, so reload it.
      val anyPost = task.postId.flatMap(tx.loadPost)
      val pageId = anyPost.map(_.pageId)

      throwForbiddenIf(task.completedAt.isDefined,
        "EsE2PUM4", "Review task already completed")
      throwForbiddenIf(task.invalidatedAt.isDefined,
        "EsE2PUM5", "Review task cannot be completed, e.g. because the-thing-to-review was deleted")

      val taskWithDecision = task.copy(
        decidedAt = Some(globals.now().toJavaDate),
        decision = Some(decision),
        completedById = Some(requester.id),
        completedAtRevNr = anyRevNr)

      val auditLogEntry = AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.MakeReviewDecision,
        doerId = requester.id,
        doneAt = globals.now().toJavaDate,
        browserIdData = requester.browserIdData,
        pageId = pageId,
        uniquePostId = task.postId,
        postNr = task.postNr)
        // COULD add audit log fields: review decision & task id?

      tx.upsertReviewTask(taskWithDecision)
      tx.insertAuditLogEntry(auditLogEntry)
    }
  }


  def tryUndoReviewDecision(reviewTaskId: ReviewTaskId, requester: Who): Boolean = {
    readWriteTransaction { tx =>
      val task = tx.loadReviewTask(reviewTaskId) getOrElse
        throwNotFound("TyE48YM4X7", s"Review task not found, id $reviewTaskId")

      if (task.completedAt.isDefined)
        return false

      throwBadRequestIf(task.decidedAt.isEmpty,
        "TyE5GKQRT2", s"Review action not decided. Task id $reviewTaskId")

      // The post might have been moved to a different page, so reload it.
      val anyPost = task.postId.flatMap(tx.loadPost)
      val pageId = anyPost.map(_.pageId)

      val taskUndone = task.copy(
        decidedAt = None,
        completedById = None,
        completedAtRevNr = None,
        decision = None)

      val auditLogEntry = AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.UndoReviewDecision,
        doerId = requester.id,
        doneAt = globals.now().toJavaDate,
        browserIdData = requester.browserIdData,
        pageId = pageId,
        uniquePostId = task.postId,
        postNr = task.postNr)
        // COULD add audit log fields: review decision & task id?

      tx.upsertReviewTask(taskUndone)
      tx.insertAuditLogEntry(auditLogEntry)
      true
    }
  }


  def carryOutReviewDecision(taskId: ReviewTaskId) {
    readWriteTransaction { tx =>
      val anyTask = tx.loadReviewTask(taskId)
      siteId
      taskId
      val zzz = s"Review task not found, site $siteId, task $taskId"
      val task = anyTask.get //OrDie("EsE8YM42", s"Review task not found, site $siteId, task $taskId")

      // Only one thread completes review tasks, so shouldn't be any races. [5YMBWQT]
      dieIf(task.completedAt.isDefined, "TyE2A2PUM6", "Review task already completed")
      dieIf(task.invalidatedAt.isDefined, "TyE5J2PUM7", "Review task invalidated")
      val decision = task.decision getOrDie "TyE4ZK5QL"
      val completedById = task.completedById getOrDie "TyE2A2PUM01"
      dieIf(task.completedAtRevNr.isEmpty, "TyE2A2PUM02")

      val completedTask = task.copy(completedAt = Some(globals.now().toJavaDate))
      tx.upsertReviewTask(completedTask)

      dieIf(task.postNr.isEmpty, "Only posts can be reviewed right now [EsE7YGK29]")

      task.postNr foreach { postNr =>
        val post = tx.loadPost(task.postId getOrDie "EsE5YGK02") getOrElse {
          // Deleted? Ignore it then.
          return
        }
        // We're in a background thread and have forgotten the browser id data.
        // Could to load it from an earlier audit log entry, ... but maybe it's been deleted?
        // For now:
        val browserIdData = BrowserIdData.Forgotten
        decision match {
          case ReviewDecision.Accept =>
            if (post.isCurrentVersionApproved) {
              // The System user has apparently approved the post already.
              // However, it might have been hidden a tiny bit later, after some  external services
              // said it's spam. Now, though, we know it's apparently not spam, so show it.
              if (post.isBodyHidden) {
                // SPAM RACE COULD unhide only if rev nr that got hidden <=
                // rev that was reviewed. [6GKC3U]
                changePostStatusImpl(postNr = post.nr, pageId = post.pageId,
                    PostStatusAction.UnhidePost, userId = completedById, tx)
              }
            }
            else {
              if (task.isForBothTitleAndBody) {
                // This is for a new page. Approve the *title* here, and the *body* just below.
                dieIf(!task.postNr.contains(PageParts.BodyNr), "EsE5TK0I2")
                approvePostImpl(post.pageId, PageParts.TitleNr, approverId = completedById,
                  tx)
              }
              approvePostImpl(post.pageId, post.nr, approverId = completedById, tx)
              perhapsCascadeApproval(post.createdById)(tx)
            }
          case ReviewDecision.DeletePostOrPage =>
            if (task.isForBothTitleAndBody) {
              deletePagesImpl(Seq(task.pageId getOrDie "EsE4K85R2"), deleterId = completedById,
                  browserIdData)(tx)
            }
            else {
              deletePostImpl(post.pageId, postNr = post.nr, deletedById = completedById,
                browserIdData, tx)
            }
        }
      }
    }
  }


  /** If we have approved all the required first post review tasks caused by userId, then
    * this method auto-approves all remaining first review tasks — because now we trust
    * the user that much.
    */
  private def perhapsCascadeApproval(userId: UserId)(transaction: SiteTransaction) {
    var pageIdsToRefresh = mutable.Set[PageId]()
    val settings = loadWholeSiteSettings(transaction)
    val numFirstToAllow = math.min(MaxNumFirstPosts, settings.numFirstPostsToAllow)
    val numFirstToApprove = math.min(MaxNumFirstPosts, settings.numFirstPostsToApprove)
    if (numFirstToAllow > 0 && numFirstToApprove > 0) {
      // Load some more review tasks than just MaxNumFirstPosts, in case the user has
      // somehow triggered even more review tasks, e.g. because getting flagged.
      // SECURITY (minor) if other users flag userId's posts 9999 times, we won't load any
      // approved posts here, and the approval won't be cascaded.
      val someMore = 15
      // COULD load tasks for posts, and tasks for approved posts, and tasks resolved as harmful,
      // in three separate queries? So won't risk 9999 of one type —> finds no other types.
      val tasks = transaction.loadReviewTasksAboutUser(userId,
        limit = MaxNumFirstPosts + someMore, OrderBy.OldestFirst)

      // Use a set, because there might be many review tasks for the same post, if different
      // people flag the same post.
      var postIdsApproved = Set[PostId]()
      var numHarmful = 0
      tasks foreach { task =>
        if (task.decision.exists(_.isFine)) {
          if (task.postId.isDefined) {
            postIdsApproved += task.postId getOrDie "EdE7KW02Y"
          }
          else {
            // What's this? Perhaps the user editing his/her bio and the bio getting
            // reviewed (not yet implemented though). Ignore.
          }
        }
        else if (task.decision.exists(_.isRejectionBadUser)) {
          numHarmful += 1
        }
      }

      val numApproved = postIdsApproved.size
      if (numHarmful > 0)
        return

      val shallApproveRemainingFirstPosts = numApproved >= numFirstToApprove
      if (shallApproveRemainingFirstPosts) {
        val pendingTasks = tasks.filter(!_.doneOrGone)
        val titlesToApprove = mutable.HashSet[PageId]()
        val postIdsToApprove = pendingTasks flatMap { task =>
          if (task.postNr.contains(PageParts.BodyNr)) {
            titlesToApprove += task.pageId getOrDie "EdE2WK0L6"
          }
          task.postId
        }
        val postsToApprove = transaction.loadPostsByUniqueId(postIdsToApprove).values
        val titlePostsToApprove = titlesToApprove.flatMap(transaction.loadTitle)
        val allPostsToApprove = postsToApprove ++ titlePostsToApprove
        for ((pageId, posts) <- allPostsToApprove.groupBy(_.pageId)) {
          pageIdsToRefresh += pageId
          autoApprovePendingEarlyPosts(pageId, posts)(transaction)
        }
      }
    }
    refreshPagesInAnyCache(pageIdsToRefresh)
  }


  def loadReviewStuff(olderOrEqualTo: ju.Date, limit: Int): (Seq[ReviewStuff], Map[UserId, User]) =
    readOnlyTransaction { transaction =>
      loadStuffImpl(olderOrEqualTo, limit, transaction)
    }


  private def loadStuffImpl(olderOrEqualTo: ju.Date, limit: Int, transaction: SiteTransaction)
        : (Seq[ReviewStuff], Map[UserId, User]) = {
    val reviewTasks = transaction.loadReviewTasks(olderOrEqualTo, limit)

    val postIds = reviewTasks.flatMap(_.postId).toSet
    val postsById = transaction.loadPostsByUniqueId(postIds)

    val userIds = mutable.Set[UserId]()
    reviewTasks foreach { task =>
      userIds.add(task.createdById)
      task.completedById.foreach(userIds.add)
      userIds.add(task.maybeBadUserId)
    }
    postsById.values foreach { post =>
      userIds.add(post.createdById)
      userIds.add(post.currentRevisionById)
      post.lastApprovedEditById.foreach(userIds.add)
    }

    val flags: Seq[PostFlag] = transaction.loadFlagsFor(postsById.values.map(_.pagePostNr))
    val flagsByPostId: Map[PostId, Seq[PostFlag]] = flags.groupBy(_.uniqueId)
    flags foreach { flag =>
      userIds.add(flag.flaggerId)
    }

    val usersById = transaction.loadUsersAsMap(userIds)

    val pageIds = postsById.values.map(_.pageId)
    val titlesByPageId = transaction.loadTitlesPreferApproved(pageIds)

    val result = ArrayBuffer[ReviewStuff]()
    for (task <- reviewTasks) {
      def whichTask = s"site $siteId, review task id ${task.id}"
      val anyPost = task.postId.flatMap(postsById.get)
      val anyPageTitle = anyPost.flatMap(post => titlesByPageId.get(post.pageId))
      val flags = task.postId match {
        case None => Nil
        case Some(id) => flagsByPostId.getOrElse(id, Nil)
      }
      result.append(
        ReviewStuff(
          id = task.id,
          reasons = task.reasons,
          createdBy = usersById.get(task.createdById) getOrDie "EsE4GUP2",
          createdAt = task.createdAt,
          moreReasonsAt = task.moreReasonsAt,
          completedAt = task.completedAt,
          completedBy = task.completedById.flatMap(usersById.get),
          invalidatedAt = task.invalidatedAt,
          decidedAt = When.fromOptDate(task.decidedAt),
          decision = task.decision,
          maybeBadUser = usersById.get(task.maybeBadUserId) getOrDie "EdE2KU8B",
          pageId = task.pageId,
          pageTitle = anyPageTitle,
          post = anyPost,
          flags = flags))
    }
    (result.toSeq, usersById)
  }

}

