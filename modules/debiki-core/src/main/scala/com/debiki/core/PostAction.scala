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


abstract class PostActionType


sealed abstract class PostVoteType extends PostActionType
object PostVoteType {
  case object Like extends PostVoteType
  case object Wrong extends PostVoteType
  //case object Rude extends PostVoteType
  //case object Boring extends PostVoteType
}


sealed abstract class PostFlagType extends PostActionType
object PostFlagType {
  case object Spam extends PostFlagType
  case object Inapt extends PostFlagType
  case object Other extends PostFlagType
}


sealed abstract class PostStatusAction
object PostStatusAction {
  case object CloseTree extends PostStatusAction
  case object CollapsePost extends PostStatusAction
  case object CollapseTree extends PostStatusAction
  case class DeletePost(clearFlags: Boolean) extends PostStatusAction
  case object DeleteTree extends PostStatusAction
}


abstract class PostAction {
  def pageId: PageId
  def postId: PostId
  def doerId: UserId
  def actionType: PostActionType
}


object PostAction {
  def apply(pageId: PageId, postId: PostId, doerId: UserId, actionType: PostActionType)
        : PostAction = actionType match {
    case voteType: PostVoteType =>
      PostVote(pageId, postId, voterId = doerId, voteType = voteType)
    case flagType: PostFlagType =>
      PostFlag(pageId, postId, flaggerId = doerId, flagType = flagType)
    case x =>
      die("DwE7GPK2", s"Bad action type: '$actionType'")
  }
}


case class PostVote(
  pageId: PageId,
  postId: PostId,
  voterId: UserId,
  voteType: PostVoteType) extends PostAction {
  def actionType = voteType
  def doerId = voterId
}


case class PostFlag(
  pageId: PageId,
  postId: PostId,
  flaggerId: UserId,
  flagType: PostFlagType) extends PostAction {
  def actionType = flagType
  def doerId = flaggerId
}

