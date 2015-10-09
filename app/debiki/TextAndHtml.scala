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

import com.debiki.core.Prelude._
import com.debiki.core.CommonMarkRenderer
import scala.collection.immutable



/** Immutable. Use linkDomains to check all links against a spam/evil-things domain block list
  * like Spamhaus DBL, https://www.spamhaus.org/faq/section/Spamhaus%20DBL#271.
  */
sealed trait TextAndHtml {

  def text: String

  def safeHtml: String

  def links: immutable.Seq[String]

  /** Domain names used in links. Check against a domain block list.
    */
  def linkDomains: immutable.Seq[String]

  /** Raw ip addresses (ipv4 or 6) of any links that use raw ip addresses rather than
    * domain names. If there is any, the post should probably be blocked as spam?
    */
  def linkAddresses: immutable.Seq[String]

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
}



object TextAndHtml {

  private class TextAndHtmlImpl(
    val text: String,
    val safeHtml: String,
    val links: immutable.Seq[String],
    val linkDomains: immutable.Seq[String],
    val linkAddresses: immutable.Seq[String],
    val isTitle: Boolean) extends TextAndHtml {

    def append(moreTextAndHtml: TextAndHtml): TextAndHtml = {
      val more = moreTextAndHtml.asInstanceOf[TextAndHtmlImpl]
      new TextAndHtmlImpl(
        text + "\n" + more.text,
        safeHtml + "\n" + more.safeHtml,
        (links.toSet ++ more.links.toSet).to[immutable.Seq],
        (linkDomains.toSet ++ more.linkDomains.toSet).to[immutable.Seq],
        (linkAddresses.toSet ++ more.linkAddresses.toSet).to[immutable.Seq],
        isTitle = isTitle && more.isTitle)
    }
  }

  val DefaultCommonMarkRenderer: CommonMarkRenderer = ReactRenderer
  val Ipv4AddressRegex = """[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+""".r

  def apply(
    text: String,
    isTitle: Boolean,
    followLinks: Boolean = false,
    allowClassIdDataAttrs: Boolean = false)(
    implicit
    commonMarkRenderer: CommonMarkRenderer = DefaultCommonMarkRenderer): TextAndHtml = {

    TESTS_MISSING
    if (isTitle) {
      val safeHtml = commonMarkRenderer.sanitizeHtml(text)
      new TextAndHtmlImpl(text, safeHtml, links = Nil, linkDomains = Nil,
        linkAddresses = Nil, isTitle = true)
    }
    else {
      val safeHtml = commonMarkRenderer.renderAndSanitizeCommonMark(
        text, allowClassIdDataAttrs = allowClassIdDataAttrs, followLinks = followLinks)
      val links = findLinks(safeHtml)
      var linkDomains = Vector[String]()
      var linkAddresses = Vector[String]()
      links foreach { link =>
        try {
          val uri = new java.net.URI(link)
          val domainOrAddress = uri.getHost
          if (domainOrAddress eq null) {
            // Relative link? Ignore.
          }
          else if (domainOrAddress contains ":") {
            die("DwE6GKW2")
          }
          else if (domainOrAddress.startsWith("[")) {
            // IPv6.
            linkAddresses :+= domainOrAddress
          }
          else if (Ipv4AddressRegex matches domainOrAddress) {
            linkAddresses :+= domainOrAddress
          }
          else {
            linkDomains :+= domainOrAddress
          }
        }
        catch {
          case ex: Exception =>
            // ignore, the href isn't a valid link, it seems
        }
      }
      new TextAndHtmlImpl(text, safeHtml, links = links, linkDomains = linkDomains,
        linkAddresses = linkAddresses, isTitle = true)
    }
  }


  def findLinks(html: String): immutable.Seq[String] = {
    TESTS_MISSING
    import org.jsoup.Jsoup
    import org.jsoup.nodes.Element
    import scala.collection.JavaConversions._
    var links = Vector[String]()
    val document = Jsoup.parse(html).body
    val linkElements: java.util.ArrayList[Element] = document.select("a")
    for (linkElement: Element <- linkElements) {
      val href = linkElement.attr("href")
      if ((href ne null) && href.nonEmpty) {
        links :+= href
      }
    }
    links
  }

}

