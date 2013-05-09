/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import com.debiki.v0.Prelude._
import org.scalatest.time.{Span, Seconds}
import org.scalatest.DoNotDiscover
import controllers.AppInstall


/** Runs the ServerInstallationSpec suite
  * in SBT:
  *  test-only test.e2e.ServerInstallationSpecRunner
  * in SBT's test:console:
  *  (new test.e2e.ServerInstallationSpecRunner {}).execute()
  */
@DoNotDiscover
class ServerInstallationSpecRunner extends org.scalatest.Suites(
  new ServerInstallationSpec {})
  with ChromeSuiteMixin


/** Tests creation of the very first site and its owner account,
  * that is, server "installation".
  */
@DoNotDiscover
abstract class ServerInstallationSpec extends DebikiBrowserSpec with TestLoginner {

  import play.api.test.Helpers.testServerPort


  "A server owner can" - {

    "not use the admin page before installation completed" in {
      // go to http://localhost:19001/-/admin/, verify that server replies 404 Not Found.
      pending
    }

    "go to the install page" in {
      go to (new Page {
        val url = s"http://localhost:$testServerPort/-/install/"
      })
    }

    "find the create-first-site page" in {
      pageSource must include("Installation")
      pageSource must include("Who are you?")
    }

    "submit a bad create-first-site password, be denied access" in {
      def findBadPasswordTag() = find(cssSelector(".alert-error")) getOrElse fail()
      findBadPasswordTag().isDisplayed must be === false
      firstSitePasswordField.value = "bad-password"
      click on cssSelector("input[type='submit']")
      eventually {
        findBadPasswordTag().isDisplayed must be === true
      }
    }

    "submit the correct create-first-site password" in {
      firstSitePasswordField.value = AppInstall.firstSitePassword
      click on cssSelector("input[type='submit']")
    }

    "find the owner creation page" in {
      eventually {
        pageSource must include("The website needs an administrator")
      }
    }

    "login as a Gmail user" in {
      click on cssSelector(".login-link-google")
      fillInGoogleCredentials()
    }

    "view the all-done page" in {
      // Verify that clicking Submit results in:
      // 403 Forbidden, "... may not create website from this website ..."
      // Have to do this from another site; `localhost` allows website creation,
      // see StuffCreator.createFirstSite().
      pending
    }

    "follow link to the admin dashboard" in {
      click on cssSelector("a[href*='/-/admin/']")
      java.lang.Thread.sleep(7200*1000)
    }

  }

  def firstSitePasswordField =
    pwdField(cssSelector("input[ng-model='firstSitePassword']"))

}

