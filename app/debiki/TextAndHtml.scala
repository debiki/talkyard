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

import com.debiki.core._
import com.debiki.core.Prelude._
import org.scalactic.{ErrorMessage, Or}
import play.api.libs.json.JsArray
import scala.collection.{immutable, mutable}
import scala.util.matching.Regex
import TextAndHtmlMaker._



/** Immutable. Use linkDomains to check all links against a spam/evil-things domain block list
  * like Spamhaus DBL, https://www.spamhaus.org/faq/section/Spamhaus%20DBL#271.
  */
sealed trait TextAndHtml {

  def text: String

  def safeHtml: String

  def usernameMentions: Set[String]

  def links: immutable.Seq[String]

  /** Domain names used in links. Check against a domain block list.
    */
  def linkDomains: Set[String]

  /** Raw ip addresses (ipv4 or 6) of any links that use raw ip addresses rather than
    * domain names. If there is any, the post should probably be blocked as spam?
    */
  def linkIpAddresses: immutable.Seq[String]

  def isTitle: Boolean

  def htmlLinksOnePerLine: String = {
    TESTS_MISSING
    links map { href =>
      val hrefAttrEscaped = org.owasp.encoder.Encode.forHtmlAttribute(href)
      val hrefContentEscaped = org.owasp.encoder.Encode.forHtmlContent(href)
      s"""<a href="$hrefAttrEscaped">$hrefContentEscaped</a>"""
    } mkString "\n"
  }

  def append(moreTextAndHtml: TextAndHtml): TextAndHtml
  def append(text: String): TextAndHtml
}


object TextAndHtml {

  // Or could instead use  Nashorn.sanitizeHtml(text: String, followLinks: Boolean) ?
  // But it's slow, if importing a whole site. How deal with this?
  // Maybe just let admins-that-import-a-site set a flag that everything has been
  // sanitized already?_ COULD move server side js to external Nodejs or V8
  // processes? So as not to block a thread here, running Nashorn? [external-server-js]
  def relaxedHtmlTagWhitelist: org.jsoup.safety.Whitelist = {
    // The caller need to insert  rel=nofollow  henself, see the docs:
    // https://jsoup.org/apidocs/org/jsoup/safety/Whitelist.html#relaxed--
    org.jsoup.safety.Whitelist.relaxed().addAttributes("a", "rel")
  }
}


object TextAndHtmlMaker {

  val Ipv4AddressRegex: Regex = """[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+""".r


  def findLinks(html: String): immutable.Seq[String] = {
    // Tested here:  tests/app/debiki/TextAndHtmlTest.scala

    val result = mutable.ArrayBuffer[String]()

    val document = org.jsoup.Jsoup.parse(html)

    // There're  <a hre=...>, and also <area href=...> (that's a clickable map, its
    // contents defined by href links.)
    val hrefAttrElems: org.jsoup.select.Elements = document.select("[href]")

    // There're  <img> <video> <iframe> etc elems with src=...  links.
    val srcAttrElems: org.jsoup.select.Elements = document.select("[src]")

    import scala.collection.JavaConversions._

    for (elem: org.jsoup.nodes.Element <- hrefAttrElems) {
      addUrl(elem.attr("href"))
    }

    for (elem: org.jsoup.nodes.Element <- srcAttrElems) {
      addUrl(elem.attr("src"))
    }

    def addUrl(url: String): Unit = {
      if (url eq null) return
      val trimmed = url.trim
      if (trimmed.isEmpty) return
      result.append(trimmed)
    }

    result.toVector
  }

}



/** Thread safe.
  */
class TextAndHtmlMaker(pubSiteId: PubSiteId, nashorn: Nashorn) {

