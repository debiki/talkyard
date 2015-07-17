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

  val MinPinOrder = 1
  val MaxPinOrder = 100
  def isOkPinOrder(order: Int) = MinPinOrder <= order && order <= MaxPinOrder
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
  lastReplyAt: Option[ju.Date] = None,
  parentPageId: Option[String] = None,
  embeddingPageUrl: Option[String],
  authorId: UserId,
  pinOrder: Option[Int] = None,
  pinWhere: Option[PinPageWhere] = None,
  numLikes: Int = 0,
  numWrongs: Int = 0,
  numBurys: Int = 0,
  numRepliesVisible: Int = 0,
  numRepliesTotal: Int = 0,
  numChildPages: Int = 0) {

  require(!pinOrder.exists(!PageMeta.isOkPinOrder(_)), "DwE4kEYF2")
  require(pinOrder.isEmpty == pinWhere.isEmpty, "DwE36FK2")
  require(numLikes >= 0, "DwE6PKF3")
  require(numWrongs >= 0, "DwE9KEFW2")
  require(numBurys >= 0, "DwE2KEP4")
  //require(numRepliesVisible >= 0, "DwE6KPE78") - bug in PostsDao.changePostStatus()?
  require(numRepliesTotal >= numRepliesVisible, "DwE4REQ2")
  require(numChildPages >= 0, "DwE8KPEF0")

  def isPinned = pinOrder.isDefined

  def status: PageStatus =
    if (publishedAt.isDefined) PageStatus.Published
    else PageStatus.Draft

  def bumpedOrPublishedOrCreatedAt = bumpedAt orElse publishedAt getOrElse createdAt
}



sealed abstract class PageRole(protected val IntValue: Int) {

  /** True if this page is e.g. a blog or a forum — they can have child pages
    * (namely blog posts, forum topics).
    */
  def isSection: Boolean = false

  /** Should use nofollow links if many people can edit a page. */
  def isWidelyEditable: Boolean = true

  def toInt = IntValue

}


object PageRole {

  case object HomePage extends PageRole(1) {
    override def isWidelyEditable = false
  }

  case object WebPage extends PageRole(2) {
    override def isWidelyEditable = false
  }

  case object Code extends PageRole(3)

  case object SpecialContent extends PageRole(4)

  case object EmbeddedComments extends PageRole(5)

  /** Lists blog posts. Everything with a Blog as its parent page is a blog post,
    * unless it's a category. */
  case object Blog extends PageRole(6) {
    override def isSection = true
  }

  /** Lists forum topic categories plus forum topics with no parent category. */
  case object Forum extends PageRole(7) {
    override def isSection = true
  }

  /** Everything with a forum category as its parent page is a forum topic, unless
    * it's a ForumCategory itself, then it's a sub category. */
  case object Category extends PageRole(8) {
    override val isSection = true
  }

  /** About a forum category (Discourse's forum category about topic). Shown as a per
    * category welcome page, and by editing the page body you edit the forum category
    * description. */
  case object About extends PageRole(9)

  /** The default topic type in a forum. Unanswered questions will be listed somewhere?
    * and marked with a question mark icon somehow? */
  case object Question extends PageRole(10)

  /** Mind maps use 2D layout, even if the site is configured to use 1D layout. */
  case object MindMap extends PageRole(11)

  /** For discussions (non-questions) or announcements or blog posts, for example.  */
  case object Discussion extends PageRole(12)

  /*
  case object WikiMainPage extends PageRole {
    override def isSection = true
  }

  case object WikiPage extends PageRole
  */

  def fromInt(value: Int): Option[PageRole] = Some(value match {
    case HomePage.IntValue => HomePage
    case WebPage.IntValue => WebPage
    case Code.IntValue => Code
    case SpecialContent.IntValue => SpecialContent
    case EmbeddedComments.IntValue => EmbeddedComments
    case Blog.IntValue => Blog
    case Forum.IntValue => Forum
    case Category.IntValue => Category
    case About.IntValue => About
    case Question.IntValue => Question
    case MindMap.IntValue => MindMap
    case Discussion.IntValue => Discussion
    //case WikiMainPage.IntValue => WikiMainPage
    //case WikiPage.IntValue => WikiPage
    case _ => return None
  })

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



sealed abstract class PinPageWhere { def toInt: Int }

object PinPageWhere {
  // Don't change the IntValue:s — they're stored in the database.

  case object InCategory extends PinPageWhere { val IntValue = 1; def toInt = IntValue }
  case object Globally extends PinPageWhere { val IntValue = 3; def toInt = IntValue }

  def fromInt(int: Int): Option[PinPageWhere] = Some(int match {
    case InCategory.IntValue => InCategory
    case Globally.IntValue => Globally
    case _ => return None
  })

  def fromString(string: String): Option[PinPageWhere] = Some(string match {
    case "InCategory" => InCategory
    case "Globally" => Globally
    case _ => return None
  })
}



/** How to sort pages, and where to start listing them, e.g. if fetching additional
  * pages after the user has scrolled down to the end of a page list.
  */
sealed abstract class PageOrderOffset

object PageOrderOffset {
  case object Any extends PageOrderOffset
  case object ByPath extends PageOrderOffset
  case object ByPublTime extends PageOrderOffset
  case object ByPinOrderLoadOnlyPinned extends PageOrderOffset
  case class ByBumpTime(offset: Option[ju.Date]) extends PageOrderOffset
  case class ByLikesAndBumpTime(offset: Option[(Int, ju.Date)]) extends PageOrderOffset
}



case class PagePostId(pageId: PageId, postId: PostId) {
  def toList: List[AnyRef] = List(pageId, postId.asInstanceOf[AnyRef])
}


case class Category(pageId: String, subCategories: Seq[Category])

