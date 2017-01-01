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
import scala.collection.mutable



/** A Page can be a blog post, a forum topic, a forum topic list, a Wiki page,
  * a Wiki main page, or a site's homepage, for example.
  */
trait Page {

  def id: PageId
  def siteId: SiteId
  def categoryId: Option[CategoryId] = meta.categoryId
  def role: PageRole = meta.pageRole
  def meta: PageMeta
  def thePath: PagePath
  def path: Option[PagePath]
  def parts: PageParts
  def version: PageVersion

  def anyAnswerPost: Option[Post] = {
    meta.answerPostUniqueId.flatMap(parts.postById)
  }

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
  meta: PageMeta) {

  def id = meta.pageId
  def pageId = meta.pageId
  def categoryId = meta.categoryId
  def pageRole = meta.pageRole

  requireMetaMatchesPaths(this)
}



/** Helper function that checks that page meta and page path IDs matches. */
object requireMetaMatchesPaths {
  def apply(page: {
    def meta: PageMeta
    def path: PagePath
  }) {
    if (page.path.pageId.isDefined) require(page.meta.pageId == page.path.pageId.get)
    else require(page.meta.pageId == "?")
  }
}



object PageMeta {

  def forNewPage(
        pageId: PageId,
        pageRole: PageRole,
        authorId: UserId,
        creationDati: ju.Date = new ju.Date,
        pinOrder: Option[Int] = None,
        pinWhere: Option[PinPageWhere] = None,
        categoryId: Option[CategoryId] = None,
        url: Option[String] = None,
        hidden: Boolean = false,
        publishDirectly: Boolean = false) = {
    var result = PageMeta(
      pageId = pageId,
      pageRole = pageRole,
      version = 1,
      createdAt = creationDati,
      updatedAt = creationDati,
      publishedAt = if (publishDirectly) Some(creationDati) else None,
      categoryId = categoryId,
      embeddingPageUrl = url,
      authorId = authorId,
      layout = PageLayout.Default,
      pinOrder = pinOrder,
      pinWhere = pinWhere,
      numLikes = 0,
      numWrongs = 0,
      numBurys = 0,
      numUnwanteds = 0,
      numRepliesVisible = 0,
      numRepliesTotal = 0,
      numChildPages = 0)
    if (hidden) {
      result = result.copy(hiddenAt = Some(When.fromDate(result.createdAt)))
    }
    result
  }

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
  * @param lastReplyAt
  * @param lastReplyById Set to None if there's no reply.
  * @param categoryId
  * @param embeddingPageUrl The canonical URL to the page, useful when linking to the page.
  *            Currently only needed and used for embedded comments, and then it
  *            is the URL of the embedding page.
  * @param authorId
  * @param frequentPosterIds: Most frequent poster listed first. Author & last-reply-by excluded.
  * @param layout: A bitmask that tells JS code how to render the page
  * @param numLikes
  * @param numWrongs
  * @param numBurys
  * @param numUnwanteds
  * @param numRepliesVisible Replies that haven't been deleted or hidden, and have been approved.
  *                          Includes collapsed and closed replies.
  * @param numRepliesTotal Counts all replies, also deleted, hidden and not-yet-approved replies.
  * @param answeredAt For questions: when a reply was accepted as the answer to the question.
  * @param answerPostUniqueId The id of the post that answers this question.
  // [befrel] @param answerPostNr
  * @param plannedAt When a problem/idea/todo got planned to be fixed/done.
  * @param doneAt When a problem/idea/todo was done, e.g. when bug fixed or idea implemented.
  * @param closedAt When the topic was closed, e.g. if a question was off-topic or idea rejected.
  * @param lockedAt When locked so no new replies can be added.
  * @param frozenAt When frozen, so cannot be changed in any way at all (not even edits).
  * @param htmlHeadTitle Text for the html <title>...</title> tag.
  * @param htmlHeadDescription Text for the html <description content"..."> tag.
  * @param numChildPages
  */
case class PageMeta(
  pageId: String,
  pageRole: PageRole,
  version: PageVersion,
  createdAt: ju.Date,
  updatedAt: ju.Date,
  publishedAt: Option[ju.Date] = None,
  bumpedAt: Option[ju.Date] = None,
  lastReplyAt: Option[ju.Date] = None,   // could rename to lastApprovedReplyApprovedAt?
  lastReplyById: Option[UserId] = None,  // could rename to lastApprovedReplyById?
  categoryId: Option[CategoryId] = None,
  embeddingPageUrl: Option[String],
  authorId: UserId,
  frequentPosterIds: Seq[UserId] = Seq.empty,
  layout: PageLayout = new PageLayout(0),
  pinOrder: Option[Int] = None,
  pinWhere: Option[PinPageWhere] = None,
  numLikes: Int = 0,
  numWrongs: Int = 0,
  numBurys: Int = 0,
  numUnwanteds: Int = 0,
  numRepliesVisible: Int = 0,
  numRepliesTotal: Int = 0,
  numOrigPostLikeVotes: Int = 0,
  numOrigPostWrongVotes: Int = 0,
  numOrigPostBuryVotes: Int = 0,
  numOrigPostUnwantedVotes: Int = 0,
  numOrigPostRepliesVisible: Int = 0,
  answeredAt: Option[ju.Date] = None,
  answerPostUniqueId: Option[PostId] = None,
  plannedAt: Option[ju.Date] = None,
  doneAt: Option[ju.Date] = None,
  closedAt: Option[ju.Date] = None,
  lockedAt: Option[ju.Date] = None,
  frozenAt: Option[ju.Date] = None,
  // unwantedAt: Option[ju.Date] = None, -- when enough core members voted Unwanted
  hiddenAt: Option[When] = None,
  deletedAt: Option[ju.Date] = None,
  htmlTagCssClasses: String = "",  // try to move to EditedSettings, so will be inherited
  htmlHeadTitle: String = "",
  htmlHeadDescription: String = "",
  numChildPages: Int = 0) { // <-- DoLater: remove, replace with category table

  require(lastReplyAt.isDefined == lastReplyById.isDefined, "DwE5JGY1")
  // If there are no replies, then there are no frequent posters.
  require(lastReplyById.isDefined || frequentPosterIds.isEmpty, "DwE7UMF2")
  require(frequentPosterIds.length <= 3, "DwE6UMW3") // for now — change if needed

  require(version > 0, "DwE6KFU2")
  require(pageRole != PageRole.AboutCategory || categoryId.isDefined, "DwE5PKI8")
  require(!pinOrder.exists(!PageMeta.isOkPinOrder(_)), "DwE4kEYF2")
  require(pinOrder.isEmpty == pinWhere.isEmpty, "DwE36FK2")
  require(numLikes >= 0, "DwE6PKF3")
  require(numWrongs >= 0, "DwE9KEFW2")
  require(numBurys >= 0, "DwE2KEP4")
  require(numUnwanteds >= 0, "DwE4JGY7")
  require(numOrigPostLikeVotes >= 0, "DwE5KJF2")
  require(numOrigPostLikeVotes <= numLikes, "DwE5KJF2B")
  require(numOrigPostWrongVotes >= 0, "DwE4WKEQ1")
  require(numOrigPostWrongVotes <= numWrongs, "DwE4WKEQ1B")
  require(numOrigPostBuryVotes >= 0, "DwE8KGY4")
  require(numOrigPostBuryVotes <= numBurys, "DwE8KGY4B")
  require(numOrigPostUnwantedVotes >= 0, "DwE0GFW8")
  require(numOrigPostUnwantedVotes <= numUnwanteds, "DwE4GKY8")
  require(numOrigPostRepliesVisible >= 0, "DwE0GY42")
  require(numOrigPostRepliesVisible <= numRepliesVisible,
    s"Fail: $numOrigPostRepliesVisible <= $numRepliesVisible [EsE0GY42B]")
  //require(numRepliesVisible >= 0, "DwE6KPE78") - bug in PostsDao.changePostStatus()?
  require(numRepliesTotal >= numRepliesVisible,
    s"Fail: $numRepliesTotal >= $numRepliesVisible [DwE4REQ2]")
  //require(numChildPages >= 0, "DwE8KPEF0") -- oops fails, not so very important, for now instead:
  require(answeredAt.isEmpty || createdAt.getTime < answeredAt.get.getTime, "DwE4KG22")
  require(plannedAt.isEmpty || createdAt.getTime < plannedAt.get.getTime, "DwE0FUY2")
  require(doneAt.isEmpty || createdAt.getTime < doneAt.get.getTime, "DwE4PUG2")
  require(closedAt.isEmpty || createdAt.getTime < closedAt.get.getTime, "DwE7KPE8")
  require(lockedAt.isEmpty || createdAt.getTime < lockedAt.get.getTime, "DwE3KWV6")
  require(frozenAt.isEmpty || createdAt.getTime < frozenAt.get.getTime, "DwE4YUF8")
  require(doneAt.isEmpty || plannedAt.isDefined, "DwE59KEW2")
  require(doneAt.isEmpty || plannedAt.get.getTime <= doneAt.get.getTime, "DwE6K8PY2")
  // A topic that has been fixed or solved, should be in the closed state.
  require((doneAt.isEmpty && answeredAt.isEmpty) || closedAt.isDefined, "DwE4KEF7")
  // A locked or frozen topic, should be closed too.
  require((lockedAt.isEmpty && frozenAt.isEmpty) || closedAt.isDefined, "DwE6UMP3")
  require(answeredAt.isEmpty == answerPostUniqueId.isEmpty, "DwE2PYU5")
  require(numChildPages >= 0, s"Page $pageId has $numChildPages child pages [EsE5FG3W02]")

  def isPinned = pinOrder.isDefined
  def isClosed = closedAt.isDefined
  def isVisible = hiddenAt.isEmpty && deletedAt.isEmpty
  def isHidden = hiddenAt.isDefined
  def isDeleted = deletedAt.isDefined

  def isGroupTalk = pageRole.isGroupTalk
  def isPrivateGroupTalk = pageRole.isPrivateGroupTalk

  def status: PageStatus =
    if (publishedAt.isDefined) PageStatus.Published
    else PageStatus.Draft

  def bumpedOrPublishedOrCreatedAt: ju.Date = bumpedAt orElse publishedAt getOrElse createdAt

  def addUserIdsTo(ids: mutable.Set[UserId]) {
    ids += authorId
    ids ++= frequentPosterIds
    lastReplyById.foreach(ids += _)
  }

  def idVersion = PageIdVersion(pageId, version = version)

  def copyWithNewVersion = copy(version = version + 1)


  def copyWithNewRole(newRole: PageRole): PageMeta = {
    var newClosedAt = closedAt
    val (newAnsweredAt, newAnswerPostUniqueId) = newRole match {
      case PageRole.Question => (answeredAt, answerPostUniqueId)
      case _ =>
        if (answeredAt.isDefined) {
          // Reopen it since changing type.
          newClosedAt = None
        }
        (None, None)
    }

    val newPlannedAt = newRole match {
      case PageRole.Problem | PageRole.Idea => plannedAt
      case PageRole.ToDo =>
        // To-Do:s are always either planned or done.
        plannedAt orElse Some(When.now().toJavaDate)
      case _ =>
        if (plannedAt.isDefined) {
          // Reopen it since changing type.
          newClosedAt = None
        }
        None
    }

    val newDoneAt = newRole match {
      case PageRole.Problem | PageRole.Idea | PageRole.ToDo => doneAt
      case _ =>
        if (doneAt.isDefined) {
          // Reopen it since changing type.
          newClosedAt = None
        }
        None
    }

    copy(
      pageRole = newRole,
      answeredAt = newAnsweredAt,
      answerPostUniqueId = newAnswerPostUniqueId,
      plannedAt = newPlannedAt,
      doneAt = newDoneAt,
      closedAt = newClosedAt)
  }

}



sealed abstract class PageRole(protected val IntValue: Int, val staffOnly: Boolean = true) {

