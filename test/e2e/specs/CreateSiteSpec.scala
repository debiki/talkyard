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


/** Runs all create-site specs.
  * In Play:  test-only test.e2e.specs.AllCreateSiteSpecsRunner
  */
@DoNotDiscover
class AllCreateSiteSpecsRunner
  extends Suites(
    new CreateSiteSpec_SimpleWebsite_GmailLogin,
    new CreateSiteSpec_Blog_PasswordLogin,
    new CreateSiteSpec_Forum_PasswordLogin,
    new CreateSiteSpec_Forum_ReuseOldPasswordLogin)
  with StartServerAndChromeDriverFactory

/** Runs the CreateSiteSpec suite and creates a simple website, using a Gmail account.
  * In Play:   test-only test.e2e.specs.CreateSiteSpecRunner_SimpleWebsite_GmailLogin
  * In test:console:  (new test.e2e.specs.CreateSiteSpecRunner_SimpleWebsite_GmailLogin).execute()
  */
@DoNotDiscover
class CreateSiteSpecRunner_SimpleWebsite_GmailLogin
  extends Suites(new CreateSiteSpec_SimpleWebsite_GmailLogin)
  with StartServerAndChromeDriverFactory

// test-only test.e2e.specs.CreateSiteSpecRunner_Blog_PasswordLogin
@DoNotDiscover
class CreateSiteSpecRunner_Blog_PasswordLogin
  extends Suites(new CreateSiteSpec_Blog_PasswordLogin)
  with StartServerAndChromeDriverFactory

// test-only test.e2e.specs.CreateSiteSpecRunner_Forum_PasswordLogin
@DoNotDiscover
class CreateSiteSpecRunner_Forum_PasswordLogin
  extends Suites(new CreateSiteSpec_Forum_PasswordLogin)
  with StartServerAndChromeDriverFactory

// test-only test.e2e.specs.CreateSiteSpecRunner_Forum_ReuseOldPasswordLogin
@DoNotDiscover
class CreateSiteSpecRunner_Forum_ReuseOldPasswordLogin
  extends Suites(
    new CreateSiteSpec_Forum_PasswordLogin,
    new CreateSiteSpec_Forum_ReuseOldPasswordLogin)
  with StartServerAndChromeDriverFactory



@DoNotDiscover
class CreateSiteSpec_SimpleWebsite_GmailLogin extends CreateSiteSpecConstructor {
  val newSiteType = debiki.SiteCreator.NewSiteType.SimpleSite
  def loginToCreateSite() = login()
  def loginToAdminPage() = login()
  private def login() {
    info("login with Gmail OpenID")
    loginWithGmailFullscreen()
  }
}

@DoNotDiscover
class CreateSiteSpec_Blog_PasswordLogin extends CreateSiteSpecConstructor {
  val newSiteType = debiki.SiteCreator.NewSiteType.Blog

  val AdminsEmail = "admin@example.com"
  val AdminsPassword = "Admins_password"

  // Warning: dupl code, see CreateSiteSpec_Forum_PasswordLogin. But I
  // inted to replace this one or that one with Facebook login instead,
  // then problem gone.
  def loginToCreateSite() {
    createNewPasswordAccount(AdminsEmail, password = AdminsPassword)
  }

  def loginToAdminPage() {
    loginWithPasswordFullscreen(AdminsEmail, password = AdminsPassword)
  }
}

@DoNotDiscover
class CreateSiteSpec_Forum_PasswordLogin extends CreateSiteSpecConstructor {
  val newSiteType = debiki.SiteCreator.NewSiteType.Forum

  val AdminsEmail = "another-admin@example.com"
  val AdminsPassword = "Another_admins_password"
  private var accountCreated = false

  // Warning: dupl code, see CreateSiteSpec_Blog_PasswordLogin. But I
  // inted to replace this one or that one with Facebook login instead,
  // then problem gone.
  def loginToCreateSite() {
    createNewPasswordAccount(AdminsEmail, password = AdminsPassword)
  }

  def loginToAdminPage() {
    loginWithPasswordFullscreen(AdminsEmail, password = AdminsPassword)
  }
}

@DoNotDiscover
class CreateSiteSpec_Forum_ReuseOldPasswordLogin extends CreateSiteSpecConstructor {
  val newSiteType = debiki.SiteCreator.NewSiteType.Forum

  val AdminsEmail = "another-admin@example.com"
  val AdminsPassword = "Another_admins_password"

  def loginToCreateSite() = login()
  def loginToAdminPage() = login()

  private def login() {
    loginWithPasswordFullscreen(AdminsEmail, password = AdminsPassword)
  }
}



/**
 * Tests website creation.
 *
 * Among other things, logs in as debiki.tester@gmail.com and creates
 * test-site and test-site-2.
 */
@test.tags.EndToEndTest
@DoNotDiscover
abstract class CreateSiteSpecConstructor extends DebikiBrowserSpec with TestSiteCreator {

  def newSiteType: debiki.SiteCreator.NewSiteType

  /** Subclasses override and test various login methods. */
  def loginToCreateSite()
  def loginToAdminPage()

  val siteName = nextSiteName()


  "A user with a browser can" - {

    "go to site creation page" in {
      go to createWebsiteChooseTypePage
    }

    "login" in {
      loginToCreateSite()
    }

    s"submit site type" in {
      info(s"choose site type: $newSiteType")
      clickChooseSiteType(newSiteType)
    }

    s"submit site name: $siteName" in {
      click on "website-name"
      enter(siteName)
      click on "accepts-terms"
      click on cssSelector("input[type=submit]")
    }

    s"goto admin page of $siteName" in {
      clickWelcomeLoginToDashboard(loginToAdminPage, siteName)
    }

    "find homepage" in {
      newSiteType match {
        case debiki.SiteCreator.NewSiteType.SimpleSite =>
          findSimpleSiteHomepage()
        case debiki.SiteCreator.NewSiteType.Blog =>
          findBlogMainPage()
        case debiki.SiteCreator.NewSiteType.Forum =>
          findForumMainPage()
      }
    }

  }

}

