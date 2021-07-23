/**
 * Copyright (c) 2019 Kaj Magnus Lindberg
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


import org.scalatest._
import java.{util => ju}


class ReviewTaskSpec extends FreeSpec with MustMatchers {

  val TestSiteId = 2345
  val BadUserId = 444
  val ThePageId = "777"
  val ThePostId = 55
  val ThePostNr = 8


  "ReviewTask:s can get merged with each other" - {

    val taskOne = ReviewTask(
      id = 111,
      reasons = Vector(ReviewReason.PostIsSpam),
      createdById = SystemUserId,
      createdAt = When.fromMillis(2019 * OneYearInMillis).toJavaDate,
      createdAtRevNr = Some(2),
      moreReasonsAt = None,
      decidedAt = None,
      completedAt = None,
      maybeBadUserId = BadUserId,
      postId = Some(ThePostId),
      postNr = Some(ThePostNr))

    val taskTwo = taskOne.copy(
      reasons = Vector(ReviewReason.PostIsSpam),
      createdAt = When.fromMillis(2019 * OneYearInMillis + OneDayInMillis).toJavaDate,
      createdAtRevNr = Some(3))

    "Merge two different reasons" in {
      val task = taskTwo.mergeWithAny(Some(
        taskOne.copy(reasons = Vector(ReviewReason.IsByNewUser))))
      task.reasons mustBe Vector(ReviewReason.IsByNewUser, ReviewReason.PostIsSpam)
      task.createdAt mustBe taskOne.createdAt
      //task.createdAtRevNr mustBe taskOne.createdAtRevNr [MOREREVRSNS]
      //task.moreReasonsAtRevNr mustBe taskTwo.createdAtRevNr [MOREREVRSNS]  ??
      task.moreReasonsAt mustBe Some(taskTwo.createdAt)
    }

    "Merge the same reasons with each other" in {
      val task = taskTwo.mergeWithAny(Some(taskOne))
      task.reasons mustBe Vector(ReviewReason.PostIsSpam)
      task.createdAt mustBe taskOne.createdAt
      //task.createdAtRevNr mustBe taskOne.createdAtRevNr [MOREREVRSNS]
      task.moreReasonsAt mustBe Some(taskTwo.createdAt)
    }

    "Merge two same-reasons and two different-reasons" in {
      val task = taskTwo.copy(reasons = Vector(
          ReviewReason.LateEdit, ReviewReason.IsByNewUser))
        .mergeWithAny(Some(taskOne.copy(reasons = Vector(
          ReviewReason.IsByThreatUser, ReviewReason.IsByNewUser))))
      task.reasons mustBe Vector(
        ReviewReason.IsByThreatUser, ReviewReason.IsByNewUser, ReviewReason.LateEdit)
      task.createdAt mustBe taskOne.createdAt
      //task.createdAtRevNr mustBe taskOne.createdAtRevNr [MOREREVRSNS]
      task.moreReasonsAt mustBe Some(taskTwo.createdAt)
    }
  }

}

// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

