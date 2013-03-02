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


  def perhapsApproveNewPage(
        folderReq: PageRequest[_], pageRole: PageRole, parentPageId: Option[String])
        : Option[Approval] = {

    if (folderReq.pageExists) throwForbidden(
      "DwE10X3k3", o"""Page `${folderReq.pageId_!}' already exists; I cannot grant
       an approval to create it, again""") //"""

    if (folderReq.user_!.isAdmin)
      return Some(Approval.AuthoritativeUser)

    // For now, allow other people to create forum topics only.
    if (pageRole == PageRole.ForumTopic) {

      if (parentPageId.isEmpty)
        throwBadReq("DwE76BCK0", "No parent page id specified")

      val parentMeta =
        folderReq.dao.loadPageMeta(parentPageId.get) getOrElse throwNotFound(
          "DwE78BI21", s"Parent page not found, id: `${parentPageId.get}'")

      if (parentMeta.pageRole != PageRole.Forum)
        throwForbidden("DwE830BIR5", "A forum topic's parent page must be a forum")

      // For now:
      return Some(Approval.Preliminary)

      // ...but SECURITY COULD check recent actions, break up
      // _checkUserHistoryPerhapsApprove() into reusable parts and reuse, somehow?
    }

    None
  }


  def upholdNewPageApproval(pageReq: PageRequest[_], oldApproval: Approval)
        : Option[Approval] = {
    // For now:
    Some(oldApproval)

    // SECURITY: Perhaps retract new page approval:
    // In the future: Check recent actions, and if the user is apparently very
    // evil, retract the approval (return false). This will make the user upset,
    // because s/he has already been allowed to create the page and written
    // e.g. a new forum topic. Now the page is supposed to be saved and
    // the page created lazily. But the server changes its mind and retracts the
    // approval! The user will be upset for sure (?), so s/he better be an
    // "evil" user for sure (so everyone else will understand why the server retracted
    /// the page creation approval).
  }


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

    val recentActions: List[PostAction] =
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


  private def _considerPosts(recentActions: List[PostAction]): Option[Approval] = {
    var manuallyApprovedCount = 0
    var unreviewedCount = 0
    var postCount = 0

    for {
      action <- recentActions if action.isInstanceOf[Post]
      post = action.asInstanceOf[Post]
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


  private def _considerFlags(recentActions: List[PostAction]): Option[Approval] = {
    for (flag: PostAction <- recentActions if flag.action.isInstanceOf[Flag]) {
      // If any post has been flagged, don't approve.
      return None
    }
    Some(Approval.WellBehavedUser)
  }


  private def _considerRatings(recentActions: List[PostAction]): Option[Approval] = {
    // Don't consider ratings at all, for now.
    Some(Approval.WellBehavedUser)
  }


}
