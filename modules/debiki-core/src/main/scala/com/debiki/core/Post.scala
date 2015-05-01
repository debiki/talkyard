/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.User.SystemUserId
import java.{util => ju}
import scala.collection.immutable
import PostStatusBits._


object CollapsedStatus {
  val Open = new CollapsedStatus(0)
}
class CollapsedStatus(val underlying: Int) extends AnyVal {
  def isCollapsed = underlying != 0
  def isExplicitlyCollapsed = (underlying & TreeBits) != 0
  def isPostCollapsed = (underlying & SelfBit) != 0
  //def areRepliesCollapsed = underlying & ChildrenBit
  def isTreeCollapsed = (underlying & TreeBits) == TreeBits
  def areAncestorsCollapsed = (underlying & AncestorsBit) != 0
}


object ClosedStatus {
  val Open = new ClosedStatus(0)
}
class ClosedStatus(val underlying: Int) extends AnyVal {
  def isClosed = underlying != 0
  def isTreeClosed = (underlying & TreeBits) == TreeBits
  def areAncestorsClosed = (underlying & AncestorsBit) != 0
}


object DeletedStatus {
  val NotDeleted = new DeletedStatus(0)
}
class DeletedStatus(val underlying: Int) extends AnyVal {
  def isDeleted = underlying != 0
  def onlyThisDeleted = underlying == SelfBit
  def isPostDeleted = (underlying & SelfBit) != 0
  def isTreeDeleted = (underlying & TreeBits) == TreeBits
  def areAncestorsDeleted = (underlying & AncestorsBit) != AncestorsBit
}


object PostStatusBits {

  /** Means that only the current post (but not its children) has been collapsed or deleted. */
  val SelfBit = 1

  /** Means that all successor posts are collapsed or closed or deleted. */
  val SuccessorsBit = 2

  /** Means this post and all successors. */
  val TreeBits = SelfBit | SuccessorsBit

  /** Means that some ancestor post has been collapsed or closed or deleted and that therefore
    * the current post is also collapsed or closed or deleted. */
  val AncestorsBit = 4

  val AllBits = SelfBit | SuccessorsBit | AncestorsBit
}


/** A post is a page title, a page body or a comment.
  * For example, a forum topic title, topic text, or a reply.
  *
  * SHOULD: If a post has been flagged, it gets hidden. People can click to view it anyway, so that
  * they can notify moderators if posts are being flagged and hidden inappropriately.
  */
