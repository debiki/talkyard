/**
 * Copyright (c) 2011-2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import java.{util => ju}
import org.specs2.mutable._
import org.specs2.execute.Pending
import NotfOfPageAction.Type._
import Prelude._


trait NotfGeneratorTestValues {

  import PeopleTestUtils.makePerson
  val (bodyAuthor, bodyAuthorIdty, bodyAuthorLogin) = makePerson("BodyAuthor")
  val (replyAuthor, replyAuthorIdty, replyAuthorLogin) = makePerson("Replier")
  val (reviewer, reviewerIdty, reviewerLogin) = makePerson("ReviewerAuthor")

  val rawBody = PostTestValues.postSkeleton.copy(
    id = PageParts.BodyId, loginId = bodyAuthorLogin.id, payload =
      PostTestValues.postSkeleton.payload.copy(parentPostId = PageParts.BodyId))

  val rawBodyPrelApproved = rawBody.copy(payload = rawBody.payload.copy(
    approval = Some(Approval.Preliminary)))
  val rawBodyWellBehavedApproved = rawBody.copy(payload = rawBody.payload.copy(
    approval = Some(Approval.WellBehavedUser)))
  val rawBodyAuthzApproved = rawBody.copy(payload = rawBody.payload.copy(
    approval = Some(Approval.AuthoritativeUser)))

  val approvalOfBody =
    ReviewPostAction("2", postId = rawBody.id, loginId = reviewerLogin.id,
      userId = reviewer.id,
      newIp = None, ctime = new ju.Date(11000),
      approval = Some(Approval.Manual))
  val rejectionOfBody = approvalOfBody.copy(id = "3", approval = None)

  val rawReply = PostTestValues.postSkeleton.copy(
    id = "11", loginId = replyAuthorLogin.id, payload =
      PostTestValues.postSkeleton.payload.copy(parentPostId = rawBody.id))

  val rawReplyPrelApproved = rawReply.copy(payload = rawBody.payload.copy(
    approval = Some(Approval.Preliminary)))
  val rawReplyWellBehavedApproved = rawReply.copy(payload = rawBody.payload.copy(
    approval = Some(Approval.WellBehavedUser)))
  val rawReplyAuthzApproved = rawReply.copy(payload = rawBody.payload.copy(
    approval = Some(Approval.AuthoritativeUser)))

  val approvalOfReply =
    ReviewPostAction("12", postId = rawReply.id, loginId = reviewerLogin.id,
      userId = reviewer.id,
      newIp = None, ctime = new ju.Date(11000),
      approval = Some(Approval.Manual))
  val rejectionOfReply = approvalOfReply.copy(id = "13", approval = None)

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

    "generate no notf for an unapproved reply" in {
      val page = PageWithApprovedBody + rawReply
      val notfs = genNotfs(bodyAuthor, page, rawReply)
      notfs.length must_== 0
    }

    "generate no notf for a prel approved reply" in {
      val page = PageWithApprovedBody + rawReplyPrelApproved
      val notfs = genNotfs(bodyAuthor, page, rawReplyPrelApproved)
      notfs.length must_== 0
    }

    "generate a notf for other auto approved replies" in {
      def test(reply: PostActionDto[PostActionPayload.CreatePost]) = {
        val page = PageWithApprovedBody + reply
        val notfs = genNotfs(bodyAuthor, page, reply)
        notfs.length must_== 1
        val notf = notfs.head
        notf.pageId must_== page.id
        notf.eventType must_== PersonalReply
        checkThatFor(notf, recipient = bodyAuthor, actor = replyAuthor,
            recipientAction = rawBody, actorAction = reply,
            triggerAction = reply)
      }
      test(rawReplyAuthzApproved)
      test(rawReplyWellBehavedApproved)
    }

    "generate no notf for a rejected reply" in {
      val page = PageWithApprovedBody + rawReply + rejectionOfReply
      val notfs = genNotfs(bodyAuthor, page, rejectionOfReply)
      notfs.length must_== 0
    }

    "generate reply notf when a reply is approved, manually" in {
      val page = PageWithApprovedBody + rawReply + approvalOfReply
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
      val page = PageWithApprovedBody + rawReply + approval
      val notfs = genNotfs(bodyAuthor, page, approval)
      notfs.length must_== 0
    }

    "generate no notfs when well-behaved-user prel approval upheld" in {
      val page = PageWithApprovedBody + rawReplyWellBehavedApproved +
          approvalOfReply
      val notfs = genNotfs(bodyAuthor, page, approvalOfReply)
      notfs.length must_== 0
    }
  }

}

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

