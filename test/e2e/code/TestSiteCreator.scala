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

import com.debiki.core.Prelude._
import TestSiteCreator._



object TestSiteCreator {

  /** Sometimes I don't empty the database different specs, so it's best
    * to never reuse a website id — otherwise there'll be "website already created"
    * errors.
    */
  private var nextWebsiteId = 0

}



/** Creates test sites, via /-/create-site/...
  */
trait TestSiteCreator extends TestLoginner {
  self: DebikiBrowserSpec =>

  private var knownWindowHandles = Set[String]()


  val DefaultHomepageTitle = "Default Homepage"


  def createWebsiteChooseTypePage = new Page {
    val url = s"http://$newSiteDomain/-/create-site/choose-owner"
  }


  def createEmbeddedCommentsSiteStartPage = new Page {
    val url = s"http://$newSiteDomain/-/create-embedded-site"
  }

  def nextSiteName(): String = {
    nextWebsiteId += 1
    s"test-site-$nextWebsiteId"
  }


  def clickCreateSimpleWebsite(login: () => Unit, siteName: String = null): String = {
    val name =
      if (siteName ne null) siteName
      else nextSiteName()

    info("create site $name")

    go to createWebsiteChooseTypePage
    login()
    clickChooseSiteType(debiki.SiteCreator.NewSiteType.SimpleSite)

    click on "website-name"
    enter(name)
    click on "accepts-terms"
    click on cssSelector("input[type=submit]")

    name
  }


  def clickChooseSiteType(siteType: debiki.SiteCreator.NewSiteType) {
    click on "site-type"
    val siteTypeOptionId = siteType match {
      case debiki.SiteCreator.NewSiteType.SimpleSite => "new-simple-site"
      case debiki.SiteCreator.NewSiteType.Blog => "new-blog"
      case debiki.SiteCreator.NewSiteType.Forum => "new-forum"
      case debiki.SiteCreator.NewSiteType.EmbeddedComments =>
        // This is tested elsewere, namely in CreateEmbeddedCommentsSiteSpec.scala.
        assErr("DwE17wfh3", "Broken test")
    }
    click on siteTypeOptionId
    click on cssSelector("input[type=submit]")
    eventually {
      find("website-name") must be ('defined)
    }
  }


  def clickWelcomeLoginToDashboard(login: () => Unit, newSiteName: String) {
    viewNewSiteWelcomePageAndContinue()
    info("login to admin dashboard")
    login()
    verifyIsOnAdminPage(newSiteName)
  }


  def viewNewSiteWelcomePageAndContinue() {
    // We should now be on page /-/create-site/welcome-owner.
    // There should be only one link, which takes you to /-/admin/.
    info("view welcome owner page, click continue link")
    eventually {
      assert(pageSource contains "Website created")
    }
    click on cssSelector("a")
  }


  private def verifyIsOnAdminPage(newSiteName: String) {
    info("get to the admin age")
    eventually {
      assert(pageSource contains "Admin Page")
    }
    webDriver.getCurrentUrl() must fullyMatch regex s"${originOf(newSiteName)}/-/admin/#?"
  }


  def findSimpleSiteHomepage() {
    findMainPage("Generic", linkText = "homepage", "No homepage link found")
    //findMainPage("Code", linkText = "configuration", "No website config page link found")
  }

  def findBlogMainPage() {
    findMainPage("Blog", linkText = "blog", "No blog main page link found")
  }

  def findForumMainPage() {
    findMainPage("Forum", linkText = "forum", "No forum main page link ffound")
  }


  private def findMainPage(tyype: String, linkText: String, errorMessage: String) {
    eventually {
      find(cssSelector(s"tr.page-role-$tyype > td a[href='/']")) match {
        case Some(elem) =>
          elem.text.toLowerCase must include(linkText)
        case None =>
          fail(errorMessage)
      }
    }
  }


  def originOf(newSiteName: String) =
    s"http://$newSiteName.$newSiteDomain"

}

