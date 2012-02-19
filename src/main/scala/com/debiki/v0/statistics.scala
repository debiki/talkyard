// vim: fdm=marker et ts=2 sw=2 tw=80 fo=tcqwn list

package com.debiki.v0

import collection.{immutable => imm, mutable => mut}
import java.{util => ju}
import PostRatingStats._
import Prelude._
import Distributions._


case class ConfidenceInterval(
  observedMean: Float,
  lowerLimit: Float,
  upperLimit: Float
){
  assert(0f <= observedMean && observedMean <= 1f)
  assert(0f <= lowerLimit && lowerLimit <= 1f)
  assert(0f <= upperLimit && upperLimit <= 1f)
}


/** Post rating tag statistics. Should be placed in PostRatingStats.
 */
case class TagStats (

  /** The number of times this tag has been tagged to the related post,
   *  weighted by the total number of tags.
   *
   *  The importance of each tag is divided with [the number of tags
   *  the rater submitted].
   *  For example, if s/he selects three tags [funny, interesting,
   *  insightful], then e.g. {@code tagStats("funny").countWeighted}
   *  increases with 1/3.
   */
  countWeighted: Float,

  /** The fittingness of tagging the related post with this tag (when you
   *  rate the post).
   *
   *  The observedMean is the fraction ratings that include this tag, i.e.
   *  {@code countWeighted / PostRatingStats.tagCountMaxWeighted}.
   *  This is also the observed probability that a user tags the related post
   *  with this tag. And that should be an estimate of the fittingness
   *  of this tag for the related post (well, unless users try to game
   *  the system).
   *
   *  (This comment is not really correct, since this is a lower bound for one
   *  single rating tag only, not for how-much-people-like-the-actual-*post*.)
   *
   *  We cannot use fitness.observedMean directly, when sorting posts
   *  (or threads) by popularity.
   *  For example, assume a post has 1 rating, with the value "interesting".
   *  Then {@code observedMean} would be 1.0 (i.e. it'd be rated 100%
   *  "interesting")."
   *
   *  That 100% "interesting" post, with only 1 rating, would be
   *  ranked higher than a 95% interesting post with 100 ratings.
   *  -- although the 100-ratings post is probably more interesting
   *  than the 1-ratings.post.
   *
   *  To solve this, we can calculate confidence interval bounds on
   *  the probability that someone uses this tag, and sort posts
   *  by the the lower confidence limit on that probability
   *  (instead of sorting by the probabilityMeasured).
   *
   *  How do we calculate confidence bounds?
   *
   *  Either a rating includes a certain tag, or it does not include it.
   *  So we have a binomial distribution --- except for the fact that
   *  the successes (i.e. when a rating *includes* the tag) are
   *  weighted by 1/the_number_of_other_tags_also_included_in_the_rating,
   *  i.e. weighted by 1 or 1/2 or 1/3 or ... 1/n, where `n' is the
   *  number of tags available.
   *
   *  I think we can consider the distribution a binomial distribution
   *  anyway. Therefore, I've used [a formula for calculating
   *  binomial proportion confidence intervals] to calculate
   *  a lower confidence bound. Find details in the description of the
   *  function {@code binPropConfIntAC}.
   */
  val fitness: ConfidenceInterval
)


object PostRatingStats {
  val DefaultLikedTags = List("interesting", "funny", "insightful", "helpful")

