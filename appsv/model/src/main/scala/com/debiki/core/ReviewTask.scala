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

package com.debiki.core

import com.debiki.core.Prelude._
import java.{util => ju}


/**
  * @param updatedPosts — if the moderation decision affected some posts, e.g.
  *  a post got approved and un-hidden, or it got deleted, or all posts by
  *  this author got deleted (if banning a spammer).
  * @param updatedAuthor — later: If the mod decision affected the post *author*,
  *  e.g. hens [[ThreatLevel]] changed.
  * @param deletedPageIds — if some pages got deleted, e.g. new user banned, and
  *   all hans pages (say, spam) got deleted.
  */
case class ModResult(
  updatedPosts: Seq[Post],
  updatedAuthor: Opt[Pat],
  deletedPageIds: Set[PageId] = Set.empty,
  bannedPat: Opt[Pat] = None) {

  def add(more: ModResult): ModResult = {
    val thisPostIds = this.updatedPosts.map(_.id).toSet
    val newPosts = more.updatedPosts.filterNot(p => thisPostIds.contains(p.id))
    // Not currently supposed to happen:  (but `this.bannedPat.isDefined` is fine)
    dieIf(more.updatedAuthor.isDefined, "TyE703SKSJM")
    dieIf(more.bannedPat.isDefined, "TyE703SKSJK")
    this.copy(
          updatedPosts = this.updatedPosts ++ newPosts,
          deletedPageIds = this.deletedPageIds ++ more.deletedPageIds)
  }
}

object ModResult {
  val NothingChanged = ModResult(Nil, None)
}


case class ReviewTaskCounts(numUrgent: Int, numOther: Int)


sealed abstract class ReviewDecision(val IntVal: Int) {  // RENAME to ModDecision
                                // (else confusing with  approve-before and *review*-after)
  def toInt: Int = IntVal
  def isFine: Boolean = IntVal <= ReviewDecision.LastAcceptId
  def isRejectionBadUser: Boolean = IntVal >= ReviewDecision.FirstBadId
}


object ReviewDecision {

  /* This undo is if one accidentally clicked the wrong button — one should notice that
   * in a few seconds, so 12 is fairly much?
   */
  val UndoTimoutSeconds = 12 // sync with Typescript [2PUKQB0]

  // 1nnn = Accept
  case object Accept extends ReviewDecision(1001)

  // Need more granularity:   [apr_movd_orig_post]
  // AcceptNewPost
  // RejectNewPost
  // AcceptNewPage
  // RejectNewPage
  // AcceptEdits
  // RejectEdits


  // 12nn = Accept review-after mod task implicitly, by interacting:

  val FirsInteractAcceptId = 1201
  val LastInteractAcceptId = 1299

  /** If staff edits a new post, but doesn't delete it — let's handle that
    * as accepting it. But remember this was via an edit —
    * that's more informal (maybe even a tiny bit error / mistake prone)
    * than clicking Accept on the Moderation page.
    */
  case object InteractEdit extends ReviewDecision(1201)

  /** New post accepted if replying and talking with the person. */
  case object InteractReply extends ReviewDecision(1202)

  /** Both question topic and answer posts accepted implicitly, if marking
    * the answer post as a solution. */
  case object InteractAcceptAnswer extends ReviewDecision(1205)

  /** New post review-accepted if changing it to a Wiki post. */
  case object InteractWikify extends ReviewDecision(1207)

  /** Topic accepted implicitly if changing doing-status, e.g. from New to Planned. */
  // Later.
  //case object InteractTopicDoingStatus extends ReviewDecision(1221)

  /** New post accepted if Like-voting it. */
  case object InteractLike extends ReviewDecision(1241)
  require(InteractLike.IntVal == PostVoteType.Like.IntVal + 1200)


  /** Marks a post or edit that's already visible, but pending review-after-the-fact, as ok,
    * but without actually reviewing it.
    *
    * This is helpful for corner case communities that have 999+ pending review tasks,
    * because they use sth else than Talkyard to approve their users before they can join
    * the forum, but Talkyard still kept generating review tasks.
    *
    * Edit: Yes, let's accept those too. Otherwise too complicated! Is a rare
    * corner case anyway.  Old:
    *      However, won't accept *unapproved* posts, that is, posts that aren't
    *      yet visible at all
    */
  case object AcceptUnreviewedId extends ReviewDecision(1993)

  private val LastAcceptId = 1999

  // 3nnn = Request changes.
  // ... later ...

  // nnnn = postpone until later somehow? Maybe a reminder the next day


  // 5nnn = Reject.
  private val FirstBadId = 5000
  case object DeletePostOrPage extends ReviewDecision(5001)
  case object DeleteAndBanSpammer extends ReviewDecision(5501)



