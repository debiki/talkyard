// vim: ts=2 sw=2 et

package com.debiki.v0

import collection.{immutable => imm, mutable => mut}
import Prelude._

case class LabelStats (

  /** Label sums.
   *
   *  The importance of each [label assigned to the relevant post in
   *  a vote] is divided with [the number of labels the voter submitted].
   *  For example, if s/he selected three labels [funny, interesting,
   *  insightful], then e.g. {@code labelStats("funny").sum} was
   *  incremented with 1/3.
   */
  sum: Float,
  fraction: Float,
  fractionLowerBound: Float
)

/** Immutable.
 */
private[debiki] abstract class PostRating {

  /** How many times the related post has been rated.
   */
  def voteCount: Int

  def labelStats: imm.Map[String, LabelStats]

  /** Sorted by LabelStats.fraction. An alternative is to sort by the
   *  lower confidence interval bound of the fraction.
   */
  def labelStatsSorted: List[(String, LabelStats)] = {
    labelStats.toList.sortWith((a, b) => a._2.fraction > b._2.fraction)
  }

  /** The highest possible label sum.
   *
   *  Each vote increments {@code maxLabelSum} with 1/number-of-labels.
   *  Example: If there are 2 votes, on values [interesting] and
   *  [interesting, funny], then maxLabelSum will be 1/1 + 1/2 = 1.5,
   *  and labelStats("interesting") is 1.5 (the maximum value sum -- reasonable,
   *  since everyone voted for the post being interesting).
   *  However, labelStats("funny") is only 0.5, which is 1/3 of the maxLabelSum.
   *  Dividing labelStats with maxLabelSum results in the relevant post
   *  being 100% interesting and 33% funny. This is reasonable, I think,
   *  since both voters (100%) thought it was "interesting".
   *  One label out of 3 labels specified "funny", so
   *  the post being 33% "funny" might also be reasonable.
   */
  def maxLabelSum: Float

  /** Depends on the votes made, and which labels the reader likes.
   *  For example, someone might like [interestin, insightful] posts,
   *  but dislike [boring, faulty, spam] posts.
   *  Another reader might be looking for [funny] posts.
   *
   *  Currently, however, it's assumed that all humans like the labels
   *  listed in {@code ScoreCalculator.good} and dislike those in
   *  {@code ScoreCalculator.bad}.
   *
   *  Should perhaps be calculated on the client side, JavaScript?
   */
  def liking: Float

}

