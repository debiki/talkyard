/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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
import com.debiki.core.PageParts.NoId
import com.debiki.core.Prelude._
import com.debiki.core.PageRole
import com.debiki.core.{PostActionPayload => PAP}
import org.scalatest.DoNotDiscover
import test.e2e.code._


/** Runs the InterestingFirstSpecRunner suite
  * in SBT:  test-only test.e2e.specs.InterestingFirstSpecRunner
  * In test:console:  (new test.e2e.specs.VoteSpecRunner).execute()
  */
class InterestingFirstSpecRunner extends org.scalatest.Suites(new InterestingFirstSpec)
  with StartServerAndChromeDriverFactory


/** Runs the InterestingFirstSpecEmbeddedRunner suite
  * in SBT:  test-only test.e2e.specs.InterestingFirstSpecEmbeddedRunner
  * In test:console:  (new test.e2e.specs.InterestingFirstSpecEmbeddedRunner).execute()
  */
class InterestingFirstSpecEmbeddedRunner
  extends org.scalatest.Suites(new InterestingFirstSpecEmbedded)
  with StartServerAndChromeDriverFactory



@test.tags.EndToEndTest
@DoNotDiscover
class InterestingFirstSpec
  extends InterestingFirstSpecConstructor(iframe = false) {
  lazy val testPageUrl = createTestPage(PageRole.WebPage,
    title = "Test Page Title 27KV09", body = Some("Test page text 953Ih31.")).url
}


@test.tags.EndToEndTest
@DoNotDiscover
class InterestingFirstSpecEmbedded
  extends InterestingFirstSpecConstructor(iframe = true) {
  lazy val testPageUrl = {
    ensureFirstSiteCreated()
    rememberEmbeddedCommentsIframe()
    s"http://mycomputer:8080/embeds-localhost-topic-id-1001.html"
  }
}


/** Tests that interesting comments are shown first, before boring comments.
  */
abstract class InterestingFirstSpecConstructor(val iframe: Boolean)
  extends DebikiBrowserSpec with TestReplyer with TestLoginner with TestVoter {

  def testPageUrl: String

  def randomId() = nextRandomString() take 5

  val GuestName3 = "Guest3"
  val GuestName4 = "Guest4"
  val GuestName5 = "Guest5"

  var post2: PostId = 0
  var post3: PostId = 0
  var post4: PostId = 0
  var post5: PostId = 0


  "Interesting comments are shown first:" - {

    "open a test page" in {
      gotoDiscussionPageAndFakeNewIp(testPageUrl)
    }

    "login as three guests and post replies, logout" in {
      loginAsGuestInPopup("CommentPoster1")
      post2 = replyToArticle("Post #2.")
      post3 = replyToArticle("Post #3.")
      logoutIfLoggedIn()
      // New IP so the server won't think we're posting too many comments.
      fakeNewIp()
      loginAsGuestInPopup("CommentPoster2")
      post4 = replyToArticle("Post #4.")
      post5 = replyToArticle("Post #5.")
      logoutIfLoggedIn()
    }

    "find posts sorted by time: #2, #3, #4, #5" in {
      checkSortOrder(PageParts.BodyId, Seq(post2, post3, post4, post5))
    }

    "like post #3" in {
      loginAsGuestInPopup("LikerOfPost5")
      likePost(post3)
      logoutIfLoggedIn()
    }

    "find post #3 first" in {
      reloadPageAndFakeNewIp()
      checkSortOrder(PageParts.BodyId, Seq(post3, post2, post4, post5))
    }

    "like post #4 as another user" in {
      loginAsGuestInPopup("LikerOfPost4")
      likePost(post4)
    }

    "find post #4 first, then #3" in {
      reloadPageWaitForLoginLinks()
      checkSortOrder(PageParts.BodyId, Seq(post4, post3, post2, post5))
    }

    "like post #4 as yet another user" in {
      logoutIfLoggedIn()
      reloadPageAndFakeNewIp()
      loginAsGuestInPopup("AnotherLikerOfPost4")
      likePost(post4)
    }

    "like post #5 as another user" in {
      logoutIfLoggedIn()
      reloadPageAndFakeNewIp()
      loginAsGuestInPopup("LikerOfPost5")
      likePost(post5)
    }

    "find post in this order: #5, #4, #3, #2" in {
      reloadPageWaitForLoginLinks()
      checkSortOrder(PageParts.BodyId, Seq(post5, post4, post3, post2))
    }
  }

}


