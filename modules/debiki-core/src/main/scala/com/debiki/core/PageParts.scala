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
import scala.collection.{immutable => imm, mutable => mut}
import Prelude._


object PageParts {


  // Letting the page body / original post be number 1 is compatible with Discourse.
  val TitleId = 0
  val BodyId = 1
  val FirstReplyId = 2

  val LowestPostId = TitleId
  assert(LowestPostId == 0)

  val NoId = -1

  // These are used when new comments or actions are submitted to the server.
  // When they're submitted, their ids are unknown (the server has not yet
  // assigned them any id).
  val UnassignedId = -1001
  val UnassignedId2 = -1002
  val UnassignedId3 = -1003
  val UnassignedId4 = -1004
  def isActionIdUnknown(id: ActionId) = id <= UnassignedId


  def isArticleOrConfigPostId(id: ActionId) =
    id == PageParts.BodyId || id == PageParts.TitleId


  def isReply(postId: PostId) = postId >= FirstReplyId

}


case class UserPostVotes(
  votedLike: Boolean,
  votedWrong: Boolean,
  votedOffTopic: Boolean)


object UserPostVotes {

  def makeMap(votes: imm.Seq[PostVote]): Map[PostId, UserPostVotes] = {
    if (votes.isEmpty)
      return Map.empty
    val theFirstVote = votes.head
    val voteBitsByPostId = mut.HashMap[PostId, Int]()
    for (vote <- votes) {
      require(vote.voterId == theFirstVote.voterId, "DwE0PKF3")
      require(vote.pageId == theFirstVote.pageId, "DwE6PUB4")
      val bits = vote.voteType match {
        case PostVoteType.Like => 1
        case PostVoteType.Wrong => 2
        //case PAP.Rude? Boring? => 4
      }
      var voteBits = voteBitsByPostId.getOrElseUpdate(vote.postId, 0)
      voteBits |= bits
      assert(voteBits <= 7)
      voteBitsByPostId.put(vote.postId, voteBits)
    }
    val postIdsAndVotes = voteBitsByPostId.toVector map { case (key: PostId, voteBits: Int) =>
      val votes = UserPostVotes(
        votedLike = (voteBits & 1) == 1,
        votedWrong = (voteBits & 2) == 2,
        votedOffTopic = (voteBits & 4) == 4)
      (key, votes)
    }
    Map(postIdsAndVotes: _*)
  }

}
