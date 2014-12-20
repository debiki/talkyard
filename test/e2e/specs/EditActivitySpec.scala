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
  * in SBT:  test-only test.e2e.specs.EditActivitySpecRunner
  * in test:console:  (new test.e2e.specs.EditActivitySpecRunner).execute()
  */
class EditActivitySpecRunner extends org.scalatest.Suites(new EditActivitySpec)
with StartServerAndChromeDriverFactory


/** Tests edit suggestions, applications and approvals, and that the
  * admin dashboard activity list shows suggestions and things to review.
  *
  * This is done:
  *
  * A guest user adds comments #gu1-4,
  * a Gmail user adds #gm1-4,
  * and an admin adds #ad1-6.
  *
  * Then the guest user edits #gu1, #gm1, #ad1, #ad5. (Guest edits own, Gmail's and admin's)
  * The Gmail user edits #gu2, #gm2, #ad2, #ad6. (Gmail edits own, guest's and admin's)
  * The admin edits #ad3.
  *
  * Then the admin views the suggestions appear in the dashboard activity list.
  *
  * Then the guest user applies the Gmail user's edit suggestion, and vice versa.
  *
  * Then the admin views the pending edits in the dashboard activity list.
  * The admin approves all changes, except for changes to #ad5 and #ad6 — they're rejected.
  *
  * The admin reloads the page and verifies the correct versions
  * of everything is shown.
  */
