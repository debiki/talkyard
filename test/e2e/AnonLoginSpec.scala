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
class AnonLoginSpec extends DebikiBrowserSpec with TestReplyer with TestLoginner {

  lazy val testPageUrl = createTestPage(PageRole.Generic,
      title = "Test Page Title 27KV09", body = Some("Test page text 953Ih31."))


  "Anon user with a browser can" - {

    "open a test page" in {
      gotoDiscussionPage(testPageUrl)
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
      clickArticleReplyLink()
    }

    "write a reply" in {
      writeReply(testText)
    }

    "click Post as ..." in {
      clickPostReply()
    }

    "login and submit" in {
      submitGuestLoginAnswerEmailQuestion(name, email, waitWithEmail, waitWithEmailThenCancel)
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
      submitGuestLoginNoEmailQuestion(name, email)
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


  def visibleRateLink = cssSelector("#dw-p-as-shown .dw-a-rate")
  def anyRatingTag = cssSelector(".dw-r-tag-set > .ui-button > .ui-button-text")

}


