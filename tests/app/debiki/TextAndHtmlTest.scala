/**
 * Copyright (c) 2015 Kaj Magnus Lindberg (born 1979)
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

package debiki


import org.scalatest._


class TextAndHtmlTest extends FreeSpec with MustMatchers {

  "TextAndHtml can" - {

    val maker = new TextAndHtmlMaker(pubSiteId = "123abc", nashorn = null)

    "find links" - {

      "empty text" in {
        val textAndHtml = maker.forHtmlAlready("")
        textAndHtml.links mustBe Seq()
        textAndHtml.linkDomains mustBe Set()
        textAndHtml.linkIpAddresses mustBe Seq()
      }

      "html without links" in {
        val textAndHtml = maker.forHtmlAlready("<h1>Title</h1><p>Hello</p>")
        textAndHtml.links mustBe Seq()
        textAndHtml.linkDomains mustBe Set()
        textAndHtml.linkIpAddresses mustBe Seq()
      }

      "one <a href=...> link" in {
        val textAndHtml = maker.forHtmlAlready("<a href='http://example.com/path'>A link</a>")
        textAndHtml.links mustBe Seq("http://example.com/path")
        textAndHtml.linkDomains mustBe Set("example.com")
        textAndHtml.linkIpAddresses mustBe Seq()
      }

      "an  <a>  but without href attr is no link" in {
        val textAndHtml = maker.forHtmlAlready("<a>Not a link</a>")
        textAndHtml.links mustBe Seq()
        textAndHtml.linkDomains mustBe Set()
        textAndHtml.linkIpAddresses mustBe Seq()
      }

      "Pre-formatted <pre> blocks can contain links" in {
        val textAndHtml = maker.forHtmlAlready(
          "<pre><a href='http://hello.ex.co/path'>A link</a></pre>")
        textAndHtml.links mustBe Seq("http://hello.ex.co/path")
        textAndHtml.linkDomains mustBe Set("hello.ex.co")
        textAndHtml.linkIpAddresses mustBe Seq()
      }

      "<img src=...> link" in {
        val textAndHtml = maker.forHtmlAlready("<img src='http://example2.com/one.jpg'>")
        textAndHtml.links mustBe Seq("http://example2.com/one.jpg")
        textAndHtml.linkDomains mustBe Set("example2.com")
        textAndHtml.linkIpAddresses mustBe Seq()
      }

      "ip address <a href> link" in {
        val textAndHtml = maker.forHtmlAlready("<a href='http://11.22.33.44/path'>A link</a>")
        textAndHtml.links mustBe Seq("http://11.22.33.44/path")
        textAndHtml.linkDomains mustBe Set()
        textAndHtml.linkIpAddresses mustBe Seq("11.22.33.44")
      }

      "ip address <img src> link" in {
        val textAndHtml = maker.forHtmlAlready("<img src='http://22.22.11.11/img.png'>")
        textAndHtml.links mustBe Seq("http://22.22.11.11/img.png")
        textAndHtml.linkDomains mustBe Set()
        textAndHtml.linkIpAddresses mustBe Seq("22.22.11.11")
      }

    }

  }

}
