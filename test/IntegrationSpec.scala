/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test

import org.openqa.selenium.WebDriver
import org.scalatest.{FreeSpec, BeforeAndAfterAll}
import org.scalatest.matchers.MustMatchers
import org.scalatest.selenium.WebBrowser
import org.scalatest.concurrent.{Eventually, ScaledTimeSpans}
import org.scalatest.time.{Span, Seconds, Millis}
import play.api.{test => pt}
import pt.Helpers.testServerPort
import com.debiki.v0.Prelude._


class BrowserSpec extends FreeSpec
  with WebBrowser
  with FailsOneFailAll with BeforeAndAfterAll with MustMatchers
  with Eventually with ScaledTimeSpans {


  lazy val testServer = pt.TestServer(testServerPort, pt.FakeApplication())
  implicit val webDriver: WebDriver = ChromeDriverFactory.createDriver()


  override def beforeAll() {
    testServer.start()
  }


  override def afterAll() {
    testServer.stop()
    //webDriver.quit() // quit browser
    ChromeDriverFactory.stop()
  }


  implicit override val patienceConfig = PatienceConfig(
    // Set long timeout so I can step through Scala code in the debugger.
    timeout = scaled(Span(999, Seconds)),
    interval = scaled(Span(100, Millis)))


  lazy val testPage = new Page {
    val url = s"localhost:$testServerPort/-3nnb9-new-page"
  }


  val replyText = "BrowserSpec reply to article."


  "A browser can" - {

    "open a test page, logout if logged in" in {
      go to testPage
      // Consider the page loaded when login/out links appear.
      eventually(Timeout(Span(10, Seconds))) {
        val loginLinkWebElem = find(loginLink)
        val logoutinkWebElem = find(logoutLink)
        assert(loginLinkWebElem.isDefined || logoutinkWebElem.isDefined)
      }
    }

    "reply, rate, edit as Anonymous, no email" - {
      logoutReplyRateEditAsAnon(name = s"Anon-${nextRandomString()}")
    }

    "reply, rate, edit as Anonymous, specify email directly" - {
      val name = s"anon-${nextRandomString()}"
      logoutReplyRateEditAsAnon(name, email = s"$name@example.com")
    }

    "reply, rate, edit as Anonymous, specify email later" - {
      val name = s"anon-${nextRandomString()}"
      logoutReplyRateEditAsAnon(name, email = s"$name@example.com", waitWithEmail = true)

      // But if I *do* specify an email address, theres' a bad XSRF token error!
    }

    "reply, rate, edit as Anonymous, specify email later, then change her mind" - {
      val name = s"anon-${nextRandomString()}"
      logoutReplyRateEditAsAnon(name, email = s"$name@example.com",
        waitWithEmail = true, waitWithEmailThenCancel = true)

      // But if I *do* specify an email address, theres' a bad XSRF token error!
    }
  }


  var replyFormSno = 0


  def logoutReplyRateEditAsAnon(
        name: String,
        email: String = "",
        waitWithEmail: Boolean = false,
        waitWithEmailThenCancel: Boolean = false) {

    val testText = s"replyRateEditAsAnon ${nextRandomString()}"

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
      eventually {
        click on "dw-fi-lgi-name"
      }

      enter(name)
      if (email.nonEmpty && !waitWithEmail) {
        click on "dw-fi-lgi-email"
        enter(email)
      }
      click on "dw-f-lgi-spl-submit"

      eventually {
        click on "dw-dlg-rsp-ok"
      }

      def noEmailBtn = cssSelector("label[for='dw-fi-eml-prf-rcv-no']")
      def yesEmailBtn = cssSelector("label[for='dw-fi-eml-prf-rcv-yes']")
      def submitBtn = "dw-fi-eml-prf-done"

      if (waitWithEmail) {
        eventually { click on yesEmailBtn }
        if (waitWithEmailThenCancel) {
          eventually { click on noEmailBtn }
        }
        else {
          eventually { click on "dw-fi-eml-prf-adr" }
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


  def logoutIfLoggedIn() {
    logout(mustBeLoggedIn = false)
  }


  def logout(mustBeLoggedIn: Boolean = true) {
    def isLoggedIn = find(logoutLink).map(_.isDisplayed) == Some(true)
    if (isLoggedIn) {
      click on logoutLink
      click on logoutSubmit
      eventually {
        isLoggedIn must be === false
      }
    }
    else if (mustBeLoggedIn) {
      fail("Not logged in; must be logged in")
    }
  }


  def articleReplyLink = cssSelector(".dw-hor-a > .dw-a-reply")
  def loginLink = "dw-a-login"
  def logoutLink = "dw-a-logout"
  def logoutSubmit = "dw-f-lgo-submit"

}


