/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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


/** Runs the CreateEmbeddedCommentsSiteSpec suite, with an admin that logs in
  * with Gmail.
  *
  * In Play:   test-only test.e2e.specs.CreateEmbeddedCommentsSiteGmailLoginSpecRunner
  * In test:console:  (new test.e2e.specs.CreateEmbeddedCommentsSiteGmailLoginSpecRunner).execute()
  */
class CreateEmbeddedCommentsSiteGmailLoginSpecRunner
  extends org.scalatest.Suites(new CreateEmbeddedCommentsSiteGmailLoginSpec)
  with StartServerAndChromeDriverFactory


/** Runs the CreateEmbeddedCommentsSiteSpec suite, with an admin that creates
  * a new password account and logs in with it.
  *
  * In Play:
  *   test-only test.e2e.specs.CreateEmbeddedCommentsSiteNewPasswordAccountSpecRunner
  * In test:console:
  *   (new test.e2e.specs.CreateEmbeddedCommentsSiteNewPasswordAccountSpecRunner).execute()
  */
class CreateEmbeddedCommentsSiteNewPasswordAccountSpecRunner
  extends org.scalatest.Suites(new CreateEmbeddedCommentsSiteNewPasswordAccountSpec)
  with StartServerAndChromeDriverFactory


/** Runs the CreateEmbeddedCommentsSiteSpec suite, with an admin that creates
  * a new password account and logs in with it. It runs
  * [[test.e2e.specs.CreateEmbeddedCommentsSiteNewPasswordAccountSpec]] first, because
  * it creates a password account that we can reuse.
  *
  * In Play:
  *   test-only test.e2e.specs.CreateEmbeddedCommentsSiteOldPasswordAccountSpecRunner
  * In test:console:
  *   (new test.e2e.specs.CreateEmbeddedCommentsSiteOldPasswordAccountSpecRunner).execute()
  */
@DoNotDiscover
class CreateEmbeddedCommentsSiteOldPasswordAccountSpecRunner
  extends org.scalatest.Suites(
    new CreateEmbeddedCommentsSiteNewPasswordAccountSpec,
    new CreateEmbeddedCommentsSiteOldPasswordAccountSpec)
  with StartServerAndChromeDriverFactory


/** Runs the ContinueEmbeddSiteTestsManually suite.
  * in SBT:
  *  test-only test.e2e.specs.ContinueEmbeddSiteTestsManuallyRunner
  */
@DoNotDiscover
class ContinueEmbeddSiteTestsManuallyRunner extends Suites(new ContinueEmbeddSiteTestsManually)
with StartServerAndChromeDriverFactory {
  override val emptyDatabaseBeforeAll = false
}


/** Tests creation of an embedded comment site, logs in with Gmail.
  */
@test.tags.EndToEndTest
@DoNotDiscover
class CreateEmbeddedCommentsSiteGmailLoginSpec
    extends CreateEmbeddedCommentsSiteSpecConstructor {

  def loginToCreateSite() {
    login()
  }

  def loginToAdminPage() {
    login()
  }

  private def login() {
    info("login with Gmail OpenID")
    loginWithGmailFullscreen()
  }
}


/** Tests creation of an embedded comment site, creates and logs in with a new
  * password account.
  */
@test.tags.EndToEndTest
@DoNotDiscover
class CreateEmbeddedCommentsSiteNewPasswordAccountSpec
  extends CreateEmbeddedCommentsSiteSpecConstructor {

  val AdminsEmail = "admin@example.com"
  val AdminsPassword = "Admins_password"

  def loginToCreateSite() {
    createNewPasswordAccount(
      email = AdminsEmail,
      password = AdminsPassword,
      displayName = "Admins_display_name",
      country = "Admins_country",
      fullName = "Admins_full_name")
  }

  def loginToAdminPage() {
    loginWithPasswordFullscreen(AdminsEmail, AdminsPassword)
  }

}


/** Tests creation of an embedded comment site, creates and logs in with an old
  * password account. Assumes that
  * [[test.e2e.specs.CreateEmbeddedCommentsSiteNewPasswordAccountSpec]] has just
  * been run and created a password account.
  */
@test.tags.EndToEndTest
@DoNotDiscover
class CreateEmbeddedCommentsSiteOldPasswordAccountSpec
  extends CreateEmbeddedCommentsSiteSpecConstructor {

  val AdminsEmail = "admin@example.com"
  val AdminsPassword = "Admins_password"

  def loginToCreateSite() {
    login()
  }

  def loginToAdminPage() {
    login()
  }

  def login() {
    loginWithPasswordFullscreen(AdminsEmail, AdminsPassword)
  }
}


/** Assumes you've just run a create-embedded-site E2E test, and
  * logs in to the admin dashboard of that site (without emptying the
  * database first, which all other E2E tests do).
  */
@DoNotDiscover
class ContinueEmbeddSiteTestsManually extends DebikiBrowserSpec with TestLoginner {

