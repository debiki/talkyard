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
import debiki.dao.UploadsDao
import org.jsoup.Jsoup
import org.jsoup.safety.Whitelist


/** Immutable.
  */
sealed abstract class SourceAndHtml {
  def source: String
  def text: String  // deprecated
  def safeHtml: String

  REMOVE // from here later, only here for now so [52TKTSJ5] compiles.
  def uploadRefs: Set[UploadRef] = Set.empty
  def internalLinks: Set[String] = Set.empty

  // sourceMarkupLang: MarkupLang  // maybe later?
}


sealed trait TitleSourceAndHtml extends SourceAndHtml {
  def source: String
  def safeHtml: String
}


object TitleSourceAndHtml {
  def alreadySanitized(source: String, safeHtml: String): TitleSourceAndHtml = {
    // (These xParam avoid `def x = x`, which the compiler apparently tail optimizes
    // into a forever eternal loop.)
    val sourceParam = source
    val safeHtmlParam = safeHtml
    new TitleSourceAndHtml {
      def source: String = sourceParam
      def text: String = sourceParam
      def safeHtml: String = safeHtmlParam
    }
  }

  def apply(source: String): TitleSourceAndHtml = {
    val safeHtml = TextAndHtml.sanitizeTitleText(source)
    alreadySanitized(source, safeHtml = safeHtml)
  }
}


case class LinksFound(
  uploadRefs: Set[UploadRef],
  externalLinks: immutable.Seq[String],
  internalLinks: Set[String],
  extLinkDomains: Set[String],
  extLinkIpAddresses: immutable.Seq[String])



/** Immutable. Use linkDomains to check all links against a spam/evil-things domain block list
  * like Spamhaus DBL, https://www.spamhaus.org/faq/section/Spamhaus%20DBL#271.
  */
sealed abstract class TextAndHtml extends SourceAndHtml {  RENAME // to PostSourceAndHtml ?

  def text: String  ; RENAME // to source
  def source: String = text

  def safeHtml: String

  def usernameMentions: Set[String]

  def uploadRefs: Set[UploadRef]

  /** Maybe convert all absolute url links to just url path-query-hash (uri)?
    * Relative links are better, for internal links — still works, if
    * moves website to other domain (and no real downsides — e.g. if an
    * attacker wants to clone the site, a regex-replace origin is quick).
    * See *the first reply* here:
    * https://moz.com/blog/relative-vs-absolute-urls-whiteboard-friday
    */
  override def internalLinks: Set[String]

  def externalLinks: immutable.Seq[String]

  /** Domain names used in links. Check against a domain block list.
    */
  def extLinkDomains: Set[String]

  /** Raw ip addresses (ipv4 or 6) of any links that use raw ip addresses rather than
    * domain names. If there is any, the post should probably be blocked as spam?
    */
  def extLinkIpAddresses: immutable.Seq[String]

  def externalLinksOnePerLineHtml: String = {  // [4KTF0WCR]
    TESTS_MISSING
    externalLinks map { href =>
      val hrefAttrEscaped = org.owasp.encoder.Encode.forHtmlAttribute(href)
      val hrefContentEscaped = org.owasp.encoder.Encode.forHtmlContent(href)
      s"""<a href="$hrefAttrEscaped">$hrefContentEscaped</a>"""
    } mkString "\n"
  }

  def append(moreTextAndHtml: TextAndHtml): TextAndHtml
  def append(text: String): TextAndHtml
}


object TextAndHtml {

  /** The result can be incl in html anywhere: As html tags contents, or
    * in a html attribute — but you need to add the attr quotes youreslf (!).
    */
  def safeEncodeForHtml(unsafe: String): String = {
    org.owasp.encoder.Encode.forHtml(unsafe)
  }

  /** Can *only* be incl in html attributes — not as tags contents.
    * You need to add the attr quotes yourself (!).
    */
  def safeEncodeForHtmlAttrOnly(unsafe: String): String = {
    org.owasp.encoder.Encode.forHtmlAttribute(unsafe)
  }

