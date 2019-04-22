/**
 * Copyright (C) 2014 Kaj Magnus Lindberg
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


/** Notifications about e.g. new replies, @mentions, someone liked your post.
  * Or a @mention to delete because someone edited the post and removed the
  * mention, so we're no longer supposed to send an email about it.
  */
case class Notifications(
  toCreate: Seq[Notification] = Nil,
  toDelete: Seq[NotificationToDelete] = Nil) {
  def isEmpty: Boolean = toCreate.isEmpty && toDelete.isEmpty
}

object Notifications {
  val None = Notifications(Nil, Nil)
}



sealed abstract class NotificationType(val IntValue: Int) {
  def toInt: Int = IntValue
  def isAboutReviewTask = false
}

// Could:  enum / 1000 = notification type, enum % 1000 = how many got notified?
// No, instead, case class:  NotfTypeNumNotified(notfType, numNotified: Int)
object NotificationType {

  // 100-199_ Notifications to staff about new review tasks.
  case object NewPostReviewTask extends NotificationType(101) {
    override def isAboutReviewTask = true
  }
  //case object PostEditedReviewTask extends NotificationType(..)
  //case object PostUnpopularReviewTask extends NotificationType(..)
  //case object PostFlaggedReviewTask extends NotificationType(..)
  //case object PostMayBeSpamReviewTask extends NotificationType(..)
  // post auto hidden ?
  // post deleted ?
  // User's profile text has spam links, review?
  // User's profile flagged?
  // + Staff notified that another staff member has reviewed a post, and the outcome,
  //      and that there are currently no more review tasks waiting.

  val MaxReviewTaskNotfId = 199

  // 200-299  Notifications about outcomes when staff reviewed one's post,
  // or requests staff has made about e.g. editing one's post.
  // 201: post approved
  // 202: edits requested
  // 203: post rejected

  // 300-399_ Notifications about new posts (that are visible, not hidden waiting for review).
  case object DirectReply extends NotificationType(301)
  case object Mention extends NotificationType(302)
  // + Quote
  case object Message extends NotificationType(304)
  case object NewPost extends NotificationType(305)
  // + NewTopic  [REFACTORNOTFS]


  // 400-499 Something interesting happened with an already existing topic or post.
  case object PostTagged extends NotificationType(406)
  // + TopicProgress
  // + QuestionAnswered
  // + TopicDone
  // + TopicClosed

  // 700: about users?
  // - New user joined (can then send a friendly Hello message)
  // - Suggestion to promote user to Core Member trust level?
  // - ... ?

  def fromInt(value: Int): Option[NotificationType] = Some(value match {
    case NewPostReviewTask.IntValue => NewPostReviewTask
    case DirectReply.IntValue => DirectReply
    case Mention.IntValue => Mention
    case Message.IntValue => Message
    case NewPost.IntValue => NewPost
    case PostTagged.IntValue => PostTagged
    case _ => return None
  })
}



sealed abstract class Notification {
  def siteId: SiteId
  def id: NotificationId
  def createdAt: ju.Date
  def tyype: NotificationType
  def toUserId: UserId
  def emailId: Option[EmailId]
  def emailStatus: NotfEmailStatus
  def seenAt: Option[ju.Date]
}


object Notification {

  /** A reply, @mention, or new post in a topic you're watching.
    */
  case class NewPost(  // [exp] fine, del from db: delete:  page_id  action_type  action_sub_id
    notfType: NotificationType,
    siteId: SiteId,
    id: NotificationId,
    createdAt: ju.Date,
    uniquePostId: PostId,
    byUserId: UserId,
    toUserId: UserId,
    emailId: Option[EmailId] = None,
    emailStatus: NotfEmailStatus = NotfEmailStatus.Undecided,
    seenAt: Option[ju.Date] = None) extends Notification {
    override def tyype: NotificationType = notfType
  }

  /*
  case class Approved extends Notification
  case class Quote extends Notification
  case class Edit extends Notification
  case class LikeVote extends Notification
  case class WrongVote extends Notification
  case class OffTopicVote extends Notification */
}



sealed abstract class NotificationToDelete

object NotificationToDelete {

  case class MentionToDelete(
    siteId: SiteId,
    uniquePostId: PostId,
    toUserId: UserId) extends NotificationToDelete

  case class NewPostToDelete(
    siteId: SiteId,
    uniquePostId: PostId) extends NotificationToDelete

}


sealed abstract class NotfEmailStatus(val IntValue: Int ) { def toInt: Int = IntValue }
object NotfEmailStatus {

  /** This notification has not yet been processed; we have yet to decide if to send an email. */
  case object Undecided extends NotfEmailStatus(1)

