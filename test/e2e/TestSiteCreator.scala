/**
 * Copyright (c) 2013 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import org.openqa.selenium.Keys
import org.openqa.selenium.interactions.Actions
import com.debiki.v0.PageRole
import play.api.test.Helpers.testServerPort
import com.debiki.v0.Prelude._
import org.scalatest.time.{Seconds, Span}


/** Creates test sites, via /-/new-website/...
  */
trait TestSiteCreator extends TestLoginner {
  self: DebikiBrowserSpec =>

  private var nextWebsiteId = 0
  private var knownWindowHandles = Set[String]()


  val DefaultHomepageTitle = "Default Homepage"


  def createWebsiteChooseNamePage = new Page {
    val url = s"$firstSiteOrigin/-/new-website/choose-name"
  }


  def nextSiteName(): String = {
    nextWebsiteId += 1
    s"test-site-$nextWebsiteId"
  }


  def clickCreateSite(
        siteName: String = null, alreadyOnNewWebsitePage: Boolean = false): String = {
    val name =
      if (siteName ne null) siteName
      else nextSiteName()

    s"create site $name" in {
      if (!alreadyOnNewWebsitePage)
        go to createWebsiteChooseNamePage

      click on "website-name"
      enter(name)
      click on "accepts-terms"
      click on cssSelector("input[type=submit]")

      clickLoginWithGmailOpenId()
    }

    name
  }


  def clickWelcomeLoginToDashboard(newSiteName: String) {
    "click login link on welcome owner page" in {
      // We should now be on page /-/new-website/welcome-owner.
      // There should be only one link, which takes you to /-/admin/.
      assert(pageSource contains "Website created")
      click on cssSelector("a")
    }

    "login to admin dashboard" in {
      clickLoginWithGmailOpenId()
      assert(pageSource contains "Welcome to your new website")
      webDriver.getCurrentUrl() must be === originOf(newSiteName) + "/-/admin/"
    }
  }


  def clickLoginWithGmailOpenId(approvePermissions: Boolean = true) {
    click on cssSelector("a.login-link-google")
    fillInGoogleCredentials(approvePermissions)
  }


  def originOf(newSiteName: String) =
    s"http://$newSiteName.localhost:$testServerPort"

}

