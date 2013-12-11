/**
 * Copyright (C) 2011-2012 Kaj Magnus Lindberg (born 1979)
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

import java.{util => ju}
import org.specs2.mutable._
import org.specs2.execute.Pending
import NotfOfPageAction.Type._
import PostActionDto.{copyCreatePost, copyReviewPost}
import Prelude._


trait NotfGeneratorTestValues {

  import PeopleTestUtils.makePerson
  val (bodyAuthor, bodyAuthorIdty, bodyAuthorLogin) = makePerson("BodyAuthor")
  val (replyAuthor, replyAuthorIdty, replyAuthorLogin) = makePerson("Replier")
  val (reviewer, reviewerIdty, reviewerLogin) = makePerson("ReviewerAuthor")

  val rawBody = copyCreatePost(PostTestValues.postSkeleton,
    id = PageParts.BodyId, loginId = bodyAuthorLogin.id, userId = bodyAuthor.id,
    parentPostId = None)

  val rawBodyPrelApproved = copyCreatePost(rawBody, approval = Some(Approval.Preliminary))
  val rawBodyWellBehavedAprvd = copyCreatePost(rawBody, approval = Some(Approval.WellBehavedUser))
  val rawBodyAuthzApproved = copyCreatePost(rawBody, approval = Some(Approval.AuthoritativeUser))

  val approvalOfBody =
    PostActionDto.toReviewPost(2, postId = rawBody.id, loginId = reviewerLogin.id,
      userId = reviewer.id,
      newIp = None, ctime = new ju.Date(11000),
      approval = Some(Approval.Manual))
  val rejectionOfBody = copyReviewPost(approvalOfBody, id = 3, approval = None)

  val rawReply = copyCreatePost(PostTestValues.postSkeleton,
    id = 11, loginId = replyAuthorLogin.id, userId = replyAuthor.id,
    parentPostId = Some(rawBody.id))

  val rawReplyPrelApproved = copyCreatePost(rawReply, approval = Some(Approval.Preliminary))
  val rawReplyWellBehvdAprvd = copyCreatePost(rawReply, approval = Some(Approval.WellBehavedUser))
  val rawReplyAuthzApproved = copyCreatePost(rawReply, approval = Some(Approval.AuthoritativeUser))

  val approvalOfReply =
    PostActionDto.toReviewPost(12, postId = rawReply.id, loginId = reviewerLogin.id,
      userId = reviewer.id,
      newIp = None, ctime = new ju.Date(11000),
      approval = Some(Approval.Manual))
  val rejectionOfReply = copyReviewPost(approvalOfReply, id = 13, approval = None)

  val EmptyPage = PageParts("pageId") ++ (People() +
    bodyAuthor + replyAuthor + reviewer +
    bodyAuthorIdty + replyAuthorIdty + reviewerIdty +
    bodyAuthorLogin + replyAuthorLogin + reviewerLogin)

  val PageWithApprovedBody = EmptyPage + rawBody + approvalOfBody
}



class NotfGeneratorTest extends Specification with NotfGeneratorTestValues {

  def genNotfs(user: User, page: PageParts, actions: PostActionDtoOld*) =
    NotfGenerator(page, actions).generateNotfs

  def checkThatFor(notf: NotfOfPageAction, recipient: User, actor: User,
        recipientAction: PostActionDtoOld, actorAction: PostActionDtoOld,
        triggerAction: PostActionDtoOld) = {
    notf.recipientUserId must_== recipient.id

    notf.recipientActionId must_== recipientAction.id
    notf.eventActionId must_== actorAction.id
    notf.triggerActionId must_== triggerAction.id

    notf.recipientUserDispName must_== recipient.displayName
    notf.eventUserDispName must_== actor.displayName
    notf.triggerUserDispName must_== None // for now

    notf.emailPending must_== (recipient.emailNotfPrefs ==
      EmailNotfPrefs.Receive)
    notf.emailId must_== None
  }


  "NotfGenerator" should {

    "generate no notf for a reply to one's own comment" in {
      val ownReply = copyCreatePost(rawReply, loginId = bodyAuthorLogin.id,
        userId = bodyAuthor.id, approval = Some(Approval.WellBehavedUser))
      val notfs = genNotfs(bodyAuthor, PageWithApprovedBody, ownReply)
      notfs.length must_== 0
    }

    "generate no notf for an unapproved reply" in {
      val notfs = genNotfs(bodyAuthor, PageWithApprovedBody, rawReply)
      notfs.length must_== 0
    }

    "generate no notf for a prel approved reply" in {
      val notfs = genNotfs(bodyAuthor, PageWithApprovedBody, rawReplyPrelApproved)
      notfs.length must_== 0
    }

    "generate a notf for other auto approved replies" in {
      def test(reply: PostActionDto[PostActionPayload.CreatePost]) = {
        val notfs = genNotfs(bodyAuthor, PageWithApprovedBody, reply)
        notfs.length must_== 1
        val notf = notfs.head
        notf.pageId must_== PageWithApprovedBody.id
        notf.eventType must_== PersonalReply
        checkThatFor(notf, recipient = bodyAuthor, actor = replyAuthor,
            recipientAction = rawBody, actorAction = reply,
            triggerAction = reply)
      }
      test(rawReplyAuthzApproved)
      test(rawReplyWellBehvdAprvd)
    }

    "generate no notf for a rejected reply" in {
      val page = PageWithApprovedBody + rawReply
      val notfs = genNotfs(bodyAuthor, page, rejectionOfReply)
      notfs.length must_== 0
    }

    "generate reply notf when a reply is approved, manually" in {
      val page = PageWithApprovedBody + rawReply
      val notfs = genNotfs(bodyAuthor, page, approvalOfReply)
      notfs.length must_== 1
      val notf = notfs.head
      notf.pageId must_== page.id
      notf.eventType must_== PersonalReply
      checkThatFor(notf, recipient = bodyAuthor, actor = replyAuthor,
          recipientAction = rawBody, actorAction = rawReply,
          triggerAction = approvalOfReply)
    }

    "generate no notf when a reply is approved by the one replied to" in {
      val approval = approvalOfReply.copy(
        loginId = bodyAuthorLogin.id, userId = bodyAuthor.id)
      val page = PageWithApprovedBody + rawReply
      val notfs = genNotfs(bodyAuthor, page, approval)
      notfs.length must_== 0
    }

    "generate no notfs if well-behaved-user approval upheld" in {
      // This cannot really happen: moderators aren't asked to review comments by
      // well-behaved users. But include this test anyway.
      val page = PageWithApprovedBody + rawReplyWellBehvdAprvd
      val notfs = genNotfs(bodyAuthor, page, approvalOfReply)
      notfs.length must_== 0
    }
  }

}

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

