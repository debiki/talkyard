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
import debiki.DebikiHttp.{throwNotFound, throwForbidden}
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
  resolution: Option[ReviewTaskResolution],
  maybeBadUser: User,
  pageId: Option[PageId],
  pageTitle: Option[String],
  post: Option[Post]) {

  resolution.foreach(ReviewTaskResolution.requireIsValid)
}



trait ReviewsDao {
  self: SiteDao =>


  def completeReviewTask(taskId: ReviewTaskId, completedById: UserId, anyRevNr: Option[Int],
        action: ReviewAction, browserIdData: BrowserIdData) {
    readWriteTransaction { transaction =>
      val task = transaction.loadReviewTask(taskId) getOrElse {
        throwNotFound("EsE8YM42", s"Review task not found, id $taskId")
      }
      if (task.doneOrGone)
        throwForbidden("EsE2PUM4", o"""Review task already completed, or cannot be completed
            e.g. because the-thing-to-review was deleted""")
      val completedTask = task.copy(completedAt = Some(transaction.currentTime),
        completedById = Some(completedById), completedAtRevNr = anyRevNr,
        resolution = Some(ReviewTaskResolution.Fine)) // hmm, need some Rejected btn too (!)
      transaction.upsertReviewTask(completedTask)

      dieIf(task.postNr.isEmpty, "Only posts can be reviewed right now [EsE7YGK29]")

      task.postNr foreach { postNr =>
        val post = transaction.loadPost(task.postId getOrDie "EsE5YGK02") getOrElse {
          // Deleted? Ignore it then.
          return
        }
        action match {
          case ReviewAction.Accept =>
            if (post.isCurrentVersionApproved) {
              // The System user has apparently approved the post already.
              // However, it might have been hidden a tiny bit later, after some  external services
              // said it's spam. Now, though, we know it's apparently not spam, so show it.
              if (post.isBodyHidden) {
                // SPAM RACE COULD unhide only if rev nr that got hidden <=
                // rev that was reviewed. [6GKC3U]
                changePostStatusImpl(postNr = post.nr, pageId = post.pageId,
                    PostStatusAction.UnhidePost, userId = completedById, transaction)
              }
            }
            else {
              if (task.isForBothTitleAndBody) {
                // This is for a new page. Approve the *title* here, and the *body* just below.
                dieIf(!task.postNr.contains(PageParts.BodyNr), "EsE5TK0I2")
                approvePostImpl(post.pageId, PageParts.TitleNr, approverId = completedById,
                  transaction)
              }
              approvePostImpl(post.pageId, post.nr, approverId = completedById, transaction)
              perhapsCascadeApproval(post.createdById)(transaction)
            }
          case ReviewAction.DeletePostOrPage =>
            if (task.isForBothTitleAndBody) {
              deletePagesImpl(Seq(task.pageId getOrDie "EsE4K85R2"), deleterId = completedById,
                  browserIdData)(transaction)
            }
            else {
              deletePostImpl(post.pageId, postNr = post.nr, deletedById = completedById,
                browserIdData, transaction)
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
        if (task.resolution.exists(_.isFine)) {
          if (task.postId.isDefined) {
            postIdsApproved += task.postId getOrDie "EdE7KW02Y"
          }
          else {
            // What's this? Perhaps the user editing his/her bio and the bio getting
            // reviewed (not yet implemented though). Ignore.
          }
        }
        else if (task.resolution.exists(_.isHarmful)) {
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
    val usersById = transaction.loadUsersAsMap(userIds)

    val pageIds = postsById.values.map(_.pageId)
    val titlesByPageId = transaction.loadTitlesPreferApproved(pageIds)

    val result = ArrayBuffer[ReviewStuff]()
    for (task <- reviewTasks) {
      def whichTask = s"site $siteId, review task id ${task.id}"
      val anyPost = task.postId.flatMap(postsById.get)
      val anyPageTitle = anyPost.flatMap(post => titlesByPageId.get(post.pageId))
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
          resolution = task.resolution,
          maybeBadUser = usersById.get(task.maybeBadUserId) getOrDie "EdE2KU8B",
          pageId = task.pageId,
          pageTitle = anyPageTitle,
          post = anyPost))
    }
    (result.toSeq, usersById)
  }

}

