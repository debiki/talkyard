// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

package com.debiki.v0

import collection.{immutable => imm, mutable => mut}
import java.{util => ju}
import Prelude._


/** Post rating tag statistics. Should be placed in PostRatingStats.
 */
case class TagStats (

  /** Tag sums.
   *
   *  The importance of each [tag assigned to the relevant post in
   *  a rating] is divided with [the number of tags the rater submitted].
   *  For example, if s/he selected three tags [funny, interesting,
   *  insightful], then e.g. {@code tagStats("funny").sum} was
   *  incremented with 1/3.
   */
  sum: Float,

  /** The fraction ratings that include this tag, i.e.
   *  {@code this.sum / PostRatingStats.maxTagSum}.
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
   *  Either a rating includes a certain tag, or it does not include it.
   *  So we have a binomial distribution --- except for the fact that
   *  the successes (i.e. when a rating *includes* the tag) are
   *  weighted by 1/the_number_of_other_tags_also_included_in_the_rating,
   *  i.e. weighted by values 1, 1/2, 1/3, ... 1/n, where `n' is the
   *  number of tags available.
   *
   *  I think we can consider the distribution a binomial distribution
   *  anyway. Therefore, I've used [a formula for calculating
   *  binomial proportion confidence intervals] to calculate
   *  a lower bound on `fraction'. Find details in the description of the
   *  function {@code binPropConfIntAC}.
   */
  fractionLowerBound: Float
)


/** Immutable.
 */
private[debiki] abstract class PostRatingStats {

  /** How many times the related post has been rated.
   */
  def ratingCount: Int

  /** When the last rating was posted.
   *
   *  A new Date instance is returned, since Date is mutable.
   */
  def lastRatingDate: ju.Date

  def tagStats: imm.Map[String, TagStats]

  /** Sorted by TagStats.fraction, descending.
   *  (No point in sorting by fractionLowerBound, because single votes
   *  cannot give a rating-tag a high fraction, if there are already many votes
   *  on other tags.)
   */
  def tagStatsSorted: List[(String, TagStats)] = {
    tagStats.toList.sortWith((a, b) => a._2.fraction > b._2.fraction)
  }

  /** The highest possible tag sum.
   *
   *  Each rating increments {@code maxTagSum} with 1/number-of-tags.
   *  Example: If there are 2 ratings, on tags [interesting] and
   *  [interesting, funny], then maxTagSum will be 1/1 + 1/2 = 1.5,
   *  and tagStats("interesting") is 1.5 (the maximum value sum
   *  -- reasonable, since everyone rated the post interesting).
   *  However, tagStats("funny") is only 0.5, which is 1/3 of the
   *  maxTagSum. Dividing tagStats with maxTagSum results in
   *  the relevant post being 100% interesting and 33% funny. This is
   *  reasonable, I think, since both raters (100%) thought it was
   *  "interesting". One tag out of 3 tags specified "funny", so
   *  the post being 33% "funny" might also be reasonable.
   */
  def maxTagSum: Float

  /** Depends on the ratings made, and which tags the reader likes.
   *  For example, someone might like [interestin, insightful] posts,
   *  but dislike [boring, faulty, spam] posts.
   *  Another reader might be looking for [funny] posts.
   *
   *  Currently, however, it's assumed that all humans like the tags
   *  listed in {@code PageStats.good} and dislike those in
   *  {@code PageStats.bad}.
   *
   *  Should perhaps be calculated on the client side, JavaScript?
   */
  def liking: Float

}


/** Immutable.
 */
abstract class EditLiking {
  def voteCount: Int
  def upperBound: Float
  def lowerBound: Float
  def frac: Float
}


