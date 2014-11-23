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
case class NotificationGenerator(page: PageNoPath, dao: SiteDao) {

  private def oldPageParts = page.parts
  private var newPageParts: PageParts = _

  private var notfsToCreate = mutable.ArrayBuffer[Notification]()
  private var notfsToDelete = mutable.ArrayBuffer[NotificationToDelete]()
  private var sentToUserIds = new mutable.HashSet[UserId]()


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
        case PAP.VoteLike =>
          makeNotfForVote(action.asInstanceOf[RawPostAction[PAP.Vote]])
      }
    }
    Notifications(
      toCreate = notfsToCreate.toSeq,
      toDelete = notfsToDelete.toSeq)
  }


  private def makeNotfsForNewPost(postId: PostId, anyApproverId: Option[UserId]) {
    val newPost = newPageParts.getPost(postId) getOrDie "DwE7GF36"

    if (!newPost.currentVersionApproved)
      return

    // Direct reply notification.
    for {
      parentPost <- newPost.parentPost
      if parentPost.userId != newPost.userId
      if anyApproverId.map(_ == parentPost.userId) != Some(true)
      parentUser <- dao.loadUser(parentPost.userId)
    }{
      makeNewPostNotf(Notification.NewPostNotfType.DirectReply, newPost, parentUser)
    }

    // Mentions
    val mentionedUsernames: Seq[String] = findMentions(newPost.approvedText getOrDie "DwE82FK4")
    val mentionedUsers = mentionedUsernames.flatMap(dao.loadUserByEmailOrUsername)
    for (user <- mentionedUsers) {
      makeNewPostNotf(Notification.NewPostNotfType.Mention, newPost, user)
    }

    // People watching this topic or category
    for {
      userId <- dao.loadUserIdsWatchingPage(page.id)
      if userId != newPost.userId
      user <- dao.loadUser(userId)
    }{
      makeNewPostNotf(Notification.NewPostNotfType.NewPost, newPost, user)
    }
  }


  private def makeNewPostNotf(notfType: Notification.NewPostNotfType, newPost: Post, user: User) {
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
      val settings: RolePageSettings = dao.loadRolePageSettings(user.id, page.id)
      if (settings.notfLevel == PageNotfLevel.Muted) {
        return
      }
    }

    sentToUserIds += user.id
    notfsToCreate += Notification.NewPost(
      notfType,
      siteId = dao.siteId,
      createdAt = newPost.creationDati,
      pageId = page.id,
      postId = newPost.id,
      byUserId = newPost.userId,
      toUserId = user.id)
  }


  /** Creates and deletes mentions, if the edits creates or deletes mentions.
    */
  private def makeNotfsForEdits(postId: PostId) {
    val oldPost = oldPageParts.getPost(postId) getOrDie "DwE0KBf5"
    val newPost = newPageParts.getPost(postId) getOrDie "DwEG390X"

    val oldMentions = findMentions(oldPost.approvedText getOrDie "DwE0YKW3").toSet
    val newMentions = findMentions(newPost.approvedText getOrDie "DwE2BF81").toSet

    val deletedMentions = oldMentions -- newMentions
    val createdMentions = newMentions -- oldMentions

    val mentionsDeletedForUsers = deletedMentions.flatMap(dao.loadUserByEmailOrUsername)
    val mentionsCreatedForUsers = createdMentions.flatMap(dao.loadUserByEmailOrUsername)

    // Delete mentions.
    for (user <- mentionsDeletedForUsers) {
      notfsToDelete += NotificationToDelete.MentionToDelete(
        siteId = dao.siteId,
        pageId = page.id,
        postId = oldPost.id,
        toUserId = user.id)
    }

    // Create mentions.
    for (user <- mentionsCreatedForUsers) {
      makeNewPostNotf(Notification.NewPostNotfType.Mention, newPost, user)
    }
  }


  private def makeNotfForVote(likeVote: RawPostAction[PAP.Vote]) {
    // Delete this notf if deleting the vote, see [953kGF21X] in debiki-dao-rdb.
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
