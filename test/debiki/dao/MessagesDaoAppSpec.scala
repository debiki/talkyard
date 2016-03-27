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

import java.io.RandomAccessFile

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.DebikiHttp.ResultException
import debiki.{TextAndHtml, Globals}
import org.scalatest._
import org.scalatestplus.play.OneAppPerSuite
import java.{util => ju, io => jio}

import play.api.test.FakeApplication


class MessagesDaoAppSpec extends DaoAppSuite {

  "MessagesDao can" - {

    "send a message" in {
      val dao = Globals.siteDao(Site.FirstSiteId)
      val userOne = createPasswordUser("zzxxffgg", dao)
      val userTwo = createPasswordUser("qqwwffpp", dao)
      val pagePath = dao.sendMessage(title = TextAndHtml.testTitle("title_558206"),
        body = TextAndHtml.testBody("message_2749"), toUserIds = Set(userTwo.id),
        sentById = userOne.id, browserIdData = browserIdData)

      dao.readOnlyTransaction { transaction =>
        val page = PageDao(pagePath.pageId getOrDie "EsE6GMUK2", transaction)
        page.role mustBe PageRole.Message
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
            newPotsNotf.uniquePostId mustBe page.parts.theBody.uniqueId
          case x =>
            fail(s"Bad notf type: ${classNameOf(x)}")
        }
      }
    }
  }

}
