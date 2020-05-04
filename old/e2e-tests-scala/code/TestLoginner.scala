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

package test.e2e.code

import com.debiki.core._
import com.debiki.core.Prelude._
import java.{util => ju}
import org.openqa.selenium
import play.{api => p}
import play.api.Play.current


/** Logs in as guest or a certain Gmail OpenID user or as admin.
  */
trait TestLoginner extends DebikiSelectors {
  self: DebikiBrowserSpec with StuffTestClicker =>


  private var firstGmailLogin = true
  private var adminMadeAdmin = false
  private val LoginPopupWindowName = "LoginPopup"


  /** Clicks some login link, so a login popup dialog opens; then logs in as guest.
    * Specifies no email.
    */
  def loginAsGuestInPopup(name: String) {
    click on aLoginLink
    submitGuestLogin(name)
  }


  /** Clicks some login link, so a login popup dialog opens; then logs in as a Gmail user.
    */
  def loginWithGmailInPopup() {
    click on aLoginLink
    eventually { click on "dw-lgi-google" }
    // Switch to OpenID popup window.
    val originalWindow = webDriver.getWindowHandle()
    switchToNewlyOpenedWindow()
    fillInGoogleCredentials()
    webDriver.switchTo().window(originalWindow)
    eventually {
      // Wait until any modal dialog closed — sometimes we've already logged in
      // with Gmail and then `fillInGoogleCredentials()` above completes immediately,
      // before login has actually happened.
      find(cssSelector(".ui-widget-overlay")) mustBe None
    }
  }


  /** Assumes we're on a full screen login page, and enters email and password and
    * clicks the login submit button.
    */
  def loginWithPasswordFullscreen(email: String, password: String) {
    eventually { click on "email" }
    enter(email)
    click on "password"
    enter(password)
    click on cssSelector("""[type="submit"]""")
  }


  /** Assumes we're on a full screen login page, and clicks the Gmail login button
    * and then logs in via Gmail OpenID.
    */
  def loginWithGmailFullscreen() {
    loginWithGmailFullscreen(approvePermissions = true)
  }


  def loginWithGmailFullscreen(approvePermissions: Boolean) {
    eventually {
      click on cssSelector("a.login-link-google")
    }
    fillInGoogleCredentials(approvePermissions)
  }


  /** Creates an admin user, if not already done, and logs in as that user.
    * However, does this via direct database calls; does not use Selenium / ScalaTest.
    */
  def cheatLoginAsAdmin() {

    val loginAttempt = OpenIdLoginAttempt(ip = "1.1.1.1", date = new ju.Date,
      openIdDetails = OpenIdDetails(
      oidEndpoint = "http://test-endpoint.com", oidVersion = "",
      oidRealm = "", oidClaimedId = "TestAdminClaimedId", oidOpLocalId = "TestAdminLocalId",
      firstName = "TestAdmin", email = Some("test-admin@example.com"), country = ""))

    val dao = debiki.Globals.siteDao(firstSiteId)
    val loginGrant = dao.tryLogin(loginAttempt)

    if (!adminMadeAdmin) {
      adminMadeAdmin = true
      dao.configRole(userId = loginGrant.user.id, isAdmin = Some(true))
    }

    // Update the browser: set cookies.
    val (_, _, sidAndXsrfCookies) = debiki.Xsrf.newSidAndXsrf(loginGrant.user)
    for (cookie <- sidAndXsrfCookies) {
      // Set cookie via Javascript: ...
      executeScript(
        s"debiki.internal.$$.cookie('${cookie.name}', '${cookie.value}', { path: '/' });")
      // ... Because the preferred way to set cookies:
      //   add.cookie(cookie.name, cookie.value)
      // doesn't work when in an iframe, probably because add.cookie attempts to add
      // the cookie to the wrong domain or isn't allowed to add it to the iframe's domain
      // because it's different from the embedding domain.
      // And all these attempts to set the domain results in:
      //      org.openqa.selenium.InvalidCookieDomainException "invalid domain: ..."
      //   - mycomputer   // that's the embedding domain
      //   - .hello.mycomputer
      //   - hello.mycomputer
      //   - localhost
      //   - .localhost
    }

    // Redraw login related stuff and sync XSRF tokens.
    executeScript("debiki.internal.Me.fireLogin()")
  }


