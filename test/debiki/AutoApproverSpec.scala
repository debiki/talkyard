/**
 * Copyright (c) 2012 Kaj Magnus Lindberg (born 1979)
 */

package debiki

import controllers._
import com.debiki.v0._
import java.{util => ju}
import org.specs2.mutable._
import org.specs2.mock._
import Prelude._
import play.api.mvc.Request


class AutoApproverSpec extends Specification with Mockito {

  val startDati = new ju.Date(10 * 1000)
  val TenantId = "tenantid"
  val Ip = "1.1.1.1"
  val PageId = "pageid"

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
    People() + guestIdty + openidIdty + guestUser + openidUser

  val loginId = "101"

  val body =
    Post(id = Page.BodyId, parent = Page.BodyId, ctime = startDati,
      loginId = loginId, newIp = None, text = "täxt-tåxt",
      markup = "", approval = None, tyype = PostType.Text,
      where = None)

  val replyA = body.copy(id = "2", parent = body.id)
  val replyB = body.copy(id = "3", parent = body.id)

  val (guestLogin, openidLogin) = {
    val login = Login(id = loginId, ip = Ip, prevLoginId = None,
       date = startDati, identityId = "?")
    (login.copy(identityId = guestIdty.id),
      login.copy(identityId = openidIdty.id))
  }

  def newDaoMock(actions: List[Post], login: Login) = {

    val viacs: Seq[ViAc] = {
      val page = Debate("pageid") ++ actions
      actions map (new ViPo(page, _))
    }

    val people =
      if (actions nonEmpty) peopleNoLogins + login
      else People.None

    val daoMock = mock[TenantDao]
    daoMock.tenantId returns TenantId
    daoMock.quotaConsumers returns quotaConsumers

    daoMock.loadRecentActionExcerpts(
      fromIp = Some(Ip),
      limit = AutoApprover.Limit)
       .returns(viacs -> people)

    daoMock.loadRecentActionExcerpts(
      byIdentity = Some(guestIdty.id),
      limit = AutoApprover.Limit)
       .returns(viacs -> people)

    daoMock
  }


  "AutoApprover" can {

    "approve an admin's comments" >> {
      pending
    }


    "approve a user's first comments preliminarily" >> {

      "the first one" >> {
        AutoApprover.perhapsApprove(pageReqGuest(newDaoMock(
          Nil, null))) must_== Some(Approval.Preliminary)
      }

      "the second" >> {
        // SHOULD prel approve replyA.
        AutoApprover.perhapsApprove(pageReqGuest(newDaoMock(
          List(replyA), guestLogin))) must_== Some(Approval.Preliminary)
      }

      "but not the third one" >> {
        // SHOULD prel approve replyA and B.
        AutoApprover.perhapsApprove(pageReqGuest(newDaoMock(
          List(replyA, replyB), guestLogin))) must_== None
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


