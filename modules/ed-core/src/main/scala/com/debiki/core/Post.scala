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

import com.debiki.core.Prelude._
import java.{util => ju}
import org.scalactic.{Good, Bad}

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
  def toInt = underlying
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


/*
object PostBitFlags {
  val ChronologicalBitMask = 1 << 0
  val ChatBitMask = 1 << 1
  val ThreadedChatBitMask = ChatBitMask
  val ChronologicalChatBitMask = ChatBitMask | ChronologicalBitMask

  val AuthorHiddenBitMask = 1 << 2

  val GuestWikiBitMask = 1 << 3
  val MemberWikiBitMask = 1 << 4
  val StaffWikiBitMask = 1 << 5

  val BranchSidewaysBitMask = 1 << 6  // but what about showing the first X children only?

  val FormBitMask = 1 << 8
}


class PostBitFlags(val bits: Int) extends AnyVal {
  import PostBitFlags._

  def isChronologicalChat = (bits & ChronologicalChatBitMask) != 0   // 3
  def isAuthorHidden = (bits & AuthorHiddenBitMask) != 0             // 4
  def isGuestWiki = (bits & GuestWikiBitMask) != 0                   // 8
  def isMemberWiki = (bits & MemberWikiBitMask) != 0                 // 16
  def isStaffWiki = (bits & StaffWikiBitMask) != 0                   // 32
  def isBranchSideways = (bits & BranchSidewaysBitMask) != 0         // 64
  def isForm = (bits & FormBitMask) != 0                             // 256

  def isSelfCollapsed = bits & 10
  def isSuccessorsCollapsed = bits & 11
  def isAncestorCollapsed = bits & 12

  def isSelfClosed = bits & 10
  def isSuccessorsClosed = bits & 11
  def isAncestorClosed = bits & 12

  def isSelfHidden = bits & 10
  def isSuccessorsHidden = bits & 11
  def isAncestorHidden = bits & 12

  def isSelfDeleted = bits & 10
  def isSuccessorsDeleted = bits & 11
  def isAncestorDeleted = bits & 12

? def isFrozen = bits & 10
? def isSuccessorsFrozen = bits & 11
? def isAncestorFrozen = bits & 12

} */


sealed abstract class PostType(protected val IntValue: Int) {
  def toInt = IntValue
  def isWiki = false
}

object PostType {
  /** A normal post, e.g. a forum topic or reply or blog post, whatever. */
  case object Normal extends PostType(1)

  /** A comment in the flat section below the threaded discussion section. */
  case object Flat extends PostType(2)

  /** A chat message in a chat room. */
  case object ChatMessage extends PostType(3)

  /** Any staff member can edit this post. No author name shown. */
  case object StaffWiki extends PostType(11) {
    override def isWiki = true
  }

  /** Any community member (doesn't include guests) can edit this post. No author name shown. */
  case object CommunityWiki extends PostType(12) {
    override def isWiki = true
  }

  case object CompletedForm extends PostType(21)

  // Later:
  // - FormSubmission(21)? Shown only to the page author(s) + admins? Cannot be voted on. Sorted by
  //    date. For FormSubmission pages only.
  // - PrivateMessage(31)? Shown to the receiver only plus admins.

  def fromInt(value: Int): Option[PostType] = Some(value match {
    case Normal.IntValue => Normal
    case Flat.IntValue => Flat
    case ChatMessage.IntValue => ChatMessage
    case StaffWiki.IntValue => StaffWiki
    case CommunityWiki.IntValue => CommunityWiki
    case CompletedForm.IntValue => CompletedForm
    case _ => return None
  })
}



/** A post is a page title, a page body or a comment.
  * For example, a forum topic title, topic text, or a reply.
  *
  * SHOULD: If a post has been flagged, it gets hidden. People can click to view it anyway, so that
  * they can notify moderators if posts are being flagged and hidden inappropriately.
  */