  def fillInGoogleCredentials(approvePermissions: Boolean = true) {
    if (firstGmailLogin) {
      firstGmailLogin = false
      // 1. I've created a dedicated Gmail OpenID test account, see below.
      // 2. `enter(email)` throws: """Currently selected element is neither
      // a text field nor a text area""", in org.scalatest.selenium.WebBrowser,
      // so use `pressKeys` instead.
      eventually {
        click on "Email"
      }

      def getConfigOrCancel(configValueName: String) = {
        val anyConfigValue = p.Play.configuration.getString(configValueName)
        anyConfigValue getOrElse cancel(o"""No Gmail test user credentials provided (config
          value '$configValueName' not specified), skipping test""")
      }
      val gmailAddr = getConfigOrCancel("debiki.test.gmail.address")
      val gmailPswd = getConfigOrCancel("debiki.test.gmail.password")

      pressKeys(gmailAddr)
      click on "Passwd"
      pressKeys(gmailPswd)
      click on "signIn"
    }

    // Apparently Google has changed the login process. Now the remember-choices
    // checkbox no longer seems to appear, but there's a "stay signed in"
    // button below the email and password fields (filled in just above).
    // For now, simply comment out this, and then Google's OpenID login will work:
    /*
    // Now Google should show another page, which ask about permissions.
    // Uncheck a certain remember choices checkbox, or this page won't be shown
    // next time (and then we cannot choose to deny access).
    eventually {
      click on "remember_choices_checkbox"
    } */

    // I don't know why, but the Google login popup window closes after a while
    // and apparently it's impossible to catch the NoSuchWindowException
    // below — the test suite instead hangs forever, no idea why. So comment out
    // this instead, and everything works fine.
    // Update: This approve-permissions dialog is apparently shown only
    // sometimes, fairly infrequently.
    // Update2: Catching the Throwable (see below) seems to fix the above-mentioned problem.
    eventually {
      try {
        // Sometimes Google shows approve/deny access buttons. The very first click
        // seem to have no effect, so keep clicking until they go away.
        while (currentUrl.contains("google.com")) {
          if (approvePermissions) {
            click on "submit_approve_access"
          }
          else {
            click on "submit_deny_access"
          }
        }
      }
      catch {
        case ex: selenium.NoSuchWindowException =>
          // For whatever reason, Google closed the login popup window.
          // Fine, simply continue with the test.
        case t: Throwable =>
          // Sometimes we catch a null pointer exception here, somehow seems to happen
          // when the Google approve/deny window closes. Weird.
          System.out.println(s"*** Caught and ignoring a Throwable: $t ***")
      }
    }
  }


  def createNewPasswordAccount(
        email: String,
        password: String,
        displayName: String = "Display_Name",
        country: String = "Country",
        fullName: String = "Full_Name") {

    // Only these emails work with E2E tests, see Mailer.scala, search for "example.com".
    assert(email endsWith "example.com")

    info("creating and logging in with new password account")
    click on "create-account"

    eventually {
      click on cssSelector("""input[name="emailAddress"]""")
      enter(email)
      click on cssSelector("""[type="submit"]""")
    }

    eventually {
      val nextPageUrl = debiki.MailerActor.EndToEndTest.getAndForgetMostRecentEmail() match {
        case None =>
          fail()
        case Some(email: Email) =>
          extractNextPageUrlFromNewAccountEmail(email)
      }
      go to nextPageUrl
    }

    eventually {
      pageSource must include ("Fill In Your Details")

      click on "displayName"
      enter("Admins_display_name")

      click on "fullName"
      enter("Admins_full_name")

      click on "country"
      enter("Admins_country")

      click on "password"
      enter(password)

      click on "passwordAgain"
      enter(password)

      click on cssSelector("""[type="submit"]""")
    }

    eventually {
      pageSource must include ("Your account has been created")
      click on partialLinkText("Click to continue")
    }
  }


  /** Fills in the guest login form.
    */
  def submitGuestLogin(name: String, email: String = "") {

    if (embeddedCommentsWindowAndFrame.isDefined)
      webDriver.switchTo().window(LoginPopupWindowName)

    // Open guest login dialog.
    eventually { click on "dw-lgi-guest" }

    // Fill in details.
    eventually { click on "dw-fi-lgi-name" }
    enter(name)
    if (email.nonEmpty) {
      click on "dw-fi-lgi-email"
      enter(email)
    }

    // Submit.
    click on "dw-lgi-guest-submit"

    switchToAnyEmbeddedCommentsIframe()

    // A certain confirmation dialog is currently not shown when logging in in a popup.
    if (embeddedCommentsWindowAndFrame.isEmpty) {
      eventually {
        click on "dw-dlg-rsp-ok"
      }
    }
  }


  def logoutIfLoggedIn() {
    logout(mustBeLoggedIn = false)
  }


  def logout(mustBeLoggedIn: Boolean = true) {
    def isLoggedIn = aLogoutLink.isDisplayed
    if (isLoggedIn) {
      eventually {
        scrollIntoView(aLogoutLink)
        click on aLogoutLink
        //scrollIntoView(logoutSubmit)
      }
      eventually {
        isLoggedIn must be === false
      }
    }
    else if (mustBeLoggedIn) {
      fail("Not logged in; must be logged in")
    }
  }


  /** The email sent when creating a new account looks like so:
    * {{{
    * ... To create an account at <tt>localhost:19001</tt>, please follow
    * <a href="http://localhost:19001/-/create-account/user-details/<email-id>/
    *                  %2F-%2Fcreate-embedded-site%2Fspecify-embedding-site-address">
    *   this link</a>. ....
    * }}}
    *
    * This function extracts the url to click. "(?s)" below makes "." match newline.
    */
  private def extractNextPageUrlFromNewAccountEmail(email: Email) = {
    val NextPageUrlRegex =
      """(?s).* href="(https?://[^"]+/create-account/user-details/[^"]+)".*""".r
    email.bodyHtmlText match {
      case NextPageUrlRegex(url) =>
        url
      case _ =>
        // This is an old email from another E2E test? Or the regex above is wrong.
        fail()
    }
  }


  private def aLoginLink = find(AnyLoginLink) getOrElse fail()
  private def aLogoutLink = find(AnyLogoutLink) getOrElse fail()

}

