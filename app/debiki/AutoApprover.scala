/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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

package debiki

import com.debiki.core._
import debiki.dao.SiteDao
import requests.{PageRequest, DebikiRequest}
import DebikiHttp._
import Prelude._


/**
 * Analyzes a user and his/her history, and perhaps automatically approves
 * an action s/he has requested.
 */
object AutoApprover {

  // Minor BUG: If a user just made 30 edits in a row, only those edits will be loaded
  // by RdbSiteDao — no posts will be loaded, and neither any approvals of any posts.
  // The computer might therefore "forget" that the user should in fact be  WellBehaved-
  // auto-approved — then, a moderator needs to approve the user manually, again.
  private[debiki] val RecentActionsLimit = 30


  private def calcMaxNumPendingComments(numCommentsManuallyApproved: Int) =
    2 + math.log1p(numCommentsManuallyApproved) * MaxPendingCommentsLogBase


  /** Used when computing max num pending comments. */
  private val MaxPendingCommentsLogBase = 1.0 / math.log(1.1)


  def perhapsApproveNewPage(
        request: DebikiRequest[_], pageRole: PageRole, parentPageId: Option[PageId])
        : Option[Approval] = {

    if (request.user_!.isAdmin)
      return Some(Approval.AuthoritativeUser)

    SECURITY // COULD load `ancestorIdsParentFirst` and check access to all those ancestors.
    // (In the future, when it's at all possible to configure access :-))

    // For now, allow other people to create forum topics only.
    if (pageRole == PageRole.ForumTopic) {

      if (parentPageId.isEmpty)
        throwBadReq("DwE76BCK0", "No parent page id specified")

      val parentMeta =
        request.dao.loadPageMeta(parentPageId.get) getOrElse throwNotFound(
          "DwE78BI21", s"Parent page not found, id: `${parentPageId.get}'")

      if (parentMeta.pageRole != PageRole.ForumCategory && parentMeta.pageRole != PageRole.Forum)
        throwForbidden("DwE830BIR5", "A ForumTopic's parent page must be a Forum or ForumCategory")

      // For now:
      return Some(Approval.Preliminary)

      // ...but SECURITY COULD check recent actions, break up
      // _checkUserHistoryPerhapsApprove() into reusable parts and reuse, somehow?
    }

    None
  }


  def perhapsApprove(pageReq: PageRequest[_]): Option[Approval] = {
    if (pageReq.user_!.isAdmin)
      Some(Approval.AuthoritativeUser)
    else {
      perhapsApproveImpl(pageReq.dao, ip = pageReq.ip, pageReq.theUser.id)
    }
  }


  /** Exposed to simplify debugging via controllers.Debug.
    */
  def perhapsApproveImpl(dao: SiteDao, ip: IpAddress, userId: UserId)
        : Option[Approval] = {
    val history = loadUserHistory(dao, ip, userId = userId)
    checkUserHistoryPerhapsApprove(history)
  }


  private def loadUserHistory(dao: SiteDao, ip: IpAddress, userId: UserId)
        : List[PostAction[_]] = {

    val (actionsFromIp, peopleFromIp) =
      dao.loadRecentActionExcerpts(fromIp = Some(ip), limit = RecentActionsLimit)

    val (actionsByIdentity, peopleForIdty) =
      if (User.isRoleId(userId)) {
        // I think there a minor bug in loadRecentActionExcerpts(byRole = ...) in debiki-dao-rdb,
        // inside buildByPersonQuery, search for "BUG".
        dao.loadRecentActionExcerpts(byRole = Some(userId), limit = RecentActionsLimit)
      }
      else {
        // COULD load actions based on browser cookie or fingerprint.
        (Nil, People())
      }

    // lazy val actionsByGuestsWithSameEmail =
    // -- or??: lazy val actionsByAnyoneWithSameEmail =
    //   if (pageReq.emailAddr.isEmpty) Nil
    //   else pageReq.dao.loadRecentActionExcerpts(byEmail = pageReq.emailAddr)

    val recentActions: List[PostAction[_]] =
      (actionsFromIp.toList ::: actionsByIdentity.toList)
         .sortBy(- _.creationDati.getTime).distinct

    recentActions
  }


  def checkUserHistoryPerhapsApprove(recentActions: List[PostAction[_]]): Option[Approval] = {
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


  private def _considerPosts(recentActions: List[PostAction[_]]): Option[Approval] = {
    var anyCurrentApproval: Option[Approval] = None
    var numPosts = 0

    for {
      action <- recentActions if action.isInstanceOf[Post]
      post = action.asInstanceOf[Post]
    } {
      numPosts += 1

      // If any recent post has been rejected, don't auto approve.
      // ??? But I should verify that any edits were made by the current user ???
      // (What if it's a wiki page, and someone else spoiled the comment.)
      if (post.currentVersionRejected)
        return None

      // Assume an old post was "bad" if it has been deleted by anyone but the author.
      if (post.isPostDeleted && post.postDeletedById != Some(post.userId))
        return None

      // If any recent post flagged, but the flags haven't been reviewed,
      // don't approve this post.
      if (post.flagsPendingReview.nonEmpty)
        return None

      // After any manual approval, consider this user being a well behaved user.
      // And continue automatically approving a well behaved user.
      // Ooops, this makes any user well behaved, if anything from the same ip number has
      // been manually approved. Well, not totally unreasonable, could tweak this
      // behavior later.
      val startConsiderWellBehaved = post.someVersionManuallyApproved
      val alreadyConsideredWellBehaved = post.lastApprovalType.map(_ == Approval.WellBehavedUser)
      if (startConsiderWellBehaved || alreadyConsideredWellBehaved == Some(true)) {
        anyCurrentApproval = Some(Approval.WellBehavedUser)
      }
    }

    // Preliminarily approve the very first 2 comments of a new user.
    if (anyCurrentApproval.isEmpty && numPosts + 1 <= 2)
      anyCurrentApproval = Some(Approval.Preliminary)

    anyCurrentApproval
  }


  private def _considerFlags(recentActions: List[PostAction[_]]): Option[Approval] = {
    def isFlag(rawPostAction: PostAction[_]) = rawPostAction match {
      case a: RawPostAction[_] => a.payload.isInstanceOf[PostActionPayload.Flag]
      case _ => false
    }

    for (action <- recentActions if isFlag(action)) {
      // If any post has been flagged, don't approve.
      return None
    }
    Some(Approval.WellBehavedUser)
  }


  private def _considerRatings(recentActions: List[PostAction[_]]): Option[Approval] = {
    // Don't consider ratings at all, for now.
    Some(Approval.WellBehavedUser)
  }


}
