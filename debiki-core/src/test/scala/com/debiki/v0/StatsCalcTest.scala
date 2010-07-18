// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package com.debiki.v0

import org.specs._
import org.specs.runner.{ConsoleRunner, JUnit4}
import java.{util => ju}

//class StatsCalcTest extends JUnit4(StatsCalcSpec)
//object StatsCalcTestRunner extends ConsoleRunner(StatsCalcSpec)

class StatsCalcTest extends SpecificationWithJUnit {
/*
Cannot debug this:
class StatsCalcTest extends SpecificationWithJUnit {
NetBeans says:
  Testsuite: com.debiki.v0.StatsCalcTest
  Tests run: 1, Failures: 0, Errors: 1, Time elapsed: 0 sec

  Null Test:         Caused an ERROR
  null
  java.lang.ExceptionInInitializerError
          at java.lang.Class.forName0(Native Method)
          at java.lang.Class.forName(Class.java:169)
  Caused by: java.lang.RuntimeException: Uncompilable source code
   - interface expected here
          at com.debiki.v0.StatsCalcTest.<clinit>(StatsCalcTest.java:2)
*/

//object StatsCalcSpec extends Specification {

  val post = Post("a", "root", new ju.Date, None, "test")
  val debate = Debate("test", post :: Nil, Nil)
  val vote_interesting = Vote(post.id, "?", new ju.Date, List("interesting"))

  "For an unrated post, StatsCalc" should {
    "find no statistics" in {
      val calcer = new StatsCalc(debate)
      val rating = calcer.scoreFor(post.id)
      rating.voteCount must_== 0
      rating.maxLabelSum must_== 0
      rating.labelStats.size must_== 0
    }
  }

  "For a post with one rating, StatsCalc" should {
    "find one rating" in {
      val debate2 = debate + vote_interesting
      val calcer = new StatsCalc(debate2)
      val rating = calcer.scoreFor(post.id)
      rating.voteCount must_== 1
      rating.maxLabelSum must_== 1.0f
      rating.labelStats.size must_== 1
      val labelStats = rating.labelStats("interesting")
      labelStats.sum must_== 1.0f
      labelStats.fraction must_== 1.0f
      // Don't know exactly what fractionLowerBound should be,
      // but rather low, since the algorithm adds 4 fake votes, 2 of which
      // excludes the "interesting" label.
      labelStats.fractionLowerBound must be_>(0.0f)
      labelStats.fractionLowerBound must be_<(0.5f)
    }
  }

}