  /** True if this page is e.g. a blog or a forum — they can have child pages
    * (namely blog posts, forum topics).
    */
  def isSection: Boolean = false

  def isChat: Boolean = false

  /** If the topic is a discussion between a closed group of people, and visible only to them.
    */
  def isPrivateGroupTalk: Boolean = false

  /** If one needs to join the page before one can say anything.
    */
  def isGroupTalk = isChat || isPrivateGroupTalk

  /** Should use nofollow links if many people can edit a page. */
  def isWidelyEditable: Boolean = true

  def canClose = !isSection

  def canHaveReplies = true

  // Sync with JS [6KUW204]
  def mayChangeRole: Boolean = true

  def toInt = IntValue

  dieIf(isSection && mayChangeRole, "EsE7KUP2")

}


object PageRole {

  def InfoPageMaxId = WebPage.toInt

  case object CustomHtmlPage extends PageRole(1) {
    override def isWidelyEditable = false
    override def canHaveReplies = false
  }

  case object WebPage extends PageRole(2) {
    override def isWidelyEditable = false
  }

  case object Code extends PageRole(3) {
    override def canHaveReplies = false // for now
    override def mayChangeRole = false
  }

  case object SpecialContent extends PageRole(4) {
    override def canHaveReplies = false
    override def mayChangeRole = false
  }

