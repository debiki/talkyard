/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import org.openqa.selenium.WebDriver
import org.scalatest.{BeforeAndAfterAll, FreeSpec}
import org.scalatest.matchers.MustMatchers
import org.scalatest.selenium.WebBrowser
import org.scalatest.concurrent.{Eventually, ScaledTimeSpans}
import org.scalatest.time.{Span, Seconds, Millis}
import test.FailsOneCancelRemaining


/**
 * A specification for browser end-to-end/integration tests.
 */
abstract class DebikiBrowserSpec extends FreeSpec with WebBrowser
  with FailsOneCancelRemaining with BeforeAndAfterAll
  with Eventually with ScaledTimeSpans
  with MustMatchers
  with StuffCreator with StuffTestClicker {

  implicit override val patienceConfig = PatienceConfig(
    // Set long timeout so I can step through code in the debugger.
    timeout = scaled(Span(60, Seconds)),
    interval = scaled(Span(100, Millis)))

  implicit def webDriver = _webDriver
  private var _webDriver: WebDriver = null


  override def beforeAll() {
    _webDriver = ChromeDriverFactory.createDriver()
  }

  override def afterAll() {
    webDriver.quit()
  }

}


