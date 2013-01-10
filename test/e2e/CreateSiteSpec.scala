/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import org.scalatest.time.{Span, Seconds}
import com.debiki.v0.Prelude._


/**
 * Runs the CreateSiteSpec suite
 * in SBT:
 *  test-only test.e2e.CreateSiteSpecRunner
 * in SBT's test:console:
 *  (new test.e2e.CreateSiteSpecRunner {}).execute()
 */
class CreateSiteSpecRunner extends org.scalatest.Suites(
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
    }

    "not have an invalid name accepted" in {
      pending
    }

    "not have name accepted unless terms accepted" in {
      pending
    }

    "enter new website name and accept terms" in {
      click on "website-name"
      enter("test-site")
      click on "accepts-terms"
    }

    "not allow site creation if there's no `new-website-domain' config value" in {
      // Verify that clicking Submit results in:
      // 403 Forbidden, "... may not create website from this website ..."
      pending
    }

    "create `new-website-domain' config value" in {
      createSiteConfigPage(firstSiteId, i"""
        |new-website-domain: $firstSiteHost
        |new-website-terms-of-use: /hosting/terms-of-service
        |new-website-privacy-policy: /hosting/privacy-policy
        |""")
    }

    "submit site name" in {
      click on cssSelector("input[type=submit]")
      // We should now be taken to page /-/new-website/choose-owner.
    }

    "login with Gmail OpenID, but deny permissions" in {
      // This opens an Authentication failed, Unknown error page.
      // Instead, should show the login page again, and a message
      // that one needs to click the approval button?
      //loginWithGmailOpenId(approvePermissions = false)
      pending
    }

    "login with Gmail OpenID" in {
      loginWithGmailOpenId()
    }

    "click login link on welcome owner page" in {
      // We should now be on page /-/new-website/welcome-owner.
      // There should be only one link, which takes you to /-/admin/.
      assert(pageSource contains "Website created")
      click on cssSelector("a")
    }

    "login to admin dashboard" in {
      loginWithGmailAgain()
    }
  }


  def createWebsiteChooseNamePage = new Page {
    val url = s"$firstSiteOrigin/-/new-website/choose-name"
  }


  def loginWithGmailOpenId(
        approvePermissions: Boolean = true, firstLogin: Boolean = true) {
    click on cssSelector("a.login-link-google")

    if (firstLogin) {
      // 1. I've created a dedicated Gmail OpenID test account, see below.
      // 2. `enter(email)` throws: """Currently selected element is neither
      // a text field nor a text area""", in org.scalatest.selenium.WebBrowser,
      // so use `pressKeys` instead.
      click on "Email"
      pressKeys("debiki.tester@gmail.com")
      click on "Passwd"
      pressKeys("ZKFIREK90krI38bk3WK1r0")
      click on "signIn"
    }

    // Now Google should show another page, which ask about permissions.
     // Uncheck a certain remember choices checkbox, or this page won't be shown
     // next time (and then we cannot choose to deny access).
    click on "remember_choices_checkbox"

    if (approvePermissions)
      click on "approve_button"
    else
      click on "reject_button"
  }


  def loginWithGmailAgain() {
    loginWithGmailOpenId(firstLogin = false)
  }

}

