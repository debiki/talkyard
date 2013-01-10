/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import org.scalatest.time.{Span, Seconds}
import com.debiki.v0.Prelude._


/**
 * Runs the CreateSiteSpec suite in the test:console:
 *  (new test.e2e.CreateSiteSpecRunner {}).execute()
 */
abstract class CreateSiteSpecRunner extends org.scalatest.Suites(
  new CreateSiteSpec {})
  with ChromeSuiteMixin


/**
 * Tests website creation.
 */
// From ScalaTest 2.0-M5 and above, use this: `@DoNotDiscover`
// instead of `abstract`.
abstract class CreateSiteSpec extends DebikiBrowserSpec {

  "A user with a browser can" - {

    "goto /-/new-website/choose-name" in {
      go to createWebsiteChooseNamePage
      Thread.sleep(5*1000)
    }

    "not have an invalid name accepted" in {
      pending
    }

    "not have name accepted unless terms accepted" in {
      pending
    }

    "enter new website name and accept terms" in {
      click on "website-name"
      enter("test-website")
      click on "accepts-terms"
      click on cssSelector("input[type=submit]")
      Thread.sleep(5*1000)
    }
    // -->  Forbidden   may not create website from this website

    // "/-/new-website/choose-owner" loads...

    // click on cssSelector("a.login-link-google")
    // how login???

    // /-/new-website/welcome-owner loads

    // click on cssSelector(".a") // there's only one link; it takes you to /-/admin/
    // click on cssSelector("a.login-link-google") // login to admin dasboard
  }


  def createWebsiteChooseNamePage = new Page {
    val url = s"$firstSiteOrigin/-/new-website/choose-name"
  }

}