  "login to the dashboard of ebedded site 11" in {
    go to ("http://site-11.localhost:19001/-/admin/")
    loginWithPasswordFullscreen("admin@example.com", "Admins_password")
  }

  "wait until browser closed" in {
    waitUntilBrowserClosed()
  }

}



/** Tests creation of embedded comment sites.
  *
  * Logs in as debiki.tester@gmail.com and creates an embedded comments site,
  * checks the admin dashboard and tests to add some comments to an embedded discussions.
  *
  * You need to add entries to your hosts file:
  *   127.0.0.1 mycomputer
  *   127.0.0.1 site-11.localhost
  *   127.0.0.1 site-12.localhost
  *   127.0.0.1 site-13.localhost
  *   ...perhaps some more or less.
  */
abstract class CreateEmbeddedCommentsSiteSpecConstructor
  extends DebikiBrowserSpec with TestSiteCreator with TestReplyer {

  /** Subclasses override and test various login methods. */
  def loginToCreateSite()
  def loginToAdminPage()

  /** You need an entry '127.0.0.1 mycomputer' in your hosts file. */
  val EmbeddingSiteUrl = "http://mycomputer:8080"
  val EmbddingSiteUrlInputId = "embeddingSiteUrl"

  val AdminReplyText = "Reply_by_admin"
  val GuestReplyText = "Reply_by_guest"

  var embeddedSiteId: Option[String] = None
  def embeddingPageUrl = s"$EmbeddingSiteUrl/embeds-site-${embeddedSiteId.get}-topic-id-empty.html"


  "A user with a browser can" - {

    "go to site creation page" in {
      go to createEmbeddedCommentsSiteStartPage
    }

    "login" in {
      loginToCreateSite()
      eventually {
        find(EmbddingSiteUrlInputId) must not equal(None)
      }
    }

    "specify obviously invalid addresses of embedding site, find them rejected" in {
      pending
    }

    "specify address of embedding site" in {
      click on EmbddingSiteUrlInputId
      enter(EmbeddingSiteUrl)
    }

    "not proceed before terms accepted" in {
      click on cssSelector("input[type=submit]")
      find(EmbddingSiteUrlInputId) must not equal(None)
    }

    "accept terms and proceed" in {
      click on "accepts-terms"
      click on cssSelector("input[type=submit]")
      eventually {
        find(EmbddingSiteUrlInputId) mustEqual None
      }
    }

    "find welcome page" in {
      eventually {
        pageSource must include ("Embedded comments have been setup")
        pageSource must include (EmbeddingSiteUrl)
      }
    }

    "find site id in browser address bar" in {
      val EmbeddedSiteUrl = "^http://site-([0-9a-z]+)\\..*$".r
      webDriver.getCurrentUrl() match {
        case EmbeddedSiteUrl(siteId) =>
          embeddedSiteId = Some(siteId)
        case _ =>
          fail()
      }
    }

    "goto instructions page" in {
      click on linkText ("Continue")
    }

    "find instructions page" in {
      eventually {
        pageSource must include ("Installation instructions for")
        pageSource must include (EmbeddingSiteUrl)
      }
    }

    "go to admin page and login" in {
      val adminPageUrl = s"http://site-${embeddedSiteId.get}.${debiki.Globals.baseDomainWithPort}/-/admin/"
      click on cssSelector(s"a[href='$adminPageUrl']")
      loginToAdminPage()
      eventually {
        pageSource must include ("Settings")
        pageSource must include ("Special Contents")
        pageSource must include ("Moderation")
      }
    }

    /*
    "not allow site creation if there's no `new-website-domain' config value" in {
      // Please sync this test with the same test in CreateSiteSpec.
      pending
    }
    */

    "find empty page list" in {
      // Test bug: It might be empty simply because the page list doesn't load that quickly.
      // ???
      pending
    }

    "find empty activity list" in {
      // Test bug: It might be empty simply because the activity list doesn't load that quickly.
      click on linkText("Moderation")
      find(cssSelector("table tbody tr")) mustEqual None
      pending
    }

    "view empty discussion in embedding page" in {
      go to embeddingPageUrl
      eventually {
        pageSource must include ("Text text text")
      }
    }

    "Switch to embedded comments <iframe>" in {
      rememberEmbeddedCommentsIframe()
      switchToAnyEmbeddedCommentsIframe()
    }

    "add a reply, as admin" in {
      replyToArticle(AdminReplyText)
    }

    "add a reply, as guest" in {
      logoutIfLoggedIn()
      loginAsGuestInPopup("TestGuest")
      replyToComment(postId = 2, text = GuestReplyText)
    }

    "reload page, find both replies" in {
      reloadPage()
      switchToAnyEmbeddedCommentsIframe()
      eventually {
        pageSource must include (AdminReplyText)
        pageSource must include (GuestReplyText)
      }
    }
  }

}

