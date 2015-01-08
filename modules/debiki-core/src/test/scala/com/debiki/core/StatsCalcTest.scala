/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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
import org.specs2.mutable._
import Util._

/*
Cannot debug this:
class PageStatsTest extends SpecificationWithJUnit {
NetBeans says:
  Testsuite: com.debiki.core.PageStatsTest
  Tests run: 1, Failures: 0, Errors: 1, Time elapsed: 0 sec

  Null Test:         Caused an ERROR
  null
  java.lang.ExceptionInInitializerError
          at java.lang.Class.forName0(Native Method)
          at java.lang.Class.forName(Class.java:169)
  Caused by: java.lang.RuntimeException: Uncompilable source code
   - interface expected here
          at com.debiki.core.PageStatsTest.<clinit>(PageStatsTest.java:2)
*/


object Util {

  /** The upper and lower bounds for an 80% confidence interval for a binomial
   *  proportion, estimated using the Agresti-Coull method.
   *  (The probability the real proportion is higher the value
   *  returned is 90% (not 80%).)
   */
  def binProp80ConfIntAC(trials: Int, prop: Float): (Float, Float) = {
    require(trials >= 0)
    require(prop >= 0f && prop <= 1f)
    var n2 = trials + 4
    var p2 = (prop * trials + 2) / n2
    val root = math.sqrt(p2 * (1-p2) / n2).toFloat
    val z10 = 1.28f
    (p2 - z10 * root, p2 + z10 * root)
  }

  /*
  val post = RawPostAction(
    id = 1001, postId = 1001, creationDati = new ju.Date, loginId = "?", userId = "?",
    newIp = None, payload = PostActionPayload.CreatePost(parentPostId = Some(1000),
      text = "test", markup = "", approval = Some(Approval.WellBehavedUser)))

  val debate = PageParts("test", actionDtos = post::Nil)

  val rating_interesting =
        Rating(id = 1002, postId = post.id, loginId = "?", userId = "?", ctime = new ju.Date,
               newIp = None, tags = List("interesting"))

  val rating_stupid =
        Rating(id = 1003, postId = post.id, loginId = "?", userId = "?", ctime = new ju.Date,
               newIp = None, tags = List("stupid"))
  */
}



class PostRatingTest extends Specification {

  // These tests work (worked?) okay, until I did some refactoring;
  // now they don't compile. But StatsCalc seems to work just fine :-)
  /*
  "For an unrated post, PageStats" should {
    "find no statistics" in {
      val pageStats = new PageStats(debate, PageTrust(debate))
      val ratingStats = pageStats.ratingStatsFor(post.id)
      ratingStats.ratingCountUntrusty must_== 0
      ratingStats.ratingCountTrusty must_== 0
      ratingStats.tagCountMaxWeighted must_== 0
      ratingStats.tagStats.size must_== 0
      ratingStats.tagStats.get("interesting") must beNone
      ratingStats.tagStats.get("stupid") must beNone
      ratingStats.tagStats.get("funny") must beNone
    }
  }

  "For a post with one rating, PageStats" should {
    "find one rating" in {
      val debate2 = debate + rating_interesting
      val pageStats = new PageStats(debate2, PageTrust(debate))
      val ratingStats = pageStats.ratingStatsFor(post.id)
      ratingStats.ratingCountUntrusty must_== 1
      ratingStats.ratingCountTrusty must_== 1
      ratingStats.tagCountMaxWeighted must_== 1.0f
      ratingStats.tagStats.size must_== 1
      val intrTagStats = ratingStats.tagStats("interesting")
      intrTagStats.countWeighted must_== 1.0f
      intrTagStats.probabilityMeasured must_== 1.0f
      intrTagStats.lowerConfLimitOnProb must beCloseTo(
          binProp80ConfIntAC(trials = 1, prop = 1f)._1, 0.01f)
      ratingStats.tagStats.get("stupid") must beNone
      ratingStats.tagStats.get("funny") must beNone
    }
  }

  "For a post with two different rating tags, PageStats" should {
    "do something sensible" in {
      val debate2 = debate + rating_interesting + rating_stupid
      val pageStats = new PageStats(debate2, PageTrust(debate))
      val ratingStats = pageStats.ratingStatsFor(post.id)
      ratingStats.ratingCountUntrusty must_== 2
      unimplemented; ratingStats.ratingCountTrusty must_== 0.5  // ??
      ratingStats.tagCountMaxWeighted must_== 2.0f
      ratingStats.tagStats.size must_== 2
      val intrTagStats = ratingStats.tagStats("interesting")
      intrTagStats.countWeighted must_== 1.0f
      intrTagStats.probabilityMeasured must_== 0.5f
      intrTagStats.lowerConfLimitOnProb must beCloseTo(
          binProp80ConfIntAC(trials = 2, prop = 0.5f)._1, 0.01f)
      val stupidTagStats = ratingStats.tagStats("stupid")
      stupidTagStats.countWeighted must_== 1.0f
      stupidTagStats.probabilityMeasured must_== 0.5f
      stupidTagStats.lowerConfLimitOnProb must beCloseTo(
          binProp80ConfIntAC(trials = 2, prop = 0.5f)._1, 0.01f)
      ratingStats.tagStats.get("funny") must beNone
    }
  }
  */
}

