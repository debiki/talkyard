/**
 * Copyright (C) 2014-2015 Kaj Magnus Lindberg (born 1979)
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

package io.efdi.server.notf

import com.debiki.core.Prelude._
import com.debiki.core._
import io.efdi.server.notf.NotificationGenerator._
import java.{util => ju}
import scala.collection.{immutable, mutable}


/** Finds out what notifications to send when e.g. a new post is created.
  * Also finds out what not-yet-sent notifications to delete if a post is deleted, or if
  * the post is edited and a @mention removed.
  */
case class NotificationGenerator(transaction: SiteTransaction) {

  private var notfsToCreate = mutable.ArrayBuffer[Notification]()
  private var notfsToDelete = mutable.ArrayBuffer[NotificationToDelete]()
  private var sentToUserIds = new mutable.HashSet[UserId]()
  private var nextNotfId: Option[NotificationId] = None

  private def generatedNotifications =
    Notifications(
      toCreate = notfsToCreate.toSeq,
      toDelete = notfsToDelete.toSeq)


  def generateForNewPost(page: Page, newPost: Post, skipMentions: Boolean = false)
        : Notifications = {
    require(page.id == newPost.pageId, "DwE4KEW9")

    val approverId = newPost.approvedById getOrElse {
      // Don't generate notifications until later when the post gets approved and becomes visible.
      return Notifications.None
    }

    // Direct reply notification.
    for {
      parentPost <- newPost.parent(page.parts)
      if parentPost.createdById != newPost.createdById // not replying to oneself
      if approverId != parentPost.createdById // the approver has already read newPost
      parentUser <- transaction.loadUser(parentPost.createdById)
    } {
      makeNewPostNotf(NotificationType.DirectReply, newPost, parentUser)
    }

    // Mentions
    if (!skipMentions) {
      val mentionedUsernames: Seq[String] = findMentions(newPost.approvedSource getOrDie "DwE82FK4")
      val mentionedUsers = mentionedUsernames.flatMap(transaction.loadMemberByEmailOrUsername)
      for {
        user <- mentionedUsers
        // Right now ignore self-mentions. Later, allow? Could work like a personal to-do item?
        // Then would have to remove a db constraint. Could do later. Right now feels best
        // to keep it so it'll catch bugs.
        if user.id != newPost.createdById  // poster mentions him/herself?
      } {
        makeNewPostNotf(NotificationType.Mention, newPost, user)
      }
    }

    // People watching this topic or category
    for {
      userId <- transaction.loadUserIdsWatchingPage(page.id)
      if userId != newPost.createdById
      user <- transaction.loadUser(userId)
    } {
      makeNewPostNotf(NotificationType.NewPost, newPost, user)
    }

    generatedNotifications
  }


  /*
  def generateForDeletedPost(page: Page, post: Post, skipMentions: Boolean): Notifications = {
    dieIf(!skipMentions, "EsE6YKG567", "Unimplemented: deleting mentions")
    Notifications(
      toDelete = Seq(NotificationToDelete.NewPostToDelete(transaction.siteId, post.uniqueId)))
  }*/


  /** Private messages are sent to all toUserIds, but not to any user mentioned in the
    * message.
    */
  def generateForMessage(sender: User, pageBody: Post, toUserIds: Set[UserId])
        : Notifications = {
    unimplementedIf(pageBody.approvedById.isEmpty, "Unapproved private message? [EsE7MKB3]")
    transaction.loadUsers(toUserIds) foreach { user =>
      makeNewPostNotf(NotificationType.Message, pageBody, user)
    }
    generatedNotifications
  }


  private def makeNewPostNotf(notfType: NotificationType, newPost: Post, toUser: User) {
    if (sentToUserIds.contains(toUser.id))
      return

    if (toUser.isGuest) {
      if (toUser.emailNotfPrefs == EmailNotfPrefs.DontReceive ||
          toUser.emailNotfPrefs == EmailNotfPrefs.ForbiddenForever ||
          toUser.email.isEmpty) {
        return
      }
    }
    else {
      // Always generate notifications, so they can be shown in the user's inbox.
      // (But later on we might or might not send any email about the notifications,
      // depending on the user's preferences.)
      val settings: RolePageSettings = transaction.loadRolePageSettingsOrDefault(
        toUser.id, newPost.pageId)
      if (settings.notfLevel == NotfLevel.Muted) {
        return
      }
    }

    sentToUserIds += toUser.id
    notfsToCreate += Notification.NewPost(
      notfType,
      siteId = transaction.siteId,
      id = bumpAndGetNextNotfId(),
      createdAt = newPost.createdAt,
      uniquePostId = newPost.id,
      byUserId = newPost.createdById,
      toUserId = toUser.id)
  }


  /** Creates and deletes mentions, if the edits creates or deletes mentions.
    */
  def generateForEdits(oldPost: Post, newPost: Post): Notifications = {
    require(oldPost.pagePostNr == newPost.pagePostNr)

    val oldMentions = findMentions(oldPost.approvedSource getOrDie "DwE0YKW3").toSet
    val newMentions = findMentions(newPost.approvedSource getOrDie "DwE2BF81").toSet

    val deletedMentions = oldMentions -- newMentions
    val createdMentions = newMentions -- oldMentions

    val mentionsDeletedForUsers = deletedMentions.flatMap(transaction.loadMemberByEmailOrUsername)
    val mentionsCreatedForUsers = createdMentions.flatMap(transaction.loadMemberByEmailOrUsername)

    // Delete mentions.
    for (user <- mentionsDeletedForUsers) {
      notfsToDelete += NotificationToDelete.MentionToDelete(
        siteId = transaction.siteId,
        uniquePostId = newPost.id,
        toUserId = user.id)
    }

    // Create mentions.
    for {
      user <- mentionsCreatedForUsers
      if user.id != newPost.createdById
    } {
      makeNewPostNotf(NotificationType.Mention, newPost, user)
    }

    generatedNotifications
  }

  /*
  private def generateForVote(likeVote: RawPostAction[PAP.Vote]) {
    // Delete this notf if deleting the vote, see [953kGF21X].
  } */


  def generateForTags(post: Post, tagsAdded: Set[TagLabel]): Notifications = {
    val userIdsWatching = transaction.listUsersWatchingTags(tagsAdded)
    val userIdsNotified = transaction.listUsersNotifiedAboutPost(post.id)
    val userIdsToNotify = userIdsWatching -- userIdsNotified
    val usersToNotify = transaction.loadUsers(userIdsToNotify.to[immutable.Seq])
    for {
      user <- usersToNotify
      if user.id != post.createdById
    } {
      makeNewPostNotf(NotificationType.PostTagged, post, user)
    }
    generatedNotifications
  }


  private def bumpAndGetNextNotfId(): NotificationId = {
    nextNotfId match {
      case None =>
        nextNotfId = Some(transaction.nextNotificationId())
      case Some(id) =>
        nextNotfId = Some(id + 1)
    }
    nextNotfId getOrDie "EsE5GUY2"
  }

}


object NotificationGenerator {

  def findMentions(text: String): Seq[String] = {
    // For now, ignore CommonMark and HTML markup.
    val mentions = mutable.ArrayBuffer[String]()
    for (perhapsMention <- ".?@[a-zA-Z0-9_]+".r.findAllIn(text)) {
      perhapsMention(0) match {
        case '@' =>
          mentions += perhapsMention.drop(1)
        case ' ' =>
          mentions += perhapsMention.drop(2)
        case _ =>
          // skip, could be e.g. an email address
      }
    }
    mentions.to[immutable.Seq]
  }

}
