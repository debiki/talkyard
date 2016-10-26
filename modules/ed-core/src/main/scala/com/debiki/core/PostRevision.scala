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
import PostRevision._


/**
  * @param composedAt — not named "createdAt", because it's bumped in case of ninja edits,
  *  so it's not the creation date. Not "writtenAt" because the revision might be a bunch of
  *  applied edit suggestions written by *other* people.
  */
case class PostRevision(
  postId: UniquePostId,
  revisionNr: Int,
  previousNr: Option[Int],
  sourcePatch: Option[String],
  fullSource: Option[String],
  title: Option[String],
  composedAt: ju.Date,
  composedById: UserId,
  approvedAt: Option[ju.Date],
  approvedById: Option[UserId],
  hiddenAt: Option[ju.Date] = None,
  hiddenById: Option[UserId] = None) {

  require(postId >= 0, "DwE5GUMP2")
  require(revisionNr >= FirstRevisionNr, "DwE7MUW4")
  require(!previousNr.exists(_ < FirstRevisionNr), "DwE06FMW2")
  require(revisionNr != FirstRevisionNr || fullSource.isDefined, "DwE8PLU2")
  require((revisionNr == FirstRevisionNr) == previousNr.isEmpty, "DwE5JYU0")
  require(fullSource.isDefined || sourcePatch.isDefined, "DwE9GYU5")
  require(!approvedAt.exists(_.getTime < composedAt.getTime), "DwE2FPG4")
  require(!hiddenAt.exists(_.getTime < composedAt.getTime), "DwE4GUB9")
  require(approvedAt.isDefined == approvedById.isDefined, "DwE5UPM2")
  require(hiddenAt.isDefined == hiddenById.isDefined, "DwE3WFB5")

  def isHidden = hiddenAt.isDefined

  def copyAndPatchSourceFrom(previousRevision: PostRevision): PostRevision = {
    require(!previousNr.exists(_ != previousRevision.revisionNr), "DwE0GUK4")
    require(postId == previousRevision.postId, "DwE7UFK4")
    val previousSource = previousRevision.fullSource getOrDie "DwE6JMY2"
    val patch = sourcePatch getOrDie "DwE7UPK2"
    val source = applyPatch(patch, to = previousSource)
    copy(fullSource = Some(source))
  }

}



object PostRevision {

  val FirstRevisionNr = 1

  /** Every 25th revision contains the full source. */
  val SaveFullSourceInterval = 25

  val LastRevisionMagicNr = Int.MaxValue


  def createFor(post: Post, previousRevision: Option[PostRevision]): PostRevision = {
    require(!previousRevision.exists(_.postId != post.uniqueId), "DwE5G5K2")
    require(post.previousRevisionNr == previousRevision.map(_.revisionNr), "DwE5PYF6")

    var anySource: Option[String] = None
    var anyPatch: Option[String] = None

    // (COULD count num actual revision from last fullSource.isDefined revision instead,
    // that would be more exact, because some revisions might have been reverted so
    // `% SaveFullSourceInterval` might be wrong.)
    if (previousRevision.isEmpty || (post.currentRevisionNr % SaveFullSourceInterval) == 0) {
      anySource = Some(post.currentSource)
    }
    else {
      val prevRev = previousRevision getOrDie "DwE3KPU2"
      val prevSource = prevRev.fullSource getOrDie "DwE8UMP2"
      val thePatch = makePatch(from = prevSource, to = post.currentSource)
      if (thePatch.length < post.currentSource.length) {
        anyPatch = Some(thePatch)
      }
      else {
        anySource = Some(post.currentSource)
      }
    }

    val (approvedAt, approvedById) =
      if (post.isCurrentVersionApproved) (post.approvedAt, post.approvedById)
      else (None, None)

    PostRevision(
      postId = post.uniqueId,
      revisionNr = post.currentRevisionNr,
      previousNr = post.previousRevisionNr,
      sourcePatch = anyPatch,
      fullSource = anySource,
      title = None,
      composedAt = post.currentRevStaredAt,
      composedById = post.currentRevisionById,
      approvedAt = approvedAt,
      approvedById = approvedById)
  }

}

