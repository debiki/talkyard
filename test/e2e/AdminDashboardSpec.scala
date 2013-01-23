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
import com.debiki.v0.PageRole.BlogMainPage


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

      "edit homepage body (broken, inline menu won't appear)" in {
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


    "create pages, but cancel" - {

      "create info page, but cancel" - {
        createButCancel(PageRole.Any)
      }

      "create blog, but cancel" - {
        createButCancel(PageRole.BlogMainPage)
      }

      "create forum, but cancel" - {
        createButCancel(PageRole.ForumMainPage)
      }

      def createButCancel(pageRole: PageRole) {
        "open new page via Create... dropdown" in {
          clickCreateNewPage(pageRole)
        }

        "close the new page tab, without editing and saving page" in {
          // Since the new page hasn't been edited, it'll vanish when it's closed.
          close()
          switch to dashboardWindow
        }

        "back in the dashboard, there must be no new page listed" in {
          // Only the homepage (1 page) must be listed.
          findAll(cssSelector("#page-table > tbody > tr")).length must be === 1
        }
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

      "edit body (broken, inline menu won't appear)" in {
        //clickAndEdit(Page.BodyId, newText = "Wise mice slice rice.")
        pending
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


    "create blog, edit title, check admin page" in {
      pending
    }


    "create blog post, check admin page" in {
      pending

    "create blog, create blog post, then save blog post before blog main page" - {

      val BlogPostTitle = "Blog Post Title 3905Kf3"
      val BlogPostBody = "Blog post body 53IKF3"
      var blogMainPageWindow: WindowTarget = null
      var blogMainPageId = "?"
      var blogPostId = "?"

      "create blog" in {
        blogMainPageId = clickCreateNewPage(PageRole.BlogMainPage)
        blogMainPageWindow = window(webDriver.getWindowHandle)
      }

      "create blog post" in {
        blogPostId = clickCreateBlogPost()
      }

      "edit blog post title" - {
        clickAndEdit(Page.TitleId, BlogPostTitle)
      }

      "edit blog post body (broken, inline menu won't appear)" in {
        // Clicking the body doesn't cause the inline menu to appear, don't know why.
        // clickAndEdit(Page.BodyId, BlogPostBody)
        pending
      }

      "close blog post" in {
        close()
        switch to blogMainPageWindow
      }

      "find blog post title on blog main page" in {
        // Currently one has to reload this page for the blog post to appear.
        pending // pageSource.contains(BlogPostTitle) must be === true
      }

      "close blog main page" in {
        close()
        switch to dashboardWindow
      }

      "on dashboard page" - {
        "find blog post" in {
          pageSource.contains(BlogPostTitle) must be === true
        }

        "find blog main page" in {
          // Search for a certain CSS class, since the blog main page title is
          // probably something like "Blog" which woulud match the blog post
          // title too.
          pageSource.contains("page-role-BlogMainPage") must be === true
        }
      }
    }


    "create forum, publish, create topics" in {
      pending
    }


    "create forum, publish, create subforum" in {
      pending
    }


    "create and save forum, create and save subforum, create and save topic" in {
      pending
    }


    "create forum and topic, but save topic first" in {
      pending
    }


    "create forum, subforum and topic, but save topic first" in {
      pending
    }
  }

}

