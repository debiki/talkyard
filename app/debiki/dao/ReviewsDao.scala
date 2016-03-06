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
  causedBy: User,
  moreReasonsAt: Option[ju.Date],
  completedAt: Option[ju.Date],
  completedBy: Option[User],
  invalidatedAt: Option[ju.Date],
  resolution: Option[Int],
  user: Option[User],
  pageId: Option[PageId],
  pageTitle: Option[String],
  post: Option[Post])



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
        resolution = Some(100)) // for now
      transaction.upsertReviewTask(completedTask)

      dieIf(task.postNr.isEmpty, "Only posts can be reviewed right now [EsE7YGK29]")

      task.postNr foreach { postNr =>
        val post = transaction.loadPost(task.postId getOrDie "EsE5YGK02") getOrElse {
          // Deleted? Ignore it then.
          return
        }
        action match {
          case ReviewAction.Accept =>
            if (!post.isCurrentVersionApproved) {
              approvePostImpl(post.pageId, post.nr, approverId = completedById, transaction)
            }
          case ReviewAction.DeletePostOrPage =>
            // Later: if nr = BodyId, & not approved, then delete the whole page
            // (no one has seen it anyway).
            deletePostImpl(post.pageId, postNr = post.nr, deletedById = completedById,
              browserIdData, transaction)
        }
      }
    }
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
      userIds.add(task.causedById)
      task.completedById.foreach(userIds.add)
      task.userId.foreach(userIds.add)
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
          causedBy = usersById.get(task.causedById) getOrDie "EsE4GUP2",
          createdAt = task.createdAt,
          moreReasonsAt = task.moreReasonsAt,
          completedAt = task.completedAt,
          completedBy = task.completedById.flatMap(usersById.get),
          invalidatedAt = task.invalidatedAt,
          resolution = task.resolution,
          user = task.userId.flatMap(usersById.get),
          pageId = task.pageId,
          pageTitle = anyPageTitle,
          post = anyPost))
    }
    (result.toSeq, usersById)
  }

}

