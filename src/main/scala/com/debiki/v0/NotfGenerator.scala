/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package com.debiki.v0

import java.{util => ju}
import Prelude._


/**
 * Analyzes page actions, e.g. replies and their approvals, and
 * generates and returns the appropriate notifications.
 */
case class NotfGenerator(pageInclNewActions: Debate, newActions: Seq[PostActionDtoOld]) {

  def page = pageInclNewActions


  def generateNotfs: Seq[NotfOfPageAction] = newActions flatMap (_ match {
    case action: PostActionDto[_] => action.payload match {
      case p: PostActionPayload.CreatePost =>
        _makePersonalReplyNotf(page.getPost(action.id).get)
      case _ => Nil // skip for now
    }
    // Note:
    // If you add notfs (below) for other things than replies,
    // then, in debiki-app-play, update NotfHtmlRenderer.
    case e: Edit =>
      Nil  // fix later, see note above
    case app: EditApp =>
      Nil  // fix later, see note above
    case flag: Flag =>
      Nil  // fix later, see note above
    case review: ReviewPostAction =>
      _makeReviewNotfs(page.getReview(review.id) getOrDie "DwE093k7")
    case _ =>
      Nil  // skip for now
  })


  def _makePersonalReplyNotf(post: Post,
          review: Option[Review] = None): List[NotfOfPageAction] = {

    val (triggerAction, approvalOpt) =
      review.map(r => (r, r.approval)) getOrElse (
        post, post.approval)

    // Don't notify about unapproved comments.
    if (approvalOpt.isEmpty)
      return Nil

    // Don't notify about preliminarily approved comments
    // (wait until moderator upholds it).
    if (approvalOpt == Some(Approval.Preliminary))
      return Nil

    // This might be a page config/template Post; if so, it has no parent.
    val postRepliedTo = post.parentPost getOrElse (return Nil)

    val userRepliedTo = postRepliedTo.user_!
    val replier = post.user_!

    // Don't notify the user about his/her own replies.
    if (replier.id == Some(userRepliedTo.id))
      return Nil

    List(NotfOfPageAction(
        ctime = triggerAction.creationDati,
        recipientUserId = userRepliedTo.id,
        pageTitle = page.titleText.getOrElse("Unnamed page"),
        pageId = page.id,
        eventType = NotfOfPageAction.Type.PersonalReply,
        eventActionId = post.id,
        triggerActionId = triggerAction.id,
        recipientActionId = postRepliedTo.id,
        recipientUserDispName = userRepliedTo.displayName,
        eventUserDispName = replier.displayName,
        triggerUserDispName = None, // (skip, uninteresting?)
        emailPending =
           userRepliedTo.emailNotfPrefs == EmailNotfPrefs.Receive))
  }


  def _makeReviewNotfs(review: Review): List[NotfOfPageAction] = {
    // For now, only consider approvals of posts.
    if (!review.target.isInstanceOf[Post])
      return Nil

    lazy val actionReviewed: Post = review.target.asInstanceOf[Post]
    lazy val userReviewed = actionReviewed.user_!
    lazy val reviewer = review.user_!

    // If the action reviewed was rejected, don't notify anyone.
    if (review.approval.isEmpty)
      return Nil

    // If the actionReviewed was approved with Approval.WellBehavedUser,
    // a notf has already been generated (and right now we're simply
    // confirming that that approval was okay).
    if (actionReviewed.approval == Some(Approval.WellBehavedUser))
      return Nil

    // If the actionReviewed is a reply to the reviewer, don't notify her.
    // (She has obviously read the reply already.)
    if (Some(reviewer.id) == actionReviewed.parentPost.map(_.user_!.id))
      return Nil

    /*
    // Notify the action doer about the approval.
    // -- Or don't? Do people want notfs that their comments were approved?
    // I'd want that, personally, but what if other people consider it spam
    // and unregister?  COULD generate notfs of approvals, *if* I change
    // Notifier.scala to send such notifications at most once a week? (unless
    // there are also other notfs, then they'd be sent at the same time)
    //
    // (Could skip this if reviewer == userReviewed, but needn't care about
    // that case, because moderators' actions are auto approved and we
    // won't get to here.)
    val authorNotf = NotfOfPageAction(
       ctime = review.creationDati,
       recipientUserId = userReviewed.id,
       pageTitle = page.titleText.getOrElse("Unnamed page"),
       pageId = page.id,
       eventType = NotfOfPageAction.Type.MyPostApproved,
       eventActionId = review.id,
       triggerActionId = review.id,
       recipientActionId = actionReviewed.id,
       recipientUserDispName = userReviewed.displayName,
       eventUserDispName = reviewer.displayName,
       triggerUserDispName = None, // (skip, same as event user disp name)
       emailPending = userReviewed.emailNotfPrefs == EmailNotfPrefs.Receive)
       */

    // If the actionReviewed is a reply to some other comment,
    // notify the the author of that other comment, that s/he has a reply
    // (that has been approved).
    val notfToAuthorOfParentPost =
      if (actionReviewed.parentPost.isEmpty) Nil
      else _makePersonalReplyNotf(actionReviewed, Some(review))

    //authorNotf ::
    notfToAuthorOfParentPost
  }
}


// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

