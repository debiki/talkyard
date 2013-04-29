/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import com.debiki.v0.Prelude._
import com.debiki.v0.PageRole
import org.openqa.selenium.interactions.Actions
import org.scalatest.time.{Span, Seconds}
import org.scalatest.DoNotDiscover


/** Runs the EditActivitySpec suite, in SBT:  test-only test.e2e.EditActivitySpecRunner
  */
@DoNotDiscover
class EditActivitySpecRunner extends org.scalatest.Suites(new EditActivitySpec {})
with ChromeSuiteMixin


/** Tests that recent activity, e.g. flags and edit suggestions, appear in the
  * admin dashboard activity list.
  */
@DoNotDiscover
class EditActivitySpec extends DebikiBrowserSpec
  with TestReplyer with TestLoginner with TestEditor {

  lazy val testPage = createTestPage(PageRole.Generic,
    title = "Edit Suggestions Test 5902RK", body = Some("Edit suggestions test 10EIJ55."))

  val anonUserName = s"Activity-Anon-${nextRandomString()}"

  var postId_an1 = ""
  var postId_an2 = ""
  var postId_an3 = ""
  var postId_ad1 = ""
  var postId_ad2 = ""
  var postId_ad3 = ""

  "Lets test the activity view:" - {

    "open a test page" in {
      gotoDiscussionPage(testPage.url)
    }

    // ------ Anon adds comments

    s"login as new $anonUserName" in {
      loginAsGuest(anonUserName)
    }

    "add three comments: #an1, #an2, #an3" in {
      replyToArticle("an1-text")
      replyToArticle("an2-text")
      replyToArticle("an3-text")
    }


    "One comment must be pending moderation" in {
      anyCommentIsPendingModeration must be === true
    }

    "edit #an1" in {
      clickAndEdit(postId_an1, "an1-text, edited by comment author")
    }

    // ------ Admin views, adds & edits comments

    "login as admin" in {
      logout()
      loginAsGmailUser()
      reloadPage()
    }

    "comments #an1 and #an2 should be visible (prel approved)" in {
      find(postId_an1) must be ('defined)
      find(postId_an2) must be ('defined)
    }

    "comments #an3 should not be visible (pending approved)" in {
      find(postId_an3) must be ('empty)
    }

    "suggest improvement of comment #an2" in {
      clickAndEdit(postId_an2, "an2-text, improved by admin")
    }

    "leave three comments: #ad1, #ad2, #ad3" in {
      postId_ad1 = replyToArticle("ad1-text")
      postId_ad2 = replyToArticle("ad2-text")
      postId_ad3 = replyToArticle("ad3-text")
    }

    "admin's comments should be approved" in {
      anyCommentIsPendingModeration must be === false
    }

    "edit own comment #ad1, should be auto applied & approved" in {
      clickAndEdit(postId_ad1, "ad1-text, edited by the author (the admin)")
    }

    // ------ Admin approves stuff

    "goto dashboard" in {
    }

    "approve anon user's comments" in {
    }

    // ------ Anon user applies suggestion, edits comment

    "return to discussion page, login as anon user" in {
    }

    "apply admin's improvement suggestion of #an2" in {
    }

    "suggest improvement of admin's post #ad2" in {
    }

    "edit own post #an1 again" in {
    }

    // ------ Admin reviews things in the dasboard

    // Approve anon's own edit of #an1

    // Approve anon's application of admin's edit suggestion of #an2

    // View an apply anon's suggestion to #ad2 (it then will be auto approved)

  }

}