case class Post(
  // TODO rename to 'id', but first rename 'id' to 'nr'.
  uniqueId: UniquePostId,
  pageId: PageId,
  nr: PostNr,
  parentNr: Option[PostNr],
  multireplyPostNrs: immutable.Set[PostNr],
  tyype: PostType,
  createdAt: ju.Date,
  createdById: UserId,
  currentRevisionById: UserId,
  currentRevStaredAt: ju.Date,
  currentRevLastEditedAt: Option[ju.Date],
  currentSourcePatch: Option[String],
  currentRevisionNr: Int,
  previousRevisionNr: Option[Int],
  lastApprovedEditAt: Option[ju.Date],
  lastApprovedEditById: Option[UserId],
  numDistinctEditors: Int,
  safeRevisionNr: Option[Int],
  approvedSource: Option[String],
  approvedHtmlSanitized: Option[String],
  approvedAt: Option[ju.Date],
  approvedById: Option[UserId],
  approvedRevisionNr: Option[Int],
  collapsedStatus: CollapsedStatus,
  collapsedAt: Option[ju.Date],
  collapsedById: Option[UserId],
  closedStatus: ClosedStatus,
  closedAt: Option[ju.Date],
  closedById: Option[UserId],
  bodyHiddenAt: Option[ju.Date],
  bodyHiddenById: Option[UserId],
  bodyHiddenReason: Option[String],
  deletedStatus: DeletedStatus,
  deletedAt: Option[ju.Date],
  deletedById: Option[UserId],
  pinnedPosition: Option[Int],
  branchSideways: Option[Byte],
  numPendingFlags: Int,
  numHandledFlags: Int,
  numPendingEditSuggestions: Int,
  numLikeVotes: Int,
  numWrongVotes: Int,
  numBuryVotes: Int,
  numUnwantedVotes: Int,
  numTimesRead: Int) {

  require(uniqueId >= 1, "DwE4WEKQ8")
  require(!parentNr.contains(nr), "DwE5BK4")
  require(!multireplyPostNrs.contains(nr), "DwE4kWW2")
  require(multireplyPostNrs.size != 1, "DwE2KFE7") // size 1 = does not reply to many people
  require(multireplyPostNrs.isEmpty || parentNr.isDefined || isFlat, "DwE5GKF2")

  require(currentRevStaredAt.getTime >= createdAt.getTime, "DwE8UFYM5")
  require(!currentRevLastEditedAt.exists(_.getTime < currentRevStaredAt.getTime), "DwE7KEF3")
  require(currentRevisionById == createdById || currentRevisionNr > FirstRevisionNr, "DwE0G9W2")

  require(lastApprovedEditAt.isEmpty == lastApprovedEditById.isEmpty, "DwE9JK3")
  if (lastApprovedEditAt.isDefined && currentRevLastEditedAt.isDefined) {
    require(lastApprovedEditAt.get.getTime <= currentRevLastEditedAt.get.getTime, "DwE2LYG6")
  }

  // require(numPendingEditSuggestions == 0 || lastEditSuggestionAt.isDefined, "DwE2GK45)
  // require(lastEditSuggestionAt.map(_.getTime < createdAt.getTime) != Some(false), "DwE77fW2)

  //require(updatedAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE6KPw2)
  require(approvedAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE8KGEI2")

  require(approvedRevisionNr.isEmpty == approvedAt.isEmpty, "DwE4KHI7")
  require(approvedRevisionNr.isEmpty == approvedById.isEmpty, "DwE2KI65")
  require(approvedRevisionNr.isEmpty == approvedSource.isEmpty, "DwE7YFv2")
  require(approvedHtmlSanitized.isEmpty || approvedSource.isDefined, "DwE0IEW1") //?why not == .isEmpty

  require(approvedSource.map(_.trim.length) != Some(0), "DwE1JY83")
  require(approvedHtmlSanitized.map(_.trim.length) != Some(0), "DwE6BH5")
  require(approvedSource.isDefined || currentSourcePatch.isDefined, "DwE3KI59")
  require(currentSourcePatch.map(_.trim.length) != Some(0), "DwE2bNW5")

  // If the current version of the post has been approved, then one doesn't need to
  // apply any patch to get from the approved version to the current version (since they
  // are the same).
  require(approvedRevisionNr.isEmpty || (
    (currentRevisionNr == approvedRevisionNr.get) == currentSourcePatch.isEmpty), "DwE7IEP0")

  require(approvedRevisionNr.map(_ <= currentRevisionNr) != Some(false), "DwE6KJ0")
  require(safeRevisionNr.isEmpty || (
    approvedRevisionNr.isDefined && safeRevisionNr.get <= approvedRevisionNr.get), "DwE2EF4")

  require(previousRevisionNr.isEmpty || currentRevisionNr > FirstRevisionNr, "EsE7JYR3")
  require(!previousRevisionNr.exists(_ >= currentRevisionNr), "DwE7UYG3")

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

  require(bodyHiddenAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE6K2I7")
  require(bodyHiddenAt.isDefined == bodyHiddenById.isDefined, "DwE0B7I3")
  require(bodyHiddenReason.isEmpty || bodyHiddenAt.isDefined, "DwE3K5I9")

  require(numDistinctEditors >= 0, "DwE2IkG7")
  require(numPendingEditSuggestions >= 0, "DwE0IK0P3")
  require(numPendingFlags >= 0, "DwE4KIw2")
  require(numHandledFlags >= 0, "DwE6IKF3")
  require(numLikeVotes >= 0, "DwEIK7K")
  require(numWrongVotes >= 0, "DwE7YQ08")
  require(numBuryVotes >= 0, "DwE5FKW2")
  require(numUnwantedVotes >= 0, "DwE4GKY2")
  require(numTimesRead >= 0, "DwE2ZfMI3")

  def isReply = PageParts.isReply(nr)
  def isTitle = nr == PageParts.TitleNr
  def isOrigPost = nr == PageParts.BodyNr
  def isOrigPostReply = PageParts.isReply(nr) && parentNr.contains(PageParts.BodyNr)
  def isMultireply = multireplyPostNrs.nonEmpty
  def isFlat = tyype == PostType.Flat
  def isBodyHidden = bodyHiddenAt.isDefined
  def isDeleted = deletedStatus.isDeleted
  def isSomeVersionApproved = approvedRevisionNr.isDefined
  def isCurrentVersionApproved = approvedRevisionNr == Some(currentRevisionNr)
  def isVisible = isSomeVersionApproved && !isBodyHidden && !isDeleted  // (rename to isActive? isInUse?)
  def isWiki = tyype.isWiki

  def pagePostId = PagePostId(pageId, uniqueId)
  def pagePostNr = PagePostNr(pageId, nr)
  def hasAnId = nr >= PageParts.LowestPostNr

  def createdAtUnixSeconds = createdAt.getTime / 1000

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
    if (isCurrentVersionApproved && approvedHtmlSanitized.isDefined) {
      approvedHtmlSanitized.get
    }
    else if (nr == PageParts.TitleNr) {
      commonMarkRenderer.sanitizeHtml(currentSource)
    }
    else if (tyype == PostType.CompletedForm) {
      CompletedFormRenderer.renderJsonToSafeHtml(currentSource) getMakeGood { errorMessage =>
        val unsafeText = s"Error rendering source to html: $errorMessage [EsE7Y4KW8]"
        org.owasp.encoder.Encode.forHtmlContent(unsafeText)
      }
    }
    else {
      val isBody = nr == PageParts.BodyNr
      val followLinks = isBody && !pageRole.isWidelyEditable
      commonMarkRenderer.renderAndSanitizeCommonMark(currentSource,
        allowClassIdDataAttrs = isBody, followLinks = followLinks)
    }
  }

  /** Renders the current markup just in order to let the caller find <a href=...> links
    * and other links.
    */
  def currentHtmlSanitizedToFindLinks(commonMarkRenderer: CommonMarkRenderer): String = {
    if (nr == PageParts.TitleNr) ""
    else commonMarkRenderer.renderAndSanitizeCommonMark(currentSource,
      allowClassIdDataAttrs = false, followLinks = false)
  }

  def numEditsToReview = currentRevisionNr - approvedRevisionNr.getOrElse(0)

  def numFlags = numPendingFlags + numHandledFlags


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
    parentNr.flatMap(pageParts.post)

  def children(pageParts: PageParts): Seq[Post] =
    pageParts.childrenBestFirstOf(nr)


  /** Setting any flag to true means that status will change to true. Leaving it
    * false means the status will remain unchanged (not that it'll be cleared).
    */
  def copyWithNewStatus(
    currentTime: ju.Date,
    userId: UserId,
    bodyHidden: Boolean = false,
    bodyUnhidden: Boolean = false,
    bodyHiddenReason: Option[String] = None,
    postCollapsed: Boolean = false,
    treeCollapsed: Boolean = false,
    ancestorsCollapsed: Boolean = false,
    treeClosed: Boolean = false,
    ancestorsClosed: Boolean = false,
    postDeleted: Boolean = false,
    treeDeleted: Boolean = false,
    ancestorsDeleted: Boolean = false): Post = {

    var newBodyHiddenAt = bodyHiddenAt
    var newBodyHiddenById = bodyHiddenById
    var newBodyHiddenReason = bodyHiddenReason
    if (bodyHidden && bodyUnhidden) {
      die("DwE6KUP2")
    }
    else if (bodyUnhidden && bodyHiddenReason.isDefined) {
      die("EdE4KF0YW5")
    }
    else if (bodyHidden && !isBodyHidden) {
      newBodyHiddenAt = Some(currentTime)
      newBodyHiddenById = Some(userId)
      newBodyHiddenReason = bodyHiddenReason
    }
    else if (bodyUnhidden && isBodyHidden) {
      newBodyHiddenAt = None
      newBodyHiddenById = None
      newBodyHiddenReason = None
    }

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
      bodyHiddenAt = newBodyHiddenAt,
      bodyHiddenById = newBodyHiddenById,
      bodyHiddenReason = newBodyHiddenReason,
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
    var numBuryVotes = 0
    var numUnwantedVotes = 0
    for (action <- actions) {
      action match {
        case vote: PostVote =>
          vote.voteType match {
            case PostVoteType.Like =>
              numLikeVotes += 1
            case PostVoteType.Wrong =>
              numWrongVotes += 1
            case PostVoteType.Bury =>
              numBuryVotes += 1
            case PostVoteType.Unwanted =>
              numUnwantedVotes += 1
          }
        case _ => ()  // e.g. a flag. Skip.
      }
    }
    val numTimesRead = readStats.readCountFor(nr)
    copy(
      numLikeVotes = numLikeVotes,
      numWrongVotes = numWrongVotes,
      numBuryVotes = numBuryVotes,
      numUnwantedVotes = numUnwantedVotes,
      numTimesRead = numTimesRead)
  }
}



object Post {

  val FirstVersion = 1

  def create(
        uniqueId: UniquePostId,
        pageId: PageId,
        postNr: PostNr,
        parent: Option[Post],
        multireplyPostNrs: Set[PostNr],
        postType: PostType,
        createdAt: ju.Date,
        createdById: UserId,
        source: String,
        htmlSanitized: String,
        approvedById: Option[UserId]): Post = {

    require(multireplyPostNrs.isEmpty || parent.isDefined || postType == PostType.Flat, "DwE4KFK28")

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
      uniqueId = uniqueId,
      pageId = pageId,
      nr = postNr,
      parentNr = parent.map(_.nr),
      multireplyPostNrs = multireplyPostNrs,
      tyype = postType,
      createdAt = createdAt,
      createdById = createdById,
      currentRevisionById = createdById,
      currentRevStaredAt = createdAt,
      currentRevLastEditedAt = None,
      currentSourcePatch = currentSourcePatch,
      currentRevisionNr = FirstVersion,
      lastApprovedEditAt = None,
      lastApprovedEditById = None,
      numDistinctEditors = 1,
      safeRevisionNr = safeVersion,
      approvedSource = if (approvedById.isDefined) Some(source) else None,
      approvedHtmlSanitized = if (approvedById.isDefined) Some(htmlSanitized) else None,
      approvedAt = if (approvedById.isDefined) Some(createdAt) else None,
      approvedById = approvedById,
      approvedRevisionNr = if (approvedById.isDefined) Some(FirstVersion) else None,
      previousRevisionNr = None,
      collapsedStatus = parent.map(_.newChildCollapsedStatus) getOrElse CollapsedStatus.Open,
      collapsedAt = parentsChildrenCollapsedAt,
      collapsedById = parentsChildrenColllapsedById,
      closedStatus = parent.map(_.newChildClosedStatus) getOrElse ClosedStatus.Open,
      closedAt = parentsChildrenClosedAt,
      closedById = parentsChildrenClosedById,
      bodyHiddenAt = None,
      bodyHiddenById = None,
      bodyHiddenReason = None,
      deletedStatus = DeletedStatus.NotDeleted,
      deletedAt = None,
      deletedById = None,
      pinnedPosition = None,
      branchSideways = None,
      numPendingFlags = 0,
      numHandledFlags = 0,
      numPendingEditSuggestions = 0,
      numLikeVotes = 0,
      numWrongVotes = 0,
      numBuryVotes = 0,
      numUnwantedVotes = 0,
      numTimesRead = 0)
  }

  def createTitle(
        uniqueId: UniquePostId,
        pageId: PageId,
        createdAt: ju.Date,
        createdById: UserId,
        source: String,
        htmlSanitized: String,
        approvedById: Option[UserId]): Post =
    create(uniqueId, pageId = pageId, postNr = PageParts.TitleNr, parent = None,
      multireplyPostNrs = Set.empty, postType = PostType.Normal,
      createdAt = createdAt, createdById = createdById,
      source = source, htmlSanitized = htmlSanitized, approvedById = approvedById)

  def createBody(
        uniqueId: UniquePostId,
        pageId: PageId,
        createdAt: ju.Date,
        createdById: UserId,
        source: String,
        htmlSanitized: String,
        approvedById: Option[UserId],
        postType: PostType = PostType.Normal): Post =
    create(uniqueId, pageId = pageId, postNr = PageParts.BodyNr, parent = None,
      multireplyPostNrs = Set.empty, postType,
      createdAt = createdAt, createdById = createdById,
      source = source, htmlSanitized = htmlSanitized, approvedById = approvedById)


  // def fromJson(json: JsValue) = Protocols.jsonToPost(json)


  /** Sorts posts so e.g. interesting ones appear first, and deleted ones last.
    */
  def sortPostsBestFirst(posts: immutable.Seq[Post]): immutable.Seq[Post] = {
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
    if (postA.multireplyPostNrs.nonEmpty && postB.multireplyPostNrs.nonEmpty) {
      if (postA.createdAt.getTime < postB.createdAt.getTime)
        return true
      if (postA.createdAt.getTime > postB.createdAt.getTime)
        return false
    }
    else if (postA.multireplyPostNrs.nonEmpty) {
      return false
    }
    else if (postB.multireplyPostNrs.nonEmpty) {
      return true
    }

    // Show unwanted posts last.
    val unwantedA = postA.numUnwantedVotes > 0
    val unwantedB = postB.numUnwantedVotes > 0
    if (unwantedA && unwantedB) {
      if (postA.numUnwantedVotes < postB.numUnwantedVotes)
        return true
      if (postA.numUnwantedVotes > postB.numUnwantedVotes)
        return false
    }
    else if (unwantedA) {
      return false
    }
    else if (unwantedB) {
      return true
    }

    // If super many people want to bury the post and almost no one likes it, then
    // count bury votes, instead of like votes, after a while.
    // For now however, only admins can bury vote. So count the very first bury vote.
    // (Later on: Only consider bury votes if ... 5x more Bury than Like? And only after
    // say 10 people have seen the comment, after it was bury voted? (Could have a vote
    // review queue for this.))
    val buryA = postA.numBuryVotes > 0 && postA.numLikeVotes == 0
    val buryB = postB.numBuryVotes > 0 && postB.numLikeVotes == 0
    if (buryA && buryB) {
      if (postA.numBuryVotes < postB.numBuryVotes)
        return true
      if (postA.numBuryVotes > postB.numBuryVotes)
        return false
    }
    else if (buryA) {
      return false
    }
    else if (buryB) {
      return true
    }

    // Place interesting posts first.
    if (postA.likeScore > postB.likeScore)
      return true

    if (postA.likeScore < postB.likeScore)
      return false

    // Newest posts first. No, last
    if (postA.createdAt.getTime < postB.createdAt.getTime)
      true
    else
      false
  }

}

