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
import com.debiki.core.Prelude._
import debiki._
import debiki.dao.{DaoAppSuite, SiteDao}


class SiteTransactionAppSpec extends DaoAppSuite {

  // Add this to some dates, because sometimes the SQL code does greatest(...) and won't
  // update the data in the database, unless it's greater than the current tim.
  // This date-time is Mon Mar 26 2068 17:53:21. (Will I be alive at that time :- ))
  val FutureMs = 3100010001000L

  "SiteTransaction can handle member stats" - {
    lazy val dao: SiteDao = Globals.siteDao(Site.FirstSiteId)

    lazy val forumId = dao.createForum(title = "Forum to delete", folder = "/",
      Who(SystemUserId, browserIdData)).pagePath.thePageId

    var admin: User = null
    var other: User = null
    var pageId: PageId = null
    var otherPageId: PageId = null
    var thirdPageId: PageId = null

    "prepare: create users" in {
      admin = createPasswordOwner(s"txt_adm", dao)
      other = createPasswordUser(s"txt_otr", dao)
    }

    "prepare: create pages" in {
      // Num topics created by admin is tested later, (5FKW02Y).
      pageId = createPage(PageRole.Discussion, TextAndHtml.forTitle("Page Title XY 12 AB"),
        TextAndHtml.forBodyOrComment("Page body."), authorId = admin.id, browserIdData,
        dao, anyCategoryId = None)
      otherPageId = createPage(PageRole.Discussion, TextAndHtml.forTitle("Other Page Title"),
        TextAndHtml.forBodyOrComment("Other page body."), authorId = admin.id, browserIdData,
        dao, anyCategoryId = None)
      thirdPageId = createPage(PageRole.Discussion, TextAndHtml.forTitle("Third Page Title"),
        TextAndHtml.forBodyOrComment("Third page body."), authorId = admin.id, browserIdData,
        dao, anyCategoryId = None)
    }


    "load and save UserStats" in {
      dao.readWriteTransaction { transaction =>
        val autoCreatedStats = transaction.loadUserStats(admin.id) getOrDie "EdE5FKW026"
        autoCreatedStats.lastSeenAt.millis must be > 0L
        autoCreatedStats.lastPostedAt mustBe defined  // admin created a page above
        autoCreatedStats.lastEmailedAt mustBe None
        autoCreatedStats.emailBounceSum mustBe 0f
        autoCreatedStats.firstSeenAtOr0.millis must be > 0L
        autoCreatedStats.firstNewTopicAt mustBe defined
        autoCreatedStats.firstDiscourseReplyAt mustBe None
        autoCreatedStats.firstChatMessageAt mustBe None
        autoCreatedStats.topicsNewSince.millis must be > 0L
        autoCreatedStats.notfsNewSinceId mustBe 0
        autoCreatedStats.numDaysVisited mustBe 0
        autoCreatedStats.numSecondsReading mustBe 0
        autoCreatedStats.numDaysVisited mustBe 0
        autoCreatedStats.numSecondsReading mustBe 0
        autoCreatedStats.numDiscourseRepliesRead mustBe 0
        autoCreatedStats.numDiscourseRepliesPosted mustBe 0
        autoCreatedStats.numDiscourseTopicsEntered mustBe 0
        autoCreatedStats.numDiscourseTopicsRepliedIn mustBe 0
        autoCreatedStats.numDiscourseTopicsCreated mustBe 3   // (5FKW02Y)
        autoCreatedStats.numChatMessagesRead mustBe 0
        autoCreatedStats.numChatMessagesPosted mustBe 0
        autoCreatedStats.numChatTopicsEntered mustBe 0
        autoCreatedStats.numChatTopicsRepliedIn mustBe 0
        autoCreatedStats.numChatTopicsCreated mustBe 0
        autoCreatedStats.numLikesGiven mustBe 0
        autoCreatedStats.numLikesReceived mustBe 0
        autoCreatedStats.numSolutionsProvided mustBe 0

        transaction.upsertUserStats(stats(admin.id, 100, 100))
        transaction.loadUserStats(admin.id).get mustBe stats(admin.id, 100, 100)

        transaction.upsertUserStats(stats(other.id, 200, 200))
        transaction.loadUserStats(admin.id).get mustBe stats(admin.id, 100, 100)
        transaction.loadUserStats(other.id).get mustBe stats(other.id, 200, 200)

        // Overwrite, shouldn't overwrite the admin user.
        transaction.upsertUserStats(stats(other.id, 180, 220))
        transaction.loadUserStats(admin.id).get mustBe stats(admin.id, 100, 100)
        transaction.loadUserStats(other.id).get mustBe stats(other.id, 180, 220)
      }

      def stats(userId: UserId, firstNumber: Int, lastNumber: Int) = UserStats(
        userId = userId,
        lastSeenAt = When.fromMillis(FutureMs + lastNumber + 18),
        lastPostedAt = Some(When.fromMillis(FutureMs + lastNumber + 17)),
        lastEmailedAt = Some(When.fromMillis(FutureMs + lastNumber + 19)),
        emailBounceSum = lastNumber + 10,
        firstSeenAtOr0 = When.fromMillis(firstNumber + 1),
        firstNewTopicAt = Some(When.fromMillis(firstNumber + 2)),
        firstDiscourseReplyAt = Some(When.fromMillis(firstNumber + 3)),
        firstChatMessageAt = Some(When.fromMillis(firstNumber + 4)),
        topicsNewSince = When.fromMillis(FutureMs + lastNumber + 11),
        notfsNewSinceId = lastNumber + 20,
        numDaysVisited = firstNumber + 21,
        numSecondsReading = firstNumber + 22,
        numDiscourseRepliesRead = firstNumber + 23,
        numDiscourseRepliesPosted = firstNumber + 24,
        numDiscourseTopicsEntered = firstNumber + 25,
        numDiscourseTopicsRepliedIn = firstNumber + 26,
        numDiscourseTopicsCreated = firstNumber + 27,
        numChatMessagesRead = firstNumber + 30,
        numChatMessagesPosted = firstNumber + 31,
        numChatTopicsEntered = firstNumber + 32,
        numChatTopicsRepliedIn = firstNumber + 33,
        numChatTopicsCreated = firstNumber + 34,
        numLikesGiven = firstNumber + 40,
        numLikesReceived = firstNumber + 41)
    }


    "load and save MemberVisitStats" in {
      dao.readWriteTransaction { transaction =>
        transaction.upsertUserVisitStats(stats(admin.id, 10, 1000))
        transaction.loadUserVisitStats(admin.id) mustBe Seq(stats(admin.id, 10, 1000))
        transaction.loadUserVisitStats(other.id) mustBe Nil

        transaction.upsertUserVisitStats(stats(other.id, 20, 2000))
        transaction.loadUserVisitStats(admin.id) mustBe Seq(stats(admin.id, 10, 1000))
        transaction.loadUserVisitStats(other.id) mustBe Seq(stats(other.id, 20, 2000))

        // Overwrite, shouldn't overwrite the admin user.
        transaction.upsertUserVisitStats(stats(other.id, 20, 2100))
        transaction.loadUserVisitStats(admin.id) mustBe Seq(stats(admin.id, 10, 1000))
        transaction.loadUserVisitStats(other.id) mustBe Seq(stats(other.id, 20, 2100))

        // Add 40, so like: [40, 20]
        transaction.upsertUserVisitStats(stats(other.id, 40, 4000))
        transaction.loadUserVisitStats(admin.id) mustBe Seq(stats(admin.id, 10, 1000))
        transaction.loadUserVisitStats(other.id) mustBe Seq(
          stats(other.id, 40, 4000), stats(other.id, 20, 2100))

        // Add 30, so like: [40, 30, 20]
        transaction.upsertUserVisitStats(stats(other.id, 30, 3000))
        transaction.loadUserVisitStats(admin.id) mustBe Seq(stats(admin.id, 10, 1000))
        transaction.loadUserVisitStats(other.id) mustBe Seq(
          stats(other.id, 40, 4000), stats(other.id, 30, 3000), stats(other.id, 20, 2100))

        // Overwrite again, shouldn't overwrite 20 and 40.
        transaction.upsertUserVisitStats(stats(other.id, 30, 3333))
        transaction.loadUserVisitStats(admin.id) mustBe Seq(stats(admin.id, 10, 1000))
        transaction.loadUserVisitStats(other.id) mustBe Seq(
          stats(other.id, 40, 4000), stats(other.id, 30, 3333), stats(other.id, 20, 2100))
      }

      def stats(userId: UserId, days: Int, number: Int) = UserVisitStats(
        userId = userId,
        visitDate = WhenDay.fromDays(days),
        numSecondsReading = number + 1,
        numDiscourseRepliesRead = number + 3,
        numDiscourseTopicsEntered = number + 5,
        numChatMessagesRead = number + 8,
        numChatTopicsEntered = number + 10)
    }


    "load and save ReadingProgress" - {

      var progressLowNrs: ReadingProgress = null
      var progressHighNrs: ReadingProgress = null

      "empty ReadingProgress" in {
        dao.readWriteTransaction { transaction =>
          val progress = ReadingProgress(
            firstVisitedAt = When.fromMinutes(1000),
            lastVisitedAt = When.fromMinutes(1010),
            lastViewedPostNr = 1020,
            lastReadAt = None,
            lastPostNrsReadRecentFirst = Vector.empty,
            lowPostNrsRead = Set.empty,
            secondsReading = 0)
          transaction.upsertReadProgress(admin.id, pageId, progress)

          var loadedProgress = transaction.loadReadProgress(admin.id, "wrong_page_id")
          loadedProgress mustBe None
          loadedProgress = transaction.loadReadProgress(admin.id, pageId)
          loadedProgress mustBe Some(progress)
        }
      }

      "ReadingProgress with low post nrs only" in {
        dao.readWriteTransaction { transaction =>
          progressLowNrs = ReadingProgress(
            firstVisitedAt = When.fromMinutes(2000),
            lastVisitedAt = When.fromMinutes(2010),
            lastViewedPostNr = 2020,
            lastReadAt = Some(When.fromMinutes(2002)),
            lastPostNrsReadRecentFirst = Vector.empty,
            lowPostNrsRead = Set(1, 2, 3, 8),
            secondsReading = 203)
          transaction.upsertReadProgress(admin.id, otherPageId, progressLowNrs)
          var loadedProgress = transaction.loadReadProgress(admin.id, otherPageId)
          loadedProgress mustBe Some(progressLowNrs)
        }
      }

      "ReadingProgress with high post nr" in {
        dao.readWriteTransaction { transaction =>
          progressHighNrs = ReadingProgress(
            firstVisitedAt = When.fromMinutes(3000),
            lastVisitedAt = When.fromMinutes(3010),
            lastViewedPostNr = 3020,
            lastReadAt = Some(When.fromMinutes(3002)),
            lastPostNrsReadRecentFirst = Vector(3103),
            lowPostNrsRead = Set(1, 10, 100, 200, 300, 400, 500, 512),
            secondsReading = 303)
          transaction.upsertReadProgress(admin.id, thirdPageId, progressHighNrs)
          val loadedProgress = transaction.loadReadProgress(admin.id, thirdPageId)
          loadedProgress mustBe Some(progressHighNrs)
        }
      }

      "overwrite ReadingProgress" in {
        dao.readWriteTransaction { transaction =>
          val progress = ReadingProgress(
            firstVisitedAt = When.fromMinutes(4000),
            lastVisitedAt = When.fromMinutes(4040),
            lastViewedPostNr = 4020,
            lastReadAt = Some(When.fromMinutes(4030)),
            lastPostNrsReadRecentFirst = Vector(4104),
            lowPostNrsRead = Set(1, 2, 3, 4, 5, 6, 7, 8),
            secondsReading = 403)
          transaction.upsertReadProgress(admin.id, thirdPageId, progress)
          val loadedProgress = transaction.loadReadProgress(admin.id, thirdPageId)
          loadedProgress mustBe Some(progress)
        }
      }
    }
  }

}
