/**
 * Copyright (C) 2013 Kaj Magnus Lindberg (born 1979)
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

package test.e2e.code

import com.debiki.core.Prelude._
import org.openqa.selenium.WebDriver
import org.scalatest.{BeforeAndAfterAll, FreeSpec}
import org.scalatest.matchers.MustMatchers
import org.scalatest.selenium.WebBrowser
import org.scalatest.concurrent.{Eventually, ScaledTimeSpans}
import org.scalatest.time.{Span, Seconds, Millis}
import test.CancelAllOnFirstFailure


/**
 * A specification for browser end-to-end/integration tests.
 */
abstract class DebikiBrowserSpec extends FreeSpec with WebBrowser
  with CancelAllOnFirstFailure with BeforeAndAfterAll
  with Eventually with ScaledTimeSpans
  with MustMatchers
  with StuffCreator with StuffTestClicker {

  implicit override val patienceConfig = PatienceConfig(
    // Set long timeout so I can step through code in the debugger.
    timeout = scaled(Span(6000, Seconds)),
    interval = scaled(Span(100, Millis)))

  implicit def webDriver = _webDriver
  private var _webDriver: WebDriver = null


  override def beforeAll() {
    // It's terribly annoying not knowing which test is currently being run.
    println(i"""
      |-----------------------------------------------
      | Running E2E test: ${classNameOf(this)}
      |-----------------------------------------------""")

    _webDriver = ChromeDriverFactory.createDriver()
  }

  override def afterAll() {
    webDriver.quit()
  }


  /** If the E2E tests are to be run in an embedded comments iframe, then
    * this is the window handle of the main window, and the index of the iframe.
    * It's a `var`, because there might be more than one iframe with
    * embedded comments, and we might want to test all of them.
    */
  var embeddedCommentsWindowAndFrame: Option[(String, Int)] = None

  def rememberEmbeddedCommentsIframe(number: Int = 0) {
    embeddedCommentsWindowAndFrame = Some((webDriver.getWindowHandle(), number))
  }

  def switchToAnyEmbeddedCommentsIframe() {
    embeddedCommentsWindowAndFrame foreach { case (iframeWindowHandle, iframeNo) =>
      webDriver.switchTo().window(iframeWindowHandle)
      // Debiki's embedded comments iframe is created by Javascript and not available
      // immediately.
      eventually {
        webDriver.switchTo().frame(iframeNo)
      }
    }
  }


  /** Waits until a human closes the E2E test browser.
    */
  def waitUntilBrowserClosed() {
    var closed = false
    while (!closed) {
      Thread.sleep(200)
      try {
        webDriver.getTitle()
      }
      catch {
        case ex: org.openqa.selenium.WebDriverException =>
          var devToolsOpened =
            ex.getMessage.contains("disconnected") && ex.getMessage.contains("Inspector.detached")
          // This weird exception message is thrown sometimes when I click-open Dev Tools:
          devToolsOpened ||= ex.getMessage.contains("Cannot call method 'click' of null")
          if (devToolsOpened) {
            // Someone apparently opened Chrome Debugger Tools, fine.
          }
          else if (ex.getMessage.contains("chrome not reachable")) {
            System.out.println("Stopping test, Chrome closed")
            closed = true
          }
          else {
            throw ex
          }
      }
    }
  }
}


