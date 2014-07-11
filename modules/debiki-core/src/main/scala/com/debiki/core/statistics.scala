/**
 * Copyright (C) 2011-2012 Kaj Magnus Lindberg (born 1979)
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

import collection.{immutable => imm, mutable => mut}
import java.{util => ju}
import Prelude._
import Distributions._


/* Related reading:
 *
 * 1. http://www.evanmiller.org/how-not-to-sort-by-average-rating.html
 * — It's about sorting comments by the lower bound of a binomial proportion
 * estimate of the "true" usefulness/fitness of the comment.
 * (I came up with the methods here independently of that article.)
 * (Already implemented.)
 *
 * And Reddit has taken the same approach:
 *  http://blog.reddit.com/2009/10/reddits-new-comment-sorting-system.html?m=1
 *
 * 2. www.debiki.com/-9qb49-solving-problem-first-comment-gets-all-upvotes
 * — that's an article I wrote about taking into account how many people have
 * actually *read* a comment, not just up/down votes).
 */



object Distributions {

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
  def binPropConfIntACLowerBound(
      sampleSize: Float, proportionOfSuccesses: Float, percent: Float)
      : Float = {
    if (sampleSize == 0f)
      return BinProp80ConfIntACNoSamples

    binPropImpl(sampleSize, proportionOfSuccesses, percent)
  }


  def binPropImpl(sampleSize: Float, proportionOfSuccesses: Float, percent: Float): Float = {
    require(percent == 80.0f)
    require(sampleSize >= 0f)
    require(proportionOfSuccesses >= 0f)
    require(proportionOfSuccesses <= 1f)

    val adjustment = 4f
    val n_ = sampleSize + adjustment
    val p_ = (proportionOfSuccesses * sampleSize + adjustment * 0.5f) / n_
    require(p_ >= 0f)
    require(p_ <= 1f)

    // With a probability of 90%, a random value from a
    // standard normal distribution (usually denoted Z) is > 1.28.
    val z_90 = 1.28f
    val square = z_90 * math.sqrt(p_ * (1 - p_) / n_)
    // With a probability of 80%, the real value of the binomial
    // proportion is between lowerBound and upperBound.
    val lowerBound: Double = p_ - square
    val upperBound: Double = p_ + square
    lowerBound.toFloat
  }


  /** Pre-calculated binomial proportion 80% confidence interval,
   *  for a binomial proportion with no samples (!),
   *  calculated using the Agresti-Coull (AC) method.
   */
  val BinProp80ConfIntACNoSamples: Float = binPropImpl(
                sampleSize = 0f, proportionOfSuccesses = 0f, percent = 80.0f)

}


// vim: fdm=marker et ts=2 sw=2 fo=tcqwn list
