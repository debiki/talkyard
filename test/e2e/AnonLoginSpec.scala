/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import com.debiki.v0.Prelude._
import com.debiki.v0.PageRole
import org.openqa.selenium.interactions.Actions
import org.scalatest.time.{Span, Seconds}
import org.scalatest.DoNotDiscover


/**
 * Runs the AnonLoginSpec suite, in SBT:  test-only test.e2e.AnonLoginSpecRunner
 */
@DoNotDiscover
class AnonLoginSpecRunner extends org.scalatest.Suites(new AnonLoginSpec {})
with ChromeSuiteMixin


/**
 * Tests anonymous user login, 1) by clicking Reply and logging in
 * when submitting, 2) by clicking Rate and logging in when rating,
 * and 3) via the "Log in" link,
 */
@DoNotDiscover
class AnonLoginSpec extends DebikiBrowserSpec {

  lazy val testPage = new Page {
    val url = createTestPage(PageRole.Generic,
      title = "Test Page Title 27KV09", body = Some("Test page text 953Ih31."))
  }

  "Anon user with a browser can" - {

    "open a test page" in {
      go to testPage
      // Consider the page loaded when login/out links appear.
      eventually(Timeout(Span(10, Seconds))) {
        val loginLinkWebElem = find(loginLink)
        val logoutinkWebElem = find(logoutLink)
        assert(loginLinkWebElem.isDefined || logoutinkWebElem.isDefined)
      }
    }

    "login and reply as new Anon User, specify no email" - {
      loginAndReplyAsAnon(name = s"Anon-${nextRandomString()}")
    }

    "login and reply as new Anon User, specify email directly" - {
      val name = s"anon-${nextRandomString()}"
      loginAndReplyAsAnon(name, email = s"$name@example.com")
    }

    "login and reply as new Anon User, specify email later" - {
      // Place this test after the `specify email directly` test just above,
      // to trigger bug#9kie35.
      val name = s"anon-${nextRandomString()}"
      loginAndReplyAsAnon(name, email = s"$name@example.com", waitWithEmail = true)
    }

    "login and reply as new Anon User, specify email later, then change her mind" - {
      val name = s"anon-${nextRandomString()}"
      loginAndReplyAsAnon(name, email = s"$name@example.com",
        waitWithEmail = true, waitWithEmailThenCancel = true)
    }

    "login and reply as existing Anon User with no email" in {
      pending
    }

    "login and reply as existing Anon User with email specified directly" in {
      pending
    }

    "login and reply as existing Anon User with email specified later" in {
      pending
    }

    "login and rate as new Anon User, specify no email" - {
      loginAndRateAsAnon(name = nextName())
    }

    "login and rate as new Anon User, specify email" - {
      val name = nextName()
      loginAndRateAsAnon(name, email = s"$name@example.com")
    }

    "login and rate as existing Anon User with no email" in {
      pending
    }

    "login and rate as existing Anon User with email specified" in {
      pending
    }

  }


  private def nextName() = s"Anon-${nextRandomString()}"

  private var replyFormSno = 0


  private def loginAndReplyAsAnon(
        name: String,
        email: String = "",
        waitWithEmail: Boolean = false,
        waitWithEmailThenCancel: Boolean = false) {

    val testText = s"ReplyAsAnon ${nextRandomString()}"

    "logout if needed" in {
      logoutIfLoggedIn()
    }

    "click Reply" in {
      eventually {
        click on articleReplyLink
      }
    }

    "write a reply" in {
      replyFormSno += 1
      val textAreaId = s"dw-fi-reply-text_sno-$replyFormSno"
      eventually {
        click on textAreaId
        enter(testText)
        textArea(textAreaId).value must be === testText
      }
    }

    "click Post as ..." in {
      eventually {
        click on cssSelector(".dw-fi-submit")
      }
    }

    "login and submit" in {
      loginAndSubmitReply(name, email, waitWithEmail, waitWithEmailThenCancel)
    }

    "view her new reply" in {
      eventually {
        val allPostBodies = findAll(cssSelector(".dw-p-bd"))
        val myNewPost = allPostBodies.find(_.text == testText)
        assert(myNewPost.nonEmpty)
      }
    }

    "logout" in {
      logout()
    }
  }


