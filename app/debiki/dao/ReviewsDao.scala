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
import play.{api => p}


/** Review stuff: a ReviewTask and the users and posts it refers to.
  */
case class ReviewStuff(
  id: ReviewTaskId,
  reasons: immutable.Seq[ReviewReason],
  createdAt: ju.Date,
  createdBy: Participant,
  moreReasonsAt: Option[ju.Date],
  completedAt: Option[ju.Date],
  decidedBy: Option[Participant],
  invalidatedAt: Option[ju.Date],
  decidedAt: Option[When],
  decision: Option[ReviewDecision],
  maybeBadUser: Participant, // remove? or change to a list, the most recent editors?
  pageId: Option[PageId],
  pageTitle: Option[String],
  post: Option[Post],
  flags: Seq[PostFlag])




trait ReviewsDao {
  self: SiteDao =>


  def makeReviewDecisionIfAuthz(taskId: ReviewTaskId, requester: Who, anyRevNr: Option[Int],
        decision: ReviewDecision) {
    readWriteTransaction { tx =>
      val task = tx.loadReviewTask(taskId) getOrElse
        throwNotFound("EsE7YMKR25", s"Review task not found, id $taskId")

      throwIfMayNotSeeReviewTaskUseCache(task, requester)

      // Another staff member might have completed this task already, or maybe the current
      // has, but in a different browser tab.
      if (task.doneOrGone)
        return

      // The post might have been moved to a different page, so reload it.
      val anyPost = task.postId.flatMap(tx.loadPost)
      val pageId = anyPost.map(_.pageId)

      val taskWithDecision = task.copy(
        decidedAt = Some(globals.now().toJavaDate),
        decision = Some(decision),
        decidedById = Some(requester.id),
        decidedAtRevNr = anyRevNr)

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
        // COULD add audit log fields: review decision & task id? (4UWSQ1)

      tx.upsertReviewTask(taskWithDecision)
      tx.insertAuditLogEntry(auditLogEntry)
    }
  }


