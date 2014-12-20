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
class AnonLoginSpecRunner extends org.scalatest.Suites(new AnonLoginSpec)
with StartServerAndChromeDriverFactory


/** Runs the AnonLoginSpecForEmbeddedComments suite
  * in SBT:  test-only test.e2e.specs.AnonLoginSpecForEmbeddedCommentsRunner_NothingPreLoaded
  * In test:console:  (new test.e2e.specs.AnonLoginSpecForEmbeddedCommentsRunner).execute()
  */
class AnonLoginSpecForEmbeddedCommentsRunner_NothingPreLoaded
  extends org.scalatest.Suites(new AnonLoginSpecForEmbeddedComments_NothingPreLoaded)
with StartServerAndChromeDriverFactory


/** Runs the AnonLoginSpecForEmbeddedComments suite, with various
  * combinations of jQuery and Modernizr pre loaded by the static HTML
  * page itself. Then Debiki isn't supposed to also load those libs.
  *
  * in SBT:
  *   test-only test.e2e.specs.AnonLoginSpecForEmbeddedCommentsRunner_jQueryModernizrPreLoaded
  * In test:console:
  *   (new test.e2e.specs.AnonLoginSpecForEmbeddedCommentsRunner_jQueryModernizrPreLoaded).execute()
  */
class AnonLoginSpecForEmbeddedCommentsRunner_jQueryModernizrPreLoaded
  extends org.scalatest.Suites(
    new AnonLoginSpecForEmbeddedComments_jQuery21PreLoaded,
    new AnonLoginSpecForEmbeddedComments_Modernizr27PreLoaded,
    new AnonLoginSpecForEmbeddedComments_jQuery21AndModernizr27PreLoaded,
    new AnonLoginSpecForEmbeddedComments_jQuery17AndModernizr25PreLoaded)
  with StartServerAndChromeDriverFactory


@test.tags.EndToEndTest
@DoNotDiscover
class AnonLoginSpec extends AnonLoginSpecConstructor(quick = false) {
  lazy val testPageUrl = createTestPage(PageRole.WebPage,
    title = "Test Page Title 27KV09", body = Some("Test page text 953Ih31.")).url
}


@test.tags.EndToEndTest
@DoNotDiscover
class AnonLoginSpecForEmbeddedComments_NothingPreLoaded
  extends AnonLoginSpecForEmbeddedComments(
    "embeds-localhost-topic-id-1001.html", quick = false)

@test.tags.EndToEndTest
@DoNotDiscover
class AnonLoginSpecForEmbeddedComments_jQuery21PreLoaded
  extends AnonLoginSpecForEmbeddedComments(
    "embeds-localhost-topic-id-1001-jquery-2.1-pre-loaded.html", quick = true)

@test.tags.EndToEndTest
@DoNotDiscover
class AnonLoginSpecForEmbeddedComments_Modernizr27PreLoaded
  extends AnonLoginSpecForEmbeddedComments(
    "embeds-localhost-topic-id-1001-modernizr-2.7-pre-loaded.html", quick = true)

@test.tags.EndToEndTest
@DoNotDiscover
class AnonLoginSpecForEmbeddedComments_jQuery21AndModernizr27PreLoaded
  extends AnonLoginSpecForEmbeddedComments(
    "embeds-localhost-topic-id-1001-jquery-2.1-and-modernizr-2.7-pre-loaded.html", quick = true)

@test.tags.EndToEndTest
@DoNotDiscover
class AnonLoginSpecForEmbeddedComments_jQuery17AndModernizr25PreLoaded
  extends AnonLoginSpecForEmbeddedComments(
    "embeds-localhost-topic-id-1001-jquery-1.7-and-modernizr-2.5-pre-loaded.html", quick = true)


class AnonLoginSpecForEmbeddedComments(val pageUrlPath: String, quick: Boolean)
    extends AnonLoginSpecConstructor(quick = quick) {
  lazy val testPageUrl = {
    ensureFirstSiteCreated()
    rememberEmbeddedCommentsIframe()
    s"http://mycomputer:8080/$pageUrlPath"
  }
}


/**
 * Tests anonymous user login, 1) by clicking Reply and logging in
 * when submitting, 2) by clicking Rate and logging in when rating,
 * and 3) via the "Log in" link,
 */
abstract class AnonLoginSpecConstructor(val quick: Boolean)
  extends DebikiBrowserSpec with TestReplyer with TestLoginner {

  def testPageUrl: String

  def randomId() = nextRandomString() take 5

  "Anon user with a browser can" - {

    "open a test page" in {
      gotoDiscussionPageAndFakeNewIp(testPageUrl)
    }

    "login and reply as new Anon User, specify no email" - {
      loginAndReplyAsAnon(name = s"Anon-${randomId()}")
    }

    if (!quick) {
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
    }
  }


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

}


