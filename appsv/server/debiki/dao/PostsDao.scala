/**
 * Copyright (c) 2014-2020 Kaj Magnus Lindberg
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
import com.debiki.core.EditedSettings.MaxNumFirstPosts
import com.debiki.core.Prelude._
import com.debiki.core.PageParts.FirstReplyNr
import controllers.EditController
import debiki._
import debiki.EdHttp._
import talkyard.server.pubsub.StorePatchMessage
import play.api.libs.json.{JsObject, JsValue}
import scala.collection.{immutable, mutable}
import scala.collection.mutable.ArrayBuffer
import talkyard.server.dao._
import PostsDao._
import talkyard.server.authz.Authz
import talkyard.server.spam.SpamChecker
import org.scalactic.{Bad, Good, One, Or}
import math.max


case class InsertPostResult(storePatchJson: JsObject, post: Post, reviewTask: Option[ReviewTask])

case class ChangePostStatusResult(
  updatedPost: Option[Post],
  answerGotDeleted: Boolean)

case class ApprovePostResult(
  updatedPost: Option[Post])

case class LoadPostsResult(
  posts: immutable.Seq[Post],
  pageStuffById: Map[PageId, PageStuff])



/** Loads and saves pages and page parts (e.g. posts and patches).
  *
  * (There's also a class PageDao (with no 's' in the name) that focuses on
  * one specific single page.)
  *
  * SHOULD make the full text search indexer work again
  */
trait PostsDao {
  self: SiteDao =>

  // 3 minutes
  val LastChatMessageRecentMs: UnixMillis = 3 * 60 * 1000


  def insertReply(textAndHtml: TextAndHtml, pageId: PageId, replyToPostNrs: Set[PostNr],
        postType: PostType, deleteDraftNr: Option[DraftNr],
        byWho: Who, spamRelReqStuff: SpamRelReqStuff)
        : InsertPostResult = {

    val authorId = byWho.id
    val now = globals.now()

    // Note: Fairly similar to createNewChatMessage() just below. [4UYKF21]

    if (textAndHtml.safeHtml.trim.isEmpty)
      throwBadReq("DwE6KEF2", "Empty reply")

    // Later: create 1 post of type multireply, with no text, per replied-to post,
    // and one post for the actual text and resulting location of this post.
    // Disabling for now, so I won't have to parse dw2_posts.multireply and convert
    // to many rows.
    if (replyToPostNrs.size > 1)
      throwNotImplemented("EsE7GKX2", o"""Please reply to one single person only.
        Multireplies temporarily disabled, sorry""")

    quickCheckIfSpamThenThrow(byWho, textAndHtml, spamRelReqStuff)

    val (newPost, author, notifications, anyReviewTask) = writeTx { (tx, staleStuff) =>
      deleteDraftNr.foreach(nr => tx.deleteDraft(byWho.id, nr))
      insertReplyImpl(textAndHtml, pageId, replyToPostNrs, postType,
            byWho, spamRelReqStuff, now, authorId, tx, staleStuff)
    }

    refreshPageInMemCache(pageId)

    val storePatchJson = jsonMaker.makeStorePatchForPost(newPost, author, showHidden = true)

    // (If reply not approved, this'll send mod task notfs to staff [306DRTL3])
    pubSub.publish(StorePatchMessage(siteId, pageId, storePatchJson, notifications),
          byId = author.id)

    InsertPostResult(storePatchJson, newPost, anyReviewTask)
  }


  def insertReplyImpl(textAndHtml: TextAndHtml, pageId: PageId, replyToPostNrs: Set[PostNr],
        postType: PostType, byWho: Who, spamRelReqStuff: SpamRelReqStuff,
        now: When, authorId: UserId, tx: SiteTx, staleStuff: StaleStuff,
        skipNotfsAndAuditLog: Boolean = false)
        : (Post, Participant, Notifications, Option[ReviewTask]) = {

    require(textAndHtml.safeHtml.trim.nonEmpty, "TyE25JP5L2")

    val authorAndLevels = loadUserAndLevels(byWho, tx)
    val page = newPageDao(pageId, tx)
    val replyToPosts = page.parts.getPostsAllOrError(replyToPostNrs) getOrIfBad  { missingPostNr =>
      throwNotFound(s"Post nr $missingPostNr not found", "EdE4JK2RJ")
    }

    val author = authorAndLevels.user
    val authorAndGroupIds = tx.loadGroupIdsMemberIdFirst(author)

    dieOrThrowNoUnless(Authz.mayPostReply(authorAndLevels, authorAndGroupIds,
      postType, page.meta, replyToPosts, tx.loadAnyPrivateGroupTalkMembers(page.meta),
      tx.loadCategoryPathRootLast(page.meta.categoryId, inclSelfFirst = true),
      tx.loadPermsOnPages()), "EdEMAY0RE")

    if (page.pageType.isChat)
      throwForbidden("EsE50WG4", s"Page '${page.id}' is a chat page; cannot post normal replies")

    val settings = loadWholeSiteSettings(tx)

    // Some dupl code [3GTKYA02]
    val uniqueId = tx.nextPostId()
    val postNr = page.parts.highestReplyNr.map(_ + 1).map(max(FirstReplyNr, _)) getOrElse FirstReplyNr
    val commonAncestorNr = page.parts.findCommonAncestorNr(replyToPostNrs.toSeq)
    val anyParent =
      if (commonAncestorNr == PageParts.NoNr) {
        // Flat chat comments might not reply to anyone in particular.
        // On embedded comments pages, there's no Original Post, so top level comments
        // have no parent post.
        if (postType != PostType.Flat && postType != PostType.BottomComment &&
            postType != PostType.CompletedForm && page.pageType != PageType.EmbeddedComments)
          throwBadReq("DwE2CGW7", "Post lacks parent id")
        else
          None
      }
      else {
        val anyParent = page.parts.postByNr(commonAncestorNr)
        if (anyParent.isEmpty) {
          throwBadReq("DwEe8HD36", o"""Cannot reply to common ancestor post '$commonAncestorNr';
              it does not exist""")
        }
        anyParent
      }

    if (anyParent.exists(_.deletedStatus.isDeleted))
      throwForbidden(
        "The parent post has been deleted; cannot reply to a deleted post", "DwE5KDE7")

    // Check for cycles?
    // Not needed. The new reply gets a new post nr and post id, and will have
    // no descendants. So it cannot create a cycle. (However, if *importing* posts,
    // then in a corrupt import file the posts on a page might form cycles. [ck_po_ckl])

    val (reviewReasons: Seq[ReviewReason], shallApprove) =
      throwOrFindNewPostReviewReasons(page.meta, authorAndLevels, tx)

    val approverId =
      if (author.isStaff) {
        dieIf(!shallApprove, "EsE5903")
        Some(author.id)
      }
      else if (shallApprove) Some(SystemUserId)
      else None

    val newPost = Post.create(
      uniqueId = uniqueId,
      pageId = pageId,
      postNr = postNr,
      parent = anyParent,
      multireplyPostNrs = (replyToPostNrs.size > 1) ? replyToPostNrs | Set.empty,
      postType = postType,
      createdAt = now.toJavaDate,
      createdById = authorId,
      source = textAndHtml.text,
      htmlSanitized = textAndHtml.safeHtml,
      approvedById = approverId)

    val shallBumpPage = shallApprove  // (7BMZW24)
    val numNewOpRepliesVisible = (shallApprove && newPost.isOrigPostReply) ? 1 | 0
    val newFrequentPosterIds: Seq[UserId] =
      if (shallApprove)
        PageParts.findFrequentPosters(page.parts.allPosts, // skip newPost, since we ignore ...
          ignoreIds = Set(page.meta.authorId, authorId))   // ... the author here anyway [3296KGP]
      else
        page.meta.frequentPosterIds

    val oldMeta = page.meta
    val newMeta = oldMeta.copy(
      bumpedAt = shallBumpPage ? Option(now.toJavaDate) | oldMeta.bumpedAt,
      lastApprovedReplyAt = shallApprove ? Option(now.toJavaDate) | oldMeta.lastApprovedReplyAt,
      lastApprovedReplyById = shallApprove ? Option(authorId) | oldMeta.lastApprovedReplyById,
      frequentPosterIds = newFrequentPosterIds,
      numRepliesVisible = page.parts.numRepliesVisible + (shallApprove ? 1 | 0),
      numRepliesTotal = page.parts.numRepliesTotal + 1,
      numPostsTotal = page.parts.numPostsTotal + 1,
      numOrigPostRepliesVisible = page.parts.numOrigPostRepliesVisible + numNewOpRepliesVisible,
      version = oldMeta.version + 1)

    // Since the post didn't exist before, it's enough to remember the refs
    // from the new textAndHtml only. [new_upl_refs]
    val uploadRefs = textAndHtml.uploadRefs
    if (Globals.isDevOrTest) {
      val uplRefs2 = findUploadRefsInPost(newPost)
      dieIf(uploadRefs != uplRefs2, "TyE503SKH5", s"uploadRefs: $uploadRefs, 2: $uplRefs2")
    }

    lazy val auditLogEntry = AuditLogEntry(
      siteId = siteId,
      id = AuditLogEntry.UnassignedId,
      didWhat = AuditLogEntryType.NewReply,
      doerId = authorId,
      doneAt = now.toJavaDate,
      browserIdData = byWho.browserIdData,
      pageId = Some(pageId),
      uniquePostId = Some(newPost.id),
      postNr = Some(newPost.nr),
      targetPageId = anyParent.map(_.pageId),
      targetUniquePostId = anyParent.map(_.id),
      targetPostNr = anyParent.map(_.nr),
      targetUserId = anyParent.map(_.createdById))

    val anyReviewTask = if (reviewReasons.isEmpty) None
    else Some(ReviewTask(
      id = tx.nextReviewTaskId(),
      reasons = reviewReasons.to[immutable.Seq].distinct,
      createdById = SystemUserId,
      createdAt = now.toJavaDate,
      createdAtRevNr = Some(newPost.currentRevisionNr),
      maybeBadUserId = authorId,
      postId = Some(newPost.id),
      postNr = Some(newPost.nr)))

    val anySpamCheckTask =
      if (!globals.spamChecker.spamChecksEnabled) None
      else if (!SpamChecker.shallCheckSpamFor(authorAndLevels)) None
      else Some(
        SpamCheckTask(
          createdAt = globals.now(),
          siteId = siteId,
          postToSpamCheck = Some(PostToSpamCheck(
            postId = newPost.id,
            postNr = newPost.nr,
            postRevNr = newPost.currentRevisionNr,
            pageId = newMeta.pageId,
            pageType = newMeta.pageType,
            pageAvailableAt = When.fromDate(newMeta.publishedAt getOrElse newMeta.createdAt),
            htmlToSpamCheck = textAndHtml.safeHtml,
            language = settings.languageCode)),
          who = byWho,
          requestStuff = spamRelReqStuff))

    val stats = UserStats(
      authorId,
      lastSeenAt = now,
      lastPostedAt = Some(now),
      firstDiscourseReplyAt = Some(now),
      numDiscourseRepliesPosted = 1,
      numDiscourseTopicsRepliedIn = 0) // SHOULD update properly

    addUserStats(stats)(tx)
    tx.insertPost(newPost)
    tx.indexPostsSoon(newPost)
    tx.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = shallApprove)
    if (shallApprove) {
      val pagePartsInclNewPost = PreLoadedPageParts(
        newMeta,
        page.parts.allPosts :+ newPost,
        origPostReplyBtnTitle = page.parts.origPostReplyBtnTitle,
        origPostVotes = page.parts.origPostVotes,
        // Should be the same — the page type didn't change (we're just adding a reply).
        anyPostOrderNesting = Some(page.parts.postsOrderNesting))
      updatePagePopularity(pagePartsInclNewPost, tx)

      staleStuff.addPageId(pageId)
      saveDeleteLinks(newPost, textAndHtml, authorId, tx, staleStuff)
    }
    uploadRefs foreach { uploadRef =>
      tx.insertUploadedFileReference(newPost.id, uploadRef, authorId)
    }
    if (!skipNotfsAndAuditLog) {
      insertAuditLogEntry(auditLogEntry, tx)
    }
    anyReviewTask.foreach(tx.upsertReviewTask)
    anySpamCheckTask.foreach(tx.insertSpamCheckTask)

    // If staff has now read and replied to the parent post — then resolve any
    // mod tasks about the parent post. So they won't need to review this post twice,
    // on the Moderation page too.
    // Test:  modn-from-disc-page-review-after  TyTE2E603RKG4
    replyToPosts foreach { replyToPost =>
      maybeReviewAcceptPostByInteracting(replyToPost, moderator = author,
            ReviewDecision.InteractReply)(tx, staleStuff)
    }

    val notifications =
      if (skipNotfsAndAuditLog) Notifications.None
      else notfGenerator(tx).generateForNewPost(
            page, newPost, Some(textAndHtml), anyNewModTask = anyReviewTask)
    tx.saveDeleteNotifications(notifications)

    // Could save the poster's topics-replied-to notf pref as  [interact_notf_pref]
    // notf pref for this topic — then, it'd be remembered, also if pat
    // changes the topics-replied-to notf pref later on.
    // But right now instead the notf pref is calculated in NotificationGenerator
    // instead, and if the poster changes hens notf prefs, that'll affect
    // all old topic where hen has replied, too.
    /*
    val ownPageNotfPrefs = tx.loadNotfPrefsForMemberAboutPage(pageId, authorAndGroupIds)
    val interactedNotfPrefs = tx.loadNotfPrefsAboutPagesInteractedWith(authorAndGroupIds)
    ... derive prefs, looking at own and groups ...
    val oldPostsByAuthor = page.parts.postByAuthorId(authorId)
    if (oldPostsByAuthor.isEmpty) {
      savePageNotfPrefIfAuZ(PageNotfPref(
            peopleId = authorId,
            NotfLevel.WatchingAll,
            pageId = Some(pageId)), byWho = Who.System)
    } */