  //val DefaultDissedTags = imm.Set(
  //  "boring", "faulty", "off-topic", "spam", "troll", "stupid")
}


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

  /** Tag statistics by tag name.
   */
  def tagStats: imm.Map[String, TagStats]

  /** The highest possible occurrence count, for a tag.
   *
   *  Each rating increments {@code tagCountMaxWeighted} with
   *  1/number-of-tags-included-in-that-rating.
   *  Example: If there are 2 ratings, on tags [interesting] and
   *  [interesting, funny], then tagCountMaxWeighted will be 1/1 + 1/2 = 1.5.
   *  Note that:
   *  - Also tagStats("interesting").countWeighted will be 1.5,
   *    Reasonable, since everyone rated the post interesting.
   *  - tagStats("funny").countWeighted will be only 0.5, that is, 1/3 of
   *    tagCountMaxWeighted.
   *  - Dividing tagStats.countWeighted with maxTagCountWeighted results in
   *    100% for the "interesting" tag, and 33% for the "funny" tag. This is
   *    reasonable, I think, since both raters (100%) thought it was
   *    "interesting". One tag out of 3 tags specified "funny", so
   *    the post being 33% "funny" might also be reasonable.
   *    (The "interesting" and "funny" tags would have a
   *    TagStats.fittnes.observedMean of 100% and 33% respectively.)
   */
  def tagCountMaxWeighted: Float

  /** The weighted number of [tags applied to the related post] that
   *  the user likes.
   *
   *  For example, if there are two ratings for the related
   *  post, with tags [interesting] and [funny, stupid], respectively,
   *  and likedTags is [interesting, funny], then the
   *  weighted count is 1/1 + 1/2 = 1.5,
   *  since, for the first rating, 1 of 1 tags are liked,
   *  and, for the second rating, 1 of 2 tags are liked.
   *
   *  The maximum possible value is ratingCount.
   *  If likedTagCountWeighted == ratingCount, then the related post has been
   *  tagged only with tags the reader likes (i.e. only with tags in likedTags).
   */
  def likedTagCountWeighted(likedTags: List[String]): Float = {
    // These two approaches should yield the same result:
    // A) For each rating, count all likedTags for that rating, and
    //    increment likedTagCountWeighted with
    //      num_liked_tags_for_that_rating / total_num_tags_for_that_rating.
    // B) For each tag, loop over all post ratings, and calculate
    //    the TagStats.countWeighted. Then, add the countWeighted for
    //    all likedTags.
    // Use approach B since TagStats.countWeighted has already been
    // calculated.
    likedTags.foldLeft(0f)((countThisFar: Float, tagName: String) => {
      countThisFar + tagStats.get(tagName).map(_.countWeighted).getOrElse(0f)
    })
  }

  /** The fittingness of the related post, if you like the likedTags.
   *
   *  An 80% confidence interval on the probability that the related post
   *  is appropriate to show the related post to a user who likes tags
   *  in likedTags.
   */
  def fitness(likedTags: List[String]): ConfidenceInterval = {
    if (ratingCount == 0)
      return binProp80ConfIntACNoSamples

    val countWeighted = likedTagCountWeighted(likedTags)
    val observedMean = countWeighted / ratingCount
    binPropConfIntAC(
       sampleSize = ratingCount,
       proportionOfSuccesses = observedMean,
       percent = 80.0f)
  }

  lazy val fitnessDefaultTags: ConfidenceInterval =
    fitness(DefaultLikedTags)
}


/** Immutable.
 */
abstract class EditLiking {
  def voteCount: Int
  def upperBound: Float
  def lowerBound: Float
  def frac: Float
}


