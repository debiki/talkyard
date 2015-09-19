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

import com.debiki.core.PageRole
import com.debiki.core.Prelude._
import com.debiki.core.{ActionId, PostId}
import org.openqa.selenium.Keys
import org.openqa.selenium.interactions.Actions
import StuffTestClicker.currentFakeIpNr


/**
 * Does stuff, e.g. logs in or edits a comment, by clicking on stuff
 * and sometimes typing stuff. All this stuff is done inside ScalaTest tests.
 */
trait StuffTestClicker extends DebikiSelectors {
  self: DebikiBrowserSpec =>

  private var knownWindowHandles = Set[String]()


  /**
   * Clicks e.g. Create... | New Blog, in the admin dashbar.
   * Switches to the new browser tab, with the new page.
   * Returns the id of the newly created (but not yet saved) page.
   */
  def clickCreateNewPage(pageRole: PageRole, suffix: String = null): String = {
    val (newPageLink, newPageTitlePart) = (pageRole, suffix) match {
      case (PageRole.WebPage, _) => ("create-info-page", "New Page")
      case (PageRole.Blog, _) => ("create-blog", "Example Blog Post")
      case (PageRole.Forum, _) =>
        fail("Subsequent tests will fail, after I changed ForumGroup+Forum to Forum+ForumCategory")
        // not tested: ("create-forum", "New Forum")
      case (PageRole.Category, _) =>
        fail("Subsequent tests will fail, after I changed ForumGroup+Forum to Forum+ForumCategory")
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


  def openAndSwitchToFirstPage(pageTitle: String, newTab: Boolean = false): WindowTarget = {
    // The Admin SPA does a network request to get a page listing.
    eventually {
      if (!newTab) {
        click on partialLinkText(pageTitle)
      }
      else {
        // In Firefox and Chrome, control-clicking apparently opens link in new tab.
        val elem = find(partialLinkText(pageTitle)) getOrElse fail()
        (new Actions(webDriver))
          .moveToElement(elem.underlying)
          .keyDown(Keys.CONTROL)
          .click()
          .keyUp(Keys.CONTROL)
          .perform()
      }
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


  /** Opens the specified URL, and fakes a new unique IP number, to prevent errors
    * related to running out of per IP quota and issues with comments hidden because
    * they're pending moderation.
    */
  def gotoDiscussionPageAndFakeNewIp(pageUrl: String) {
    go to (new Page { val url = pageUrl })
    switchToAnyEmbeddedCommentsIframe()
    // Consider the page loaded when login/out links appear.
    waitForLoginLinks()

    // This cannot be done until after the URL has been opened (above), or Chrome
    // throws an error: "Cookies are disabled inside 'data:' URLs".
    fakeNewIp()
  }


  def reloadPageAndFakeNewIp() {
    reloadPage()
    switchToAnyEmbeddedCommentsIframe()
    waitForLoginLinks()
    fakeNewIp()
  }


  def reloadPageWaitForLoginLinks() {
    reloadPage()
    switchToAnyEmbeddedCommentsIframe()
    waitForLoginLinks()
  }


  private def waitForLoginLinks() {
    eventually {
      val loginLinkWebElem = find(AnyLoginLink)
      val logoutinkWebElem = find(AnyLogoutLink)
      assert(loginLinkWebElem.isDefined || logoutinkWebElem.isDefined)
    }
  }


  def fakeNewIp() {
    // Add/update the magic fake IP cookie.
    add cookie ("dwCoFakeIp", s"0.0.0.$currentFakeIpNr")
    currentFakeIpNr += 1
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


  def clickGotoModerationPage() {
    val dashboardLink = cssSelector("a[href*='/-/admin']")
    scrollIntoView(dashboardLink)
    click on dashboardLink
    click on linkText("Moderation")
  }


  def clickGoBackToSite() {
    click on partialLinkText("Return to site")
    reloadPageWaitForLoginLinks()
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


  /** Fakes a mouseenter event that results in the "Reply, Like?, More..." links
    * being shown, for postId.
    */
  def showActionLinks(postId: ActionId) = {
    // For whatever reasons, `mouse.moveMouse` and `Actions.moveToElement` doesn't
    // trigger the hover event that makes the More... menu visible, so it can be
    // clicked. Instead, fire the hover event "manually":
    // (I'll break out a reusable function... later on.)
    executeScript(i"""
      jQuery('#post-$postId').trigger('mouseenter');
      """)

    // TODO: Wait until element actually visible?
    // There was an ElementNotVisibleException in TestRater.rateComment.

    // More details on how I failed to trigger the on hover event. This didn't work:
    //   val mouse = (webDriver.asInstanceOf[HasInputDevices]).getMouse
    //   val hoverItem: Locatable = moreLink.underlying.asInstanceOf[Locatable]
    //   mouse.mouseMove(hoverItem.getCoordinates)
    // Neither did this:
    //   (new Actions(webDriver)).moveToElement(moreLink.underlying).perform()
  }


  def clickShowMoreActions(postId: PostId) {
    showActionLinks(postId)
    val moreLink = findActionLink_!(postId, "dw-a-more")
    scrollIntoView(moreLink)
    click on moreLink
  }


  def findPost(postId: ActionId): Option[Element] = {
    find(s"post-$postId")
  }


  def isPostApproved(postId: ActionId): Boolean = {
    find(cssSelector(s"#post-$postId .dw-p-pending-mod")).isEmpty
  }


  def isPostDeleted(postId: PostId): Boolean = {
    find(cssSelector(s"#post-$postId.dw-p-dl")).nonEmpty
  }


  def findActionLink_!(postId: ActionId, actionLinkClass: String): Element = {
    findActionLink(postId, actionLinkClass) getOrDie
        s"No $actionLinkClass link found for post $postId [DwE485EF0]"
  }


  def findActionLink(postId: ActionId, actionLinkClass: String): Option[Element] = {
    // Is there no other way to find $postId's parent element, than using XPath?
    val query =
      // Find parent post:
      s"//div[@id='post-$postId']/../" +
      // Find action links: (use `contains` since "unknown" classes might have been added)
      "div[contains(concat(' ', @class, ' '), ' dw-p-as ')]" +
      // Find one specific action link:
      s"//a[contains(concat(' ', @class, ' '), ' $actionLinkClass ')]"
    find(xpath(query))
  }

}



object StuffTestClicker {

  private var currentFakeIpNr = 1

}