  private class TextAndHtmlImpl(
    val text: String,
    val safeHtml: String,
    val usernameMentions: Set[String],
    val links: immutable.Seq[String],
    val linkDomains: immutable.Set[String],
    val linkIpAddresses: immutable.Seq[String],
    val embeddedOriginOrEmpty: String,
    val isTitle: Boolean,
    val followLinks: Boolean,
    val allowClassIdDataAttrs: Boolean) extends TextAndHtml {

    def append(text: String): TextAndHtml = {
      append(new TextAndHtmlMaker(pubSiteId = pubSiteId, nashorn).apply(
        text, embeddedOriginOrEmpty = embeddedOriginOrEmpty,
        isTitle = isTitle, followLinks = followLinks,
        allowClassIdDataAttrs = allowClassIdDataAttrs))
    }

    def append(moreTextAndHtml: TextAndHtml): TextAndHtml = {
      val more = moreTextAndHtml.asInstanceOf[TextAndHtmlImpl]
      if (!nashorn.globals.isProd) {
        dieIf(followLinks != more.followLinks, "TyE306MKSLN2")
        dieIf(embeddedOriginOrEmpty != more.embeddedOriginOrEmpty, "TyE306MKSLN3")
      }

      new TextAndHtmlImpl(
        text + "\n" + more.text,
        safeHtml + "\n" + more.safeHtml,
        usernameMentions = usernameMentions ++ more.usernameMentions,
        (links.toSet ++ more.links.toSet).to[immutable.Seq],
        linkDomains ++ more.linkDomains,
        (linkIpAddresses.toSet ++ more.linkIpAddresses.toSet).to[immutable.Seq],
        embeddedOriginOrEmpty = embeddedOriginOrEmpty,
        isTitle = isTitle && more.isTitle,
        followLinks = followLinks,
        allowClassIdDataAttrs = allowClassIdDataAttrs)
    }
  }


  def withCompletedFormData(formInputs: String): TextAndHtml Or ErrorMessage = {
    CompletedFormRenderer.renderJsonToSafeHtml(formInputs) map { htmlString =>
      new TextAndHtmlImpl(text = formInputs.toString, safeHtml = htmlString,
          // Don't let people @mention anyone when submitting forms?  (5LKATS0)
          // @mentions are only for members who post comments & topics to each other, right.
          usernameMentions = Set.empty,
          links = Nil, linkDomains = Set.empty,
          linkIpAddresses = Nil, embeddedOriginOrEmpty = "",
          isTitle = false, followLinks = false, allowClassIdDataAttrs = false)
    }
  }


  def withCompletedFormData(formInputs: JsArray): TextAndHtml Or ErrorMessage = {
    CompletedFormRenderer.renderJsonToSafeHtml(formInputs) map { htmlString =>
      new TextAndHtmlImpl(text = formInputs.toString, safeHtml = htmlString,
          usernameMentions = Set.empty, // (5LKATS0)
          Nil, Set.empty, Nil, embeddedOriginOrEmpty = "", false, false, false)
    }
  }


  def forTitle(title: String): TextAndHtml =
    apply(title, embeddedOriginOrEmpty = "",
      isTitle = true, followLinks = false, allowClassIdDataAttrs = false)

  def forBodyOrComment(text: String, embeddedOriginOrEmpty: String = "",
        followLinks: Boolean = false, allowClassIdDataAttrs: Boolean = false): TextAndHtml =
    apply(text, embeddedOriginOrEmpty = embeddedOriginOrEmpty,
      isTitle = false, followLinks = followLinks,
      allowClassIdDataAttrs = allowClassIdDataAttrs)

  // COULD escape all CommonMark so becomes real plain text
  def forBodyOrCommentAsPlainTextWithLinks(text: String): TextAndHtml =
    apply(text, embeddedOriginOrEmpty = "",
      isTitle = false, followLinks = false, allowClassIdDataAttrs = false)

  def forHtmlAlready(html: String): TextAndHtml = {
    findLinksEtc(html, RenderCommonmarkResult(html, Set.empty),
        embeddedOriginOrEmpty = "",
        followLinks = false, allowClassIdDataAttrs = false)
  }

