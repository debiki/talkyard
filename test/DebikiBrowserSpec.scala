/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test

import org.openqa.selenium.WebDriver
import org.scalatest.{BeforeAndAfterAll, FreeSpec}
import org.scalatest.matchers.MustMatchers
import org.scalatest.selenium.WebBrowser
import org.scalatest.concurrent.{Eventually, ScaledTimeSpans}
import org.scalatest.time.{Span, Seconds, Millis}
import play.api.{test => pt}
import com.debiki.v0.Prelude._


/**
 * A specification for browser end-to-end/integration tests.
 */
abstract class DebikiBrowserSpec extends FreeSpec with WebBrowser
  with FailsOneFailAll with BeforeAndAfterAll
  with Eventually with ScaledTimeSpans
  with MustMatchers {

  implicit override val patienceConfig = PatienceConfig(
    // Set long timeout so I can step through code in the debugger.
    timeout = scaled(Span(999, Seconds)),
    interval = scaled(Span(100, Millis)))

  lazy val testPage = new Page {
    val url = s"localhost:${pt.Helpers.testServerPort}/-3nnb9-new-page"
  }

  implicit def webDriver = _webDriver
  private var _webDriver: WebDriver = null

  override def beforeAll() {
    _webDriver = ChromeDriverFactory.createDriver()
  }

  override def afterAll() {
    webDriver.quit()
  }
}