    (newPost, author, notifications, anyReviewTask)
  }


  REFACTOR; MOVE // to ReviewsDao (and rename it to ModerationDao)
  /** Returns (review-reasons, shall-approve).
    */
  private def throwOrFindNewPostReviewReasons(pageMeta: PageMeta, author: UserAndLevels,
        tx: SiteTx): (Seq[ReviewReason], Boolean) = {
    throwOrFindNewPostReviewReasonsImpl(author, Some(pageMeta), newPageRole = None, tx)
  }


  REFACTOR; MOVE // to ReviewsDao (and rename it to ModerationDao) and make private
  def throwOrFindNewPostReviewReasonsImpl(author: UserAndLevels, pageMeta: Option[PageMeta],
        newPageRole: Option[PageType], tx: SiteTx)
        : (Seq[ReviewReason], Boolean) = {
    if (author.isStaff)
      return (Nil, true)

    // Don't review direct messages — then all staff would see them. Instead, only non-threat
    // users with level >= Basic may post private messages to non-staff people.
    if (pageMeta.map(_.pageType).contains(PageType.FormalMessage))
      return (Nil, true)

    val reviewReasons = mutable.ArrayBuffer[ReviewReason]()
    var autoApprove = true

    author.threatLevel match {
      case ThreatLevel.HopefullySafe =>
        // Fine
      case ThreatLevel.MildThreat =>
        reviewReasons.append(ReviewReason.IsByThreatUser)
      case ThreatLevel.ModerateThreat =>
        reviewReasons.append(ReviewReason.IsByThreatUser)
        autoApprove = false
      case ThreatLevel.SevereThreat =>
        // This can happen if the threat level was changed during the processing of the current
        // request (after the initial security checks).
        throwForbidden("EsE5Y80G2_", "Forbidden")
    }

    lazy val reviewTasksRecentFirst =
          tx.loadReviewTasksAboutUser(
              // We'll look at the 10 * max-admin-settings last posts — events
              // older than that, let's forget about here?
              author.id,
              limit = MaxNumFirstPosts,  // later: x 10
              OrderBy.MostRecentFirst)

    lazy val reviewTasksOldestFirst =
          tx.loadReviewTasksAboutUser(
              // This is abuot the first MaxNumFirstPosts only, don't load more than that.
              author.id, limit = MaxNumFirstPosts, OrderBy.OldestFirst)

    BUG // Need to excl okay posts the user deleted henself, and were OK! [cant_appr_deld]
    val numPending = reviewTasksRecentFirst.count(_.decision.isEmpty)

    // COULD add a users3 table status field instead, and update it on write, which says
    // if the user has too many pending comments / edits. Then could thow that status
    // client side, withouth having to run the below queries again and again.
    // Also, would be simpler to move all this logic to talkyard.server.auth.Authz.

    // Don't review, but auto-approve, user-to-user messages. Staff aren't supposed to read
    // those, unless the receiver reports the message.
    // Later: Create a review task anyway, for admins only, if the user is considered a mild threat?
    // And throw-forbidden if considered a moderate threat.
    if (newPageRole is PageType.FormalMessage) {
      // For now, just this basic check to prevent too-often-flagged people from posting priv msgs
      // to non-staff. COULD allow messages to staff, but currently we here don't have access
      // to the page members, so we don't know if they are staff.
      // Later: auto bump threat level to ModerateThreat [DETCTHR], then MessagesDao will do all this
      // automatically.
      val numLoaded = reviewTasksRecentFirst.length
      val numRejected = reviewTasksRecentFirst.count(_.decision.exists(_.isRejectionBadUser))
      if (numLoaded >= 2 && numRejected > (numLoaded / 2)) // for now
        throwForbidden("EsE7YKG2", "Too many rejected comments or edits or something")
      if (numPending > 5) // for now
        throwForbidden("EsE5JK20", "Too many pending review tasks")  // do always instead? all new members + threat
      return (Nil, true)
    }

    // ----- Too many recent bad posts?

    // If too many recent review tasks about maybe-spam are already pending,  [PENDNSPM]
    // or if too many posts got rejected,
    // don't let this not-totally-trusted user post anything more, for now.
    if (author.trustLevel.toInt < TrustLevel.TrustedMember.toInt &&
        author.threatLevel.toInt > ThreatLevel.SuperSafe.toInt) {

      val numMaybeSpam = reviewTasksRecentFirst.count(t =>
        t.reasons.contains(ReviewReason.PostIsSpam) && t.decision.isEmpty)

      val numWasNotSpam = reviewTasksRecentFirst.count(t =>
        t.reasons.contains(ReviewReason.PostIsSpam) && t.decision.exists(_.isFine))

      val numBad = reviewTasksRecentFirst.count(t =>
        t.decision.exists(_.isRejectionBadUser))

      val maxMaybeSpam = (author.trustLevel.toInt < TrustLevel.FullMember.toInt) ?
        AllSettings.MaxPendingMaybeSpamPostsNewMember | AllSettings.MaxPendingMaybeSpamPostsFullMember

      BUG // How is staff supposed to let the person post again? If all hens posts
      // have been reviewed — then there're no more posts to approve. Or some posts
      // got rejected, then lots of mod tasks got invalidated [2MFFKR0] [apr_deld_post].
      // Instead, [auto_block] the user from posting more? [auto_block]?
      // And staff can unblock the user, if spoken with hen and now seems ok.

      if (numMaybeSpam + numBad >= maxMaybeSpam && numBad >= numWasNotSpam)
        throwForbidden("TyENEWMBRSPM_", o"""You cannot post more posts until a moderator
          has reviewed your previous posts.""" + "\n\n" + o"""Our spam detection system thinks
          some of your posts look like spam, sorry.""")
    }

    // ----- First posts

    val settings = loadWholeSiteSettings(tx)
    val maxPostsPendApprBefSetting = math.min(MaxNumFirstPosts, settings.maxPostsPendApprBefore)
    val numFirstToApprove = math.min(MaxNumFirstPosts, settings.numFirstPostsToApprove)
    var numFirstToRevwAftr = math.min(MaxNumFirstPosts, settings.numFirstPostsToReview)
    val maxPostsPendRevwAftr = math.min(MaxNumFirstPosts, settings.maxPostsPendRevwAftr)

    val maxPostsPendApprBefore =
          if (maxPostsPendApprBefSetting > 0) maxPostsPendApprBefSetting
          else MaxNumFirstPosts  // better have *some* limit?

    // Always have staff review a new guest's first two comments,
    // regardless of site settings. [4JKFWP4]
    if (author.user.isGuest && (numFirstToApprove + numFirstToRevwAftr) < 2) {
      numFirstToRevwAftr = 2 - numFirstToApprove
    }

    // ( What if there're already approved posts by this user, but without any
    // mod tasks?  [aprd_posts_wo_mod_tasks]
    // E.g. because posts by this user were inserted via the API, or because
    // moderator settings were recently changed.
    // Would mods then want to start moderating this user, although hen
    // has been a member for a while & posted topics and replies already?
    // Maybe sometimes yes, sometimes no.
    // Currently they will start moderating hen. )

    if (numFirstToApprove > 0 || numFirstToRevwAftr > 0) {
      val numFirstPending = reviewTasksOldestFirst.count(_.decision.isEmpty)
      val numApproved = reviewTasksOldestFirst.count(_.decision.exists(_.isFine))
      val numLoaded = reviewTasksOldestFirst.length

      if (numApproved < numFirstToApprove) {
        // This user is still under evaluation (is s/he a spammer or not?).
        autoApprove = false

        val tooManyPendAppr = numFirstPending >= maxPostsPendApprBefore  // TyT305RKDJ5
        val tooManyPostedTotal = numLoaded >= MaxNumFirstPosts  ; TESTS_MISSING

        if (tooManyPendAppr || tooManyPostedTotal) {
          BUG // [cant_appr_deld]  can happen if user deletes hens first posts,
          // so cannot approve them.
          val errCode = if (tooManyPendAppr) "_EsE6YKF2_" else "TyE025RSKT_"
          throwForbidden(errCode, o"""You cannot post more posts until a moderator has
              approved your first posts""")
        }
      }

      // What if  < numFirstToRevwAftr,   [05KHAD6KF52]
      // then, enqueue for review,
      SHOULD // and if  > max pending to revw,  throwForbidden.

      if (numLoaded < math.min(MaxNumFirstPosts, numFirstToApprove + numFirstToRevwAftr)) {
        reviewReasons.append(ReviewReason.IsByNewUser)
      }
      else if (!autoApprove) {
        reviewReasons.append(ReviewReason.IsByNewUser)
      }
    }

    // ----- Trust level

    val alwaysReqAppr = author.trustLevel.isAtMost(settings.requireApprovalIfTrustLte)
    val alwaysReviewAfter = author.trustLevel.isAtMost(settings.reviewAfterIfTrustLte)

    if (alwaysReqAppr) {
      // Tests: TyT305RKTH205
      autoApprove = false
      reviewReasons.append(ReviewReason.IsByLowTrustLevel)
      if (numPending + 1 > maxPostsPendApprBefore)
        throwForbidden("TyE2MNYPNDAPR_", o"""You cannot post more posts until
              your previous posts have been approved by staff""")
    }

    if (alwaysReviewAfter) {
      TESTS_MISSING
      reviewReasons.append(ReviewReason.IsByLowTrustLevel)
      if (maxPostsPendRevwAftr > 0 && numPending + 1 > maxPostsPendRevwAftr)
        throwForbidden("TyE2MNYPNDRVW_", o"""You cannot post more posts until
              your previous posts have been reviewed by staff""")
    }


    // Disable this — also closed pages now get bumped, here: (7BMZW24), if there's a new post.
    // Maybe add back later, if in some cases, a closed page shouldn't get bumped.
    /*if (pageMeta.exists(_.isClosed)) {
      // The topic won't be bumped, so no one might see this post, so staff should review it.
      // Could skip this if the user is trusted.
      reviewReasons.append(ReviewReason.NoBumpPost)
    }*/

    // This whole fn is about new pages or posts.
    if (reviewReasons.nonEmpty) {
      reviewReasons.append(ReviewReason.NewPost)
    }

    dieIf(!autoApprove && reviewReasons.isEmpty, "TyE0REVWRSNS")  // [703RK2]
    (reviewReasons, autoApprove)
  }


  /** If the chat message author just posted another chat message, just above, no other
    * messages in between — then we'll append this new message to the old one, instead
    * of creating a new different chat message.
    */
  def insertChatMessage(textAndHtml: TextAndHtml, pageId: PageId, deleteDraftNr: Option[DraftNr],
        byWho: Who, spamRelReqStuff: SpamRelReqStuff): InsertPostResult = {
    val authorId = byWho.id

    if (textAndHtml.safeHtml.trim.isEmpty)
      throwBadReq("DwE2U3K8", "Empty chat message")

    quickCheckIfSpamThenThrow(byWho, textAndHtml, spamRelReqStuff)

    val (post, author, notifications) = writeTx { (tx, staleStuff) =>
      val authorAndLevels = loadUserAndLevels(byWho, tx)
      val author = authorAndLevels.user

      SHOULD_OPTIMIZE // don't load all posts [2GKF0S6], because this is a chat, could be too many.
      val page = newPageDao(pageId, tx)
      val replyToPosts = Nil // currently cannot reply to specific posts, in the chat. [7YKDW3]

      dieOrThrowNoUnless(Authz.mayPostReply(authorAndLevels, tx.loadGroupIdsMemberIdFirst(author),
        PostType.ChatMessage, page.meta, Nil, tx.loadAnyPrivateGroupTalkMembers(page.meta),
        tx.loadCategoryPathRootLast(page.meta.categoryId, inclSelfFirst = true),
        tx.loadPermsOnPages()), "EdEMAY0CHAT")

      val (reviewReasons: Seq[ReviewReason], _) =
        throwOrFindNewPostReviewReasons(page.meta, authorAndLevels, tx)

      if (!page.pageType.isChat)
        throwForbidden("EsE5F0WJ2", s"Page $pageId is not a chat page; cannot insert chat message")

      if (page.pageType == PageType.JoinlessChat) {
        // Noop. No need to have joined the chat channel, to start chatting.
      }
      else {
        val pageMemberIds = tx.loadMessageMembers(pageId)
        if (!pageMemberIds.contains(authorId))
          throwForbidden("EsE4UGY7", "You are not a member of this chat channel")
      }

      // Try to append to the last message, instead of creating a new one. That looks
      // better in the browser (fewer avatars & sent-by info), + we'll save disk and
      // render a little bit faster.  TyT306WKCDE4
      val anyLastMessage = page.parts.lastPostButNotOrigPost
      val anyLastMessageSameUserRecently = anyLastMessage filter { post =>
        post.createdById == authorId &&
          tx.now.millis - post.createdAt.getTime < LastChatMessageRecentMs
      }

      val (post, notfs) = anyLastMessageSameUserRecently match {
        case Some(lastMessage)
            if !lastMessage.isDeleted &&
              lastMessage.tyype == PostType.ChatMessage &&
              // If mentioning new people — then create a new Post, so they won't
              // get notified about the text in the previous chat message (that text
              // was likely not intended directly for them).  TyT306WKCDE4 [NEXTCHATMSG]
              textAndHtml.usernameMentions.isEmpty =>
          // No mod task generated. [03RMDl6J]
          // For now, let's create mod tasks only for *new* messages
          // (but not appended-to messages).
          // Should work well enough + won't be too many mod tasks.
          appendToLastChatMessage(
                lastMessage, textAndHtml, byWho, spamRelReqStuff, tx, staleStuff)
        case _ =>
          // A mod task will (might) get generated.
          createNewChatMessage(
                page, textAndHtml, byWho, reviewReasons, spamRelReqStuff)(tx, staleStuff)
      }

      deleteDraftNr.foreach(nr => tx.deleteDraft(byWho.id, nr))
      (post, author, notfs)
    }

    refreshPageInMemCache(pageId)

    val storePatchJson = jsonMaker.makeStorePatchForPost(post, author, showHidden = true)
    pubSub.publish(StorePatchMessage(siteId, pageId, storePatchJson, notifications),
      byId = author.id)

    InsertPostResult(storePatchJson, post, reviewTask = None)
  }


  private def createNewChatMessage(page: PageDao, textAndHtml: TextAndHtml, who: Who,
        reviewReasons: Seq[ReviewReason], spamRelReqStuff: SpamRelReqStuff)
        (tx: SiteTx, staleStuff: StaleStuff)
        : (Post, Notifications) = {

    require(textAndHtml.safeHtml.trim.nonEmpty, "TyE592MWP2")

    // Note: Farily similar to insertReply() a bit above. [4UYKF21]
    val authorId = who.id
    val authorAndLevels = loadUserAndLevels(who, tx)

    val settings = loadWholeSiteSettings(tx)

    val uniqueId = tx.nextPostId()
    val postNr = page.parts.highestReplyNr.map(_ + 1) getOrElse PageParts.FirstReplyNr
    if (!page.pageType.isChat)
      throwForbidden("EsE6JU04", s"Page '${page.id}' is not a chat page")

    // This is better than some database foreign key error.
    tx.loadParticipant(authorId) getOrElse throwNotFound("EsE2YG8", "Bad user")

    val newPost = Post.create(
      uniqueId = uniqueId,
      pageId = page.id,
      postNr = postNr,
      parent = None,  // [CHATPRNT]
      multireplyPostNrs = Set.empty,
      postType = PostType.ChatMessage,
      createdAt = tx.now.toJavaDate,
      createdById = authorId,
      source = textAndHtml.text,
      htmlSanitized = textAndHtml.safeHtml,
      // Chat messages are currently auto approved. [7YKU24]
      approvedById = Some(SystemUserId))

    // COULD find the most recent posters in the last 100 messages only, because is chat.
    val newFrequentPosterIds: Seq[UserId] =
      PageParts.findFrequentPosters(page.parts.allPosts,  // skip newPost since we ignore ...
        ignoreIds = Set(page.meta.authorId, authorId))    // ...the author here anyway [3296KGP]

    val oldMeta = page.meta
    val newMeta = oldMeta.copy(
      bumpedAt = Some(tx.now.toJavaDate),
      // Chat messages are always visible, so increment all num-replies counters.
      numRepliesVisible = oldMeta.numRepliesVisible + 1,
      numRepliesTotal = oldMeta.numRepliesTotal + 1,
      numPostsTotal = oldMeta.numPostsTotal + 1,
      //numOrigPostRepliesVisible <— leave as is — chat messages aren't orig post replies.
      lastApprovedReplyAt = Some(tx.now.toJavaDate),
      lastApprovedReplyById = Some(authorId),
      frequentPosterIds = newFrequentPosterIds,
      version = oldMeta.version + 1)

    // New post, all refs in textAndHtml regardless of if approved or not. [new_upl_refs]
    val uploadRefs: Set[UploadRef] = textAndHtml.uploadRefs
    if (Globals.isDevOrTest) {
      val uplRefs2: Set[UploadRef] = findUploadRefsInPost(newPost)
      dieIf(uploadRefs != uplRefs2, "TyE38RDHD4", s"uploadRefs: $uploadRefs, 2: $uplRefs2")
    }

    val anySpamCheckTask =
      if (!globals.spamChecker.spamChecksEnabled) None
      else if (!SpamChecker.shallCheckSpamFor(authorAndLevels)) None
      else Some(
        SpamCheckTask(
          createdAt = globals.now(),
          siteId = siteId,
          postToSpamCheck = Some(PostToSpamCheck(
            postId = newPost.id,
            postNr = newPost.nr,
            postRevNr = newPost.currentRevisionNr,
            pageId = newMeta.pageId,
            pageType = newMeta.pageType,
            pageAvailableAt = When.fromDate(newMeta.publishedAt getOrElse newMeta.createdAt),
            htmlToSpamCheck = textAndHtml.safeHtml,
            language = settings.languageCode)),
          who = who,
          requestStuff = spamRelReqStuff))

    val anyModTask =
          if (reviewReasons.isEmpty) None
          else Some(ReviewTask(
                id = tx.nextReviewTaskId(),
                reasons = reviewReasons.to[immutable.Seq],
                createdById = SystemUserId,
                createdAt = tx.now.toJavaDate,
                createdAtRevNr = Some(newPost.currentRevisionNr),
                maybeBadUserId = authorId,
                postId = Some(newPost.id),
                postNr = Some(newPost.nr)))

    val auditLogEntry = AuditLogEntry(
      siteId = siteId,
      id = AuditLogEntry.UnassignedId,
      didWhat = AuditLogEntryType.NewChatMessage,
      doerId = authorId,
      doneAt = tx.now.toJavaDate,
      browserIdData = who.browserIdData,
      pageId = Some(page.id),
      uniquePostId = Some(newPost.id),
      postNr = Some(newPost.nr),
      targetUniquePostId = None,
      targetPostNr = None,
      targetUserId = None)

    val userStats = UserStats(
      authorId,
      lastSeenAt = tx.now,
      lastPostedAt = Some(tx.now),
      firstChatMessageAt = Some(tx.now),
      numChatMessagesPosted = 1)

    addUserStats(userStats)(tx)
    tx.insertPost(newPost)
    tx.indexPostsSoon(newPost)
    tx.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)
    updatePagePopularity(page.parts, tx)
    uploadRefs foreach { uploadRef =>
      tx.insertUploadedFileReference(newPost.id, uploadRef, authorId)
    }

    staleStuff.addPageId(page.id)
    saveDeleteLinks(newPost, textAndHtml, authorId, tx, staleStuff)

    anySpamCheckTask.foreach(tx.insertSpamCheckTask)
    anyModTask.foreach(tx.upsertReviewTask)
    insertAuditLogEntry(auditLogEntry, tx)

    // generate json? load all page members?
    // send the post + json back to the caller?
    // & publish [pubsub]

    // If anyModTask: TyTIT50267MT
    val notfs = notfGenerator(tx).generateForNewPost(
          page, newPost, sourceAndHtml = Some(textAndHtml), anyNewModTask = anyModTask)
    tx.saveDeleteNotifications(notfs)

    (newPost, notfs)
  }


  /** If the same user types two chat messages quickly and in a row, the 2nd message gets
    * appended to the post for the 1st message, and no 2nd post is created. This saves
    * some db storage space & performance when rendering the chat, and
    * is more nice, from a ux perspective? with one message instead of many small?
    */
  private def appendToLastChatMessage(lastPost: Post, textAndHtml: TextAndHtml, byWho: Who,
        spamRelReqStuff: SpamRelReqStuff, tx: SiteTransaction, staleStuff: StaleStuff)
        : (Post, Notifications) = {

    // Note: Farily similar to editPostIfAuth() just below. [2GLK572]
    val authorId = byWho.id
    val authorAndLevels = loadUserAndLevels(byWho, tx)

    require(textAndHtml.safeHtml.trim.nonEmpty, "TyE8FPZE2P")
    require(lastPost.tyype == PostType.ChatMessage, o"""Post id ${lastPost.id}
          is not a chat message, it is: ${lastPost.tyype} [TyE6YUW28]""")

    require(lastPost.currentRevisionById == authorId, "EsE5JKU0")
    require(lastPost.currentRevSourcePatch.isEmpty, "EsE7YGKU2")
    require(lastPost.currentRevisionNr == FirstRevisionNr, "EsE2FWY2")
    require(lastPost.isCurrentVersionApproved, "EsE4GK7Y2")
    // The system user auto approves all chat messages and edits of chat messages. [7YKU24]
    require(lastPost.approvedById.contains(SystemUserId), "EsE4GBF3")
    require(lastPost.approvedRevisionNr.contains(FirstRevisionNr), "EsE4PKW1")
    require(lastPost.deletedAt.isEmpty, "EsE2GKY8")

    val settings = loadWholeSiteSettings(tx)
    val theApprovedSource = lastPost.approvedSource.getOrDie("EsE5GYKF2")
    val theApprovedHtmlSanitized = lastPost.approvedHtmlSanitized.getOrDie("EsE2PU8")
    val newCombinedText = textEndingWithNumNewlines(theApprovedSource, 2) + textAndHtml.text

    val pageMeta = tx.loadThePageMeta(lastPost.pageId)

    val postRenderSettings = makePostRenderSettings(pageMeta.pageType)
    val combinedTextAndHtml = textAndHtmlMaker.forBodyOrComment(  // [nashorn_in_tx]
      newCombinedText,
      embeddedOriginOrEmpty = postRenderSettings.embeddedOriginOrEmpty,
      followLinks = false)

    val editedPost = lastPost.copy(
      approvedSource = Some(combinedTextAndHtml.text),
      approvedHtmlSanitized = Some(combinedTextAndHtml.safeHtml),
      approvedAt = Some(tx.now.toJavaDate),
      // COULD: bump revision, so appended text gets spam checked [SPMCHKED] — however
      // that'd currently mess up the assumptions that one only appends to rev nr = 1.
      // *Solution?* Add a spam check task id, so the prim key becomes (site-id, id)?
      // Then, here, a new task can be created. And it'll also be possible to have
      // spam check tasks for checking new user profiles (user profile spam)  [PROFLSPM]
      //currentRevisionNr = lastPost.currentRevisionNr + 1,
      // Leave approvedById = SystemUserId and approvedRevisionNr = FirstRevisionNr unchanged.
      currentRevLastEditedAt = Some(tx.now.toJavaDate),
      lastApprovedEditAt = Some(tx.now.toJavaDate),
      lastApprovedEditById = Some(authorId))

    // For now, don't generate any ModTask here.  [03RMDl6J]
    // (But we do, when starting a new chat message.)

    val anySpamCheckTask =
      if (!globals.spamChecker.spamChecksEnabled) None
      else if (!SpamChecker.shallCheckSpamFor(authorAndLevels)) None
      else Some(
        SpamCheckTask(
          createdAt = globals.now(),
          siteId = siteId,
          postToSpamCheck = Some(PostToSpamCheck(
            postId = editedPost.id,
            postNr = editedPost.nr,
            postRevNr = editedPost.currentRevisionNr,
            pageId = pageMeta.pageId,
            pageType = pageMeta.pageType,
            pageAvailableAt = When.fromDate(pageMeta.publishedAt getOrElse pageMeta.createdAt),
            htmlToSpamCheck = combinedTextAndHtml.safeHtml,
            language = settings.languageCode)),
          who = byWho,
          requestStuff = spamRelReqStuff))

    tx.updatePost(editedPost)
    tx.indexPostsSoon(editedPost)
    anySpamCheckTask.foreach(tx.insertSpamCheckTask)
    saveDeleteUploadRefs(lastPost, editedPost = editedPost, textAndHtml,
          isAppending = true, isEditing = false, authorId, tx)

    staleStuff.addPageId(editedPost.pageId)
    saveDeleteLinks(editedPost, combinedTextAndHtml, authorId, tx, staleStuff)

    val oldMeta = tx.loadThePageMeta(lastPost.pageId)
    val newMeta = oldMeta.copy(version = oldMeta.version + 1)
    tx.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = true)

    // COULD create audit log entry that shows that this ip appended to the chat message.

    val notfs = notfGenerator(tx).generateForEdits(lastPost, editedPost, Some(combinedTextAndHtml))
    tx.saveDeleteNotifications(notfs)

    (editedPost, notfs)
  }


  def textEndingWithNumNewlines(text: String, num: Int): String = {
    val numAlready = text.takeRightWhile(_ == '\n').length
    text + "\n" * math.max(0, num - numAlready)
  }


  /** Edits the post, if authorized to edit it.
    */
  def editPostIfAuth(pageId: PageId, postNr: PostNr, deleteDraftNr: Option[DraftNr],
        who: Who, spamRelReqStuff: SpamRelReqStuff, newTextAndHtml: SourceAndHtml): Unit = {
    val editorId = who.id

    // Note: Farily similar to appendChatMessageToLastMessage() just above. [2GLK572]

    if (newTextAndHtml.safeHtml.trim.isEmpty)
      throwBadReq("DwE4KEL7", EditController.EmptyPostErrorMessage)

    newTextAndHtml match {
      case _: TitleSourceAndHtml => ()
      case postSourceAndHtml: TextAndHtml =>
        quickCheckIfSpamThenThrow(who, postSourceAndHtml, spamRelReqStuff)
    }

    val anyEditedCategory = writeTx { (tx, staleStuff) =>
      val editorAndLevels = loadUserAndLevels(who, tx)
      val editor = editorAndLevels.user
      val page = newPageDao(pageId, tx)
      val settings = loadWholeSiteSettings(tx)

      val postToEdit = page.parts.postByNr(postNr) getOrElse {
        page.meta // this throws page-not-fount if the page doesn't exist
        throwNotFound("DwE404GKF2", s"Post not found, id: '$postNr'")
      }

      if (postToEdit.currentSource == newTextAndHtml.text)
        return

      dieOrThrowNoUnless(Authz.mayEditPost(
        editorAndLevels, tx.loadGroupIdsMemberIdFirst(editor),
        postToEdit, page.meta, tx.loadAnyPrivateGroupTalkMembers(page.meta),
        inCategoriesRootLast = tx.loadCategoryPathRootLast(page.meta.categoryId, inclSelfFirst = true),
        tooManyPermissions = tx.loadPermsOnPages()), "EdE6JLKW2R")

      // COULD don't allow sbd else to edit until 3 mins after last edit by sbd else?
      // so won't create too many revs quickly because 2 edits.
      BUG // COULD compare version number: kills the lost update bug.

      UX; COULD // if edits title, add a meta message: "Alice changed the title from ... to ..."
      // GitHub does that, and it's quite nice & helpful I think, to see that the topic got renamed.

      // If we've saved an old revision already, and 1) there hasn't been any more discussion
      // in this sub thread since the current revision was started, and 2) the current revision
      // hasn't been flagged, — then don't save a new revision. It's rather uninteresting
      // to track changes, when no discussion is happening.
      // (We avoid saving unneeded revisions, to save disk.)
      val anyLastRevision = loadLastRevisionWithSource(postToEdit.id, tx)
      def oldRevisionSavedAndNothingHappened = anyLastRevision match {
        case None => false
        case Some(_) =>
          // COULD: instead of comparing timestamps, flags and replies could explicitly clarify
          // which revision of postToEdit they concern.
          val currentRevStartMs = postToEdit.currentRevStaredAt.getTime
          val flags = tx.loadFlagsFor(immutable.Seq(PagePostNr(pageId, postNr)))
          val anyNewFlag = flags.exists(_.flaggedAt.millis > currentRevStartMs)
          val successors = page.parts.descendantsOf(postNr)
          val anyNewComment = successors.exists(_.createdAt.getTime > currentRevStartMs)
        !anyNewComment && !anyNewFlag
      }

      val anyNewApprovedById =
        if (postToEdit.tyype == PostType.ChatMessage) {
          // Auto approve chat messages. Always SystemUserId for chat.
          Some(SystemUserId)  // [7YKU24]
        }
        else if (editor.isStaff) {
          if (!postToEdit.isSomeVersionApproved) {
            // Staff won't approve a not yet approved post, just by editing it.
            // Instead, they need to click a button to explicitly approve it  [in_pg_apr]
            // the first time (for that post),  or do via the Moderation page.
            // (This partly because it'd be *complicated* to both approve and publish
            // the post, *and* handle edits, at the same time.)
            // Test:  modn-from-disc-page-approve-before  TyTE2E603RTJ.TyTE2E407RKS
            None
          }
          else {
            // Older revision already approved and post already published.
            // Then, continue approving it.
            Some(editor.id)
          }
        }
        else {
          // Let people continue editing a post that has been approved already — unless
          // they're a moderate threat. A bit further below (7ALGJ2), we'll create
          // a review task (also for mild threat edits).
          if (editorAndLevels.threatLevel.toInt >= ThreatLevel.ModerateThreat.toInt) {
            None  // [TyT7UQKBA2]
          }
          else if (postToEdit.isCurrentVersionApproved) {
            // Auto approve — let people edit their already approved posts.
            Some(SystemUserId)
          }
          else {
            // Don't auto-approve these edits.
            None
          }
        }

      val (
          editsApproved: Boolean,
          newCurrentSourcePatch: Option[String],
          newLastApprovedEditAt,
          newLastApprovedEditById,
          newApprovedSource,
          newApprovedHtmlSanitized,
          newApprovedAt,
      ) =
        if (anyNewApprovedById.isDefined)
          (true,
          None,
          Some(tx.now.toJavaDate),
          Some(editorId),
          Some(newTextAndHtml.text),
          Some(newTextAndHtml.safeHtml),
          Some(tx.now.toJavaDate))
        else
          (false,
          // How to get from the last approved revision, to the new rev. with unapproved edits.
          Some(makePatch(from = postToEdit.approvedSource.getOrElse(""), to = newTextAndHtml.text)),
          // Keep the old values, for *approved-whatever* fields.
          postToEdit.lastApprovedEditAt,
          postToEdit.lastApprovedEditById,
          postToEdit.approvedSource,
          postToEdit.approvedHtmlSanitized,
          postToEdit.approvedAt)


      val isInNinjaEditWindow = {
        val ninjaWindowMs = ninjaEditWindowMsFor(page.pageType)
        val ninjaEditEndMs = postToEdit.currentRevStaredAt.getTime + ninjaWindowMs
        tx.now.millis < ninjaEditEndMs
      }

      val isNinjaEdit = {
        val sameAuthor = postToEdit.currentRevisionById == editorId
        val ninjaHardEndMs = postToEdit.currentRevStaredAt.getTime + HardMaxNinjaEditWindowMs
        val isInHardWindow = tx.now.millis < ninjaHardEndMs
        // If the current version has been approved, and one does an unapproved edit — then, shouldn't
        // ninja-save those unapproved edits in the previous already-approved revision.
        val editsApprovedOrPostNotApproved = editsApproved || !postToEdit.isCurrentVersionApproved
        (sameAuthor && isInHardWindow && (isInNinjaEditWindow || oldRevisionSavedAndNothingHappened)
          && editsApprovedOrPostNotApproved)
      }

      SECURITY; SHOULD // *not* be allowed to ninja-edit a posts that's been reviewed.
      // Solution: Don't make it appear in the review tasks list, until ninja edit window has ended.
      val (newRevision: Option[PostRevision], newStartedAt, newRevisionNr, newPrevRevNr) =
        if (isNinjaEdit) {
          (None, postToEdit.currentRevStaredAt, postToEdit.currentRevisionNr,
            postToEdit.previousRevisionNr)
        }
        else {
          val revision = PostRevision.createFor(postToEdit, previousRevision = anyLastRevision)
          (Some(revision), tx.now.toJavaDate, postToEdit.currentRevisionNr + 1,
            Some(postToEdit.currentRevisionNr))
        }

      val newApprovedRevNr = editsApproved ? Option(newRevisionNr) | postToEdit.approvedRevisionNr

      // COULD send current version from browser to server, reject edits if != oldPost.currentVersion
      // to stop the lost update problem.

      var editedPost = postToEdit.copy(
        currentRevStaredAt = newStartedAt,
        currentRevLastEditedAt = Some(tx.now.toJavaDate),
        currentRevisionById = editorId,
        currentRevSourcePatch = newCurrentSourcePatch,
        currentRevisionNr = newRevisionNr,
        previousRevisionNr = newPrevRevNr,
        lastApprovedEditAt = newLastApprovedEditAt,
        lastApprovedEditById = newLastApprovedEditById,
        approvedSource = newApprovedSource,
        approvedHtmlSanitized = newApprovedHtmlSanitized,
        approvedAt = newApprovedAt,
        approvedById = anyNewApprovedById orElse postToEdit.approvedById,
        approvedRevisionNr = newApprovedRevNr)

      if (editorId != editedPost.createdById) {
        editedPost = editedPost.copy(numDistinctEditors = 2)  // for now
      }

      // --------------------------------------------------------------------
      // If we're editing an about-category-post == a category description, update the category.
      DO_AFTER // 2020-04-01:
      REFACTOR; CLEAN_UP // use a bool instead. & remove things: [502RKDJWF5]
      // Might still need to uncache the cat though: updateCategoryMarkSectionPageStale()
      val editsAboutCategoryPost = page.pageType == PageType.AboutCategory && editedPost.isOrigPost
      val anyEditedCategory =
        if (!editsAboutCategoryPost || !editsApproved) {
          if (editsAboutCategoryPost && !editsApproved) {
            // Currently needn't fix this? Only staff can edit these posts, right now.
            unimplemented("Updating a category later when its about-page orig post gets approved",
              "EdE2WK7AC")
          }
          None
        }
        else {
          val category = tx.loadCategory(page.meta.categoryId getOrDie "DwE2PKF0")
                .getOrDie("EdE8ULK4E")
          val excerpt = JsonMaker.htmlToExcerpt(
            newTextAndHtml.safeHtml, Category.DescriptionExcerptLength,  // [502RKDJWF5]
            firstParagraphOnly = true)
          Some(category.copy(description = Some(excerpt.text)))
        }
      // --------------------------------------------------------------------

      val postRecentlyCreated = tx.now.millis - postToEdit.createdAt.getTime <=
          AllSettings.PostRecentlyCreatedLimitMs

      val reviewTask: Option[ReviewTask] =    // (7ALGJ2)
        if (editor.isStaffOrTrustedNotThreat) {
          // This means staff has had a look at the post, even edited it — so resolve
          // mod tasks about this posts. So staff won't be asked to review this post,
          // on the Moderation page.
          // Test:  modn-from-disc-page-review-after  TyTE2E603RKG4.TyTE2E405R2

          // Mod tasks for new topics are linked to the orig post, not the title post.
          val postWithModTasks =
                if (!postToEdit.isTitle) postToEdit
                else {
                  // Test: modn-from-disc-page-review-after  TyTE2E603RKG4.TyTE2E042SR4
                  tx.loadTheOrigPost(postToEdit.pageId)
                }

          maybeReviewAcceptPostByInteracting(postWithModTasks, moderator = editor,
                ReviewDecision.InteractEdit)(tx, staleStuff)

          // Don't review late edits by trusted members — trusting them is
          // the point with the >= TrustedMember trust levels. TyTLADEETD01
          None
        }
        else if (postRecentlyCreated && !editorAndLevels.threatLevel.isThreat) {
          // Need not review a recently created post: it's new and the edits likely
          // happened before other people read it, so they'll notice any weird things
          // later when they read it, and can flag it. This is not totally safe,
          // but better than forcing the staff to review all edits? (They'd just
          // get bored and stop reviewing.)
          // The way to do this in a really safe manner: Create a invisible inactive post-edited
          // review task, which gets activated & shown after x hours if too few people have read
          // the post. But if many has seen the post, the review task instead gets deleted.
          None
        }
        else if (!postToEdit.isSomeVersionApproved && !editedPost.isSomeVersionApproved) {
          // Review task should already have been created.
          val tasks = tx.loadReviewTasksAboutPostIds(Seq(editedPost.id))
          if (tasks.isEmpty) {
            logger.warn(s"s$siteId: Post ${editedPost.id} slips past review? [TyE4WKA02]")
          }
          None
        }
        else {
          // Later, COULD specify editor id instead, as ReviewTask.maybeBadUserId [6KW02QS]
          var reviewReasons = immutable.Seq[ReviewReason]()
          if (!postRecentlyCreated) {
            // The post was created long ago — we want to reviwe it, so people cannot edit
            // their old posts and change to spam links, undetected.
            reviewReasons :+= ReviewReason.LateEdit
          }
          if (editorAndLevels.threatLevel.isThreat) {
            reviewReasons :+= ReviewReason.Edit
            reviewReasons :+= ReviewReason.IsByThreatUser
          }
          dieIf(reviewReasons.isEmpty, "TyE5KP20")
          Some(
            createOrAmendOldReviewTask(SystemUserId, editedPost, reviewReasons, tx))
        }

      val anySpamCheckTask =
        if (!globals.spamChecker.spamChecksEnabled) None
        else if (!SpamChecker.shallCheckSpamFor(editor)) None
        else Some(
          // This can get same prim key as earlier spam check task, if is ninja edit. [SPMCHKED]
          // Solution: Give each spam check task its own id field.
          SpamCheckTask(
            createdAt = globals.now(),
            siteId = siteId,
            postToSpamCheck = Some(PostToSpamCheck(
              postId = editedPost.id,
              postNr = editedPost.nr,
              postRevNr = editedPost.currentRevisionNr,
              pageId = page.meta.pageId,
              pageType = page.meta.pageType,
              pageAvailableAt = When.fromDate(page.meta.publishedAt getOrElse page.meta.createdAt),
              htmlToSpamCheck = newTextAndHtml.safeHtml,
              language = settings.languageCode)),
            who = who,
            requestStuff = spamRelReqStuff))

      val auditLogEntry = AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.EditPost,
        doerId = editorId,
        doneAt = tx.now.toJavaDate,
        browserIdData = who.browserIdData,
        pageId = Some(pageId),
        uniquePostId = Some(postToEdit.id),
        postNr = Some(postNr),
        targetUserId = Some(postToEdit.createdById))

      tx.updatePost(editedPost)
      tx.indexPostsSoon(editedPost)
      anySpamCheckTask.foreach(tx.insertSpamCheckTask)
      newRevision.foreach(tx.insertPostRevision)
      saveDeleteUploadRefs(postToEdit, editedPost = editedPost, newTextAndHtml,
            isAppending = false, isEditing = true, editorId, tx)

      insertAuditLogEntry(auditLogEntry, tx)

      REFACTOR; CLEAN_UP; // only mark section page as stale, and uncache category.
      // Because categories on loonger  store a their description (well they don't use it anyway)
      // Note: We call uncacheAllCategories() below already, if anyEditedCategory.isDefined.
      anyEditedCategory.foreach(tx.updateCategoryMarkSectionPageStale)

      reviewTask.foreach(tx.upsertReviewTask)
      SHOULD // generate review task notf?  [revw_task_notfs]
      // At least if the edits not yet approved — then, annoying for the person
      // who did the edits, if they "never" appear because the staff didn't notice.
      // val notfs = notfGenerator(tx).generateForReviewTask( ...)

      dieIf(!postToEdit.isSomeVersionApproved && editedPost.isSomeVersionApproved,
        "TyE305RK7TP", "Staff cannot approve and publish post via an edit")

      if (editedPost.isCurrentVersionApproved) {
        staleStuff.addPageId(editedPost.pageId)
        saveDeleteLinks(editedPost, newTextAndHtml, editorId, tx, staleStuff)
        TESTS_MISSING // notf not sent until after ninja edit window ended?  TyTNINJED02
        val notfs = notfGenerator(tx).generateForEdits(
              postToEdit, editedPost, Some(newTextAndHtml))
        tx.saveDeleteNotifications(notfs)
      }

      deleteDraftNr.foreach(nr => tx.deleteDraft(editorId, nr))

      val oldMeta = page.meta
      var newMeta = oldMeta.copy(version = oldMeta.version + 1)
      var makesSectionPageHtmlStale = false
      // Bump the page, if the article / original post was edited, and topic not closed.
      // (This is how Discourse works and people seems to like it. However,
      // COULD add a don't-bump option for minor edits.)
      if (postNr == PageParts.BodyNr && editedPost.isCurrentVersionApproved && !page.isClosed) {
        newMeta = newMeta.copy(bumpedAt = Some(tx.now.toJavaDate))
        makesSectionPageHtmlStale = true
      }
      tx.updatePageMeta(newMeta, oldMeta = oldMeta, makesSectionPageHtmlStale)
      anyEditedCategory
    }

    if (anyEditedCategory.isDefined) {
      // The cached categories remember their category description or thumbnail images
      // — some of which we have now edited.
      uncacheAllCategories()
    }

    refreshPageInMemCache(pageId)
  }


  /** Links are saved only for the approved version (if any) of a post.
    * So, if someone submits a new post, or edits an old post, we don't
    * save any links, until the new post, or the edits, have been approved.
    *
    * If there're many links from page A to B, then, remember all of them,
    * per unique url, e.g. both:  /some-topic  and:  /-123-some-topic.
    *
    * Reasoning: If that linked page with id 123 gets moved to:  [many_lns_same_page]
    *   /another-url-path
    * then the  /some-topic  link breaks,
    * but /-123-some-topic will still work, because it includes the page id
    * in the url.
    * And if later moving page /-234-replacement  to  /some-topic,
    * then the /some-topic link will start working again — pointing
    * to the new page. Which is sometimes what one wants.
    *
    * So links can be different, although they're to the same page.
    *
    * No need, though, to remember two different /-123-some-topic  links from
    * the same post.  That's why [[SourceAndHtml.internalLinks]] is a Set.
    *
    * staleStuff must include post.pageId already.
    */
  def saveDeleteLinks(post: Post, sourceAndHtml: SourceAndHtml, writerId: PatId,
          tx: SiteTx, staleStuff: StaleStuff, skipBugWarn: Bo = false): U = {
    // Some e2e tests: backlinks-basic.2browsers.test.ts  TyTINTLNS54824

    // Let's always add the page id to staleStuff before, just so that
    // here we can check that that wasn't forgotten.
    // Don't do from in here — that'd be unexpected?, in this fn about links.
    if (!skipBugWarn && !staleStuff.includesPageModified(post.pageId)) {
      bugWarn("TyE306KTD3", s"s$siteId: staleStuff: linking page id ${
            post.pageId} hasn't been modified? Post: $post")
    }

    dieIf(!post.isCurrentVersionApproved && Globals.isDevOrTest, "TyE406RMTK2")
    if (!post.isCurrentVersionApproved)
      return

    val approvedAt: When = post.lastApprovedAt getOrElse {
      bugWarn("TyE42RKTJ56", s"s$siteId: Post approved but no date: $post")
      return
    }

    if (post.currentSource != sourceAndHtml.source) {
      bugWarn("TyE305RKT5", o"""s$siteId: post.currentSource != sourceAndHtml.source,
            post: $post,  sourceAndHtml.source: ${sourceAndHtml.source}""")
      return
    }

    COULD // remove param writerId? It's in the post already, right?:
    // (Or use  post.currentRevisionById — no, a new lastApprovedRevisionById ?)
    if (post.lastApprovedEditById.getOrElse(post.createdById) != writerId) {
      bugWarn("TyE63WKDJ356", s"s$siteId: post last writer id != writerId = ${
            writerId}:  $post")
      return
    }

    val pageIdsLinkedBefore = tx.loadPageIdsLinkedFromPage(post.pageId)
    val linksBefore: Seq[Link] = tx.loadLinksFromPost(post.id)

    val linkUrlsAfter = sourceAndHtml.internalLinks
    val newLinkUrls: Set[St] = linkUrlsAfter.filterNot(linkUrl =>
          linksBefore.exists(_.linkUrl == linkUrl))

    val newLinks = newLinkUrls flatMap { linkUrl: St =>
      val uri = new java.net.URI(linkUrl)
      val urlPath: St = uri.getPathEmptyNotNull
      val hashFrag: St = uri.getHashFragEmptyNotNull
      val anyPostPath: Opt[PostPathWithIdNr] =
            getPostPathForUrlPath(path = urlPath, hash = hashFrag)
      // This might result in many links from a page to another — but these
      // links will all have different url paths, e.g.:  [many_lns_same_page]
      //   - /-1234/link-by-id
      //   - /-1234/by-id-but-old-page-slug
      //   - /id-less-path-to-same-page
      anyPostPath map { path: PostPathWithIdNr =>
        Link(fromPostId = post.id,
              linkUrl = linkUrl,
              addedAt = approvedAt,
              addedById = writerId,
              isExternal = false,
              toPageId = Some(path.pageId))
      }
    }

    // [On2], fine.
    val deletedLinks = linksBefore.filter(lb => !linkUrlsAfter.contains(lb.linkUrl))

    tx.deleteLinksFromPost(post.id, deletedLinks.map(_.linkUrl).toSet)
    newLinks foreach tx.upsertLink

    val pageIdsLinkedAfter = tx.loadPageIdsLinkedFromPage(post.pageId)

    // Uncache backlinked pages. [uncache_blns]
    if (post.isTitle) {
      // Then all linked pages need to update their backlinks to this post's page
      // — to show the new title. But the set of links cannot have changed.
      bugWarnIf(pageIdsLinkedAfter != pageIdsLinkedBefore,
            "TyE305RKDJ", o"""s$siteId: Linked pages changed when editing *title*,
              page id: ${post.pageId}""")
      staleStuff.addPageIds(
            pageIdsLinkedBefore, pageModified = false, backlinksStale = true)
    }
    else {
      WOULD_OPTIMIZE // use Guava.symmetricDifference.  But not Scala's  setA.diff.setB.
      val stalePageIds =
            (pageIdsLinkedBefore -- pageIdsLinkedAfter) ++
              (pageIdsLinkedAfter -- pageIdsLinkedBefore)
      staleStuff.addPageIds(stalePageIds, pageModified = false, backlinksStale = true)
    }
  }


  private def saveDeleteUploadRefs(postToEdit: Post, editedPost: Post,
        sourceAndHtml: SourceAndHtml, isAppending: Boolean, isEditing: Boolean,
        editorId: UserId, tx: SiteTransaction): Unit = {
    // Use findUploadRefsInPost (not ...InText) so we'll find refs both in the hereafter
    // 1) approved version of the post, and 2) the current possibly unapproved version.
    // Because if any of the approved or the current version links to an uploaded file,
    // we should keep the file.

    if (isEditing && editedPost.currentSource != sourceAndHtml.source) {
      bugWarn("TyE5WKG20J", s"s$siteId: editedPost.currentSource != sourceAndHtml.source: ${
            editedPost}")
      return
    }

    if (isEditing && editedPost.isCurrentVersionApproved &&
          editedPost.lastApprovedEditById.isNot(editorId)) {
      bugWarn("TyE205AKT3", s"s$siteId: editedPost last editor id != editorId = ${
            editorId}:  $editedPost")
      // Don't return, didn't before (2020-07).
    }
    // Or use  post.currentRevisionById?:
    dieIf(Globals.isDevOrTest && editedPost.currentRevisionById != editorId, "TyE3056KTD")

    val oldUploadRefs = tx.loadUploadedFileReferences(postToEdit.id)

    val currentUploadRefs: Set[UploadRef] = {
      if (isAppending) {
        require(!isEditing)
        oldUploadRefs ++ sourceAndHtml.uploadRefs  // [52TKTSJ5]
      }
      else {
        TESTS_MISSING // or?

        require(isEditing)
        // Tricky! We don't know which of oldUploadRefs are approved,
        // and which one's aren't, and should be removed because they aren't
        // in the new edited unapproved source.
        //
        // Example:
        //
        // Old approved text includes:  https://old-appr-ref
        // Old next *unapproved* revision includes: (old Post.currentSource)
        //   https://old-appr-ref   and https://old-unappr-ref
        //
        // The edited new unapproved revision (new Post.currentSource) includes
        // no ref at all. We cannot remove  https://old-appr-ref,
        // until the new edited version has been approved.
        // But we do want to remove  https://old-unappr-ref.
        // So, there's a difference between *un*approved and approved old upl ref,
        // and we want to know which ones of the old refs, have been approved
        // (need to keep those).
        // Maybe remember in the db? [is_upl_ref_aprvd]
        //
        // This won't work:
        //
        // var newRefs = sourceAndHtml.uploadRefs
        // if (postToEdit.isSomeVersionApproved && !editedPost.isCurrentVersionApproved) {
        //   // Then any old & approved refs are still in use.
        //   // But! This might add *too many** refs:
        //   newRefs ++= oldUploadRefs
        //   // Because we might need to *remove* some refs from the previous
        //   // unapproved version, that are not in the ne unapproved version.
        //   // But we don't know which of oldUploadRefs those are.
        // }
        // So, we need to:
        val pubId = thePubSiteId()
        val approvedRefs = editedPost.approvedHtmlSanitized.map(
              html => UploadsDao.findUploadRefsInHtml(html, pubId)) getOrElse Set.empty
        val unapprRefs = sourceAndHtml.uploadRefs

        // (In the comment example above, approvedRefs would include  https://old-appr-ref,
        // but unapprRefs might, and might not.)
        val refs = approvedRefs ++ unapprRefs

        if (Globals.isDevOrTest) {
          val r2 = findUploadRefsInPost(editedPost) // [nashorn_in_tx]
          dieIf(refs != r2, "TyE306KSM233", s"refs: $refs, r2: $r2")
        }

        refs

        // Two solution, to avoid slow things (like Nashorn) inside
        // a tx, are 1) to add  editedPost  to a background queue,
        // which re-indexes the post later?
        // That could actually be index_queue3! Already there, and updated
        // properly.
        // Or 2) to generate the prev post's refs in a separate step,
        // before this tx. And remember which ones are approved, and
        // which are unapproved.
      }
    }

    val uploadRefsAdded = currentUploadRefs -- oldUploadRefs
    val uploadRefsRemoved = oldUploadRefs -- currentUploadRefs

    uploadRefsAdded foreach { hashPathSuffix =>
      tx.insertUploadedFileReference(postToEdit.id, hashPathSuffix, editorId)
    }

    uploadRefsRemoved foreach { hashPathSuffix =>
      val gone = tx.deleteUploadedFileReference(postToEdit.id, hashPathSuffix)
      if (!gone) {
        logger.warn(o"""Didn't delete this uploaded file ref: $hashPathSuffix, post id:
            ${postToEdit.id} [TyE7UJRH03M]""")
      }
    }
  }


  def loadSomeRevisionsRecentFirst(postId: PostId, revisionNr: Int, atLeast: Int,
        userId: Option[UserId]): (Seq[PostRevision], Map[UserId, Participant]) = {
    val revisionsRecentFirst = mutable.ArrayStack[PostRevision]()
    var usersById: Map[UserId, Participant] = null
    readOnlyTransaction { tx =>
      val post = tx.loadThePost(postId)
      val page = newPageDao(post.pageId, tx)
      val user = userId.flatMap(tx.loadParticipant)

      throwIfMayNotSeePost(post, user)(tx)

      loadSomeRevisionsWithSourceImpl(postId, revisionNr, revisionsRecentFirst, atLeast, tx)
      if (revisionNr == PostRevision.LastRevisionMagicNr) {
        val postNow = tx.loadThePost(postId)
        val currentRevision = PostRevision.createFor(postNow, revisionsRecentFirst.headOption)
          .copy(fullSource = Some(postNow.currentSource))
        revisionsRecentFirst.push(currentRevision)
      }
      val userIds = mutable.HashSet[UserId]()
      revisionsRecentFirst foreach { revision =>
        userIds add revision.composedById
        revision.approvedById foreach userIds.add
        revision.hiddenById foreach userIds.add
      }
      usersById = tx.loadParticipantsAsMap(userIds)
    }
    (revisionsRecentFirst.toSeq, usersById)
  }


  private def loadLastRevisionWithSource(postId: PostId, tx: SiteTransaction)
        : Option[PostRevision] = {
    val revisionsRecentFirst = mutable.ArrayStack[PostRevision]()
    loadSomeRevisionsWithSourceImpl(postId, PostRevision.LastRevisionMagicNr,
      revisionsRecentFirst, atLeast = 1, tx)
    revisionsRecentFirst.headOption
  }


  private def loadSomeRevisionsWithSourceImpl(postId: PostId, revisionNr: Int,
        revisionsRecentFirst: mutable.ArrayStack[PostRevision], atLeast: Int,
        tx: SiteTransaction): Unit = {
    tx.loadPostRevision(postId, revisionNr) foreach { revision =>
      loadRevisionsFillInSource(revision, revisionsRecentFirst, atLeast, tx)
    }
  }


  private def loadRevisionsFillInSource(revision: PostRevision,
        revisionsRecentFirstWithSource: mutable.ArrayStack[PostRevision],
        atLeast: Int, tx: SiteTransaction): Unit = {
    if (revision.fullSource.isDefined && (atLeast <= 1 || revision.previousNr.isEmpty)) {
      revisionsRecentFirstWithSource.push(revision)
      return
    }

    val previousRevisionNr = revision.previousNr.getOrDie(
      "DwE08SKF3", o"""In site $siteId, post ${revision.postId} revision ${revision.revisionNr}
          has neither full source nor any previous revision nr""")

    val previousRevision =
      tx.loadPostRevision(revision.postId, previousRevisionNr).getOrDie(
        "DwE5GLK2", o"""In site $siteId, post ${revision.postId} revision $previousRevisionNr
            is missing""")

    loadRevisionsFillInSource(previousRevision, revisionsRecentFirstWithSource,
      atLeast - 1, tx)

    val prevRevWithSource = revisionsRecentFirstWithSource.headOption getOrDie "DwE85UF2"
    val revisionWithSource =
      if (revision.fullSource.isDefined) revision
      else revision.copyAndPatchSourceFrom(prevRevWithSource)
    revisionsRecentFirstWithSource.push(revisionWithSource)
  }


  def editPostSettings(postId: PostId, branchSideways: Option[Byte], me: Who): JsObject = {
    // Haven't tested the change from old & deleted jsonMaker.makeStorePatch2()
    // to jsonMaker.makeStorePatchForPostIds().
    // This branch-sideways code was for 2D mind maps, which are disabled nowadays,
    // so this fn isn't currently in use.
    throwUntested("TyEBRANCHSIDEW")

    val post /* patch*/ = readWriteTransaction { tx =>
      val postBefore = tx.loadPostsByUniqueId(Seq(postId)).headOption.getOrElse({
        throwNotFound("EsE5KJ8W2", s"Post not found: $postId")
      })._2
      val postAfter = postBefore.copy(branchSideways = branchSideways)

      val auditLogEntry = AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.ChangePostSettings,
        doerId = me.id,
        doneAt = tx.now.toJavaDate,
        browserIdData = me.browserIdData,
        pageId = Some(postBefore.pageId),
        uniquePostId = Some(postBefore.id),
        postNr = Some(postBefore.nr),
        targetUserId = Some(postBefore.createdById))

      val oldMeta = tx.loadThePageMeta(postAfter.pageId)
      val newMeta = oldMeta.copy(version = oldMeta.version + 1)

      // (Don't reindex. For now, don't send any notifications (since currently just toggling
      // branch-sideways))
      tx.updatePost(postAfter)
      tx.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = false)
      insertAuditLogEntry(auditLogEntry, tx)

      postAfter /* jsonMaker.makeStorePatch2(postId, postAfter.pageId,
          appVersion = globals.applicationVersion, tx))*/
    }

    val patch = jsonMaker.makeStorePatchForPostIds(
          Set(post.id), showHidden = true, inclUnapproved = true, dao = this)

    refreshPageInMemCache(post.pageId)
    patch
  }


  def changePostType(pageId: PageId, postNr: PostNr, newType: PostType,
        changerId: UserId, browserIdData: BrowserIdData): Unit = {
    writeTx { (tx, staleStuff) =>
      val page = newPageDao(pageId, tx)
      val postBefore = page.parts.thePostByNr(postNr)
      val Seq(author, changer) = tx.loadTheParticipants(postBefore.createdById, changerId)
      throwIfMayNotSeePage(page, Some(changer))(tx)

      val postAfter = postBefore.copy(tyype = newType)

      val movesToOtherSection =
        (postBefore.tyype == PostType.Normal && postAfter.tyype == PostType.BottomComment) ||
        (postBefore.tyype == PostType.BottomComment && postAfter.tyype == PostType.Normal)

      if (movesToOtherSection) {
        val anyParent = page.parts.postByNr(postAfter.parentNr)
        throwForbiddenIf(!anyParent.exists(_.isOrigPost),
          "TyE5KSQ047", "Can only move top level posts from one section to another.")
      }

      var anyModDecision: Option[ModDecision] = None

      // Test if the changer is allowed to change the post type in this way.
      if (changer.isStaffOrCoreMember) {
        (postBefore.tyype, postAfter.tyype) match {
          case (before, after) if before == PostType.Normal && after.isWiki =>
            // Fine, staff wikifies post.
            // And now we can consider this post reviewed and ok, right.
            anyModDecision = Some(ReviewDecision.InteractWikify)
          case (before, after) if before.isWiki && after == PostType.Normal =>
            // Fine, staff removes wiki status.
          case (before, after) if movesToOtherSection =>
            // Fine.
          case (before, after) =>
            throwForbidden("DwE7KFE2", s"Cannot change post type from $before to $after")
        }
      }
      else {
        // All normal users may do is to remove wiki status of their own posts.
        // What? Why not change *to* wiki status?
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
        didWhat = AuditLogEntryType.ChangePostSettings,
        doerId = changerId,
        doneAt = tx.now.toJavaDate,
        browserIdData = browserIdData,
        pageId = Some(pageId),
        uniquePostId = Some(postBefore.id),
        postNr = Some(postNr),
        targetUserId = Some(postBefore.createdById))

      val oldMeta = page.meta
      val newMeta = oldMeta.copy(version = oldMeta.version + 1)

      if (movesToOtherSection) {
        // Move all descendants replies too. (This might mean updating many posts,
        // and that's fine; this operation is barely ever done.)
        val descendantPosts = page.parts.descendantsOf(postAfter.nr)
        for (descendant <- descendantPosts) {
          tx.updatePost(descendant.copy(tyype = postAfter.tyype))
        }
      }

      anyModDecision foreach { decision =>
        // Test:  modn-from-disc-page-review-after  TyTE2E603RKG4.TYTE2E40IRM5
        maybeReviewAcceptPostByInteracting(postAfter, moderator = changer,
              decision)(tx, staleStuff)
      }

      // (Don't reindex)
      tx.updatePost(postAfter)
      tx.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale = false)
      insertAuditLogEntry(auditLogEntry, tx)
      // COULD generate some notification? E.g. "Your post was made wiki-editable."
    }

    refreshPageInMemCache(pageId)  // [staleStuff]
  }


  def changePostStatus(postNr: PostNr, pageId: PageId, action: PostStatusAction, userId: UserId)
        : ChangePostStatusResult = {
    val result = writeTx { (tx, staleStuff) =>
      changePostStatusImpl(postNr, pageId = pageId, action, userId = userId,
            tx, staleStuff)
    }
    refreshPageInMemCache(pageId)
    result
  }


  /** Deletes, undelete, hides, unhides etc a post, and optionally, its
    * successors.
    *
    * Does not change the status of any ModTask related to this post
    * — better if such things are done only explicitly via ReviewsDao
    * and UI buttons? [deld_post_mod_tasks]
    */
  def changePostStatusImpl(postNr: PostNr, pageId: PageId, action: PostStatusAction,
        userId: UserId, tx: SiteTransaction, staleStuff: StaleStuff)
        : ChangePostStatusResult =  {
    import com.debiki.core.{PostStatusAction => PSA}
    import context.security.throwIndistinguishableNotFound

    val page = newPageDao(pageId, tx)
    if (!page.exists)
      throwIndistinguishableNotFound("TyE05KSRDM3")

    val user = tx.loadParticipant(userId) getOrElse throwForbidden("DwE3KFW2", "Bad user id")

    SECURITY; COULD // check if may see post, not just the page?  [whispers] [staff_can_see]
    throwIfMayNotSeePage(page, Some(user))(tx)

    val postBefore = page.parts.thePostByNr(postNr)
    lazy val postAuthor = tx.loadTheParticipant(postBefore.createdById)

    // Authorization.
    if (!user.isStaff) {
      if (postBefore.createdById != userId)
        throwForbidden("DwE0PK24", "You may not modify that post, it's not yours")

      if (!action.isInstanceOf[PSA.DeletePost] && action != PSA.CollapsePost)
        throwForbidden("DwE5JKF7", "You may not modify the whole tree")
    }

    if (postBefore.isDeleted) {
      val isUnhidingPostBody = action == PSA.UnhidePost
      val isChangingDeletePostToDeleteTree =
            postBefore.deletedStatus.onlyThisDeleted && action == PSA.DeleteTree
      if (isChangingDeletePostToDeleteTree) {
        // Fine.
      }
      else if (isUnhidingPostBody) {
        UNTESTED
        // Fine — maybe staff are approving this post [apr_deld_post], and will
        // also undelete it or any deleted page.
      }
      else {
        // Hmm but trying to delete a deleted *page*, does nothing, instead of throwing an error. [5WKQRH2]
        throwForbidden("DwE5GUK5", "This post has already been deleted")
      }
    }

    var numVisibleRepliesGone = 0
    var numVisibleRepliesBack = 0
    var numOrigPostVisibleRepliesGone = 0
    var numOrigPostVisibleRepliesBack = 0

    val uncacheBacklinksFromPostIds = mutable.Set[PostId]()

    def rememberBacklinksUpdCounts(postBefore: Post, postAfter: Post): Unit = {
      if (postBefore.isVisible == postAfter.isVisible)
        return

      // The post got un/deleted, or un/hidden — so now internal links might
      // have dis/appeared. Remember this post id, so we can uncache pages
      // it links to, so their backlinks get refreshed.
      uncacheBacklinksFromPostIds += postBefore.id

      if (!postBefore.isReply)
        return

      if (!postAfter.isVisible) {
        dieIf(numVisibleRepliesBack > 0, "EdE6PK4W0")
        numVisibleRepliesGone += 1
        if (postBefore.isOrigPostReply) {
          numOrigPostVisibleRepliesGone += 1
        }
      }
      if (postAfter.isVisible) {
        dieIf(numVisibleRepliesGone > 0, "EdE7BST2Z")
        numVisibleRepliesBack += 1
        if (postBefore.isOrigPostReply) {
          numOrigPostVisibleRepliesBack += 1
        }
      }
    }

    val now = globals.now().toJavaDate

    // ----- Update the directly affected post

    val postAfter = action match {
      case PSA.HidePost => postBefore.copyWithNewStatus(now, userId, bodyHidden = true)
      case PSA.UnhidePost => postBefore.copyWithNewStatus(now, userId, bodyUnhidden = true)
      case PSA.CloseTree => postBefore.copyWithNewStatus(now, userId, treeClosed = true)
      case PSA.CollapsePost => postBefore.copyWithNewStatus(now, userId, postCollapsed = true)
      case PSA.CollapseTree => postBefore.copyWithNewStatus(now, userId, treeCollapsed = true)
      case PSA.DeletePost(clearFlags) => postBefore.copyWithNewStatus(now, userId, postDeleted = true)
      case PSA.DeleteTree => postBefore.copyWithNewStatus(now, userId, treeDeleted = true)
    }

    rememberBacklinksUpdCounts(postBefore, postAfter = postAfter)

    val postsDeleted = ArrayBuffer[Post]()
    val postsUndeleted = ArrayBuffer[Post]()

    tx.updatePost(postAfter)
    if (postBefore.isDeleted != postAfter.isDeleted) {
      tx.indexPostsSoon(postAfter)
      if (postAfter.isDeleted) {
        postsDeleted.append(postAfter)
      }
      else {
        postsUndeleted.append(postAfter)
      }
    }

    // ----- Update successors

    // Update any indirectly affected posts, e.g. subsequent comments in the same
    // thread that are being deleted recursively.
    if (action.affectsSuccessors) for (successor: Post <- page.parts.descendantsOf(postNr)) {
      val anyUpdatedSuccessor: Option[Post] = action match {
        case PSA.CloseTree =>
          if (successor.closedStatus.areAncestorsClosed) None
          else Some(successor.copyWithNewStatus(now, userId, ancestorsClosed = true))
        case PSA.CollapseTree =>
          if (successor.collapsedStatus.areAncestorsCollapsed) None
          else Some(successor.copyWithNewStatus(now, userId, ancestorsCollapsed = true))
        case PSA.DeleteTree =>
          if (successor.deletedStatus.areAncestorsDeleted) None
          else {
            val successorDeleted = successor.copyWithNewStatus(now, userId, ancestorsDeleted = true)
            postsDeleted.append(successorDeleted)
            Some(successorDeleted)
          }
        case x =>
          die("TyE2KBIF5", "Unexpected PostAction: " + x)
      }

      var postsToReindex = Vector[Post]()
      anyUpdatedSuccessor foreach { updatedSuccessor =>
        rememberBacklinksUpdCounts(postBefore = successor, postAfter = updatedSuccessor)
        tx.updatePost(updatedSuccessor)
        if (successor.isDeleted != updatedSuccessor.isDeleted) {
          postsToReindex :+= updatedSuccessor
        }
      }
      tx.indexPostsSoon(postsToReindex: _*)
    }

    // ----- Update related things

    BUG; SHOULD // delete upload refs, if any posts deleted?  [rm_upl_refs]

    if (uncacheBacklinksFromPostIds.nonEmpty) {
      // Uncache backlinked pages. [uncache_blns]
      // (We don't delete links, when soft-deleting a post or page. Instead, such
      // links are filtered out when querying. [q_deld_lns] )
      val linkedPageIds = tx.loadPageIdsLinkedFromPosts(
            uncacheBacklinksFromPostIds.toSet)

      // This might refresh unnecessarily many pages, if there're other posts that
      // link to the same pages, so which pages are linked, didn't actually change.
      staleStuff.addPageIds(
            linkedPageIds, pageModified = false, backlinksStale = true)
    }

    val oldMeta = page.meta
    var newMeta = oldMeta.copy(version = oldMeta.version + 1)
    var markSectionPageStale = false
    var answerGotDeleted = false

    // If a question's answer got deleted, change question status to unsolved, and reopen it. [2JPKBW0]
    newMeta.answerPostId foreach { answerPostId =>
      if (postsDeleted.exists(_.id == answerPostId)) {
        answerGotDeleted = true
        // Dupl line. [4UKP58B]
        newMeta = newMeta.copy(answeredAt = None, answerPostId = None, closedAt = None)
        // Need change from the Solved icon: ✓  to a question mark: (?) icon, in the topic list:
        markSectionPageStale = true
      }
    }

    // Need not delete any notifications, even if posts were deleted —
    // instead, notfs about deleted posts, or on deleted pages, are filtered
    // out here: [SKIPDDNTFS].

    // We don't both delete and undelete at the same time.
    dieIf(postsDeleted.nonEmpty && postsUndeleted.nonEmpty, "TyE2WKBG5")

    // Invalidate, or re-activate, review tasks whose posts get deleted / undeleted.
    // See here: [deld_post_mod_tasks] for when deleting pages.
    // Or no? What if Mallory posts and angry comment, then people get upset, reply and flag it?
    // Then Mallory deletes his comment. Now, better if the review tasks for those flags, are
    // still available for the staff, so they can review Mallory's deleted post.
    // So, don't do this for other posts than the one being explicitly reviewed and deleted:
    // ?? skip this ??  do from  ReviewsDao  instead.
    DELETE_LATER; DO_AFTER // 2021-01 delete this whole comment & out commented code block.
    /*
    doingReviewTask foreach { task =>
      val taskPostId = task.postId getOrDie "TyE6KWA2C"
      invalidateReviewTasksForPosts(postsDeleted.filter(_.id == taskPostId), doingReviewTask, tx)
      reactivateReviewTasksForPosts(postsUndeleted.filter(_.id == taskPostId), doingReviewTask, tx)
    } */

    // If this post is getting deleted because it's spam, then, update any [UPDSPTSK]
    // pending spam check task, so we can send a training sample to any spam check services.
    // (If we're delting a whole sub tree of posts, let's only mark the first one as spam —
    // the one explicitly getting deleted. Anything else would be too complicated.)
    if (postsDeleted.exists(_.id == postBefore.id)) {
      dieIf(!action.isInstanceOf[PostStatusAction.DeletePost] &&
          action != PostStatusAction.DeleteTree, "TyE205MKSD")
      updateSpamCheckTaskBecausePostDeleted(postBefore, postAuthor, deleter = user, tx)
    }

    // ----- Update the page

    // COULD update database to fix this. (Previously, chat pages didn't count num-chat-messages.)
    val isChatWithWrongReplyCount =
      page.pageType.isChat && oldMeta.numRepliesVisible == 0 && numVisibleRepliesGone > 0
    val numVisibleRepliesChanged = numVisibleRepliesGone > 0 || numVisibleRepliesBack > 0

    if (numVisibleRepliesChanged && !isChatWithWrongReplyCount) {
      newMeta = newMeta.copy(
        numRepliesVisible =
            oldMeta.numRepliesVisible + numVisibleRepliesBack - numVisibleRepliesGone,
        numOrigPostRepliesVisible =
          // For now: use max() because the db field was just added so some counts are off.
          math.max(0, oldMeta.numOrigPostRepliesVisible +
              numOrigPostVisibleRepliesBack - numOrigPostVisibleRepliesGone))
      markSectionPageStale = true
      updatePagePopularity(page.parts, tx)
    }

    staleStuff.addPageId(page.id, memCacheOnly = true)  // page version bumped above
    tx.updatePageMeta(newMeta, oldMeta = oldMeta, markSectionPageStale)

    // In the future: if is a forum topic, and we're restoring the OP, then bump the topic.

    BUG // should sometimes remove forum topic list from mem cache? — hmm, already done, right: [2F5HZM7]

    ChangePostStatusResult(
          updatedPost = Some(postAfter), answerGotDeleted = answerGotDeleted)
  }


  def approvePost(pageId: PageId, postNr: PostNr, approverId: UserId,
          doingModTasks: Seq[ModTask], tx: SiteTx, staleStuff: StaleStuff)
          : ApprovePostResult = {

    val page = newPageDao(pageId, tx)
    val pageMeta = page.meta
    val postBefore = page.parts.thePostByNr(postNr)
    if (postBefore.isCurrentVersionApproved) {
      // There're races: Posts approved at the same time by different people,
      // or (a bit weird) by the same person once via the Moderation page with
      // an undo timeout, and then again directly via the Approve buttons
      // below the posts. That's all fine.  [mod_post_race]
      return ApprovePostResult(updatedPost = None)
    }

    val approver = tx.loadTheParticipant(approverId)

    // For now. Later, let core members approve posts too.
    if (!approver.isStaff)
      throwForbidden("EsE5GYK02", "You're not staff so you cannot approve posts")

    // ------ The post

    // A bit similar / dupl code [APRPOSTDPL]
    REFACTOR // save the current html directly, so this step not needed  [nashorn_in_tx]
    // and remember links and @mentions. [4WKAB02]
    val sourceAndHtml: SourceAndHtml =
          if (postBefore.isTitle) {
            TitleSourceAndHtml(postBefore.currentSource)
          }
          else {
            val renderSettings = makePostRenderSettings(pageMeta.pageType)
            textAndHtmlMaker.forBodyOrComment(
                  postBefore.currentSource,
                  embeddedOriginOrEmpty = renderSettings.embeddedOriginOrEmpty,
                  allowClassIdDataAttrs = postBefore.nr == PageParts.BodyNr,
                  // [WHENFOLLOW]
                  followLinks = postBefore.nr == PageParts.BodyNr &&
                        pageMeta.pageType.shallFollowLinks)
          }

    // Later: update lastApprovedEditAt, lastApprovedEditById and numDistinctEditors too,
    // or remove them.
    val postAfter = postBefore.copy(   // sync w test [29LW05KS2]
      safeRevisionNr =
        approver.isHuman ? Option(postBefore.currentRevisionNr) | postBefore.safeRevisionNr,
      approvedRevisionNr = Some(postBefore.currentRevisionNr),
      approvedAt = Some(tx.now.toJavaDate),
      approvedById = Some(approverId),
      approvedSource = Some(postBefore.currentSource),
      approvedHtmlSanitized = Some(sourceAndHtml.safeHtml),
      currentRevSourcePatch = None,
      // SPAM RACE COULD unhide only if rev nr that got hidden <= rev that was reviewed. [6GKC3U]
      bodyHiddenAt = None,
      bodyHiddenById = None,
      bodyHiddenReason = None)

    tx.updatePost(postAfter)
    tx.indexPostsSoon(postAfter)

    if (postBefore.isDeleted) {
      UNTESTED  // [4MT05MKRT]
      // Can happen e.g. if a moderator approves a post, after someone else
      // deleted an ancestor post or maybe the post itself.  [apr_deld_post]
      // Fine, but don't proceed with updating the page.
      // We do want to index the post though (just above) — admins should be able
      // to search and find also deleted things.
      return ApprovePostResult(updatedPost = None)
    }


    staleStuff.addPageId(pageId, memCacheOnly = true) // page version bumped below
    saveDeleteLinks(postAfter, sourceAndHtml, postAfter.createdById, tx, staleStuff)


    // ------ The page

    val isApprovingPageTitle = postNr == PageParts.TitleNr
    val isApprovingPageBody = postNr == PageParts.BodyNr
    val isApprovingNewPost = postBefore.approvedRevisionNr.isEmpty

    var newMeta = pageMeta.copy(version = pageMeta.version + 1)

    // If we're approving the page, unhide it.
    BUG // rather harmless: If page hidden because of flags, then if new reply approved,
    // the page should be shown, because now there's a visible reply. But it'll remain hidden.
    val newHiddenAt =
      if (isApprovingPageBody && isApprovingNewPost) {
        UNTESTED
        None
      }
      else newMeta.hiddenAt

    // Bump page and update reply counts if a new post was approved and became visible,
    // or if the original post was edited.
    var makesSectionPageHtmlStale = false
    if (isApprovingNewPost || isApprovingPageBody) {
      val (numNewReplies, numNewOrigPostReplies, newLastApprovedReplyAt, newLastApprovedReplyById) =
        if (isApprovingNewPost && postAfter.isReply)
          (1, postAfter.isOrigPostReply ? 1 | 0,
            Some(tx.now.toJavaDate), Some(postAfter.createdById))
        else
          (0, 0, pageMeta.lastApprovedReplyAt, pageMeta.lastApprovedReplyById)

      newMeta = newMeta.copy(
        numRepliesVisible = pageMeta.numRepliesVisible + numNewReplies,
        numOrigPostRepliesVisible = pageMeta.numOrigPostRepliesVisible + numNewOrigPostReplies,
        lastApprovedReplyAt = newLastApprovedReplyAt,
        lastApprovedReplyById = newLastApprovedReplyById,
        hiddenAt = newHiddenAt,
        bumpedAt = pageMeta.isClosed ? pageMeta.bumpedAt | Some(tx.now.toJavaDate))
      makesSectionPageHtmlStale = true
    }
    tx.updatePageMeta(newMeta, oldMeta = pageMeta, makesSectionPageHtmlStale)
    updatePagePopularity(page.parts, tx)

    // ------ Notifications

    val notifications =
      if (isApprovingPageTitle && isApprovingNewPost) {
        // Notifications will be generated for the page body, that should be enough?
        Notifications.None
      }
      else if (isApprovingNewPost) {
        notfGenerator(tx).generateForNewPost(page, postAfter, Some(sourceAndHtml),
              anyNewModTask = None, doingModTasks = doingModTasks)
      }
      else {
        notfGenerator(tx).generateForEdits(postBefore, postAfter, Some(sourceAndHtml))
      }
    tx.saveDeleteNotifications(notifications)

    refreshPagesInMemCache(Set[PageId](pageId))  ; REMOVE // <—— no longer needed, staleStuff instead

    ApprovePostResult(
          updatedPost = Some(postAfter))
  }


  @deprecated("remove this, too complicated")
  def autoApprovePendingEarlyPosts(pageId: PageId, posts: Iterable[Post])(
        tx: SiteTransaction, staleStuff: StaleStuff): Unit = {

    if (posts.isEmpty) return
    require(posts.forall(_.pageId == pageId), "EdE2AX5N6")

    val page = newPageDao(pageId, tx)
    val pageMeta = page.meta

    var numNewVisibleReplies = 0
    var numNewVisibleOpReplies = 0

    staleStuff.addPageId(pageId, memCacheOnly = true)  // page version bumped below

    for {
      post <- posts
      if !post.isSomeVersionApproved
    } {
      numNewVisibleReplies += post.isReply ? 1 | 0
      numNewVisibleOpReplies += post.isOrigPostReply ? 1 | 0

      // ----- A post

      // A bit similar / dupl code [APRPOSTDPL]
      REFACTOR // save the current html directly, so this step not needed  [nashorn_in_tx]
      // and remember links and @mentions. [4WKAB02]
      val sourceAndHtml: SourceAndHtml =
            if (post.isTitle) {
              TitleSourceAndHtml(post.currentSource)
            }
            else {
              val renderSettings = makePostRenderSettings(pageMeta.pageType)
              textAndHtmlMaker.forBodyOrComment(
                    post.currentSource,
                    embeddedOriginOrEmpty = renderSettings.embeddedOriginOrEmpty,
                    allowClassIdDataAttrs = post.nr == PageParts.BodyNr,
                    // [WHENFOLLOW]
                    followLinks = post.nr == PageParts.BodyNr &&
                          pageMeta.pageType.shallFollowLinks)
            }

      // Don't need to update lastApprovedEditAt, because this post has been invisible until now.
      // Don't set safeRevisionNr, because this approval hasn't been reviewed by a human.
      val postAfter = post.copy(
        approvedRevisionNr = Some(post.currentRevisionNr),
        approvedAt = Some(tx.now.toJavaDate),
        approvedById = Some(SystemUserId),
        approvedSource = Some(post.currentSource),
        approvedHtmlSanitized = Some(sourceAndHtml.safeHtml),
        currentRevSourcePatch = None)

      tx.updatePost(postAfter)
      tx.indexPostsSoon(postAfter)

      saveDeleteLinks(postAfter, sourceAndHtml, post.createdById, tx, staleStuff)

      // ------ Notifications

      if (!post.isTitle) {
        val notfs = notfGenerator(tx).generateForNewPost(page, postAfter,
              Some(sourceAndHtml),
              anyNewModTask = None,
              // But approver might get notfd about post! [notfs_bug]
              // However this whole cascade-approval idea should be deleted.
              // Then this whole fn, autoApprovePendingEarlyPosts(), gone.
              doingModTasks = Nil)
        tx.saveDeleteNotifications(notfs)
      }
    }

    // ----- The page

    // Unhide the page, if is hidden because the orig post hasn't been approved until now.
    val isNewPage = posts.exists(_.isOrigPost) && posts.exists(_.isTitle)
    val newHiddenAt = if (isNewPage) None else pageMeta.hiddenAt

    val approvedReplies = posts.filter(p => p.isReply && p.approvedAt.isDefined)

    val (newLastApprovedReplyAt, newLastApprovedReplyById) =
      if (approvedReplies.isEmpty) {
        (None, None)
      }
      else {
        val lastApprovedReply = Some(approvedReplies.maxBy(_.approvedAt.getOrDie("TyE2ABKL4").getTime))
        (Some(tx.now.toJavaDate), lastApprovedReply.map(_.createdById))
      }

    val newMeta = pageMeta.copy(
      numRepliesVisible = pageMeta.numRepliesVisible + numNewVisibleReplies,
      numOrigPostRepliesVisible = pageMeta.numOrigPostRepliesVisible + numNewVisibleOpReplies,
      lastApprovedReplyAt = newLastApprovedReplyAt orElse pageMeta.lastApprovedReplyAt,
      lastApprovedReplyById = newLastApprovedReplyById orElse pageMeta.lastApprovedReplyById,
      bumpedAt = pageMeta.isClosed ? pageMeta.bumpedAt | Some(tx.now.toJavaDate),
      hiddenAt = newHiddenAt,
      version = pageMeta.version + 1)

    tx.updatePageMeta(newMeta, oldMeta = pageMeta, markSectionPageStale = true)
    updatePagePopularity(page.parts, tx)
  }


  def deletePost(pageId: PageId, postNr: PostNr, deletedById: UserId,
        browserIdData: BrowserIdData): Unit = {
    writeTx { (tx, staleStuff) =>
      deletePostImpl(pageId, postNr = postNr, deletedById = deletedById,
            browserIdData, tx, staleStuff)
    }
    refreshPageInMemCache(pageId)  ; REMOVE // auto do via [staleStuff]
  }


  def deletePostImpl(pageId: PageId, postNr: PostNr, deletedById: UserId,
        browserIdData: BrowserIdData,
        tx: SiteTx, staleStuff: StaleStuff): ChangePostStatusResult = {
    val result = changePostStatusImpl(pageId = pageId, postNr = postNr,
          action = PostStatusAction.DeletePost(clearFlags = false), userId = deletedById,
          tx = tx, staleStuff = staleStuff)

    BUG; SHOULD // delete notfs or mark deleted?  [notfs_bug]  [nice_notfs]
    // But don't delete any mod tasks — good if staff reviews, if a new member
    // posts something trollish, people read/reply/react, then hen deletes hens post.
    // Later, if undeleting, then restore the notfs? [undel_posts]

    // The caller needs to: refreshPageInMemCache(pageId) — and should be done just after tx ended.
    // EDIT: That's soon not needed, use [staleStuff] instead and [rm_cache_listeners].  CLEAN_UP

    result
  }


  def deleteVoteIfAuZ(pageId: PageId, postNr: PostNr, voteType: PostVoteType, voterId: UserId): Unit = {
    require(postNr >= PageParts.BodyNr, "TyE2ABKPGN7")

    writeTx { (tx, staleStuff) =>
      val post = tx.loadThePost(pageId, postNr = postNr)
      val voter = tx.loadTheParticipant(voterId)
      throwIfMayNotSeePost(post, Some(voter))(tx)

      val gotDeleted = tx.deleteVote(pageId, postNr = postNr, voteType, voterId = voterId)
      throwForbiddenIf(!gotDeleted, "TyE50MWW14",
            s"No $voteType vote by ${voter.nameHashId} on post id ${post.id} to delete")

      // Don't delete — for now. Because that'd result in many emails
      // getting sent, if someone toggles a Like on/off.  [toggle_like_email]
      // Later: Soft delete the like?
      // Maybe not delete if seen?  [nice_notfs] Annoying if one wants to find
      // the post, and knows there was a notf but the notf is gone!
      /*
      tx.deleteAnyNotification(
            NotificationToDelete.ToOneMember(
                siteId = siteId, uniquePostId = post.id, toUserId = post.createdById,
                notfType = NotificationType.OneLikeVote))
              */

      updatePageAndPostVoteCounts(post, tx)
      updatePagePopularity(newPageDao(pageId, tx).parts, tx)
      addUserStats(UserStats(post.createdById, numLikesReceived = -1, mayBeNegative = true))(tx)
      addUserStats(UserStats(voterId, numLikesGiven = -1, mayBeNegative = true))(tx)

      /* SECURITY vote-FRAUD SHOULD delete by cookie too, like I did before:
      var numRowsDeleted = 0
      if ((userIdData.anyGuestId.isDefined && userIdData.userId != UnknownUser.Id) ||
        userIdData.anyRoleId.isDefined) {
        numRowsDeleted = deleteVoteByUserId()
      }
      if (numRowsDeleted == 0 && userIdData.browserIdCookie.isDefined) {
        numRowsDeleted = deleteVoteByCookie()
      }
      if (numRowsDeleted > 1) {
        die("TyE8GCH0", o"""Too many votes deleted, page `$pageId' post `$postId',
          user: $userIdData, vote type: $voteType""")
      }
      */

      // Page version in db bumped by updatePageAndPostVoteCounts() above.
      staleStuff.addPageId(pageId, memCacheOnly = true)
    }
  }


  def addVoteIfAuZ(pageId: PageId, postNr: PostNr, voteType: PostVoteType,
        voterId: UserId, voterIp: Opt[IpAdr], postNrsRead: Set[PostNr]): Unit = {
    require(postNr >= PageParts.BodyNr, "TyE5WKAB20")

    writeTx { (tx, staleStuff) =>
      val page = newPageDao(pageId, tx)
      val voter = tx.loadTheParticipant(voterId)
      SECURITY // minor. Should be if-may-not-see-*post*. And should do a pre-check in VoteController.
      throwIfMayNotSeePage(page, Some(voter))(tx)

      val post = page.parts.thePostByNr(postNr)

      if (voteType == PostVoteType.Bury && !voter.isStaffOrFullMember &&  // [7UKDR10]
          page.meta.authorId != voterId)
        throwForbidden("DwE2WU74", "Only staff, full members and the page author may Bury-vote")

      if (voteType == PostVoteType.Unwanted && !voter.isStaffOrCoreMember)  // [4DKWV9J2]
        throwForbidden("DwE5JUK0", "Only staff and core members may Unwanted-vote")

      if (voteType == PostVoteType.Like) {
        if (post.createdById == voterId)
          throwForbidden("DwE84QM0", "Cannot like own post")
      }

      try {
        tx.insertPostAction(
          PostVote(post.id, pageId = post.pageId, postNr = post.nr, doneAt = tx.now,
            voterId = voterId, voteType))
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
          val ancestorNrs = page.parts.ancestorsParentFirstOf(postNr).map(_.nr)
          postNrsRead -- ancestorNrs.toSet
        }
        else {
          // The post got a non-like vote: wrong, bury or unwanted.
          // This should result in only the downvoted post
          // being marked as read, because a post *not* being downvoted shouldn't
          // give that post worse rating. (Remember that the rating of a post is
          // roughly the number of Like votes / num-times-it's-been-read.)
          Set(postNr)
        }

      tx.updatePostsReadStats(pageId, postsToMarkAsRead, readById = voterId,
            readFromIp = voterIp)
      updatePageAndPostVoteCounts(post, tx)
      updatePagePopularity(page.parts, tx)
      addUserStats(UserStats(post.createdById, numLikesReceived = 1))(tx)
      addUserStats(UserStats(voterId, numLikesGiven = 1))(tx)

      if (voterId != SystemUserId && voteType == PostVoteType.Like) {
        val oldLikeNotfs = tx.loadNotificationsAboutPost(   // [toggle_like_email]
              postId = post.id, NotificationType.OneLikeVote,
              toPpId = Some(post.createdById))
        if (oldLikeNotfs.nonEmpty) {
          // For now: Don't send more Like notfs about this post — that might be
          // too noisy? Later, add config values  [nice_notfs], e.g. get notified
          // about the 2nd Like and then daily, then max weekly or monthly, maybe?
          // Later:
          // Gen a notf if the person being replied to (if any), likes this post.
          // So that Like votes can work as a succinct "Thanks!" end of the discussion,
          // without any noisy extra "Thanks" posts (just a Like vote + notf).
        }
        else {
          tx.loadParticipant(post.createdById).getOrBugWarn("TyE306RKTD63") { pp =>
            val notifications = notfGenerator(tx).generateForLikeVote(
                  post, upvotedPostAuthor = pp, voter = voter,
                  inCategoryId = page.meta.categoryId)
            tx.saveDeleteNotifications(notifications)
          }
        }

        // Test:  modn-from-disc-page-review-after  TyTE2E603RKG4.TyTE2E5ART25
        maybeReviewAcceptPostByInteracting(post, moderator = voter,
              ReviewDecision.InteractLike)(tx, staleStuff)
      }

      // Page version in db updated by updatePageAndPostVoteCounts() above.
      staleStuff.addPageId(pageId, memCacheOnly = true)
    }
  }


  RENAME // all ... IfAuth to IfAuZ (if authorized)
  def movePostIfAuth(whichPost: PagePostId, newParent: PagePostNr, moverId: UserId,
        browserIdData: BrowserIdData): (Post, JsObject) = {

    if (newParent.postNr == PageParts.TitleNr)
      throwForbidden("EsE4YKJ8_", "Cannot place a post below the title")

    val now = globals.now()

    val postAfter = writeTx { (tx, staleStuff) =>
      val mover = tx.loadTheUser(moverId)
      if (!mover.isStaff)
        throwForbidden("EsE6YKG2_", "Only staff may move posts")

      val postToMove = tx.loadThePost(whichPost.postId)
      if (postToMove.nr == PageParts.TitleNr || postToMove.nr == PageParts.BodyNr)
        throwForbidden("EsE7YKG25_", "Cannot move page title or body")

      val newParentPost = tx.loadPost(newParent) getOrElse throwForbidden(
        "EsE7YKG42_", "New parent post not found")

      throwForbiddenIf(postToMove.id == newParentPost.id,
            "TyE7SRJ2MG_", "A post cannot be its own parent post")

      throwForbiddenIf(!newParentPost.isOrigPost && newParentPost.tyype != postToMove.tyype,
        "TyE8KWEL24", "The new parent post is in a different page section. " +
          "Use the 'Move to X section' button instead")

      throwForbiddenIf(postToMove.deletedStatus.isDeleted,
            "TyE50GKJ34", "Post deleted")

      throwForbiddenIf(newParentPost.deletedStatus.isDeleted,
            "TyE8KFG1J", "New parent post deleted")

      dieIf(postToMove.collapsedStatus.isCollapsed, "EsE5KGV4", "Unimpl")
      dieIf(postToMove.closedStatus.isClosed, "EsE9GKY03", "Unimpl")
      dieIf(newParentPost.collapsedStatus.isCollapsed, "EsE7YKG32", "Unimpl")
      dieIf(newParentPost.closedStatus.isClosed, "EsE2GLK83", "Unimpl")

      val fromPage = newPageDao(postToMove.pageId, tx)
      val toPage = newPageDao(newParent.pageId, tx)

      // Don't create cycles.
      TESTS_MISSING // try to create a cycle?  tested here?: [TyTMOVEPOST692]
      if (newParentPost.pageId == postToMove.pageId) {
        val ancestorsOfNewParent = fromPage.parts.ancestorsParentFirstOf(newParentPost.nr)
        if (ancestorsOfNewParent.exists(_.id == postToMove.id))
          throwForbidden("EsE7KCCL_", o"""Cannot move a post to after one of its descendants
                — doing that, would create a cycle""")
        // Note that moving the post to one of its ancestors (instead of descendants),
        // cannot create a cycle.
      }

      val moveTreeAuditEntry = AuditLogEntry(
        siteId = siteId,
        id = AuditLogEntry.UnassignedId,
        didWhat = AuditLogEntryType.MovePost,
        doerId = moverId,
        doneAt = now.toJavaDate,
        browserIdData = browserIdData,
        pageId = Some(postToMove.pageId),
        uniquePostId = Some(postToMove.id),
        postNr = Some(postToMove.nr),
        targetPageId = Some(newParentPost.pageId),
        targetUniquePostId = Some(newParentPost.id),
        targetPostNr = Some(newParentPost.nr))

      val postAfter =
        if (postToMove.pageId == newParentPost.pageId) {
          val postAfter = postToMove.copy(parentNr = Some(newParentPost.nr))
          tx.updatePost(postAfter)
          // (Need not reindex.)
          tx.insertAuditLogEntry(moveTreeAuditEntry)
          postAfter
        }
        else {
          tx.deferConstraints()
          tx.startAuditLogBatch()

          val descendants = fromPage.parts.descendantsOf(postToMove.nr)
          val newNrsMap = mutable.HashMap[PostNr, PostNr]()
          val firstFreePostNr = toPage.parts.highestReplyNr.map(_ + 1) getOrElse FirstReplyNr
          var nextPostNr = firstFreePostNr
          newNrsMap.put(postToMove.nr, nextPostNr)
          for (descendant <- descendants) {
            nextPostNr += 1
            newNrsMap.put(descendant.nr, nextPostNr)
          }

          val postAfter = postToMove.copy(
            pageId = newParentPost.pageId,
            nr = firstFreePostNr,
            parentNr = Some(newParentPost.nr))

          val postsAfter = ArrayBuffer[Post](postAfter)
          val auditEntries = ArrayBuffer[AuditLogEntry](moveTreeAuditEntry)

          descendants foreach { descendant =>
            val descendantAfter = descendant.copy(
              pageId = toPage.id,
              nr = newNrsMap.get(descendant.nr) getOrDie "EsE7YKL32",
              parentNr = Some(newNrsMap.get(
                descendant.parentNr getOrDie "EsE8YKHF2") getOrDie "EsE2PU79"))
            postsAfter += descendantAfter
            auditEntries += AuditLogEntry(
              siteId = siteId,
              id = AuditLogEntry.UnassignedId,
              didWhat = AuditLogEntryType.MovePost,
              doerId = moverId,
              doneAt = now.toJavaDate,
              browserIdData = browserIdData,
              pageId = Some(descendant.pageId),
              uniquePostId = Some(descendant.id),
              postNr = Some(descendant.nr),
              targetPageId = Some(descendantAfter.pageId))
              // (leave target post blank — we didn't place decendantAfter at any
              // particular post on the target page)
          }

          postsAfter foreach tx.updatePost
          tx.indexPostsSoon(postsAfter: _*)

          // Uncache backlinked pages. [uncache_blns]
          // (Need not update links_t or upload_refs3, because links and upload refs
          // are from *posts* not from *pages*.)
          //
          // Note: If moving posts within the same page:
          // Even if moved to elsewhere *on the same page*,
          // it's good to refresh any linked pages – in case the posts somehow
          // got moved to an access restricted location on the same page,
          // say, placed as replies to a tree-deleted ancestor post.
          //
          // Note: If moving posts to a different page:
          // Even if there're other posts on the old page that still
          // link to a page P, also after the posts got moved, we might still need
          // to uncache page P, because now afterwards if the posts got moved to
          // a different page, that new page now also links to P.
          //
          val linkedPageIds = tx.loadPageIdsLinkedFromPosts(postsAfter.map(_.id).toSet)
          staleStuff.addPageIds(linkedPageIds, backlinksStale = true)

          COULD // if target page is deleted, or in a deleted category,
          // then remove upl refs, or mark as deleted?  [rm_upl_refs]

          auditEntries foreach tx.insertAuditLogEntry
          tx.movePostsReadStats(fromPage.id, toPage.id, Map(newNrsMap.toSeq: _*))
          // Mark both fromPage and toPage sections as stale, in case they're different forums.
          refreshPageMetaBumpVersion(fromPage.id, markSectionPageStale = true, tx)
          refreshPageMetaBumpVersion(toPage.id, markSectionPageStale = true, tx)

          postAfter
        }

      staleStuff.addPageIds(
            // Page versions bumped just above — only need to refresh mem cache.
            Set(fromPage.id, toPage.id), memCacheOnly = true)

      // Would be good to [save_post_lns_mentions], so wouldn't need to recompute here.
      val notfs = notfGenerator(tx).generateForNewPost(
            toPage, postAfter, sourceAndHtml = None,
            anyNewModTask = None, skipMentions = true)
      SHOULD // tx.saveDeleteNotifications(notfs) — but would cause unique key errors

      postAfter
    }

    val storePatch = jsonMaker.makeStorePatchForPostIds(
          Set(postAfter.id), showHidden = true, inclUnapproved = true, dao = this)

    (postAfter, storePatch)
  }


  def loadThingsToReview(): ThingsToReview = {
    readOnlyTransaction { tx =>
      val posts = tx.loadPostsToReview()
      val pageMetas = tx.loadPageMetas(posts.map(_.pageId))
      val flags = tx.loadFlagsFor(posts.map(_.pagePostNr))
      val userIds = mutable.HashSet[UserId]()
      userIds ++= posts.map(_.createdById)
      userIds ++= posts.map(_.currentRevisionById)
      userIds ++= flags.map(_.flaggerId)
      val users = tx.loadParticipants(userIds.toSeq)
      ThingsToReview(posts, pageMetas, users, flags)
    }
  }


  /** Returns all posts hidden as a result of this flag — which might be many, because
    * the flag might result in the computer believing the user is Bad, and hide all hens posts.
    */
  def flagPost(pageId: PageId, postNr: PostNr, flagType: PostFlagType, flaggerId: UserId)
        : immutable.Seq[Post] = {
    val (postAfter, wasHidden) = doFlagPost(pageId, postNr, flagType, flaggerId = flaggerId)
    var postsHidden = ifBadAuthorCensorEverything(postAfter)
    if (wasHidden) {
      postsHidden :+= postAfter
      refreshPageInMemCache(pageId)
    }
    postsHidden
  }


  private def doFlagPost(pageId: PageId, postNr: PostNr, flagType: PostFlagType,
        flaggerId: UserId): (Post, Boolean) = {
    writeTx { (tx, staleStuff) =>
      val flagger = tx.loadTheUser(flaggerId)
      val postBefore = tx.loadThePost(pageId, postNr)
      val pageMeta = tx.loadThePageMeta(pageId)
      val categories = tx.loadCategoryPathRootLast(pageMeta.categoryId, inclSelfFirst = true)
      val settings = loadWholeSiteSettings(tx)

      dieOrThrowNoUnless(Authz.mayFlagPost(
        flagger, tx.loadGroupIdsMemberIdFirst(flagger),
        postBefore, pageMeta, tx.loadAnyPrivateGroupTalkMembers(pageMeta),
        inCategoriesRootLast = categories,
        tooManyPermissions = tx.loadPermsOnPages()), "EdEZBXKSM2")

      dieIf(postBefore.isDeleted, "TyE2FKG69")
      dieIf(pageMeta.isDeleted, "TyE4FKBFA2")

      val newNumFlags = postBefore.numPendingFlags + 1
      var postAfter = postBefore.copy(numPendingFlags = newNumFlags)

      val reviewTask = createOrAmendOldReviewTask(flaggerId, postAfter,
        immutable.Seq(ReviewReason.PostFlagged), tx)

      // Hide post, update page?
      val shallHide = newNumFlags >= settings.numFlagsToHidePost && !postBefore.isBodyHidden
      if (shallHide) {
        hidePostsOnPage(Vector(postAfter), pageId,
              "This post was flagged")(tx, staleStuff) ; I18N
        bugWarnIf(!staleStuff.includesPageModified(pageId), "TyU305RKD")
      }
      else {
        tx.updatePost(postAfter)
        // Need not: staleStuff.addPageId(pageId)
        // because the page caches don't care about flags — only staff can see.
      }

      tx.insertPostAction(
        PostFlag(postBefore.id, pageId = pageId, postNr = postNr,
          doneAt = tx.now, flaggerId = flaggerId, flagType = flagType))
      tx.upsertReviewTask(reviewTask)
      (postAfter, shallHide)
    }
  }


  /** Hides all posts this user has made, if s/he is a new user that gets flagged a lot.
    */
  private def ifBadAuthorCensorEverything(post: Post): immutable.Seq[Post] = {
    val userId = post.createdById
    val pageIdsToRefresh = mutable.Set[PageId]()
    val postsHidden = writeTx { (tx, staleStuff) =>
      val user = tx.loadParticipant(userId) getOrDie "EdE6FKW02"
      if (!user.effectiveTrustLevel.isStrangerOrNewMember)
        return Nil

      // Keep small, there's an O(n^2) loop below (6WKUT02).
      val numThings = 100
      val settings = loadWholeSiteSettings(tx)

      // For members, we'll use the user id.  For guests, we'll use the browser-ip & -id-cookie.
      var anyBrowserIdData: Option[BrowserIdData] = None
      def theBrowserIdData = anyBrowserIdData getOrDie "EdE5RW2EB8"
      var guestPostIds = Set[PostId]()

      var tasks =
        if (user.isMember) {
          tx.loadReviewTasksAboutUser(user.id, limit = numThings,
            orderBy = OrderBy.MostRecentFirst)
        }
        else {
          val auditLogEntry = tx.loadCreatePostAuditLogEntry(post.id) getOrElse {
            // Audit log data apparently deleted, so cannot find out if the guest author is bad.
            return Nil
          }
          anyBrowserIdData = Some(auditLogEntry.browserIdData)
          guestPostIds = loadPostIdsByGuestBrowser(theBrowserIdData, limit = numThings,
              orderBy = OrderBy.MostRecentFirst)(tx)
          tx.loadReviewTasksAboutPostIds(guestPostIds)
        }

      tasks = tasks.filter(_.reasons.contains(ReviewReason.PostFlagged))

      // If lots of flags are incorrect, then don't censor the user, at this time.
      val numResolvedFine = tasks.count(_.decision.exists(_.isFine))
      val numResolvedBad = tasks.count(_.decision.exists(_.isRejectionBadUser))
      if (numResolvedFine >= math.max(1, numResolvedBad))
        return Nil

      // If there are too few flags, or too few distinct human flaggers, don't censor the user.
      val maybeBadTasks = tasks.filter(!_.decision.exists(_.isFine))
      val manyFlags = maybeBadTasks.size >= settings.numFlagsToBlockNewUser
      val flaggersMaybeInclSystem = maybeBadTasks.map(_.createdById).toSet
      val numFlaggersExclSystem = (flaggersMaybeInclSystem - SystemUserId).size
      val manyFlaggers = numFlaggersExclSystem >= settings.numFlaggersToBlockNewUser
      if (!manyFlags || !manyFlaggers)
        return Nil

      // Block the user.
      if (user.isMember) {
        COULD_OPTIMIZE // edit & save the user directly [6DCU0WYX2]
        val member = tx.loadUserInclDetails(user.id) getOrDie "EdE5KW0U4"
        val memberAfter = member.copyWithMaxThreatLevel(ThreatLevel.ModerateThreat)
        tx.updateUserInclDetails(memberAfter)
      }
      else {
        blockGuestImpl(theBrowserIdData, user.id, numDays = 31,
          threatLevel = ThreatLevel.ModerateThreat, blockerId = SystemUserId)(tx)
      }

      SECURITY ; BUG // minor: if the author has posted > numThings post, only the most recent ones
      // will get hidden here, because we loaded only the most recent ones, above.
      // — However, new users are rate limited, so not super likely to happen.

      // Find the user's posts — we'll hide them.
      // (The whole page gets hidden by hidePostsOnPage() below, if all posts get hidden.)
      val postsToMaybeHide =
        if (user.isMember) {
          tx.loadPostsByQuery(limit = numThings, OrderBy.MostRecentFirst,
                byUserId = Some(userId), includeTitlePosts = false,
                inclUnapprovedPosts = true, inclUnlistedPagePosts_unimpl = true)
                .filter(!_.isBodyHidden)
        }
        else {
          tx.loadPostsByUniqueId(guestPostIds).values.filter(p =>
                !p.isBodyHidden && !p.isTitle)
        }

      // Don't hide posts that have been reviewed and deemed okay.
      // (Hmm, could hide them anyway if they were edited later ... oh now gets too complicated.)
      val postsToHide = postsToMaybeHide filter { post =>
        // This is O(n^2), so keep numThings small (6WKUT02), like <= 100.
        val anyReviewTask = tasks.find(_.postId.contains(post.id))
        !anyReviewTask.exists(_.decision.exists(_.isFine))
      }

      val postToHideByPage = postsToHide.groupBy(_.pageId)
      for ((pageId, posts) <- postToHideByPage) {
        hidePostsOnPage(posts, pageId, "Many posts by this author got flagged, hiding all")(
              tx, staleStuff)
        bugWarnIf(!staleStuff.includesPageModified(pageId), "TyE304RK5B3")
        pageIdsToRefresh += pageId  ; CLEAN_UP; REMOVE // not needed now with staleStuff
      }

      postsToHide
    }

    removeUserFromMemCache(userId)
    pageIdsToRefresh.foreach(refreshPageInMemCache)  ; REMOVE // not needed now with staleStuff
    postsHidden.to[immutable.Seq]
  }


  /** Finds posts created by a certain browser, by searching for create-post audit log entries
    * by that browser (ip address and browser-id-cookie, perhaps fingerprint later).
    */
  private def loadPostIdsByGuestBrowser(browserIdData: BrowserIdData, limit: Int,
        orderBy: OrderBy)(tx: SiteTransaction): Set[PostId] = {
    val manyEntries = tx.loadCreatePostAuditLogEntriesBy(
      browserIdData, limit = limit, orderBy)
    val fewerEntries = manyEntries filter { entry =>
      Participant.isGuestId(entry.doerId) && !entry.postNr.contains(PageParts.TitleNr)
    }
    fewerEntries.flatMap(_.uniquePostId).toSet
  }


  def hidePostsOnPage(posts: Iterable[Post], pageId: PageId, reason: String)(
        tx: SiteTransaction, staleStuff: StaleStuff): Unit = {
    posts.find(_.pageId != pageId) foreach { post =>
      die("TyE7GKU23Y4", s"post.pageId = ${post.pageId}, but pageId = $pageId")
    }
    dieIf(posts.exists(_.isTitle), "EdE5KP0WY2")
    val postsToHide = posts.filter(!_.isBodyHidden)
    if (postsToHide.isEmpty)
      return

    val pageMetaBefore = tx.loadPageMeta(pageId) getOrDie "EdE7KP0F2"
    var numOrigPostRepliesHidden = 0
    var numRepliesHidden = 0
    var isHidingOrigPost = false

    postsToHide foreach { postBefore =>
      numOrigPostRepliesHidden += (postBefore.isVisible && postBefore.isOrigPostReply) ? 1 | 0
      numRepliesHidden += (postBefore.isVisible && postBefore.isReply) ? 1 | 0
      isHidingOrigPost ||= postBefore.isOrigPost

      val postAfter = postBefore.copy(
        bodyHiddenAt = Some(tx.now.toJavaDate),
        bodyHiddenById = Some(SystemUserId),
        bodyHiddenReason = Some(reason))

      tx.updatePost(postAfter)
    }

    var pageMetaAfter = pageMetaBefore.copy(
      numRepliesVisible = pageMetaBefore.numRepliesVisible - numRepliesHidden,
      numOrigPostRepliesVisible =
          pageMetaBefore.numOrigPostRepliesVisible - numOrigPostRepliesHidden)

    // If none of the posts were visible (e.g. because deleted already), we don't need
    // to update the page meta.
    if (pageMetaAfter != pageMetaBefore || isHidingOrigPost) {
      pageMetaAfter = pageMetaAfter.copy(version = pageMetaBefore.version + 1)

      // Hide page if everything on it hidden.
      if (!pageMetaBefore.isHidden && pageMetaAfter.numRepliesVisible == 0) {
        val willOrigPostBeVisible = if (isHidingOrigPost) false else {
          val anyOrigPost = tx.loadOrigPost(pageId)
          anyOrigPost.exists(_.isVisible)
        }
        if (!willOrigPostBeVisible) {
          pageMetaAfter = pageMetaAfter.copy(hiddenAt = Some(tx.now))
        }
      }

      tx.updatePageMeta(pageMetaAfter, oldMeta = pageMetaBefore,
        // The page might be hidden now, or num-replies has changed, so refresh forum topic list.
        markSectionPageStale = true)
      updatePagePopularity(newPageDao(pageId, tx).parts, tx)

      staleStuff.addPageId(pageId, memCacheOnly = true) // page version bumped above
      // Uncache backlinks on linked pages. [uncache_blns]
      val linkedPageIds = tx.loadPageIdsLinkedFromPosts(postsToHide.map(_.id).toSet)
      staleStuff.addPageIds(linkedPageIds, pageModified = false, backlinksStale = true)
    }
  }


  def clearFlags(pageId: PageId, postNr: PostNr, clearedById: UserId): Unit = {
    readWriteTransaction { tx =>
      val clearer = tx.loadTheParticipant(clearedById)
      if (!clearer.isStaff)
        throwForbidden("EsE7YKG59", "Only staff may clear flags")

      val postBefore = tx.loadThePost(pageId, postNr)
      val postAfter = postBefore.copy(
        numPendingFlags = 0,
        numHandledFlags = postBefore.numHandledFlags + postBefore.numPendingFlags)
      tx.updatePost(postAfter)
      tx.clearFlags(pageId, postNr, clearedById = clearedById)
      // Need not update page version: flags aren't shown (except perhaps for staff users).
    }
    // In case the post gets unhidden now when flags gone:
    refreshPageInMemCache(pageId)
  }


  def loadPostsReadStats(pageId: PageId): PostsReadStats =
    readOnlyTransaction(_.loadPostsReadStats(pageId))


  def loadAuthorIdsByPostId(postIds: Set[PostId]): Map[PostId, UserId] =
    readOnlyTransaction(_.loadAuthorIdsByPostId(postIds))


  def loadPostByPageIdNr(pageId: PageId, postNr: PostNr): Option[Post] =
    loadPost(pageId, postNr)


  def loadPost(pageId: PageId, postNr: PostNr): Option[Post] =  // RENAME to loadPostByPageIdNr just above
    readOnlyTransaction(_.loadPost(pageId, postNr))


  def loadPostByUniqueId(postId: PostId): Option[Post] =
    readOnlyTransaction(_.loadPostsByUniqueId(Vector(postId))).values.headOption


  /** Finds all of postNrs. If any single one (or more) is missing, returns Error. */
  def loadPostsAllOrError(pageId: PageId, postNrs: Iterable[PostNr])
        : immutable.Seq[Post] Or One[PostNr] =
    readOnlyTransaction { tx =>
      val posts = tx.loadPostsByNrs(postNrs.map(PagePostNr(pageId, _)))
      dieIf(posts.length > postNrs.size, "EdE2WBR57")
      if (posts.length < postNrs.size) {
        val firstMissing = postNrs.find(nr => !posts.exists(_.nr == nr)) getOrDie "EdE7UKYWJ2"
        return Bad(One(firstMissing))
      }
      Good(posts)
    }


  def loadPostsMaySeeByQuery(
          requester: Option[Participant], orderBy: OrderBy, limit: Int,
          inclTitles: Boolean, onlyEmbComments: Boolean, inclUnapprovedPosts: Boolean,
          inclUnlistedPagePosts: Boolean,
          writtenById: Option[UserId]): LoadPostsResult = {

    unimplementedIf(orderBy != OrderBy.MostRecentFirst,
          "Only most recent first supported [TyE403RKTJ]")

    val postsInclForbidden = readOnlyTransaction { tx =>
      if (onlyEmbComments) {
        dieIf(inclTitles, "TyE503RKDP5", "Emb cmts have no titles")
        dieIf(inclUnapprovedPosts, "TyE503KUTRT", "Emb cmts + unapproved")
        dieIf(writtenById.isDefined, "TyE703RKT3M", "Emb cmts + writtenBy unimpl")
        // Embedded discussions are typically unlisted, so strangers
        // cannot super easily list all discussions over at the Talkyard site
        // (but via the Atom feed, it's ok to list the most recent comments).
        dieIf(!inclUnlistedPagePosts, "TyE520ATJ3", "Emb cmts + *no* unlisted")

        tx.loadEmbeddedCommentsApprovedNotDeleted(limit = limit, orderBy)
      }
      else {
        tx.loadPostsByQuery(
              limit = limit, orderBy, byUserId = writtenById,
              includeTitlePosts = inclTitles, inclUnapprovedPosts = inclUnapprovedPosts,
              // inclUnlistedPagePosts_unimpl here has no effect, not implemented,
              // but there's a filter below in the for { ... }.
              inclUnlistedPagePosts_unimpl = inclUnlistedPagePosts)
      }
    }

    val pageIdsInclForbidden = postsInclForbidden.map(_.pageId).toSet
    val pageMetaById = getPageMetasAsMap(pageIdsInclForbidden)

    val postsOneMaySee = for {
      post <- postsInclForbidden
      pageMeta <- pageMetaById.get(post.pageId)
      maySee = maySeePostUseCache(
            post, pageMeta, ppt = requester, maySeeUnlistedPages = inclUnlistedPagePosts)
      if  maySee._1.may
    }
      yield post

    val pageIds = postsOneMaySee.map(_.pageId).distinct
    val pageStuffById = getPageStuffById(pageIds) ; COULD_OPTIMIZE // reuse pageMetaById

    LoadPostsResult(postsOneMaySee, pageStuffById)
  }


  /**
    * @param post — post before actions done
    * @param tx
    */
  private def updatePageAndPostVoteCounts(post: Post, tx: SiteTransaction): U = {
    dieIf(post.nr < PageParts.BodyNr, "TyE4WKAB02")
    val actions = tx.loadActionsDoneToPost(post.pageId, postNr = post.nr)
    val readStats = tx.loadPostsReadStats(post.pageId, Some(post.nr))
    val postAfter = post.copyWithUpdatedVoteAndReadCounts(actions, readStats)

    val numNewDoIts = postAfter.numDoItVotes - post.numDoItVotes
    val numNewDoNots = postAfter.numDoNotVotes - post.numDoNotVotes
    val numNewLikes = postAfter.numLikeVotes - post.numLikeVotes
    val numNewWrongs = postAfter.numWrongVotes - post.numWrongVotes
    val numNewBurys = postAfter.numBuryVotes - post.numBuryVotes
    val numNewUnwanteds = postAfter.numUnwantedVotes - post.numUnwantedVotes

    val (numNewOpDoIts, numNewOpDoNots, numNewOpLikes, numNewOpWrongs,
          numNewOpBurys, numNewOpUnwanteds) =
      if (post.isOrigPost)
        (numNewDoIts, numNewDoNots, numNewLikes, numNewWrongs,
          numNewBurys, numNewUnwanteds)
      else
        (0, 0, 0, 0, 0, 0)

    val pageMetaBefore = tx.loadThePageMeta(post.pageId)
    val pageMetaAfter = pageMetaBefore.copy(
      numLikes = pageMetaBefore.numLikes + numNewLikes,
      numWrongs = pageMetaBefore.numWrongs + numNewWrongs,
      numBurys = pageMetaBefore.numBurys + numNewBurys,
      numUnwanteds = pageMetaBefore.numUnwanteds + numNewUnwanteds,
      // For now: use max() because the db fields were just added so some counts are off.
      // (but not for Do-It, Do-Not, Unwanted — they got added after the vote count fields)
      numOrigPostDoItVotes = pageMetaBefore.numOrigPostDoItVotes + numNewOpDoIts,
      numOrigPostDoNotVotes = pageMetaBefore.numOrigPostDoNotVotes + numNewOpDoNots,
      numOrigPostLikeVotes = math.max(0, pageMetaBefore.numOrigPostLikeVotes + numNewOpLikes),
      numOrigPostWrongVotes = math.max(0, pageMetaBefore.numOrigPostWrongVotes + numNewOpWrongs),
      numOrigPostBuryVotes = math.max(0, pageMetaBefore.numOrigPostBuryVotes + numNewOpBurys),
      numOrigPostUnwantedVotes = pageMetaBefore.numOrigPostUnwantedVotes + numNewOpUnwanteds,
      version = pageMetaBefore.version + 1)

    // (Don't reindex)
    tx.updatePost(postAfter)
    tx.updatePageMeta(pageMetaAfter, oldMeta = pageMetaBefore, markSectionPageStale = true)

    // COULD split e.g. num_like_votes into ..._total and ..._unique? And update here.
  }

}



