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

import com.debiki.core.Prelude._
import org.scalatest.time.{Span, Seconds}
import org.scalatest.DoNotDiscover
import test.e2e.code._


/** Runs the CreateSiteSpec suite.
  * In Play:   test-only test.e2e.specs.CreateEmbeddedCommentsSiteSpecRunner
  * In test:console:  (new test.e2e.specs.CreateEmbeddedCommentsSiteSpecRunner).execute()
  */
@DoNotDiscover
class CreateEmbeddedCommentsSiteSpecRunner
  extends org.scalatest.Suites(new CreateEmbeddedCommentsSiteSpec)
  with StartServerAndChromeDriverFactory


/**
 * Tests website creation.
 *
 * Logs in as debiki.tester@gmail.com and creates an embedded comments site,
 * checks the admin dashboard and tests to add some comments to an embedded discussions.
 *
 * You need to add entries to your hosts file:
 *   127.0.0.1 mycomputer
 *   127.0.0.1 site-11.localhost
 *   127.0.0.1 site-12.localhost
 *   127.0.0.1 site-13.localhost
 *   ...perhaps some more or less.
 */
@test.tags.EndToEndTest
@DoNotDiscover
class CreateEmbeddedCommentsSiteSpec
  extends DebikiBrowserSpec with TestSiteCreator with TestReplyer {


  /** You need an entry '127.0.0.1 mycomputer' in your hosts file. */
  val EmbeddingSiteUrl = "http://mycomputer:8080"
  val EmbddingSiteUrlInputId = "embeddingSiteUrl"

  val AdminReplyText = "Reply_by_admin"
  val GuestReplyText = "Reply_by_guest"

  var embeddedSiteId: Option[String] = None
  def embeddingPageUrl = s"$EmbeddingSiteUrl/embeds-site-${embeddedSiteId.get}-topic-id-empty.html"


  "A user with a browser can" - {

    "go to site creation page" in {
      go to createEmbeddedCommentsSiteStartPage
    }

    s"login with Gmail OpenID" in {
      clickLoginWithGmailOpenId()
      eventually {
        find(EmbddingSiteUrlInputId) must not equal(None)
      }
    }

    "specify obviously invalid addresses of embedding site, find them rejected" in {
      pending
    }

    "specify address of embedding site" in {
      click on EmbddingSiteUrlInputId
      enter(EmbeddingSiteUrl)
    }

    "not proceed before terms accepted" in {
      click on cssSelector("input[type=submit]")
      find(EmbddingSiteUrlInputId) must not equal(None)
    }

    "accept terms and proceed" in {
      click on "accepts-terms"
      click on cssSelector("input[type=submit]")
      eventually {
        find(EmbddingSiteUrlInputId) mustEqual None
      }
    }

    "find welcome page" in {
      eventually {
        pageSource must include ("Embedded comments have been setup")
        pageSource must include (EmbeddingSiteUrl)
      }
    }

    "find site id in browser address bar" in {
      val EmbeddedSiteUrl = "^http://site-([0-9a-z]+)\\..*$".r
      webDriver.getCurrentUrl() match {
        case EmbeddedSiteUrl(siteId) =>
          embeddedSiteId = Some(siteId)
        case _ =>
          fail()
      }
    }

    "goto instructions page" in {
      click on linkText ("Continue")
    }

    "find instructions page" in {
      eventually {
        pageSource must include ("Installation instructions for")
        pageSource must include (EmbeddingSiteUrl)
      }
    }

    "go to admin page and login" in {
      val adminPageUrl = s"http://site-${embeddedSiteId.get}.${debiki.Globals.baseDomain}/-/admin/"
      click on cssSelector(s"a[href='$adminPageUrl']")
      clickLoginWithGmailOpenId()
      eventually {
        pageSource must include ("Admin Page")
      }
    }

    /*
    "not allow site creation if there's no `new-website-domain' config value" in {
      // Please sync this test with the same test in CreateSiteSpec.
      pending
    }
    */

    "find empty page list" in {
      find(cssSelector("table.page-table tbody tr")) mustEqual None
    }

    "find empty activity list" in {
      click on linkText("Activity")
      val bää = find(cssSelector("[ng-controller='ActionListCtrl'] tbody tr"))
    }

    "view empty discussion in embedding page" in {
      go to embeddingPageUrl
      eventually {
        pageSource must include ("Text text text")
      }
    }

    "Switch to embedded comments <iframe>" in {
      rememberEmbeddedCommentsIframe()
      switchToAnyEmbeddedCommentsIframe()
    }

    "add a reply, as admin" in {
      replyToArticle(AdminReplyText)
    }

    "add a reply, as guest" in {
      logoutIfLoggedIn()
      loginAsGuest("TestGuest")
      replyToComment(postId = 1, text = GuestReplyText)
    }

    "reload page, find both replies" in {
      reloadPage()
      switchToAnyEmbeddedCommentsIframe()
      eventually {
        pageSource must include (AdminReplyText)
        pageSource must include (GuestReplyText)
      }
    }
  }

}