  def fromInt(value: Int): Option[ReviewDecision] = Some(value match {
    case Accept.IntVal => Accept
    case InteractEdit.IntVal => InteractEdit
    case InteractReply.IntVal => InteractReply
    case InteractAcceptAnswer.IntVal => InteractAcceptAnswer
    case InteractWikify.IntVal => InteractWikify
    //case InteractTopicDoingStatus.IntVal => InteractTopicDoingStatus
    case InteractLike.IntVal => InteractLike
    case AcceptUnreviewedId.IntVal => AcceptUnreviewedId
    case DeletePostOrPage.IntVal => DeletePostOrPage
    case DeleteAndBanSpammer.IntVal => DeleteAndBanSpammer
    case _ => return None
  })
}


/** Means that something should be reviewed, e.g. a post or a user should be reviewed.
  *
  * @param createdById The user that created the review task, e.g. someone who flagged a post.
  *   Is part of a unique key. So if, for example, someone posts spam, and two different people
  *   flag the spam post — then three review tasks might get created: one with causedById =
  *   the system user, with review-reason = spam-detected. And one for each flagger; these
  *   tasks will have review reason = post-was-flagged-as-spamm.
  * @param decidedAt When an admin makse a review decision, the review task isn't
  *   completed immediately. Instead, it's scheduled to happen maybe 10 seconds into the future.
  *   And if the admin clicks an Undo button, before these 10 seconds have elapsed,
  *   then the review decision gets cancelled.
  *   (Review decisions generally cannot be undone, [REVIEWUNDO]
  *   because after they've been made, additional posts by the same author, might
  *   get auto approved, and/or other people might reply to the approved posts, and it's
  *   not obvious what a one-click Undo would do to all those auto-approved posts and replies.)
  * @param decidedById The staff user that had a look at this review task and e.g. deleted
  *   a spam comment, or dismissed the review task if the comment was ok.
  * @param invalidatedAt If there is e.g. a review task about a comment, but the comment gets
  *   deleted, then the review task becomes invalid. Perhaps just delete the review task instead?
  *   Hmm. StackExchange has an invalidated_at field. Aha, could be useful if the comment gets
  *   undeleted — then we want the review task back again.
  * @param maybeBadUserId A user that did something possibly harmful and therefore what s/he did
  *   should be reviewed. E.g. wrote a post that got flagged. Or changed his/her avatar
  *   and his/her profile, which therefore should be reviewed.
  *   If the user is anonymous, then, this is the id of the anonym, not the real user
  *   — so mods won't accidentally learn who the anonyms are.  [anons_and_mods]
  *   Only if a post is really problematic, can the mods choose to have a look and
  *   consider suspending the real post author. Or, they'll suspend the anonym,
  *   and this can then also suspend the real author (the one behind the anonym),
  *   without the mods having to know who hen is.
  * @param pageId A new page that should be reviewed.
  * @param postId A post that should be reviewed, it might be spam for example.
  */
