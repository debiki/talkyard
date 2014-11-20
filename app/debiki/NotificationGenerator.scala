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

import collection.mutable
import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.core.{ PostActionPayload => PAP }
import debiki.dao.SiteDao
import java.{util => ju}


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
      if (parentUser.isGuest) {
        if (parentUser.emailNotfPrefs == EmailNotfPrefs.Receive ||
          parentUser.emailNotfPrefs == EmailNotfPrefs.Unspecified) {
          makeNewPostNotf(Notification.NewPostNotfType.DirectReply, newPost, parentUser)
        }
      }
      else {
        val settings: RolePageSettings = dao.loadRolePageSettings(parentUser.theRoleId, page.id)
        settings.notfLevel match {
          case PageNotfLevel.Muted => // skip
          case _ =>
            makeNewPostNotf(Notification.NewPostNotfType.DirectReply, newPost, parentUser)
        }
      }
    }

    // People watching this topic
    // dao.loadRolesWatchingPage(page.id) foreach { role =>
    //   ...
    // }
  }


  private def makeNewPostNotf(notfType: Notification.NewPostNotfType, newPost: Post, user: User) {
    if (sentToUserIds.contains(user.id))
      return

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


  private def makeNotfsForEdits(postId: PostId) {
  }


  private def makeNotfForVote(likeVote: RawPostAction[PAP.Vote]) {
    // Delete this notf if deleting the vote, see [953kGF21X] in debiki-dao-rdb.
  }

}

