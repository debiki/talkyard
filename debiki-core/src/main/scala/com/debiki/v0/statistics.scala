// vim: ts=2 sw=2 et

package com.debiki.v0

import collection.{immutable => imm, mutable => mut}
import Prelude._

case class LabelStats (

  /** Label sums.
   *
   *  The importance of each [label assigned to the relevant post in
   *  a rating] is divided with [the number of labels the rater submitted].
   *  For example, if s/he selected three labels [funny, interesting,
   *  insightful], then e.g. {@code labelStats("funny").sum} was
   *  incremented with 1/3.
   */
  sum: Float,

  /** The fraction ratings that include this label, i.e.
   *  {@code this.sum / PostRating.maxLabelSum}.
   */
  fraction: Float,

  /** A lower confidence bound on `fraction', used to sort posts and
   *  threads by popularity.
   *
   *  We cannot use `fraction' directly, when sorting posts (or threads)
   *  by popularity.
   *  For example, assume a post has 1 rating, with the value "interesting".
   *  Then {@code fractioin} would be 1.0 (i.e. it'd be rated 100%
   *  "interesting")."
   *
   *  That 100% "interesting" post, with only 1 rating, would be
   *  ranked higher than a 95% interesting post with 100 ratings.
   *  -- although the 100-ratings post is probably more interesting
   *  than the 1-ratings.post.
   *
   *  To solve this, we can calculat confidence interval bounds on
   *  `fraction' (i.e. the values 100% and 90% above), and sort posts
   *  by the the lower bounds on `fraction' (instead of `fraction' itself).
   *
   *  How do we calculate confidence bounds on `fraction'?
   *
   *  Either a rating includes a certain label, or it does not include it.
   *  So we have a binomial distribution --- except for the fact that
   *  the successes (i.e. when a rating *includes* the label) are
   *  weighted by 1/the_number_of_other_labels_also_included_in_the_rating,
   *  i.e. weighted by values 1, 1/2, 1/3, ... 1/n, where `n' is the
   *  number of labels available.
   *
   *  I think we can consider the distribution a binomial distribution
   *  anyway. Therefore, I've used [a formula for calculating
   *  binomial proportion confidence intervals] to calculate
   *  a lower bound on `fraction'. Find details in the description of the
   *  function {@code binomialProportionConfidenceIntervalLowerBound}.
   */
  fractionLowerBound: Float
)

/** Immutable.
 */
private[debiki] abstract class PostRating {

  /** How many times the related post has been rated.
   */
  def ratingCount: Int

  def labelStats: imm.Map[String, LabelStats]

  /** Sorted by LabelStats.fraction. An alternative is to sort by the
   *  lower confidence interval bound of the fraction.
   */
  def labelStatsSorted: List[(String, LabelStats)] = {
    labelStats.toList.sortWith((a, b) => a._2.fraction > b._2.fraction)
  }

  /** The highest possible label sum.
   *
   *  Each rating increments {@code maxLabelSum} with 1/number-of-tags.
   *  Example: If there are 2 ratings, on tags [interesting] and
   *  [interesting, funny], then maxLabelSum will be 1/1 + 1/2 = 1.5,
   *  and labelStats("interesting") is 1.5 (the maximum value sum
   *  -- reasonable, since everyone rated the post interesting).
   *  However, labelStats("funny") is only 0.5, which is 1/3 of the
   *  maxLabelSum. Dividing labelStats with maxLabelSum results in
   *  the relevant post being 100% interesting and 33% funny. This is
   *  reasonable, I think, since both raters (100%) thought it was
   *  "interesting". One label out of 3 labels specified "funny", so
   *  the post being 33% "funny" might also be reasonable.
   */
  def maxLabelSum: Float

  /** Depends on the ratings made, and which labels the reader likes.
   *  For example, someone might like [interestin, insightful] posts,
   *  but dislike [boring, faulty, spam] posts.
   *  Another reader might be looking for [funny] posts.
   *
   *  Currently, however, it's assumed that all humans like the labels
   *  listed in {@code StatsCalc.good} and dislike those in
   *  {@code StatsCalc.bad}.
   *
   *  Should perhaps be calculated on the client side, JavaScript?
   */
  def liking: Float

}

