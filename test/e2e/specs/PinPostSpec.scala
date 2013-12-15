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
  with TestReplyer with TestLoginner with TestRater {

  lazy val testPage = createTestPage(PageRole.Generic,
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
      gotoDiscussionPage(testPage.url)
    }


    "add comments" - {

      s"login as guest, add comments: #gu1" in {
        loginAsGuest(guestUserName)
        postId_gu1 = replyToArticle("gu1-text")
      }

      "login as Gmail user, add comments: #gm1, #gm2, #gm3" in {
        logout()
        loginAsGmailUser()
        postId_gm2 = replyToArticle("gm2-text")
      }

      "login as admin, add comments: #ad1, #ad2, #ad3" in {
        logout()
        cheatLoginAsAdmin()
        postId_ad3 = replyToArticle("ad3-text")
        postId_ad4 = replyToArticle("ad4-text")
        postId_ad5 = replyToComment(postId_gu1, "ad5-text")
        postId_ad6 = replyToComment(postId_gu1, "ad6-text")
        postId_ad7 = replyToComment(postId_gu1, "ad7-text")
      }

      "rate #gu1 booring and #gm2 booring, #ad3 interesting" in {
        rateComment(postId_gu1, BadRating)
        rateComment(postId_gm2, BadRating)
        rateComment(postId_ad3, GoodRating)
      }

      "all comments sorted correctly after reload" in {
        reloadPage()
        for (postId <- allPostIds)
          findPost(postId) must be ('defined)
      }
    }


    "page author can pin and dragsort posts" - {

      "login as author" in {
        logout()
        loginAsGuest(guestUserName)
      }

      s"" in {
      }
    }


    "moderators can pin and dragsort" - {

      "login as admin" in {
        logout()
        cheatLoginAsAdmin()
      }
    }


    "posts are correctly sorted" - {

    }


    "other users cannot pin and dragsort" - {

      "login as Gmail user" in {
        logout()
        loginAsGmailUser()
      }

      "gmail user cannot drag-drop-sort pins" in {
      }

      "gmail user sees no Pin action menu item" in {
      }
    }


    "one can pin posts vertically too" - {
    }
  }

}