  case object EmbeddedComments extends PageRole(5, staffOnly = false)

  /** Lists blog posts. */
  case object Blog extends PageRole(6) {
    override def isSection = true
    override def mayChangeRole = false
    override def canHaveReplies = false
  }

  /** Lists forum topics and categories. */
  case object Forum extends PageRole(7) {
    override def isSection = true
    override def mayChangeRole = false
    override def canHaveReplies = false
  }

  /** About a forum category (Discourse's forum category about topic). Shown as a per
    * category welcome page, and by editing the page body you edit the forum category
    * description. */
  case object AboutCategory extends PageRole(9) {
    override def mayChangeRole = false
  }

  /** A question is considered answered when the author (or the staff) has marked some
    * reply as being the answer to the question. */
  case object Question extends PageRole(10, staffOnly = false)

  /** Something that is broken and should be fixed. Can change status to Planned and Done. */
  case object Problem extends PageRole(14, staffOnly = false)

  /** An idea about something to do, or a feature request. Can change status to Planned and Done. */
  case object Idea extends PageRole(15, staffOnly = false)

  /** Something that's been planned, perhaps done, but perhaps not an Idea or Problem. */
  // [refactor] remove. Use Idea instead, bumped to "doing" state.
  case object ToDo extends PageRole(13, staffOnly = false)  // remove [4YK0F24]