  /** Can *only* be incl as html tags contents — *not* in an attribute.
    */
  def safeEncodeForHtmlContentOnly(unsafe: String): String = {
    org.owasp.encoder.Encode.forHtmlContent(unsafe)
  }

  /** Sanitizes title html. The result is html tags content
    * — can *not* be incl in an attribute.
    */
  def sanitizeTitleText(unsafe: String): String = {
    // Tested here: TyT6RKKDJ563
    compactClean(unsafe, titleHtmlTagsWhitelist)
  }

  /** More restrictive than Jsoup's basic() whitelist.
    */
  private def titleHtmlTagsWhitelist: org.jsoup.safety.Whitelist = {
    new Whitelist().addTags(
          "b", "code", "em",
          "i", "q", "small", "span", "strike", "strong", "sub",
          "sup", "u")
  }

  def sanitizeInternalLinksAndQuotes(unsafeHtml: String): String = {
    // TyT7J03SKD5
    compactClean(unsafeHtml,  new Whitelist()
          .addTags("a", "div", "blockquote")
          .addAttributes("a", "href"))
  }

  def sanitizeAllowIframeOnly(unsafeHtml: String): String = {
    // TyT603RKDL56
    compactClean(unsafeHtml, new org.jsoup.safety.Whitelist()
          .addTags("iframe")
          .addAttributes("iframe", "src", "srcdoc", "sandbox"))
  }

  /** Links will have rel="nofollow noopener". Images, pre, div allowed.
    */
  def sanitizeAllowLinksAndBlocks(unsafeHtml: String,
        amendWhitelistFn: Whitelist => Whitelist = x => x): String = {
    var whitelist = org.jsoup.safety.Whitelist.basic()
    whitelist = addRelNofollowNoopener(amendWhitelistFn(whitelist))
    compactClean(unsafeHtml, whitelist)
  }

  /** Links will have rel="nofollow noopener". ul, ol, code, blockquote and
    * much more is allowed.
    *
    * Or could instead use  Nashorn.sanitizeHtml(text: String, followLinks: Boolean) ?
    * But it's slow, if importing a whole site. How deal with this?
    * Maybe just let admins-that-import-a-site set a flag that everything has been
    * sanitized already?_ COULD move server side js to external Nodejs or V8
    * processes? So as not to block a thread here, running Nashorn? [external-server-js]
    *
    * ... Hmm, I think, instead, the answer:   [html_json]  [save_post_lns_mentions]
    * Always incl both source text and sanitized html in posts_t (posts3),
    * and when importing. Then, no need to CommonMark-render any
    * imported contents — that'd be done already. However, quickly sanitizing
    * the  already-sanitized-html  via Jsoup is ok fast and still good to do?
    */
  def sanitizeRelaxed(unsafeHtml: String,
        amendWhitelistFn: Whitelist => Whitelist = x => x): String = {
    // Tested here: TyT03386KTDGR
    var whitelist = org.jsoup.safety.Whitelist.relaxed()
          // .removeTags("h1", "h2") // [disallow_h1_h2] — wait, breaks tests.
    whitelist = addRelNofollowNoopener(amendWhitelistFn(whitelist))
    compactClean(unsafeHtml, whitelist)
  }

  private def addRelNofollowNoopener(whitelist: Whitelist): Whitelist = {
    // rel=nofollow not included by default, in the relaxed() whitelist,
    // see: https://jsoup.org/apidocs/org/jsoup/safety/Whitelist.html#relaxed()
    // Also add rel="noopener", in case of target="_blank" links.
    COULD_OPTIMIZE // only nofollow for external links, and noopener only if target=_blank.
    // And don't remove target="_blank"  (Whitelist.relaxed() removes target=... ).
    whitelist.addEnforcedAttribute("a", "rel", "nofollow noopener")
  }

  private def compactClean(unsafeHtml: String, whitelist: Whitelist): String = {
    Jsoup.clean(unsafeHtml, "", whitelist, compactJsoupOutputSettings).trim()
  }

