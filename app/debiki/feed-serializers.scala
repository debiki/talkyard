/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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
import java.{util => ju, io => jio}
import scala.collection.JavaConversions._
import _root_.scala.xml.{NodeSeq, Node, Elem, Text, XML, Attribute}
import Prelude._

/* Disabled. Uses old deleted PageParts.

object AtomFeedXml {

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
  def renderFeed(hostUrl: String, feedId: String, feedTitle: String,
                 feedUpdated: ju.Date, pathsAndPages: Seq[(PagePath, PageParts)]
                    ): Node = {
    // Based on the Atom XML shown here:
    //   http://exploring.liftweb.net/master/index-15.html#toc-Section-15.7

    if (!hostUrl.startsWith("http"))
      warnDbgDie("Bad host URL: "+ safed(hostUrl))

    val baseUrl = hostUrl +"/"
    def urlTo(pp: PagePath) = baseUrl + pp.value.dropWhile(_ == '/')

    def pageToAtom(pathAndPage: (PagePath, PageParts)): NodeSeq = {
      val pagePath = pathAndPage._1
      val page = pathAndPage._2
      val pageBody = page.body.getOrElse {
        warnDbgDie("Page "+ safed(page.guid) +
              " lacks a root post [error DwE09k14p2]")
        return Nil
      }
      val pageTitle = page.approvedTitleText getOrElse pagePath.slugOrIdOrQustnMark
      val pageBodyAuthor =
            pageBody.user.map(_.displayName) getOrElse "(Author name unknown)"
      val urlToPage =  urlTo(pagePath)

      // (Should we strip any class names or ids? They make no sense in atom feeds?
      // No CSS or JS that cares about them anyway?)
      val rootPostHtml =
        xml.Unparsed(pageBody.approvedHtmlSanitized getOrElse "<i>Page not yet approved</i>")

      <entry>{
        /* Identifies the entry using a universally unique and
        permanent URI. */}
        <id>{urlToPage}</id>{
        /* Contains a human readable title for the entry. */}
        <title>{pageTitle}</title>{
        /* Indicates the last time the entry was modified in a
        significant way. This value need not change after a typo is
        fixed, only after a substantial modification.
        COULD introduce a page's updatedTime?
        */}
        <updated>{toIso8601T(pageBody.creationDati)}</updated>{
        /* Names one author of the entry. An entry may have multiple
        authors. An entry must [sometimes] contain at least one author
        element [...] More info here:
          http://www.atomenabled.org/developers/syndication/
                                                #recommendedEntryElements  */}
        <author><name>{pageBodyAuthor}</name></author>{
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
            { rootPostHtml }
          </div>
        </content>
      </entry>
    }

     // Could add:
     // <link>: Identifies a related Web page
     // <author>: Names one author of the feed. A feed may have multiple
     // author elements. A feed must contain at least one author
     // element unless all of the entry elements contain at least one
     // author element.
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>{feedTitle}</title>
      <id>{feedId}</id>
      <updated>{toIso8601T(feedUpdated)}</updated>
      { pathsAndPages.flatMap(pageToAtom) }
    </feed>
  }
}

 */
