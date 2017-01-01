/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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
import Prelude._


/** Notifications about e.g. new replies, @mentions, someone liked your post.
  * Or a @mention to delete because someone edited the post and removed the
  * mention, so we're no longer supposed to send an email about it.
  */
case class Notifications(
  toCreate: Seq[Notification] = Nil,
  toDelete: Seq[NotificationToDelete] = Nil)

object Notifications {
  val None = Notifications(Nil, Nil)
}



sealed abstract class NotificationType(val IntValue: Int) { def toInt = IntValue }

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
    override def tyype = notfType
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


sealed abstract class NotfEmailStatus(val IntValue: Int ) { def toInt = IntValue }
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
  def toInt = IntVal
}


/** Sync with database constraint function in `r__functions.sql`. [7KJE0W3]
  */
object NotfLevel {

  /** Notified about @mentions and all new posts. */
  case object WatchingAll extends NotfLevel(1)

  /** Notified about the first new post, plus @mentions. */
  case object WatchingFirst extends NotfLevel(2)

  /** Notified about @mentions and new posts in threads started by the user him/herself.  */
  case object Tracking extends NotfLevel(3)

  /** Notified of @mentions and direct replies. */
  case object Normal extends NotfLevel(4)

  /** No notifications for this page.  */
  case object Muted extends NotfLevel(5)

  def fromInt(value: Int): Option[NotfLevel] = Some(value match {
    case WatchingAll.IntVal => WatchingAll
    case WatchingFirst.IntVal => WatchingFirst
    case Tracking.IntVal => Tracking
    case Normal.IntVal => Normal
    case Muted.IntVal => Muted
    case _ => return None
  })

}
