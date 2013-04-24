/**
 * Copyright (c) 2013 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import com.debiki.v0.Prelude._
import org.scalatest.time.{Seconds, Span}


/** Logs in as guest or a certain Gmail OpenID user or as admin.
  */
trait TestLoginner {
  self: DebikiBrowserSpec with StuffTestClicker =>


  val GmailUserEmail = "debiki.tester@gmail.com"


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


  def loginAsAdmin() {
    // For now, the admin and the gmail user are one and the same.
    loginAsGmailUser()
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