private[debiki] class ScoreCalculator(val debate: Debate) {

  private val good = imm.Set("interesting", "funny", "insightful", "helpful")
  private val bad = imm.Set("boring", "faulty", "off-topic", "spam", "troll")

  private class PostRatingImpl extends PostRating {
    var voteCount = 0
    var maxLabelSum = 0f
    var labelStats = imm.Map[String, LabelStats]() // updated later
    var labelSums = mut.HashMap[String, Float]()  // thrown away later

    override lazy val liking: Float = {
      def sumMatching(set: imm.Set[String]): Float =
        (0f /: set) (_ + labelStats.get(_).map(_.fraction).getOrElse(0f))
      val goodScore = sumMatching(good)
      val badScore = sumMatching(bad)
      goodScore - badScore
    }

    def += (vote: Vote): PostRatingImpl = {
      if (vote.values.isEmpty)
        return this
      val weight = 1f / vote.values.length
      for (value <- vote.values) {
        val curSum = labelSums.getOrElse(value, 0f)
        labelSums(value) = curSum + 1f * weight
        // results in: "illegal cyclic reference involving trait Iterable"
        // Only in NetBeans, not when compiling, in real life???
      }
      maxLabelSum += weight
      voteCount += 1
      this
    }
  }

  private val postRatings = mut.Map[String, PostRatingImpl]()

  // Calculate temporary label sums, in PostRatingImpl.labelSums
  for (v <- debate.votes) ratingImplFor(v.postId) += v

  // Convert temporary sums to immutable LabelStats
  for ((postId, rating) <- postRatings) {
    rating.labelStats =
      imm.Map[String, LabelStats](
        rating.labelSums.mapValues(sum => {
          val fraction = sum / rating.maxLabelSum
          // With a probability of 90%, the *real* fraction is above
          // this value:
          val fractionLowerConfidenceBound =
            binomialProportionConfidenceIntervalLowerBound(
                sampleSize = rating.voteCount,
                proportionOfSuccesses = fraction, percent = 10.0f)
          LabelStats(sum = sum, fraction = fraction,
              fractionLowerBound = fractionLowerConfidenceBound)
        }).
        toSeq : _*)
    // Don't need labelSums no more:
    rating.labelSums = null
  }

  private def ratingImplFor(postId: String): PostRatingImpl =
    postRatings.getOrElse(postId, {
        val s = new PostRatingImpl
        postRatings.put(postId, s)
        s })

  def scoreFor(postId: String): PostRating = ratingImplFor(postId)

  /** Uses the Agresti-Coull method to calculate the lower bound
   *  of a binomial proportion confidence interval.
   *  `percent' must currently be exactly 10.0f. (In the future,
   *  perhaps more values will be accepted, but that would require
   *  some kind of a statistical table for the standard normal
   *  distribution.)
   *
   *  Find details in a very long comment at the end of this file.
   */
  private def binomialProportionConfidenceIntervalLowerBound(
      sampleSize: Int, proportionOfSuccesses: Float, percent: Float)
      : Float = {
    require(percent == 10.0f)
    require(sampleSize > 0f) // need not be an integer (Debiki specific)
    require(proportionOfSuccesses > 0f)
    val adjustment = 4f
    val n_ = sampleSize + adjustment
    val p_ = (proportionOfSuccesses * sampleSize + adjustment * 0.5) / n_
    require(p_ >= 0f)
    require(p_ <= 1f)
    // With a probability of 10%, a random value from a
    // standard normal distribution (usually denoted Z) is < -1.28.
    val z_10 = -1.28
    // With a probability of 90%, the real value of the binomial
    // proportion is *above* this value:
    val lowerBound: Double = p_ + z_10 * math.sqrt(p_ * (1 - p_) / n_)
    lowerBound.toFloat
  }

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

/*
 * Confidence bounds on label fractions
 *
 * Unless you have taken a course in probability and statistics,
 * perhaps you will understand nothing of what follows.
 *
 * (I'll be fairly verbose, because I've forgotten much of this stuff
 * and within a few years I will forget everything again, and then I'll
 * appreciate having this documentation nearby.)
 *
 * Let the label percentage, for a certain label, be
 *
 *  label-%  =  label-sum / max-possible-label-sum
 *
 * We cannot use the label-% as is.
 * For example, assume there's one vote on the relevant post.
 * Assume the label-sum for "interesting" is 1.
 * Then that post's label-% is 100% (since 1 of 1 people
 * thought it was "interesting").
 * That post would be ranked higher than a post with, say,
 * 90 votes that iniclude the "interesting" label,
 * and 10 votes that don't. (This post is only 90% interesting.)
 *
 * It's not reasonable to show all posts with 1 single vote,
 * that contain the "interesting" label, in front of
 * posts with 100 votes that are 90% interesting.
 *
 * To solve this, we can calculat confidence bounds on
 * the lower bounds of the label-%, and use these lower
 * bounds instead of the actual label-%. (Keep in mind
 * that the label-% are only *estimates* of the *real*
 * percentages for the labels. We don't know what
 * all-humans thinks, only what those-that-happened-to-read-
 * -the-post-and-vote-on-it.)
 *
 *  (TODO? Rewording? Use "rate" instead of "vote"?)
 *
 * How do we calculate confidence bounds on the label-%?
 *
 * I think the label-% is a binomial proportion.
 * This might not be obvious, since we sum values like
 * 1/1 and 1/2 and 1/3 ... to find the label-sum and
 * the-max-possible-label-sum, but in a binomial distributions
 * we add only values 1 and 0.
 * However, imagine that we multiply all these 1/1, 1/2, 1/3 ...
 * fractions with the greatest-common-divisor, gdc,
 * then we'd be adding gdc, gdc/2, gdc/3 and so on,
 * and we can (I think) consider adding gdc equivalent
 * to adding gdc successful-outcomes to a binomial distribution,
 * and adding gdc/2 being equivalent to adding gdc/2 successes,
 * and so on. In this manner we can, I think, convert our
 * vote-sum distribution to a binomial distribution, and
 * the label-% becomes the binomial proportion of that
 * binomial distribution.
 *
 * Now, my Probability and Statistics text book (from University)
 * does not explain how to compute binomial proportion confidence
 * bounds when the sample size is small (below 30 samples,
 * which in our case perhaps means below 30 votes). However,
 * if you google for "confidence bounds binomial distribution",
 * you'll find a Wikipedia article:
 *
 *   http://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval
 *
 * It says (3 July, 2010):
 *   "There are several ways to compute a confidence interval for
 *   a binomial proportion. The normal approximation interval is the
 *   simplest formula, and the one introduced in most basic Statistics
 *   classes and textbooks. This formula, however, is based on an
 *   approximation that does not always work well. Several competing
 *   formulas are available that perform better, especially for situations
 *   with a small sample size and a proportion very close to zero or one.
 *   The choice of interval will depend on how important it is to use
 *   a simple and easy to explain interval versus the desire for
 *   better accuracy."
 *
 * The article lists a few ways to estimate condidence bounds
 * for binomial proportions. The simplest method is (I think)
 * the Agresti-Coull interval. It basically adds 4 samples to the
 * population, 2 with value 0 and 2 with value 1. Hence it produces
 * some reasonable results also with small populations (e.g. only
 * one single vote). This is the formula:
 *
 *   Let n^ = n + 4
 *     where n is the number of samples
 *
 *   Let p^ = X + 2 / n^
 *     where X is the number of successes in a Bernoulli trial
 *     process (e.g. flipping a coin n = 10 times, and considering
 *     each head a success).
 *
 *   Now, a confidence interval on the proportion can be calculated,
 *   like so:
 *     p^ +- Z_{1-α/2} sqrt( p^ (1 - p^) / n^)
 *
 *   where Z_{1-α/2} is the 1−α/2 percentile of a standard
 *   normal distribution.
 *
 * Let us (somewhat arbitrarily) choose α = 0.1 (10%), and estimate
 * a lower bound only (not an upper bound) for the proportion:
 *
 *     lower-bound = p^ - Z_{1-α} sqrt( p^ (1 - p^) / n^)
 *
 * -Z_{1-0.1} = +Z_{10%} = -1.28. (That is, with a probability
 * of 10% a standard normal random value is < -1.28.)
 * 
 *   Z_{ 1%} = -2.33
 *   Z_{ 5%} = -1.65
 *   Z_{10%} = -1.28   <-- let's use 10%
 *   Z_{20%} = -0.84
 */

