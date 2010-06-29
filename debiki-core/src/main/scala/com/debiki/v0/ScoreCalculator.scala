// vim: ts=2 sw=2 et

package com.debiki.v0

import collection.{immutable => imm, mutable => mut}
import Prelude._

/** Aggregates votes. Immutable.
 */
private[debiki] abstract class PostScore {
  //val it = mut.Map[String, Int]()
  //val is = mut.Map[String, Int]()
  def score: Int
  def voteCount: Int
}

private[debiki] class ScoreCalculator(val debate: Debate) {

  private class PostScoreImpl extends PostScore {
    var score = 0
    var voteCount = 0

    def += (vote: Vote): PostScoreImpl = {
      score += 0 // was: vote.score, TODO: good votes - bad votes
      voteCount += 1
      this
    }
  }

  private val scoresByPostId = mut.Map[String, PostScoreImpl]()

  for (v <- debate.votes) scoreImplFor(v.postId) += v

  private def scoreImplFor(postId: String): PostScoreImpl =
    scoresByPostId.getOrElse(postId, {
        val s = new PostScoreImpl
        scoresByPostId.put(postId, s)
        s })

  def scoreFor(postId: String): PostScore = scoreImplFor(postId)

}

/*

Thread score = sum of scoers for the posts that are shown,
                if one expands the thread (from the collapsed state).

Post score =  { #interesting, #insightful, #stupid, #boring ... } / vote-count


Interesting / intressant
Boring / trist

Insightful / klokt
Stupid / korkat

Correct / korrekt
Wrong / fel

Funny / roligt
Off topic / byter amne
Advertisement / reklam

Other:

Annat:

 */
