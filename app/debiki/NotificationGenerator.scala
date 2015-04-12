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

package debiki

import collection.{mutable, immutable}
import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.{ PostActionPayload => PAP }
import debiki.dao.SiteDao
import java.{util => ju}
import NotificationGenerator._


/** Finds out what notifications to send when e.g. a new post is created.
  * Also finds out what not-yet-sent notifications to delete if a post is deleted, or if
  * the post is edited and a @mention removed.
  */
case class NotificationGenerator(transaction: SiteTransaction) {

  private var notfsToCreate = mutable.ArrayBuffer[Notification]()
  private var notfsToDelete = mutable.ArrayBuffer[NotificationToDelete]()
  private var sentToUserIds = new mutable.HashSet[UserId]()

  private def generatedNotifications =
    Notifications(
      toCreate = notfsToCreate.toSeq,
      toDelete = notfsToDelete.toSeq)

  /* TODO remove
  def generateNotifications(actions: Seq[RawPostAction[_]]): Notifications = {
    newPageParts = oldPageParts ++ actions

    for (action <- actions) {
      action.payload match {
        case payload: PAP.CreatePost =>
          if (payload.approval.isDefined) {
            makeNotfsForNewPost(action.postId, anyApproverId = None)
          }
          // else: wait until approved
        case edit: PAP.EditPost =>
          if (edit.approval.isDefined) {
            makeNotfsForEdits(action.postId)
          }
          // else: wait until approved
        case editApp: PAP.EditApp =>
          // If also approved, COULD notify edit author that the edits have now been applied.
        case payload: PAP.ApprovePost =>
          val oldPost = oldPageParts.getPost(action.postId)
          val oldAlreadyApproved = oldPost.map(_.someVersionApproved) == Some(true)
          val isApprovingEdits = oldAlreadyApproved
          if (isApprovingEdits) {
            makeNotfsForEdits(action.postId)
          }
          else {
            makeNotfsForNewPost(action.postId, anyApproverId = Some(action.userId))
          }
        case payload: PAP.RejectEdits =>
          // Don't notify.
        case PAP.VoteLike | PAP.VoteWrong =>
          makeNotfForVote(action.asInstanceOf[RawPostAction[PAP.Vote]])
        case PAP.VoteOffTopic =>
          // Don't notify.
        case flag: PAP.Flag =>
          // SHOULD generate notfs to all/some moderators?
        case PAP.ClearFlags =>
          // Don't notify.
        case PAP.HidePostClearFlags =>
          // Don't notify.
        case pin: PAP.PinPostAtPosition =>
          // Don't notify.
        case PAP.CollapsePost | PAP.CollapseTree | PAP.CloseTree =>
          // Don't notify.
        case _: PAP.DeletePost | PAP.DeleteTree =>
          // Don't notify.
      }
    }
    Notifications(
      toCreate = notfsToCreate.toSeq,
      toDelete = notfsToDelete.toSeq)
  }*/


  def generateForNewPost(page: Page2, newPost: Post2): Notifications = {
    require(page.id == newPost.pageId)

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
      makeNewPostNotf(Notification.NewPostNotfType.DirectReply, newPost, parentUser)
    }

    // Mentions
    val mentionedUsernames: Seq[String] = findMentions(newPost.approvedSource getOrDie "DwE82FK4")
    val mentionedUsers = mentionedUsernames.flatMap(transaction.loadUserByEmailOrUsername)
    for (user <- mentionedUsers) {
      makeNewPostNotf(Notification.NewPostNotfType.Mention, newPost, user)
    }

    // People watching this topic or category
    for {
      userId <- transaction.loadUserIdsWatchingPage(page.id)
      if userId != newPost.createdById.toString // UserId2
      user <- transaction.loadUser(userId)
    } {
      makeNewPostNotf(Notification.NewPostNotfType.NewPost, newPost, user)
    }

    generatedNotifications
  }


  private def makeNewPostNotf(notfType: Notification.NewPostNotfType, newPost: Post2, user: User) {
    if (sentToUserIds.contains(user.id))
      return

    if (user.isGuest) {
      if (user.emailNotfPrefs == EmailNotfPrefs.DontReceive ||
          user.emailNotfPrefs == EmailNotfPrefs.ForbiddenForever ||
          user.email.isEmpty) {
        return
      }
    }
    else {
      // Always generate notifications, so they can be shown in the user's inbox.
      // (But later on we might or might not send any email about the notifications,
      // depending on the user's preferences.)
      val settings: RolePageSettings = transaction.loadRolePageSettingsOrDefault(
        user.id, newPost.pageId)
      if (settings.notfLevel == PageNotfLevel.Muted) {
        return
      }
    }

    sentToUserIds += user.id
    notfsToCreate += Notification.NewPost(
      notfType,
      siteId = transaction.siteId,
      createdAt = newPost.createdAt,
      pageId = newPost.pageId,
      postId = newPost.id,
      byUserId = newPost.createdById.toString, // UserId2
      toUserId = user.id)
  }


  /** Creates and deletes mentions, if the edits creates or deletes mentions.
    */
  def generateForEdits(oldPost: Post2, newPost: Post2): Notifications = {
    require(oldPost.pagePostId == newPost.pagePostId)

    val oldMentions = findMentions(oldPost.approvedSource getOrDie "DwE0YKW3").toSet
    val newMentions = findMentions(newPost.approvedSource getOrDie "DwE2BF81").toSet

    val deletedMentions = oldMentions -- newMentions
    val createdMentions = newMentions -- oldMentions

    val mentionsDeletedForUsers = deletedMentions.flatMap(transaction.loadUserByEmailOrUsername)
    val mentionsCreatedForUsers = createdMentions.flatMap(transaction.loadUserByEmailOrUsername)

    // Delete mentions.
    for (user <- mentionsDeletedForUsers) {
      notfsToDelete += NotificationToDelete.MentionToDelete(
        siteId = transaction.siteId,
        pageId = newPost.pageId,
        postId = oldPost.id,
        toUserId = user.id)
    }

    // Create mentions.
    for (user <- mentionsCreatedForUsers) {
      makeNewPostNotf(Notification.NewPostNotfType.Mention, newPost, user)
    }

    generatedNotifications
  }


  private def generateForVote(likeVote: RawPostAction[PAP.Vote]) {
    // Delete this notf if deleting the vote, see [953kGF21X].
    // Note: Need to fix NotificationsSiteDaoMixin.connectNotificationToEmail so it
    // includes action_type and _sub_id in the where clause.
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