  private def loginAndRateAsAnon(
        name: String,
        email: String = "",
        waitWithEmail: Boolean = false,
        waitWithEmailThenCancel: Boolean = false) {

    "logout if needed" in {
      logoutIfLoggedIn()
    }

    "click Rate" in {
      eventually {
        scrollIntoView(visibleRateLink)
        click on visibleRateLink
      }
    }

    "select any rating tag" in {
      // Clicking the rate link (which we just did) opens a form, which automatically
      // scrolls into view. However, whilst it scrolls into view, clicking a
      // rating tag works, from Selenium's point of view, but the click does not
      // toggle the rating tag selected — so the submit button won't be enabled.
      // Therefore, click any rating tag again and again until eventually
      // the Submit button becomes enabled.
      eventually {
        click on anyRatingTag
        find(cssSelector(".dw-fi-submit")).map(_.isEnabled) must be === Some(true)
      }
    }

    "click Post as ..." in {
      eventually {
        click on cssSelector(".dw-fi-submit")
      }
    }

    "login and submit" in {
      loginAndSubmitRating(name, email)
    }

    "view her new rating" in {
      eventually {
        // Currently we're rating the same post over and over again,
        // so there'll be only 1 rating.
        val allRatingsByMe = findAll(cssSelector(".dw-p-r-by-me"))
        allRatingsByMe.length must be === 1
      }
    }

    "logout" in {
      logout()
    }
  }


  def loginAndSubmitRating(name: String, email: String = "") {
    eventually { click on "dw-fi-lgi-name" }
    enter(name)
    if (email.nonEmpty) {
      click on "dw-fi-lgi-email"
      enter(email)
    }
    click on "dw-f-lgi-spl-submit"
    eventually { click on "dw-dlg-rsp-ok" }
  }


  def loginAndSubmitReply(
        name: String,
        email: String = "",
        waitWithEmail: Boolean = false,
        waitWithEmailThenCancel: Boolean = false) {

    // The flow is similar to when we submit a rating, except that
    // after we've logged in, we're asked about email notifications
    // (since we actually submitted text, and we might be interested
    // in replies, even if we didn't care to specify any email earlier
    // in the original dialog).
    loginAndSubmitRating(
      name, if (waitWithEmail) "" else email)

    def noEmailBtn = cssSelector("label[for='dw-fi-eml-prf-rcv-no']")
    def yesEmailBtn = cssSelector("label[for='dw-fi-eml-prf-rcv-yes']")
    def submitBtn = "dw-fi-eml-prf-done"

    if (waitWithEmail) {
      eventually { click on yesEmailBtn }
      if (waitWithEmailThenCancel) {
        click on noEmailBtn
      }
      else {
        click on "dw-fi-eml-prf-adr"
        enter(email)
        click on submitBtn
      }
    }
    else if (email.nonEmpty) {
      eventually { click on yesEmailBtn }
    }
    else {
      eventually { click on noEmailBtn }
    }
  }


  def logoutIfLoggedIn() {
    logout(mustBeLoggedIn = false)
  }


  def logout(mustBeLoggedIn: Boolean = true) {
    def isLoggedIn = find(logoutLink).map(_.isDisplayed) == Some(true)
    if (isLoggedIn) {
      eventually {
        scrollIntoView(logoutLink)
        click on logoutLink
        //scrollIntoView(logoutSubmit)
        click on logoutSubmit
      }
      eventually {
        isLoggedIn must be === false
      }
    }
    else if (mustBeLoggedIn) {
      fail("Not logged in; must be logged in")
    }
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


  def articleReplyLink = cssSelector(".dw-hor-a > .dw-a-reply")
  def loginLink = "dw-a-login"
  def logoutLink = "dw-a-logout"
  def logoutSubmit = "dw-f-lgo-submit"

  def visibleRateLink = cssSelector("#dw-p-as-shown .dw-a-rate")
  def anyRatingTag = cssSelector(".dw-r-tag-set > .ui-button > .ui-button-text")

}


