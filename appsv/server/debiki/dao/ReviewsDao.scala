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
import debiki.Globals.isDevOrTest
import java.{util => ju}
import scala.collection.mutable.ArrayBuffer
import scala.collection.{immutable, mutable}
import play.{api => p}
import talkyard.server.dao._


/** Review stuff: a ReviewTask and the users and posts it refers to.
  */
case class ReviewStuff(   // RENAME to  ModTaskStuff
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




trait ReviewsDao {   // RENAME to ModerationDao,  MOVE to  talkyard.server.modn
  self: SiteDao =>


  /** This only remembers a *decision* about what to do. The decision is then
    * carried out, by JanitorActor.executePendingReviewTasks, after a short
    * undo-decision timeout.
    */
  def makeReviewDecisionIfAuthz(taskId: ReviewTaskId, requester: Who, anyRevNr: Opt[i32],
        decision: ReviewDecision): U = {
    writeTx { (tx, _) =>
      val task = tx.loadReviewTask(taskId) getOrElse throwNotFound(
            "EsE7YMKR25", s"Review task not found, id $taskId")

      throwIfMayNotSeeReviewTaskUseCache(task, requester)

      // Another staff member might have completed this task already, or maybe the current
      // has, but in a different browser tab.
      if (task.doneOrGone)
        return

      // The post might have been moved to a different page, so load it by
      // post id (not original page id and post nr).
      val anyPost = task.postId.flatMap(tx.loadPost)
      val pageId = anyPost.map(_.pageId)

      // This will overwrite any old decision, until the undo timeout has expired.
      // Thereafter doneOrGone above is true, and we'll return early.
      val taskWithDecision = task.copy(
        decidedAt = Some(globals.now().toJavaDate),
        decision = Some(decision),
        decidedById = Some(requester.id),
        decidedAtRevNr = anyRevNr)

      val auditLogEntry = AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.MakeReviewDecision,
        doerTrueId = requester.trueId,
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



  def tryUndoReviewDecisionIfAuthz(reviewTaskId: ReviewTaskId, requester: Who): Bo = {
    writeTx { (tx, _) =>
      val task = tx.loadReviewTask(reviewTaskId) getOrElse throwNotFound(
            "TyE48YM4X7", s"Review task not found, id $reviewTaskId")

      throwIfMayNotSeeReviewTaskUseCache(task, requester)

      if (task.isDone) {
        // There's a race between the human and the undo timeout, that's fine,
        // don't throw any error.
        return false
      }

      if (task.gotInvalidated) {
        // Proceed, undo the decision — will have no effect though.
        // Maybe later some day, mod tasks can become active again (un-invalidated).
      }

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
        doerTrueId = requester.trueId,
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



  def carryOutReviewDecision(taskId: ReviewTaskId): U = {
    writeTx { (tx, staleStuff) =>
      val anyTask = tx.loadReviewTask(taskId)
      // Not found here is a server bug — we're not handling an end user request.
      val task = anyTask.getOrDie("EsE8YM42", s"s$siteId: Review task $taskId not found")

      if (task.gotInvalidated) {
        // This can happen if many users flag a post, and one or different moderators click Delete,
        // for each flag. Then many delete decisions get enqueued, for the same post
        // — and when the first delete decision gets carried out, the other review tasks
        // become invalidated (because now the post is gone). [2MFFKR0]
        // That's fine, just do nothing. (2KYF5A)
        //
        // SHOULD make sure to ignore those invalidated tasks when  [apr_deld_post]
        // counting fraction ok vs rejected recent tasks!
        //
        return
      }

      if (task.isDone) {
        // Fine, need do nothing.
        // (There's a race: 1) The janitor actor completes review tasks, [5YMBWQT]
        // and 2) there're in page instant Approve and Reject buttons [in_pg_apr])
        return
      }

      val decision = task.decision getOrDie "TyE4ZK5QL"
      val decidedById = task.decidedById getOrDie "TyE2A2PUM01"
      dieIf(task.decidedAtRevNr.isEmpty, "TyE2A2PUM02")

      dieIf(task.postNr.isEmpty, "Only posts can be reviewed right now [EsE7YGK29]")

      val post = tx.loadPost(task.postId getOrDie "EsE5YGK02") getOrElse {
          logger.warn(s"s$siteId: Review task $taskId: Post ${task.postId} gone, why? [TyE5KQIBQ2]")
          return
        }

      doModTaskNow(post, Seq(task), decision, decidedById = decidedById
              )(tx, staleStuff)
    }
  }



  /** When on a page, and looking at / reading the post — then, if one
    * approves it, that happens instantly, no undo timeout.
    * Because here one needs to click twice (once to confirm),
    * but on the Moderation staff page, there's no Confirm (that'd been
    * annoying? Because then one might moderate many things quickly in a row.
    * Then, Undo better?)
    */
  def moderatePostInstantly(postId: PostId, postRevNr: PostRevNr,
          decision: ReviewDecision, moderator: Participant): ModResult = {
    // Tests:
    //    - modn-from-disc-page-appr-befr.2browsers.test.ts  TyTE2E603RTJ

    dieIf(!moderator.isStaff, "TyE5KRDL356")
    // More authz in the tx below.

    dieIf(decision != ReviewDecision.Accept
          && decision != ReviewDecision.DeletePostOrPage, "TYE06SAKHJ34",
          s"Unexpected moderatePostInstantly() decision: $decision")

    val modResult = writeTx { (tx, staleStuff) =>
      val post = tx.loadPost(postId).get
      throwIfMayNotSeePost(post, Some(moderator))(tx)

      val allTasks = tx.loadReviewTasksAboutPostIds(Seq(post.id))
      val tasksToDecide = allTasks.filterNot(task =>
            task.doneOrGone ||
            // Don't change mod decisions made by others. [skip_decided_mod_tasks]
            task.isDecidedButNotBy(moderator.id) ||
            // Skip tasks for post revisions that `moderator` has not seen.
            task.createdAtRevNr.exists(_ > post.currentRevisionNr))

      BUG // if first rejecting a new page, then, the *page* gets deleted,  [62AKDN46]
      //  but the orig post won't get updated. Then, if undeleting the page,  [undel_posts]
      // the Approve and Reject buttons reappear — since the orig post
      // was never updated; it's still waiting-for-approval.
      // But now, if clicking the text Approve Page, the below throwForbiddenIf()
      // will happen.
      // Solve this, by changing  approvedAt  to  approvedStatus: -1, 0, 1, [ApprovedStatus]
      // where -1 means Rejected, +1 means Approved, and 0  (or Null in Postgres)
      // means  waiting-for-approval.  Then, this field can be updated,
      // independently of the page's and post's deleted status.
      //
      throwForbiddenIf(tasksToDecide.isEmpty, "TyE06RKDHN24",
            // (BUG UX harmless: This message is wrong, if
            // task.createdAtRevNr < ... above.)
            "This post has already been moderated, mod task already decided")

      doModTaskNow(post, tasksToDecide, decision, decidedById = moderator.id
            )(tx, staleStuff)
    }

    modResult
  }



  /** Implicitly accepts posts as okay, by interacting with them, e.g. replying or
    * editing them. So mods won't need to both read and reply, and also
    * read again and mark as ok in the admin area.  [appr_by_interact]
    *
    * This happens only if the post has been (auto) approved already.
    * However, approving a post so it changes from hidden to visible, needs
    * to be done explicitly — see [[moderatePostInstantly()]] above. [in_pg_apr]
    *
    * @param decision should be type:  InteractReply.type | InteractEdit.type
    *                  but won't work until [Scala_3].
    */
  def maybeReviewAcceptPostByInteracting(post: Post, moderator: Participant,
          decision: ReviewDecision)(tx: SiteTx, staleStuff: StaleStuff): U = {

    // Tests:
    // modn-from-disc-page-review-after.2browsers.test.ts  TyTE2E603RKG4

    // Only staff and higher trust levels can do this.
    // The trust level will be configurable. For now, Core Member is a good default?
    if (!moderator.isStaffOrCoreMember)
      return

    // Cannot review one's own things. Unless one is staff (maybe recently got
    // became staff; then, one can accept one's own maybe-pending-review posts).
    if (post.createdById == moderator.id && !moderator.isStaff)
      return

    // Skip not-yet-approved posts. Approve-before is more explicit — an
    // in page button to click. [in_pg_apr]
    if (!post.isSomeVersionApproved)
      return

    // Skip access control — we're interacting with the post already,
    // checks done already. And we do Not return and show any modified post
    // from here. (025AKDL)
    // throwIfMayNotSeePost(task, requester)  <—— not needed

    import com.debiki.core.ReviewDecision.{FirsInteractAcceptId, LastInteractAcceptId}
    dieIf(decision.toInt < FirsInteractAcceptId || LastInteractAcceptId < decision.toInt,
          "TyE50RKT25M", s"Unsupported maybeAcceptPostByInteracting decision: $decision")

    val allTasks = tx.loadReviewTasksAboutPostIds(Seq(post.id))
    val tasksToAccept = allTasks.filterNot(task =>
          task.doneOrGone ||
          // If another mod (or this moderator henself) just did a mod task
          // decision via the moderation page, then, don't change that decision.
          // (Happens if this interaction happens within the mod task undo timeout.)
          // [skip_decided_mod_tasks]
          task.isDecided ||
          // If other people in the forum reacted to this post, don't accept it
          // implicitly here? Instead, leave the mod task for more explicit
          // consideration on the Moderation page.
          task.reasons.exists(_.isUnpopular) ||
          // Skip mod tasks about post revisions the staff member hasn't
          // seen (e.g. a just about now edited and flagged new revision).
          // Maybe this has no effect — seems the caller loads the most recent
          // version of `post` always. Oh well. Barely matters.
          task.createdAtRevNr.exists(_ > post.currentRevisionNr))

    doModTaskNow(post, tasksToAccept, decision, decidedById = moderator.id
          )(tx, staleStuff)

    // Don't return the now review-accepted post. (025AKDL)
  }



  private def doModTaskNow(post: Post, modTasks: Seq[ModTask],
          decision: ModDecision, decidedById: UserId)
          (tx: SiteTx, staleStuff: StaleStuff): ModResult = {

    modTasks foreach { t =>
      dieIf(t.doneOrGone, "TyE50WKDL45", s"Mod task done or gone: $t")
      // Cannot change decisions already made.
      // OR maybe allow that, if it's one's own earlier decision, not yet carried out?
      dieIf(t.decision isSomethingButNot decision, "TyE305RKDHB",
            s"Mod task decision != $decision, task: $t")
      // No tasks already decided but by the wrong moderators.
      dieIf(t.decidedById isSomethingButNot decidedById, "TyE602AKS4",
            s"Mod task decided by != $decidedById, task: $t")
      // No mod tasks about the wrong posts.
      dieIf(t.postId isNot post.id, "TyE7KT35T64",
            s"Mod task post id != post.id = ${post.id}, task: $t")
      // However, t.pageId or t.postNr being different from post.pageId and nr,
      // can be fine, e.g. if the post got moved to a different page.
    }

    if (post.deletedAt.isDefined) {
      // Fine, continue.
      // Currently review tasks don't get invalidated, when posts and pages
      // get deleted. (2KYF5A)  Then continue and update the mod task anyway.
      // Otherwise could be some forever un-doable mod tasks! [apr_deld_post]
    }

    // We're in a background thread and have forgotten the browser id data.
    // Could to load it from an earlier audit log entry, ... but maybe it's been deleted?
    // Edit: But now this also gets called from moderatePostInstantly()
    // and maybeReviewAcceptPostByInteracting().
    // Oh well, not important. For now:
    val browserIdData = BrowserIdData.Forgotten

    import ReviewDecision._

    val result: ModResult = decision match {
          case Accept if !post.isCurrentVersionApproved =>
            approveAndPublishPost(post, decidedById = decidedById,
                  tasksToAccept = modTasks)(tx, staleStuff)
          case Accept | InteractEdit | InteractReply |
                InteractAcceptAnswer | InteractWikify | InteractLike =>
            reviewAcceptPost(post, tasksToAccept = modTasks, decision,
                  decidedById = decidedById)(tx, staleStuff)
          case DeletePostOrPage =>
            rejectAndDeletePost(post, decidedById = decidedById, modTasks,
                  browserIdData)(tx, staleStuff)
        }

    completeModTasksMaybeSpamCheckTask(post, modTasks, decision, decidedById = decidedById
          )(tx, staleStuff)

    AUDIT_LOG // missing — here and most? other fns in this file.

    result
  }



  private def reviewAcceptPost(post: Post, tasksToAccept: Seq[ModTask],
          decision: ModDecision, decidedById: UserId)
          (tx: SiteTx, staleStuff: StaleStuff): ModResult = {

    dieIf(!decision.isFine, "TyE305RKDJW2")
    dieIf(tasksToAccept.exists(_.decision isSomethingButNot decision), "TyE5E03SHP4")

    if (post.isDeleted) {
      // Continue anyway: Unhide the post body (see below), if hidden  [apr_deld_post]
      // — good to do, if the post or page or whatever gets undeleted, later.
      // (Maybe someone else just deleted the post, or deleted via
      // another mod task.)
    }

    val updatedPost =
          // The System user has apparently approved the post already.
          // However, it might have been hidden a tiny bit later, after some
          // external services said it's spam. Now, though, we know it's
          // apparently not spam, so show it.
          if (post.isBodyHidden) {
            // SPAM RACE COULD unhide only if rev nr that got hidden <=
            // rev that was reviewed. [6GKC3U]

            UX; TESTS_MISSING; BUG // ? will this un-hide the whole page if needed?

            changePostStatusImpl(postNr = post.nr, pageId = post.pageId,
                  PostStatusAction.UnhidePost,
                  Who(TrueId.forMember(decidedById),
                        // When called from SystemDao.executePendingReviewTasks(),
                        // we don't have any info about the browser available.
                        // So it's missing [save_mod_br_inf]. But not missing when called
                        // from this.moderatePostInstantly(). Oh well.
                        browserIdData = BrowserIdData.Missing),
                  asAlias = None, // [anon_mods]
                  tx, staleStuff).updatedPost
          }
          else {
            None
          }

    ModResult(
          updatedPosts = updatedPost.toSeq,
          updatedAuthor = None)
  }


  private def isPageModTask(post: Post, modTasks: Seq[ModTask]): Bo = {
    BUG // need to know if the moderator's intention is to delete the whole page,
    // and which page — or just the post.
    // Need a new  ModDecision type. [apr_movd_orig_post]
    // Example:  A "bad" orig post resulted in a meaningful discussion —
    // staff only want to remove the orig post, not the whole topic.
    // Example: One mod moves an orig post to different topic, is now a reply.
    // But then another mod reject-deletes the previously orig post —
    // now, this shouldn't delete the page the post got moved to,
    // just because the mod tasks were initially about a new page.

    // Previously, only looked at modTasks but that's a bug, [revw_task_pgid]
    // ... = modTasks.exists(_.isForBothTitleAndBody)
    // Now look at post.isOrigPost .
    val taskIsForBothTitleAndBody = post.isOrigPost

    // Won't work if 1) System auto approves a post, and 2) later notices
    // it's spam (after having asked external services) and adds a mod task
    // about that, and staff deletes the post.
    // Then, if it's a new page, the mod task will have pageId = None
    // — the page won't get deleted, only the orig post (not the title, or replies).
    /*
    def isNewPostModTask = modTasks.headOption.exists(
          _.reasons.contains(ReviewReason.NewPost))
    unimplIf(isDevOrTest && post.isOrigPost && isNewPostModTask &&
          !taskIsForBothTitleAndBody, "Orig post moved before approved? [TyE406MRKTD2]")
          */

    taskIsForBothTitleAndBody
  }


  private def approveAndPublishPost(post: Post, decidedById: UserId,
        tasksToAccept: Seq[ModTask])
        (tx: SiteTx, staleStuff: StaleStuff): ModResult = {

    dieIf(tasksToAccept.isEmpty, "TyE306RKTD5")
    val taskIsForBothTitleAndBody = isPageModTask(post, tasksToAccept)

    if (post.isDeleted) {
      // Approve the post anyway  [apr_deld_post] — maybe gets undeleted
      // later, then good to remember it got approved.
    }

    val updatedTitle =
          if (taskIsForBothTitleAndBody) {
            // This is for a new page. Approve the *title* here, and the *body* just below.

            // Maybe skip this check? In case a post gets broken out to a new page,
            // or merged into an existing page, then, the post nr
            // might be that of a reply, rather than the BodyNr.
            dieIfAny(tasksToAccept, (t: ReviewTask) => t.postNr.isNot(PageParts.BodyNr),
                  "TyE306RKDH3" )

            approvePost(post.pageId, PageParts.TitleNr, approverId = decidedById,
                  doingModTasks = tasksToAccept, tx, staleStuff).updatedPost
          }
          else {
            // Then need not approve any title.
            None
          }

    val updatedBody =
          approvePost(post.pageId, post.nr, approverId = decidedById,
                doingModTasks = tasksToAccept, tx, staleStuff).updatedPost

    if (!post.isDeleted) {
      perhapsCascadeApproval(post)(tx, staleStuff)
    }

    ModResult(
          updatedPosts = updatedBody.toSeq ++ updatedTitle,
          updatedAuthor = None)
  }



  private def rejectAndDeletePost(post: Post, decidedById: UserId, modTasks: Seq[ModTask],
        browserIdData: BrowserIdData)
        (tx: SiteTx, staleStuff: StaleStuff): ModResult = {

    val taskIsForBothTitleAndBody = isPageModTask(post, modTasks)
    val reqr = Who(TrueId.forMember(decidedById), browserIdData)

    dieIf(modTasks.exists(_.postId isSomethingButNot post.id), "TyE50WKDL6")

    // Maybe got moved to an new page?
    val pageId = post.pageId

    val (updatedPosts, deletedPageId)  =
            if (post.isDeleted) {
              // Fine, just update the mod tasks. [apr_deld_post]
              // (There're races: mods reviewing and deleting, and others maybe
              // deleting the post or ancestor posts — fine.)
              (Nil, None)
            }
            // If staff deletes many posts by this user, mark it as a moderate threat?
            // That'll be done from inside update-because-deleted fn below. [DETCTHR]
            else if (taskIsForBothTitleAndBody) {
              deletePagesImpl(Seq(pageId), reqr, asAlias = None /*[anon_mods]*/)(tx, staleStuff)
              // Posts not individually deleted, instead, whole page gone // [62AKDN46]
              (Seq.empty, Some(pageId))
            }
            else {
              val updPost =
                    deletePostImpl(pageId = post.pageId, postNr = post.nr, deletedBy = reqr,
                          tx, staleStuff).updatedPost

              // It's annoying if [other review tasks for the same post] would
              // need to be handled too.
              // (If carrying out a mod task decision, then, modTasks is just that
              // one mod task — there might be other mod tasks too.)
              UX; COULD // do this also if deleting the whole page? (see above)
              invalidateModTasksForPosts(Seq(post), doingTasksNow = modTasks, tx)

              (updPost.toSeq, None)
            }

    ModResult(
          updatedPosts = updatedPosts,
          updatedAuthor = None,
          updatedPageId = deletedPageId,
          deletedPageId = deletedPageId)
  }



  private def completeModTasksMaybeSpamCheckTask(post: Post, tasks: Seq[ModTask],
        decision: ModDecision, decidedById: UserId)
        (tx: SiteTx, staleStuff: StaleStuff): Unit = {

    val tasksToUpdate = tasks.filter(!_.doneOrGone)

    tasksToUpdate foreach { task: ModTask =>
      if (bugWarnIf(task.decidedById isSomethingButNot decidedById, "TyE50KSD8")) return
      if (bugWarnIf(task.decision isSomethingButNot decision, "TyE50KSD2")) return
      if (bugWarnIf(task.postId isNot post.id, "TyE06FKSD2")) return

      val now = Some(tx.now.toJavaDate)

      val completedTask =
            if (task.isDecided) task.copy(completedAt = now)
            else task.copy(
                  decision = Some(decision),
                  decidedById = Some(decidedById),
                  decidedAtRevNr = Some(post.currentRevisionNr),
                  decidedAt = now,
                  completedAt = now)

      tx.upsertReviewTask(completedTask)

      if (decision.isFine) {
        updateSpamCheckTasks(humanSaysIsSpam = false, completedTask, tx)
      }
      else {
        // Need not:
        // updateSpamCheckTasks(humanSaysIsSpam = true, task, tx)
        // — that's done from the delete functions already. [UPDSPTSK]
        // Or would it be better to do that from here?
        // In case staff deleted the post for other reasons than it being spam?
      }
    }
  }



  private def updateSpamCheckTasks(humanSaysIsSpam: Boolean,
      reviewTask: ModTask, tx: SiteTx): Unit = {

    val decidedAtRevNr = reviewTask.decidedAtRevNr getOrDie "TyE60ZF2R"
    val postId = reviewTask.postId getOrElse {
      return
    }

    val spamCheckTasksAnyRevNr: Seq[SpamCheckTask] =
      tx.loadSpamCheckTasksWaitingForHumanLatestLast(postId)

    // Which spam check task shall we update? (WHICHTASK) There might be many,
    // for different revisions of the same post (because edits are spam checked, too).
    // Probably the most recent spam check task corresponds to the post revision
    // the reviewer reviewed?
    val latestTask = spamCheckTasksAnyRevNr.lastOption

    // Alternatively — but I'm not sure the rev nrs will match correctly:
    /* val spamCheckTasksSameRevNr =
      spamCheckTasksAnyRevNr.filter(
        _.postToSpamCheck.getOrDie("TyE20597W").postRevNr == decidedAtRevNr)  */

    // How do we know the spam was really inserted in this post revision? What if this is
    // a wiki post, and a previous editor inserted the spam? Ignore, for now. [WIKISPAM]

    latestTask foreach { spamCheckTask =>
      // The Janitor thread will soon take a look at this spam check task, and
      // report classification errors (spam detected, but human says isn't spam, or vice versa)
      // to spam check services. [SPMSCLRPT]
      tx.updateSpamCheckTaskForPostWithResults(
        spamCheckTask.copy(humanSaysIsSpam = Some(humanSaysIsSpam)))
    }
  }


  def updateSpamCheckTaskBecausePostDeleted(post: Post, postAuthor: Participant, deleter: Participant,
        tx: SiteTransaction): Unit = {
    // [DELSPAM] Would be good with a Delete button that asks the deleter if hen
    // deletes the post because hen considers it spam — or for some other reason.
    // So we know for sure if we should mark the post as spam here, and maybe
    // send a yes-this-is-spam training sample to the spam check services.
    //
    // For now: If this post was detected as spam, and it's being deleted by
    // *staff*, assume it's spam.
    //
    // (Tricky tricky: Looking at the post author won't work, for wiki posts, if
    // a user other than the author, edited the wiki post and inserted spam.
    // Then, should instead compare with the last editor (or all/recent editors).
    // But how do we know if the one who inserted any spam, is the last? last but
    // one? two? editor, or the original author? Ignore this, for now. [WIKISPAM])
    //
    // [DETCTHR] If the post got deleted because it's spam, should eventually
    // mark the user as a moderate threat and block hen? Or should the Delete
    // button ask the reviewer "Do you want to ban this user?" instead
    // of automatically? Maybe both: Automatically identify spammers, and
    // ask the deleter to approve the computer's ban suggestion?

    val maybeDeletingSpam = deleter.isStaff && !postAuthor.isStaff && deleter.id != postAuthor.id
    if (!maybeDeletingSpam)  //  || !anyDeleteReason is DeleteReasons.IsSpam) {
      return

    // Which spam check task(s) shall we update? If there're many, for different
    // revision of the same post? The last one? see: (WHICHTASK)
    val spamCheckTasksAnyRevNr = tx.loadSpamCheckTasksWaitingForHumanLatestLast(post.id)
    val latestTask = spamCheckTasksAnyRevNr.lastOption
    /* Alternatively:
    val spamCheckTaskSameRevNr =
      spamCheckTasksAnyRevNr.filter(
        post.approvedRevisionNr.getOrElse(post.currentRevisionNr) ==
          _.postToSpamCheck.getOrDie("TyE529KMW").postRevNr) */

    latestTask foreach { task =>
      tx.updateSpamCheckTaskForPostWithResults(
        task.copy(humanSaysIsSpam = Some(true)))
    }
  }


  CLEAN_UP; REMOVE // this is too complicated, slightly bug prone! — yes [revw_task_pgid]
  /** If we have approved all the required first post review tasks caused by userId, then
    * this method auto-approves all remaining first review tasks — because now we trust
    * the user that much.
    *
    */
  @deprecated("remove this, too complicated") // more nice to approve by interacting? [appr_by_interact]
  private def perhapsCascadeApproval(authorOfPost: Post)(
          tx: SiteTx, staleStuff: StaleStuff): U = {
    val userId: UserId = authorOfPost.createdById
    val settings = loadWholeSiteSettings(tx)
    val numFirstToAllow = math.min(MaxNumFirstPosts, settings.maxPostsPendApprBefore)
    val numFirstToApprove = math.min(MaxNumFirstPosts, settings.numFirstPostsToApprove)
    if (numFirstToAllow > 0 && numFirstToApprove > 0) {
      // Load some more review tasks than just MaxNumFirstPosts, in case the user has
      // somehow triggered even more review tasks, e.g. because getting flagged.
      // SECURITY (minor) if other users flag userId's posts 9999 times, we won't load any
      // approved posts here, and the approval won't be cascaded.
      val someMore = 15
      // COULD load tasks for posts, and tasks for approved posts, and tasks resolved as harmful,
      // in three separate queries? So won't risk 9999 of one type —> finds no other types.
      val tasks = tx.loadReviewTasksAboutUser(userId,
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

      // Don't auto approve users with too low trust level.
      // (Also sometimes causes an e2e test to fail.  TyT305RKDJ26)
      val user = tx.loadParticipant(userId) getOrElse {
        return // hard deleted? Weird
      }
      if (user.effectiveTrustLevel.isAtMost(settings.requireApprovalIfTrustLte))
        return

      val shallApproveRemainingFirstPosts = numApproved >= numFirstToApprove
      if (shallApproveRemainingFirstPosts) {
        val pendingTasks = tasks.filter(!_.doneOrGone)
        val titlesToApprove = mutable.HashSet[PageId]()
        val postIdsToApprove = pendingTasks flatMap { task =>
          if (task.postNr.contains(PageParts.BodyNr)) {
            // Was this, but that's a bug: [revw_task_pgid]
            // titlesToApprove += task.pageId getOrDie "EdE2WK0L6"
            // because sometimes page id missing, although is for a page's orig post,
            // Instead, for now:  (planning to delete all of perhapsCascadeApproval()
            // anyway)
            for {
              pId <- task.postId
              post <- tx.loadPost(pId)
            } {
              titlesToApprove += post.pageId
            }
          }
          task.postId
        }

        val postsToApprove = tx.loadPostsByUniqueId(postIdsToApprove).values
        val titlePostsToApprove = titlesToApprove.flatMap(tx.loadTitle)
        val tooManyPostsToApprove = postsToApprove ++ titlePostsToApprove

        // Some posts might have been approved already — e.g. chat messages; they're
        // auto approved by the System user. [7YKU24]
        val allPostsToApprove = tooManyPostsToApprove.filter(!_.isSomeVersionApproved)

        for ((pageId, posts) <- allPostsToApprove.groupBy(_.pageId)) {
          staleStuff.addPageId(pageId, memCacheOnly = true)
          autoApprovePendingEarlyPosts(pageId, posts)(tx, staleStuff)
        }
      }
    }
  }


  private def invalidateModTasksForPosts(posts: Iterable[Post], doingTasksNow: Seq[ModTask],
        tx: SiteTx): Unit = {
    invalidatedModTasksImpl(posts, shallBeInvalidated = true, doingTasksNow, tx)
  }


  private def reactivateModTasksForPosts(posts: Iterable[Post], doingTasksNow: Seq[ModTask],
         tx: SiteTx): Unit = {
    TESTS_MISSING // [UNDELPOST]
    untestedIf(posts.nonEmpty, "TyE2KIFW4", "Reactivating review tasks for undeleted posts") // [2VSP5Q8]
    invalidatedModTasksImpl(posts, shallBeInvalidated = false, doingTasksNow, tx)
  }


  /*  [deld_post_mod_tasks]
  After rethinking reviews, maybe better to never
  invalidate any reveiw tasks, when a page / post gets deleted, via *not* the review interface?
  So staff will see everything that gets flagged — even if someone deleted it first
  for whatever reason.

  def invalidateModTasksForPageId(pageId: PageId, doingModTask: Option[ModTask],
         tx: SiteTransaction) {
    val posts = tx.loadPostsOnPage(pageId)
    invalidatedModTasksImpl(posts, shallBeInvalidated = true, doingModTask, tx)
  }


  def reactivateModTasksForPageId(pageId: PageId, doingModTask: Option[ModTask],
         tx: SiteTransaction) {
    val posts = tx.loadPostsOnPage(pageId)
    invalidatedModTasksImpl(posts, shallBeInvalidated = false, doingModTask, tx)
  } */


  private def invalidatedModTasksImpl(posts: Iterable[Post], shallBeInvalidated: Boolean,
        doingTasksNow: Seq[ModTask], tx: SiteTx): Unit = {

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
        || doingTasksNow.exists(_.id == task.id)  // this task gets updated by some ancestor caller
        || (isReactivating && postDeleted))  // if post gone, don't reactivate this task
    }

    val tasksAfter = tasksToUpdate.map { task =>
      task.copy(invalidatedAt = if (shallBeInvalidated) Some(now) else None)
    }

    tasksAfter.foreach(tx.upsertReviewTask)
  }


  def loadReviewStuff(olderOrEqualTo: Option[ju.Date], limit: Int, forWho: Who)
        : (Seq[ReviewStuff], ReviewTaskCounts, Map[UserId, Participant], Map[PageId, PageMeta]) =
    readOnlyTransaction { tx =>
      val requester = tx.loadTheParticipant(forWho.id)
      loadStuffImpl(olderOrEqualTo, limit, requester, tx)
    }


  private def loadStuffImpl(olderOrEqualTo: Option[ju.Date], limit: Int,
        requester: Participant, tx: SiteTransaction)
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
        val maySeeResult = maySeePageUseCacheAndAuthzCtx(pageMeta, authzContext) // (5DE4A28)
        if (!maySeeResult.maySee) {
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
      userIds.add(flag.flaggerId.pubId)
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