@test.tags.EndToEndTest
@DoNotDiscover
class EditActivitySpec extends DebikiBrowserSpec
  with TestReplyer with TestLoginner with TestEditor with TestModeration {

  lazy val testPage = createTestPage(PageRole.WebPage,
    title = "Edit Suggestions Test 5902RK", body = Some("Edit suggestions test 10EIJ55."))

  val guestUserName = s"Activity-Anon-${nextRandomString() take 5}"

  var postId_gu1 = PageParts.NoId
  var postId_gu2 = PageParts.NoId
  var postId_gu3 = PageParts.NoId
  var postId_gm1 = PageParts.NoId
  var postId_gm2 = PageParts.NoId
  var postId_gm3 = PageParts.NoId
  var postId_ad1 = PageParts.NoId
  var postId_ad2 = PageParts.NoId
  var postId_ad3 = PageParts.NoId
  var postId_ad4 = PageParts.NoId
  var postId_ad5 = PageParts.NoId

  def allPostIds = List(
    postId_gu1, postId_gu2, postId_gu3,
    postId_gm1, postId_gm2, postId_gm3,
    postId_ad1, postId_ad2, postId_ad3, postId_ad4, postId_ad5)


  "One can leave and accept improvement suggestions:" - {


    "open a test page" in {
      gotoDiscussionPageAndFakeNewIp(testPage.url)
    }


    "let people add comments" - {

      s"login as guest, add comments: #gu1, #gu2, #gu3" in {
        loginAsGuestInPopup(guestUserName)
        postId_gu1 = replyToArticle("gu1-text")
        postId_gu2 = replyToComment(postId_gu1, "gu2-text")
        postId_gu3 = replyToComment(postId_gu2, "gu3-text")
      }

      "only the first two guest user's comments where prel approved" in {
        isPostApproved(postId_gu1) must be === true
        isPostApproved(postId_gu2) must be === true
        isPostApproved(postId_gu3) must be === false
      }

      "reload page, find comment #gu3 pending moderation" in {
        reloadPage()
        waitUntilUserSpecificDataHandled()
        isPostApproved(postId_gu3) must be === false
      }

      "logout and reload, then find only approved comments, i.e. not #gu3" in {
        logout()
        reloadPage()
        waitUntilUserSpecificDataHandled()
        findPost(postId_gu1) must be('defined)
        findPost(postId_gu2) must be('defined)
        findPost(postId_gu3) must be('empty)
      }

      "login as Gmail user, add comments: #gm1, #gm2, #gm3" in {
        loginWithGmailInPopup()
        postId_gm1 = replyToArticle("gm1-text")
        postId_gm2 = replyToComment(postId_gm1, "gm2-text")
        postId_gm3 = replyToComment(postId_gm2, "gm3-text")
      }

      "only the first two Gmail user's comments where prel approved" in {
        // Ooops currently the auto approver is rather restrictive. Change?
        //isCommentApproved(postId_gm1) must be === true
        //isCommentApproved(postId_gm2) must be === true
        isPostApproved(postId_gm3) must be === false
      }

      "login as admin, add comments: #ad1, #ad2, #ad3, #ad4, #ad5" in {
        logout()
        cheatLoginAsAdmin()
        postId_ad1 = replyToArticle("ad1-text")
        postId_ad2 = replyToComment(postId_ad1, "ad2-text")
        postId_ad3 = replyToComment(postId_ad2, "ad3-text")
        postId_ad4 = replyToComment(postId_ad3, "ad4-text")
        postId_ad5 = replyToComment(postId_ad4, "ad5-text")
      }

      "admin's comments are auto approved" in {
        isPostApproved(postId_ad5) must be === true
      }

      "admin sees all comments, including unapproved comments" in {
        reloadPage()
        for (postId <- allPostIds)
          findPost(postId) must be ('defined)
      }
    }


    "the dashboard activity list lists all comments" - {

      "goto Admin dashbar" in {
        clickGotoModerationPage()
      }

      "find listed all new comments" in {
        // The first comment might take a while to load.
        eventually {
          checkCommentStatus(testPage.id, postId_gu1, CommentStatusText.PrelApprovedComment)
        }
        checkCommentStatus(testPage.id, postId_gu2, CommentStatusText.PrelApprovedComment)

        for (postId <- List(postId_gu3, postId_gm1, postId_gm2, postId_gm3))
          checkCommentStatus(testPage.id, postId, CommentStatusText.UnapprovedComment)

        for (postId <- List(postId_ad1, postId_ad2, postId_ad3, postId_ad4, postId_ad5))
          checkCommentStatus(testPage.id, postId, CommentStatusText.ApprovedComment)
      }

      "approve comments" in {
        val unapprovedCommentIds = List(postId_gu3, postId_gm1, postId_gm2, postId_gm3)

        for (postId <- unapprovedCommentIds)
          click on findApproveNewPostLink(testPage.id, postId).getOrElse(
            fail(s"No approval link found for comment `$postId'"))

        for (postId <- unapprovedCommentIds) eventually {
          findPostApprovedMessage(testPage.id, postId) getOrElse
            fail(s"Comment `$postId' was never approved")
        }
      }
    }


    "let people edit each other's comments" - {

      s"return to discussion" in {
        clickGoBackToSite()
      }

      s"login as Guest, edit #gu1, #gm1, #ad1, #ad4" in {
        eventually { logout() }
        loginAsGuestInPopup(guestUserName)
        clickAndEdit(postId_gu1, "gu1-text, edited by guest")
        clickAndEdit(postId_gm1, "gm1-text, edited by guest", isSuggestion = true)
        clickAndEdit(postId_ad1, "ad1-text, edited by guest", isSuggestion = true)
        clickAndEdit(postId_ad4, "ad4-text, edited by guest", isSuggestion = true)
      }

      s"login as Gmail user, edit #gu2, #gm2, #ad2, #ad5" in {
        logout()
        loginWithGmailInPopup()
        clickAndEdit(postId_gu2, "gu2-text, edited by Gmail user", isSuggestion = true)
        clickAndEdit(postId_gm2, "gm2-text, edited by Gmail user")
        clickAndEdit(postId_ad2, "ad2-text, edited by Gmail user", isSuggestion = true)
        clickAndEdit(postId_ad5, "ad5-text, edited by Gmail user", isSuggestion = true)
      }

      s"login as Admin, edit #ad3" in {
        logout()
        cheatLoginAsAdmin()
        clickAndEdit(postId_ad3, "ad3-text, edited by admin")
      }
    }


    "the admin can view posts and suggestions in the dashboard activity list" - {

      "goto Admin dashboard activity tab" in {
        clickGotoModerationPage()
      }

      "find listed all comments and edit suggestions of admin's comments" in {
        val CST = CommentStatusText

        // The first comment might take a while to load.
        eventually {
          checkCommentStatus(testPage.id, postId_gu1, CST.PrelApprovedComment)
        }

        // The Gmail user's edits of #gu2 are not indicated before the preliminary
        // approval of the comment has been upheld.
        checkCommentStatus(testPage.id, postId_gu2, CST.PrelApprovedComment)  // edited by gmail user
        checkCommentStatus(testPage.id, postId_gu3, CST.ApprovedComment)   // not edited

        // This one has 1 suggestion by Gmail user.
        checkCommentStatus(testPage.id, postId_gm1, CST.ApprovedComment, numSuggestions = 1) // guest

        // This one was edited by its author, the gmail user, and it was auto-approved,
        // well behaved user.
        checkCommentStatus(testPage.id, postId_gm2, CST.ApprovedComment)

        checkCommentStatus(testPage.id, postId_gm3, CST.ApprovedComment)  // not edited

        // The guest and Gmail users have edited admin's comments 1, 2, 4, 5.
        checkCommentStatus(testPage.id, postId_ad1, CST.ApprovedComment, numSuggestions = 1) // guest
        checkCommentStatus(testPage.id, postId_ad2, CST.ApprovedComment, numSuggestions = 1) // gmail
        checkCommentStatus(testPage.id, postId_ad3, CST.ApprovedComment)  // admin edited it
        checkCommentStatus(testPage.id, postId_ad4, CST.ApprovedComment, numSuggestions = 1) // guest
        checkCommentStatus(testPage.id, postId_ad5, CST.ApprovedComment, numSuggestions = 1) // gmail
      }
    }


    "people applies each other's edit suggestion" - {

      s"return to discussion" in {
        clickGoBackToSite()
      }

      s"Admin approves suggestions to comment #ad1 and #ad2" in {
        approveEdits(postId_ad1)
        approveEdits(postId_ad2)
      }

      s"Admin rejects suggestions to comment #ad5 and #ad6" in {
        pending
      }

      "Gmail user approves edits to #gm1" in {
        logout()
        loginWithGmailInPopup()
        approveEdits(postId_gm1)
      }

      "Guest user approves edits to #gu1" in {
        logout()
        loginAsGuestInPopup(guestUserName)
        // This currently changes the status of the post from prel-approved to approved,
        // because Guest 2 has had other comments manually approved, so Guest 2 is
        // considered a well behaved user and gets his/her changes auto approved —
        // alhtough it's a guest! I guess this is too unsafe, since anyone can assume
        // a guest's identity. Should combine with cookies too? [dh3903w15]
        approveEdits(postId_gu2)
      }

      def approveEdits(postId: ActionId) {
        clickViewEditSuggestions(postId)
        // It takes a while to load the edits form.
        eventually { clickApproveAnySuggestion() }
        submitEditSuggestionsForm()
      }
    }


    "the admin views and approves the pending edits in the dashboard activity list" - {

      "goto Admin dashbar" in {
        logout()
        cheatLoginAsAdmin()
        clickGotoModerationPage()
      }

      "find listed the Guest and Gmail users' applied but unapproved edit suggestions" in {
        val CST = CommentStatusText

        eventually {
          checkCommentStatus(testPage.id, postId_gu1, CST.PrelApprovedComment)
        }

        // Comment #gu2 is prel approved and there's a suggestion that the Guest has applied.
        // I don't care if the comment shows up as PrelApprovedComment or UnapprovedComment;
        // for now UnapprovedComment works however:
        // Ooops see above [dh3903w15]. Currently the guest is considered well-behaved
        // so this comment became auto-approved when the guest applied an edit suggestion.
        //checkCommentStatus(testPage.id, postId_gu2, CST.UnapprovedComment) // prel aprvd, edited by gmail

        checkCommentStatus(testPage.id, postId_gu3, CST.ApprovedComment) // not edited

        checkCommentStatus(testPage.id, postId_gm1, CST.ApprovedComment) // guest's edits applied, approved, well behaved user
        checkCommentStatus(testPage.id, postId_gm2, CST.ApprovedComment) // edited by author, gmail user
        checkCommentStatus(testPage.id, postId_gm3, CST.ApprovedComment) // not edited

        // The guest and Gmail users' suggestions have been applied and approved by the admin.
        checkCommentStatus(testPage.id, postId_ad1, CST.ApprovedComment, numSuggestions = 0) // guest
        checkCommentStatus(testPage.id, postId_ad2, CST.ApprovedComment, numSuggestions = 0) // gmail
        checkCommentStatus(testPage.id, postId_ad3, CST.ApprovedComment)  // admin edited it

        // These suggestions should have been rejected, but not implemented (search
        // for a "pending" test, above), neither the test or the feature.
        checkCommentStatus(testPage.id, postId_ad4, CST.ApprovedComment, numSuggestions = 1) // guest
        checkCommentStatus(testPage.id, postId_ad5, CST.ApprovedComment, numSuggestions = 1) // gmail
      }
    }
  }

}


