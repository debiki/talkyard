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


/** A post is a page title, a page body or a comment.
  * For example, a forum topic title, topic text, and replies.
  */
case class Post2(
  siteId: SiteId,
  pageId: PageId,
  id: PostId,
  parentId: Option[PostId],
  multireplyPostIds: immutable.Set[PostId],
  createdAt: ju.Date,
  createdById: UserId,
  lastEditedAt: ju.Date,
  lastEditedById: UserId,
  lastApprovedEditAt: Option[ju.Date],
  lastApprovedEditById: Option[UserId],
  lastApprovedEditApprovedAt: Option[UserId],
  lastApprovedEditApprovedById: Option[UserId],
  numDistinctEditors: Int,
  approvedSource: Option[String],
  approvedHtmlSanitized: Option[String],
  approvedAt: Option[ju.Date],
  approvedById: Option[UserId],
  approvedVersion: Option[Int],
  currentSourcePatch: Option[String],
  currentVersion: Int,
  collapsedStatus: Option[CollapsedStatus],
  collapsedAt: Option[ju.Date],
  collapsedById: Option[UserId],
  closedStatus: Option[ClosedStatus],
  closedAt: Option[ju.Date],
  closedById: Option[UserId],
  deletedStatus: Option[DeletedStatus],
  deletedAt: Option[ju.Date],
  deletedById: Option[UserId],
  pinnedPosition: Option[Int],
  numPendingFlags: Int,
  numHandledFlags: Int,
  numPendingEditSuggestions: Int,
  numLikeVotes: Int,
  numWrongVotes: Int,
  numTimesRead: Int){


  def isMultireply = multireplyPostIds.nonEmpty


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
  lazy val likeScore = {
    val numLikes = this.numLikeVotes
    // In case there for some weird reason are liked posts with no read count,
    // set numTimesRead to at least numLikes.
    val numTimesRead = math.max(this.numTimesRead, numLikes)
    val avgLikes = numLikes.toFloat / math.max(1, numTimesRead)
    val lowerBound = Distributions.binPropConfIntACLowerBound(
      sampleSize = numTimesRead, proportionOfSuccesses = avgLikes, percent = 80.0f)
    lowerBound
  }


  def repliesSorted(pageParts: PageParts2): Seq[Post2] =
    Nil // for now

}

