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

import com.debiki.core.Email
import com.debiki.core.Prelude._
import org.scalatest.DoNotDiscover
import org.scalatest.Suites
import test.e2e.code._


/** Runs the PasswordSpec.
  * In Play:   test-only test.e2e.specs.PasswordSpecRunner
  * In test:console:  (new test.e2e.specs.PasswordSpecRunner).execute()
  */
class PasswordSpecRunner extends Suites(new PasswordSpec) with StartServerAndChromeDriverFactory


/** This specification tests password related things:
  * - Forgotten account, at create site page only.
  * - Forgotten password, and
  * - Invalid password, here:
  *   - admin dashboard login page
  *   - create site page  (tests not implemented)
  *   - login popup dialog  (tests not implemented)
  */
@test.tags.EndToEndTest
@DoNotDiscover
class PasswordSpec extends DebikiBrowserSpec with TestSiteCreator {

  val AdminsEmail = "admin-9503@example.com"
  val AdminsPassword = "Admins_password"
  val AdminsNewPassword = "Admins_new_password"

  def loginToAdminPage() {
    loginWithPasswordFullscreen(AdminsEmail, password = AdminsPassword)
  }

  val siteName = nextSiteName()


  "A user with a browser can" - {

    s"create an account, $AdminsEmail, and a website, $siteName" in {
      clickCreateForum(login = () => {
          createNewPasswordAccount(AdminsEmail, password = AdminsPassword)
        }, siteName = siteName)
    }

    s"goto admin login page" in {
      viewNewSiteWelcomePageAndContinue()
    }

    "admin login page tests" - {

      "specify wrong password, be denied access" in {
        loginWithPasswordFullscreen(AdminsEmail, "bad-password")
        endUpOnLoginDeniedPage()
        goBack()
        waitForLoginPageToLoad()
      }

      "specify wrong email, be denied access" in {
        loginWithPasswordFullscreen("bad-email@example.com", AdminsPassword)
        endUpOnLoginDeniedPage()
        goBack()
        waitForLoginPageToLoad()
      }

      "reset password" - {

        var loginPageWindowHandle: String = null

        "click I-forgot-my-password link" in {
          click on "forgotPasswordLink"
          loginPageWindowHandle = webDriver.getWindowHandle()
          switchToNewlyOpenedWindow()
        }

        "submit wrong email address" in {
          enterEmail("wrong-email-address@example.com")
          click on getSubmitButton
          endUpOnWeSentResetPasswordEmailPage()
          goBack()
        }

        "no recovery email sent (since account doesn't exist)" in {
          // Could somehow verify that no email was sent, but ... how?
          pending
        }

        "enter correct email address, recovery email sent" in {
          enterEmail(AdminsEmail)
          click on getSubmitButton
          endUpOnWeSentResetPasswordEmailPage()
        }

        "find password reset email, go to password reset page" in {
          eventually {
            val url = debiki.Mailer.EndToEndTest.getAndForgetMostRecentEmail() match {
              case None => fail()
              case Some(email: Email) => extractResetPasswordPageUrl(email)
            }
            go to url
          }
        }

        "enter new password" in {
          click on "newPassword"
          enter(AdminsNewPassword)
          click on "newPasswordAgain"
          enter(AdminsNewPassword)
          click on getSubmitButton
        }

        "end up on password changed page, go to login page" in {
          eventually {
            pageSource must include ("Password Changed")
          }
          close()
          switch to window (loginPageWindowHandle)
        }

        "old password doesn't work" in {
          loginWithPasswordFullscreen(AdminsEmail, AdminsPassword)
          endUpOnLoginDeniedPage()
          goBack()
          waitForLoginPageToLoad()
        }

        "log in with new password" in {
          loginWithPasswordFullscreen(AdminsEmail, AdminsNewPassword)
        }

        "find default homepage and website config page" in {
          clickGoToSiteFindForum(siteName)
        }
      }

      "get a you-alread-have-an-account reminder email" - {

        "log out, go to create site page" in {
          go to s"http://$siteName.${debiki.Globals.baseDomainWithPort}/-/api/logout"
          go to s"http://${debiki.Globals.baseDomainWithPort}/-/create-site"
          waitForLoginPageToLoad()
        }

        "attempt to create account with email for existing account" in {
          click on "create-account"
          eventually {
            click on "emailAddress"
            enter(AdminsEmail)
            click on getSubmitButton
          }
        }

        "see we-just-sent-you-a-registration message" in {
          eventually {
            pageSource must include ("We just sent you a registration email")
          }
        }

        "get an you-already-have-an-account email reminder" in {
          val email = eventually {
            debiki.Mailer.EndToEndTest.getAndForgetMostRecentEmail() match {
              case None => fail()
              case Some(email: Email) => email
            }
          }
          email.bodyHtmlText must include ("you already have an account there, with email address")
          val address = extractEmailAddressFromBodyOf(email)
          address mustEqual AdminsEmail
        }
      }
    }

  }


  private def enterEmail(email: String) {
    click on "email"
    enter(email)
  }

  private def getSubmitButton: Element =
    find(cssSelector("[type='submit']")) getOrElse fail()

  private def endUpOnLoginDeniedPage() {
    eventually {
      pageSource must include ("403 Forbidden")
      pageSource must include ("Bad username or password")
    }
  }

  private def endUpOnWeSentResetPasswordEmailPage() {
    eventually {
      pageSource must include ("We just sent you a reset-password email")
    }
  }

  private def waitForLoginPageToLoad() {
    // Page loaded when submit button available.
    eventually {
      getSubmitButton
    }
  }

  /** Extracts the reset-password-URL from a reset-password email.
    */
  private def extractResetPasswordPageUrl(email: Email): String = {
    // The email is like:
    //   |To reset your password at <tt>test-site-1.localhost:19001</tt>, please follow
    //   |<a href="http://test-site-1.localhost:19001/-/reset-password/choose-password/1mxp2jqf">
    //   |   this link</a>.  It expires in 24 hours.
    // "(?s)" below makes "." match newline.
    val ResetPasswordUrlRegex =
      """(?s).* href="(https?://[^"]+/reset-password/choose-password/[^"]+)".*""".r
    email.bodyHtmlText match {
      case ResetPasswordUrlRegex(url) => url
      case _ => fail()
    }
  }

  /** Extracts the email for a users existing account from a you-already-have-an-account email.
    */
  private def extractEmailAddressFromBodyOf(email: Email): String = {
    // The message is like:
    //    | you already have an account there, with email address <tt>admin-9503@example.com</tt>
    // "(?s)" below makes "." match newline.
    val EmailAddressRegex = """(?s).*[^a-z]([a-z][0-9a-z.-]+@[0-9a-z.-]+[a-z]).*""".r
    email.bodyHtmlText match {
      case EmailAddressRegex(emailAddress) => emailAddress
      case _ => fail()
    }
  }

}

