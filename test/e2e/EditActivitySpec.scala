/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import com.debiki.v0.Prelude._
import com.debiki.v0.PageRole
import org.openqa.selenium.interactions.Actions
import org.scalatest.time.{Span, Seconds}
import org.scalatest.DoNotDiscover
import org.openqa.selenium.By


/** Runs the EditActivitySpec suite, in SBT:  test-only test.e2e.EditActivitySpecRunner
  */
@DoNotDiscover
class EditActivitySpecRunner extends org.scalatest.Suites(new EditActivitySpec {})
with ChromeSuiteMixin


/** Tests edit suggestions, applications and approvals, and that the
  * admin dashboard activity list shows suggestions and things to review.
  *
  * This is done:  ... **will** be done — not implemented ...
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
@DoNotDiscover
class EditActivitySpec extends DebikiBrowserSpec
  with TestReplyer with TestLoginner with TestEditor {

  lazy val testPage = createTestPage(PageRole.Generic,
    title = "Edit Suggestions Test 5902RK", body = Some("Edit suggestions test 10EIJ55."))

  val guestUserName = s"Activity-Anon-${nextRandomString()}"

  var postId_gu1 = ""
  var postId_gu2 = ""
  var postId_gu3 = ""
  var postId_gm1 = ""
  var postId_gm2 = ""
  var postId_gm3 = ""
  var postId_ad1 = ""
  var postId_ad2 = ""
  var postId_ad3 = ""
  var postId_ad4 = ""
  var postId_ad5 = ""


  "One can leave and accept improvement suggestions:" - {


    "open a test page" in {
      gotoDiscussionPage(testPage.url)
    }


    "let people add comments" - {

      s"login as guest, add comments: #gu1, #gu2, #gu3" in {
        loginAsGuest(guestUserName)
        postId_gu1 = replyToArticle("gu1-text")
        postId_gu2 = replyToComment(postId_gu1, "gu2-text")
        //anyCommentIsPendingModeration must be === false

        postId_gu3 = replyToComment(postId_gu2, "gu3-text")
        //anyCommentIsPendingModeration must be === true
      }

      "login as Gmail user, add comments: #gm1, #gm2, #gm3" in {
        logout()
        loginAsGmailUser()
        postId_gm1 = replyToArticle("gm1-text")
        postId_gm2 = replyToComment(postId_gm1, "gm2-text")
        postId_gm3 = replyToComment(postId_gm2, "gm3-text")
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

      "not show unapproved comments" in {
        reloadPage()

        findPost(postId_gu1) must be ('defined) // prel approved
        findPost(postId_gu2) must be ('defined)
        findPost(postId_gu3) must be ('empty)   // only first two comments are prel approved
        findPost(postId_gm1) must be ('empty)
        findPost(postId_gm2) must be ('empty)
        findPost(postId_gm3) must be ('empty)

        for (postId <- List(postId_ad1, postId_ad2, postId_ad3, postId_ad4, postId_ad5))
          findPost(postId) must be ('defined)
      }

    }

    "the dashboard activity list lists all comments" - {

      "goto Admin dashbar" in {
        clickGotoDashbarActivityTab()
      }

      "find listed all new comments" in {
        // The first comment might take a while to load.
        eventually {
          checkCommentStatus(postId_gu1, CommentStatusText.PrelApprovedComment)
        }
        checkCommentStatus(postId_gu2, CommentStatusText.PrelApprovedComment)

        for (postId <- List(postId_gu3, postId_gm1, postId_gm2, postId_gm3))
          checkCommentStatus(postId, CommentStatusText.UnapprovedComment)

        for (postId <- List(postId_ad1, postId_ad2, postId_ad3, postId_ad4, postId_ad5))
          checkCommentStatus(postId, CommentStatusText.ApprovedComment)
      }

      "approve comments" in {
        val unapprovedCommentIds = List(postId_gu3, postId_gm1, postId_gm2, postId_gm3)

        for (postId <- unapprovedCommentIds)
          click on findApprovePostLink(testPage.id, postId).getOrElse(
            fail(s"No approval link found for comment `$postId'"))

        for (postId <- unapprovedCommentIds) eventually {
          findPostApprovedText(testPage.id, postId) getOrElse
            fail(s"Comment `$postId' was never approved")
        }
      }
    }


    "let people edit each other's comments" - {

      s"return to discussion" in {
        goBack()
        reloadPage()
      }

      s"login as Guest, edit #gu1, #gm1, #ad1, #ad4" in {
        eventually { logout() }
        loginAsGuest(guestUserName)
        clickAndEdit(postId_gu1, "gu1-text, edited by guest")
        clickAndEdit(postId_gm1, "gm1-text, edited by guest")
        clickAndEdit(postId_ad1, "ad1-text, edited by guest")
        clickAndEdit(postId_ad4, "ad4-text, edited by guest")
      }

      s"login as Gmail user, edit #gu2, #gm2, #ad2, #ad5" in {
        logout()
        loginAsGmailUser()
        clickAndEdit(postId_gu2, "gu2-text, edited by Gmail user")
        clickAndEdit(postId_gm2, "gm2-text, edited by Gmail user")
        clickAndEdit(postId_ad2, "ad2-text, edited by Gmail user")
        clickAndEdit(postId_ad5, "ad5-text, edited by Gmail user")
      }

      s"login as Admin, edit #ad3" in {
        logout()
        cheatLoginAsAdmin()
        clickAndEdit(postId_ad3, "ad3-text, edited by admin")
      }

    }


    "the admin can view posts and suggestions in the dashboard activity list" - {

      "goto Admin dashboard activity tab" in {
        clickGotoDashbarActivityTab()
      }

      "find listed all comments and edit suggestions of admin's comments" in {
        val CST = CommentStatusText

        // The first comment might take a while to load.
        eventually {
          checkCommentStatus(postId_gu1, CST.PrelApprovedComment)
        }

        // The Gmail user's edits of #gu2 are not indicated before the preliminary
        // approval of the comment has been upheld.
        checkCommentStatus(postId_gu2, CST.PrelApprovedComment)  // edited by gmail user
        checkCommentStatus(postId_gu3, CST.ApprovedComment)   // not edited

        checkCommentStatus(postId_gm1, CST.ApprovedComment, withSuggestions = true) // guest
        checkCommentStatus(postId_gm2, CST.UnapprovedEdits)  // edited by author, gmail user
        checkCommentStatus(postId_gm3, CST.ApprovedComment)  // not edited

        // The guest and Gmail users have edited admin's comments 1, 2, 4, 5.
        checkCommentStatus(postId_ad1, CST.ApprovedComment, withSuggestions = true) // guest
        checkCommentStatus(postId_ad2, CST.ApprovedComment, withSuggestions = true) // gmail
        checkCommentStatus(postId_ad3, CST.ApprovedComment)  // admin edited it
        checkCommentStatus(postId_ad4, CST.ApprovedComment, withSuggestions = true) // guest
        checkCommentStatus(postId_ad5, CST.ApprovedComment, withSuggestions = true) // gmail
      }

    }


    "people applies each other's edit suggestion" - {

    }


    "the admin views and approves the pending edits in the dashboard activity list" - {

      // approve all changes, except for #ad5 and #ad6

    }


    "the admin reloads the page, finds the correct versions of everything" - {

    }

  }


  def checkCommentStatus(postId: String, commentStatusText: String,
        withSuggestions: Boolean = false) {
    val commentLink = find(cssSelector(s"a[href='/-${testPage.id}#post-$postId']")).
      getOrElse(fail(s"Comment `$postId' not listed"))
    commentLink.text must be === commentStatusText

    if (withSuggestions) {
      // hmm
    }
  }


  object CommentStatusText {
    val ApprovedComment = "Comment"
    val PrelApprovedComment = "New comment, prel. approved"
    val UnapprovedComment = "New comment"
    val UnapprovedEdits = "Comment, edited"
  }


  def findApprovePostLink(pageId: String, postId: String) =
    findPostInlineSomething(pageId, postId, cssClass = "approve-action", text = "Approve")


  def findPostApprovedText(pageId: String, postId: String) =
    findPostInlineSomething(pageId, postId, cssClass = "inline-message", text = "Approved.")


  private def findPostInlineSomething(
        pageId: String, postId: String, cssClass: String, text: String = null)
        : Option[Element] = {
    val query =
      // Find the link to the comment
      s"//a[@href='/-$pageId#post-$postId' and " +
            "contains(concat(' ', @class, ' '), ' action-description ')]" +
      // Find the <div> in which the link and inline actions are located
      "/.." +
      // Find approve/reject/etcetera link or inline information
      s"//*[contains(concat(' ', @class, ' '), ' $cssClass ')]"
    var anyElem = find(xpath(query))
    if (text ne null) anyElem = anyElem filter { _.text == text }
    anyElem
  }

}


