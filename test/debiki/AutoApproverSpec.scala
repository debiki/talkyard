/**
 * Copyright (C) 2012 Kaj Magnus Lindberg (born 1979)
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

import controllers._
import com.debiki.v0._
import debiki.dao.TenantDao
import java.{util => ju}
import org.specs2.mutable._
import org.specs2.mock._
import Prelude._
import play.api.mvc.Request
import com.debiki.v0.{PostActionPayload => PAP}


class AutoApproverSpec extends Specification with Mockito {

  val startDati = new ju.Date(10 * 1000)
  val TenantId = "tenantid"
  val Ip = "1.1.1.1"
  val PageId = "pageid"
  def now() = new ju.Date()


  val guestUser = User(
    id = "-guestid",
    displayName = "Guest Name",
    email = "guest.email@.com",
    emailNotfPrefs = null,
    country = "",
    website = "",
    isAdmin = false,
    isOwner = false)

  val guestIdty = IdentitySimple(
    id = guestUser.id drop 1, // drop "-"
    userId = guestUser.id,
    name = guestUser.displayName,
    email = guestUser.email,
    location = guestUser.country,
    website = guestUser.website)


  val openidUser = User(
    id = "openid",
    displayName = "Oid User Name",
    email = "oid.email@.com",
    emailNotfPrefs = null,
    country = "",
    website = "",
    isAdmin = false,
    isOwner = false)

  val openidIdty = IdentityOpenId(
    id = "oididtyid",
    userId = openidUser.id,
    oidEndpoint = "",
    oidVersion = "",
    oidRealm = "",
    oidClaimedId = "",
    oidOpLocalId = "",
    firstName = openidUser.displayName,
    email = openidUser.email,
    country = openidUser.country)


  val PlayReq = new Request[Unit] {
    def id = 12345
    def tags = Map.empty
    def uri = "uri"
    def path = "path"
    def method = "METHOD"
    def version = "1.1"
    def queryString = Map.empty
    def headers = null
    lazy val remoteAddress = Ip
    def username = None
    val body = ()
  }


  val pagePath = PagePath(
     tenantId = TenantId,
     folder = "/",
     pageId = Some(PageId),
     showId = true,
     pageSlug = "page-slug")


  def pageReq(user: User, identity: Identity)(dao: TenantDao) =
    PageRequest[Unit](
      sid = null,
      xsrfToken = null,
      identity = Some(identity),
      user = Some(user),
      pageExists = true,
      pagePath = pagePath,
      permsOnPage = PermsOnPage.All,
      dao = dao,
      request = PlayReq)()

  def pageReqOpenId = pageReq(openidUser, openidIdty) _
  def pageReqGuest = pageReq(guestUser, guestIdty) _


  val quotaConsumers = QuotaConsumers(
    tenantId = TenantId, ip = Some(Ip), roleId = None)

  val peopleNoLogins =
    People() + guestIdty + openidIdty + guestUser + openidUser +
      SystemUser.Identity + SystemUser.User

  val testUserLoginId = "101"


  def testUserPageBody(implicit testUserId: String) =
    PostActionDto.forNewPageBody(creationDati = startDati,
      loginId = testUserLoginId, userId = testUserId, text = "täxt-tåxt",
      pageRole = PageRole.Generic, approval = None)

  val testUserReplyAId = 2
  def testUserReplyA(implicit testUserId: String) =
    PostActionDto.copyCreatePost(testUserPageBody, id = testUserReplyAId,
      parentPostId = testUserPageBody.id)

  val testUserReplyBId = 3
  def testUserReplyB(implicit testUserId: String) =
    PostActionDto.copyCreatePost(testUserPageBody, id = testUserReplyBId,
      parentPostId = testUserPageBody.id)

  def manyTestUserReplies(num: Int)(implicit testUserId: String)
        : List[PostActionDto[PAP.CreatePost]] =
    (101 to (100 + num)).toList map { postId =>
      PostActionDto.copyCreatePost(testUserPageBody, id = postId,
        parentPostId = testUserPageBody.id)
    }


  val approvalOfReplyA: PostActionDto[PAP.ReviewPost] = PostActionDto.toReviewPost(
    id = 10002, postId = testUserReplyAId, loginId = SystemUser.Login.id,
    userId = SystemUser.Identity.id, ctime = now(), approval = Some(Approval.Manual))


  val (guestLogin, openidLogin) = {
    val login = Login(id = testUserLoginId, ip = Ip, prevLoginId = None,
       date = startDati, identityId = "?")
    (login.copy(identityId = guestIdty.id),
      login.copy(identityId = openidIdty.id))
  }


  def newDaoMock(actionDtos: List[PostActionDto[_]], login: Login, testUserId: String) = {

    val actions: Seq[PostActionOld] = {
      val page = PageParts("pageid") ++ actionDtos
      page.postsByUser(withId = testUserId)
    }

    val people =
      if (actionDtos nonEmpty) peopleNoLogins + login
      else People.None

    val daoMock = mock[TenantDao]
    daoMock.tenantId returns TenantId
    daoMock.quotaConsumers returns quotaConsumers

    daoMock.loadRecentActionExcerpts(
      fromIp = Some(Ip),
      limit = AutoApprover.RecentActionsLimit)
       .returns(actions -> people)

    daoMock.loadRecentActionExcerpts(
      byIdentity = Some(guestIdty.id),
      limit = AutoApprover.RecentActionsLimit)
       .returns(actions -> people)

    daoMock
  }


  "AutoApprover" can {

    "approve an admin's comments" >> {
      pending
    }


    "approve a guest user's first comments preliminarily" >> {

      implicit val testUserId = guestUser.id

      "the first one" >> {
        implicit val testUserId = guestUser.id
        val dao = newDaoMock(Nil, null, testUserId)
        AutoApprover.perhapsApprove(pageReqGuest(dao)) must_== Some(Approval.Preliminary)
      }

      "the second" >> {
        // This prel approves replyA.
        val dao = newDaoMock(List(testUserReplyA), guestLogin, testUserId)
        AutoApprover.perhapsApprove(pageReqGuest(dao)) must_== Some(Approval.Preliminary)
      }

      "but not the third one" >> {
        // This prel approves replyA and B.
        val dao = newDaoMock(List(testUserReplyA, testUserReplyB), guestLogin, testUserId)
        AutoApprover.perhapsApprove(pageReqGuest(dao)) must_== None
      }

      "do approve the third comment, when one other comment has been manually approved" >> {
        val dao = newDaoMock(List(
          testUserReplyA, testUserReplyB, approvalOfReplyA), guestLogin, testUserId)
        AutoApprover.perhapsApprove(pageReqGuest(dao)) must_== Some(Approval.Preliminary)
      }

      "approve up to five comments, when one has been manually approved" >> {
        // 1 approved comment + 5 unreviewed but prel approved =>
        //   the next comment should also be prel approved, 5 is not many (if we
        //   already allow 2 from completely new users).
        val dao = newDaoMock(List(
            testUserReplyA, testUserReplyB, approvalOfReplyA) ::: manyTestUserReplies(4),
          guestLogin, testUserId)
        AutoApprover.perhapsApprove(pageReqGuest(dao)) must_== Some(Approval.Preliminary)
      }

      "not approve ten or more comments, when only one has been manually approved" >> {
        // 1 approved comment + 10 unreviewed but prel approved =>
        //  the next comment won't be prel approved.
        val dao = newDaoMock(List(
          testUserReplyA, testUserReplyB, approvalOfReplyA) ::: manyTestUserReplies(9),
          guestLogin, testUserId)
        AutoApprover.perhapsApprove(pageReqGuest(dao)) must_== None
      }
    }


    "approve a well behaved user's comments, preliminarily" >> {

      "if many comments have already been approved" >> {
        pending
      }

      "unless too many unreviewed comments, from that user" >> {
        pending
      }

      "unless too many unreviewed comments, from all users" >> {
        pending
      }
    }


    "queue comment for moderation" >> {

      "if any recent comment rejected" >> {
        pending
      }

      "if any recent comment flagged" >> {
        pending
      }
    }


    "throw Forbidden response" >> {

      "if a spammer has fairly many comments pending moderation" >> {
        pending
      }

      "if a well behaved user has terribly many comments pending" >> {
        pending
      }
    }

  }

}


