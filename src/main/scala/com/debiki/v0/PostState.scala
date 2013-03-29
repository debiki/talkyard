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
    PostState(creationPostActionDto, 0, 0, 0, 0, 0, 0, 0)
  }

}



/** The state of a post — historic info up to the time this state concerns is gone.
  *
  * Saved and loaded from a database table (DW1_POSTS) that caches posts states
  * so all historic info don't have to be reapplied to get to the current state.
  */
case class PostState(
  creationPostActionDto: PostActionDto[PostActionPayload.CreatePost],
  numPendingEditApps: Int,
  numPendingEditSuggestions: Int,
  numPendingMoves: Int,
  numPendingCollapses: Int,
  numPendingDeletes: Int,
  numPendingFlags: Int,
  numHandledFlags: Int)


/*

object PostState {

  def whenCreated(createPostActionDto: PostActionDto[PAP.CreatePost]): PostState = {
    PostState(
      id = createPostActionDto.id,
      createdAt = createPostActionDto.creationDati,
      loginId = createPostActionDto.loginId,
      userId = createPostActionDto.userId,
      parentPostId = createPostActionDto.payload.parentPostId,
      text = createPostActionDto.payload.text,
      markup = createPostActionDto.payload.markup,
      approval = createPostActionDto.payload.approval,
      where = createPostActionDto.payload.where)
  }

}



/** The state of a post — historic info up to the time this state concerns is gone.
  *
  * Saved and loaded from a database table (DW1_POSTS) that caches posts states
  * so all historic info don't have to be reapplied to get to the current state.
  */
case class PostState(
  createPostActionDto: PostActionDto[PostActionPayload.CreatePost]]
  id: String,
  createdAt: ju.Date,
  loginId: String,
  userId: String,
  parentPostId: String,
  text: String,
  markup: String,
  approval: Option[Approval],
  where: Option[String]) {

  def makeCreatePostActionForThisState: PostActionDto[PAP.CreatePost] = {
    unimplemented
  }

}

*/
/*

  def initiallyApproved: Boolean
  def textInitially: String = payload.text

  def modificationDati: ju.Date

  def lastAuthoritativeReviewDati: Option[ju.Date]

  def lastReviewDati: Option[ju.Date]


  lazy val lastApproval: Option[PostActionOld with MaybeApproval]

 def lastAuthoritativeReview: Option[PostActionOld with MaybeApproval]

  def lastPermanentApproval: Option[PostActionOld with MaybeApproval]

  def lastApprovalDati: Option[ju.Date]


  def lastManualApprovalDati: Option[ju.Date]


  def lastReviewWasApproval: Option[Boolean]


  def currentVersionReviewed: Boolean


  def currentVersionPrelApproved: Boolean


  def currentVersionApproved: Boolean


  def currentVersionRejected: Boolean


  def someVersionApproved: Boolean

  def someVersionPermanentlyApproved: Boolean


  def someVersionManuallyApproved: Boolean


  lazy val depth

  def replyCount


  def isTreeCollapsed: Boolean


  def isOnlyPostCollapsed: Boolean


  def areRepliesCollapsed: Boolean

  def isTreeClosed: Boolean


  private def hasHappenedNotUndone(payload: PostActionPayload): Boolean =
    actions.find { action =>
      action.payload == payload  // && !action.wasUndone
    }.nonEmpty


  lazy val flags: List[Flag]


  def flagsDescTime: List[Flag]


  lazy val (
      flagsPendingReview: List[Flag],
      flagsReviewed: List[Flag]) =

  lazy val lastFlag = flagsDescTime.headOption

  lazy val flagsByReason: imm.Map[FlagReason, List[Flag]]

  lazy val flagsByReasonSorted: List[(FlagReason, List[Flag])]

*/


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
