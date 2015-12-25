/**
 * Copyright (c) 2014 Kaj Magnus Lindberg
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

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao.SiteDao
import org.scalatest._
import org.scalatest.mock.MockitoSugar
import org.mockito.Mockito._
import java.{util => ju}


/*
class NotificationGeneratorSpec extends RichFreeSpec with MustMatchers with MockitoSugar {

  val siteId = "siteId"
  val pageId = "pageId"

  import com.debiki.core.PeopleTestUtils.makePerson
  val bodyAuthor = makePerson("BodyAuthor")
  val replyAuthor = makePerson("Replier")
  val reviewer = makePerson("ReviewerAuthor")
  val mentionedUserA = makePerson("MentionedUserA")
  val mentionedUserB = makePerson("MentionedUserB")
  val watchingUser = makePerson("Watcher")


  val rawBody = copyCreatePost(PostTestValues.postSkeleton,
    id = PageParts.BodyId, userId = bodyAuthor.id, parentPostId = None)

  val rawBodyPrelApproved = copyCreatePost(rawBody, approval = Some(Approval.Preliminary))
  val rawBodyWellBehavedAprvd = copyCreatePost(rawBody, approval = Some(Approval.WellBehavedUser))
  val rawBodyAuthzApproved = copyCreatePost(rawBody, approval = Some(Approval.AuthoritativeUser))

  val approvalOfBody =
    RawPostAction.toApprovePost(2, postId = rawBody.id,
      UserIdData.newTest(userId = reviewer.id),
      ctime = new ju.Date(11000), approval = Approval.AuthoritativeUser)
  val rejectionOfBody =
    RawPostAction.toDeletePost(andReplies = false, id = 3, postIdToDelete = rawBody.id,
      UserIdData.newTest(userId = reviewer.id),
      createdAt = new ju.Date(11000))

  val rawReply = copyCreatePost(PostTestValues.postSkeleton,
    id = 11, userId = replyAuthor.id, parentPostId = Some(rawBody.id))

  val rawReplyPrelApproved = copyCreatePost(rawReply, approval = Some(Approval.Preliminary))
  val rawReplyWellBehvdAprvd = copyCreatePost(rawReply, approval = Some(Approval.WellBehavedUser))
  val rawReplyAuthzApproved = copyCreatePost(rawReply, approval = Some(Approval.AuthoritativeUser))

  val approvalOfReply =
    RawPostAction.toApprovePost(12, postId = rawReply.id,
      UserIdData.newTest(userId = reviewer.id),
      ctime = new ju.Date(11000), approval = Approval.AuthoritativeUser)
  val rejectionOfReply =  RawPostAction.toDeletePost(
    andReplies = false, 13, postIdToDelete = rawReply.id,
    UserIdData.newTest(userId = reviewer.id),
    createdAt = new ju.Date(11000))

  val EmptyPage = PageParts(pageId) ++ (People() + bodyAuthor + replyAuthor + reviewer)

  val PageWithApprovedBody = EmptyPage + rawBody + approvalOfBody

  val pageNoPath = PageNoPath(PageWithApprovedBody, Nil, PageMeta.forNewPage(
    PageRole.Discussion, author = bodyAuthor, parts = EmptyPage, publishDirectly = true))

  def mockUser(siteDaoMock: SiteDao, user: User) {
    def username = user.username getOrDie "DwE509kEF3"
    when(siteDaoMock.loadUser(user.id)).thenReturn(Some(user))
    when(siteDaoMock.loadUserByEmailOrUsername(username)).thenReturn(Some(user))
    when(siteDaoMock.loadRolePageSettings(user.id, pageId)).thenReturn(RolePageSettings.Default)
  }

  def makeSiteDaoMock(userIdsWatchingPage: Seq[UserId] = Nil): SiteDao = {
    val siteDaoMock = mock[SiteDao]
    when(siteDaoMock.siteId).thenReturn(siteId)
    when(siteDaoMock.loadUserIdsWatchingPage(pageId)).thenReturn(userIdsWatchingPage)
    siteDaoMock
  }


  "NotificationGenerator should handle new posts" - {

    "generate a notf for a reply" in {
      val siteDaoMock = makeSiteDaoMock()
      mockUser(siteDaoMock, bodyAuthor)

      val reply = copyCreatePost(rawReply,
        userId = replyAuthor.id, approval = Some(Approval.WellBehavedUser))
      val notfs =
        NotificationGenerator(pageNoPath, siteDaoMock).generateNotifications(reply::Nil)

      notfs.toDelete mustBe Nil
      notfs.toCreate mustBe Seq(Notification.NewPost(
          notfType = Notification.NewPostNotfType.DirectReply,
          siteId = "siteId",
          createdAt = reply.creationDati,
          pageId = pageNoPath.id,
          postId = reply.id,
          byUserId = replyAuthor.id,
          toUserId = bodyAuthor.id))
    }

    "generate no notf for a reply to one's own comment" in {
      val siteDaoMock = makeSiteDaoMock()
      val reply = copyCreatePost(rawReply,
        userId = bodyAuthor.id, approval = Some(Approval.WellBehavedUser))
      val notfs = NotificationGenerator(pageNoPath, siteDaoMock).generateNotifications(reply::Nil)
      notfs.toDelete mustBe Nil
      notfs.toCreate mustBe Nil
    }

    "generate no notf for an unapproved reply" in {
      val siteDaoMock = makeSiteDaoMock()
      val reply = copyCreatePost(rawReply, userId = replyAuthor.id, approval = None)
      val notfs = NotificationGenerator(pageNoPath, siteDaoMock).generateNotifications(reply::Nil)
      notfs.toDelete mustBe Nil
      notfs.toCreate mustBe Nil
    }

    "generate no notf for a rejected reply" in {
      pending /* old code:
      val page = PageWithApprovedBody + rawReply
      val notfs = genNotfs(bodyAuthor, page, rejectionOfReply)
      notfs.toDelete mustBe Nil
      notfs.toCreate mustBe Nil */
    }

    "generate a notf when a reply is approved" in {
      val siteDaoMock = makeSiteDaoMock()
      mockUser(siteDaoMock, bodyAuthor)

      val page =  PageNoPath(PageWithApprovedBody + rawReply, Nil, PageMeta.forNewPage(
        PageRole.Discussion, author = bodyAuthor, parts = EmptyPage, publishDirectly = true))
      val notfs =
        NotificationGenerator(page, siteDaoMock).generateNotifications(approvalOfReply::Nil)

      notfs.toDelete mustBe Nil
      notfs.toCreate mustBe Seq(Notification.NewPost(
        notfType = Notification.NewPostNotfType.DirectReply,
        siteId = siteId,
        createdAt = rawReply.creationDati,
        pageId = pageNoPath.id,
        postId = rawReply.id,
        byUserId = replyAuthor.id,
        toUserId = bodyAuthor.id))
    }

    "generate no notf when the reply is approved by the one replied to" in {
      val siteDaoMock = makeSiteDaoMock()
      when(siteDaoMock.loadUser(bodyAuthor.id)).thenReturn(Some(bodyAuthor))

      val page =  PageNoPath(PageWithApprovedBody + rawReply, Nil, PageMeta.forNewPage(
        PageRole.Discussion, author = bodyAuthor, parts = EmptyPage, publishDirectly = true))
      val approval = approvalOfReply.copy(
        userIdData = UserIdData.newTest(userId = bodyAuthor.id))
      val notfs = NotificationGenerator(page, siteDaoMock).generateNotifications(approval::Nil)

      notfs.toDelete mustBe Nil
      notfs.toCreate mustBe Nil
    }

    "generate no notfs if well-behaved-user approval upheld" in {
      // This cannot really happen: moderators aren't asked to review comments by
      // well-behaved users. But include this test anyway.

      val siteDaoMock = makeSiteDaoMock()

      val page =  PageNoPath(PageWithApprovedBody + rawReplyWellBehvdAprvd, Nil,
        PageMeta.forNewPage(
          PageRole.Discussion, author = bodyAuthor, parts = EmptyPage, publishDirectly = true))
      val approval = approvalOfReply.copy(
        userIdData = UserIdData.newTest(userId = bodyAuthor.id))

      val notfs = NotificationGenerator(page, siteDaoMock).generateNotifications(approval::Nil)
      notfs.toDelete mustBe Nil
      notfs.toCreate mustBe Nil
    }

    "generate a reply and mentions, but no mention to the one replied to" in {
      val siteDaoMock = makeSiteDaoMock()
      mockUser(siteDaoMock, bodyAuthor)
      mockUser(siteDaoMock, mentionedUserA)
      mockUser(siteDaoMock, mentionedUserB)

      val name1 = bodyAuthor.username.get
      val name2 = mentionedUserA.username.get
      val name3 = mentionedUserB.username.get

      val reply = copyCreatePost(rawReply,
        text = s"@$name2: abcdef @$name1, @$name3 but ignore email-addresses@example.com.",
        userId = replyAuthor.id,
        approval = Some(Approval.WellBehavedUser))
      val notfs =
        NotificationGenerator(pageNoPath, siteDaoMock).generateNotifications(reply::Nil)

      notfs.toDelete mustBe Nil
      notfs.toCreate mustBe Seq(
        Notification.NewPost(
          notfType = Notification.NewPostNotfType.DirectReply,
          siteId = siteId,
          createdAt = reply.creationDati,
          pageId = pageNoPath.id,
          postId = reply.id,
          byUserId = replyAuthor.id,
          toUserId = bodyAuthor.id),
        Notification.NewPost(
          notfType = Notification.NewPostNotfType.Mention,
          siteId = siteId,
          createdAt = reply.creationDati,
          pageId = pageNoPath.id,
          postId = reply.id,
          byUserId = replyAuthor.id,
          toUserId = mentionedUserA.id),
        Notification.NewPost(
          notfType = Notification.NewPostNotfType.Mention,
          siteId = siteId,
          createdAt = reply.creationDati,
          pageId = pageNoPath.id,
          postId = rawReply.id,
          byUserId = replyAuthor.id,
          toUserId = mentionedUserB.id))
    }

    "generate notfs to people watching page" in {
      val siteDaoMock = makeSiteDaoMock(
        userIdsWatchingPage = Seq(bodyAuthor.id, watchingUser.id, replyAuthor.id))
      mockUser(siteDaoMock, bodyAuthor)
      mockUser(siteDaoMock, watchingUser)
      mockUser(siteDaoMock, replyAuthor)

      val reply = copyCreatePost(rawReply,
        userId = replyAuthor.id, approval = Some(Approval.WellBehavedUser))
      val notfs =
        NotificationGenerator(pageNoPath, siteDaoMock).generateNotifications(reply::Nil)

      val directReplyNotfToBodyAuthor = Notification.NewPost(
        notfType = Notification.NewPostNotfType.DirectReply,
        siteId = siteId,
        createdAt = reply.creationDati,
        pageId = pageNoPath.id,
        postId = reply.id,
        byUserId = replyAuthor.id,
        toUserId = bodyAuthor.id)

      val newPostNotfToWatcher = directReplyNotfToBodyAuthor.copy(
        notfType = Notification.NewPostNotfType.NewPost,
        toUserId = watchingUser.id)

      notfs.toDelete mustBe Nil
      notfs.toCreate mustBe Seq(directReplyNotfToBodyAuthor, newPostNotfToWatcher)

      // But not to the replyAuthor, although s/he is watching.
    }
  }


  "NotificationGenerator should handle edits" - {

    val textBefore = s"Mention of A: @${mentionedUserA.username.get}."
    val textAfter = s"Mention of B: @${mentionedUserB.username.get}"
    val patch = makePatch(from = textBefore, to = textAfter)

    "generate no mentions when post is edited but edits not approved" in {
      val siteDaoMock = mock[SiteDao]
      val theReply = copyCreatePost(rawReplyWellBehvdAprvd, text = textBefore)
      val theEdit = RawPostAction.toEditPost(
        id = 12345, postId = theReply.id, ctime = new ju.Date,
        userIdData = UserIdData.newTest(userId = theReply.userId), text = patch,
        autoApplied = true, approval = None)
      val page = PageNoPath(PageWithApprovedBody + theReply + theEdit, Nil, PageMeta.forNewPage(
        PageRole.Discussion, author = bodyAuthor, parts = EmptyPage, publishDirectly = true))

      val notfs =
        NotificationGenerator(page, siteDaoMock).generateNotifications(approvalOfReply::Nil)

      notfs.toCreate mustBe Nil
      notfs.toDelete mustBe Nil
    }

    "create and delete mentions when post is edited and directly approved" in {
      val siteDaoMock = makeSiteDaoMock()
      mockUser(siteDaoMock, mentionedUserA)
      mockUser(siteDaoMock, mentionedUserB)

      val theReply = copyCreatePost(rawReplyWellBehvdAprvd, text = textBefore)
      val page = PageNoPath(PageWithApprovedBody + theReply, Nil, PageMeta.forNewPage(
        PageRole.Discussion, author = bodyAuthor, parts = EmptyPage, publishDirectly = true))

      val rawEdit = RawPostAction.toEditPost(
        id = 12345, postId = theReply.id, ctime = new ju.Date,
        userIdData = UserIdData.newTest(userId = theReply.userId), text = patch,
        autoApplied = true, approval = Some(Approval.WellBehavedUser))
      val notfs = NotificationGenerator(page, siteDaoMock).generateNotifications(rawEdit::Nil)

      notfs.toCreate mustBe Seq(
        Notification.NewPost(
          notfType = Notification.NewPostNotfType.Mention,
          siteId = siteId,
          createdAt = theReply.creationDati,
          pageId = pageNoPath.id,
          postId = rawReply.id,
          byUserId = replyAuthor.id,
          toUserId = mentionedUserB.id))

      notfs.toDelete mustBe Seq(
        NotificationToDelete.MentionToDelete(
          siteId = siteId,
          pageId = pageId,
          postId = theReply.postId,
          toUserId = mentionedUserA.id))
    }

    "create and delete mentions when edits are approved later" in {
      val siteDaoMock = makeSiteDaoMock()
      mockUser(siteDaoMock, mentionedUserA)
      mockUser(siteDaoMock, mentionedUserB)

      val theReply = copyCreatePost(rawReplyWellBehvdAprvd, text = textBefore)
      val rawEdit = RawPostAction.toEditPost(
        id = 12345, postId = theReply.id, ctime = new ju.Date(12000),
        userIdData = UserIdData.newTest(userId = theReply.userId), text = patch,
        autoApplied = true, approval = None)
      val page = PageNoPath(PageWithApprovedBody + theReply + rawEdit, Nil, PageMeta.forNewPage(
        PageRole.Discussion, author = bodyAuthor, parts = EmptyPage, publishDirectly = true))

      val notfs =
        NotificationGenerator(page, siteDaoMock).generateNotifications(
          approvalOfReply.copy(creationDati = new ju.Date(13000))::Nil)

      notfs.toCreate mustBe Seq(
        Notification.NewPost(
          notfType = Notification.NewPostNotfType.Mention,
          siteId = siteId,
          createdAt = theReply.creationDati,
          pageId = pageNoPath.id,
          postId = rawReply.id,
          byUserId = replyAuthor.id,
          toUserId = mentionedUserB.id))

      notfs.toDelete mustBe Seq(
        NotificationToDelete.MentionToDelete(
          siteId = siteId,
          pageId = pageId,
          postId = theReply.postId,
          toUserId = mentionedUserA.id))
    }
  }


  "NotificationGenerator should handle deletions" - {

    "delete new post notfs when the post is deleted" in {
      pending
    }
  }

}*/