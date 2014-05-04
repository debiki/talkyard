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

package test.e2e.specs

import com.debiki.core.Prelude._
import org.scalatest.DoNotDiscover
import org.scalatest.Suites
import test.e2e.code._


/** Runs the CreateForumManuallySpec suite
  * in SBT:  test-only test.e2e.specs.CreateForumManuallySpecRunner
  * in test:console:  (new test.e2e.specs.CreateForumManuallySpecRunner {}).execute()
  */
class CreateForumManuallySpecRunner extends Suites(new CreateForumManuallySpec)
  with StartServerAndChromeDriverFactory


/** Opens the site creation page, and waits for you to test stuff manually,
  * until you kill the server, or one year has passed.
  */
@DoNotDiscover
class CreateForumManuallySpec extends DebikiBrowserSpec with TestSiteCreator {

  "A human can" - {

    "go to forum creation page" in {
      go to createForumStartPageUrl
    }

    "wait until browser closed" in {
      waitUntilBrowserClosed()
    }

  }

}



/** Runs the BuildForumManuallySpec suite, in SBT:
  *   test-only test.e2e.specs.BuildForumManuallySpecRunner
  */
class BuildForumManuallySpecRunner extends Suites(new BuildForumManuallySpec)
with StartServerAndChromeDriverFactory


/**
 * Creates a website and opens the admin dashboard, so you can
 * test build a website. It's deleted later automatically.
 */
@DoNotDiscover
class BuildForumManuallySpec extends DebikiBrowserSpec with TestSiteCreator {

  val siteName = nextSiteName()

  "A human can" - {

    "create new forum" in {
      clickCreateForum(loginWithGmailFullscreen, siteName)
    }

    "login and goto admin page" in {
      clickWelcomeLoginToDashboard(loginWithGmailFullscreen, siteName)
    }

    "wait until browser closed" in {
      waitUntilBrowserClosed()
    }

  }

}



/**
 * Runs the ContinueManualTests suite
 * in SBT:
 *  test-only test.e2e.specs.ContinueManualTestsRunner
 */
class ContinueManualTestsRunner extends Suites(new ContinueManualTests)
    with StartServerAndChromeDriverFactory {
  override val emptyDatabaseBeforeAll = false
}


/**
 * Starts a test server that does not erase the test database, and then sleeps,
 * so you can continue interacting with some website you've build
 * in previous test runs.
 */
@DoNotDiscover
class ContinueManualTests extends DebikiBrowserSpec with TestSiteCreator {

  "A browser can go to the dashboard of test-site-1" in {
    go to (originOf(nextSiteName()) + "/-/admin/")
    loginWithGmailFullscreen()
  }

  "wait until browser closed" in {
    waitUntilBrowserClosed()
  }

}
