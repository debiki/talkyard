/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import com.debiki.v0.Prelude._
import org.scalatest.DoNotDiscover
import org.scalatest.Suites


/**
 * Runs the CreateSiteManuallySpec suite
 * in SBT:
 *  test-only test.e2e.CreateSiteManuallySpecRunner
 * in SBT's test:console:
 *  (new test.e2e.CreateSiteManuallySpecRunner {}).execute()
 */
@DoNotDiscover
class CreateSiteManuallySpecRunner extends Suites(
  new CreateSiteManuallySpec {})
  with ChromeSuiteMixin


/**
 * Opens the site creation page, and waits for you to test stuff manually,
 * untill you kill the server.
 *
 * You can login as debiki.tester@gmail.com with email:
 *   debiki.tester@gmail.com
 * and password:
 *   ZKFIREK90krI38bk3WK1r0
 * (See clickLoginWithGmailOpenId() in StuffTestClicker.)
 */
@DoNotDiscover
class CreateSiteManuallySpec extends DebikiBrowserSpec with TestSiteCreator {

  "A human can" - {

    "go to site creation page" in {
      go to createWebsiteChooseNamePage
    }

    "do whatever s/he wants to do" in {
      // Wait one year, or until the human kills the server.
      Thread.sleep(365 * 24 * 3600 * 1000)
    }

  }

}



/**
 * Runs the BuildSiteManuallySpec suite, in SBT:
 *  test-only test.e2e.BuildSiteManuallySpecRunner
 */
@DoNotDiscover
class BuildSiteManuallySpecRunner extends Suites(
  new BuildSiteManuallySpec {})
with ChromeSuiteMixin


/**
 * Creates a website and opens the admin dashboard, so you can
 * test build a website. It's deleted later automatically.
 */
@DoNotDiscover
class BuildSiteManuallySpec extends DebikiBrowserSpec with TestSiteCreator {

  val siteName = nextSiteName()

  "A human can" - {

    "create new site" - {
      clickCreateSite(siteName)
    }

    "login and goto admin page" - {
      clickWelcomeLoginToDashboard(siteName)
    }

    "do whatever s/he wants to do" in {
      // Wait one year, or until the human kills the server.
      Thread.sleep(365 * 24 * 3600 * 1000)
    }

  }

}



/**
 * Runs the ContinueManualTests suite
 * in SBT:
 *  test-only test.e2e.ContinueManualTestsRunner
 */
@DoNotDiscover
class ContinueManualTestsRunner extends Suites(new ContinueManualTests {})
    with ChromeSuiteMixin {
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
    clickLoginWithGmailOpenId()
  }

  "A human can stare at a computer monitor for one year" in {
    Thread.sleep(365 * 24 * 3600 * 1000)
  }

}
