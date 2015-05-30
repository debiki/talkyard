/**
 * Copyright (C) 2012-2013 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.core

import com.debiki.core.Prelude._
import java.{util => ju}
import scala.collection.immutable



/** A Page can be a blog post, a forum topic, a forum topic list, a Wiki page,
  * a Wiki main page, or a site's homepage, for example.
  */
trait Page {

  def id: PageId
  def siteId: SiteId
  def parentPageId: Option[PageId] = meta.parentPageId
  def role: PageRole = meta.pageRole
  def meta: PageMeta
  def path: PagePath
  def ancestorIdsParentFirst: immutable.Seq[PageId]
  def parts: PageParts

}


object Page {

  def isOkayId(id: String): Boolean =
    id forall { char =>
      def isLower = 'a' <= char && char <= 'z'
      def isUpper = 'A' <= char && char <= 'Z'
      def isDigit = '0' <= char && char <= '9'
      isDigit || isLower || isUpper || char == '_'
    }
}



/** A page that does not know what it contains (the `parts` fields is absent).
  */
case class PagePathAndMeta(
  path: PagePath,
  ancestorIdsParentFirst: List[PageId],
  meta: PageMeta) {

  def id = meta.pageId
  def pageId = meta.pageId
  def parentPageId = meta.parentPageId
  def pageRole = meta.pageRole

  requireMetaMatchesPaths(this)
}



/** Helper function that checks that page meta and page path IDs matches. */
object requireMetaMatchesPaths {
  def apply(page: {
    def meta: PageMeta
    def path: PagePath
    def ancestorIdsParentFirst: List[PageId]
  }) {
    if (page.path.pageId.isDefined) require(page.meta.pageId == page.path.pageId.get)
    else require(page.meta.pageId == "?")

    require(page.ancestorIdsParentFirst.headOption == page.meta.parentPageId,
      o"""meta.parentPageId != ancestorIdsParentFirst.head:
    ${page.meta.parentPageId} and ${page.ancestorIdsParentFirst}, page id: ${page.meta.pageId}""")
  }
}



object PageMeta {

  def forNewPage(
        pageId: PageId,
        pageRole: PageRole,
        authorId: UserId,
        creationDati: ju.Date = new ju.Date,
        parentPageId: Option[String] = None,
        url: Option[String] = None,
        publishDirectly: Boolean = false) =
    PageMeta(
      pageId = pageId,
      pageRole = pageRole,
      createdAt = creationDati,
      updatedAt = creationDati,
      publishedAt = if (publishDirectly) Some(creationDati) else None,
      parentPageId = parentPageId,
      embeddingPageUrl = url,
      authorId = authorId,
      numLikes = 0,
      numWrongs = 0,
      numBurys = 0,
      numRepliesVisible = 0,
      numRepliesTotal = 0,
      numChildPages = 0)

}


/** @param pageId
  * @param pageRole
  * @param createdAt
  * @param updatedAt
  * @param publishedAt
  * @param bumpedAt
  * @param parentPageId
  * @param embeddingPageUrl The canonical URL to the page, useful when linking to the page.
  *            Currently only needed and used for embedded comments, and then it
  *            is the URL of the embedding page.
  * @param authorId
  * @param numLikes
  * @param numWrongs
  * @param numBurys
  * @param numRepliesVisible Replies that haven't been deleted or hidden, and have been approved.
  *                          Includes collapsed and closed replies.
  * @param numRepliesTotal Counts all replies, also deleted, hidden and not-yet-approved replies.
  * @param numChildPages
  */
case class PageMeta(
  pageId: String,
  pageRole: PageRole,
  createdAt: ju.Date,
  updatedAt: ju.Date,
  publishedAt: Option[ju.Date] = None,
  bumpedAt: Option[ju.Date] = None,
  parentPageId: Option[String] = None,
  embeddingPageUrl: Option[String],
  authorId: UserId,
  numLikes: Int = 0,
  numWrongs: Int = 0,
  numBurys: Int = 0,
  numRepliesVisible: Int = 0,
  numRepliesTotal: Int = 0,
  numChildPages: Int = 0) {

  def status: PageStatus =
    if (publishedAt.isDefined) PageStatus.Published
    else PageStatus.Draft

}



sealed abstract class PageRole {

  /** True if this page is e.g. a blog or a forum — they can have child pages
    * (namely blog posts, forum topics).
    */
  def isSection: Boolean = false

  /** Should use nofollow links if many people can edit a page. */
  def isWidelyEditable: Boolean = true
}


object PageRole {

  case object HomePage extends PageRole {
    override def isWidelyEditable = false
  }

  case object WebPage extends PageRole {
    override def isWidelyEditable = false
  }

  case object Code extends PageRole

  case object SpecialContent extends PageRole

  case object EmbeddedComments extends PageRole

  case object Blog extends PageRole {
    override def isSection = true
  }

  case object BlogPost extends PageRole {
    override def isWidelyEditable = false
  }

  case object Forum extends PageRole {
    override def isSection = true
  }

  case object ForumCategory extends PageRole {
    override val isSection = true
  }

  case object ForumTopic extends PageRole

  case object WikiMainPage extends PageRole {
    override def isSection = true
  }

  case object WikiPage extends PageRole


  // Hmm, regrettably this breaks should I rename any case object.
  // Perhaps use a match ... case list instead?
  private val _PageRoleLookup = Vector(
    HomePage, WebPage, EmbeddedComments, Blog, BlogPost,
    Forum, ForumCategory, ForumTopic,
    WikiMainPage, WikiPage,
    Code).map(x => (x, x.toString))

  def parse(pageRoleString: String): PageRole =
    _PageRoleLookup.find(_._2 == pageRoleString).map(_._1).getOrElse(
      illArgErr("DwE930rR3", s"Bad page role: `$pageRoleString'"))

}



/**
 * The page status, see debiki-for-developers.txt #9vG5I.
 */
sealed abstract class PageStatus
object PageStatus {
  // COULD rename to PrivateDraft, becaus ... other pages with limited
  // visibility might be considered Drafts (e.g. pages submitted for review).
  case object Draft extends PageStatus
  //COULD rename to Normal, because access control rules might result in
  // it effectively being non-pulbished.
  case object Published extends PageStatus

  case object Deleted extends PageStatus
  val All = List(Draft, Published, Deleted)

  def parse(text: String): PageStatus = text match {
    case "Draft" => Draft
    case "Published" => Published
    case "Deleted" => Deleted
    case x => illArgErr("DwE3WJH7", s"Bad page status: `$x'")
  }
}



/** How to sort pages, and where to start listing them, e.g. if fetching additional
  * pages after the user has scrolled down to the end of a page list.
  */
sealed abstract class PageOrderOffset

object PageOrderOffset {
  case object Any extends PageOrderOffset
  case object ByPath extends PageOrderOffset
  case object ByPublTime extends PageOrderOffset
  case class ByBumpTime(offset: Option[ju.Date]) extends PageOrderOffset
  case class ByLikesAndBumpTime(offset: Option[(Int, ju.Date)]) extends PageOrderOffset
}



case class PagePostId(pageId: PageId, postId: PostId) {
  def toList: List[AnyRef] = List(pageId, postId.asInstanceOf[AnyRef])
}


case class Category(pageId: String, subCategories: Seq[Category])

