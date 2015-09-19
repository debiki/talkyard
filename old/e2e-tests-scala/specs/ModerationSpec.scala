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

import com.debiki.core.PostId
import com.debiki.core.FlagType
import com.debiki.core.Prelude._
import com.debiki.core.PageRole
import com.debiki.core.PageParts
import org.openqa.selenium.interactions.Actions
import org.scalatest.time.{Span, Seconds}
import org.scalatest.DoNotDiscover
import org.openqa.selenium.By
import test.e2e.code._


/** Runs the ModerationSpec suite,
  * in SBT:  test-only test.e2e.specs.ModerationSpecRunner
  * in test:console:  (new test.e2e.specs.ModerationSpecRunner).execute()
  */
class ModerationSpecRunner extends org.scalatest.Suites(new ModerationSpec)
with StartServerAndChromeDriverFactory


/** Tests moderation functionality, e.g. flags and approvals of new posts.
  */
@test.tags.EndToEndTest
@DoNotDiscover
class ModerationSpec extends DebikiBrowserSpec
  with TestReplyer with TestLoginner with TestFlagger with TestModeration {

  lazy val testPage = createTestPage(PageRole.WebPage,
    title = "ModerationSpec Page Title", body = Some("ModerationSpec page body."))

  val guestUserName = s"Mod-Test-Anon-${nextRandomString() take 5}"

  var postId_gu2 = PageParts.NoId
  var postId_gu3 = PageParts.NoId
  var postId_gu4 = PageParts.NoId
  var postId_gu5 = PageParts.NoId
  var postId_gu6 = PageParts.NoId
  var postId_gu7 = PageParts.NoId
  var postId_ad8 = PageParts.NoId

  def allPostIds = List(
    postId_gu2, postId_gu3, postId_gu4, postId_gu5, postId_gu6, postId_gu7,
    postId_ad8)


  "Staff can moderate comments:" - {

    "open a test page" in {
      gotoDiscussionPageAndFakeNewIp(testPage.url)
    }


    "people can add comments" - {

      s"login as guest, add comments: #gu2, 3, 4, 5, 6, 7" in {
        loginAsGuestInPopup(guestUserName)
        postId_gu2 = replyToArticle("gu2-text")
        postId_gu3 = replyToComment(postId_gu2, "gu3-text")
        postId_gu4 = replyToComment(postId_gu3, "gu4-text")
        postId_gu5 = replyToComment(postId_gu4, "gu5-text")
        postId_gu6 = replyToComment(postId_gu5, "gu6-text")
        postId_gu7 = replyToComment(postId_gu6, "gu7-text")
      }

      "only the first two guest user's comments where prel approved" in {
        isPostApproved(postId_gu2) mustBe true
        isPostApproved(postId_gu3) mustBe true
        /*
        isPostApproved(postId_gu4) mustBe false
        isPostApproved(postId_gu5) mustBe false
        isPostApproved(postId_gu6) mustBe false
        isPostApproved(postId_gu7) mustBe false
        */
      }

      "reload page, find comments #gu4, 5, 6 pending moderation" in {
        reloadPage()
        waitUntilUserSpecificDataHandled()
        isPostApproved(postId_gu2) mustBe true
        isPostApproved(postId_gu3) mustBe true
        /*
        isPostApproved(postId_gu4) mustBe false
        isPostApproved(postId_gu5) mustBe false
        isPostApproved(postId_gu6) mustBe false
        isPostApproved(postId_gu7) mustBe false
        */
      }

      "logout and reload, then find only approved comments, i.e. not #gu4, 5, 6, 7" in {
        logout()
        reloadPage()
        waitUntilUserSpecificDataHandled()
        findPost(postId_gu2) must be(defined)
        findPost(postId_gu3) must be(defined)
        findPost(postId_gu4) must be(empty)
        findPost(postId_gu5) must be(empty)
        findPost(postId_gu6) must be(empty)
        findPost(postId_gu7) must be(empty)
      }

      "login as admin, add comments: #ad8" in {
        cheatLoginAsAdmin()
        postId_ad8 = replyToArticle("ad8-text")
      }

      "admin's comments are auto approved" in {
        isPostApproved(postId_ad8) mustBe true
      }

      "admin sees all comments, including unapproved comments" in {
        reloadPage()
        for (postId <- allPostIds)
          findPost(postId) must be ('defined)
      }
    }


    "staff can approve and reject comments on moderation page" - {

      "goto moderation page" in {
        clickGotoModerationPage()
      }

      "find listed all new comments" in {
        // The first comment might take a while to load.
        eventually {
          checkCommentStatus(testPage.id, postId_gu2, CommentStatusText.PrelApprovedComment)
        }
        checkCommentStatus(testPage.id, postId_gu3, CommentStatusText.PrelApprovedComment)

        for (postId <- List(postId_gu4, postId_gu5, postId_gu6, postId_gu7))
          checkCommentStatus(testPage.id, postId, CommentStatusText.UnapprovedComment)
          // checkCommentStatus(postId, CommentStatusText.UnapprovedComment)

        for (postId <- List(postId_ad8))
          checkCommentStatus(testPage.id, postId, CommentStatusText.ApprovedComment)
      }

      "approve comments except #gu6, 7" in {
        val someUnapprovedCommentIds =
          List(postId_gu2, postId_gu3, postId_gu4, postId_gu5)

        // Without `eventually`, this fails when run via Jenkins, only via Jenkins, weird.
        eventually {
          clickApproveNewPost(testPage.id, someUnapprovedCommentIds.head)
        }

        for (postId <- someUnapprovedCommentIds.tail)
          clickApproveNewPost(testPage.id, postId)

        for (postId <- someUnapprovedCommentIds) eventually {
          findPostApprovedMessage(testPage.id, postId) getOrElse
            fail(s"Comment `$postId' was never approved")
        }
      }

      "delete comment #gu6" in {
        clickDeleteNewPost(testPage.id, postId_gu6)
        eventually {
          findPostDeletedMessage(testPage.id, postId_gu6) getOrElse
            fail(s"Comment `$postId_gu6' was never deleted")
        }
      }

      "return to page" in {
        clickGoBackToSite()
      }

      "find non-deleted comments approved" in {
        // The first comment might take a while to load.
        eventually {
          for (postId <- List(postId_gu2, postId_gu3, postId_gu4, postId_gu5)) {
            findPost(postId) must be (defined)
            isPostApproved(postId) mustBe true
          }
        }
        isPostDeleted(postId_gu6) mustBe true
        findPost(postId_gu7) must be (defined)
        findPost(postId_ad8) must be (defined)
      }
    }

    "people can flag comments, staff can delete them on the moderation page" - {

      "flag guest user comments 2, 3, 4, 5" in {
        flagPost(postId_gu2, FlagType.Inapt)
        flagPost(postId_gu3, FlagType.Spam)
        flagPost(postId_gu4, FlagType.Other)
        flagPost(postId_gu5, FlagType.Inapt)
      }

      "go to moderation page" in {
        clickGotoModerationPage()
      }

      "clear flags for flagged comment #gu2" in {
        eventually {
          clickClearFlags(testPage.id, postId_gu2)
        }
        eventually {
          findFlagsClearedMessage(testPage.id, postId_gu2)
        }
      }

      "delete flagged comments 3 and 4, leave 5 as is" in {
        clickDeleteFlaggedPost(testPage.id, postId_gu3)
        clickDeleteFlaggedPost(testPage.id, postId_gu4)
        eventually {
          findPostDeletedMessage(testPage.id, postId_gu3) must be (defined)
          findPostDeletedMessage(testPage.id, postId_gu4) must be (defined)
        }
      }

      "find no action buttons at handled posts" in {
        reloadPage()
        eventually {
          findClearFlagsLink(testPage.id, postId_gu5) must be (defined)
          findDeleteNewPostLink(testPage.id, postId_gu7) must be (defined)
          findAnyInlineButton(testPage.id, postId_gu2) must be (empty)
          findAnyInlineButton(testPage.id, postId_gu3) must be (empty)
          findAnyInlineButton(testPage.id, postId_gu4) must be (empty)
          findAnyInlineButton(testPage.id, postId_gu6) must be (empty)
          findAnyInlineButton(testPage.id, postId_ad8) must be (empty)
        }
      }

      "return to page again" in {
        clickGoBackToSite()
      }

      "find all comments except #gu2 deleted (and #gu7 was never approved)" in {
        // The first comment might take a while to load.
        eventually {
          for (postId <- List(postId_gu2, postId_gu5)) {
            findPost(postId) must be (defined)
            isPostApproved(postId) mustBe true
          }
        }
        isPostDeleted(postId_gu3) mustBe true
        isPostDeleted(postId_gu4) mustBe true
        isPostDeleted(postId_gu6) mustBe true
        findPost(postId_gu7) must be (defined)
        findPost(postId_ad8) must be (defined)
      }

    }

  }

}


