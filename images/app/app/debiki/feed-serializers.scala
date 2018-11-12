/**
 * Copyright (c) 2012, 2018 Kaj Magnus Lindberg
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
import java.{io => jio, util => ju}
import org.jsoup.Jsoup
import scala.collection.immutable
import _root_.scala.xml.{Attribute, Elem, Node, NodeSeq, Text, XML}
import Prelude._
import controllers.routes
import debiki.dao.PageStuff


/**
  * Descr of all Atom tags: https://validator.w3.org/feed/docs/atom.html
  */
object AtomFeedXml {   // RENAME file, and class? to AtomFeedBuilder?

  /**
   * See http://www.atomenabled.org/developers/syndication/.
   * Include in HTML e.g. like so:
   *   <link href="path/to/atom.xml" type="application/atom+xml"
   *        rel="alternate" title="Sitewide ATOM Feed" />
   *
   * feedId: Identifies the feed using a universally unique and
   * permanent URI. If you have a long-term, renewable lease on your
   * Internet domain name, then you can feel free to use your website's
   * address.
   * feedTitle: a human readable title for the feed. Often the same as
   * the title of the associated website.
   * feedMtime: Indicates the last time the feed was modified
   * in a significant way.
   */
  def renderFeed(hostUrl: String, posts: immutable.Seq[Post], pageStuffById: Map[PageId, PageStuff]
        ): Node = {

    // Based on the Atom XML shown here:
    //   http://exploring.liftweb.net/master/index-15.html#toc-Section-15.7

    if (!hostUrl.startsWith("http"))
      warnDbgDie("Bad host URL: "+ safed(hostUrl))

    val baseUrl = hostUrl +"/"
    def urlTo(pp: PagePath) = baseUrl + pp.value.dropWhile(_ == '/')

    def atomEntryFor(post: Post, page: PageStuff): NodeSeq = {
      //val pageBodyAuthor =
      //      pageBody.user.map(_.displayName) getOrElse "(Author name unknown)"
      val urlToPage = hostUrl + "/-" + page.pageId  // for now

      // Convert HTML to XHTML.
      // Atom parsers wants xml — they apparently choke on unclosed html tags.
      // Need to add closing tags, e.g. <p>...</p>, and convert entities like &nbsp; to &#xa0;
      // — &nbsp; is not valid xhtml.
      // (Could strip tag ids and class names? They make no sense in atom feeds?
      // No CSS or JS that cares about them anyway?)
      val jsoupDoc = Jsoup.parse(post.approvedHtmlSanitized getOrElse "<i>Text not yet approved</i>")
      jsoupDoc.outputSettings()
        .charset(java.nio.charset.StandardCharsets.UTF_8)
        .syntax(org.jsoup.nodes.Document.OutputSettings.Syntax.xml)
        .escapeMode(org.jsoup.nodes.Entities.EscapeMode.xhtml)
      val postXhtml: String = jsoupDoc.body().html()

      <entry>{
        /* Identifies the entry using a universally unique and
        permanent URI. */}
        <id>{urlToPage + "#post-" + post.nr}</id>{
        /* Contains a human readable title for the entry. */}
        <title>{page.title}</title>{
        /* Indicates the last time the entry was modified in a
        significant way. This value need not change after a typo is
        fixed, only after a substantial modification.
        COULD introduce a page's updatedTime?
        */}
        <updated>{toIso8601T(post.createdAt)}</updated>{
        /* Names one author of the entry. An entry may have multiple
        authors. An entry must [sometimes] contain at least one author
        element [...] More info here:
          http://www.atomenabled.org/developers/syndication/
                                                #recommendedEntryElements  */}
        {/*<author><name>{post}</name></author>*/}{
        /* The time of the initial creation or first availability
        of the entry.  -- but that shouldn't be the ctime, the page
        shouldn't be published at creation.
        COULD indroduce a page's publishedTime? publishing time?
        <published>{toIso8601T(ctime)}</published> */
        /* Identifies a related Web page. */}
        <link rel="alternate" href={urlToPage}/>{
        /* Contains or links to the complete content of the entry. */}
        <content type="xhtml">
          <div xmlns="http://www.w3.org/1999/xhtml">
            { xml.Unparsed(postXhtml) }
          </div>
        </content>
      </entry>
    }

    val feedUrl = hostUrl + routes.ApiV0Controller.getFromApi("feed")
    val feedName = stripSchemeSlashSlash(hostUrl)
    val feedUpdatedAt = posts.headOption.map(_.createdAt).getOrElse(new ju.Date)

     // About the tags:
     // <category term="sports"/> — add later, for category specific feeds.
     // <link>: Identifies a related Web page
     // <author>: Names one author of the feed. A feed may have multiple
     // author elements. A feed must contain at least one author
     // element unless all of the entry elements contain at least one
     // author element.
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>{feedName}</title>
      <id>{feedUrl}</id>
      <link href={feedUrl} rel="self" type="application/atom+xml" />
      <updated>{toIso8601T(feedUpdatedAt)}</updated>
      <author>
        <name>{feedName}</name>
      </author>
      <generator uri="https://www.talkyard.io">Talkyard</generator>
      {
        posts flatMap { post =>
          pageStuffById.get(post.pageId) map { page =>
            atomEntryFor(post, page)
          }
        }
      }
    </feed>
  }
}