private[debiki] class PageStats(val debate: Debate) {

  import PageStats._

  private val good = imm.Set("interesting", "funny", "insightful", "helpful")
  private val bad = imm.Set("boring", "faulty", "off-topic", "spam", "troll",
                            "stupid")

  private class PostRatingImpl extends PostRatingStats {
    var ratingCount = 0
    var maxTagSum = 0f
    var tagStats = imm.Map[String, TagStats]() // updated later
    var tagSums = mut.HashMap[String, Float]()  // thrown away later

    def lastRatingDate = new ju.Date(_lastRatingDateMillis)
    var _lastRatingDateMillis: Long = 0

    override lazy val liking: Float = {
      def sumMatching(set: imm.Set[String]): Float =
        (0f /: set) (_ + tagStats.get(_).map(_.fraction).getOrElse(0f))
      val goodScore = sumMatching(good)
      val badScore = sumMatching(bad)
      goodScore - badScore
    }

    def addRating(rating: Rating) {
      if (rating.tags.isEmpty) return
      val weight = 1f / rating.tags.length
      for (value <- rating.tags) {
        val curSum = tagSums.getOrElse(value, 0f)
        tagSums(value) = curSum + 1f * weight
        // results in: "illegal cyclic reference involving trait Iterable"
        // Only in NetBeans, not when compiling, in real life???
      }
      // For each liked tag, likedTagsSum += weight
      // For each dissed tag, dissedTagsSum += weight
      maxTagSum += weight
      ratingCount += 1
      if (rating.ctime.getTime > _lastRatingDateMillis)
        _lastRatingDateMillis = rating.ctime.getTime
      this
    }
  }

  private class EditLikingImpl extends EditLiking {
    var voteCount = 0
    var sum = 0f
    def frac = sum / voteCount
    var lowerBound = binProp80ConfIntACNoSamples._1
    var upperBound = binProp80ConfIntACNoSamples._2
    def addLiking(value: Int) {
      require(value == 0 || value == 1)
      sum += value
      voteCount += 1
    }
    override def toString = "EditLiking[votes: "+ voteCount + ", frac: "+
        frac + ", lower: "+ lowerBound +", upper: "+ upperBound +"]"
  }

  private val postRatings = mut.Map[String, PostRatingImpl]()
  private val postRatingEmpty = new PostRatingImpl

  private val editLikings = mut.Map[String, EditLikingImpl]()
  private val editLikingNoVotes = new EditLikingImpl

  // Calculate edit vote sums.
  for (editVote <- debate.editVotes) {
    def addLiking(id: String, value: Int) =
      editLikings.getOrElseUpdate(id, new EditLikingImpl).addLiking(value)
    for (editId <- editVote.like) addLiking(editId, 1)
    for (editId <- editVote.diss) addLiking(editId, 0)
  }

  // Calculate temporary tag sums, in PostRatingImpl.tagSums.
  for (r <- debate.ratings) {
    postRatings.getOrElseUpdate(r.postId, new PostRatingImpl).addRating(r)
  }

  // Convert temporary tag sums to immutable post-rating-TagStats.
  for ((postId, rating) <- postRatings) {
    // Also calculate liked tag % lower bound on confidence interval?
    rating.tagStats =
      imm.Map[String, TagStats](
        rating.tagSums.mapValues(sum => {
          val fraction = sum / rating.maxTagSum
          // With a probability of 90%, the *real* fraction is above
          // this value:
          val fractionLowerConfidenceBound =
            binPropConfIntAC(sampleSize = rating.ratingCount,
                proportionOfSuccesses = fraction, percent = 80.0f)._1
          TagStats(sum = sum, fraction = fraction,
              fractionLowerBound = fractionLowerConfidenceBound)
        }).
        toSeq : _*)
    // Don't need tagSums no more:
    rating.tagSums = null
  }

  // Calculate edit likings from edit votes.
  for ((editId, liking) <- editLikings) {
    val bounds = binPropConfIntAC(sampleSize = liking.voteCount,
          proportionOfSuccesses = liking.frac, percent = 80.0f)
    liking.lowerBound = bounds._1
    liking.upperBound = bounds._2
  }

  def ratingStatsFor(postId: String): PostRatingStats =
    postRatings.getOrElse(postId, postRatingEmpty)


  /** The lower bound of a 90% confidence interval of the proportion
   *  of voters that like the edit (a value between 0 and 1).
   */
  def likingFor(e: Edit): EditLiking = likingFor(e.id)

  def likingFor(editId: String): EditLiking =
    editLikings.getOrElse(editId, editLikingNoVotes)
}


private[debiki] object PageStats {

  /** Uses the Agresti-Coull method to calculate upper and lower bounds
   *  of a binomial proportion 80% confidence interval.
   *  `percent' must currently be exactly 80.0f. (Because that's the
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
   *    Z_{10%} = -1.28   <-- let's use 20%, 20% / 2 = 10%
   *    Z_{20%} = -0.84
   *
   *  Why 80%? 80% is (is it??) a fairly low percentile
   *  (95% or higher is more common?). The efefct should be that
   *  new posts (probably those with few ratings) are shown to
   *  relatively many people, instead of falling into oblivion, unread.
   */
  private def binPropConfIntAC(
      sampleSize: Int, proportionOfSuccesses: Float, percent: Float)
      : (Float, Float) = {
    require(percent == 80.0f)
    require(sampleSize >= 0)
    require(proportionOfSuccesses >= 0f)
    require(proportionOfSuccesses <= 1f)
    val adjustment = 4f
    val n_ = sampleSize + adjustment
    val p_ = (proportionOfSuccesses * sampleSize + adjustment * 0.5) / n_
    require(p_ >= 0f)
    require(p_ <= 1f)
    // With a probability of 90%, a random value from a
    // standard normal distribution (usually denoted Z) is > 1.28.
    val z_90 = 1.28
    val square = z_90 * math.sqrt(p_ * (1 - p_) / n_)
    // With a probability of 80%, the real value of the binomial
    // proportion is between lowerBound and upperBound.
    val lowerBound: Double = p_ - square
    val upperBound: Double = p_ + square
    (lowerBound.toFloat, upperBound.toFloat)
  }

  /** Pre-calculated binomial proportion 80% confidence interval,
   *  for a binomial proportion with no samples (!),
   *  calculated using the Agresti-Coull (AC) method.
   */
  val binProp80ConfIntACNoSamples: (Float, Float) = binPropConfIntAC(
                sampleSize = 0, proportionOfSuccesses = 0, percent = 80.0f)
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
Off topic / byter ämne / urspårat
Advertisement / reklam

Other:

Annat:

 */
