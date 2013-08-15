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

package test.e2e

import com.debiki.core.Prelude._
import java.{util => ju}
import org.openqa.selenium


/** Logs in as guest or a certain Gmail OpenID user or as admin.
  */
trait TestLoginner {
  self: DebikiBrowserSpec with StuffTestClicker =>


  private var firstGmailLogin = true

  private var adminMadeAdmin = false

  /** Clicks the login link at the top of the page and logs in.
    * Specifies no email.
    */
  def loginAsGuest(name: String) {
    click on loginLink
    submitGuestLoginNoEmailQuestion(name)
  }


  def loginAsGmailUser() {
    click on loginLink
    eventually { click on cssSelector(".dw-a-login-openid") }
    eventually { click on cssSelector("#openid_btns .google") }
    // Switch to OpenID popup window.
    val originalWindow = webDriver.getWindowHandle()
    switchToNewlyOpenedWindow()
    fillInGoogleCredentials()
    webDriver.switchTo().window(originalWindow)
    eventually {
      click on "dw-f-lgi-ok-ok"
    }
  }


  /** Creates an admin user, if not already done, and logs in as that user.
    * However, does this via direct database calls; does not use Selenium / ScalaTest.
    */
  def cheatLoginAsAdmin() {
    import com.debiki.{core => d}

    val login = d.Login(id = "?", prevLoginId = None, ip = "1.1.1.1", date = new ju.Date,
        identityId = "?i")

    val identity = d.IdentityOpenId(id = "?i",
      userId = "?", oidEndpoint = "http://test-endpoint.com", oidVersion = "",
      oidRealm = "", oidClaimedId = "TestAdminClaimedId", oidOpLocalId = "TestAdminLocalId",
      firstName = "TestAdmin", email = "test-admin@example.com", country = "")

    val loginReq = d.LoginRequest(login, identity)
    val dao = debiki.Globals.siteDao(firstSiteId, ip = "1.1.1.1")
    val loginGrant = dao.saveLogin(loginReq)

    if (!adminMadeAdmin) {
      adminMadeAdmin = true
      dao.configRole(loginGrant.login.id, ctime = loginGrant.login.date,
        roleId = loginGrant.user.id, isAdmin = Some(true))
    }

    // Update the browser: set cookies.
    val (_, _, sidAndXsrfCookies) = debiki.Xsrf.newSidAndXsrf(Some(loginGrant))
    val userConfigCookie = controllers.AppConfigUser.userConfigCookie(loginGrant)
    for (cookie <- userConfigCookie :: sidAndXsrfCookies)
      add.cookie(cookie.name, cookie.value)

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
      val gmailAddr = debiki.Utils.getConfigStringOrDie("debiki.test.gmail.address")
      val gmailPswd = debiki.Utils.getConfigStringOrDie("debiki.test.gmail.password")
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
    /*
    eventually {
      try {
        if (!currentUrl.contains("google.com")) {
          // For whatever reasons, Google didn't show Approve/Reject buttons this
          // time, so there's nothing to click. Simply continue: all tests should
          // work fine, except for any test that requires that we deny permissions.
        }
        else if (approvePermissions) {
          click on "submit_approve_access"
        }
        else {
          click on "submit_deny_access"
        }
      }
      catch {
        case ex: selenium.NoSuchWindowException =>
          // For whatever reason, Google closed the login popup window.
          // Fine, simply continue with the test.
      }
    }
    */
  }


  /** Fills in the guest login form, and assumes no question will be asked
    * about email notifications.
    */
  def submitGuestLoginNoEmailQuestion(name: String, email: String = "") {
    eventually { click on "dw-fi-lgi-name" }
    enter(name)
    if (email.nonEmpty) {
      click on "dw-fi-lgi-email"
      enter(email)
    }
    click on "dw-f-lgi-spl-submit"
    eventually { click on "dw-dlg-rsp-ok" }
  }


  /** Fills in the guest login form, and clicks yes/no when asked about
    * email notifications.
    */
  def submitGuestLoginAnswerEmailQuestion(
        name: String,
        email: String = "",
        waitWithEmail: Boolean = false,
        waitWithEmailThenCancel: Boolean = false) {

    submitGuestLoginNoEmailQuestion(name, if (waitWithEmail) "" else email)

    if (waitWithEmail) {
      eventually { click on yesEmailBtn }
      if (waitWithEmailThenCancel) {
        click on noEmailBtn
      }
      else {
        click on "dw-fi-eml-prf-adr"
        enter(email)
        click on emailPrefsubmitBtn
      }
    }
    else if (email.nonEmpty) {
      eventually { click on yesEmailBtn }
    }
    else {
      eventually { click on noEmailBtn }
    }
  }


  def logoutIfLoggedIn() {
    logout(mustBeLoggedIn = false)
  }


  def logout(mustBeLoggedIn: Boolean = true) {
    def isLoggedIn = find(logoutLink).map(_.isDisplayed) == Some(true)
    if (isLoggedIn) {
      eventually {
        scrollIntoView(logoutLink)
        click on logoutLink
        //scrollIntoView(logoutSubmit)
        click on logoutSubmit
      }
      eventually {
        isLoggedIn must be === false
      }
    }
    else if (mustBeLoggedIn) {
      fail("Not logged in; must be logged in")
    }
  }


  private def loginLink = "dw-a-login"
  private def logoutLink = "dw-a-logout"
  private def logoutSubmit = "dw-f-lgo-submit"

  def noEmailBtn = cssSelector("label[for='dw-fi-eml-prf-rcv-no']")
  def yesEmailBtn = cssSelector("label[for='dw-fi-eml-prf-rcv-yes']")
  def emailPrefsubmitBtn = "dw-fi-eml-prf-done"

}

