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
import scala.collection.immutable


/** All unreviewed changes by userId of something, e.g. a post or his/her own avatar pic.
  */
case class ReviewTask(
  id: ReviewTaskId,
  doneById: UserId,
  reasons: immutable.Seq[ReviewReason],
  alreadyApproved: Boolean,
  createdAt: ju.Date,
  moreReasonsAt: Option[ju.Date] = None,
  reviewedAt: Option[ju.Date] = None,
  reviewedById: Option[UserId] = None,
  invalidatedAt: Option[ju.Date] = None,
  resolution: Option[Int] = None,
  userId: Option[UserId] = None,
  postId: Option[PostId] = None,
  revisionNr: Option[Int] = None) {

  require(doneById != 0, "EsE5GLY99")
  require(reasons.nonEmpty, "EsE3FK21")
  require(!moreReasonsAt.exists(_.getTime < createdAt.getTime), "EsE7UGYP2")
  require(!reviewedAt.exists(_.getTime < createdAt.getTime), "EsE0YUL72")
  require(!invalidatedAt.exists(_.getTime < createdAt.getTime), "EsE5GKP2")
  require(reviewedAt.isEmpty || invalidatedAt.isEmpty, "EsE2FPW1")
  require(userId.isDefined != postId.isDefined, "EsE6GPVU4")
  require(!postId.exists(_ <= 0), "EsE3GUL80")
  require(!revisionNr.exists(_ < FirstRevisionNr), "EsE1WL43")
  require(postId.isDefined == revisionNr.isDefined, "EsE4PU2")


  def mergeWithAny(anyOldTask: Option[ReviewTask]): ReviewTask = {
    val oldTask = anyOldTask getOrElse {
      return this
    }
    require(oldTask.id == this.id, "EsE4GPMU0")
    require(oldTask.doneById == this.doneById, "EsE5GKX2")
    require(oldTask.reviewedAt.isEmpty, "EsE4FYC2")
    require(oldTask.userId == this.userId, "EsE5JMU1")
    require(oldTask.postId == this.postId, "EsE2UYF7")
    require(oldTask.revisionNr.isDefined == this.revisionNr.isDefined, "EsE2KRY4")
    require(!oldTask.revisionNr.exists(_ > this.revisionNr.get), "EsE4PKY2")
    val newReasonsValue = ReviewReason.toLong(oldTask.reasons) + ReviewReason.toLong(this.reasons)
    val newReasonsSeq = ReviewReason.fromLong(newReasonsValue)
    this.copy(
      reasons = newReasonsSeq,
      createdAt = oldTask.createdAt,
      moreReasonsAt = Some(this.createdAt))
  }

}



