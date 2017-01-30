/**
 * Copyright (C) 2017 Kaj Magnus Lindberg
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

package ed.server.dao

import com.debiki.core._
import debiki._
import debiki.dao.{DaoAppSuite, SiteDao}


class SiteTransactionAppSpec extends DaoAppSuite {


  "SiteTransaction can handle member stats" - {
    lazy val dao: SiteDao = Globals.siteDao(Site.FirstSiteId)

    lazy val forumId = dao.createForum(title = "Forum to delete", folder = "/",
      Who(SystemUserId, browserIdData)).pagePath.thePageId

    var admin: User = null
    var other: User = null

    "prepare: create users" in {
      admin = createPasswordOwner(s"txt_adm", dao)
      other = createPasswordUser(s"txt_otr", dao)
    }

    "load and save MemberStats" in {
      dao.readWriteTransaction { transaction =>
        transaction.upsertUserStats(stats(admin.id, 100))
        transaction.loadUserStats(admin.id).get mustBe stats(admin.id, 100)
        transaction.loadUserStats(other.id) mustBe None

        transaction.upsertUserStats(stats(other.id, 200))
        transaction.loadUserStats(admin.id).get mustBe stats(admin.id, 100)
        transaction.loadUserStats(other.id).get mustBe stats(other.id, 200)

        // Overwrite, shouldn't overwrite the admin user.
        transaction.upsertUserStats(stats(other.id, 220))
        transaction.loadUserStats(admin.id).get mustBe stats(admin.id, 100)
        transaction.loadUserStats(other.id).get mustBe stats(other.id, 220)
      }

      def stats(userId: UserId, number: Int) = UserStats(
        userId = userId,
        lastSeenAt = Some(When.fromMillis(number + 1)),
        lastPostedAt = Some(When.fromMillis(number + 2)),
        lastEmailedAt = Some(When.fromMillis(number + 3)),
        emailBounceSum = number + 4,
        firstSeenAt = Some(When.fromMillis(number + 5)),
        firstNewTopicAt = Some(When.fromMillis(number + 6)),
        firstDiscourseReplyAt = Some(When.fromMillis(number + 7)),
        firstChatMessageAt = Some(When.fromMillis(number + 8)),
        topicsNewSince = When.fromMillis(number + 9),
        notfsNewSinceId = 20,
        numDaysVisited = 21,
        numMinutesReading = 22,
        numDiscourseRepliesRead = 23,
        numDiscourseRepliesPosted = 24,
        numDiscourseTopicsEntered = 25,
        numDiscourseTopicsRepliedIn = 26,
        numDiscourseTopicsCreated = 27,
        numChatMessagesRead = 30,
        numChatMessagesPosted = 31,
        numChatTopicsEntered = 32,
        numChatTopicsRepliedIn = 33,
        numChatTopicsCreated = 34,
        numLikesGiven = 40,
        numLikesReceived = 41)
    }

    "load and save MemberVisitStats" in {
      dao.readWriteTransaction { transaction =>
        transaction.upsertMemberVisitStats(stats(admin.id, 10, 1000))
        transaction.loadMemberVisitStats(admin.id) mustBe Seq(stats(admin.id, 10, 1000))
        transaction.loadMemberVisitStats(other.id) mustBe Nil

        transaction.upsertMemberVisitStats(stats(other.id, 20, 2000))
        transaction.loadMemberVisitStats(admin.id) mustBe Seq(stats(admin.id, 10, 1000))
        transaction.loadMemberVisitStats(other.id) mustBe Seq(stats(other.id, 20, 2000))

        // Overwrite, shouldn't overwrite the admin user.
        transaction.upsertMemberVisitStats(stats(other.id, 20, 2100))
        transaction.loadMemberVisitStats(admin.id) mustBe Seq(stats(admin.id, 10, 1000))
        transaction.loadMemberVisitStats(other.id) mustBe Seq(stats(other.id, 20, 2100))

        // Add 40, so like: [40, 20]
        transaction.upsertMemberVisitStats(stats(other.id, 40, 4000))
        transaction.loadMemberVisitStats(admin.id) mustBe Seq(stats(admin.id, 10, 1000))
        transaction.loadMemberVisitStats(other.id) mustBe Seq(
          stats(other.id, 40, 4000), stats(other.id, 20, 2100))

        // Add 30, so like: [40, 30, 20]
        transaction.upsertMemberVisitStats(stats(other.id, 30, 3000))
        transaction.loadMemberVisitStats(admin.id) mustBe Seq(stats(admin.id, 10, 1000))
        transaction.loadMemberVisitStats(other.id) mustBe Seq(
          stats(other.id, 40, 4000), stats(other.id, 30, 3000), stats(other.id, 20, 2100))

        // Overwrite again, shouldn't overwrite 20 and 40.
        transaction.upsertMemberVisitStats(stats(other.id, 30, 3333))
        transaction.loadMemberVisitStats(admin.id) mustBe Seq(stats(admin.id, 10, 1000))
        transaction.loadMemberVisitStats(other.id) mustBe Seq(
          stats(other.id, 40, 4000), stats(other.id, 30, 3333), stats(other.id, 20, 2100))
      }

      def stats(userId: UserId, days: Int, number: Int) = MemberVisitStats(
        userId = userId,
        visitDate = WhenDay.fromDays(days),
        numMinutesReading = number + 1,
        numDiscourseRepliesRead = number + 3,
        numDiscourseTopicsEntered = number + 5,
        numChatMessagesRead = number + 8,
        numChatTopicsEntered = number + 10)
    }
  }

}
