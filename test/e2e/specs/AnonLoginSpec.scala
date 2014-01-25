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

package test.e2e.specs

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.PageRole
import org.openqa.selenium.interactions.Actions
import org.scalatest.time.{Span, Seconds}
import org.scalatest.DoNotDiscover
import test.e2e.code._


/** Runs the AnonLoginSpec suite
  * in SBT:  test-only test.e2e.specs.AnonLoginSpecRunner
  * In test:console:  (new test.e2e.specs.AnonLoginSpecRunner).execute()
  */
@DoNotDiscover
class AnonLoginSpecRunner extends org.scalatest.Suites(new AnonLoginSpec)
with StartServerAndChromeDriverFactory


/** Runs the AnonLoginSpecForEmbeddedComments suite
  * in SBT:  test-only test.e2e.specs.AnonLoginSpecForEmbeddedCommentsRunner
  * In test:console:  (new test.e2e.specs.AnonLoginSpecForEmbeddedCommentsRunner).execute()
  */
@DoNotDiscover
class AnonLoginSpecForEmbeddedCommentsRunner
  extends org.scalatest.Suites(new AnonLoginSpecForEmbeddedComments)
with StartServerAndChromeDriverFactory


@test.tags.EndToEndTest
@DoNotDiscover
class AnonLoginSpec extends AnonLoginSpecConstructor(iframe = false) {

  lazy val testPage = createTestPage(PageRole.Generic,
    title = "Test Page Title 27KV09", body = Some("Test page text 953Ih31."))

}


@test.tags.EndToEndTest
@DoNotDiscover
class AnonLoginSpecForEmbeddedComments extends AnonLoginSpecConstructor(iframe = true) {

  lazy val testPage = {
    ensureFirstSiteCreated()
    new TestPage(url = "http://mycomputer:8080/embeds-localhost-topic-id-1001.html", id = "???")
  }

}


/**
 * Tests anonymous user login, 1) by clicking Reply and logging in
 * when submitting, 2) by clicking Rate and logging in when rating,
 * and 3) via the "Log in" link,
 */
abstract class AnonLoginSpecConstructor(val iframe: Boolean)
  extends DebikiBrowserSpec with TestReplyer with TestLoginner {

  def testPage: TestPage

  def randomId() = nextRandomString() take 5

  "Anon user with a browser can" - {

    if (iframe) {
      "remember embedded comments window handle and frame no" in {
        embeddedCommentsWindowAndFrame = Some((webDriver.getWindowHandle(), 0))
      }
    }

    "open a test page" in {
      gotoDiscussionPage(testPage.url)
    }

    "login and reply as new Anon User, specify no email" - {
      loginAndReplyAsAnon(name = s"Anon-${randomId()}")
    }

    "login and reply as new Anon User, specify email" - {
      val name = s"anon-${randomId()}"
      loginAndReplyAsAnon(name, email = s"$name@example.com")
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
      loginAndRateAsAnon(name = nextName(), postId = 1)
    }

    "login and rate as new Anon User, specify email" - {
      val name = nextName()
      loginAndRateAsAnon(name, email = s"$name@example.com", postId = 1)
    }

    "login and rate as existing Anon User with no email" in {
      pending
    }

    "login and rate as existing Anon User with email specified" in {
      pending
    }

  }


  private def nextName() = s"Anon-${randomId()}"


  private def loginAndReplyAsAnon(name: String, email: String = "") {

    val testText = s"ReplyAsAnon ${randomId()}"

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
      submitGuestLogin(name, email)
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


  private def loginAndRateAsAnon(name: String, email: String = "", postId: PostId) {

    "logout if needed" in {
      logoutIfLoggedIn()
    }

    "click Rate" in {
      eventually {
        showActionLinks(postId)
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
      submitGuestLogin(name, email)
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


