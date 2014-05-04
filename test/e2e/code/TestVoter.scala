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

package test.e2e.code

import com.debiki.core.PostId
import com.debiki.core.Prelude._
import com.debiki.core.{PostActionPayload => PAP}


/** Toggles votes and counts votes.
  */
trait TestVoter {
  self: DebikiBrowserSpec with StuffTestClicker =>


  case class VoteCounts(numLikes: Int, numWrongs: Int, numOffTopics: Int)

  case class VoteStates(like: Boolean, wrong: Boolean, offTopic: Boolean)


  def countVotes(postId: PostId): VoteCounts = {
    def count(postId: PostId, voteCountClass: String): Int = {
      val anyVoteCount = find(cssSelector(s"#post-$postId .dw-p-hd .$voteCountClass"))
      anyVoteCount match {
        case None => 0
        case Some(node) =>
          // node.text is e.g. "1 person" or "3 people", or simply "3".
          node.text.split(" ").head.toInt
      }
    }
    VoteCounts(
      numLikes = count(postId, "dw-num-likes"),
      numWrongs = count(postId, "dw-num-wrongs"),
      numOffTopics = count(postId, "dw-num-offtopics"))
  }


  def checkVoteStates(postId: PostId): VoteStates = {
    def checkState(voteTypeClass: String): Boolean = {
      val myVote = find(cssSelector(s"#dw-t-$postId > .dw-p-as .$voteTypeClass.dw-my-vote"))
      myVote.isDefined
    }
    VoteStates(
      like = checkState("dw-a-like"),
      wrong = checkState("dw-a-wrong"),
      offTopic = checkState("dw-a-offtopic"))
  }


  def toggleVote(postId: PostId, voteType: PAP.Vote) {
    showActionLinks(postId)
    if (voteType == PAP.VoteOffTopic)
      clickShowMoreActions(postId)

    val cssClass = voteType match {
      case PAP.VoteLike => "dw-a-like"
      case PAP.VoteWrong => "dw-a-wrong"
      case PAP.VoteOffTopic => "dw-a-offtopic"
      case _ => fail("Bad vote type")
    }

    val voteActions = findAll(cssSelector(s"#dw-t-$postId > .dw-p-as .$cssClass"))
    val anyVisibleVoteAction = voteActions.filter(_.isDisplayed).toSeq.headOption
    anyVisibleVoteAction match {
      case None =>
        fail()
      case Some(action) =>
        scrollIntoView(action)
        click on action
    }
  }

}