  private def apply(
    text: String,
    isTitle: Boolean,
    embeddedOriginOrEmpty: String,
    followLinks: Boolean,
    allowClassIdDataAttrs: Boolean): TextAndHtml = {

    TESTS_MISSING
    if (isTitle) {
      val safeHtml = nashorn.sanitizeHtml(text, followLinks = false)
      new TextAndHtmlImpl(text, safeHtml, links = Nil, usernameMentions = Set.empty,
        linkDomains = Set.empty,
        linkIpAddresses = Nil,
        embeddedOriginOrEmpty = embeddedOriginOrEmpty,
        isTitle = true, followLinks = followLinks,
        allowClassIdDataAttrs = allowClassIdDataAttrs)
    }
    else {
      val renderResult = nashorn.renderAndSanitizeCommonMark(
        text, pubSiteId = pubSiteId,
        embeddedOriginOrEmpty = embeddedOriginOrEmpty,
        allowClassIdDataAttrs = allowClassIdDataAttrs, followLinks = followLinks)
      findLinksEtc(text, renderResult, embeddedOriginOrEmpty = embeddedOriginOrEmpty,
        followLinks = followLinks, allowClassIdDataAttrs = allowClassIdDataAttrs)
    }
  }

  private def findLinksEtc(text: String, renderResult: RenderCommonmarkResult,
        embeddedOriginOrEmpty: String,
        followLinks: Boolean, allowClassIdDataAttrs: Boolean): TextAndHtmlImpl = {
      val links = findLinks(renderResult.safeHtml)
      var linkDomains = Set[String]()
      var linkAddresses = Vector[String]()
      links foreach { link =>
        try {
          val uri = new java.net.URI(link)
          val domainOrAddress = uri.getHost
          if (domainOrAddress eq null) {
            // Relative link? Ignore.
          }
          else if (domainOrAddress.startsWith("[")) {
            if (domainOrAddress.endsWith("]")) {
              // IPv6.
              linkAddresses :+= domainOrAddress
            }
            else {
              // Weird.
              die("TyE305WKUDW2", s"Weird url, starts with '[' but no ']': $domainOrAddress")
            }
          }
          else if (domainOrAddress contains ":") {
            // Cannot happen? Java's getHost() returns the hostname, no port. Instead,
            // getAuthority() includess any port (but not http(s)://).
            die("TyE603KUPRSDJ3", s"Weird url, includes ':': $domainOrAddress")
          }
          else if (Ipv4AddressRegex matches domainOrAddress) {
            linkAddresses :+= domainOrAddress
          }
          else {
            linkDomains += domainOrAddress
          }
        }
        catch {
          case _: Exception =>
            // ignore, the href isn't a valid link, it seems
        }
      }
      new TextAndHtmlImpl(text, renderResult.safeHtml, usernameMentions = renderResult.mentions,
        links = links, linkDomains = linkDomains,
        linkIpAddresses = linkAddresses,
        embeddedOriginOrEmpty = embeddedOriginOrEmpty,
        isTitle = false, followLinks = followLinks,
        allowClassIdDataAttrs = allowClassIdDataAttrs)
  }


  /** Creates an instance with both the source and the rendered html set to `text`.
    * This is useful in test suites, because they'll run a lot faster when they won't
    * have to wait for the commonmark renderer to be created.
    */
  def test(text: String, isTitle: Boolean): TextAndHtml = {
    dieIf(Globals.isProd, "EsE7GPM2")
    new TextAndHtmlImpl(text, text, links = Nil, usernameMentions = Set.empty,
      linkDomains = Set.empty, linkIpAddresses = Nil,
      embeddedOriginOrEmpty = "", isTitle = isTitle, followLinks = false,
      allowClassIdDataAttrs = false)
  }

  def testTitle(text: String): TextAndHtml = test(text, isTitle = true)
  def testBody(text: String): TextAndHtml = test(text, isTitle = false)

  def wrapInParagraphNoMentionsOrLinks(text: String, isTitle: Boolean): TextAndHtml = {
    new TextAndHtmlImpl(text, s"<p>$text</p>", usernameMentions = Set.empty,
      links = Nil, linkDomains = Set.empty,
      linkIpAddresses = Nil, embeddedOriginOrEmpty = "",
      isTitle = isTitle, followLinks = false,
      allowClassIdDataAttrs = false)
  }

}

