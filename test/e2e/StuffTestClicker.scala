/**
 * Copyright (c) 2013 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import org.openqa.selenium.Keys
import com.debiki.v0.PageRole
import play.api.test.Helpers.testServerPort
import com.debiki.v0.Prelude._


/**
 * Does stuff, e.g. logs in or edits a comment, by clicking on stuff
 * and sometimes typing stuff. All this stuff is done inside ScalaTest tests.
 */
trait StuffTestClicker {
  self: DebikiBrowserSpec =>

  private var nextWebsiteId = 0
  private var firstGmailLogin = true
  private var knownWindowHandles = Set[String]()


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

    if (firstGmailLogin) {
      firstGmailLogin = false
      // 1. I've created a dedicated Gmail OpenID test account, see below.
      // 2. `enter(email)` throws: """Currently selected element is neither
      // a text field nor a text area""", in org.scalatest.selenium.WebBrowser,
      // so use `pressKeys` instead.
      click on "Email"
      pressKeys("debiki.tester@gmail.com")
      click on "Passwd"
      pressKeys("ZKFIREK90krI38bk3WK1r0")
      click on "signIn"
    }

    // Now Google should show another page, which ask about permissions.
    // Uncheck a certain remember choices checkbox, or this page won't be shown
    // next time (and then we cannot choose to deny access).
    click on "remember_choices_checkbox"

    if (approvePermissions)
      click on "approve_button"
    else
      click on "reject_button"
  }


  /**
   * Clicks e.g. Create... | New Blog, in the admin dashbar.
   * Switches to the new browser tab, with the new page.
   * Returns the id of the newly created (but not yet saved) page.
   */
  def clickCreateNewPage(pageRole: PageRole): String = {
    val (newPageLink, newPageTitlePart) = pageRole match {
      case PageRole.Any => ("create-info-page", "New Page")
      case PageRole.Blog => ("create-blog", "Example Blog Post")
      case PageRole.Forum => ("create-forum", "New Forum")
      case _ => fail(s"Bad page role: $pageRole")
    }

    click on cssSelector("#create-page-dropdown > .btn")
    click on newPageLink
    switchToNewlyOpenedWindow()
    eventually {
      pageSource.contains(newPageTitlePart) must be === true
    }

    findPageId()
  }


  /**
   * Returns the id of the new page.
   */
  // COULD place in a Blog page object? And return a BlogPost page object?
  def clickCreateBlogPost(): String = {
    click on cssSelector("a.create-blog-post")
    switchToNewlyOpenedWindow()
    // It takes a while for the new page to load.
    eventually {
      findPageId()
    }
  }


  def findPageId(): String = {
    val anyPageElem = eventually {
      find(cssSelector(".dw-page"))
    }
    val anyPageIdAttr = anyPageElem.flatMap(_.attribute("id"))
    val pageId = anyPageIdAttr match {
      case Some(id) => id.drop(5) // drop "page-"
      case None => fail("No .dw-page with an id attribute found")
    }
    pageId
  }


  /**
   * Clicks on the specified post, selects Improve in the inline menu,
   * edits the post and verifies that the changes were probably saved.
   */
  def clickAndEdit(postId: String, newText: String) {
    //s"click #post-$postId, select Improve" in {
      eventually {
        // (The inline menu disappears after 1 second or so, which
        // breaks the test if I place a breakpoint on the 2nd line here,
        // unless wrapped in `eventually`.)
        click on cssSelector(s"#post-$postId .dw-p-bd-blk")
        click on cssSelector(".dw-a-edit-i")
      }
    //}

    val prettyNewText = {
      val firstLine = newText.takeWhile(0 < _ - ' ')
      if (firstLine.length <= 50) firstLine
      else firstLine.take(47) + "..."
    }

    //s"edit text to: ``$prettyNewText''" in {
      // Wait for network request that loads editor data.
      // Then focus editor and send keys.
      // ((It doesn't seem possible to click on CodeMirror. But using `sendKeys`
      // directly works. Alternatively, executing this JS string:
      //   driver.asInstanceOf[JavascriptExecutor].executeScript(
      //      """window.editor.setValue("Hello");""")
      // is also supposed to work, see e.g.:
      //   https://groups.google.com/forum/?fromgroups=#!topic/webdriver/Rhm-NZRBgXY ))
      eventually {
        find(cssSelector(".CodeMirror textarea")).map(_.underlying) match {
          case None =>
            // Try again later; editor loaded via Ajax request.
            fail()
          case Some(textarea) =>
            // Select all current text.
            textarea.sendKeys(Keys.chord(Keys.SHIFT, Keys.END))
            // Overwrite selecetd text.
            textarea.sendKeys(newText)
        }
      }
    //}

    //"click preview, then submit" in {
      // The edit tab id ends with a serial number, which depends on how
      // many edit forms have already been opened. So match only on the
      // start of the edit tab id.
      click on cssSelector(s"#post-$postId a[href^='#dw-e-tab-prvw_sno-']")
      click on cssSelector(s"#post-$postId .dw-f-e .dw-fi-submit")
    //}

    //"find new text in page source" in {
      eventually {
        //pageSource.contains(newText) must be === true
        find(cssSelector(s"#post-$postId .dw-p-bd")).map(_.text) must be === Some(newText)
      }
    //}
  }


  /**
   * Switches to some (any) newly opened browser window/tab, or fails the
   * current test. Returns a handle to that new window/tab.
   */
  def switchToNewlyOpenedWindow(): WindowTarget = {
    knownWindowHandles += webDriver.getWindowHandle()
    import collection.JavaConversions._
    val newHandle = webDriver.getWindowHandles.toList find {
      handle => !knownWindowHandles.contains(handle)
    } getOrElse {
      fail(s"No new handle to switch to; all handles: $knownWindowHandles")
    }
    webDriver.switchTo().window(newHandle)
    knownWindowHandles += newHandle
    window(newHandle)
  }


  def originOf(newSiteName: String) =
    s"http://$newSiteName.localhost:$testServerPort"

}