  def tryUndoReviewDecisionIfAuthz(reviewTaskId: ReviewTaskId, requester: Who): Boolean = {
    readWriteTransaction { tx =>
      val task = tx.loadReviewTask(reviewTaskId) getOrElse
        throwNotFound("TyE48YM4X7", s"Review task not found, id $reviewTaskId")

      throwIfMayNotSeeReviewTaskUseCache(task, requester)

      if (task.completedAt.isDefined)
        return false

      // Don't: if (task-invalidated) return false — instead, undo anyway: maybe later some day,
      // tasks can become active again. Then better have this task in an undone state.

      throwBadRequestIf(task.decidedAt.isEmpty,
        "TyE5GKQRT2", s"Review action not decided. Task id $reviewTaskId")

      // The post might have been moved to a different page, so reload it.
      val anyPost = task.postId.flatMap(tx.loadPost)
      val pageId = anyPost.map(_.pageId)

      val taskUndone = task.copy(
        decidedAt = None,
        decidedById = None,
        decidedAtRevNr = None,
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
        // COULD add audit log fields: review decision & task id? (4UWSQ1)

      tx.upsertReviewTask(taskUndone)
      tx.insertAuditLogEntry(auditLogEntry)
      true
    }
  }


  def carryOutReviewDecision(taskId: ReviewTaskId) {
    val pageIdsToRefresh = mutable.Set[PageId]()

    readWriteTransaction { tx =>
      val anyTask = tx.loadReviewTask(taskId)
      val task = anyTask.getOrDie("EsE8YM42", s"s$siteId: Review task $taskId not found")
      task.pageId.map(pageIdsToRefresh.add)

      if (task.invalidatedAt.isDefined) {
        // This can happen if many users flag a post, and one or different moderators click Delete,
        // for each flag. Then many delete decisions get enqueued, for the same post
        // — and when the first delete decision gets carried out, the other review tasks
        // become invalidated (because now the post is gone). [2MFFKR0]
        // That's fine, just do nothing. (2KYF5A)
        return
      }

      // Only one thread completes review tasks, so shouldn't be any races. [5YMBWQT]
      dieIf(task.completedAt.isDefined, "TyE2A2PUM6", "Review task already completed")
      val decision = task.decision getOrDie "TyE4ZK5QL"
      val decidedById = task.decidedById getOrDie "TyE2A2PUM01"
      dieIf(task.decidedAtRevNr.isEmpty, "TyE2A2PUM02")

      val completedTask = task.copy(completedAt = Some(globals.now().toJavaDate))
      tx.upsertReviewTask(completedTask)

      dieIf(task.postNr.isEmpty, "Only posts can be reviewed right now [EsE7YGK29]")

      task.postNr foreach { postNr =>
        val post = tx.loadPost(task.postId getOrDie "EsE5YGK02") getOrElse {
          p.Logger.warn(s"s$siteId: Review task $taskId: Post ${task.postId} gone, why? [TyE5KQIBQ2]")
          return
        }

        // Currently review tasks don't always get invalidated, when posts and pages get deleted. (2KYF5A)
        if (post.deletedAt.isDefined)
          return

        pageIdsToRefresh.add(post.pageId)

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
                    PostStatusAction.UnhidePost, userId = decidedById, doingReviewTask = Some(task), tx)
              }
            }
            else {
              if (task.isForBothTitleAndBody) {
                // This is for a new page. Approve the *title* here, and the *body* just below.
                dieIf(!task.postNr.contains(PageParts.BodyNr), "EsE5TK0I2")
                approvePostImpl(post.pageId, PageParts.TitleNr, approverId = decidedById, tx)
              }
              approvePostImpl(post.pageId, post.nr, approverId = decidedById, tx)
              perhapsCascadeApproval(post.createdById, pageIdsToRefresh)(tx)
            }
          case ReviewDecision.DeletePostOrPage =>
            if (task.isForBothTitleAndBody) {
              val pageId = task.pageId getOrDie "TyE4K85R2"
              deletePagesImpl(Seq(pageId), deleterId = decidedById,
                  browserIdData, doingReviewTask = Some(task))(tx)
            }
            else {
              deletePostImpl(post.pageId, postNr = post.nr, deletedById = decidedById,
                  doingReviewTask = Some(task), browserIdData, tx)
            }
        }
      }
    }

    refreshPagesInAnyCache(pageIdsToRefresh)
  }


  /** If we have approved all the required first post review tasks caused by userId, then
    * this method auto-approves all remaining first review tasks — because now we trust
    * the user that much.
    */
  private def perhapsCascadeApproval(userId: UserId, pageIdsToRefresh: mutable.Set[PageId])(
        transaction: SiteTransaction) {
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
  }


  def invalidateReviewTasksForPosts(posts: Iterable[Post], doingReviewTask: Option[ReviewTask],
        tx: SiteTransaction) {
    invalidatedReviewTasksImpl(posts, shallBeInvalidated = true, doingReviewTask, tx)
  }


  def reactivateReviewTasksForPosts(posts: Iterable[Post], doingReviewTask: Option[ReviewTask],
         tx: SiteTransaction) {
    TESTS_MISSING // [UNDELPOST]
    untestedIf(posts.nonEmpty, "TyE2KIFW4", "Reactivating review tasks for undeleted posts") // [2VSP5Q8]
    invalidatedReviewTasksImpl(posts, shallBeInvalidated = false, doingReviewTask, tx)
  }


  CLEAN_UP; DO_AFTER /* 2018-10-01  [5RW2GR8]  After rethinking reviews, maybe better to never
  invalidate any reveiw tasks, when a page / post gets deleted, via *not* the review interface?
  So staff will see everything that gets flagged — even if someone deleted it first
  for whatever reason.

  def invalidateReviewTasksForPageId(pageId: PageId, doingReviewTask: Option[ReviewTask],
         tx: SiteTransaction) {
    val posts = tx.loadPostsOnPage(pageId)
    invalidatedReviewTasksImpl(posts, shallBeInvalidated = true, doingReviewTask, tx)
  }


  def reactivateReviewTasksForPageId(pageId: PageId, doingReviewTask: Option[ReviewTask],
         tx: SiteTransaction) {
    val posts = tx.loadPostsOnPage(pageId)
    invalidatedReviewTasksImpl(posts, shallBeInvalidated = false, doingReviewTask, tx)
  } */


  private def invalidatedReviewTasksImpl(posts: Iterable[Post], shallBeInvalidated: Boolean,
        doingReviewTask: Option[ReviewTask], tx: SiteTransaction) {

    // If bug then:
    // If somehow some day a review task doesn't get properly invalidated, and
    // it also cannot be decided & completed: Fix the bug, & delete that row from the database,
    // maybe even delete all review tasks, they are relatively unimportant, & no incoming keys.

    val now = globals.now().toJavaDate
    val tasksLoaded = tx.loadReviewTasksAboutPostIds(posts.map(_.id))
    def isReactivating = !shallBeInvalidated  // easier to read

    val tasksToUpdate = tasksLoaded filterNot { task =>
      def anyPostForThisTask = task.postId.flatMap(taskPostId => posts.find(_.id == taskPostId))
      def postDeleted = anyPostForThisTask.exists(_.isDeleted)
      (task.completedAt.isDefined
        || task.invalidatedAt.isDefined == shallBeInvalidated  // already correct status
        || doingReviewTask.exists(_.id == task.id)  // this task gets updated by some ancestor caller
        || (isReactivating && postDeleted))  // if post gone, don't reactivate this task
    }

    val tasksAfter = tasksToUpdate.map { task =>
      task.copy(invalidatedAt = if (shallBeInvalidated) Some(now) else None)
    }

    tasksAfter.foreach(tx.upsertReviewTask)
  }


  def loadReviewStuff(olderOrEqualTo: ju.Date, limit: Int, forWho: Who)
        : (Seq[ReviewStuff], ReviewTaskCounts, Map[UserId, Participant], Map[PageId, PageMeta]) =
    readOnlyTransaction { tx =>
      val requester = tx.loadTheParticipant(forWho.id)
      loadStuffImpl(olderOrEqualTo, limit, requester, tx)
    }


  private def loadStuffImpl(olderOrEqualTo: ju.Date, limit: Int, requester: Participant, tx: SiteTransaction)
        : (Seq[ReviewStuff], ReviewTaskCounts, Map[UserId, Participant], Map[PageId, PageMeta]) = {
    val reviewTasksMaybeNotSee = tx.loadReviewTasks(olderOrEqualTo, limit)
    val taskCounts = tx.loadReviewTaskCounts(requester.isAdmin)

    val postIds = reviewTasksMaybeNotSee.flatMap(_.postId).toSet
    val postsById = tx.loadPostsByUniqueId(postIds)

    val pageIds = postsById.values.map(_.pageId)
    val pageMetaById = tx.loadPageMetasAsMap(pageIds)
    val forbiddenPageIds = mutable.Set[PageId]()

    // ----- May see review task & page?  [TyT5WB2R0] [5FSLW20]

    // Might as well use the cache here (5DE4A28), why not? Otherwise, if listing
    // many tasks, this filter step would maybe take a little bit rather long?

    val reviewTasks = if (requester.isAdmin) reviewTasksMaybeNotSee else {
      val authzContext = getForumAuthzContext(Some(requester)) // (5DE4A28)

      for (pageMeta <- pageMetaById.values) {
        val (maySee, debugCode) = maySeePageUseCacheAndAuthzCtx(pageMeta, authzContext) // (5DE4A28)
        if (!maySee) {
          forbiddenPageIds.add(pageMeta.pageId)
        }
      }

      // Staff may see all posts on a page they may see [5I8QS2A], so we check page access only.
      reviewTasksMaybeNotSee filter { task =>
        task.postId match {
          case None => true
          case Some(postId) =>
            postsById.get(postId) match {
              case None => false
              case Some(post) =>
                !forbiddenPageIds.contains(post.pageId)
            }
        }
      }
    }

    // -----  Load related things: flags, users, pages

    val userIds = mutable.Set[UserId]()
    reviewTasks foreach { task =>
      userIds.add(task.createdById)
      task.decidedById.foreach(userIds.add)
      userIds.add(task.maybeBadUserId)
    }
    postsById.values foreach { post =>
      userIds.add(post.createdById)
      userIds.add(post.currentRevisionById)
      post.lastApprovedEditById.foreach(userIds.add)
    }

    val flags: Seq[PostFlag] = tx.loadFlagsFor(postsById.values.map(_.pagePostNr))
    val flagsByPostId: Map[PostId, Seq[PostFlag]] = flags.groupBy(_.uniqueId)
    flags foreach { flag =>
      userIds.add(flag.flaggerId)
    }

    val usersById = tx.loadParticipantsAsMap(userIds)

    val titlesByPageId = tx.loadTitlesPreferApproved(pageIds)

    // -----  Construct a ReviewStuff list

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
          decidedBy = task.decidedById.flatMap(usersById.get),
          invalidatedAt = task.invalidatedAt,
          decidedAt = When.fromOptDate(task.decidedAt),
          decision = task.decision,
          maybeBadUser = usersById.get(task.maybeBadUserId) getOrDie "EdE2KU8B",
          pageId = task.pageId,
          pageTitle = anyPageTitle,
          post = anyPost,
          flags = flags))
    }
    (result.toSeq, taskCounts, usersById, pageMetaById)
  }

}

