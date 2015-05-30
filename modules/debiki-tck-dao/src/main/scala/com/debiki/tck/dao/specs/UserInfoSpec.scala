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


package com.debiki.tck.dao.specs

import com.debiki.core._
import com.debiki.core.Prelude._
import com.debiki.tck.dao._
import com.debiki.tck.dao.code._
import java.{util => ju}
import org.scalatest._


class UserInfoSpec(daoFactory: DbDaoFactory) extends DbDaoSpec(daoFactory) {

  lazy val utils = new TestUtils(daoFactory)
  lazy val site = utils.createFirstSite()
  lazy val siteUtils = new SiteTestUtils(site, daoFactory)


  "UserInfoSpec can" - {

    var page: PageNoPath = null
    val PageText = "The page text"
    var comment: Post = null
    val CommentText = "The comment text"
    var passwordRole: User = null
    var passwordLoginGrant: LoginGrant = null
    var guestUser: User = null

    "create a password role, find info but no actions" in {
      passwordRole = siteUtils.createPasswordRole()
      siteUtils.dao.listUserActions(passwordRole.id).length mustBe 0
      siteUtils.dao.loadUserInfoAndStats(passwordRole.id) mustBe Some(
        UserInfoAndStats(info = passwordRole, stats = UserStats.Zero))
    }

    "create a page, find one action" in {
      passwordLoginGrant = siteUtils.login(passwordRole)
      page = siteUtils.createPageAndBody(
        passwordLoginGrant, PageRole.ForumTopic, PageText).withoutPath
      siteUtils.dao.loadUserInfoAndStats(passwordRole.id) mustBe Some(
        UserInfoAndStats(info = passwordRole, stats = UserStats.Zero.copy(numPages = 1)))
      siteUtils.dao.listUserActions(passwordRole.id) match {
        case Seq(actionInfo) =>
          actionInfo.postExcerpt mustBe PageText
          actionInfo.actingUserId mustBe passwordRole.id
          actionInfo.createdNewPage mustBe true
          actionInfo.repliedToPostId mustBe None
          actionInfo.votedLike mustBe false
          actionInfo.votedWrong mustBe false
          actionInfo.votedBury mustBe false
        case x => fail(s"Wrong number of actions, expected one, got: $x")
      }
    }

    "login as guest, find info but no actions" in {
      guestUser = siteUtils.loginAsGuest(name = "Test Guest")
      siteUtils.dao.listUserActions(guestUser.id).length mustBe 0
      siteUtils.dao.loadUserInfoAndStats(guestUser.id) mustBe Some(
        UserInfoAndStats(info = guestUser, stats = UserStats.Zero))
    }

    "add a comment, find one action" in {
      val (page2, comment2) = siteUtils.addComment(guestUser, page, CommentText)
      page = siteUtils.review(passwordLoginGrant, page2, comment2.id, Approval.AuthoritativeUser)
      comment = page.parts.getPost(comment2.id) getOrElse fail("Comment not found")
      siteUtils.dao.loadUserInfoAndStats(guestUser.id) mustBe Some(
        UserInfoAndStats(info = guestUser, stats = UserStats.Zero.copy(
          numPosts = 1)))
      siteUtils.dao.listUserActions(guestUser.id) match {
        case Seq(actionInfo) =>
          actionInfo.postExcerpt mustBe CommentText
          actionInfo.actingUserId mustBe guestUser.id
          actionInfo.createdNewPage mustBe false
          actionInfo.repliedToPostId mustBe Some(PageParts.BodyId)
          actionInfo.votedLike mustBe false
          actionInfo.votedWrong mustBe false
          actionInfo.votedBury mustBe false
        case x => fail(s"Wrong number of actions, expected one, got: $x")
      }
    }

    "vote, as password user" - {

      "vote like, find user stats" in {
        siteUtils.vote(passwordLoginGrant, page, comment.id, PostActionPayload.VoteLike)
        siteUtils.dao.loadUserInfoAndStats(passwordRole.id) mustBe Some(
          UserInfoAndStats(info = passwordRole, stats = UserStats.Zero.copy(
            numPages = 1, numLikesGiven = 1)))
      }

      "vote wrong" in {
        siteUtils.vote(passwordLoginGrant, page, comment.id, PostActionPayload.VoteWrong)
        siteUtils.dao.loadUserInfoAndStats(passwordRole.id) mustBe Some(
          UserInfoAndStats(info = passwordRole, stats = UserStats.Zero.copy(
            numPages = 1, numLikesGiven = 1, numWrongsGiven = 1)))
      }

      "vote off-topic" in {
        siteUtils.vote(passwordLoginGrant, page, comment.id, PostActionPayload.VoteOffTopic)
        siteUtils.dao.loadUserInfoAndStats(passwordRole.id) mustBe Some(
          UserInfoAndStats(info = passwordRole, stats = UserStats.Zero.copy(
            numPages = 1, numLikesGiven = 1, numWrongsGiven = 1, numBurysGiven = 1)))
      }

      "find user action infos" in {
        def testActionInfo(info: UserActionInfo) {
          info.actingUserId mustBe passwordRole.id
          info.actingUserDisplayName mustBe siteUtils.DefaultPasswordFullName
          if (info.postId == 1) {
            info.postExcerpt mustBe PageText
          }
          else {
            info.postExcerpt mustBe CommentText
          }
          var numThingsDone = 0
          if (info.createdNewPage) numThingsDone += 1
          if (info.repliedToPostId.isDefined) numThingsDone += 1
          if (info.editedPostId.isDefined) numThingsDone += 1
          if (info.votedLike) numThingsDone += 1
          if (info.votedWrong) numThingsDone += 1
          if (info.votedBury) numThingsDone += 1
          numThingsDone mustBe 1
        }
        siteUtils.dao.listUserActions(passwordRole.id) match {
          case Seq(offTopicVote, wrongVote, likeVote, approvalOfComment, newPage) =>
            testActionInfo(offTopicVote)
            testActionInfo(wrongVote)
            testActionInfo(likeVote)
            testActionInfo(newPage)
            newPage.createdNewPage mustBe true
            likeVote.votedLike mustBe true
            wrongVote.votedWrong mustBe true
            offTopicVote.votedBury mustBe true
          case x => fail(s"Wrong number of actions, got: $x")
        }
      }
    }

    "find no actions or info for non-existing role and guest" in {
      val (nonExistingRoleId, nonExistingGuestId) = ("9999", "-9999")
      siteUtils.dao.listUserActions(nonExistingRoleId).length mustBe 0
      siteUtils.dao.listUserActions(nonExistingGuestId).length mustBe 0
      siteUtils.dao.loadUserInfoAndStats(nonExistingRoleId) mustBe None
      siteUtils.dao.loadUserInfoAndStats(nonExistingGuestId) mustBe None
    }

  }

}


