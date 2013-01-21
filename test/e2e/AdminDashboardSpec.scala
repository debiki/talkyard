/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import com.debiki.v0.{Page, PageRole}
import com.debiki.v0.Prelude._
import java.{lang => jl}
import org.openqa.selenium.{Keys, By, WebElement}
import org.scalatest.time.{Span, Seconds}
import akka.actor.IllegalActorStateException


/**
 * Runs the CreateSiteSpec suite
 * in SBT:
 *  test-only test.e2e.AdminDashboardRunner
 * in SBT's test:console:
 *  (new test.e2e.AdminDashboardRunner {}).execute()
 */
class AdminDashboardRunner extends org.scalatest.Suites(
  new AdminDashboardSpec {})
  with ChromeSuiteMixin


/**
 * Tests the admin ashboard, /-/admin/.
 */
// From ScalaTest 2.0-M5 and above, use this: `@DoNotDiscover`
// instead of `abstract`.
abstract class AdminDashboardSpec extends DebikiBrowserSpec {

  val EditedHomepageTitle = "Edited Homepage Title"
  val EditedHomepageBody = "Edited homepage body."

  var siteName = ""
  var dashboardWindow: WindowTarget = null


  "Via the admin dashboarad, one can create and edit pages" - {


    "create new site" - {
      siteName = clickCreateSite()
    }


    "go to admin dashboard, login as admin" in {
      click on partialLinkText("admin page")
      clickLoginWithGmailOpenId()
      dashboardWindow = window(webDriver.getWindowHandle)
    }


    "edit homepage" - {

      "open homepage" in {
        // The Admin SPA does a network request to get a page listing.
        eventually {
          // Clicking the link opens a new browser tab.
          click on partialLinkText("Default Homepage")
          switchToNewlyOpenedWindow()
        }
      }

      "edit homepage title" - {
        clickAndEdit(Page.TitleId, newText = EditedHomepageTitle)
      }

      "edit homepage body" in {
        // Doesn't work: clickAndEdit(Page.BodyId, newText = EditedHomepageBody)
        // Oddly enough, this:
        //  click on cssSelector(s"#post-$postId .dw-p-bd-blk p"), or without " p",
        // won't show the inline menu, so it's never possible toc click Improve.
        // However, for the title post, the inline menu does appear.
        pending
      }

      "reload page, find edited text" in {
        // This results in a weird error:
        // org.openqa.selenium.WebDriverException: Navigation failed with error code=3.
        //reloadPage()
        //pageSource.contains(EditedHomepageTitle) must be === true
        pending
      }

      "return to dashboard tab, find edited homepage title" in {
        close()
        switch to dashboardWindow
        pending // title currently not updated in page list :-(
      }
    }


    "create info page, but cancel" - {

      "open new page, via the Create... dropdown" in {
        clickCreateNewPage(PageRole.Any)
      }

      "close the new page tab, so no page is created" in {
        // Since the new page hasn't been edited, it'll vanish when it's closed.
        close()
        switch to dashboardWindow
      }

      "back in the dashboard, there must be no new page listed" in {
        findAll(cssSelector("#page-table > tbody > tr")).length must be === 1
      }
    }


    "create info page, edit it, add a comment" - {

      var newPageId = ""

      "open new page, via the Create... dropdown" in {
        newPageId = clickCreateNewPage(PageRole.Any)
      }

      "verify cannot post reply before body created?" in {
        pending
      }

      "edit title" - {
        clickAndEdit(Page.TitleId, newText = "Fat Rats Fear Cats")
      }

      "edit body" - {
        //clickAndEdit(Page.BodyId, newText = "Wise mice slice rice.")
      }

      "post reply" in {
        pending
      }

      "find the page listed in the dashboard" in {
        switch to dashboardWindow
        val newPageLink = s"a[href^='/-$newPageId']"
        findAll(cssSelector(s"#page-table > tbody > tr $newPageLink")
                ).length must be === 1
      }
    }


    "create blog, cancel" in {
      pending
    }


    "create blog, edit title, check admin page" in {
      pending
    }


    "create blog post, check admin page" in {
      pending
    }


    "create forum, cancel" in {
      pending
    }


    "create forum, publish, create topic" in {
      pending
    }


    "create forum, subforum, publish, create topic" in {
      pending
    }

  }

}