/*
class EditLikingTest extends Specification {

  val edit = Edit(post.id +"Ea", postId = post.id, ctime = new ju.Date,
                  loginId = "?", newIp = None, text = "text")
  val upVote = EditVote(edit.id, "?", "1.2.3.4", new ju.Date, List(edit.id), Nil)
  // Yet another up vote:
  val upVote2 = EditVote("?", "?", "1.2.3.4", new ju.Date, List(edit.id), Nil)
  val downVote = EditVote("?", "?", "1.2.3.4", new ju.Date, Nil, List(edit.id))

  // Won't compile, + no longer exists.
  "An Edit with no votes should have a certain liking" in {
    val liking = new PageStats(debate + edit).likingFor(edit)
    val bounds = binProp80ConfIntAC(trials = 0, prop = 0f)
    liking.lowerBound must beCloseTo(bounds._1, 0.01f)
    liking.upperBound must beCloseTo(bounds._2, 0.01f)
    liking.voteCount must_== 0
  }

  "An Edit with 1 up vote should have a certain liking" in {
    val liking = new PageStats(debate + edit + upVote).likingFor(edit)
    val bounds = binProp80ConfIntAC(trials = 1, prop = 1f)
    liking.lowerBound must beCloseTo(bounds._1, 0.01f)
    liking.upperBound must beCloseTo(bounds._2, 0.01f)
    liking.voteCount must_== 1
  }

  "An Edit with 2 up votes should have a certain liking" in {
    val liking = new PageStats(debate + edit + upVote + upVote2).likingFor(edit)
    val bounds = binProp80ConfIntAC(trials = 2, prop = 1f)
    liking.lowerBound must beCloseTo(bounds._1, 0.01f)
    liking.upperBound must beCloseTo(bounds._2, 0.01f)
    liking.voteCount must_== 2
  }

  "An Edit with 1 down vote should have a certain liking" in {
    val liking = new PageStats(debate + edit + downVote).likingFor(edit)
    val bounds = binProp80ConfIntAC(trials = 1, prop = 0f)
    liking.lowerBound must beCloseTo(bounds._1, 0.01f)
    liking.upperBound must beCloseTo(bounds._2, 0.01f)
    liking.voteCount must_== 1
  }

  "An Edit with 2 up votes and 1 down vote should have a certain liking" in {
    val liking = new PageStats(
          debate + edit + upVote + upVote2 + downVote).likingFor(edit)
    val bounds = binProp80ConfIntAC(trials = 3, prop = 0.666667f)
    liking.lowerBound must beCloseTo(bounds._1, 0.01f)
    liking.upperBound must beCloseTo(bounds._2, 0.01f)
    liking.voteCount must_== 3
  }

}
*/
