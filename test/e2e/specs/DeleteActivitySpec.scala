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

import com.debiki.core.Prelude._
import com.debiki.core.PageParts
import com.debiki.core.PageRole
import org.scalatest.DoNotDiscover
import test.e2e.code._


/** Runs the DeleteActivitySpec suite
  * in SBT:  test-only test.e2e.specs.DeleteActivitySpecRunner
  * in test:console:  (new test.e2e.specs.DeleteActivitySpecRunner).execute()
  */
class DeleteActivitySpecRunner extends org.scalatest.Suites(new DeleteActivitySpec)
with StartServerAndChromeDriverFactory

/** Runs the DeleteActivitySpecForEmbeddedComments suite
  * in SBT:  test-only test.e2e.specs.DeleteActivitySpecForEmbeddedCommentsRunner
  * in test:console:  (new test.e2e.specs.DeleteActivitySpecForEmbeddedCommentsRunner).execute()
  */
class DeleteActivitySpecForEmbeddedCommentsRunner
  extends org.scalatest.Suites(new DeleteActivitySpecForEmbeddedComments)
  with StartServerAndChromeDriverFactory


@test.tags.EndToEndTest
@DoNotDiscover
class DeleteActivitySpec extends DeleteActivitySpecConstructor(iframe = false) {
  lazy val testPageUrl = createTestPage(PageRole.WebPage,
    title = "Delete Comments Test 053KRI", body = Some("Delete comments test 71QE05.")).url
}

@test.tags.EndToEndTest
@DoNotDiscover
class DeleteActivitySpecForEmbeddedComments extends DeleteActivitySpecConstructor(iframe = true) {
  lazy val testPageUrl = {
    ensureFirstSiteCreated()
    rememberEmbeddedCommentsIframe()
    "http://mycomputer:8080/embeds-localhost-topic-id-1002.html"
  }
}


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
abstract class DeleteActivitySpecConstructor(iframe: Boolean)
  extends DebikiBrowserSpec with TestReplyer with TestLoginner with TestDeleterCollapserFlagger {

  def testPageUrl: String

  var postId_ad1 = PageParts.NoId
  var postId_ad2 = PageParts.NoId
  var postId_ad3 = PageParts.NoId
  var postId_ad4 = PageParts.NoId


  "Comments and comment trees can be deleted:" - {

    "open a test page" in {
      gotoDiscussionPageAndFakeNewIp(testPageUrl)
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
      if (embeddedCommentsWindowAndFrame.isDefined) {
        // Workaround. I don't know why, but in an iframe, the Delete button doesn't appear
        // unless I reload the page. But it is visible directly when running in "full window"
        // mode, and it should be. For now, do this workaround only for iframes:
        reloadPageWaitForLoginLinks()
      }

      // This doesn't work when in an iframe, because I haven't yet converted `?delete`
      // to `http://the-correct-origin/-/delete` + JSON.
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


