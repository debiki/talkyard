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

import com.debiki.core.{PostActionPayload => PAP}
import java.{util => ju}
import PostActionDto.{copyCreatePost, copyReviewPost}
import Prelude._


/**
 * Constructs a page, with a body text (id = Page.BodyId),
 * and an Edit of that text,
 * and an EditApp of that Edit,
 * and a Delete of that Edit, or the EditApp,
 * or a ReviewPostAction & approval of the EditApp,
 * or a ReviewPostAction & rejection of the EditApp.
 */
trait PageTestValues {

  val datiBeforeFirstAction = new ju.Date(0)

  val textInitially = "initial-body-text"
  val textAfterFirstEdit = "body-text-after-first-edit"

  val bodySkeleton =
    PostActionDto(id = PageParts.BodyId, postId = PageParts.BodyId,
      userIdData = UserIdData.newTest("101", userId = "?"), creationDati = new ju.Date(1000),
      payload = PostActionPayload.CreatePost(
        parentPostId = None,
        text = textInitially,
        markup = "",
        approval = None))

  val bodySkeletonAutoApproved =
    copyCreatePost(bodySkeleton, approval = Some(Approval.WellBehavedUser))

  val bodySkeletonPrelApproved =
    copyCreatePost(bodySkeleton, approval = Some(Approval.Preliminary))

  val bodyApprovalSkeleton = PostActionDto.toReviewPost(
    11, postId = bodySkeleton.id, UserIdData.newTest("111", userId = "?"),
        ctime = new ju.Date(11000), approval = Some(Approval.Manual))

  val bodyRejectionSkeleton = copyReviewPost(bodyApprovalSkeleton, approval = None)

  val editSkeleton =
    PostActionDto.toEditPost(
        id = 12, postId = bodySkeleton.id, ctime = new ju.Date(12000),
        UserIdData.newTest("112", userId = "?"),
        text = makePatch(from = textInitially, to = textAfterFirstEdit),
        newMarkup = None, approval = None, autoApplied = false)

  def deletionOfEdit =
    PostActionDto(id = 13, postId = editSkeleton.postId,
      userIdData = UserIdData.newTest("113", userId = "?"), creationDati = new ju.Date(13000),
      payload = PAP.Delete(editSkeleton.id))

  val editAppSkeleton =
    PostActionDto[PAP.EditApp](id = 14, new ju.Date(14000),
      PAP.EditApp(editSkeleton.id, approval = None),
      postId = editSkeleton.postId, UserIdData.newTest("114", userId = "?"))

  val deletionOfEditApp =
    PostActionDto(id = 15, postId = editAppSkeleton.postId,
        userIdData = UserIdData.newTest("115", userId = "?"), creationDati = new ju.Date(15000),
        payload = PAP.Delete(editSkeleton.id))

  val approvalOfEditApp = PostActionDto.toReviewPost(id = 16, postId = editAppSkeleton.postId,
        userIdData = UserIdData.newTest("116", userId = "?"), ctime = new ju.Date(16000),
        approval = Some(Approval.Manual))

  val rejectionOfEditApp = copyReviewPost(approvalOfEditApp, approval = None)

  /* val ratingOfBody = Rating(17, postId = bodySkeleton.id,
    userIdData = UserIdData.newTest("117", userId = "?"), ctime = new ju.Date(17000), tags = Nil)
    */

  /*
  val flagOfBody = PostActionDto(18, new ju.Date(18000),
    PAP.Flag(tyype = FlagType.Spam, reason = ""), postId = bodySkeleton.id,
    UserIdData.newTest("118", userId = "?"))
    */


  case class PageWithEditApplied(
    page: PageParts, edit: PostActionDto[PAP.EditPost], applDate: ju.Date)

  val EmptyPage = PageParts("a")

  def makePageWithEditApplied(autoApplied: Boolean): PageWithEditApplied = {
    val (edit, editApplDati) =
      if (autoApplied)
        (PostActionDto.copyEditPost(editSkeleton, autoApplied = Some(true)), editSkeleton.ctime)
      else
        (editSkeleton, editAppSkeleton.ctime)
    var page = EmptyPage + bodySkeletonAutoApproved + edit
    if (!autoApplied) page = page + editAppSkeleton
    PageWithEditApplied(page, edit, editApplDati)
  }

  lazy val PageWithEditManuallyAppliedNotApproved =
    EmptyPage + bodySkeletonAutoApproved + editSkeleton + editAppSkeleton

  lazy val PageWithEditManuallyAppliedAndExplApproved =
    EmptyPage + bodySkeletonAutoApproved + editSkeleton +
       editAppSkeleton + approvalOfEditApp

  lazy val PageWithEditManuallyAppliedAndAutoApproved =
    EmptyPage + bodySkeletonAutoApproved + editSkeleton +
       PostActionDto.copyApplyEdit(editAppSkeleton, approval = Some(Approval.WellBehavedUser))

  lazy val PageWithEditManuallyAppliedAndPrelApproved =
    EmptyPage + bodySkeletonAutoApproved + editSkeleton +
      PostActionDto.copyApplyEdit(editAppSkeleton, approval = Some(Approval.Preliminary))

  lazy val PageWithEditManuallyAppliedAndPrelApprovedThenRejected =
    PageWithEditManuallyAppliedAndPrelApproved + rejectionOfEditApp

  lazy val PageWithEditManuallyAppliedAndRejected =
    EmptyPage + bodySkeletonAutoApproved + editSkeleton +
     editAppSkeleton + rejectionOfEditApp

  lazy val PageWithEditManuallyAppliedNothingApproved =
    EmptyPage + bodySkeleton + editSkeleton + editAppSkeleton

  val datiAfterLastAction = new ju.Date(20000)
}


object PageTestValues extends PageTestValues

