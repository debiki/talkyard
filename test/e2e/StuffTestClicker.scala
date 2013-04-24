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


/**
 * Does stuff, e.g. logs in or edits a comment, by clicking on stuff
 * and sometimes typing stuff. All this stuff is done inside ScalaTest tests.
 */
trait StuffTestClicker {
  self: DebikiBrowserSpec =>

  private var knownWindowHandles = Set[String]()


  /**
   * Clicks e.g. Create... | New Blog, in the admin dashbar.
   * Switches to the new browser tab, with the new page.
   * Returns the id of the newly created (but not yet saved) page.
   */
  def clickCreateNewPage(pageRole: PageRole, suffix: String = null): String = {
    val (newPageLink, newPageTitlePart) = (pageRole, suffix) match {
      case (PageRole.Generic, _) => ("create-info-page", "New Page")
      case (PageRole.Blog, _) => ("create-blog", "Example Blog Post")
      case (PageRole.Forum, _) => ("create-forum", "New Forum")
      case (PageRole.Code, "css") => ("create-local-theme-style", "/themes/local/theme.css")
      case _ => fail(s"Bad page role: $pageRole")
    }

    click on cssSelector("#create-page-dropdown > .btn")
    click on newPageLink
    switchToNewlyOpenedWindow()
    eventually {
      pageSource.contains(newPageTitlePart) must be === true
    }
    waitForDashbar()

    findPageId()
  }


  /**
   * Returns the id of the new page.
   */
  // COULD place in a Blog page object? And return a BlogPost page object?
  def clickCreateBlogPost(): String = {
    // Sometimes the dashbar has not yet been loaded.
    eventually {
      click on cssSelector("a.create-blog-post")
    }
    waitForDashbar()
    // It takes a while for the new page to load.
    eventually {
      findPageId()
    }
  }


  def clickCreateForumTopic() {
    click on cssSelector(".dw-a-new-forum-topic")
    waitForDashbar()
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


  def openAndSwitchToFirstPage(pageTitle: String): WindowTarget = {
    // The Admin SPA does a network request to get a page listing.
    eventually {
      // Clicking the link opens a new browser tab.
      click on partialLinkText(pageTitle)
    }
    val window = switchToNewlyOpenedWindow()
    waitForDashbar()
    window
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


  def gotoDiscussionPage(pageUrl: String) {
    go to (new Page { val url = pageUrl })
    // Consider the page loaded when login/out links appear.
    eventually(Timeout(Span(10, Seconds))) {
      val loginLinkWebElem = find(loginLink)
      val logoutinkWebElem = find(logoutLink)
      assert(loginLinkWebElem.isDefined || logoutinkWebElem.isDefined)
    }
  }


  def clickReturnToParentForum() {
    val hadDashbar = isDashbarVisible
    click on cssSelector(".parent-forums-list > li:last-child a")
    if (hadDashbar)
      waitForDashbar()
  }


  def clickReturnToBlogMainPage() {
    // Sometimes the dashbar might not yet have been loaded; wait for it to appear.
    val returnLink = eventually {
      find(cssSelector(".return-to-blog")) getOrElse fail()
    }
    click on returnLink
    waitForDashbar()
    // Wait for the write-new-blog-post button to appear, which indicates that
    // we're back on the blog main page.
    eventually {
      find(cssSelector(".create-blog-post")) must not be None
    }
  }


  /**
   * Waits until the dashbar has been loaded. It's better to wait until it's been
   * loaded, because when it appears it pushes other elems on the page downwards,
   * and this sometimes makes `moveToElement(..., x, y).click()` fail (if the
   * dashbar appears just between the mouse movement and the mouse click).
   */
  private def waitForDashbar() {
    eventually {
      isDashbarVisible must be === true
    }
  }


  private def isDashbarVisible: Boolean = {
    find(cssSelector(".debiki-dashbar-logo")) != None
  }


  def scrollIntoView(obj: Any) {
    val webElem = obj match {
      case Some(elem: Element) => elem.underlying
      case elem: Element => elem.underlying
      case underlyingWebElem: org.openqa.selenium.WebElement => underlyingWebElem
      case query: Query => query.findElement.map(_.underlying) getOrElse fail()
      case id: String => find(id).map(_.underlying) getOrElse fail()
      case x: Any => fail(s"Don't know how to scroll a ${classNameOf(x)} into view")
    }
    (new Actions(webDriver)).moveToElement(webElem).perform()
  }


  def findActionLink(postId: String, actionLinkClass: String) = {
    // Is there no other way to find $postId's parent element, than using this
    // totally terrible XPath expression? (Note that o""" collapses the two lines
    // to One line with no space inbetween.)
    val query = o"""//div[@id='post-$postId']/../
      div[@class='dw-p-as dw-as']/a[@class='dw-a $actionLinkClass']"""
    val link = find(xpath(query)) getOrDie s"No $actionLinkClass link found for post $postId"
    link
  }


  private def loginLink = "dw-a-login"
  private def logoutLink = "dw-a-logout"

}

