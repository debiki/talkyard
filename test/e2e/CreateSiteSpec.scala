/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import com.debiki.v0.Prelude._
import org.scalatest.time.{Span, Seconds}


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
 *
 * Among other things, logs in as debiki.tester@gmail.com and creates
 * test-site and test-site-2.
 */
// From ScalaTest 2.0-M5 and above, use this: `@DoNotDiscover`
// instead of `abstract`.
abstract class CreateSiteSpec extends DebikiBrowserSpec {

  val firstSiteName = nextSiteName()
  val secondSiteName = nextSiteName()


  "A user with a browser can" - {

    "go to site creation page" in {
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
      enter(firstSiteName)
      click on "accepts-terms"
    }

    "not allow site creation if there's no `new-website-domain' config value" in {
      // Verify that clicking Submit results in:
      // 403 Forbidden, "... may not create website from this website ..."
      // Have to do this from another site; `localhost` allows website creation,
      // see StuffCreator.createFirstSite().
      pending
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

    s"login with Gmail OpenID" in {
      clickLoginWithGmailOpenId()
    }

    s"goto admin page of $firstSiteName" - {
      clickWelcomeLoginToDashboard(firstSiteName)
    }

    "find default homepage and website config page" in {
      eventuallyFindHomepageAndCofigPage()
    }

    "return to site creation page" in {
      go to createWebsiteChooseNamePage
    }

    "not create another site with the same address" in {
      click on "website-name"
      enter(firstSiteName)
      click on "accepts-terms"
      click on cssSelector("input[type=submit]")

      // COULD fix: Regrettably, the server won't notice that the name is taken
      // until you've logged in.
      clickLoginWithGmailOpenId()

      // Now an error pags should load. Click a certain try again link
      // (there's only one link?)
      assert(pageSource contains "You need to choose another name")
      click on partialLinkText("Okay")
    }

    s"create $secondSiteName" - {
      clickCreateSite(secondSiteName, alreadyOnNewWebsitePage = true)
    }

    s"login with Gmail again, goto admin page of $secondSiteName" - {
      clickWelcomeLoginToDashboard(secondSiteName)
    }

    "again find default homepage and website config page" in {
      eventuallyFindHomepageAndCofigPage()
    }

    /*"create even more websites" - {
      clickCreateSite("test-site-3")
      clickCreateSite("test-site-4")
      clickCreateSite("test-site-5")
    } */

    def eventuallyFindHomepageAndCofigPage() {
      eventually {
        find(cssSelector("tr.page-role-Generic > td a[href='/']")) match {
          case Some(elem) => elem.text must include("Homepage")
          case None => fail("No homepage link found")
        }
        find(cssSelector("tr.page-role-Code > td a[href*='_site.conf']"))
            match {
          case Some(elem) => elem.text must include("configuration")
          case None => fail("No website config page link found")
        }
      }
    }
  }

}

