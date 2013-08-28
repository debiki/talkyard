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
import controllers.AppInstall
import org.scalatest.time.{Span, Seconds}
import org.scalatest.DoNotDiscover
import test.e2e.code._


/** Runs the ServerInstallationSpec suite
  * in SBT:  test-only test.e2e.specs.ServerInstallationSpecRunner
  * in test:console:  (new test.e2e.specs.ServerInstallationSpecRunner).execute()
  */
@DoNotDiscover
class ServerInstallationSpecRunner extends org.scalatest.Suites(new ServerInstallationSpec)
  with StartServerAndChromeDriverFactory


/** Tests creation of the very first site and its owner account,
  * that is, server "installation".
  */
@test.tags.EndToEndTest
@DoNotDiscover
class ServerInstallationSpec extends DebikiBrowserSpec with TestLoginner {

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
      eventually {
        click on cssSelector("a[href*='/-/admin/']")
      }
    }

  }

  def firstSitePasswordField =
    pwdField(cssSelector("input[ng-model='firstSitePassword']"))

}

