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
import org.scalatest.time.{Span, Seconds}
import org.scalatest.DoNotDiscover
import org.scalatest.Suites
import test.e2e.code._


/** Runs the CreateSiteCrazinessSpec.
  * In Play:   test-only test.e2e.specs.CreateSiteCrazinessSpecRunner
  * In test:console:  (new test.e2e.specs.CreateSiteCrazinessSpecRunner).execute()
  */
@DoNotDiscover
class CreateSiteCrazinessSpecRunner
  extends Suites(new CreateSiteCrazinessSpec)
  with StartServerAndChromeDriverFactory



/** Creates some sites, but does weird things like attempting to create
  * the same site twice (which is not allowed), or not clicking the
  * accept-terms link, or specifying the wrong password when logging in.
  */
@DoNotDiscover
class CreateSiteCrazinessSpec extends DebikiBrowserSpec with TestSiteCreator {

  val AdminsEmail = "admin-590351@example.com"
  val AdminsPassword = "Admins_password"

  def loginToAdminPage() = {
    loginWithPasswordFullscreen(AdminsEmail, password = AdminsPassword)
  }  

  val firstSiteName = nextSiteName()
  val secondSiteName = nextSiteName()


  "A user with a browser can" - {

    "go to site creation page" in {
      go to createWebsiteChooseTypePage
    }

    "create password account" in {
      createNewPasswordAccount(AdminsEmail, password = AdminsPassword)
    }

    "choose site type: a simple website" in {
      clickChooseSiteTypeSimpleSite()
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
      // Please sync this test with the same test in CreateEmbeddedCommentsSiteSpec.

      // Verify that clicking Submit results in:
      // 403 Forbidden, "... may not create website from this website ..."
      // Have to do this from another site; `localhost` allows website creation,
      // see StuffCreator.createFirstSite().
      pending
    }

    "submit site name" in {
      click on cssSelector("input[type=submit]")
      // We should now be taken to page /-/create-site/choose-owner.
    }

    s"goto admin page of $firstSiteName" in {
      clickWelcomeLoginToDashboard(loginToAdminPage, firstSiteName)
    }

    "find default homepage and website config page" in {
      eventuallyFindHomepageAndConfigPage()
    }

    "return to site creation page, choose site type: simple site, again" in {
      go to createWebsiteChooseTypePage
    }

    "login again, choose site type" in {
      loginToAdminPage()
      clickChooseSiteTypeSimpleSite()
    }

    "not create another site with the same address" in {
      click on "website-name"
      enter(firstSiteName)
      click on "accepts-terms"
      click on cssSelector("input[type=submit]")

      // Now an error page should load. Click a certain try again link
      // (there's only one link?)
      assert(pageSource contains "You need to choose another name")
      click on partialLinkText("Okay")
    }

    s"create $secondSiteName" in {
      clickCreateSite(loginToAdminPage, secondSiteName)
      // oops don't use gmail login
    }

    s"login with Gmail again, goto admin page of $secondSiteName" in {
      clickWelcomeLoginToDashboard(loginToAdminPage, secondSiteName)
    }

    "again find default homepage and website config page" in {
      eventuallyFindHomepageAndConfigPage()
    }

 }

}

