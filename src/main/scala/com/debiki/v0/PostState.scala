/**
 * Copyright (c) 2013 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import java.{util => ju}
import Prelude._
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
      postCollapsedAt = None,
      treeCollapsedAt = None,
      postDeletedAt = None,
      treeDeletedAt = None,
      0, 0, 0, 0, 0,
      PostVoteState(), PostVoteState(), 0, 0,
      PostVoteState(), PostVoteState(), 0, 0,
      0, 0)
  }

}



/** A summary of the number of votes to do something (.pro) and not do it (.con, "contra")
  * with a post. And to undo it (undoPro) or not undo it (undoCon).
  *
  * For example, if 5 people has voted that a comment be collapsed, .pro would be 5.
  * And if 3 people have voted that it *not* be collapsed (that is, dissent with the 5
  * others), then .con would be 3.
  */
case class PostVoteState(pro: Int, con: Int, undoPro: Int, undoCon: Int) {
  require(pro >= 0)
  require(con >= 0)
  require(undoPro >= 0)
  require(undoCon >= 0)
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
  val postCollapsedAt: Option[ju.Date],
  val treeCollapsedAt: Option[ju.Date],
  val postDeletedAt: Option[ju.Date],
  val treeDeletedAt: Option[ju.Date],
  val numEditSuggestions: Int,
  val numEditsAppliedUnreviewed: Int,
  val numEditsAppldPrelApproved: Int,
  val numEditsToReview: Int,
  val numDistinctEditors: Int,
  val numCollapsePostVotes: PostVoteState,
  val numCollapseTreeVotes: PostVoteState,
  val numCollapsesToReview: Int,
  val numUncollapsesToReview: Int,
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
  require(numDeletesToReview >= 0)
  require(numUndeletesToReview >= 0)
  require(numPendingFlags >= 0)
  require(numHandledFlags >= 0)
}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