  def compactJsoupOutputSettings: org.jsoup.nodes.Document.OutputSettings =
    new org.jsoup.nodes.Document.OutputSettings().indentAmount(0).prettyPrint(false)
}


case class JsoupLinkElems(
  hrefAttrElems: mutable.Buffer[org.jsoup.nodes.Element],
  srcAttrElems: mutable.Buffer[org.jsoup.nodes.Element])


object TextAndHtmlMaker {   MOVE // to just  TextAndHtml

  val Ipv4AddressRegex: Regex = """[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+""".r


  def findLinks(html: String): immutable.Seq[String] = {
    // Tested here:  tests/app/debiki/TextAndHtmlTest.scala

    val result = mutable.ArrayBuffer[String]()

    val document = org.jsoup.Jsoup.parse(html)

    val JsoupLinkElems(
          hrefAttrElems,
          srcAttrElems) = jsoupFindLinks(document)

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

  def jsoupFindLinks(doc: org.jsoup.nodes.Document): JsoupLinkElems = {
    // There're  <a hre=...>, and also <area href=...> (that's a clickable map, its
    // contents defined by href links.)
    val hrefAttrElems: org.jsoup.select.Elements = doc.select("[href]")

    // There're  <img> <video> <iframe> etc elems with src=...  links.
    val srcAttrElems: org.jsoup.select.Elements = doc.select("[src]")

    import scala.collection.JavaConverters._
    JsoupLinkElems(
          hrefAttrElems = hrefAttrElems.asScala,
          srcAttrElems = srcAttrElems.asScala)
  }
}



/** Thread safe.
  */
class TextAndHtmlMaker(val site: SiteIdHostnames, nashorn: Nashorn) {

