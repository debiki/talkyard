/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import com.debiki.v0.Prelude._
import com.debiki.v0.PageParts
import com.debiki.v0.PageRole
import org.scalatest.DoNotDiscover


/** Runs the DeleteActivitySpec suite, in SBT:  test-only test.e2e.DeleteActivitySpecRunner
  */
@DoNotDiscover
class DeleteActivitySpecRunner extends org.scalatest.Suites(new DeleteActivitySpec {})
with ChromeSuiteMixin


/** Tests that comments can be deleted.
  *
  * Creates these comments:
  *
  *   ad1
  *   ad2 --> ad3  (ad3 replies to ad2)
  *   ad4
  *
  * Then deletes #ad1 and #ad2, and tests that they plus #ad3 are gone,
  * but that #ad4 is still visible.
  */
@DoNotDiscover
class DeleteActivitySpec extends DebikiBrowserSpec with TestReplyer with TestLoginner
  with TestDeleterCollapserFlagger {

  lazy val testPage = createTestPage(PageRole.Generic,
    title = "Delete Comments Test 053KRI", body = Some("Delete comments test 71QE05."))

  var postId_ad1 = PageParts.NoId
  var postId_ad2 = PageParts.NoId
  var postId_ad3 = PageParts.NoId
  var postId_ad4 = PageParts.NoId


  "Comments and comment trees can be deleted:" - {

    "open a test page" in {
      gotoDiscussionPage(testPage.url)
    }

    "login as admin" in {
      logoutIfLoggedIn()
      cheatLoginAsAdmin()
    }

    "add four comments: #ad1 --> #ad2, #ad3, #ad4" in {
      postId_ad1 = replyToArticle("ad1-text")
      postId_ad2 = replyToArticle("ad2-text")
      postId_ad3 = replyToComment(postId_ad2, text = "ad3-text")
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
      eventually {
        findPost(postId_ad1) must be ('empty)
        findPost(postId_ad2) must be ('empty)
        findPost(postId_ad3) must be ('empty)
        findPost(postId_ad4) must be ('defined)
      }
    }

  }

}


