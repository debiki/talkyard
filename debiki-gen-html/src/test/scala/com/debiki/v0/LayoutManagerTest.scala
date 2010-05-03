// vim: ts=2 sw=2 et
/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package debikigenhtml

import org.specs._
import org.specs.runner.{ConsoleRunner, JUnit4}

class SimpleLayoutManagerTest extends JUnit4(SimpleLayoutManagerSpec)
//class MySpecSuite extends ScalaTestSuite(MySpec)

object LayoutManagerTestRunner
  extends ConsoleRunner(SimpleLayoutManagerSpec)

object SimpleLayoutManagerSpec extends Specification {
  "SimpleLayoutManager" should {
    "print an empty div" in {
      val list = Nil
      list must beEmpty
    }
  }
}