private[debiki] class StatsCalc(val debate: Debate) {

  private val good = imm.Set("interesting", "funny", "insightful", "helpful")
  private val bad = imm.Set("boring", "faulty", "off-topic", "spam", "troll")

  private class PostRatingImpl extends PostRating {
    var ratingCount = 0
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

    def += (rat: Rating): PostRatingImpl = {
      if (rat.tags.isEmpty)
        return this
      val weight = 1f / rat.tags.length
      for (value <- rat.tags) {
        val curSum = labelSums.getOrElse(value, 0f)
        labelSums(value) = curSum + 1f * weight
        // results in: "illegal cyclic reference involving trait Iterable"
        // Only in NetBeans, not when compiling, in real life???
      }
      maxLabelSum += weight
      ratingCount += 1
      this
    }
  }

  private val postRatings = mut.Map[String, PostRatingImpl]()

  // Calculate temporary label sums, in PostRatingImpl.labelSums
  for (v <- debate.ratings) ratingImplFor(v.postId) += v

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
                sampleSize = rating.ratingCount,
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
   *  `percent' must currently be exactly 10.0f. (Because that's the
   *  only cumulative standard normal probability table value I've
   *  included in the function.)
   *
   *  The Agresti-Coull method is used because it works also for small
   *  sample sizes, i.e. < 30 samples (it'll probably be common with
   *  posts that have been rated only a few times).
   *  And because I think it's the simplest method.
   *
   *  The method works as follows. It basically adds 4 fake samples to the
   *  population, 2 with value 0 and 2 with value 1. Hence it works also
   *  when there's only one single sample (since it fakes 4 more samples).
   *  This is the formula:
   *
   *    Let n^ = number_of_samples + 4
   *
   *    Let p^ = number_of_successes + 2 / n^
   *      where number_of_successes is the number of successes in a
   *      Bernoulli trial process (e.g. flipping a coin n = 10 times,
   *      and considering each head a success).
   *
   *    Now, a confidence interval on the proportion can be calculated,
   *    like so:
   *      p^ +- Z_{1-α/2} sqrt( p^ (1 - p^) / n^)
   *
   *    where Z_{1-α/2} is the 1−α/2 percentile of a standard
   *    normal distribution.
   *
   *  Let us (somewhat arbitrarily) choose α = 0.2 (i.e. 2 * 10%), and
   *  estimate a lower bound only (not an upper bound) for the proportion:
   *
   *      lower-bound = p^ - Z_{1-α/2} sqrt( p^ (1 - p^) / n^)
   *
   *  -Z_{1-0.2/2} = +Z_{10%} = -1.28. (That is, with a probability
   *  of 10%, a standard normal random value is < -1.28.)
   *
   *  Some nearby values:
   *    Z_{ 1%} = -2.33
   *    Z_{ 5%} = -1.65
   *    Z_{10%} = -1.28   <-- let's use 10%
   *    Z_{20%} = -0.84
   *
   *  Why 90%? 90% is (is it??) a fairly low percentile
   *  (95% or higher is more common?). The efefct should be that
   *  new posts (well, posts with few ratings) are shown to relatively many
   *  people, instead of falling into oblivion, unread.
   */
  private def binomialProportionConfidenceIntervalLowerBound(
      sampleSize: Int, proportionOfSuccesses: Float, percent: Float)
      : Float = {
    require(percent == 10.0f)
    require(sampleSize >= 1)
    require(proportionOfSuccesses >= 0f)
    require(proportionOfSuccesses <= 1f)
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

Post score =  { #interesting, #insightful, #stupid, #boring ...} / rating-count


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
