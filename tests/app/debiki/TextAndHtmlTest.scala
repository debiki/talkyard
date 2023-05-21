/**
 * Copyright (c) 2015, 2020 Kaj Magnus Lindberg
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


import com.debiki.core._
import com.debiki.core.Prelude._
import org.jsoup.Jsoup
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.must


class TextAndHtmlTest extends AnyFreeSpec with must.Matchers {

  "TextAndHtml can" - {

    def checkRemovesScriptTags(fn: String => String): Unit = {
      fn("""<script>alert("123")</script>Title""") mustBe "Title"
      fn("""Two <script>alert("123") three</script>four""") mustBe "Two four"
      fn("""Unterminated <script>alert("123") scr ip t""") mustBe "Unterminated"
      fn("""very </script> terminated""") mustBe "very  terminated"

      // Old comment:
      // But does not sanitize for inclusion in html *attributes*, e.g. this is ok:
      // (from https://hackerone.com/reports/197914)
      // fn("""descr' onerror='alert(/XSS by skavans/)""")
    }

    def checkRemovesScriptAttributes(fn: String => String, keepTag: Boolean): Unit = {
      val (start, end) = if (keepTag) ("""<a rel="nofollow noopener">""", "</a>") else ("", "")
      fn("""<a href="javascript:alert(123)">Title</a>""") mustBe s"${start}Title$end"
      fn("""Hi <a onclick="alert(123)">Title</a>""") mustBe s"Hi ${start}Title$end"
    }


    "sanitize titles  TyT6RKKDJ563" - {
      import TextAndHtml.{sanitizeTitleText => sanTitle}

      "remove <script> and anything inside" in {
        checkRemovesScriptTags(sanTitle)
      }

      "remove attribs w javascript, in fact, the whole <a> too" in {
        checkRemovesScriptAttributes(sanTitle, keepTag = false)
      }

      "delete unknown tags but keep the text inside" in {
        sanTitle("""<unknown>alert("123")</unknown>Title""") mustBe """alert("123")Title"""
        sanTitle("""<unknown>single ' double " </unknown>Title"""
              ) mustBe """single ' double " Title"""
      }

      "delete other bad stuff" in {
        sanTitle("""<unknown>whatever </unknown>Title""") mustBe "whatever Title"
        sanTitle("""<a href="whatever:no-no">Title</a> more""") mustBe "Title more"
      }

      "no links or anchors in titles — titles are links themselves (to the topics)" in {
        sanTitle("""<a id="whatever">Title</a>""") mustBe "Title"
        sanTitle("""<a href="https://ex.com">Title</a>""") mustBe "Title"
        sanTitle("""<a target="_blank">Title</a>""") mustBe "Title"
        sanTitle("""<a rel="follow">Title</a>""") mustBe "Title"
        sanTitle("""<a rel="nofollow">Title</a>""") mustBe "Title"
        sanTitle("""<a>Title</a>""") mustBe "Title"

        sanTitle("""<img src="https://ex.com">Title Text</img>""") mustBe "Title Text"
      }

      "allow some tags" in {
        val okTitles = Seq(
              "",
              """() {} [] . , - + * ' " ` ! ? $ % #""",
              """Nice Title Wow""",
              """<code>nice with the source</code>""",
              """<small>but not tiny</small>""",
              """<b>bold</b> and <i>it</i> is <strong>ok</strong>""")
        for (title <- okTitles) {
          sanTitle(title) mustBe title
        }
      }

      "escape" in {
        sanTitle("&") mustBe "&amp;"
        sanTitle("less < than") mustBe "less &lt; than"
        sanTitle("gr > than") mustBe "gr &gt; than"
        sanTitle("all < fun & escapes > here") mustBe "all &lt; fun &amp; escapes &gt; here"
      }

      "not escape already escaped html" in {
        sanTitle("&amp;") mustBe "&amp;"
        sanTitle("&lt;") mustBe "&lt;"
        sanTitle("&gt;") mustBe "&gt;"
        sanTitle("greater &gt; is &lt; smaller") mustBe "greater &gt; is &lt; smaller"
      }

      "handle missing tags" in {
        sanTitle("""why </b> this""") mustBe "why  this"
        sanTitle("""why <b>this""") mustBe "why <b>this</b>"
      }

      "delete block elems" in {
        sanTitle("""<p>no paras</p>""") mustBe "no paras"
        sanTitle("""<div>no divs</div>""") mustBe "no divs"
        sanTitle("""<div>really no divs""") mustBe "really no divs"
        sanTitle("""what no divs</div>""") mustBe "what no divs"
      }

      "compact title html output" in {
        sanTitle(" <b> bold </b> <i>it</i> \n") mustBe "<b> bold </b> <i>it</i>"

        val title = "<b>    bold  </b> \n \n <i>it</i>"
        sanTitle(s"\n$title \n") mustBe title

        sanTitle(s" \n <p> \n text \n text2 \n </p> \n ") mustBe "text \n text2"
      }
    }

    "sanitize posts  TyT03386KTDGR" - {
      def sanPost(html: String) = TextAndHtml.sanitizeRelaxed(html)

      "remove <script> and anything inside" in {
        checkRemovesScriptTags(sanPost)
      }

      "remove attribs w javascript, but allow <a>" in {
        checkRemovesScriptAttributes(sanPost, keepTag = true)
      }

      "add rel=nofollow" in {
        sanPost("""<a href="https://x.co">x.co</a>"""
              ) mustBe """<a href="https://x.co" rel="nofollow noopener">x.co</a>"""
      }

      "add rel='nofollow noopener'  if _blank  —  oh, actually removes _blank" in {
        sanPost("""<a href="https://x.co" target="_blank">x.co</a>""") mustBe
              """<a href="https://x.co" rel="nofollow noopener">x.co</a>"""
      }

      "add 'nofollow' to rel='noopener'  —  oh, removes _blank" in {
        sanPost("""<a href="https://x.co" target="_blank" rel="noopener">x.co</a>"""
              ) mustBe """<a href="https://x.co" rel="nofollow noopener">x.co</a>"""
      }

      "add 'noopener' to rel='nofollow'  —  oh, removes _blank" in {
        sanPost("""<a href="https://x.co" target="_blank" rel="nofollow">x.co</a>"""
              ) mustBe """<a href="https://x.co" rel="nofollow noopener">x.co</a>"""
      }

      "change rel=follow to nofollow" in {
        sanPost("""<a href="https://x.co" rel="follow">x.co</a>"""
              ) mustBe """<a href="https://x.co" rel="nofollow noopener">x.co</a>"""
      }

      "change rel=follow to 'nofollow noopener'  if _blank  —  oh, removes _blank" in {
        sanPost("""<a href="https://x.co" target="_blank" rel="follow">x.co</a>""") mustBe
              """<a href="https://x.co" rel="nofollow noopener">x.co</a>"""
      }

      /* Wait, breaks tests.  [disallow_h1_h2]
      "disallow <h1> and <h2>,  but <h3>  is ok  ?" in {
        sanPost("<h1>hh11</h1> <h2>hh22<h2> <h3>hh33</h3> <h4>hh44</h4>") mustBe
              "hh11 hh22 <h3>hh33</h3> <h4>hh44</h4>"
      } */

      "compact posts html output" in {
        sanPost(" \n <b>\nbold\n</b>\n \n<i>it</i> \n <script>var x;</script>") mustBe
                    "<b>\nbold\n</b>\n \n<i>it</i>"
        val manyLines = i"""
              |<div>
              |  Text text <b>bold</b>!
              |</div>
              |<p><a href="https://ex.co" rel="nofollow noopener">Link title</a>
              |</p>""".trim
        sanPost(manyLines + "\n <script>var x;\n</script>\n \n") mustBe manyLines
      }
    }


    "sanitize internal links and quotes  TyT7J03SKD5" in {
      import TextAndHtml.{sanitizeInternalLinksAndQuotes => sanInt}
      sanInt("aa <script>alert(1)</script> <a>link</a>") mustBe "aa  <a>link</a>"
      sanInt("""<iframe src="https://z" sandbox="allow-scripts"></iframe>""") mustBe ""
      val t = """<div><a href="/page/path/">Page Title</a>""" +
              """<blockquote>Excerpt</blockquote></div>"""
      sanInt(t) mustBe t

      // Compact output: (no pretty printing and extra indentation)
      val t2 = i"""
          |<div>
          |  <a href="x">Pg T</a>
          |<blockquote>Bq
          |</blockquote>
          |</div>""".trim
      sanInt(t2) mustBe t2
    }


    "sanitize iframe  TyT603RKDL56" in {
      import TextAndHtml.{sanitizeAllowIframeOnly => sanIfr}
      sanIfr("<b>zz</b>") mustBe "zz"
      sanIfr("<script>alert(1)</script>") mustBe ""

      val ifr01 = """<iframe src="https://zzz" sandbox="allow-scripts"></iframe>"""
      sanIfr(ifr01) mustBe ifr01

      val ifr02 = """<iframe sandbox="allow-scripts" srcdoc="alert('hi')"></iframe>"""
      sanIfr(ifr02) mustBe ifr02
    }
  }


  "TextAndHtmlMaker can" - {

    val dummyHostname = "forum.example.com"

    val site: SiteIdHostnames = new SiteIdHostnames {
      val id: SiteId = NoSiteId
      val pubId = "123abc"
      val canonicalHostnameStr = Some(dummyHostname)
      val allHostnames: Seq[String] = canonicalHostnameStr.toSeq
      val status = SiteStatus.Active
      val featureFlags = ""
    }

    val maker: TextAndHtmlMaker = new TextAndHtmlMaker(site, nashorn = null)

    "find links  TyTMLFINDLNS" - {

      "empty text" in {
        val textAndHtml = maker.forHtmlAlready("")
        textAndHtml.externalLinks mustBe Seq()
        textAndHtml.extLinkDomains mustBe Set()
        textAndHtml.extLinkIpAddresses mustBe Seq()
      }

      "html without links" in {
        val textAndHtml = maker.forHtmlAlready("<h1>Title</h1><p>Hello</p>")
        textAndHtml.externalLinks mustBe Seq()
        textAndHtml.extLinkDomains mustBe Set()
        textAndHtml.extLinkIpAddresses mustBe Seq()
      }

      "one <a href=...> link" in {
        val textAndHtml = maker.forHtmlAlready("<a href='http://example.com/path'>A link</a>")
        textAndHtml.externalLinks mustBe Seq("http://example.com/path")
        textAndHtml.extLinkDomains mustBe Set("example.com")
        textAndHtml.extLinkIpAddresses mustBe Seq()
      }

      "blank <a href='  '> link" in {
        val textAndHtml = maker.forHtmlAlready("<a href='  '>A link</a>")
        textAndHtml.externalLinks mustBe Seq()
        textAndHtml.extLinkDomains mustBe Set()
        textAndHtml.extLinkIpAddresses mustBe Seq()
      }

      "an  <a>  but without href attr is no link" in {
        val textAndHtml = maker.forHtmlAlready("<a>Not a link</a>")
        textAndHtml.externalLinks mustBe Seq()
        textAndHtml.extLinkDomains mustBe Set()
        textAndHtml.extLinkIpAddresses mustBe Seq()
      }

      "Pre-formatted <pre> blocks can contain links" in {
        val textAndHtml = maker.forHtmlAlready(
          "<pre><a href='http://hello.ex.co/path'>A link</a></pre>")
        textAndHtml.externalLinks mustBe Seq("http://hello.ex.co/path")
        textAndHtml.extLinkDomains mustBe Set("hello.ex.co")
        textAndHtml.extLinkIpAddresses mustBe Seq()
      }

      "<img src=...> link" in {
        val textAndHtml = maker.forHtmlAlready("<img src='http://example2.com/one.jpg'>")
        textAndHtml.externalLinks mustBe Seq("http://example2.com/one.jpg")
        textAndHtml.extLinkDomains mustBe Set("example2.com")
        textAndHtml.extLinkIpAddresses mustBe Seq()
      }

      "ip address <a href> link" in {
        val textAndHtml = maker.forHtmlAlready("<a href='http://11.22.33.44/path'>A link</a>")
        textAndHtml.externalLinks mustBe Seq("http://11.22.33.44/path")
        textAndHtml.extLinkDomains mustBe Set()
        textAndHtml.extLinkIpAddresses mustBe Seq("11.22.33.44")
      }

      "ip address <img src> link" in {
        val textAndHtml = maker.forHtmlAlready("<img src='http://22.22.11.11/img.png'>")
        textAndHtml.externalLinks mustBe Seq("http://22.22.11.11/img.png")
        textAndHtml.extLinkDomains mustBe Set()
        textAndHtml.extLinkIpAddresses mustBe Seq("22.22.11.11")
      }

      "internal links" - {
        "no origin, just url path" in {
          val textAndHtml = maker.forHtmlAlready("<a href='/page/here'>Page here</a>")
          textAndHtml.internalLinks mustBe Set("/page/here")
          textAndHtml.externalLinks mustBe Nil
          textAndHtml.extLinkDomains mustBe Set()
          textAndHtml.extLinkIpAddresses mustBe Nil
        }

        "same origin" in {
          val textAndHtml = maker.forHtmlAlready(
                s"<a href='https://$dummyHostname/page2&query=param'>Page2</a>")
          // Includes url origin, although internal — good or bad?  [find_int_links]
          textAndHtml.internalLinks mustBe Set(s"https://$dummyHostname/page2&query=param")
          textAndHtml.externalLinks mustBe Nil
          textAndHtml.extLinkDomains mustBe Set()
          textAndHtml.extLinkIpAddresses mustBe Nil
        }
      }

      "Many links, incl <video>" in {
        val textAndHtml = maker.forHtmlAlready(o"""
           <img src='http://imgs.com/one.jpg'>
           <video src='http://vids.com/two.mp4'>
           <a href='/internal/slash/'>internal link 01</a>
           <a href='https://$dummyHostname/int02'>internal link 02</a>
           <a href='//$dummyHostname/no/scheme?only=path&query'>int link 03</a>
           <div><a href='http://hello.ex.co/path'>A link</a></div>
           <area href='http://1.2.3.4/path'>An ip addr</a>
           <b>Hello <a>not a link</a> and <img src="">not an img</img></b>
           """)
        textAndHtml.internalLinks mustBe Set(
              "/internal/slash/",
              s"https://$dummyHostname/int02",
              s"//$dummyHostname/no/scheme?only=path&query")
        textAndHtml.externalLinks.sorted mustBe Seq(
          "http://imgs.com/one.jpg",
          "http://vids.com/two.mp4",
          "http://hello.ex.co/path",
          "http://1.2.3.4/path").sorted
        textAndHtml.extLinkDomains mustBe Set("imgs.com", "vids.com", "hello.ex.co")
        textAndHtml.extLinkIpAddresses mustBe Seq("1.2.3.4")
      }

      TESTS_MISSING // ipv6 addr?
    }

  }

}
