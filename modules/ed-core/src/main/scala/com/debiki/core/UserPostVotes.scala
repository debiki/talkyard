/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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


case class UserPostVotes(
  votedLike: Boolean,
  votedWrong: Boolean,
  votedBury: Boolean,
  votedUnwanted: Boolean)


object UserPostVotes {

  def makeMap(votes: imm.Seq[PostVote]): Map[PostNr, UserPostVotes] = {
    if (votes.isEmpty)
      return Map.empty
    val theFirstVote = votes.head
    val voteBitsByPostNr = mut.HashMap[PostNr, Int]()
    for (vote <- votes) {
      require(vote.voterId == theFirstVote.voterId, "DwE0PKF3")
      require(vote.pageId == theFirstVote.pageId, "DwE6PUB4")
      val bits = vote.voteType match {
        case PostVoteType.Like => 1
        case PostVoteType.Wrong => 2
        case PostVoteType.Bury => 4
        case PostVoteType.Unwanted => 8
      }
      var voteBits = voteBitsByPostNr.getOrElseUpdate(vote.postNr, 0)
      voteBits |= bits
      assert(voteBits <= 15)
      voteBitsByPostNr.put(vote.postNr, voteBits)
    }
    val postNrsAndVotes = voteBitsByPostNr.toVector map { case (key: PostNr, voteBits: Int) =>
      val votes = UserPostVotes(
        votedLike = (voteBits & 1) == 1,
        votedWrong = (voteBits & 2) == 2,
        votedBury = (voteBits & 4) == 4,
        votedUnwanted = (voteBits & 8) == 8)
      (key, votes)
    }
    Map(postNrsAndVotes: _*)
  }

}