case class Post(
  siteId: SiteId,
  pageId: PageId,
  id: PostId,
  parentId: Option[PostId],
  multireplyPostIds: immutable.Set[PostId],
  createdAt: ju.Date,
  createdById: UserId,
  lastEditedAt: Option[ju.Date],
  lastEditedById: Option[UserId],
  lastApprovedEditAt: Option[ju.Date],
  lastApprovedEditById: Option[UserId],
  numDistinctEditors: Int,
  safeVersion: Option[Int],
  approvedSource: Option[String],
  approvedHtmlSanitized: Option[String],
  approvedAt: Option[ju.Date],
  approvedById: Option[UserId],
  approvedVersion: Option[Int],
  currentSourcePatch: Option[String],
  currentVersion: Int,
  collapsedStatus: CollapsedStatus,
  collapsedAt: Option[ju.Date],
  collapsedById: Option[UserId],
  closedStatus: ClosedStatus,
  closedAt: Option[ju.Date],
  closedById: Option[UserId],
  hiddenAt: Option[ju.Date],
  hiddenById: Option[UserId],
  //hiddenReason: ?
  deletedStatus: DeletedStatus,
  deletedAt: Option[ju.Date],
  deletedById: Option[UserId],
  pinnedPosition: Option[Int],
  numPendingFlags: Int,
  numHandledFlags: Int,
  numPendingEditSuggestions: Int,
  numLikeVotes: Int,
  numWrongVotes: Int,
  numTimesRead: Int) {

  require(parentId != Some(id), "DwE5BK4")
  require(!multireplyPostIds.contains(id), "DwE4kWW2")

  require(lastEditedAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE7KEF3")
  require(lastEditedAt.isEmpty == lastEditedById.isEmpty, "DwE0GKW2")

  require(lastApprovedEditAt.isEmpty || lastEditedAt.isDefined, "DwE5Df4")
  require(lastApprovedEditAt.map(_.getTime <= lastEditedAt.get.getTime) != Some(false), "DwE2LYG6")
  require(lastApprovedEditAt.isEmpty == lastApprovedEditById.isEmpty, "DwE9JK3")

  // require(numPendingEditSuggestions == 0 || lastEditSuggestionAt.isDefined, "DwE2GK45)
  // require(lastEditSuggestionAt.map(_.getTime < createdAt.getTime) != Some(false), "DwE77fW2)

  //require(updatedAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE6KPw2)
  require(approvedAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE8KGEI2")

  require(approvedVersion.isEmpty == approvedAt.isEmpty, "DwE4KHI7")
  require(approvedVersion.isEmpty == approvedById.isEmpty, "DwE2KI65")
  require(approvedVersion.isEmpty == approvedSource.isEmpty, "DwE7YFv2")
  require(approvedHtmlSanitized.isEmpty || approvedSource.isDefined, "DwE0IEW1")

  require(approvedSource.map(_.trim.length) != Some(0), "DwE1JY83")
  require(approvedHtmlSanitized.map(_.trim.length) != Some(0), "DwE6BH5")
  require(approvedSource.isDefined || currentSourcePatch.isDefined, "DwE3KI59")
  require(currentSourcePatch.map(_.trim.length) != Some(0), "DwE2bNW5")

  require(approvedVersion.isEmpty || (
    (currentVersion == approvedVersion.get) == currentSourcePatch.isEmpty), "DwE7IEP0")

  require(approvedVersion.map(_ <= currentVersion) != Some(false), "DwE6KJ0")
  require(safeVersion.isEmpty || (
    approvedVersion.isDefined && safeVersion.get <= approvedVersion.get), "DwE2EF4")

  require(0 <= collapsedStatus.underlying && collapsedStatus.underlying <= AllBits &&
    collapsedStatus.underlying != SuccessorsBit)
  require(collapsedAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE0JIk3")
  require(collapsedAt.isDefined == collapsedStatus.isCollapsed, "DwE5KEI3")
  require(collapsedAt.isDefined == collapsedById.isDefined, "DwE60KF3")

  require(closedStatus.underlying >= 0 && closedStatus.underlying <= AllBits &&
    closedStatus.underlying != SuccessorsBit &&
    // Cannot close a single post only, needs to close the whole tree.
    closedStatus.underlying != SelfBit)
  require(closedAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE6IKF3")
  require(closedAt.isDefined == closedStatus.isClosed, "DwE0Kf4")
  require(closedAt.isDefined == closedById.isDefined, "DwE4KI61")

  require(0 <= deletedStatus.underlying && deletedStatus.underlying <= AllBits &&
    deletedStatus.underlying != SuccessorsBit)
  require(deletedAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE6IK84")
  require(deletedAt.isDefined == deletedStatus.isDeleted, "DwE0IGK2")
  require(deletedAt.isDefined == deletedById.isDefined, "DwE14KI7")

  require(hiddenAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE6K2I7")
  require(hiddenAt.isDefined == hiddenById.isDefined, "DwE0B7I3")
  //require(hiddenReason.isEmpty || hiddenAt.isDefined, "DwE3K5I9")

  require(numDistinctEditors >= 0, "DwE2IkG7")
  require(numPendingEditSuggestions >= 0, "DwE0IK0P3")
  require(numPendingFlags >= 0, "DwE4KIw2")
  require(numHandledFlags >= 0, "DwE6IKF3")
  require(numLikeVotes >= 0, "DwEIK7K")
  require(numWrongVotes >= 0, "DwE7YQ08")
  require(numTimesRead >= 0, "DwE2ZfMI3")

  def isReply = PageParts.isReply(id)
  def isMultireply = multireplyPostIds.nonEmpty
  def isHidden = hiddenAt.isDefined
  def isDeleted = deletedStatus.isDeleted
  def isSomeVersionApproved = approvedVersion.isDefined
  def isCurrentVersionApproved = approvedVersion == Some(currentVersion)
  def isVisible = isSomeVersionApproved && !isHidden && !isDeleted

  def pagePostId = PagePostId(pageId, id)
  def hasAnId = id >= PageParts.LowestPostId

  def newChildCollapsedStatus = new CollapsedStatus(
    if ((collapsedStatus.underlying & (SuccessorsBit | AncestorsBit)) != 0) AncestorsBit else 0)

  def newChildClosedStatus = new ClosedStatus(
    if ((closedStatus.underlying & (SuccessorsBit | AncestorsBit)) != 0) AncestorsBit else 0)

  lazy val currentSource: String =
    currentSourcePatch match {
      case None => approvedSource.getOrElse("")
      case Some(patch) => applyPatch(patch, to = approvedSource.getOrElse(""))
    }

  def unapprovedSource: Option[String] = {
    if (isCurrentVersionApproved) None
    else Some(currentSource)
  }

  def currentHtmlSanitized(commonMarkRenderer: CommonMarkRenderer, pageRole: PageRole): String = {
    if (id == PageParts.TitleId) {
      commonMarkRenderer.sanitizeHtml(currentSource)
    }
    else {
      val isBody = id == PageParts.BodyId
      val followLinks = isBody && !pageRole.isWidelyEditable
      commonMarkRenderer.renderAndSanitizeCommonMark(currentSource,
        allowClassIdDataAttrs = isBody, followLinks = followLinks)
    }
  }


  def numEditsToReview = currentVersion - approvedVersion.getOrElse(0)

  def numFlags = numPendingFlags + numHandledFlags

  def createdByUser(people: People): User =
    people.theUser(createdById)


  /** The lower bound of an 80% confidence interval for the number of people that like this post.
    */
  lazy val likeScore: Float = {
    val numLikes = this.numLikeVotes
    // In case there for some weird reason are liked posts with no read count,
    // set numTimesRead to at least numLikes.
    val numTimesRead = math.max(this.numTimesRead, numLikes)
    val avgLikes = numLikes.toFloat / math.max(1, numTimesRead)
    val lowerBound = Distributions.binPropConfIntACLowerBound(
      sampleSize = numTimesRead, proportionOfSuccesses = avgLikes, percent = 80.0f)
    lowerBound
  }


  def parent(pageParts: PageParts): Option[Post] =
    parentId.flatMap(pageParts.post)

  def children(pageParts: PageParts): Seq[Post] =
    pageParts.childrenOf(id)


  /** Setting any flag to true means that status will change to true. Leaving it
    * false means the status will remain unchanged (not that it'll be cleared).
    */
  def copyWithNewStatus(
    currentTime: ju.Date,
    userId: UserId,
    postCollapsed: Boolean = false,
    treeCollapsed: Boolean = false,
    ancestorsCollapsed: Boolean = false,
    treeClosed: Boolean = false,
    ancestorsClosed: Boolean = false,
    postDeleted: Boolean = false,
    treeDeleted: Boolean = false,
    ancestorsDeleted: Boolean = false): Post = {

    // You can collapse a post, although an ancestor is already collapsed. Collapsing it,
    // simply means that it'll remain collapsed, even if the ancestor gets expanded.
    var newCollapsedUnderlying = collapsedStatus.underlying
    var newCollapsedAt = collapsedAt
    var newCollapsedById = collapsedById
    var collapsesNowBecauseOfAncestor = false
    if (ancestorsCollapsed) {
      newCollapsedUnderlying |= AncestorsBit
      collapsesNowBecauseOfAncestor = !collapsedStatus.isCollapsed
    }
    if (postCollapsed) {
      newCollapsedUnderlying |= SelfBit
    }
    if (treeCollapsed) {
      newCollapsedUnderlying |= TreeBits
    }
    if (collapsesNowBecauseOfAncestor || postCollapsed || treeCollapsed) {
      newCollapsedAt = Some(currentTime)
      newCollapsedById = Some(userId)
    }

    // You cannot close a post if an ancestor is already closed, because then the post
    // is closed already.
    var newClosedUnderlying = closedStatus.underlying
    var newClosedAt = closedAt
    var newClosedById = closedById
    if (ancestorsClosed) {
      newClosedUnderlying |= AncestorsBit
      if (!closedStatus.isClosed) {
        newClosedAt = Some(currentTime)
        newClosedById = Some(userId)
      }
    }
    if (!closedStatus.isClosed && treeClosed) {
      newClosedUnderlying |= TreeBits
      newClosedAt = Some(currentTime)
      newClosedById = Some(userId)
    }

    // You cannot delete a post if an ancestor is already deleted, because then the post
    // is deleted already.
    var newDeletedUnderlying = deletedStatus.underlying
    var newDeletedAt = deletedAt
    var newDeletedById = deletedById
    if (ancestorsDeleted) {
      newDeletedUnderlying |= AncestorsBit
    }
    if (postDeleted) {
      newDeletedUnderlying |= SelfBit
    }
    if (treeDeleted) {
      newDeletedUnderlying |= TreeBits
    }
    if ((ancestorsDeleted || postDeleted || treeDeleted) && !isDeleted) {
      newDeletedAt = Some(currentTime)
      newDeletedById = Some(userId)
    }

    copy(
      collapsedStatus = new CollapsedStatus(newCollapsedUnderlying),
      collapsedById = newCollapsedById,
      collapsedAt = newCollapsedAt,
      closedStatus = new ClosedStatus(newClosedUnderlying),
      closedById = newClosedById,
      closedAt = newClosedAt,
      deletedStatus = new DeletedStatus(newDeletedUnderlying),
      deletedById = newDeletedById,
      deletedAt = newDeletedAt)
  }


  def copyWithUpdatedVoteAndReadCounts(actions: Iterable[PostAction], readStats: PostsReadStats)
        : Post = {
    var numLikeVotes = 0
    var numWrongVotes = 0
    for (action <- actions) {
      action match {
        case vote: PostVote =>
          vote.voteType match {
            case PostVoteType.Like =>
              numLikeVotes += 1
            case PostVoteType.Wrong =>
              numWrongVotes += 1
          }
      }
    }
    val numTimesRead = readStats.readCountFor(id)
    copy(
      numLikeVotes = numLikeVotes,
      numWrongVotes = numWrongVotes,
      numTimesRead = numTimesRead)
  }
}



object Post {
  
  val FirstVersion = 1

  def create(
        siteId: SiteId,
        pageId: PageId,
        postId: PostId,
        parent: Option[Post],
        multireplyPostIds: Set[PostId],
        createdAt: ju.Date,
        createdById: UserId,
        source: String,
        htmlSanitized: String,
        approvedById: Option[UserId]): Post = {

    require(multireplyPostIds.nonEmpty == parent.isDefined)

    val currentSourcePatch: Option[String] =
      if (approvedById.isDefined) None
      else Some(makePatch(from = "", to = source))

    // If approved by a human, this initial version is safe.
    val safeVersion =
      approvedById.flatMap(id => if (id != SystemUserId) Some(FirstVersion) else None)

    val (parentsChildrenCollapsedAt, parentsChildrenColllapsedById) = parent match {
      case None =>
        (None, None)
      case Some(parent) =>
        if (parent.newChildCollapsedStatus.areAncestorsCollapsed)
          (Some(createdAt), parent.collapsedById)
        else
          (None, None)
    }

    val (parentsChildrenClosedAt, parentsChildrenClosedById) = parent match {
      case None =>
        (None, None)
      case Some(parent) =>
        if (parent.newChildClosedStatus.areAncestorsClosed)
          (Some(createdAt), parent.closedById)
        else
          (None, None)
    }

    Post(
      siteId = siteId,
      pageId = pageId,
      id = postId,
      parentId = parent.map(_.id),
      multireplyPostIds = multireplyPostIds,
      createdAt = createdAt,
      createdById = createdById,
      lastEditedAt = None,
      lastEditedById = None,
      lastApprovedEditAt = None,
      lastApprovedEditById = None,
      numDistinctEditors = 1,
      safeVersion = safeVersion,
      approvedSource = if (approvedById.isDefined) Some(source) else None,
      approvedHtmlSanitized = if (approvedById.isDefined) Some(htmlSanitized) else None,
      approvedAt = if (approvedById.isDefined) Some(createdAt) else None,
      approvedById = approvedById,
      approvedVersion = if (approvedById.isDefined) Some(FirstVersion) else None,
      currentSourcePatch = currentSourcePatch,
      currentVersion = FirstVersion,
      collapsedStatus = parent.map(_.newChildCollapsedStatus) getOrElse CollapsedStatus.Open,
      collapsedAt = parentsChildrenCollapsedAt,
      collapsedById = parentsChildrenColllapsedById,
      closedStatus = parent.map(_.newChildClosedStatus) getOrElse ClosedStatus.Open,
      closedAt = parentsChildrenClosedAt,
      closedById = parentsChildrenClosedById,
      hiddenAt = None,
      hiddenById = None,
      deletedStatus = DeletedStatus.NotDeleted,
      deletedAt = None,
      deletedById = None,
      pinnedPosition = None,
      numPendingFlags = 0,
      numHandledFlags = 0,
      numPendingEditSuggestions = 0,
      numLikeVotes = 0,
      numWrongVotes = 0,
      numTimesRead = 0)
  }

  def createTitle(
        siteId: SiteId,
        pageId: PageId,
        createdAt: ju.Date,
        createdById: UserId,
        source: String,
        htmlSanitized: String,
        approvedById: Option[UserId]): Post =
    create(siteId, pageId = pageId, postId = PageParts.TitleId, parent = None,
      multireplyPostIds = Set.empty, createdAt = createdAt, createdById = createdById,
      source = source, htmlSanitized = htmlSanitized, approvedById = approvedById)

  def createBody(
        siteId: SiteId,
        pageId: PageId,
        createdAt: ju.Date,
        createdById: UserId,
        source: String,
        htmlSanitized: String,
        approvedById: Option[UserId]): Post =
    create(siteId, pageId = pageId, postId = PageParts.BodyId, parent = None,
      multireplyPostIds = Set.empty, createdAt = createdAt, createdById = createdById,
      source = source, htmlSanitized = htmlSanitized, approvedById = approvedById)


  // def fromJson(json: JsValue) = Protocols.jsonToPost(json)


  /** Sorts posts so e.g. interesting ones appear first, and deleted ones last.
    */
  def sortPosts(posts: Seq[Post]): Seq[Post] = {
    posts.sortWith(sortPostsFn)
  }

  /** NOTE: Keep in sync with `sortPostIdsInPlace()` in client/app/ReactStore.ts
    */
  private def sortPostsFn(postA: Post, postB: Post): Boolean = {
    /* From app/debiki/HtmlSerializer.scala:
    if (a.pinnedPosition.isDefined || b.pinnedPosition.isDefined) {
      // 1 means place first, 2 means place first but one, and so on.
      // -1 means place last, -2 means last but one, and so on.
      val aPos = a.pinnedPosition.getOrElse(0)
      val bPos = b.pinnedPosition.getOrElse(0)
      assert(aPos != 0 || bPos != 0)
      if (aPos == 0) return bPos < 0
      if (bPos == 0) return aPos > 0
      if (aPos * bPos < 0) return aPos > 0
      return aPos < bPos
    } */

    // Place deleted posts last; they're rather uninteresting?
    if (!postA.deletedStatus.isDeleted && postB.deletedStatus.isDeleted)
      return true

    if (postA.deletedStatus.isDeleted && !postB.deletedStatus.isDeleted)
      return false

    // Place multireplies after normal replies. And sort multireplies by time,
    // for now, so it never happens that a multireply ends up placed before another
    // multireply that it replies to.
    // COULD place interesting multireplies first, if they're not constrained by
    // one being a reply to another.
    if (postA.multireplyPostIds.nonEmpty && postB.multireplyPostIds.nonEmpty) {
      if (postA.createdAt.getTime < postB.createdAt.getTime)
        return true
      if (postA.createdAt.getTime > postB.createdAt.getTime)
        return false
    }
    else if (postA.multireplyPostIds.nonEmpty) {
      return false
    }
    else if (postB.multireplyPostIds.nonEmpty) {
      return true
    }

    // Place interesting posts first.
    if (postA.likeScore > postB.likeScore)
      return true

    if (postA.likeScore < postB.likeScore)
      return false

    // Newest posts first. No, last
    if (postA.createdAt.getTime < postB.createdAt.getTime)
      return true
    else
      return false
  }

}



case class BrowserIdData(
  ip: String,
  idCookie: Option[String],
  fingerprint: Int) {

  require(ip.nonEmpty, "DwE6G9F0")
  require(idCookie.map(_.isEmpty) != Some(true), "DwE3GJ79")
}
