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



sealed abstract class NotificationType(val IntValue: Int) { def toInt: Int = IntValue }

object NotificationType {
  case object DirectReply extends NotificationType(1)
  case object Mention extends NotificationType(2)
  // Quote 3
  case object Message extends NotificationType(4)
  case object NewPost extends NotificationType(5)
  case object PostTagged extends NotificationType(6)

  def fromInt(value: Int): Option[NotificationType] = Some(value match {
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
  case class NewPost(
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


  /** Like EveryPost, but also notified about any edits of any post.
    *
    * If this is desirable only for, say, the Orig Post (e.g. to get notified if someone
    * edits one's blog post = the orig post), then don't add more
    * notification levels here. Instead, make it possible to subscribe for notifications
    * on individual posts, and sub-threads, rather than on whole pages / categories / tags only.
    * This could be a power user feature in the More... post action dropdown.
    */
  case object EveryPostAllEdits extends NotfLevel(9)

  /** Notified about every new post (topic status changes).
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
  case object Tracking extends NotfLevel(4)  ; RENAME // to Highlight

  /** Notified of @mentions and posts in one's sub threads (incl direct replies).
    */
  case object Normal extends NotfLevel(3)

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


/** If page id, category id and tag label id are all unspecified, then, means the default
  * notf level, for the peopleId, in the whole forum (across all categories and tags).
  *
  * @param peopleId — the group or individual these settings concern.
  * @param notfLevel
  * @param pageId — if these notification settings are for a single page only.
  * @param pagesInCategoryId — the settings apply to all pages in this category.
  */
case class PageNotfPref(
  peopleId: UserId,
  notfLevel: NotfLevel,
  pageId: Option[PageId] = None,
  pagesInCategoryId: Option[CategoryId] = None,  // not yet impl [7KBR2AF5]
  //pagesWithTagLabelId: Option[TagLabelId] = None, — later
  wholeSite: Boolean = false) {

  require(pageId.isDefined.toZeroOne + pagesInCategoryId.isDefined.toZeroOne +
    wholeSite.toZeroOne == 1, "TyE2BKP053")

  if (pageId.isDefined) {
    require(notfLevel != NotfLevel.WatchingFirst)
  }
}


case class PageNotfLevels(
  forPage: Option[NotfLevel] = None,
  forCategory: Option[NotfLevel] = None,
  forWholeSite: Option[NotfLevel] = None) {

  /** The most specific notf level (per page), overrides the less specific (category, whole site).
    */
  def effectiveNotfLevel: NotfLevel =
    // Tested here: [TyT7KSJQ296]
    forPage.orElse(forCategory.orElse(forWholeSite)).getOrElse(NotfLevel.Normal)

}


/* Later:

case class MembersAllNotfPrefs(
  peopleId: UserId,
  pageNotfPrefs: immutable.Seq[PageNotfPref])

Or maybe just:  Set[PageNotfPref]  (Set not Seq)
  */