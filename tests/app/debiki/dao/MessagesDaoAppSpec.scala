/**
 * Copyright (c) 2015 Kaj Magnus Lindberg
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

package debiki.dao

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.{TextAndHtml, Globals}
import org.scalatest._


class MessagesDaoAppSpec extends DaoAppSuite(disableScripts = true, disableBackgroundJobs = true) {

  "MessagesDao can" - {

    "send a message" in {
      val dao = Globals.siteDao(Site.FirstSiteId)
      createPasswordOwner("5kwu8f40", dao)
      val userOne = createPasswordUser("zzxxffgg", dao, trustLevel = TrustLevel.Basic)
      val userTwo = createPasswordUser("qqwwffpp", dao, trustLevel = TrustLevel.Basic)
      val pagePath = dao.startGroupTalk(title = TextAndHtml.testTitle("title_558206"),
        body = TextAndHtml.testBody("message_2749"), PageRole.FormalMessage,
        toUserIds = Set(userTwo.id), sentByWho = Who(userOne.id, browserIdData),
        dummySpamRelReqStuff)

      dao.readOnlyTransaction { transaction =>
        val page = PageDao(pagePath.pageId getOrDie "EsE6GMUK2", transaction)
        page.role mustBe PageRole.FormalMessage
        page.categoryId mustBe None
        page.parts.theTitle.approvedSource mustBe Some("title_558206")
        page.parts.theBody.approvedSource mustBe Some("message_2749")

        val memberIds = transaction.loadMessageMembers(page.id)
        memberIds.size mustBe 2
        memberIds must contain(userOne.id)
        memberIds must contain(userTwo.id)

        transaction.loadNotificationsForRole(
          userOne.id, limit = 99, unseenFirst = true) mustBe empty

        val userTwoNotfs = transaction.loadNotificationsForRole(
          userTwo.id, limit = 99, unseenFirst = true)
        userTwoNotfs.length mustBe 1
        val notf = userTwoNotfs.head
        notf.toUserId mustBe userTwo.id
        notf.tyype mustBe NotificationType.Message
        notf match {
          case newPotsNotf: Notification.NewPost =>
            newPotsNotf.byUserId mustBe userOne.id
            newPotsNotf.uniquePostId mustBe page.parts.theBody.id
          case x =>
            fail(s"Bad notf type: ${classNameOf(x)}")
        }
      }
    }


    "only send message to staff if is moderate threat" in {
      val dao = Globals.siteDao(Site.FirstSiteId)
      val admin = createPasswordOwner("9403dfpw", dao)
      val badUser = createPasswordUser("btk3rr40", dao, trustLevel = TrustLevel.Basic)
      val otherUser = createPasswordUser("r90t4gdf", dao, trustLevel = TrustLevel.Basic)

      dao.lockMemberThreatLevel(badUser.id, Some(ThreatLevel.ModerateThreat))
      testMayNotMessage(dao, admin, sender = badUser, otherUser = otherUser)

      info("but a mild threat may message non-staff users"); {
        dao.lockMemberThreatLevel(badUser.id, Some(ThreatLevel.MildThreat))
        val pagePath = sendMessageTo(Set(otherUser.id), fromUserId = badUser.id, dao)
        val pageMeta = dao.readOnlyTransaction(_.loadThePageMeta(pagePath.thePageId))
        pageMeta.pageRole mustBe PageRole.FormalMessage
      }
    }


    "only send message to staff if is TrustLevel.New" in {
      val dao = Globals.siteDao(Site.FirstSiteId)
      val admin = createPasswordOwner("33BT02uf", dao)

      val newUser = createPasswordUser("zz39ys40rf", dao, trustLevel = TrustLevel.New)
      val otherUser = createPasswordUser("z39gi4ck", dao, trustLevel = TrustLevel.New)

      testMayNotMessage(dao, admin, sender = newUser, otherUser = otherUser)

      info("but a Basic user may message non-staff users"); {
        dao.lockMemberTrustLevel(newUser.id, Some(TrustLevel.Basic))
        val pagePath = sendMessageTo(Set(otherUser.id), fromUserId = newUser.id, dao)
        val pageMeta = dao.readOnlyTransaction(_.loadThePageMeta(pagePath.thePageId))
        pageMeta.pageRole mustBe PageRole.FormalMessage
      }
    }


    def testMayNotMessage(dao: SiteDao, admin: User, sender: User, otherUser: User) {
      info("a moderate threat can message admin"); {
        val pagePath = dao.startGroupTalk(title = TextAndHtml.testTitle("title_0482745"),
          body = TextAndHtml.testBody("body_0482745"), PageRole.FormalMessage,
          toUserIds = Set(admin.id), sentByWho = Who(sender.id, browserIdData),
          dummySpamRelReqStuff)

        val pageMeta = dao.readOnlyTransaction(_.loadThePageMeta(pagePath.thePageId))
        pageMeta.pageRole mustBe PageRole.FormalMessage
      }

      info("but may not message non-staff")
      intercept[Exception] {
        sendMessageTo(Set(otherUser.id), fromUserId = sender.id, dao)
      }.getMessage must include("EsE8GY2F4_")

      info("and may not message staff + non-staff")
      intercept[Exception] {
        sendMessageTo(Set(admin.id, otherUser.id), fromUserId = sender.id, dao)
      }.getMessage must include("EsE8GY2F4_")
    }


    def sendMessageTo(toWhom: Set[UserId], fromUserId: UserId, dao: SiteDao): PagePath =
      dao.startGroupTalk(title = TextAndHtml.testTitle("title_0482745"),
        body = TextAndHtml.testBody("body_0482745"), PageRole.FormalMessage, toUserIds = toWhom,
        sentByWho = Who(fromUserId, browserIdData), dummySpamRelReqStuff)

  }

}