object PostsDao {

  private val SixMinutesMs = 6 * 60 * 1000
  private val OneHourMs = SixMinutesMs * 10
  private val OneDayMs = OneHourMs * 24

  val HardMaxNinjaEditWindowMs: Int = OneDayMs

  /** For non-discussion pages, uses a long ninja edit window.
    */
  def ninjaEditWindowMsFor(pageRole: PageType): Int = pageRole match {
    case PageType.CustomHtmlPage => OneHourMs
    case PageType.WebPage => OneHourMs
    case PageType.Code => OneHourMs
    case PageType.SpecialContent => OneHourMs
    case PageType.Blog => OneHourMs
    case PageType.Forum => OneHourMs
    case _ => SixMinutesMs
  }


  def createOrAmendOldReviewTask(createdById: UserId, post: Post, reasons: immutable.Seq[ReviewReason],
        tx: SiteTransaction): ReviewTask = {
    val pendingTask = tx.loadUndecidedPostReviewTask(post.id, taskCreatedById = createdById)
    // At other places, we incl a page id, if post.isOrigPost,
    // doesn't matter? Previously there was a bug though: [revw_task_pgid].
    val newTask = ReviewTask(
      id = pendingTask.map(_.id).getOrElse(tx.nextReviewTaskId()),
      reasons = reasons,
      createdById = createdById,
      createdAt = tx.now.toJavaDate,
      createdAtRevNr = Some(post.currentRevisionNr),
      maybeBadUserId = post.createdById,
      postId = Some(post.id),
      postNr = Some(post.nr))
    newTask.mergeWithAny(pendingTask)
  }

}

