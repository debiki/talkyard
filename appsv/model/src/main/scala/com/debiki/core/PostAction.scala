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


sealed abstract class PostActionType { def toInt: Int }
// fromInt: see  [402KTHRNPQw]


sealed abstract class PostVoteType(val IntVal: Int) extends PostActionType { def toInt: Int = IntVal }
object PostVoteType {

  // Page votes? (These votes are cast on posts, although they are for pages
  // — so won't be lost if merging two pages, and splitting them again.)
  //case object DoIt extends PostVoteType(31)
  //case object DoNot extends PostVoteType(32)

  // dupl numbers [2PKWQUT0] perhaps use 1,2,4,8 instead? [8FEX1Q4]
  case object Like extends PostVoteType(41)
  case object Wrong extends PostVoteType(42) // RENAME to Disagree
  case object Bury extends PostVoteType(43)  // rename to MoveDown? [.ren_bury]
  case object Unwanted extends PostVoteType(44)

  // case object Promote/Boost/PinAtTop + priority value?  For curating the discussion
  // case object Demote/MoveDown — but there's Bury for that alreayd,
  // maybe rename to MoveDownwards? sounds more neutral / less negative [.ren_bury]

  def fromInt(value: Int): Option[PostVoteType] = Some(value match {
    //case DoIt.IntVal => DoIt
    //case DoNot.IntVal => DoNot
    case Like.IntVal => Like
    case Wrong.IntVal => Wrong
    case Bury.IntVal => Bury
    case Unwanted.IntVal => Unwanted
    case _ => return None
  })

  def apiV0_fromStr(value: St): Option[PostVoteType] = Some(value match {
    //case DoIt.IntVal => DoIt
    //case DoNot.IntVal => DoNot
    case "Like" => Like
    // case "Disagree" => Wrong
    // case "Bury" => Bury — rename to MoveDown
    // case "Unwanted" => Unwanted
    case _ => return None
  })
}


sealed abstract class PostFlagType extends PostActionType { def toInt: Int }
object PostFlagType {
  // dupl numbers [2PKWQUT0]
  case object Spam extends PostFlagType { val toInt = 51 }
  case object Inapt extends PostFlagType { val toInt = 52 }
  case object Other extends PostFlagType { val toInt = 53 }

  // Disqus' flag types: https://disqus.com/api/docs/posts/report/
  // harassment, threat, impersonation, private info (doxxing?), spam, inappropriate_content
  // + disagree (why? for silly flaggers?)
}

// val toInt = 61, 62, 63, .. ?
sealed abstract class PostStatusAction(val affectsSuccessors: Boolean)
object PostStatusAction {
  case object HidePost extends PostStatusAction(affectsSuccessors = false)
  case object UnhidePost extends PostStatusAction(affectsSuccessors = false)
  case object CloseTree extends PostStatusAction(affectsSuccessors = true)
  case object CollapsePost extends PostStatusAction(affectsSuccessors = false)
  case object CollapseTree extends PostStatusAction(affectsSuccessors = true)
  case class DeletePost(clearFlags: Boolean) extends PostStatusAction(affectsSuccessors = false)
  case object DeleteTree extends PostStatusAction(affectsSuccessors = true)
  // UndeletePost extends PostStatusAction(affectsSuccessors = false)  [UNDELPOST]
  // UndeleteTree extends PostStatusAction(affectsSuccessors = true)?
  //  — but what about individually deleted posts in the tree? Well, there's
  // Post.deletedStatus: DeletedStatus, which tells if the post was deleted explicitly,
  // or implicitly because an ancestor got tree-deleted.  UndoTree = undeletes the post selected,
  // + all descendants that got tree-deleted.
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

// [exp] delete field:  action_id (alw null), sub_id (always 1), updated_at, deleted_at, deleted_by_id
case class PostVote(  // [exp] ok to use
  uniqueId: PostId,   // RENAME to postId
  pageId: PageId,
  postNr: PostNr,
  doneAt: When,
  voterId: UserId,
  voteType: PostVoteType) extends PostAction {

  def actionType: PostVoteType = voteType
  def doerId: UserId = voterId
}

/** Post id missing — nice to not have to specify, when constructing tests, since the post id is
  * undecided, when importing the site.  */
case class PostVoteToInsert(
  // postId: Opt[PostId], // later not now
  pageId: PageId,
  postNr: PostNr,
  doneAt: When,
  voterId: UserId,
  voteType: PostVoteType) {

  def toPostAction(postId: PostId): PostVote = PostVote(
    uniqueId = postId,
    pageId = pageId,
    postNr = postNr,
    doneAt = doneAt,
    voterId = voterId,
    voteType = voteType)
}


case class PostFlag(  // [exp] ok to use
  uniqueId: PostId,   // RENAME to postId
  pageId: PageId,
  postNr: PostNr,
  doneAt: When,
  flaggerId: UserId,
  flagType: PostFlagType) extends PostAction {

  def actionType: PostFlagType = flagType
  def doerId: UserId = flaggerId
  def flaggedAt: When = doneAt
}