case class ReviewTask(  //  RENAME to ModTask
                        // (else confusing with  approve-before and *review*-after)
  id: ReviewTaskId,
  reasons: Seq[ReviewReason],
  createdById: UserId,
  createdAt: ju.Date,
  createdAtRevNr: Option[Int] = None,
  moreReasonsAt: Option[ju.Date] = None,
  //moreReasonsAtRevNr: Option[ju.Date] = None,
  decidedAt: Option[ju.Date] = None,
  completedAt: Option[ju.Date] = None,
  decidedAtRevNr: Option[Int] = None,
  decidedById: Option[UserId] = None,
  invalidatedAt: Option[ju.Date] = None,
  decision: Option[ReviewDecision] = None,
  // COULD change to a Set[UserId] and include editors too, hmm. [6KW02QS]  Or just the author +
  // the 10? most recent editors, or the 10 most recent editors (not the author) for wiki posts.
  // Or the ones who edited the post, since it was last reviewed & any flags disagreed with?
  maybeBadUserId: PatId,  // RENAME to aboutPatId
  // Only if is for both title and body (cannot currently be moved to different page).
  pageId: Option[PageId] = None,
  postId: Option[PostId] = None,
  postNr: Option[PostNr] = None) {

  // Don't test:
  // - invalidatedAt >= moreReasonsAt — because if a post got deleted, and afterwards a staff
  //   member flags it (they can see deleted posts) — then, a review reason gets added
  //   to the review task, when it is already invalidated.

  /* Forgot!: SHOULD find a way to add back? & "feat flag"? [more_runtime_assertions]
  require(decidedAt.isDefined == isDecided, "TyE62KTID46")
  require(decidedAtRevNr.isDefined == isDecided, "TyE62KTID46")
  require(decidedById.isDefined == isDecided, "TyE62KTID46")
  */


  require(reasons.nonEmpty, s"Review reasons is empty [TyE3FK21]: $this")
  require(!moreReasonsAt.exists(_.getTime < createdAt.getTime), "EsE7UGYP2")
  //require(moreReasonsAt.isDefined == moreReasonsAtRevNr.isDefined, "TyE6MKWZ8") [MOREREVRSNS]
  //require(!moreReasonsAtRevNr.exists(_ < createdAtRevNr), "TyE6MKWZ9")
  require(!decidedAt.exists(_.getTime < createdAt.getTime), "TyE6UHQ21")
  require(!completedAt.exists(_.getTime < createdAt.getTime), "EsE0YUL72")
  require(!invalidatedAt.exists(_.getTime < createdAt.getTime), "EsE5GKP2")
  require(completedAt.isEmpty || invalidatedAt.isEmpty, "EsE2FPW1")
  require((decidedAt.isEmpty && completedAt.isEmpty) || decision.isDefined, s"EsE0YUM4, task: $this")
  require(!decidedAtRevNr.exists(_ < FirstRevisionNr), "EsE1WL43")
  require(!postId.exists(_ <= 0), "EsE3GUL80")
  // pageId defined = is for title & body.
  require(pageId.isEmpty || (postId.isDefined && postNr.is(PageParts.BodyNr)), "EsE6JUM12")
  require(postId.isDefined == postNr.isDefined, "EsE6JUM13")
  require(postId.isDefined == createdAtRevNr.isDefined, "EsE5PUY0")
  require(postId.isEmpty || (
      decidedAt.isDefined || completedAt.isDefined) == decidedAtRevNr.isDefined, "EsE4PU2")


  /** If a staff member has decided what to do. However there's an undo timeout
    * — not until after that, will the decision get carried out (so doneOrGone
    * becomes true).
    */
  def isDecided: Boolean = decision.isDefined
  def isDecidedButNotBy(ppId: UserId): Boolean = isDecided && decidedById.isNot(ppId)
  def gotInvalidated: Boolean = invalidatedAt.isDefined
  def isDone: Boolean = completedAt.isDefined

  /** If the review decision has been carried out, or if the review task became obsolete. */
  def doneOrGone: Boolean = completedAt.isDefined || invalidatedAt.isDefined

  /** But what if new topic started, and staff moves the orig post to
    * a different topic where it instead becomes a reply/ Before approving it?
    * For now, don't allow moving not-yet-approved orig posts then. [apr_movd_orig_post]
    * Related to [apr_deld_post].
    */
  def isForBothTitleAndBody: Boolean = pageId.isDefined

  def mergeWithAny(anyOldTask: Option[ReviewTask]): ReviewTask = {
    val oldTask = anyOldTask getOrElse {
      return this
    }
    require(oldTask.id == this.id, "EsE4GPMU0")
    require(oldTask.completedAt.isEmpty, "EsE4FYC2")
    require(oldTask.createdById == this.createdById, "EsE6GU20")
    require(oldTask.createdAt.getTime <= this.createdAt.getTime, "EsE7JGYM2")
    require(!oldTask.moreReasonsAt.exists(_.getTime > this.createdAt.getTime), "EsE2QUX4")
    require(oldTask.maybeBadUserId == this.maybeBadUserId, "EsE5JMU1")
    require(oldTask.postId == this.postId, "EsE2UYF7")
    // Cannot add more review reasons to an already completed task.
    require(oldTask.completedAt.isEmpty, "EsE1WQC3")
    require(oldTask.invalidatedAt.isEmpty, "EsE7UGMF2")
    val newReasonsValue = ReviewReason.toLong(oldTask.reasons) | ReviewReason.toLong(this.reasons)
    val newReasonsSeq = ReviewReason.fromLong(newReasonsValue)
    this.copy(
      reasons = newReasonsSeq,
      createdAt = oldTask.createdAt,
      //createdAtRevNr = oldTask.createdAtRevNr,  [MOREREVRSNS]
      moreReasonsAt = Some(this.createdAt),
      //moreReasonsAtRevNr = Some(this.createdAtRevNr) [MOREREVRSNS]
      )
  }

}


case class ModTaskFilter(
  onlyPending: Bo,
  patId: Opt[PatId],
  usernameFilter: Opt[St],
  emailFilter: Opt[St],
  // Later: Might need a review task id offset too, if many w same timestamp (e.g.
  // if importing / generating lots of things with the same timestamp programatically).
  olderOrEqualTo: Opt[ju.Date])

object ModTaskFilter {
  val Empty = ModTaskFilter(false, None, None, None, None)
}


/* Keep for a while, mentioned in ReviewReason. [L4KDUQF2]
object ReviewTaskResolution {

  val Fine = new ReviewTaskResolution(1)

  // ...Other was-approved-because-... details bits?

  val Harmful = new ReviewTaskResolution(1 << 10)

  // Other was-rejected-because-... details bits?
  // 1 << 20 ... = more details, like user banned, or marked as threat or whatever else one can do?

  def requireIsValid(resolution: ReviewTaskResolution) {
    val value = resolution.value
    require(value != 0, "EsE5JUK020")
    require(!(resolution.isFine && resolution.isHarmful), "EsE8YKJF2")
    // for now: (change later when needed)
    require(value == Fine.value, s"Bad value: $value [EsE7YKP02]")
  }
}


class ReviewTaskResolution(val value: Int) extends AnyVal {
  import ReviewTaskResolution._

  def toInt: Int = value

  def isFine: Boolean = (value & Fine.value) != 0
  def isHarmful: Boolean = (value & Harmful.value) != 0

} */
