/**
 * Copyright (c) 2021 Debiki AB
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

package talkyard.server.linkpreview


import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.must
import com.debiki.core.Prelude._
import com.debiki.core._
import debiki.onebox.engines.TwitterPrevwRendrEng


class LinkPreviewRendererSpec extends AnyFreeSpec with must.Matchers {

  def tweakLinks(htmlSt: St, toHttps: Bo, uploadsUrlCdnPrefix: Opt[St],
        followLinksSkipNoopener: Bo = false,
        siteId_unused: SiteId = NoSiteId, sitePubId_unused: PubSiteId = ""): St = {
    debiki.onebox.LinkPreviewRenderer.tweakLinks(htmlSt, toHttps,
          uploadsUrlCdnPrefix = uploadsUrlCdnPrefix,
          followLinksSkipNoopener = followLinksSkipNoopener,
          siteId_unused = siteId_unused, sitePubId_unused = sitePubId_unused)
  }


  "LinkPreviewRenderer.tweakLinks can" - {
    "leave non-links as is" in {
      tweakLinks("", toHttps = true, uploadsUrlCdnPrefix = None) mustBe ""
      tweakLinks("abc", toHttps = true, uploadsUrlCdnPrefix = None) mustBe "abc"

      // Not a link — just plain text:
      tweakLinks("http://ex.co", toHttps = true, uploadsUrlCdnPrefix = None
            ) mustBe "http://ex.co"
    }


    "change to https" in {
      def htmlWithLink(https: Bo): St = {
        val scheme = if (https) "https" else "http"
        o"""bla blah
        <a href="$scheme://ex.co">http://not.link.co</a>
        <a name="http://not.link.ex.co"></a>
        <area href="$scheme://ex.co">
        <img src="$scheme://ex.co">
        <img alt="http://not_link.ex.co">
        blah
        """
      }

      tweakLinks(htmlWithLink(false), toHttps = true,
            uploadsUrlCdnPrefix = None) mustBe htmlWithLink(true)

      tweakLinks(htmlWithLink(false), toHttps = false,
            uploadsUrlCdnPrefix = None) mustBe htmlWithLink(false)
    }


    "re-point to CDN" in {
      def htmlWithUplLink(https: Bo, uplPath: St = "/-/u/"): St = {
        o"""bla blah
        <img src="${uplPath}3/a/bc/defg1234.jpg">
        bla2 blah2
        """
      }

      tweakLinks(htmlWithUplLink(https = false), toHttps = false,
            uploadsUrlCdnPrefix = None) mustBe htmlWithUplLink(false)

      tweakLinks(htmlWithUplLink(https = false), toHttps = false,
            uploadsUrlCdnPrefix = Some("https://cdn.ex.co/-/u/")
            ) mustBe htmlWithUplLink(false, "https://cdn.ex.co/-/u/")
    }


    "add rel='noopener' to <a>" in {
      tweakLinks("""<a href="https://ex.co" target="_blank">title</a>""",
          toHttps = true, uploadsUrlCdnPrefix = None) mustBe o"""<a href="https://ex.co"
                       target="_blank" rel="noopener">title</a>"""

      tweakLinks("""<a href="https://ex.co" target="_blank" rel="nofollow">title</a>""",
          toHttps = true, uploadsUrlCdnPrefix = None) mustBe o"""<a href="https://ex.co"
                       target="_blank" rel="nofollow noopener">title</a>"""

      tweakLinks("""<a href="https://ex.co" target="_blank" rel="zznoopener">title</a>""",
          toHttps = true, uploadsUrlCdnPrefix = None) mustBe o"""<a href="https://ex.co"
                       target="_blank" rel="zznoopener noopener">title</a>"""

      tweakLinks("""<a href="https://ex.co" target="_blank" rel="noopenerzz">title</a>""",
          toHttps = true, uploadsUrlCdnPrefix = None) mustBe o"""<a href="https://ex.co"
                       target="_blank" rel="noopenerzz noopener">title</a>"""

      tweakLinks("""<a href="https://ex.co" target="_blank" rel="noOPEner">title</a>""",
          toHttps = true, uploadsUrlCdnPrefix = None) mustBe o"""<a href="https://ex.co"
                       target="_blank" rel="noOPEner noopener">title</a>"""
    }


    "can skip add rel='noopener'" in {
      val aHref = """<a href="https://ex.co" target="_blank">title</a>"""
      tweakLinks(aHref, toHttps = true, uploadsUrlCdnPrefix = None,
            followLinksSkipNoopener = true) mustBe aHref
    }


    "both rel='noopener' and https" in {
      tweakLinks("""<a href="http://ex.co" target="_blank">title</a>""",
          toHttps = true, uploadsUrlCdnPrefix = None) mustBe o"""<a href="https://ex.co"
                       target="_blank" rel="noopener">title</a>"""
    }

    "both rel='noopener' and CDN" in {
      tweakLinks("""<a href="/-/u/3/a/bc/defg1234.doc" target="_blank">lnk</a>""",
            toHttps = true, uploadsUrlCdnPrefix = Some("https://cdn2.co/-/u/"),
            ) mustBe o"""<a href="https://cdn2.co/-/u/3/a/bc/defg1234.doc"
                           target="_blank" rel="noopener">lnk</a>"""
    }


    "add rel='noopener' to <area>" in {
      tweakLinks("""<area href="https://ex.co" target="_blank"> abc""",
            toHttps = true, uploadsUrlCdnPrefix = None
            ) mustBe o"""<area href="https://ex.co" target="_blank" rel="noopener"> abc"""
    }
  }

}


