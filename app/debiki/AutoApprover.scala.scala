// Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)

package debiki

import com.debiki.v0._
import controllers._
import DebikiHttp._
import Prelude._


/**
 * Analyzes a user and his/her history, and perhaps automatically approves
 * an action s/he has requested.
 */
object AutoApprover {

  private[debiki] val Limit = 15

  val NumFirstCommentsToApprovePreliminarily = 2
  val TooManyUnreviewedComments = 10

  def perhapsApprove(pageReq: PageRequest[_]): Option[Approval] = {
    if (pageReq.user_!.isAdmin)
      Some(Approval.AuthoritativeUser)
    else
      _checkUserHistoryPerhapsApprove(pageReq)
  }


  private def _checkUserHistoryPerhapsApprove(pageReq: PageRequest[_])
        : Option[Approval] = {

    val (actionsFromIp, peopleFromIp) =
      pageReq.dao.loadRecentActionExcerpts(
        fromIp = Some(pageReq.ip), limit = Limit)

    val (actionsByIdentity, peopleForIdty) =
      pageReq.dao.loadRecentActionExcerpts(
        byIdentity = Some(pageReq.identity_!.id), limit = Limit)

    // lazy val actionsByGuestsWithSameEmail =
    // -- or??: lazy val actionsByAnyoneWithSameEmail =
    //   if (pageReq.emailAddr.isEmpty) Nil
    //   else pageReq.dao.loadRecentActionExcerpts(byEmail = pageReq.emailAddr)

    val recentActions: List[ViAc] =
      (actionsFromIp.toList ::: actionsByIdentity.toList)
         .sortBy(- _.creationDati.getTime).distinct

    val approval: Option[Approval] = for {
      approvalGivenPosts <- _considerPosts(recentActions)
      approvalGivenFlags <- _considerFlags(recentActions)
      approvalGivenRatings <- _considerRatings(recentActions)
    } yield {
      if (approvalGivenPosts == Approval.Preliminary ||
          approvalGivenFlags == Approval.Preliminary ||
          approvalGivenRatings == Approval.Preliminary) {
        Approval.Preliminary
      } else {
        assert(approvalGivenPosts == Approval.WellBehavedUser)
        assert(approvalGivenFlags == Approval.WellBehavedUser)
        assert(approvalGivenRatings == Approval.WellBehavedUser)
        Approval.WellBehavedUser
      }
    }

    approval
  }


  private def _considerPosts(recentActions: List[ViAc]): Option[Approval] = {
    var manuallyApprovedCount = 0
    var unreviewedCount = 0
    var postCount = 0

    for {
      action <- recentActions if action.isInstanceOf[ViPo]
      post = action.asInstanceOf[ViPo]
    } {
      // If any recent post has been rejected, don't auto approve.
      if (post.currentVersionRejected)
        return None

      postCount += 1
      if (post.someVersionManuallyApproved) manuallyApprovedCount += 1
      else unreviewedCount += 1
    }

    // If there are too many outstanding unreviewed comments, don't approve.
    // (Even if all your comments that've been reviewed have actually been
    // approved.)
    if (unreviewedCount >= TooManyUnreviewedComments)
      return None

    // If all initial comments, plus the moderated one,
    // have been approved, auto approve.
    if (manuallyApprovedCount > NumFirstCommentsToApprovePreliminarily)
      return Some(Approval.Preliminary)

    // Allow all new users to post a few comments, and approve them
    // preliminarily. I hope that spammers tend to post many comments?
    if (postCount < NumFirstCommentsToApprovePreliminarily)
      return Some(Approval.Preliminary)

    // If you've posted more than 1 or 2 comments, and they haven't
    // been reviewed, don't auto approve any more comments.
    None
  }


  private def _considerFlags(recentActions: List[ViAc]): Option[Approval] = {
    for (flag: ViAc <- recentActions if flag.action.isInstanceOf[Flag]) {
      // If any post has been flagged, don't approve.
      return None
    }
    Some(Approval.WellBehavedUser)
  }


  private def _considerRatings(recentActions: List[ViAc]): Option[Approval] = {
    // Don't consider ratings at all, for now.
    Some(Approval.WellBehavedUser)
  }


}