  /** We've decided to not send any email for this notf (perhaps the user has seen it already) */
  case object Skipped extends NotfEmailStatus(2)

  /** Email created, will soon be sent, or has already been sent. */
  case object Created extends NotfEmailStatus(3)

  // 4 = email sent? Not in use, right now.

  def fromInt(value: Int): Option[NotfEmailStatus] = Some(value match {
    case Undecided.IntValue => Undecided
    case Created.IntValue => Created
    case Skipped.IntValue => Skipped
    case _ => return None
  })
}



sealed abstract class NotfLevel(val IntVal: Int) {
  def toInt: Int = IntVal
}


/** Sync with database constraint function in `r__functions.sql`. [7KJE0W3]
  */
object NotfLevel {


  /** Like EveryPost, but also notified of edits.
    *
    * If this is desirable only for, say, the Orig Post (e.g. to get notified if someone
    * edits one's blog post = the orig post), then don't add more
    * notification levels here. Instead, make it possible to subscribe for notifications
    * on individual posts, and sub-threads, in addition to on whole pages / categories / tags.
    * This could be a power user feature in the More... post action dropdown.
    */
  case object EveryPostAllEdits extends NotfLevel(9)

  /** Notified about every new post (incl topic status changes).
    */
  case object WatchingAll extends NotfLevel(8)    ; RENAME // to EveryPost

  /** For questions: Notified about new answers suggestions (that is. orig post replies).
    * For questions, problems, ideas: Notified about progress posts and status changes,
    * e.g. status changed from Planned to Doing.
    */
  case object TopicProgress extends NotfLevel(7)

  /** Notified if an answer to a Question topic, is accepted as the correct answer.
    * Or if a Problem is marked as solved. Or an Idea marked as Implemented.
    * Or if topic closed (won't get solved / done).
    */
  case object TopicSolved extends NotfLevel(6)

  /** Notified about new topics. (For categories.)
    */
  case object WatchingFirst extends NotfLevel(5)  ; RENAME // to NewTopics

  /** Like Normal, plus highlights the topic in the topic list, if new posts.
    */
  case object Tracking extends NotfLevel(4)  ; RENAME // to Highlight ?

  /** Notified of @mentions and posts in one's sub threads (incl direct replies).
    */
  case object Normal extends NotfLevel(3)

  // If doesn't matter.
  val DoesNotMatterHere: Normal.type = Normal

  /** Notified of @mentions and direct replies only.
    */
  case object Hushed extends NotfLevel(2)

  /** No notifications for this page.
    */
  case object Muted extends NotfLevel(1)

  def fromInt(value: Int): Option[NotfLevel] = Some(value match {
    case EveryPostAllEdits.IntVal => EveryPostAllEdits
    case WatchingAll.IntVal => WatchingAll
    case TopicProgress.IntVal => TopicProgress
    case TopicSolved.IntVal => TopicSolved
    case WatchingFirst.IntVal => WatchingFirst
    case Tracking.IntVal => Tracking
    case Normal.IntVal => Normal
    case Hushed.IntVal => Hushed
    case Muted.IntVal => Muted
    case _ => return None
  })

}


/** Notification levels for pages in certain categories, or the whole site,
  * or specific pages.
  *
  * (Later on, maybe can be CatNotfPrefs, if one wants to be notified about
  * changes made to a category? Otherwise, maybe should
  * RENAME pageId to forPageId, and pagesInCategoryId to forCategoryId, and
  * wholeSite to forWholeSite. Hmm.)
  *
  * @param peopleId — the group or individual these settings concern.
  * @param notfLevel
  * @param pageId — if these notification settings are for a single page only.
  * @param pagesInCategoryId — the settings apply to all pages in this category.
  * @param wholeSite — the group's or member's default settings for pages across the whole site
  */
case class PageNotfPref(
  peopleId: UserId,  // RENAME to memberId, + db column.  [pps]
  notfLevel: NotfLevel,
  pageId: Option[PageId] = None,
  pagesInCategoryId: Option[CategoryId] = None,
  //pagesWithTagLabelId: Option[TagLabelId] = None, — later
  wholeSite: Boolean = false) {

  require(pageId.isDefined.toZeroOne + pagesInCategoryId.isDefined.toZeroOne +
    wholeSite.toZeroOne == 1, "TyE2BKP053")

  if (pageId.isDefined) {
    require(notfLevel != NotfLevel.WatchingFirst)
  }
}


case class PageNotfLevels(   // try to remove, not really in use [2RJW0047]
  forPage: Option[NotfLevel] = None,
  forCategory: Option[NotfLevel] = None,
  forWholeSite: Option[NotfLevel] = None) {
}