  /** Mind maps use 2D layout, even if the site is configured to use 1D layout. */
  case object MindMap extends PageRole(11, staffOnly = false)

  /** For discussions (non-questions) or announcements or blog posts, for example.  */
  case object Discussion extends PageRole(12, staffOnly = false)

  /** Any forum member with access to the page can join. */
  case object OpenChat extends PageRole(18, staffOnly = false) {
    override def isChat = true
    override def mayChangeRole = false
  }

  /** Users added explicitly. Topic not shown in forum unless already member. */
  case object PrivateChat extends PageRole(19, staffOnly = false) {
    override def isChat = true
    override def isPrivateGroupTalk = true
    override def canClose = false // lock them instead
    override def mayChangeRole = false
  }

  /** Formal direct messages between two users, or a group of users. Formal = not chat,
    * instead the full editor + preview are shown, so the sender is encouraged
    * to proofread and preview, rather than just typing lost of chatty verbose noise.
    *
    * If a FormalMessage topic is placed in a forum category, then everyone in a group
    * with the "correct" permissions on this category has access to the topic. (Not yet impl.)
    */
  case object FormalMessage extends PageRole(17, staffOnly = false) {
    override def isPrivateGroupTalk = true
    override def canClose = false // lock them instead
    override def mayChangeRole = false
  }

