// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import org.specs._
import org.specs.runner.{ConsoleRunner, JUnit4}
import java.{util => ju}

//class PageStatsTest extends JUnit4(PageStatsSpec)
//object PageStatsTestRunner extends ConsoleRunner(PageStatsSpec)

//class PageStatsTest extends SpecificationWithJUnit {
/*
Cannot debug this:
class PageStatsTest extends SpecificationWithJUnit {
NetBeans says:
  Testsuite: com.debiki.v0.PageStatsTest
  Tests run: 1, Failures: 0, Errors: 1, Time elapsed: 0 sec

  Null Test:         Caused an ERROR
  null
  java.lang.ExceptionInInitializerError
          at java.lang.Class.forName0(Native Method)
          at java.lang.Class.forName(Class.java:169)
  Caused by: java.lang.RuntimeException: Uncompilable source code
   - interface expected here
          at com.debiki.v0.PageStatsTest.<clinit>(PageStatsTest.java:2)
*/

//object PageStatsSpec extends Specification {

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

  val post = Post(id = "Ca", parent = "0", date = new ju.Date,
                  loginId = "?", newIp = None, text = "test",
                  markup = "", tyype = PostType.Text)
  val debate = Debate("test", posts = post::Nil)
  val rating_interesting =
        Rating(id = "?", postId = post.id, loginId = "?", date = new ju.Date,
               newIp = None, tags = List("interesting"))
  val rating_stupid =
        Rating(id = "?", postId = post.id, loginId = "?", date = new ju.Date,
               newIp = None, tags = List("stupid"))
}

import Util._

class PostRatingTest extends SpecificationWithJUnit {

  "For an unrated post, PageStats" should {
    "find no statistics" in {
      val calcer = new PageStats(debate)
      val rating = calcer.scoreFor(post.id)
      rating.ratingCount must_== 0
      rating.maxLabelSum must_== 0
      rating.labelStats.size must_== 0
      rating.labelStats.get("interesting") must beNone
      rating.labelStats.get("stupid") must beNone
      rating.labelStats.get("funny") must beNone
    }
  }

  "For a post with one rating, PageStats" should {
    "find one rating" in {
      val debate2 = debate + rating_interesting
      val calcer = new PageStats(debate2)
      val rating = calcer.scoreFor(post.id)
      rating.ratingCount must_== 1
      rating.maxLabelSum must_== 1.0f
      rating.labelStats.size must_== 1
      val intresting = rating.labelStats("interesting")
      intresting.sum must_== 1.0f
      intresting.fraction must_== 1.0f
      intresting.fractionLowerBound must beCloseTo(
          binProp80ConfIntAC(trials = 1, prop = 1f)._1, 0.01f)
      rating.labelStats.get("stupid") must beNone
      rating.labelStats.get("funny") must beNone
    }
  }

  "For a post with two different rating tags, PageStats" should {
    "do something sensible" in {
      val debate2 = debate + rating_interesting + rating_stupid
      val calcer = new PageStats(debate2)
      val rating = calcer.scoreFor(post.id)
      rating.ratingCount must_== 2
      rating.maxLabelSum must_== 2.0f
      rating.labelStats.size must_== 2
      val intresting = rating.labelStats("interesting")
      intresting.sum must_== 1.0f
      intresting.fraction must_== 0.5f
      intresting.fractionLowerBound must beCloseTo(
          binProp80ConfIntAC(trials = 2, prop = 0.5f)._1, 0.01f)
      val stupid = rating.labelStats("stupid")
      stupid.sum must_== 1.0f
      stupid.fraction must_== 0.5f
      stupid.fractionLowerBound must beCloseTo(
          binProp80ConfIntAC(trials = 2, prop = 0.5f)._1, 0.01f)
      rating.labelStats.get("funny") must beNone
    }
  }
}

class EditLikingTest extends SpecificationWithJUnit {

  val edit = Edit(post.id +"Ea", postId = post.id, date = new ju.Date,
                  loginId = "?", newIp = None, text = "text")
  val upVote = EditVote(edit.id, "?", "1.2.3.4", new ju.Date, List(edit.id), Nil)
  // Yet another up vote:
  val upVote2 = EditVote("?", "?", "1.2.3.4", new ju.Date, List(edit.id), Nil)
  val downVote = EditVote("?", "?", "1.2.3.4", new ju.Date, Nil, List(edit.id))

  /* Won't compile, + no longer exists.
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
  */

}
