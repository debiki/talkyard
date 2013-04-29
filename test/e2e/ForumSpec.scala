/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package test.e2e

import org.scalatest.time.{Span, Seconds}
import org.scalatest.DoNotDiscover
import com.debiki.v0.Prelude._
import com.debiki.v0._


/**
 * Runs the ForumSpec suite, in SBT:  test-only test.e2e.ForumSpecRunner
 */
@DoNotDiscover
class ForumSpecRunner extends org.scalatest.Suites(new ForumSpec {})
with ChromeSuiteMixin


/**
 * Tests creation of new forum topics.
 */
@DoNotDiscover
abstract class ForumSpec extends DebikiBrowserSpec with TestEditor {

  var forumWindow: WindowTarget = null

  lazy val forumPage = createTestPage(
    PageRole.Forum, pageSlug = "test-forum", title = "Test Forum 27KV09", body = None)


  "An anonymous forum user can" - {

    "goto forum page" in {
      go to forumPage.url
      forumWindow = window(webDriver.getWindowHandle)
    }

    "create a new topic, login on the fly" in {
      createForumTopic(loginName = Some("Anon User KD3W09"))
    }

    "edit topic title first, then body" in {
      clickAndEdit(PageParts.TitleId, "Topic title 71DH3X0")
      clickAndEdit(PageParts.BodyId, "Topic body text 85BK213.")
    }

    "create another topic, already logged in" in {
      clickReturnToParentForum()
      createForumTopic()
    }

    "edit topic body first, then title" in {
      clickAndEdit(PageParts.BodyId, "Another topic body text 933KS3.")
      clickAndEdit(PageParts.TitleId, "Another topic title 4WKFEN39")
    }

    "edit missing topic body in other tab" - {
      var thirdTopicWin: WindowTarget = null
      val ThirdTopicTitleText = "Third topic title 5GdR311"
      val ThirdTopicBodyText = "Third topic body text 27CTM30."

      "create a third-topic, edit title" in {
        clickReturnToParentForum()
        thirdTopicWin = createForumTopic()
        clickAndEdit(PageParts.TitleId, ThirdTopicTitleText)
      }

      "open topic tab again, without passhash etc, via reloaded forum page" in {
        // Now URL passhash and newPageApproval params are gone.
        clickReturnToParentForum()
        click on partialLinkText(ThirdTopicTitleText)
      }

      "edit body" in {
        clickAndEdit(PageParts.BodyId, ThirdTopicBodyText)
      }

      "reload topic, find page body" in {
        reloadPage()
        pageSource must include(ThirdTopicBodyText)
      }
    }
  }


  "Another anonymous user can" - {
    "reply to a forum topic" in {
    }
  }


  "Mallory can" - {
    "create some topics" in {
    }

    "not create too many topics" in {
    }
  }


  private def createForumTopic(loginName: Option[String] = None): WindowTarget = {
    click on cssSelector(".dw-a-new-forum-topic")
    loginName foreach { name =>
      clickLoginGuestDummyEmail(name)
    }
    window(webDriver.getWindowHandle)
  }


  private def clickLoginGuestDummyEmail(name: String) {
    eventually { click on "dw-fi-lgi-name" }
    enter(name)
    click on "dw-fi-lgi-email"
    enter("no-email@example.com")
    click on "dw-f-lgi-spl-submit"
    eventually { click on "dw-dlg-rsp-ok" }
  }

}

