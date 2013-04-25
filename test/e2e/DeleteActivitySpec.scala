/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import com.debiki.v0.Prelude._
import com.debiki.v0.PageRole
import org.openqa.selenium.interactions.Actions
import org.scalatest.time.{Span, Seconds}
import org.scalatest.DoNotDiscover


/** Runs the DeleteActivitySpec suite, in SBT:  test-only test.e2e.DeleteActivitySpecRunner
  */
@DoNotDiscover
class DeleteActivitySpecRunner extends org.scalatest.Suites(new DeleteActivitySpec {})
with ChromeSuiteMixin


/** Tests that recent activity, e.g. flags and edit suggestions, appear in the
  * admin dashboard activity list.
  */
@DoNotDiscover
class DeleteActivitySpec extends DebikiBrowserSpec with TestReplyer with TestLoginner
  with TestDeleterCollapserFlagger {

  lazy val testPageUrl = createTestPage(PageRole.Generic,
    title = "Test Page Title 053KRI", body = Some("Test page text 71QE05."))

  var postId_ad1 = ""
  var postId_ad2 = ""
  var postId_ad3 = ""
  var postId_ad4 = ""


  "Lets test the activity view:" - {

    "open a test page" in {
      gotoDiscussionPage(testPageUrl)
    }

    "login as admin" in {
      logoutIfLoggedIn()
      cheatLoginAsAdmin()
    }

    "add four comments: #ad1, #ad2, #ad3, #ad4" in {
      postId_ad1 = replyToArticle("ad1-text")
      postId_ad2 = replyToComment(postId_ad1, text = "ad2-text")
      postId_ad3 = replyToArticle("ad3-text")
      postId_ad4 = replyToArticle("ad4-text")
    }

    "delete comment #ad1 and tree #ad2 -> #ad3, leave #ad4" in {
      deleteSingleComment(postId_ad1)
      deleteCommentTree(postId_ad2)
    }

    "reload page" in {
      reloadPage()
    }

    "find only comment #ad4" in {
      find(postId_ad1) must be ('empty)
      find(postId_ad2) must be ('empty)
      find(postId_ad3) must be ('empty)
      find(postId_ad4) must be ('defined)
    }

  }

}