  private class TextAndHtmlImpl(
    val text: String,
    val safeHtml: String,
    val usernameMentions: Set[String],
    override val uploadRefs: Set[UploadRef],
    override val internalLinks: Set[String],
    val externalLinks: immutable.Seq[String],
    val extLinkDomains: immutable.Set[String],
    val extLinkIpAddresses: immutable.Seq[String],
    val embeddedOriginOrEmpty: String,
    val followLinks: Boolean,
    val allowClassIdDataAttrs: Boolean) extends TextAndHtml {

    def append(text: String): TextAndHtml = {
      append(new TextAndHtmlMaker(site = site, nashorn).apply(
        text, embeddedOriginOrEmpty = embeddedOriginOrEmpty,
        followLinks = followLinks,
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
        uploadRefs = uploadRefs ++ more.uploadRefs,
        // CLEAN_UP this  toSet  toSeq  makes no sense.
        externalLinks = (externalLinks.toSet ++ more.externalLinks.toSet).to[immutable.Seq],
        internalLinks = internalLinks ++ more.internalLinks,
        extLinkDomains = extLinkDomains ++ more.extLinkDomains,
        extLinkIpAddresses = (extLinkIpAddresses.toSet ++
              more.extLinkIpAddresses.toSet).to[immutable.Seq],
        embeddedOriginOrEmpty = embeddedOriginOrEmpty,
        followLinks = followLinks,
        allowClassIdDataAttrs = allowClassIdDataAttrs)
    }
  }


  def withCompletedFormData(formInputs: String): TextAndHtml Or ErrorMessage = {
    CompletedFormRenderer.renderJsonToSafeHtml(formInputs) map { htmlString =>
      new TextAndHtmlImpl(text = formInputs.toString, safeHtml = htmlString,
          // Don't let people @mention anyone when submitting forms?  (5LKATS0)
          // @mentions are only for members who post comments & topics to each other, right.
          // Hmm but probably should analyze links! Well this not in use
          // now anyway, except for via UTX.
          usernameMentions = Set.empty, uploadRefs = Set.empty,
          internalLinks = Set.empty, externalLinks = Nil, extLinkDomains = Set.empty,
          extLinkIpAddresses = Nil, embeddedOriginOrEmpty = "",
          followLinks = false, allowClassIdDataAttrs = false)
    }
  }


  def withCompletedFormData(formInputs: JsArray): TextAndHtml Or ErrorMessage = {
    CompletedFormRenderer.renderJsonToSafeHtml(formInputs) map { htmlString =>
      new TextAndHtmlImpl(text = formInputs.toString, safeHtml = htmlString,
            usernameMentions = Set.empty, // (5LKATS0)
            uploadRefs = Set.empty,
            internalLinks = Set.empty, externalLinks = Nil,
            extLinkDomains = Set.empty,
            extLinkIpAddresses = Nil, embeddedOriginOrEmpty = "",
            followLinks = false, allowClassIdDataAttrs = false)
    }
  }


  CLEAN_UP; REMOVE
  def forTitle(title: String): TitleSourceAndHtml =
    TitleSourceAndHtml(title)

  def forBodyOrComment(text: String, embeddedOriginOrEmpty: String = "",
        followLinks: Boolean = false, allowClassIdDataAttrs: Boolean = false): TextAndHtml =
    apply(text, embeddedOriginOrEmpty = embeddedOriginOrEmpty,
          followLinks = followLinks, allowClassIdDataAttrs = allowClassIdDataAttrs)

  // COULD escape all CommonMark so becomes real plain text
  def forBodyOrCommentAsPlainTextWithLinks(text: String): TextAndHtml =
    apply(text, embeddedOriginOrEmpty = "",
          followLinks = false, allowClassIdDataAttrs = false)

  def forHtmlAlready(html: String): TextAndHtml = {
    findLinksEtc(html, RenderCommonmarkResult(html, Set.empty),
        embeddedOriginOrEmpty = "",
        followLinks = false, allowClassIdDataAttrs = false)
  }

  private def apply(
    text: String,
    embeddedOriginOrEmpty: String,
    followLinks: Boolean,
    allowClassIdDataAttrs: Boolean): TextAndHtml = {

    val renderResult = nashorn.renderAndSanitizeCommonMark(
          text, site, embeddedOriginOrEmpty = embeddedOriginOrEmpty,
          allowClassIdDataAttrs = allowClassIdDataAttrs, followLinks = followLinks)
    findLinksEtc(text, renderResult, embeddedOriginOrEmpty = embeddedOriginOrEmpty,
          followLinks = followLinks, allowClassIdDataAttrs = allowClassIdDataAttrs)
  }


  private def findLinksEtc(text: String, renderResult: RenderCommonmarkResult,
        embeddedOriginOrEmpty: String, followLinks: Boolean,
        allowClassIdDataAttrs: Boolean): TextAndHtmlImpl = {
    val linksFound = findLinksAndUplRefs(renderResult.safeHtml)
    new TextAndHtmlImpl(
          text,
          safeHtml = renderResult.safeHtml,
          usernameMentions = renderResult.mentions,
          uploadRefs = linksFound.uploadRefs,
          internalLinks = linksFound.internalLinks,
          externalLinks = linksFound.externalLinks,
          extLinkDomains = linksFound.extLinkDomains,
          extLinkIpAddresses = linksFound.extLinkIpAddresses,
          embeddedOriginOrEmpty = embeddedOriginOrEmpty,
          followLinks = followLinks,
          allowClassIdDataAttrs = allowClassIdDataAttrs)
  }


  // Break out, make static, so more testable? Pass  site: SiteIdHostnames.
  // Tests in:  class TextAndHtmlTest  TyTMLFINDLNS
  //
  def findLinksAndUplRefs(safeHtml: String): LinksFound = {

    val allLinks: Seq[String] = TextAndHtmlMaker.findLinks(safeHtml)

    val uploadRefs: Set[UploadRef] =
          UploadsDao.findUploadRefsInLinks(allLinks.toSet, site.pubId)

    var internalLinks = Set[String]()
    var externalLinks = Vector[String]()
    var extLinkDomains = Set[String]()
    var extLinkIpAddresses = Vector[String]()

    allLinks foreach { link: String =>
      try {
        val uri = new java.net.URI(link)
        val domainOrAddress = uri.getHost  // can be null, fine
        if (domainOrAddress eq null) {
          internalLinks += link
        }
        else {
          // Would it be good if hosts3 included any non-standard port number,
          // and protocol? In case an old origin was, say, http://ex.com:8080,
          // and there was a different site at  http://ex.com  (port 80) ?
          // So we won't mistake links to origin = ex.com  for pointing
          // to http://ex.com:8080?  [remember_port]
          // Doesn't matter in real life, with just http = 80 and https = 443.
          val isSameHostname = site.allHostnames.contains(  // [find_int_links]
                domainOrAddress)

          val isInternal = isSameHostname
          if (isInternal) {
            internalLinks += link  // or remove origin, keep only url path-query-hash?
          }
          else {
            externalLinks :+= link
          }

          if (isInternal) {
            // Noop, already added to internalLinks.
          }
          else if (domainOrAddress.startsWith("[")) {
            if (domainOrAddress.endsWith("]")) {
              // IPv6.
              extLinkIpAddresses :+= domainOrAddress
            }
            else {
              // Weird. Just skip this not-a-link, if prod?
              dieIf(Globals.isDevOrTest, "TyE305WKUDW2",
                    s"Weird url, starts with '[' but no ']': $domainOrAddress")
            }
          }
          else if (domainOrAddress contains ":") {
            // Cannot happen? Java's getHost() returns the hostname, no port. Instead,
            // getAuthority() includess any port (but not http(s)://).
            die("TyE603KUPRSDJ3", s"Weird url, includes ':': $domainOrAddress")
          }
          else if (Ipv4AddressRegex matches domainOrAddress) {
            extLinkIpAddresses :+= domainOrAddress
          }
          else {
            extLinkDomains += domainOrAddress
          }
        }
      }
      catch {
        case _: Exception =>
          // ignore, the href isn't a valid link, it seems
      }
    }

    LinksFound(
          uploadRefs = uploadRefs,
          internalLinks = internalLinks,
          externalLinks = externalLinks,
          extLinkDomains = extLinkDomains,
          extLinkIpAddresses = extLinkIpAddresses)
  }


  /** Creates an instance with both the source and the rendered html set to `text`.
    * This is useful in test suites, because they'll run a lot faster when they won't
    * have to wait for the commonmark renderer to be created.
    */
  def test(text: String): TextAndHtml = {
    dieIf(Globals.isProd, "EsE7GPM2")
    new TextAndHtmlImpl(
          text, safeHtml = text, usernameMentions = Set.empty, uploadRefs = Set.empty,
          internalLinks = Set.empty, externalLinks = Nil,
          extLinkDomains = Set.empty, extLinkIpAddresses = Nil,
          embeddedOriginOrEmpty = "", followLinks = false,
          allowClassIdDataAttrs = false)
  }

  CLEAN_UP; REMOVE // later, just don't want the diff too large now
  def testTitle(text: String): TitleSourceAndHtml =
    TitleSourceAndHtml.alreadySanitized(text, safeHtml = text)

  def testBody(text: String): TextAndHtml = test(text)

}



case class SafeStaticSourceAndHtml(
  override val source: String,
  override val safeHtml: String) extends TextAndHtml {

  // Shouldn't be any links, mentions, tags in static default topics html.
  dieIf((safeHtml.contains("href") || safeHtml.contains("@") || safeHtml.contains("#"))
            && Globals.isDevOrTest,  // DO_AFTER 2020-10-01 enable this dieIf() always
        "TyE4925KSTD",
        s"Links/mentions/tags in internal static safeHtml: '$safeHtml'")

  override def text: String = source
  override def usernameMentions: Set[String] = Set.empty
  override def uploadRefs: Set[UploadRef] = Set.empty
  override def internalLinks: Set[String] = Set.empty
  override def externalLinks: immutable.Seq[String] = Nil
  override def extLinkDomains: Set[String] = Set.empty
  override def extLinkIpAddresses: immutable.Seq[String] = Nil
  override def append(moreTextAndHtml: TextAndHtml): TextAndHtml = die("TyE50396SK")
  override def append(text: String): TextAndHtml = die("TyE703RSKTDH")
}
