/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import com.debiki.v0.Prelude._
import org.scalatest.time.{Span, Seconds}
import play.api.test.Helpers.testServerPort


/**
 * Runs the CreateSiteManuallySpec suite
 * in SBT:
 *  test-only test.e2e.CreateSiteManuallySpecRunner
 * in SBT's test:console:
 *  (new test.e2e.CreateSiteManuallySpecRunner {}).execute()
 */
class CreateSiteManuallySpecRunner extends org.scalatest.Suites(
  new CreateSiteManuallySpec {})
  with ChromeSuiteMixin


/**
 * Opens the site creation page, and waits for you to test stuff manually,
 * untill you kill the server.
 *
 * You can login as debiki.tester@gmail.com with password:
 *
 */
// From ScalaTest 2.0-M5 and above, use this: `@DoNotDiscover`
// instead of `abstract`.
abstract class CreateSiteManuallySpec extends DebikiBrowserSpec {

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
 * Runs the BuildSiteManuallySpec suite
 * in SBT:
 *  test-only test.e2e.BuildSiteManuallySpecRunner
 * in SBT's test:console:
 *  (new test.e2e.BuildSiteManuallySpecRunner {}).execute()
 */
class BuildSiteManuallySpecRunner extends org.scalatest.Suites(
  new BuildSiteManuallySpec {})
with ChromeSuiteMixin


/**
 * Creates a website and opens the admin dashboard, so you can
 * test build a website. It's deleted later automatically.
 */
abstract class BuildSiteManuallySpec extends DebikiBrowserSpec {

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