  case object Form extends PageRole(20, staffOnly = false)  // try to remove?

  case object Critique extends PageRole(16, staffOnly = false) // [plugin]
  case object UsabilityTesting extends PageRole(21, staffOnly = false) // [plugin]


  def fromInt(value: Int): Option[PageRole] = Some(value match {
    case CustomHtmlPage.IntValue => CustomHtmlPage
    case WebPage.IntValue => WebPage
    case Code.IntValue => Code
    case SpecialContent.IntValue => SpecialContent
    case EmbeddedComments.IntValue => EmbeddedComments
    case Blog.IntValue => Blog
    case Forum.IntValue => Forum
    case AboutCategory.IntValue => AboutCategory
    case Question.IntValue => Question
    case Problem.IntValue => Problem
    case Idea.IntValue => Idea
    case ToDo.IntValue => ToDo
    case MindMap.IntValue => MindMap
    case Discussion.IntValue => Discussion
    case FormalMessage.IntValue => FormalMessage
    case OpenChat.IntValue => OpenChat
    case PrivateChat.IntValue => PrivateChat
    case Form.IntValue => Form
    case Critique.IntValue => Critique
    case UsabilityTesting.IntValue => UsabilityTesting
    //case WikiMainPage.IntValue => WikiMainPage
    //case WikiPage.IntValue => WikiPage
    case _ => return None
  })

}


/** The bitmask:
  *
  * Bits:
  * 1..4: Topic list layout, for forums (decimal: 1..15)
  * 5..32: Unused.
  * 33..64: For plugins?
  */
class PageLayout(val bitmask: Int) extends AnyVal {

}

object PageLayout {

  val Default = new PageLayout(0)

  object TopicList {
    val TitleOnly = new PageLayout(1)
    val TitleExcerptSameLine = new PageLayout(2)
    val ExcerptBelowTitle = new PageLayout(3)
    val ThumbnailLeft = new PageLayout(4)
    val ThumbnailsBelowTitle = new PageLayout(5)
  }

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



sealed abstract class WriteWhat(protected val IntValue: Int) { def toInt = IntValue }
object WriteWhat {
  case object OriginalPost extends WriteWhat(1)
  case object ReplyToOriginalPost extends WriteWhat(2)
  case object Reply extends WriteWhat(3)
  case object ChatComment extends WriteWhat(4)

  def fromInt(value: Int): Option[WriteWhat] = Some(value match {
    case OriginalPost.IntValue => OriginalPost
    case ReplyToOriginalPost.IntValue => ReplyToOriginalPost
    case Reply.IntValue => Reply
    case ChatComment.IntValue => ChatComment
    case _ => return None
  })
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



case class PageQuery(orderOffset: PageOrderOffset, pageFilter: PageFilter)

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

sealed abstract class PageFilter { def includesDeleted = false }
object PageFilter {
  case object ShowAll extends PageFilter
  case object ShowWaiting extends PageFilter
  case object ShowDeleted extends PageFilter {
    override def includesDeleted = true
  }
}


case class PagePostId(pageId: PageId, postId: PostId)

case class PagePostNr(pageId: PageId, postNr: PostNr) {
  def toList: List[AnyRef] = List(pageId, postNr.asInstanceOf[AnyRef])
}

