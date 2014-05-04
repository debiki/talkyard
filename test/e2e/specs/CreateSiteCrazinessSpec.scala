/**
 * Copyright (C) 2013-2014 Kaj Magnus Lindberg (born 1979)
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
class CreateSiteCrazinessSpecRunner
  extends Suites(new CreateSiteCrazinessSpec)
  with StartServerAndChromeDriverFactory



/** Creates some sites, but does weird things:
  * - Specifies invalid site names, e.g. uppercase, with '.', too short name
  * - Does not accept terms
  * - Attempts to create same site twice
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

    "go to forum creation page" in {
      go to createForumStartPageUrl
    }

    "create password account" in {
      createNewPasswordAccount(AdminsEmail, password = AdminsPassword)
    }

    "new site terms must be de-selected by default" in {
      getAcceptTermsCheckbox.isSelected must be === false
    }

    "not accept invalid site names" - {

      "accept terms, so won't affect test" in {
        getAcceptTermsCheckbox.select()
      }

      "disallow empty name" in {
        getSubmitButton.isEnabled must be === false
        getSiteNameMessages.exists(_.isDisplayed) must be === false
        click on getSubmitButton
      }

      def testDisallowsName(invalidName: String) {
        click on SiteNameInput
        enter("valid-name")
        getSiteNameMessages.exists(_.isDisplayed) must be === false
        getSubmitButton.isEnabled must be === true
        click on SiteNameInput
        enter(invalidName)
        getSiteNameMessages.exists(_.isDisplayed) must be === true
        getSubmitButton.isEnabled must be === false
        click on getSubmitButton // should have no effect, it's disabled
      }

      val InvalidNameLeadingDash = "-invalid-"
      val InvalidNameUppercase = "Uppercase-Name"
      val InvalidNameWeirdChars = "abcdef-$%#-ghi"
      val InvalidNameTooShort = "abcde"
      val InvalidNameDot = "abcde.ghijk"

      s"disallow invalid name: '$InvalidNameLeadingDash' (leading dash)" in {
        testDisallowsName(InvalidNameLeadingDash)
      }

      s"disallow invalid name: '$InvalidNameUppercase' (uppercase)" in {
        testDisallowsName(InvalidNameUppercase)
      }

      s"disallow invalid name: '$InvalidNameWeirdChars' (weird chars)" in {
        testDisallowsName(InvalidNameWeirdChars)
      }

      s"disallow invalid name: '$InvalidNameTooShort' (it's too short)" in {
        testDisallowsName(InvalidNameTooShort)
      }

      s"disallow invalid name: '$InvalidNameDot' (dot '.')" in {
        testDisallowsName(InvalidNameDot)
      }
    }

    "enter ok site name" in {
      click on SiteNameInput
      enter(firstSiteName)
      getSiteNameMessages.exists(_.isDisplayed) must be === false
    }

    // ---- Not accepted site terms

    "not have name accepted unless terms accepted" in {
      getSubmitButton.isEnabled must be === true
      getAcceptTermsCheckbox.clear()
      getAcceptTermsCheckbox.isSelected must be === false
      getSubmitButton.isEnabled must be === false
      click on getSubmitButton
    }

    "accept terms" in {
      getAcceptTermsCheckbox.select()
      getSubmitButton.isEnabled must be === true
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
      click on getSubmitButton
    }

    "not create same site twice" - {
      s"goto admin page of $firstSiteName" in {
        clickWelcomeLoginToDashboard(loginToAdminPage, firstSiteName)
      }

      "find forum" in {
        clickGoToSiteFindForum(firstSiteName)
      }

      "return to forum creation page" in {
        go to createForumStartPageUrl
      }

      "login again" in {
        loginToAdminPage()
      }

      "not create a site with the same address" in {
        click on SiteNameInput
        enter(firstSiteName)
        click on getAcceptTermsCheckbox
        click on getSubmitButton

        // Now an error page should load. Click a certain try again link
        // (there's only one link?)
        assert(pageSource contains "You need to choose another name")
        click on partialLinkText("Okay")
      }
    }

    "create another site with another address" - {
      s"create $secondSiteName" in {
        clickCreateForum(loginToAdminPage, secondSiteName)
        // oops don't use gmail login
      }

      s"login with Gmail again, goto admin page of $secondSiteName" in {
        clickWelcomeLoginToDashboard(loginToAdminPage, secondSiteName)
      }

      "find the new forum" in {
        clickGoToSiteFindForum(secondSiteName)
      }
    }

  }

  def SiteNameInput = "website-name"

  def getSiteNameMessages: Seq[Element] =
    findAll(cssSelector(".alert-error")).toSeq

  def getSubmitButton: Element =
    find(cssSelector("[type='submit']")) getOrElse fail()

  def getAcceptTermsCheckbox: Checkbox =
    checkbox("accepts-terms")

}

