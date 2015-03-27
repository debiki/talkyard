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
  numCollapseVotes: Int,
  numTimesRead: Int) {

  require(parentId != Some(id), "DwE5BK4")
  require(!multireplyPostIds.contains(id), "DwE4kWW2")
  require(approvedVersion.map(_ <= currentVersion) != Some(false), "DwE6KJ0")
  // ...

  def isMultireply = multireplyPostIds.nonEmpty

  def hasAnId = id >= PageParts.LowestPostId

  def isDeleted = deletedStatus.isDefined

  lazy val currentSource: String =
    currentSourcePatch match {
      case None => approvedSource.getOrElse("")
      case Some(patch) => applyPatch(patch, to = approvedSource.getOrElse(""))
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


  def currentVersionIsApproved: Boolean = currentVersion == approvedVersion


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


  def children(pageParts: PageParts2): Seq[Post2] =
    pageParts.childrenOf(id)

  def copyWithParentStatuses(parentStatuses: PostStatuses): Post2 = this.copy(
    collapsedStatus = collapsedStatus orElse (
      if (parentStatuses.isCollapsed) Some(CollapsedStatus.AncestorCollapsed) else None),
    closedStatus = closedStatus orElse (
      if (parentStatuses.isClosed) Some(ClosedStatus.AncestorClosed) else None),
    deletedStatus = deletedStatus orElse (
      if (parentStatuses.isDeleted) Some(DeletedStatus.AncestorDeleted) else None))

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
      approvedSource = if (approvedById.isDefined) Some(source) else None,
      approvedHtmlSanitized = if (approvedById.isDefined) Some(htmlSanitized) else None,
      approvedAt = if (approvedById.isDefined) Some(createdAt) else None,
      approvedById = approvedById,
      approvedVersion = if (approvedById.isDefined) Some(1) else None,
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
      numCollapseVotes = 0,
      numTimesRead = 0)
  }

}



case class BrowserIdData(
  ip: String,
  idCookie: Option[String],
  fingerprint: Int) {

  require(ip.nonEmpty, "DwE6G9F0")
  require(idCookie.map(_.isEmpty) != Some(true), "DwE3GJ79")
}
