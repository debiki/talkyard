/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test

import org.scalatest.time.{Span, Seconds}
import org.scalatest.DoNotDiscover
import com.debiki.v0.Prelude._


/**
 * Tests anonymous user login, 1) by clicking Reply and logging in
 * when submitting, 2) by clicking Rate and logging in when rating,
 * and 3) via the "Log in" link,
 */
// From ScalaTest 2.0-M5 and above, use this: `@org.scalatest.DoNotDiscover`
// instead of `abstract`.
abstract class AnonLoginSpec extends DebikiBrowserSpec {

  "A browser can" - {

    "open a test page" in {
      go to testPage
      // Consider the page loaded when login/out links appear.
      eventually(Timeout(Span(10, Seconds))) {
        val loginLinkWebElem = find(loginLink)
        val logoutinkWebElem = find(logoutLink)
        assert(loginLinkWebElem.isDefined || logoutinkWebElem.isDefined)
      }
    }

    "login and reply as Anonymous, specify no email" - {
      loginAndReplyAsAnon(name = s"Anon-${nextRandomString()}")
    }

    "login and reply as Anonymous, specify email directly" - {
      val name = s"anon-${nextRandomString()}"
      loginAndReplyAsAnon(name, email = s"$name@example.com")
    }

    "login and reply as Anonymous, specify email later" - {
      // Place this test after the `specify email directly` test just above,
      // to trigger bug#9kie35.
      val name = s"anon-${nextRandomString()}"
      loginAndReplyAsAnon(name, email = s"$name@example.com", waitWithEmail = true)
    }

    "login and reply as Anonymous, specify email later, then change her mind" - {
      val name = s"anon-${nextRandomString()}"
      loginAndReplyAsAnon(name, email = s"$name@example.com",
        waitWithEmail = true, waitWithEmailThenCancel = true)
    }

    /*
    "login and rate as Anonymous, specify no email" - {
      loginAndRateAsAnon(name = nextName())
    }

    "login and rate as Anonymous, specify email directly" - {
      val name = nextName()
      loginAndRateAsAnon(name, email = s"$name@example.com")
    }

    "login and rate as Anonymous, specify email later" - {
      val name = nextName()
      loginAndRateAsAnon(name, email = s"$name@example.com", waitWithEmail = true)
    }

    "login and rate as Anonymous, specify email later, then change her mind" - {
    */

  }


  private def nextName() = s"Anon-${nextRandomString()}"

  private var replyFormSno = 0


  private def loginAndReplyAsAnon(
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


