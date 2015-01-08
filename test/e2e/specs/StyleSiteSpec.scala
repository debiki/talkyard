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

import com.debiki.core.{PageParts, PageRole}
import com.debiki.core.Prelude._
import java.{lang => jl}
import org.scalatest.DoNotDiscover
import test.e2e.code._


/* Currently totally broken, I've rewritten the admin interface from scratch.
  Keep anyway in case I'd like to make styling one's site work again.


/** Runs the StyleSiteSpec suite,
  * in SBT:  test-only test.e2e.specs.StyleSiteSpecRunner
  * in test:console:  (new test.e2e.specs.StyleSiteSpecRunner).execute()
  */
@DoNotDiscover
class StyleSiteSpecRunner extends org.scalatest.Suites(new StyleSiteSpecSpec)
  with StartServerAndChromeDriverFactory


/**
 * Styles a website, and verifies that pages and styles and config pages
 * are refreshed when things have been edited. That is, tests that there's
 * no stale stuff in any cache.
 */
@test.tags.EndToEndTest
@DoNotDiscover
class StyleSiteSpecSpec extends DebikiBrowserSpec
  with TestSiteCreator with TestEditor {


  val NextBackgroundColor = "rgba(0, 0, 255, 1)" // green
  val LastBackgroundColor = "rgba(227, 228, 250, 1)"  // lavender

  var dashboardWindow: WindowTarget = null
  var homepageWindow: WindowTarget = null
  var stylesheetWindow: WindowTarget = null
  var genericPageWindow: WindowTarget = null


  "One can style a website" - {


    "create new site and goto dashboard" in {
      val siteName = clickCreateSimpleWebsite(loginWithGmailFullscreen)
      clickWelcomeLoginToDashboard(loginWithGmailFullscreen, siteName)
      dashboardWindow = window(webDriver.getWindowHandle)
    }


    "check homepage background color" - {
      "open homepage" in {
        homepageWindow = openAndSwitchToFirstPage(DefaultHomepageTitle, newTab = true)
      }

      s"find the background painted in $DefaultBackgroundColor" in {
        val background = getBackgroundColor
        background must be === DefaultBackgroundColor
      }
    }


    "refreshes cached pages and asset bundles, when optional asset created" - {

      "create and edit /themes/local/styles.css" - {
        "create style sheet" in {
          switch to dashboardWindow
          clickCreateNewPage(PageRole.Code, "css")
          stylesheetWindow = window(webDriver.getWindowHandle)
        }

        s"edit stylesheet: change background to $NextBackgroundColor" in {
          editBackgroundTo(NextBackgroundColor)
        }
      }


      "create a new page, check background color" - {
        // This tests if asset bundles are rebuilt when an optional dependency
        // is created, after the bundle has been cached.

        "create new page" in {
          switch to dashboardWindow
          clickCreateNewPage(PageRole.Generic)
          genericPageWindow = window(webDriver.getWindowHandle)
        }

        s"find the background painted in $NextBackgroundColor" in {
          val background = getBackgroundColor
          background must be === NextBackgroundColor
        }
      }


      "reload the homepage, check background color" - {
        // This tests if cached pages (the homepage) are refreshed when the asset bundle(s)
        // they're using have been modified.

        "reload homepage (cached version, with wrong color, should be discarded)" in {
          switch to homepageWindow
          reloadPage()
        }

        s"find the background painted in $NextBackgroundColor" in {
          val background = getBackgroundColor
          background must be === NextBackgroundColor
        }
      }
    }


    "refreshes cached pages and asset bundles when asset edited" - {

      s"edit stylesheet, change background to $LastBackgroundColor" in {
        switch to stylesheetWindow
        editBackgroundTo(LastBackgroundColor) //
      }

      "reload the homepage, check background color" - {
        // This tests both if the asset bundle has been regenerated,
        // and if cached pages are refreshed.

        "reload homepage (cached version, with wrong color, should be discarded)" in {
          switch to homepageWindow
          reloadPage()
        }

        s"find the background painted in $LastBackgroundColor" in {
          val background = getBackgroundColor
          background must be === LastBackgroundColor
        }
      }
    }
  }


  private def getBackgroundColor: String =
    find(cssSelector("body"))
      .getOrElse(fail("Body not found"))
      .underlying.getCssValue("background-color")


  private def editBackgroundTo(color: String) {
    clickAndEdit(PageParts.BodyId, i"""
      |body {
      |background-color: $color !important;
      |}
      |""")
  }

}

*/