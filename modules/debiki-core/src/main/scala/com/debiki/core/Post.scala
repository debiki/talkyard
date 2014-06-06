/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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

import collection.{immutable => imm, mutable => mut}
import com.debiki.core.{PostActionPayload => PAP}
import java.{util => ju}
import play.api.libs.json._
import Prelude._
import FlagType.FlagType



/** A "post" represents a part of a page, e.g. the title, the body, or a comment.
  * A Post instance wraps the action that created that particular page part
  * (namely a PostAction[PostActionPayload.CreatePost].) It also takes into
  * account all actions in pageParts that affect this post. For example,
  * `currentText` loops through all edits, and applies them, to construct the
  * current text.
  *
  * Re reviews and approvals: A post can be:
  * Unreviewed (then not yet approved).
  * Preliminarily approved (by the computer, automatically — it guesses / uses heuristics).
  * Permanently reviewed (by a moderator, or a well-behaved user).
  * Authoritatively reviewed (by a moderator but not a well-behaved user).
  */
case class Post(
    pageParts: PageParts,
    private val state: PostState,
    private val isLoadedFromCache: Boolean = true)
  extends PostAction[PAP.CreatePost](pageParts, state.creationAction)
  with MaybeApproval with PostActionActedUpon {

  require(postId == id)

  def this(pageParts: PageParts, creationAction: RawPostAction[PAP.CreatePost]) {
    this(pageParts, PostState.whenCreated(creationAction), isLoadedFromCache = false)
  }


  def parentId: Option[PostId] = payload.parentPostId

  // Useul when grouping by parent id: all posts with no parent can be mapped to NoId (= 0).
  def parentIdOrNoId: PostId = parentId.getOrElse(PageParts.NoId)

  def parentPost: Option[Post] = parentId.flatMap(page.getPost(_))


  /** Ancestors, starting with the post closest to this post. */
  def ancestorPosts: List[Post] = {
    var ancestors: List[Post] = Nil
    var curPost: Option[Post] = Some(this)
    while ({
      curPost = curPost.get.parentPost
      curPost.nonEmpty
    }) {
      ancestors ::= curPost.get
    }
    ancestors.reverse
  }


  def directApproval = payload.approval


  def isArticleOrConfig =
    id == PageParts.TitleId || id == PageParts.BodyId || id == PageParts.ConfigPostId


  def initiallyApproved: Boolean = {
    val initiallyApprovedPerhapsPreliminarily = directApproval.isDefined
    val initialApprovalNotCancelled = lastApprovalDati.isDefined
    initiallyApprovedPerhapsPreliminarily && initialApprovalNotCancelled
  }


  lazy val (currentText: String, markup: String, approvedText: Option[String]) = _applyEdits


  /** The initial text of this post: either 1) when created, or 2) when loaded from cache
    * (if it was loaded from cache).
    */
  def textInitially: String = payload.text


  def unapprovedText: Option[String] =
    if (Some(currentText) != approvedText) Some(currentText)
    else None


   // This currently happens directly, hence + 0:
  def numDeletePostVotesPro = state.numDeletePostVotes.pro + 0
  def numDeletePostVotesCon = state.numDeletePostVotes.con + 0
  def numUndeletePostVotesPro = state.numDeletePostVotes.undoPro + 0
  def numUndeletePostVotesCon = state.numDeletePostVotes.undoCon + 0

  def numDeleteTreeVotesPro = state.numDeleteTreeVotes.pro + 0
  def numDeleteTreeVotesCon = state.numDeleteTreeVotes.con + 0
  def numUndeleteTreeVotesPro = state.numDeleteTreeVotes.undoPro + 0
  def numUndeleteTreeVotesCon = state.numDeleteTreeVotes.undoCon + 0

  def numDeleteVotesPro = numDeletePostVotesPro + numDeleteTreeVotesPro
  def numDeleteVotesCon = numDeletePostVotesCon + numDeleteTreeVotesCon
  def numUndeleteVotesPro = numUndeletePostVotesPro + numUndeleteTreeVotesPro
  def numUndeleteVotesCon = numUndeletePostVotesCon + numUndeleteTreeVotesCon

  def numDeletesToReview = state.numDeletesToReview + 0
  def numUndeletesToReview = state.numUndeletesToReview + 0

  def numCollapsePostVotesPro = state.numCollapsePostVotes.pro + 0
  def numCollapsePostVotesCon = state.numCollapsePostVotes.con + 0
  def numUncollapsePostVotesPro = state.numCollapsePostVotes.undoPro + 0
  def numUncollapsePostVotesCon = state.numCollapsePostVotes.undoCon + 0

  def numCollapseTreeVotesPro = state.numCollapseTreeVotes.pro + 0
  def numCollapseTreeVotesCon = state.numCollapseTreeVotes.con + 0
  def numUncollapseTreeVotesPro = state.numCollapseTreeVotes.undoPro + 0
  def numUncollapseTreeVotesCon = state.numCollapseTreeVotes.undoCon + 0

  def numCollapseVotesPro = numCollapsePostVotesPro + numCollapseTreeVotesPro
  def numCollapseVotesCon = numCollapsePostVotesCon + numCollapseTreeVotesCon
  def numUncollapseVotesPro = numUncollapsePostVotesPro + numUncollapseTreeVotesPro
  def numUncollapseVotesCon = numUncollapsePostVotesCon + numUncollapseTreeVotesCon

  def numCollapsesToReview = state.numCollapsesToReview + 0
  def numUncollapsesToReview = state.numUncollapsesToReview + 0


  def numLikeVotes = actions.filter(_.payload == PAP.VoteLike).length
  def numWrongVotes = actions.filter(_.payload == PAP.VoteWrong).length
  def numOffTopicVotes = actions.filter(_.payload == PAP.VoteOffTopic).length


  def pinnedPosition: Option[Int] =
    page.getPinnedPositionOf(this)


  /**
   * Applies all edits and returns the resulting text and markup.
   *
   * Keep in sync with textAsOf in debiki.js.
   *    COULD make textAsOf understand changes in markup type,
   *    or the preview won't always work correctly.
   *
   * (It's not feasible to apply only edits that have been approved,
   * or only edits up to a certain dati. Because
   * then the state of all edits at that dati would have to be computed.
   * But at a given dati, an edit might or might not have been applied and
   * approved, and taking that into account results in terribly messy code.
   * Instead, use Page.splitByVersion(), to get a version of the page
   * at a certain point in time.)
   */
  private def _applyEdits: (String, String, Option[String]) = {
    // (If loaded from cache, payload.text and .markup have both been inited
    // to the cached text, which includes all edits up to the cached version.)
    var curText = payload.text
    var approvedText =
      if (lastApprovalDati.isDefined) state.lastApprovedText orElse Some(curText)
      else None
    var curMarkup = payload.markup
    // Loop through all edits and patch curText.
    for (edit <- editsAppliedAscTime) {
      curMarkup = edit.newMarkup.getOrElse(curMarkup)
      val patchText = edit.patchText
      if (patchText nonEmpty) {
        val newText = applyPatch(patchText, to = curText)
        curText = newText
        if (lastApprovalDati.map(edit.applicationDati.get.getTime <= _.getTime) == Some(true))
          approvedText = Some(curText)
      }
    }
    (curText, curMarkup, approvedText)
  }


  def where: Option[String] = payload.where


  def edits: List[Patch] =
    actions.filter(a => a.isInstanceOf[Patch]).asInstanceOf[List[Patch]]


  lazy val (
      editsDeletedDescTime: List[Patch],
      editsPendingDescTime: List[Patch],
      editsAppliedDescTime: List[Patch],
      editsRevertedDescTime: List[Patch]) = {

    var deleted = List[Patch]()
    var pending = List[Patch]()
    var applied = List[Patch]()
    var reverted = List[Patch]()

    edits foreach { edit =>
      // (Cannot easily move the below `assert`s to Edit, because
      // the values they test are computed lazily.)

      // An edit cannot be both applied and reverted at the same time.
      assErrIf(edit.isApplied && edit.isReverted, "DwE4FW21")
      if (edit.isReverted) reverted ::= edit
      if (edit.isApplied) applied ::= edit

      // An edit can have been reverted and then deleted,
      // but an edit that is currently in effect cannot also be deleted.
      assErrIf(edit.isApplied && edit.isDeleted, "DwE09IJ3")
      if (edit.isDeleted) deleted ::= edit

      // An edit that has been applied and then reverted, is pending again.
      // But an edit that is in effect, or has been deleted, cannot be pending.
      assErrIf(edit.isApplied && edit.isPending, "DwE337Z2")
      assErrIf(edit.isDeleted && edit.isPending, "DwE8Z3B2")
      if (edit.isPending) pending ::= edit
    }

    (deleted.sortBy(- _.deletedAt.get.getTime),
       pending.sortBy(- _.creationDati.getTime),
       applied.sortBy(- _.applicationDati.get.getTime),
       reverted.sortBy(- _.revertionDati.get.getTime))
  }


  def editsAppliedAscTime = editsAppliedDescTime.reverse


  def lastEditApplied = editsAppliedDescTime.headOption

  def lastEditAppliedAt: Option[ju.Date] =
    lastEditApplied.flatMap(_.applicationDati) orElse state.lastEditAppliedAt

  def lastEditorId: Option[String] =
    lastEditApplied.map(_.userId) orElse state.lastEditorId


  def lastEditReverted = editsRevertedDescTime.headOption

  def lastEditRevertedAt: Option[ju.Date] =
    lastEditReverted.flatMap(_.revertionDati) orElse state.lastEditRevertedAt


  /** How many different people that have edited this post. If loaded from cache,
    * ignores edits that happened after the cached version.
    */
  def numDistinctEditors: Int = {
    // Since we don't store the ids of all editors over time in the database post state
    // cache, it's not possible to know if any more recent `editsAppliedDescTime` editor
    // id coincides with any of the `state.numDistinctEditors` earlier editors.
    math.max(
      state.numDistinctEditors,
      editsAppliedDescTime.map(_.userId).distinct.length)
  }


  def numPendingEditSuggestions =
    state.numEditSuggestions + editsPendingDescTime.length


  /** Counts edits applied to this post but that have not yet been reviewed,
    * not even auto-reviewed by the computer.
    */
  def numEditsAppliedUnreviewed = {
    val numNew =
      if (lastReviewDati.isEmpty) editsAppliedDescTime.length
      else (editsAppliedDescTime takeWhile { patch =>
        lastReviewDati.get.getTime < patch.applicationDati.get.getTime
      }).length
    state.numEditsAppliedUnreviewed + numNew
  }


  /** Counts the edits made to this post that 1) have been preliminarily
    * approved by the computer, but 2) not permanently approved (by some moderator).
    */
  def numEditsAppldPrelApproved = {
    val numNew =
      if (lastApprovalType != Some(Approval.Preliminary)) 0
      else {
        (editsAppliedDescTime takeWhile { patch =>
          val perhapsPrelApprvd =
            patch.applicationDati.get.getTime <= lastApprovalDati.get.getTime
          val isPermApprvd =
            if (lastPermanentApprovalDati.isEmpty) false
            else patch.applicationDati.get.getTime <= lastPermanentApprovalDati.get.getTime
          perhapsPrelApprvd && !isPermApprvd
        }).length
      }
    state.numEditsAppldPrelApproved + numNew
  }


  /** Edits done after the last review — ignoring preliminary auto approval reviews —
    * need to be reviewed.
    */
  def numEditsToReview = {
    val numNew = lastPermanentApprovalDati match {
      case None => editsAppliedDescTime.length
      case Some(permApprovalDati) =>
        (editsAppliedDescTime takeWhile { patch =>
          permApprovalDati.getTime < patch.applicationDati.get.getTime
        }).length
    }
    state.numEditsToReview + numNew
  }


  /** When the text was last edited, or when this post was created.
    */
  def textLastEditedAt : ju.Date =
    lastEditAppliedAt getOrElse creationDati


  /** When the text of this Post was last edited or reverted to an earlier version.
    */
  def textLastEditedOrRevertedAt : ju.Date = {
    val maxTime = math.max(
       lastEditAppliedAt.map(_.getTime).getOrElse(0: Long),
       lastEditRevertedAt.map(_.getTime).getOrElse(0: Long))
    if (maxTime == 0) creationDati else new ju.Date(maxTime)
  }


  /** When this post was last edited, reverted, deleted, or hidden.
    * Used when sorting posts in the activity list in the admin UI.
    */
  def lastActedUponAt = new ju.Date(Seq(
      textLastEditedOrRevertedAt.getTime,
      postDeletedAt.map(_.getTime).getOrElse(0: Long),
      treeDeletedAt.map(_.getTime).getOrElse(0: Long),
      postHiddenAt.map(_.getTime).getOrElse(0: Long)).max)


  /** The most recent reviews, or Nil if all most recent reviews might not
    * have been loaded.
    */
  private lazy val _reviewsDescTime: List[PostAction[_] with MaybeApproval] = {
    // If loaded from cache, we will have loaded no reviews, or only one review,
    // namely `this`, if this post was auto-approved (e.g. a preliminarily
    // approved comment, or a comment posted by an admin).
    // However, returning only `this` is incorrect, if there are in fact other
    // reviews that happened later, but haven't been loaded; other functions
    // assume that _reviewsDescTime includes any most recent review. So instead
    // of returning List(this), return Nil; then other functions work as they
    // should (if _reviewsDescTime is empty rather than incorrectly containing only
    // the first one of many reviews).
    if (isLoadedFromCache) Nil
    else findReviews
  }


  private def findReviews = {
    // (If a ReviewPostAction.approval.isEmpty, this Post was rejected.
    // An Edit.approval or EditApp.approval being empty, however,
    // means only that this Post has not yet been reviewed — so the Edit
    // or EditApp is simply ignored.)

    val explicitReviewsDescTime =
      actions.filter(_.isInstanceOf[Review]).sortBy(-_.creationDati.getTime).
      asInstanceOf[List[PostAction[_] with MaybeApproval]]

    var implicitApprovals = List[PostAction[_] with MaybeApproval]()
    if (directApproval.isDefined)
      implicitApprovals ::= this
    for (edit <- edits) {
      if (edit.directApproval.isDefined)
        implicitApprovals ::= edit
      for (editApp <- page.editAppsByEdit(edit.id)) {
        // Ought to reuse PostActionsWrapper's wrapped rawAction:s rather than
        // creating new objects here.
        if (editApp.payload.approval.isDefined)
          implicitApprovals ::= new ApplyPatchAction(page, editApp)

        // In the future, deletions (and any other actions?) should also
        // be considered:
        //for (deletion <- page.deletionsFor(editApp)) {
        //  if (deletion.approval.isDefined)
        //    implicitApprovals ::= deletion
        //}
      }

      // In the future, also consider deletions?
      //for (deletion <- page.deletionsFor(edit)) {
      //  if (deletion.approval.isDefined)
      //    implicitApprovals ::= deletion
      //}
    }

    // In the future, consider deletions of `this.action`?
    // for (deletion <- page.deletionsFor(action)) ...

    val allReviews = explicitReviewsDescTime ::: implicitApprovals
    allReviews.sortBy(- _.creationDati.getTime)
  }


  /**
   * Moderators need only be informed about things that happened after
   * this dati.
   */
  def lastAuthoritativeReviewDati: Option[ju.Date] =
    anyMaxDate(lastAuthoritativeReview.map(_.creationDati), state.lastAuthoritativeReviewDati)


  def lastReviewDati: Option[ju.Date] =
    anyMaxDate(_reviewsDescTime.headOption.map(_.creationDati), state.lastReviewDati)


  def lastApprovalType: Option[Approval] = {
    if (lastApprovalDati == state.lastApprovalDati) state.lastApprovalType
    else lastApproval.flatMap(_.directApproval)
  }


  private lazy val lastApproval: Option[PostAction[_] with MaybeApproval] = {
    // A rejection cancels all earlier and contiguous preliminary auto
    // approvals, so loop through the reviews:
    var rejectionFound = false
    var reviewsLeft = _reviewsDescTime
    var lastApproval: Option[PostAction[_] with MaybeApproval] = None
    while (reviewsLeft nonEmpty) {
      val review = reviewsLeft.head
      reviewsLeft = reviewsLeft.tail
      if (review.directApproval.map(_.isPermanent) == Some(false) && rejectionFound) {
        // Ignore this approval — the rejection cancels it.
      } else if (review.directApproval.isEmpty) {
        rejectionFound = true
      } else {
        lastApproval = Some(review)
        reviewsLeft = Nil
      }
    }
    lastApproval
  }


  /**
   * The most recent review of this post by an admin or moderator.
   * (But not by seemingly well behaved users.)
   */
  private def lastAuthoritativeReview: Option[PostAction[_] with MaybeApproval] =
    _reviewsDescTime.find(review =>
      review.directApproval.map(_.isAuthoritative) != Some(false))


  private def lastPermanentApproval: Option[PostAction[_] with MaybeApproval] =
    _reviewsDescTime.find(review =>
        review.directApproval.map(_.isPermanent) == Some(true))


  def lastPermanentApprovalDati: Option[ju.Date] =
    anyMaxDate(lastPermanentApproval.map(_.creationDati), state.lastPermanentApprovalDati)

  /**
   * All actions that affected this Post and didn't happen after
   * this dati should be considered when rendering this Post.
   */
  def lastApprovalDati: Option[ju.Date] =
    anyMaxDate(lastApproval.map(_.creationDati), state.lastApprovalDati)


  def lastManualApprovalDati: Option[ju.Date] =
    anyMaxDate(
      _reviewsDescTime.find(_.directApproval == Some(Approval.Manual)).map(_.creationDati),
      state.lastManualApprovalDati)


  def lastReviewWasApproval: Option[Boolean] =
    if (lastReviewDati.isEmpty) None
    else Some(lastReviewDati == lastApprovalDati)


  /** Has this post been reviewed by a moderator, well behaved user or by the computer?
    */
  def currentVersionReviewed: Boolean = {
    // Use >= not > because a comment might be auto approved, and then
    // the approval dati equals the comment creationDati.
    val isReviewed = lastReviewDati.isDefined &&
      textLastEditedAt.getTime <= lastReviewDati.get.getTime
    if (isReviewed)
      assErrIf(numEditsAppliedUnreviewed != 0,
        "DwE408B0", o"""Bad state. Page ${page.pageId}, post $id,
          numEditsAppliedUnreviewed = $numEditsAppliedUnreviewed""")
    isReviewed
  }


  /** If this post has been reviewed by a moderator or in some cases a well
    * behaved user, it is considered permanently reviewed.
    * (Rejections are permanent, and all approvals except for Approval.Preliminary.)
    */
  def currentVersionPermReviewed: Boolean =
    currentVersionReviewed && !currentVersionPrelApproved


  def currentVersionPermApproved: Boolean =
    currentVersionApproved && lastApprovalType.get.isPermanent


  /** Has the computer preliminarily approved this post, or the last few edits?
    */
  def currentVersionPrelApproved: Boolean =
    currentVersionApproved && lastApprovalType == Some(Approval.Preliminary)


  def currentVersionApproved: Boolean =
    currentVersionReviewed && lastReviewWasApproval.get


  def currentVersionRejected: Boolean =
    currentVersionReviewed && !lastReviewWasApproval.get


  def someVersionApproved: Boolean = {
    // A rejection cancels all edits since the previous approval,
    // or effectively deletes the post, if it has never been approved.
    // To completely "unapprove" a post that has previously been approved,
    // delete it instead.
    lastApprovalDati.nonEmpty
  }


  def someVersionPermanentlyApproved: Boolean =
    lastPermanentApprovalDati.nonEmpty


  def someVersionManuallyApproved: Boolean =
    lastManualApprovalDati.isDefined


  lazy val depth: Int = {
    var depth = 0
    var curId = id
    var nextParent = parentId.flatMap(page.getPost(_))
    while (nextParent.nonEmpty && nextParent.get.id != curId) {
      depth += 1
      curId = nextParent.get.id
      nextParent = nextParent.get.parentId.flatMap(page.getPost(_))
    }
    depth
  }


  def replyCount: Int =
    debate.repliesTo(id).length


  def replies: List[Post] = debate.repliesTo(id)


  // If there is no parent post, considers all other posts with no parents its siblings.
  def siblingsAndMe: List[Post] = debate.repliesTo(parentIdOrNoId)


  def postCollapsedAt: Option[ju.Date] =
    findLastAction(PAP.CollapsePost).map(_.creationDati) orElse state.postCollapsedAt

  def treeCollapsedAt: Option[ju.Date] =
    findLastAction(PAP.CollapseTree).map(_.creationDati) orElse state.treeCollapsedAt

  def treeClosedAt: Option[ju.Date] =
    findLastAction(PAP.CloseTree).map(_.creationDati) orElse state.treeClosedAt

  def isPostCollapsed: Boolean = postCollapsedAt.nonEmpty
  def isTreeCollapsed: Boolean = treeCollapsedAt.nonEmpty
  def isCollapsedSomehow: Boolean = isPostCollapsed || isTreeCollapsed

  def isTreeClosed: Boolean = treeClosedAt.nonEmpty


  private def postDeletedAction: Option[PostAction[PAP.DeletePost.type]] =
    findLastAction(PAP.DeletePost)

  private def treeDeletedAction: Option[PostAction[PAP.DeleteTree.type]] =
    findLastAction(PAP.DeleteTree)

  private def postHiddenAction: Option[PostAction[PAP.HidePost.type]] =
    findLastAction(PAP.HidePost)

  def postDeletedAt: Option[ju.Date] =
    postDeletedAction.map(_.creationDati) orElse state.postDeletedAt

  def treeDeletedAt: Option[ju.Date] =
    treeDeletedAction.map(_.creationDati) orElse state.treeDeletedAt

  def postHiddenAt: Option[ju.Date] =
    postHiddenAction.map(_.creationDati) orElse state.postHiddenAt

  def postDeletedById: Option[String] =
    postDeletedAction.map(_.userId) orElse state.postDeletedById

  def treeDeletedById: Option[String] =
    treeDeletedAction.map(_.userId) orElse state.treeDeletedById

  def postHiddenById: Option[String] =
    postHiddenAction.map(_.userId) orElse state.postHiddenById

  def isPostDeleted: Boolean = postDeletedAt.nonEmpty
  def isTreeDeleted: Boolean = treeDeletedAt.nonEmpty
  def isDeletedSomehow: Boolean = isPostDeleted || isTreeDeleted

  def isPostHidden: Boolean = postHiddenAt.nonEmpty


  /** How many people have up/downvoted this post. Might be a tiny bit
    * inaccurate, if a cached post state is relied on (because it doesn't
    * store the ids of all raters, and if you add yet another rater, we don't
    * know if you're adding a new rating, or changing any old one of yours).
    */
  def numDistinctRaters = 1234  // unimpleimented
    // state.numDistinctRaters + num new ratings ratings


  // COULD optimize this, do once for all flags.
  lazy val flags = page.rawActions filter { action =>
    action.payload.isInstanceOf[PAP.Flag] && action.postId == this.id
  } map (_.asInstanceOf[RawPostAction[PAP.Flag]])


  def flagsDescTime: List[RawPostAction[PAP.Flag]] = flags.sortBy(- _.ctime.getTime)


  /**
   * Flags that were raised before the last review by a moderator have
   * already been reviewed.
   */
  lazy val (
      flagsPendingReview: List[RawPostAction[PAP.Flag]],
      flagsReviewed: List[RawPostAction[PAP.Flag]]) =
    flagsDescTime span { flag =>
      if (lastAuthoritativeReviewDati isEmpty) true
      else lastAuthoritativeReviewDati.get.getTime <= flag.ctime.getTime
    }

  def numPendingFlags = state.numPendingFlags + flagsPendingReview.length
  def numHandledFlags = state.numHandledFlags + flagsReviewed.length
  def numFlags = numPendingFlags + numHandledFlags

  lazy val lastFlag = flagsDescTime.headOption

  lazy val flagsByType: imm.Map[FlagType, List[RawPostAction[PAP.Flag]]] = {
    // Add reasons and flags to a mutable map.
    var mmap = mut.Map[FlagType, mut.Set[RawPostAction[PAP.Flag]]]()
    for (f <- flags)
      mmap.getOrElse(f.payload.tyype, {
        val s = mut.Set[RawPostAction[PAP.Flag]]()
        mmap.put(f.payload.tyype, s)
        s
      }) += f
    // Copy to an immutable version.
    imm.Map[FlagType, List[RawPostAction[PAP.Flag]]](
      (for ((reason, flags) <- mmap)
      yield (reason, flags.toList)).toList: _*)
  }

  /** Pairs of (FlagReason, flags-for-that-reason), sorted by
   *  number of flags, descending.
   */
  lazy val flagsByTypeSorted: List[(FlagType, List[RawPostAction[PAP.Flag]])] = {
    flagsByType.toList.sortWith((a, b) => a._2.length > b._2.length)
  }


  def toJson: JsObject = Protocols.postToJson(this)

}



object Post {

  def fromJson(json: JsValue) = Protocols.jsonToPost(json)

}

