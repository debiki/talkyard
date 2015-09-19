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

import com.debiki.core.ActionId
import com.debiki.core.Prelude._
import com.debiki.core.PageRole
import com.debiki.core.PageParts
import com.debiki.core.{PostActionPayload => PAP}
import org.openqa.selenium.interactions.Actions
import org.scalatest.time.{Span, Seconds}
import org.scalatest.DoNotDiscover
import org.openqa.selenium.By
import test.e2e.code._


/** Runs the EditActivitySpec suite,
  * in SBT:  test-only test.e2e.specs.PinPostSpecRunner
  * in test:console:  (new test.e2e.specs.PinPostSpecRunner).execute()
  */
class PinPostSpecRunner extends org.scalatest.Suites(new PinPostSpec)
with StartServerAndChromeDriverFactory


/** Tests pin posts functionality.
  */
@test.tags.EndToEndTest
@DoNotDiscover
class PinPostSpec extends DebikiBrowserSpec
  with TestReplyer with TestLoginner with TestVoter with TestPinner {

  lazy val testPage = createTestPage(PageRole.WebPage,
    title = "Pin Posts Test 73kdEf0", body = Some("Pin posts test 6P8GK03."))

  val guestUserName = s"Activity-Anon-${nextRandomString() take 5}"

  var postId_gu1 = PageParts.NoId
  var postId_gm2 = PageParts.NoId
  var postId_ad3 = PageParts.NoId
  var postId_ad4 = PageParts.NoId
  var postId_ad5 = PageParts.NoId
  var postId_ad6 = PageParts.NoId
  var postId_ad7 = PageParts.NoId


  def allPostIds = List(
    postId_gu1, postId_gm2,
    postId_ad3, postId_ad4, postId_ad5, postId_ad6, postId_ad7)


  "One can pin posts:" - {


    "open a test page" in {
      gotoDiscussionPageAndFakeNewIp(testPage.url)
    }


    "add comments" - {

      s"login as guest, add comments: #gu1" in {
        loginAsGuestInPopup(guestUserName)
        postId_gu1 = replyToArticle("gu1-text")
      }

      "login as Gmail user, add comments: #gm2" in {
        logout()
        loginWithGmailInPopup()
        postId_gm2 = replyToArticle("gm2-text")
      }

      "login as admin, add comments: #ad3 - #ad7" in {
        logout()
        cheatLoginAsAdmin()
        postId_ad3 = replyToArticle("ad3-text")
        postId_ad4 = replyToArticle("ad4-text")
        postId_ad5 = replyToComment(postId_gu1, "ad5-text")
        postId_ad6 = replyToComment(postId_gu1, "ad6-text")
        postId_ad7 = replyToComment(postId_gu1, "ad7-text")
      }

      "rate #gu1 boring and #gm2 boring, #ad3 interesting" in {
        toggleVote(postId_gu1, PAP.VoteWrong)
        toggleVote(postId_gm2, PAP.VoteLike)
        toggleVote(postId_ad3, PAP.VoteWrong)
      }

      "all comments sorted correctly after reload" in {
        reloadPage()
        for (postId <- allPostIds)
          findPost(postId) must be ('defined)
      }
    }

    "moderators can pin posts" - {

      "login as admin" in {
        logout()
        cheatLoginAsAdmin()
      }

      s"pin posts via menu" in {
        pinCommentViaMenu(postId = postId_gu1, position = 1)
        pinCommentViaMenu(postId = postId_ad3, position = 2)
        pinCommentViaMenu(postId = postId_ad4, position = 3)

        // This should make the posts appear in order ad5, ad6, ad7.
        pinCommentViaMenu(postId = postId_ad7, position = 1)
        pinCommentViaMenu(postId = postId_ad6, position = 1)
        pinCommentViaMenu(postId = postId_ad5, position = 1)
      }

      "find the posts sorted correctly" in {
        checkSortOrder()
      }

      "reload page, still find the posts sorted correctly" in {
        reloadPage()
        eventually {
          // page loaded?
          find(cssSelector("#post-1")) must be !== None
        }
        checkSortOrder()
      }

      def checkSortOrder() {
        var correctSortOrder = List("post-1", "post-3", "post-4", "post-2")
        var articleReplies = findAll(
          cssSelector(".dw-depth-0 > .dw-res > li > .dw-t > .dw-p")).toList
        var actualIds = articleReplies.map(_.attribute("id") getOrDie "DwE5903R8N1")
        correctSortOrder mustEqual actualIds

        correctSortOrder = List("post-5", "post-6", "post-7")
        articleReplies = findAll(
          cssSelector(s"#dw-t-${postId_gu1} > .dw-res > .dw-t > .dw-p")).toList
        actualIds = articleReplies.map(_.attribute("id") getOrDie "DwE5903R8N1")
        correctSortOrder mustEqual actualIds
      }
    }

    "page author can pin and dragsort posts" - {

      "login as author" in {
        logout()
        loginAsGuestInPopup(guestUserName)
      }

      s"pin posts" in {
        pending
      }

      "reload page, find them sorted correctly" in {
        pending
      }
    }

    "other users cannot pin and dragsort" - {

      "login as Gmail user" in {
        logout()
        loginWithGmailInPopup()
      }

      "gmail user cannot drag-drop-sort pins" in {
        pending
      }

      "gmail user sees no Pin action menu item" in {
        pending
      }
    }

  }

}


