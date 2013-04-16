/**
 * Copyright (c) 2013 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import java.{util => ju}
import collection.{immutable => imm, mutable => mut}
import Prelude._
import PageParts._
import FlagReason.FlagReason
import com.debiki.v0.{PostActionPayload => PAP}


object PostState {

  def whenCreated(creationPostActionDto: PostActionDto[PAP.CreatePost]): PostState = {
    def approval = creationPostActionDto.payload.approval
    val lastApprovalDati =
      if (approval.isDefined) Some(creationPostActionDto.creationDati)
      else None
    new PostState(
      creationPostActionDto,
      lastActedUponAt = creationPostActionDto.creationDati,
      lastReviewDati = lastApprovalDati,
      lastAuthoritativeReviewDati =
        if (approval.filter(_.isAuthoritative).isDefined) lastApprovalDati
        else None,
      lastApprovalDati = lastApprovalDati,
      lastApprovedText =
        if (approval.isDefined) Some(creationPostActionDto.payload.text)
        else None,
      lastPermanentApprovalDati =
        if (approval.filter(_.isPermanent).isDefined) lastApprovalDati
        else None,
      lastManualApprovalDati =
        if (approval.filter(_ == Approval.Manual).isDefined) lastApprovalDati
        else None,
      lastEditAppliedAt = None,
      lastEditRevertedAt = None,
      lastEditorId = None,
      collapsed = None,
      deletedAt = None,
      0, 0, 0, 0, 0,
      PostVoteState(), PostVoteState(), 0, 0,
      PostVoteState(), 0, 0,
      PostVoteState(), PostVoteState(), 0, 0,
      0, 0)
  }

}



/** A summary of the number of pending votes (.pending) do do something
  * with a post, and to undo it (.undo). And of old already considered votes
  * to do/undo it (old/undoOld).
  */
case class PostVoteState(pending: Int, old: Int, undoPending: Int, undoOld: Int) {
  require(pending >= 0)
  require(old >= 0)
  require(undoPending >= 0)
  require(undoOld >= 0)
}



object PostVoteState {
  def apply(): PostVoteState = PostVoteState(0, 0, 0, 0)
}



/** The state of a post — historic info up to the time this state concerns is gone.
  *
  * Saved and loaded from a database table (DW1_POSTS) that caches posts states
  * so all historic info don't have to be reapplied to get to the current state.
  */
class PostState(
  val creationPostActionDto: PostActionDto[PostActionPayload.CreatePost],
  val lastActedUponAt: ju.Date,
  val lastReviewDati: Option[ju.Date],
  val lastAuthoritativeReviewDati: Option[ju.Date],
  val lastApprovalDati: Option[ju.Date],
  val lastApprovedText: Option[String],
  val lastPermanentApprovalDati: Option[ju.Date],
  val lastManualApprovalDati: Option[ju.Date],
  val lastEditAppliedAt: Option[ju.Date],
  val lastEditRevertedAt: Option[ju.Date],
  val lastEditorId: Option[String],
  val collapsed: Option[PostActionPayload.CollapseSomething],
  val deletedAt: Option[ju.Date],
  val numEditSuggestions: Int,
  val numEditsAppliedUnreviewed: Int,
  val numEditsAppldPrelApproved: Int,
  val numEditsToReview: Int,
  val numDistinctEditors: Int,
  val numCollapsePostVotes: PostVoteState,
  val numCollapseTreeVotes: PostVoteState,
  val numCollapsesToReview: Int,
  val numUncollapsesToReview: Int,
  val numMoveVotes: PostVoteState,
  val numMovesToReview: Int,
  val numUnmovesToReview: Int,
  val numDeletePostVotes: PostVoteState,
  val numDeleteTreeVotes: PostVoteState,
  val numDeletesToReview: Int,
  val numUndeletesToReview: Int,
  val numPendingFlags: Int,
  val numHandledFlags: Int) {

  def lastApprovalType: Option[Approval] = creationPostActionDto.payload.approval

  require(lastAuthoritativeReviewDati.isEmpty || lastReviewDati.isDefined)
  require(lastApprovalDati.isEmpty || lastReviewDati.isDefined)
  require(lastApprovalDati.isDefined == lastApprovalType.isDefined)
  require(lastApprovedText.isEmpty || lastApprovalDati.isDefined)
  require(lastPermanentApprovalDati.isEmpty || lastApprovalDati.isDefined)
  require(lastManualApprovalDati.isEmpty || lastPermanentApprovalDati.isDefined)
  require(lastEditAppliedAt.isDefined == lastEditorId.isDefined)

  require(numEditSuggestions >= 0)
  require(numEditsAppliedUnreviewed >= 0)
  require(numEditsAppldPrelApproved >= 0)
  require(numEditsToReview >= 0)
  require(numDistinctEditors >= 0)
  require(numCollapsesToReview >= 0)
  require(numUncollapsesToReview >= 0)
  require(numMovesToReview >= 0)
  require(numUnmovesToReview >= 0)
  require(numDeletesToReview >= 0)
  require(numUndeletesToReview >= 0)
  require(numPendingFlags >= 0)
  require(numHandledFlags >= 0)
}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