private[debiki] class PageStats(val debate: Debate, val pageTrust: PageTrust) {

  private class PostRatingStatsImpl extends PostRatingStats {
    var ratingCount = 0
    var tagStats = imm.Map[String, TagStats]() // updated later
    var tagCountMaxWeighted = 0f
    var tagCountsWeighted = mut.HashMap[String, Float]()  // thrown away later

    def lastRatingDate = new ju.Date(_lastRatingDateMillis)
    var _lastRatingDateMillis: Long = 0

    /*
    override lazy val liking: Float = {
      def sumMatching(set: imm.Set[String]): Float =
        (0f /: set) (
          _ + tagStats.get(_).map(_.probabilityMeasured).getOrElse(0f))
      val goodScore = sumMatching(good)
      val badScore = sumMatching(bad)
      goodScore - badScore
    } */

    def addRating(rating: Rating) {
      if (rating.tags.isEmpty) return
      val trustiness = pageTrust.trustinessOf(rating)
      if (trustiness == 0f) return
      val weight = trustiness / rating.tags.length
      tagCountMaxWeighted += weight
      for (tagName <- rating.tags) {
        val curTagCount = tagCountsWeighted.getOrElse(tagName, 0f)
        tagCountsWeighted(tagName) = curTagCount + 1f * weight
        // results in: "illegal cyclic reference involving trait Iterable"
        // Only in NetBeans, not when compiling, in real life???
      }
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
    var lowerBound = binProp80ConfIntACNoSamples.lowerLimit
    var upperBound = binProp80ConfIntACNoSamples.upperLimit
    def addLiking(value: Int) {
      require(value == 0 || value == 1)
      sum += value
      voteCount += 1
    }
    override def toString = "EditLiking[votes: "+ voteCount + ", frac: "+
        frac + ", lower: "+ lowerBound +", upper: "+ upperBound +"]"
  }

  private val postRatingStats = mut.Map[String, PostRatingStatsImpl]()
  private val postRatingStatsEmpty = new PostRatingStatsImpl

  private val editLikings = mut.Map[String, EditLikingImpl]()
  private val editLikingNoVotes = new EditLikingImpl

  // Calculate edit vote sums.
  for (editVote <- debate.editVotes) {
    def addLiking(id: String, value: Int) =
      editLikings.getOrElseUpdate(id, new EditLikingImpl).addLiking(value)
    for (editId <- editVote.like) addLiking(editId, 1)
    for (editId <- editVote.diss) addLiking(editId, 0)
  }

  // Calculate tag counts, store in mutable map.
  for (r <- debate.ratings) {
    postRatingStats.getOrElseUpdate(
        r.postId, new PostRatingStatsImpl).addRating(r)
  }

  // Convert tag counts to immutable post-rating-TagStats.
  for ((postId, ratingStats) <- postRatingStats) {
    ratingStats.tagStats =
      imm.Map[String, TagStats](
        ratingStats.tagCountsWeighted.mapValues(tagCountWeighted => {
          val tagProbMeasured =
              tagCountWeighted / ratingStats.tagCountMaxWeighted
          // With a probability of 90% (not 80%), the probability that a user
          // uses the related tag is above fitness.lowerLimit.
          val fitness =
            binPropConfIntAC(sampleSize = ratingStats.ratingCount,
                proportionOfSuccesses = tagProbMeasured, percent = 80.0f)
          TagStats(tagCountWeighted, fitness)
        }).
        toSeq : _*)
    ratingStats.tagCountsWeighted = null  // don't retain memory
  }

  // Calculate edit likings from edit votes.
  for ((editId, liking) <- editLikings) {
    val bounds = binPropConfIntAC(sampleSize = liking.voteCount,
          proportionOfSuccesses = liking.frac, percent = 80.0f)
    liking.lowerBound = bounds.lowerLimit
    liking.upperBound = bounds.upperLimit
  }

  def ratingStatsFor(postId: String): PostRatingStats =
    postRatingStats.getOrElse(postId, postRatingStatsEmpty)


  /** The lower bound of a 90% confidence interval of the proportion
   *  of voters that like the edit (a value between 0 and 1).
   */
  def likingFor(e: Edit): EditLiking = likingFor(e.id)

  def likingFor(editId: String): EditLiking =
    editLikings.getOrElse(editId, editLikingNoVotes)
}


private[debiki] object Distributions {

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
  def binPropConfIntAC(
      sampleSize: Int, proportionOfSuccesses: Float, percent: Float)
      : ConfidenceInterval = {
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
    ConfidenceInterval(
       observedMean = proportionOfSuccesses,
       lowerLimit = lowerBound.toFloat,
       upperLimit = upperBound.toFloat)
  }

  /** Pre-calculated binomial proportion 80% confidence interval,
   *  for a binomial proportion with no samples (!),
   *  calculated using the Agresti-Coull (AC) method.
   */
  val binProp80ConfIntACNoSamples: ConfidenceInterval = binPropConfIntAC(
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
