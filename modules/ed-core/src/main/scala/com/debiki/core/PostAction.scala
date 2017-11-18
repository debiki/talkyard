/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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
import collection.{immutable => imm, mutable => mut}
import Prelude._


sealed abstract class PostActionType


sealed abstract class PostVoteType(val IntVal: Int) extends PostActionType { def toInt = IntVal }
object PostVoteType {
  // dupl numbers [2PKWQUT0] perhaps use 1,2,4,8 instead? [8FEX1Q4]
  case object Like extends PostVoteType(41)
  case object Wrong extends PostVoteType(42) // RENAME to Disagree
  case object Bury extends PostVoteType(43)
  case object Unwanted extends PostVoteType(44)

  def fromInt(value: Int): Option[PostVoteType] = Some(value match {
    case Like.IntVal => Like
    case Wrong.IntVal => Wrong
    case Bury.IntVal => Bury
    case Unwanted.IntVal => Unwanted
    case _ => return None
  })
}


sealed abstract class PostFlagType extends PostActionType { def toInt: Int }
object PostFlagType {
  // dupl numbers [2PKWQUT0]
  case object Spam extends PostFlagType { val toInt = 51 }
  case object Inapt extends PostFlagType { val toInt = 52 }
  case object Other extends PostFlagType { val toInt = 53 }
}


sealed abstract class PostStatusAction
object PostStatusAction {
  case object HidePost extends PostStatusAction
  case object UnhidePost extends PostStatusAction
  case object CloseTree extends PostStatusAction
  case object CollapsePost extends PostStatusAction
  case object CollapseTree extends PostStatusAction
  case class DeletePost(clearFlags: Boolean) extends PostStatusAction
  case object DeleteTree extends PostStatusAction
}


abstract class PostAction {
  def uniqueId: PostId
  def pageId: PageId
  def postNr: PostNr
  def doerId: UserId
  def doneAt: When
  def actionType: PostActionType
}


object PostAction {
  def apply(uniqueId: PostId, pageId: PageId, postNr: PostNr, doerId: UserId,
        doneAt: When, actionType: PostActionType)
        : PostAction = actionType match {
    case voteType: PostVoteType =>
      PostVote(uniqueId, pageId, postNr, doneAt, voterId = doerId, voteType = voteType)
    case flagType: PostFlagType =>
      PostFlag(uniqueId, pageId, postNr, doneAt, flaggerId = doerId, flagType = flagType)
    case x =>
      die("DwE7GPK2", s"Bad action type: '$actionType'")
  }
}


case class PostVote(
  uniqueId: PostId,
  pageId: PageId,
  postNr: PostNr,
  doneAt: When,
  voterId: UserId,
  voteType: PostVoteType) extends PostAction {

  def actionType: PostVoteType = voteType
  def doerId: UserId = voterId
}


case class PostFlag(
  uniqueId: PostId,
  pageId: PageId,
  postNr: PostNr,
  doneAt: When,
  flaggerId: UserId,
  flagType: PostFlagType) extends PostAction {

  def actionType: PostFlagType = flagType
  def doerId: UserId = flaggerId
  def flaggedAt: When = doneAt
}

