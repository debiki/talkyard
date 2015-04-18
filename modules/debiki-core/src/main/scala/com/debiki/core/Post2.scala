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
import com.debiki.core.User.SystemUserId
import java.{util => ju}
import play.api.libs.json._
import scala.collection.immutable
import Prelude._


sealed abstract class CollapsedStatus
object CollapsedStatus {
  case object PostCollapsed extends CollapsedStatus
  case object TreeCollapsed extends CollapsedStatus
  case object AncestorCollapsed extends CollapsedStatus
}


sealed abstract class ClosedStatus
object ClosedStatus {
  case object TreeClosed extends ClosedStatus
  case object AncestorClosed extends ClosedStatus
}


sealed abstract class DeletedStatus
object DeletedStatus {
  case object PostDeleted extends DeletedStatus
  case object TreeDeleted extends DeletedStatus
  case object AncestorDeleted extends DeletedStatus
}


case class PostStatuses(isCollapsed: Boolean, isClosed: Boolean, isDeleted: Boolean)
object PostStatuses {
  val Default = PostStatuses(isCollapsed = false, isClosed = false, isDeleted = false)
}


/** A post is a page title, a page body or a comment.
  * For example, a forum topic title, topic text, or a reply.
  */
case class Post2(
  siteId: SiteId,
  pageId: PageId,
  id: PostId,
  parentId: Option[PostId],
  multireplyPostIds: immutable.Set[PostId],
  createdAt: ju.Date,
  createdById: UserId2,
  lastEditedAt: Option[ju.Date],
  lastEditedById: Option[UserId2],
  lastApprovedEditAt: Option[ju.Date],
  lastApprovedEditById: Option[UserId2],
  numDistinctEditors: Int,
  safeVersion: Option[Int],
  approvedSource: Option[String],
  approvedHtmlSanitized: Option[String],
  approvedAt: Option[ju.Date],
  approvedById: Option[UserId2],
  approvedVersion: Option[Int],
  currentSourcePatch: Option[String],
  currentVersion: Int,
  collapsedStatus: Option[CollapsedStatus],
  collapsedAt: Option[ju.Date],
  collapsedById: Option[UserId2],
  closedStatus: Option[ClosedStatus],
  closedAt: Option[ju.Date],
  closedById: Option[UserId2],
  hiddenAt: Option[ju.Date],
  hiddenById: Option[UserId2],
  //hiddenReason: ?
  deletedStatus: Option[DeletedStatus],
  deletedAt: Option[ju.Date],
  deletedById: Option[UserId2],
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

  require(collapsedAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE0JIk3")
  require(collapsedAt.isDefined == collapsedStatus.isDefined, "DwE5KEI3")
  require(collapsedAt.isDefined == collapsedById.isDefined, "DwE60KF3")

  require(closedAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE6IKF3")
  require(closedAt.isDefined == closedStatus.isDefined, "DwE0Kf4")
  require(closedAt.isDefined == closedById.isDefined, "DwE4KI61")

  require(deletedAt.map(_.getTime >= createdAt.getTime) != Some(false), "DwE6IK84")
  require(deletedAt.isDefined == deletedStatus.isDefined, "DwE0IGK2")
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

  def isMultireply = multireplyPostIds.nonEmpty

  def pagePostId = PagePostId(pageId, id)
  def hasAnId = id >= PageParts.LowestPostId

  def isDeleted = deletedStatus.isDefined
  def isHidden = hiddenAt.isDefined

  lazy val currentSource: String =
    currentSourcePatch match {
      case None => approvedSource.getOrElse("")
      case Some(patch) => applyPatch(patch, to = approvedSource.getOrElse(""))
    }

  def unapprovedSource: Option[String] = {
    if (currentVersionIsApproved) None
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


  def currentVersionIsApproved = approvedVersion == Some(currentVersion)

  def numEditsToReview = currentVersion - approvedVersion.getOrElse(0)

  def numFlags = numPendingFlags + numHandledFlags

  def createdByUser(people: People2): User =
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


  def parent(pageParts: PageParts2): Option[Post2] =
    parentId.flatMap(pageParts.post)

  def children(pageParts: PageParts2): Seq[Post2] =
    pageParts.childrenOf(id)

  def copyWithParentStatuses(parentStatuses: PostStatuses): Post2 = this.copy(
    collapsedStatus = collapsedStatus orElse (
      if (parentStatuses.isCollapsed) Some(CollapsedStatus.AncestorCollapsed) else None),
    closedStatus = closedStatus orElse (
      if (parentStatuses.isClosed) Some(ClosedStatus.AncestorClosed) else None),
    deletedStatus = deletedStatus orElse (
      if (parentStatuses.isDeleted) Some(DeletedStatus.AncestorDeleted) else None))


  def copyWithUpdatedVoteAndReadCounts(actions: Iterable[PostAction2], readStats: PostsReadStats)
        : Post2 = {
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



object Post2 {
  
  val FirstVersion = 1

  def create(
        siteId: SiteId,
        pageId: PageId,
        postId: PostId,
        parentId: Option[PostId],
        multireplyPostIds: Set[PostId],
        createdAt: ju.Date,
        createdById: UserId2,
        source: String,
        htmlSanitized: String,
        approvedById: Option[UserId2]): Post2 = {

    val currentSourcePatch: Option[String] =
      if (approvedById.isDefined) None
      else Some(makePatch(from = "", to = source))

    // If approved by a human, this initial version is safe.
    val safeVersion =
      approvedById.flatMap(id => if (id != SystemUserId) Some(FirstVersion) else None)

    Post2(
      siteId = siteId,
      pageId = pageId,
      id = postId,
      parentId = parentId,
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
      collapsedStatus = None,
      collapsedAt = None,
      collapsedById = None,
      closedStatus = None,
      closedAt = None,
      closedById = None,
      hiddenAt = None,
      hiddenById = None,
      deletedStatus = None,
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
        createdById: UserId2,
        source: String,
        htmlSanitized: String,
        approvedById: Option[UserId2]): Post2 =
    create(siteId, pageId = pageId, postId = PageParts.TitleId, parentId = None,
      multireplyPostIds = Set.empty, createdAt = createdAt, createdById = createdById,
      source = source, htmlSanitized = htmlSanitized, approvedById = approvedById)

  def createBody(
        siteId: SiteId,
        pageId: PageId,
        createdAt: ju.Date,
        createdById: UserId2,
        source: String,
        htmlSanitized: String,
        approvedById: Option[UserId2]): Post2 =
    create(siteId, pageId = pageId, postId = PageParts.BodyId, parentId = None,
      multireplyPostIds = Set.empty, createdAt = createdAt, createdById = createdById,
      source = source, htmlSanitized = htmlSanitized, approvedById = approvedById)

}



case class BrowserIdData(
  ip: String,
  idCookie: Option[String],
  fingerprint: Int) {

  require(ip.nonEmpty, "DwE6G9F0")
  require(idCookie.map(_.isEmpty) != Some(true), "DwE3GJ79")
}
