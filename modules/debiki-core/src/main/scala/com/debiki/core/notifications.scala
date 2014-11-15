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


sealed abstract class Notification {
  def siteId: SiteId
  def createdAt: ju.Date
  def toUserId: UserId
  def emailId: Option[EmailId]
  def emailCreatedAt: Option[ju.Date]
  def seenAt: Option[ju.Date]
}


object Notification {

  case class Mention(
    siteId: SiteId,
    createdAt: ju.Date,
    pageId: PageId,
    postId: PostId,
    byUserId: UserId,
    toUserId: UserId,
    emailId: Option[EmailId] = None,
    emailCreatedAt: Option[ju.Date] = None,
    seenAt: Option[ju.Date] = None) extends Notification

  /** A reply, indirect reply, or new post in a topic you're watching.
    */
  case class NewPost(
    notfType: NewPostNotfType,
    siteId: SiteId,
    createdAt: ju.Date,
    pageId: PageId,
    postId: PostId,
    byUserId: UserId,
    toUserId: UserId,
    emailId: Option[EmailId] = None,
    emailCreatedAt: Option[ju.Date] = None,
    seenAt: Option[ju.Date] = None) extends Notification

  sealed abstract class NewPostNotfType
  object NewPostNotfType {
    case object DirectReply extends NewPostNotfType
    case object IndirectReply extends NewPostNotfType
    case object NewPost extends NewPostNotfType
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
    pageId: PageId,
    postId: PostId,
    toUserId: UserId) extends NotificationToDelete

  case class NewPostToDelete(
    siteId: SiteId,
    pageId: PageId,
    postId: PostId) extends NotificationToDelete

}


