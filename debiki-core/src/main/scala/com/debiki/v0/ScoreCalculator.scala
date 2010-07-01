// vim: ts=2 sw=2 et

package com.debiki.v0

import collection.{immutable => imm, mutable => mut}
import Prelude._

/** Aggregates votes. Immutable.
 */
private[debiki] abstract class PostScore {

  def voteCount: Int

  /** Weighted votes value sums.
   *
   *  The importance of each vote value is divided with [the number
   *  of values the voter submitted]. For example, if s/he selected three
   *  values [funny, interesting, insightful], then e.g. valueSums("funny")
   *  is incremented with 1/3.
   */
  def valueSums: imm.Map[String, Float]

  def valueSumsSorted: List[(String, Float)] = {
    valueSums.toList.sortWith((a, b) => a._2 > b._2)
  }

  /** The score depends on which vote values the reader likes.
   *  For example, someone might prefer [interestin, insightful] posts,
   *  but not [boring, faulty, spam] posts.
   *  Another reader might be looking for [funny] posts.
   *
   *  Currently, however, it's assumed that all humans like the vote values
   *  listed in {@code ScoreCalculator.good} and dislike those in
   *  {@code ScoreCalculator.bad}.
   *
   *  Should perhaps be calculated on the client side, JavaScript?
   */
  def score: Float
}

private[debiki] class ScoreCalculator(val debate: Debate) {

  private val good = imm.Set("interesting", "funny", "insightful", "helpful")
  private val bad = imm.Set("boring", "faulty", "off-topic", "spam", "troll")

  private class PostScoreImpl extends PostScore {
    var voteCount = 0
    var valueSums = imm.Map[String, Float]() // updated later
    var mutValSums = mut.HashMap[String, Float]()  // thrown away later

    override lazy val score: Float = {
      var goodScore = 0f
      var badScore = 0f
      good foreach { goodScore += valueSums.getOrElse(_, 0f) }
      bad foreach { badScore += valueSums.getOrElse(_, 0f) }
      goodScore - badScore
    }

    def += (vote: Vote): PostScoreImpl = {
      if (vote.values.isEmpty)
        return this
      val weight = 1f / vote.values.length
      for (value <- vote.values) {
        val curSum = mutValSums.getOrElse(value, 0f)
        mutValSums(value) = curSum + 1f * weight
        // results in: "illegal cyclic reference involving trait Iterable"
        // Only in NetBeans, not when compiling, in real life???
      }
      voteCount += 1
      this
    }
  }

  private val scoresByPostId = mut.Map[String, PostScoreImpl]()

  // Calculate temporary vote value sums, in PostScoreImpl.mutValSums
  for (v <- debate.votes) scoreImplFor(v.postId) += v

  // Convert temporary sums to immutable stuff
  for ((postId, scoreImpl) <- scoresByPostId) {
    scoreImpl.valueSums =
      imm.Map[String, Float](scoreImpl.mutValSums.toSeq: _*)
    // Don't need mutValSums no more:
    scoreImpl.mutValSums = null
  }

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
