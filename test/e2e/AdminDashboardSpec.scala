/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import com.debiki.v0.{PageParts, PageRole}
import com.debiki.v0.Prelude._
import java.{lang => jl}
import org.scalatest.DoNotDiscover


/**
 * Runs the CreateSiteSpec suite
 * in SBT:
 *  test-only test.e2e.AdminDashboardRunner
 * in SBT's test:console:
 *  (new test.e2e.AdminDashboardRunner {}).execute()
 */
@DoNotDiscover
class AdminDashboardRunner extends org.scalatest.Suites(
  new AdminDashboardSpec {})
  with ChromeSuiteMixin


/**
 * Tests the admin ashboard, /-/admin/.
 */
@DoNotDiscover
abstract class AdminDashboardSpec extends DebikiBrowserSpec
  with TestSiteCreator with TestEditor {

  val EditedHomepageTitle = "Edited Homepage Title"
  val EditedHomepageBody = "Edited homepage body."

  var siteName = ""
  var dashboardWindow: WindowTarget = null


  "Via the admin dashboarad, one can create and edit pages" - {


    "create new site" - {
      siteName = clickCreateSite()
    }


    "go to admin dashboard, login as admin" in {
      click on partialLinkText("administration page")
      clickLoginWithGmailOpenId()
      dashboardWindow = window(webDriver.getWindowHandle)
    }


    "edit homepage" - {

      "open homepage" in {
        openAndSwitchToFirstPage(DefaultHomepageTitle)
      }

      "edit homepage title" in {
        clickAndEdit(PageParts.TitleId, newText = EditedHomepageTitle)
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
        //pageSource must include (EditedHomepageTitle)
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
        createButCancel(PageRole.Generic)
      }

      "create blog, but cancel" - {
        createButCancel(PageRole.Blog)
      }

      "create forum, but cancel" - {
        createButCancel(PageRole.Forum)
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
          // Only the homepage and _site.conf (2 pages) must be listed.
          findAll(cssSelector("#page-table > tbody > tr")).length must be === 2
        }
      }
    }


    "create info page, edit, publish, add comment, find in dashboard" - {
      var newPageId = ""

      "open new page, via the Create... dropdown" in {
        newPageId = clickCreateNewPage(PageRole.Generic)
      }

      "verify cannot post reply before body created?" in {
        pending
      }

      "edit title" in {
        // Clicking the Improve button fails, don't know why!??
        clickAndEdit(PageParts.TitleId, newText = "Info Page Title")
      }

      "edit body (broken, inline menu won't appear)" in {
        //clickAndEdit(Page.BodyId, newText = "Info page body.")
        pending
      }

      "publish, via dashbar Publish button" in {
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


    "create info page, publish via dashboard" in {
      pending
    }


    "create blog, create blog post, find unpublished, publish via dashbar" - {

      val BlogPostTitle = "Blog Post Title 3905Kf3"
      val BlogPostBody = "Blog post body 53IKF3"
      var blogWindow: WindowTarget = null
      var blogMainPageId = "?"
      var blogPostId = "?"

      "create blog" in {
        blogMainPageId = clickCreateNewPage(PageRole.Blog)
        blogWindow = window(webDriver.getWindowHandle)
      }

      "create blog post" in {
        blogPostId = clickCreateBlogPost()
      }

      "edit blog post title" in {
        clickAndEdit(PageParts.TitleId, BlogPostTitle)
      }

      "edit blog post body (broken, inline menu won't appear)" in {
        // Clicking the body doesn't cause the inline menu to appear, don't know why.
        // clickAndEdit(Page.BodyId, BlogPostBody)
        pending
      }

      "find unpublished blog post info on blog main page" in {
        clickReturnToBlogMainPage()
        pageSource must include("Unpublished Blog Post")
      }

      "publish blog post" in {
        click on partialLinkText("admin page")
        eventually {
          click on cssSelector(".page-role-BlogPost .row-selector input[type='checkbox']")
        }
        click on "publish-page-btn"
        click on cssSelector("a[href='/blog/']")
        switchToNewlyOpenedWindow()

        /*
        click on linkText("Unpublished Blog Post") — but link is dead
        click on cssSelector(".publish-page")
        eventually {
          find(cssSelector(".unpublish-page")) must not be 'empty
        } */
      }

      "find blog post title on blog main page" in {
        pageSource must include(BlogPostTitle)
      }

      "on dashboard page" - {
        "find blog post" in {
          switch to dashboardWindow
          pageSource must include (BlogPostTitle)
        }

        "find blog main page" in {
          // Search for a certain CSS class, since the blog main page title is
          // probably something like "Blog" which woulud match the blog post
          // title too.
          pageSource must include ("page-role-Blog")
        }
      }
    }


    "create forum, edit title, create topic, edit title" - {
      createForumAndTopicTest(
        forumMainPageTitle = "Forum Main Page 26GJf3",
        forumTopicTitle = "Forum Topic Title RE0512",
        saveTopicFirst = false)
    }


    "create forum, create topic, edit topic first" - {
      createForumAndTopicTest(
        forumMainPageTitle = "Forum Main Page 74XIkw2",
        forumTopicTitle = "Forum Topic Title 901RE1",
        saveTopicFirst = true)
    }


    def createForumAndTopicTest(
      forumMainPageTitle: String,
      forumTopicTitle: String,
      saveTopicFirst: Boolean) {

      var forumMainPageId: String = "?"
      var forumWindow: WindowTarget = null

      "create forum" in {
        forumMainPageId = clickCreateNewPage(PageRole.Forum)
        forumWindow = window(webDriver.getWindowHandle)
      }

      if (!saveTopicFirst)
        editForumTitle()

      "create topic" in {
        clickCreateForumTopic()
      }

      "edit topic title" in {
        clickAndEdit(PageParts.TitleId, forumTopicTitle)
      }

      "find topic listed on forum main page" in {
        clickReturnToParentForum()
        pending
      }

      if (saveTopicFirst)
        editForumTitle()

      "close forum page" in {
        close
        switch to dashboardWindow
      }

      "find forum and topic listed on dashboard page" in {
        pageSource must include (forumMainPageTitle)
        pageSource must include (forumTopicTitle)
      }

      def editForumTitle() {
        "edit forum title" in {
          clickAndEdit(PageParts.TitleId, forumMainPageTitle)
        }
      }
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

