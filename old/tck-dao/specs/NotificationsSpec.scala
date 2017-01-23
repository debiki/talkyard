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

/*
package com.debiki.tck.dao.specs

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.tck.dao._
import com.debiki.tck.dao.code._
import java.{util => ju}
import org.scalatest._


class NotificationsSpec(daoFactory: DbDaoFactory) extends DbDaoSpec(daoFactory) {

  lazy val utils = new TestUtils(daoFactory)
  lazy val site = utils.createFirstSite()
  lazy val siteUtils = new SiteTestUtils(site, daoFactory)
  def siteDao = siteUtils.dao

  var page: PageNoPath = null
  var comment: Post = null
  var role: User = null
  var guest: User = null
  val now = new ju.Date(1e12.toLong) // roughly year 2000
  val later = new ju.Date(now.getTime + 1000)

  def roleMentionNotf = Notification.NewPost(
    notfType = Notification.NewPostNotfType.Mention,
    siteId = site.id,
    createdAt = now,
    pageId = page.id,
    postId = PageParts.BodyId,
    byUserId = "author-user-id",
    toUserId = role.id)

  def roleReplyNotf = roleMentionNotf.copy(
    notfType = Notification.NewPostNotfType.DirectReply,
    createdAt = later,
    postId = comment.id)

  def guestMentionNotf = roleMentionNotf.copy(toUserId = guest.id)
  def guestReplyNotf = roleReplyNotf.copy(toUserId = guest.id,
    notfType = Notification.NewPostNotfType.DirectReply)

  var guestMentionNotfWithEmail: Notification.NewPost = null

  def roleMentionNotfDeletion = NotificationToDelete.MentionToDelete(
    siteId = roleMentionNotf.siteId,
    pageId = roleMentionNotf.pageId,
    postId = roleMentionNotf.postId,
    toUserId = roleMentionNotf.toUserId)

  // Deletes the reply notfs to both the role and the guest.
  def replyNotfDeletion = NotificationToDelete.NewPostToDelete(
    siteId = roleReplyNotf.siteId,
    pageId = roleReplyNotf.pageId,
    postId = roleReplyNotf.postId)


  "The server can save notifications" - {

    "create a page, a role and a guest" in {
      role = siteUtils.createPasswordRole()
      val loginGrant = siteUtils.login(role)
      val page1 = siteUtils.createPageAndBody(loginGrant, PageRole.ForumTopic, "Page text.")
      val (page2, comment) = siteUtils.addComment(loginGrant, page1.withoutPath, text = "abcd")
      this.page = page2
      this.comment = comment
      guest = siteUtils.loginAsGuest("Guest")
    }

    "save notifications to role and guest" in {
      siteDao.saveDeleteNotifications(Notifications(toCreate = Seq(
        roleMentionNotf, roleReplyNotf, guestMentionNotf, guestReplyNotf)))
    }

    "find no notifications for non-existing emails and users" in {
      siteDao.loadNotificationsForRole("BadRoleId") mustBe Nil
      siteDao.loadNotificationsForRole("-BadGuestId") mustBe Nil
    }

    "find notifications by role and guest id" in {
      siteDao.loadNotificationsForRole(role.id) mustBe Seq(roleMentionNotf, roleReplyNotf)
      siteDao.loadNotificationsForRole(guest.id) mustBe Seq(guestMentionNotf, guestReplyNotf)
    }

    "load notifications to mail out" in {
      val notfsToMail = systemDao.loadNotificationsToMailOut(delayInMinutes = 0, numToLoad = 10)
      notfsToMail.keySet mustBe Set(site.id)
      notfsToMail(site.id).size mustBe 4
      val values = notfsToMail(site.id)
      values must contain (roleMentionNotf)
      values must contain (roleReplyNotf)
      values must contain (guestMentionNotf)
      values must contain (guestReplyNotf)
    }

    "load oldest first" in {
      // Load only two notfs, and the ones found should be the mentions; they're oldest.
      val notfsToMail = systemDao.loadNotificationsToMailOut(delayInMinutes = 0, numToLoad = 2)
      notfsToMail.keySet mustBe Set(site.id)
      notfsToMail(site.id).size mustBe 2
      val values = notfsToMail(site.id)
      values must contain (roleMentionNotf)
      values must contain (guestMentionNotf)
    }

    "not load any notf, because they are too recent" in {
      val minutesSince1970 = ((new ju.Date).getTime / 1000 / 60).toInt
      val notfsLoaded = systemDao.loadNotificationsToMailOut(
        delayInMinutes = minutesSince1970, numToLoad = 999)
      notfsLoaded must be (empty)
    }
  }

  "The server can load and save notification emails" - {

    lazy val emailToRoleId = "10"
    lazy val emailToGuestId = "11"

    lazy val emailPendingToRole = Email(
      id = emailToRoleId,
      tyype = EmailType.Notification,
      sentTo = "test@example.com",
      toUserId = Some(role.id),
      sentOn = None,
      createdAt = now,
      subject = "Test Subject",
      bodyHtmlText = "<i>Test content.</i>",
      providerEmailId = None)

    lazy val emailSentToRole = emailPendingToRole.copy(
      sentOn = Some(later),
      providerEmailId = Some("test-provider-id-role-email"))

    lazy val emailPendingToGuest = emailPendingToRole.copy(
      id = emailToGuestId,
      toUserId = Some(guest.id))

    lazy val emailSentToGuest = emailPendingToGuest.copy(
      sentOn = Some(later),
      providerEmailId = Some("test-provider-id-guest-email"))

    lazy val emailSentToGuestFailed = emailSentToGuest.copy(failureText = Some("Dummy error"))

    "save emails, connect them to the notifications" in {
      siteDao.saveUnsentEmailConnectToNotfs(emailPendingToRole, Seq(roleMentionNotf))
      siteDao.saveUnsentEmailConnectToNotfs(emailPendingToGuest, Seq(guestMentionNotf))
    }

    "load the saved unsent emails" in {
      val emailToRoleLoaded = siteDao.loadEmailById(emailToRoleId)
      emailToRoleLoaded mustBe Some(emailPendingToRole)
      val emailToGuestLoaded = siteDao.loadEmailById(emailToGuestId)
      emailToGuestLoaded mustBe Some(emailPendingToGuest)
    }

    "mark the emails as having been sent" in {
      siteDao.updateSentEmail(emailSentToRole)
      siteDao.updateSentEmail(emailSentToGuest)
    }

    "load the saved emails, which have now been marked as sent" in {
      val emailToRoleLoaded = siteDao.loadEmailById(emailToRoleId)
      emailToRoleLoaded mustBe Some(emailSentToRole)
      val emailToGuestLoaded = siteDao.loadEmailById(emailToGuestId)
      emailToGuestLoaded mustBe Some(emailSentToGuest)
    }

    "find notfs being connected to emails" in {
      var notfs = siteDao.loadNotificationsForRole(role.id)
      notfs.size mustBe 2
      val roleMentionNotfWithEmail = roleMentionNotf.copy(
        emailId = Some(emailToRoleId), emailStatus = Notification.EmailStatus.Created)
      notfs(0) mustBe roleMentionNotfWithEmail
      notfs(1) mustBe roleReplyNotf

      notfs = siteDao.loadNotificationsForRole(guest.id)
      notfs.size mustBe 2
      guestMentionNotfWithEmail = guestMentionNotf.copy(
        emailId = Some(emailToGuestId), emailStatus = Notification.EmailStatus.Created)
      notfs(0) mustBe guestMentionNotfWithEmail
      notfs(1) mustBe guestReplyNotf
    }

    "skip notfs for which emails have already been sent, when loading notfs to mail out" in {
      // The notfs for the mentions have already been sent, so they should be ignored here,
      // although they're older than the new-reply notfs.
      val notfsToMail = systemDao.loadNotificationsToMailOut(delayInMinutes = 0, numToLoad = 2)
      notfsToMail.keySet mustBe Set(site.id)
      notfsToMail(site.id).size mustBe 2
      val values = notfsToMail(site.id)
      values must contain (roleReplyNotf)
      values must contain (guestReplyNotf)
    }

    // Hmm, these two tests perhaps don't really belong here?
    "update and reload an email to failed status" in {
      siteDao.updateSentEmail(emailSentToGuestFailed)
      val emailLoaded = siteDao.loadEmailById(emailToGuestId)
      emailLoaded mustBe Some(emailSentToGuestFailed)
    }
    "update the failed email to sent status (simulates a re-send)" in {
      siteDao.updateSentEmail(emailSentToGuest)
      val emailLoaded = siteDao.loadEmailById(emailToGuestId)
      emailLoaded mustBe Some(emailSentToGuest)
    }

  }


  "The server can delete notifications" - {

    "delete a mention notf" in {
      def findRoleMention(notfs: Seq[Notification]) =
        notfs.find(_ match {
          case mention: Notification.NewPost
            if mention.notfType == Notification.NewPostNotfType.Mention => true
          case _ => false
        })
      val notfsBefore = siteDao.loadNotificationsForRole(roleMentionNotfDeletion.toUserId)
      findRoleMention(notfsBefore) mustBe 'defined
      siteDao.saveDeleteNotifications(Notifications(toDelete = Seq(roleMentionNotfDeletion)))
      val notfsAfter = siteDao.loadNotificationsForRole(roleMentionNotfDeletion.toUserId)
      findRoleMention(notfsAfter) mustBe None
    }

    "delete reply notfs, but not accidentally all of them" in {
      siteDao.loadNotificationsForRole(role.id).length mustBe 1
      siteDao.loadNotificationsForRole(guest.id).length mustBe 2
      siteDao.saveDeleteNotifications(Notifications(toDelete = Seq(replyNotfDeletion)))
      siteDao.loadNotificationsForRole(role.id) mustBe Nil
      siteDao.loadNotificationsForRole(guest.id) mustBe Seq(guestMentionNotfWithEmail)
    }
  }

}

*/
