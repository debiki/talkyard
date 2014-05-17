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
import java.{util => ju}
import org.scalatest._


class UserInfoSpec(daoFactory: DbDaoFactory) extends DbDaoSpec(daoFactory) {

  lazy val utils = new TestUtils(daoFactory)
  lazy val site = utils.createFirstSite()
  lazy val siteUtils = new SiteTestUtils(site, daoFactory)


  "UserInfoSpec can" - {

    var page: PageNoPath = null
    var comment: Post = null
    var passwordIdentity: PasswordIdentity = null
    var passwordRole: User = null
    var passwordLoginGrant: LoginGrant = null
    var guestLoginGrant: LoginGrant = null
    var guestUser: User = null

    "create a password role, find info but no actions" in {
      val (identity, user) = siteUtils.createPasswordRole()
      passwordIdentity = identity.asInstanceOf[PasswordIdentity]
      passwordRole = user
      siteUtils.dao.listUserActions(user.id).length mustBe 0
      siteUtils.dao.loadUserInfoAndStats(user.id) mustBe Some(
        UserInfoAndStats(info = user, stats = UserStats.Zero))
    }

    "create a page, find one action" in {
      passwordLoginGrant = siteUtils.login(passwordIdentity)
      page = siteUtils.createPageAndBody(passwordLoginGrant, PageRole.ForumTopic).withoutPath
      siteUtils.dao.loadUserInfoAndStats(passwordRole.id) mustBe Some(
        UserInfoAndStats(info = passwordRole, stats = UserStats.Zero.copy(numPages = 1)))
      siteUtils.dao.listUserActions(passwordRole.id) match {
        case Seq(actionInfo) =>
          actionInfo.actingUserId mustBe passwordRole.id
          actionInfo.createdNewPage mustBe true
          actionInfo.repliedToPostId mustBe None
          actionInfo.votedLike mustBe false
          actionInfo.votedWrong mustBe false
          actionInfo.votedOffTopic mustBe false
        case x => fail(s"Wrong number of actions, expected one, got: $x")
      }
    }

    "login as guest, find info but no actions" in {
      guestLoginGrant = siteUtils.loginAsGuest(name = "Test Guest")
      guestUser = guestLoginGrant.user
      siteUtils.dao.listUserActions(guestUser.id).length mustBe 0
      siteUtils.dao.loadUserInfoAndStats(guestUser.id) mustBe Some(
        UserInfoAndStats(info = guestUser, stats = UserStats.Zero))
    }

    "add a comment, find one action" in {
      val (pageAfter, newComment) = siteUtils.addComment(guestLoginGrant, page, "Comment text")
      page = pageAfter
      comment = newComment
      siteUtils.dao.loadUserInfoAndStats(guestUser.id) mustBe Some(
        UserInfoAndStats(info = guestUser, stats = UserStats.Zero.copy(
          numPosts = 1)))
      siteUtils.dao.listUserActions(guestUser.id) match {
        case Seq(actionInfo) =>
          actionInfo.actingUserId mustBe guestUser.id
          actionInfo.createdNewPage mustBe false
          actionInfo.repliedToPostId mustBe Some(PageParts.BodyId)
          actionInfo.votedLike mustBe false
          actionInfo.votedWrong mustBe false
          actionInfo.votedOffTopic mustBe false
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
            numPages = 1, numLikesGiven = 1, numWrongsGiven = 1, numOffTopicsGiven = 1)))
      }

      "find user action infos" in {
        siteUtils.dao.listUserActions(passwordRole.id) match {
          case Seq(offTopicVote, wrongVote, likeVote, newPage) =>
            System.out.println("vovve") /*
            actionInfo.actingUserId mustBe passwordRole.id
            actionInfo.createdNewTopic mustBe true
            actionInfo.repliedToPostId mustBe None
            actionInfo.votedLike mustBe false
            actionInfo.votedWrong mustBe false
            actionInfo.votedOffTopic mustBe false */
          case x => fail(s"Wrong number of actions, expected one, got: $x")
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



// --------------------------------------------------------------------
// Place here for now, until I know what modules to break out etc.
// --------------------------------------------------------------------


class TestUtils(val daoFactory: DbDaoFactory) {

  def createFirstSite(): Tenant = {
    daoFactory.systemDbDao.createFirstSite(new FirstSiteData {
      val name = "Test"
      val address = "test.ex.com"
      val https = TenantHost.HttpsNone
      val pagesToCreate = Nil
    })
  }

}


class SiteTestUtils(site: Tenant, val daoFactory: DbDaoFactory) {

  val dao = daoFactory.newSiteDbDao(QuotaConsumers(tenantId = site.id))

  val defaultPagePath = PagePath(site.id, "/", None, showId = true, pageSlug = "slug")
  val defaultPassword = "ThePassword"

  def defaultBody(loginGrant: LoginGrant) = PostActionDto.forNewPageBody(
    text = "Text text text",
    creationDati = new ju.Date,
    userIdData = UserIdData.newTest(loginId = loginGrant.login.id, userId = loginGrant.user.id),
    pageRole = PageRole.Generic,
    approval = Some(Approval.WellBehavedUser))


  def defaultComment(loginGrant: LoginGrant, text: String = "Comment text") =
    PostActionDto.forNewPost(
      id = PageParts.UnassignedId, creationDati = new ju.Date,
      userIdData = UserIdData.newTest(loginGrant.login.id, userId = loginGrant.user.id),
      parentPostId = Some(PageParts.BodyId),
      text = text, markup = "para", approval = None)


  def createPasswordRole(): (Identity, User) = {
    val email = "pswd-test@ex.com"
    val hash = DbDao.saltAndHashPassword(defaultPassword)
    val identityNoId = PasswordIdentity(
      id = "?", userId = "?", email = email, passwordSaltHash = hash)
    val userNoId = User(
      id = "?", displayName = "PasswordUser", email = email,
      emailNotfPrefs = EmailNotfPrefs.Receive)
    dao.createPasswordIdentityAndRole(identityNoId, userNoId)
  }


  val defaultGuestLoginAttempt = GuestLoginAttempt(
    ip = "1.1.1.1", date = new ju.Date, prevLoginId = None,
    name = "GuestName", email = "guest-email@ex.com", location = "", website = "")


  def loginAsGuest(name: String) = {
    dao.saveLogin(defaultGuestLoginAttempt.copy(name = name))
  }


  def login(identity: Identity): LoginGrant = {
    identity match {
      case passwordIdentity: PasswordIdentity =>
        dao.saveLogin(PasswordLoginAttempt(
          ip = "11.12.13.14", date = new ju.Date(), prevLoginId = None,
          email = passwordIdentity.email, password = defaultPassword))
      case _ =>
        ???
    }
  }


  def createPageAndBody(loginGrant: LoginGrant, pageRole: PageRole): Page = {
    val pagePartsNoId = PageParts(guid = "?", actionDtos = defaultBody(loginGrant)::Nil)
    val page = dao.createPage(Page.newPage(
      pageRole, defaultPagePath, pagePartsNoId, publishDirectly = true,
      author = loginGrant.user))
    page
  }


  def addComment(loginGrant: LoginGrant, page: PageNoPath, text: String): (PageNoPath, Post) = {
    val postNoId = defaultComment(loginGrant, text)
    val (pageAfter, rawPost::Nil) = dao.savePageActions(page, postNoId::Nil)
    val post = pageAfter.parts.getPost(rawPost.id) getOrElse assErr("Dw7FK91R", "New post missing")
    (pageAfter, post)
  }


  def vote(loginGrant: LoginGrant, page: PageNoPath, postId: PostId,
        voteType: PostActionPayload.Vote) {
    val vote = PostActionDto(
      id = PageParts.UnassignedId,
      postId = postId,
      creationDati = new ju.Date(),
      userIdData = UserIdData.newTest(loginId = loginGrant.login.id, userId = loginGrant.user.id),
      payload = voteType)
    dao.savePageActions(page, vote::Nil)
  }
}
