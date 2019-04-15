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
import scala.collection.immutable
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


object TextAndHtmlMaker {

  val Ipv4AddressRegex: Regex = """[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+""".r

}


/** Thread safe.
  */
class TextAndHtmlMaker(pubSiteId: PublSiteId, nashorn: Nashorn) {

  private class TextAndHtmlImpl(
    val text: String,
    val safeHtml: String,
    val usernameMentions: Set[String],
    val links: immutable.Seq[String],
    val linkDomains: immutable.Set[String],
    val linkIpAddresses: immutable.Seq[String],
    val isTitle: Boolean,
    val followLinks: Boolean,
    val allowClassIdDataAttrs: Boolean) extends TextAndHtml {

    def append(text: String): TextAndHtml = {
      append(new TextAndHtmlMaker(pubSiteId, nashorn).apply(
        text, isTitle = isTitle, followLinks = followLinks,
        allowClassIdDataAttrs = allowClassIdDataAttrs))
    }

    def append(moreTextAndHtml: TextAndHtml): TextAndHtml = {
      val more = moreTextAndHtml.asInstanceOf[TextAndHtmlImpl]
      new TextAndHtmlImpl(
        text + "\n" + more.text,
        safeHtml + "\n" + more.safeHtml,
        usernameMentions = usernameMentions ++ more.usernameMentions,
        (links.toSet ++ more.links.toSet).to[immutable.Seq],
        linkDomains ++ more.linkDomains,
        (linkIpAddresses.toSet ++ more.linkIpAddresses.toSet).to[immutable.Seq],
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
          Nil, Set.empty, Nil, false, false, false)
    }
  }


  def withCompletedFormData(formInputs: JsArray): TextAndHtml Or ErrorMessage = {
    CompletedFormRenderer.renderJsonToSafeHtml(formInputs) map { htmlString =>
      new TextAndHtmlImpl(text = formInputs.toString, safeHtml = htmlString,
          usernameMentions = Set.empty, // (5LKATS0)
          Nil, Set.empty, Nil, false, false, false)
    }
  }


  def forTitle(title: String): TextAndHtml =
    apply(title, isTitle = true, followLinks = false, allowClassIdDataAttrs = false)


  def forBodyOrComment(text: String, followLinks: Boolean = false,
        allowClassIdDataAttrs: Boolean = false): TextAndHtml =
    apply(text, isTitle = false, followLinks = followLinks,
      allowClassIdDataAttrs = allowClassIdDataAttrs)

  // COULD escape all CommonMark so becomes real plain text
  def forBodyOrCommentAsPlainTextWithLinks(text: String): TextAndHtml =
    apply(text, isTitle = false, followLinks = false, allowClassIdDataAttrs = false)

  private def apply(
    text: String,
    isTitle: Boolean,
    followLinks: Boolean,
    allowClassIdDataAttrs: Boolean): TextAndHtml = {

    TESTS_MISSING
    if (isTitle) {
      val safeHtml = nashorn.sanitizeHtml(text, followLinks = false)
      new TextAndHtmlImpl(text, safeHtml, links = Nil, usernameMentions = Set.empty,
        linkDomains = Set.empty,
        linkIpAddresses = Nil, isTitle = true, followLinks = followLinks,
        allowClassIdDataAttrs = allowClassIdDataAttrs)
    }
    else {
      val renderResult = nashorn.renderAndSanitizeCommonMark(
        text, pubSiteId = pubSiteId,
        allowClassIdDataAttrs = allowClassIdDataAttrs, followLinks = followLinks)
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
        linkIpAddresses = linkAddresses, isTitle = false, followLinks = followLinks,
        allowClassIdDataAttrs = allowClassIdDataAttrs)
    }
  }


  /** Creates an instance with both the source and the rendered html set to `text`.
    * This is useful in test suites, because they'll run a lot faster when they won't
    * have to wait for the commonmark renderer to be created.
    */
  def test(text: String, isTitle: Boolean): TextAndHtml = {
    dieIf(Globals.isProd, "EsE7GPM2")
    new TextAndHtmlImpl(text, text, links = Nil, usernameMentions = Set.empty,
      linkDomains = Set.empty, linkIpAddresses = Nil, isTitle = isTitle, followLinks = false,
      allowClassIdDataAttrs = false)
  }

  def testTitle(text: String): TextAndHtml = test(text, isTitle = true)
  def testBody(text: String): TextAndHtml = test(text, isTitle = false)

  def wrapInParagraphNoMentionsOrLinks(text: String, isTitle: Boolean): TextAndHtml = {
    new TextAndHtmlImpl(text, s"<p>$text</p>", usernameMentions = Set.empty,
      links = Nil, linkDomains = Set.empty,
      linkIpAddresses = Nil, isTitle = isTitle, followLinks = false,
      allowClassIdDataAttrs = false)
  }

  def findLinks(html: String): immutable.Seq[String] = {
    SECURITY; SHOULD // find all src=... links too, e.g. <img src=...>, not just <a href=...>.
                    // And thereafter, could use TextAndHtml in UploadsDao.findUploadRefsInText ?
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

