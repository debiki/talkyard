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

package com.debiki.v0

import Prelude._
import java.{util => ju}
import PostActionDto.{copyCreatePost, copyReviewPost}
import com.debiki.v0.{PostActionPayload => PAP}


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
      creationDati = new ju.Date(1000),
      loginId = "101", userId = "?", newIp = None,
      payload = PostActionPayload.CreatePost(
        parentPostId = PageParts.BodyId,
        text = textInitially,
        markup = "",
        approval = None))

  val bodySkeletonAutoApproved =
    copyCreatePost(bodySkeleton, approval = Some(Approval.WellBehavedUser))

  val bodySkeletonPrelApproved =
    copyCreatePost(bodySkeleton, approval = Some(Approval.Preliminary))

  val bodyApprovalSkeleton = PostActionDto.toReviewPost(
    11, postId = bodySkeleton.id, loginId = "111", userId = "?", newIp = None,
        ctime = new ju.Date(11000), approval = Some(Approval.Manual))

  val bodyRejectionSkeleton = copyReviewPost(bodyApprovalSkeleton, approval = None)

  val editSkeleton =
    PostActionDto.toEditPost(
        id = 12, postId = bodySkeleton.id, ctime = new ju.Date(12000),
        loginId = "112", userId = "?", newIp = None,
        text = makePatch(from = textInitially, to = textAfterFirstEdit),
        newMarkup = None, approval = None, autoApplied = false)

  def deletionOfEdit =
    PostActionDto(id = 13, postId = editSkeleton.postId,
      loginId = "113", userId = "?", newIp = None, creationDati = new ju.Date(13000),
      payload = PAP.Delete(editSkeleton.id))

  val editAppSkeleton =
    EditApp(id = 14, editId = editSkeleton.id, postId = editSkeleton.postId,
      loginId = "114", userId = "?", newIp = None, ctime = new ju.Date(14000),
      approval = None, result = "ignored")

  val deletionOfEditApp =
    PostActionDto(id = 15, postId = editAppSkeleton.postId,
        loginId = "115", userId = "?", newIp = None, creationDati = new ju.Date(15000),
        payload = PAP.Delete(editSkeleton.id))

  val approvalOfEditApp = PostActionDto.toReviewPost(id = 16, postId = editAppSkeleton.id,
        loginId = "116", userId = "?", newIp = None, ctime = new ju.Date(16000),
        approval = Some(Approval.Manual))

  val rejectionOfEditApp = copyReviewPost(approvalOfEditApp, approval = None)

  val ratingOfBody = Rating(17, postId = bodySkeleton.id, loginId = "117", userId = "?",
    newIp = None, ctime = new ju.Date(17000), tags = Nil)

  val flagOfBody = Flag(18, postId = bodySkeleton.id, loginId = "118", userId = "?",
    newIp = None, ctime = new ju.Date(18000), reason = FlagReason.Spam,
    details = "")


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
       editAppSkeleton.copy(approval = Some(Approval.WellBehavedUser))

  lazy val PageWithEditManuallyAppliedAndPrelApproved =
    EmptyPage + bodySkeletonAutoApproved + editSkeleton +
       editAppSkeleton.copy(approval = Some(Approval.Preliminary))

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

