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
import debiki.dao.{CreateForumResult, DaoAppSuite, SiteDao}


class SiteTransactionAppSpec extends DaoAppSuite {

  // Add this to some dates, because sometimes the SQL code does greatest(...) and won't
  // update the data in the database, unless it's greater than the current tim.
  // This date-time is Mon Mar 26 2068 17:53:21. (Will I be alive at that time :- ))
  val FutureMs = 3100010001000L

  "SiteTransaction can handle member stats" - {
    lazy val dao: SiteDao = {
      globals.systemDao.getOrCreateFirstSite()
      globals.siteDao(Site.FirstSiteId)
    }

    lazy val forumId = dao.createForum(title = "Forum to delete", folder = "/", isForEmbCmts = false,
      Who(SystemUserId, browserIdData)).get.pagePath.thePageId

    var admin: Participant = null
    var other: Participant = null
    var pageId: PageId = null
    var otherPageId: PageId = null
    var thirdPageId: PageId = null

    "prepare: create users" in {
      admin = createPasswordOwner(s"txt_adm", dao)
      other = createPasswordUser(s"txt_otr", dao)
    }

    "prepare: create pages" in {
      // Num topics created by admin is tested later, (5FKW02Y).
      pageId = createPage(PageType.Discussion, textAndHtmlMaker.forTitle("Page Title XY 12 AB"),
        textAndHtmlMaker.forBodyOrComment("Page body."), authorId = admin.id, browserIdData,
        dao, anyCategoryId = None)
      otherPageId = createPage(PageType.Discussion, textAndHtmlMaker.forTitle("Other Page Title"),
        textAndHtmlMaker.forBodyOrComment("Other page body."), authorId = admin.id, browserIdData,
        dao, anyCategoryId = None)
      thirdPageId = createPage(PageType.Discussion, textAndHtmlMaker.forTitle("Third Page Title"),
        textAndHtmlMaker.forBodyOrComment("Third page body."), authorId = admin.id, browserIdData,
        dao, anyCategoryId = None)
    }


    // Some of these could be moved to elsewhere? Or the wrapping test could be renamed.

    "find users by username prefix" in {
      dao.readWriteTransaction { tx =>
        info("no members")
        tx.loadUsersWithPrefix("zzz") mustBe Nil

        info("all members")
        var allMembers = tx.loadUsersWithPrefix("")
        allMembers.length mustBe 2
        allMembers = tx.loadUsersWithPrefix("t")
        allMembers.length mustBe 2
        allMembers = tx.loadUsersWithPrefix("txt_")
        allMembers.length mustBe 2

        info("specific member")
        var admin = tx.loadUsersWithPrefix("txt_a")
        admin.length mustBe 1
        admin.head.username mustBe Some("txt_adm")
        admin = tx.loadUsersWithPrefix("txt_adm")
        admin.length mustBe 1
        admin.head.username mustBe Some("txt_adm")
      }
    }


    "load and save alt page ids" - {
      "save alt page ids" in {
        dao.readWriteTransaction { tx =>
          tx.insertAltPageId("aabbccdd", pageId)
          tx.insertAltPageId("http://www.example.com/some/path", otherPageId)
          tx.insertAltPageId("http://www.example.com/another/path", otherPageId)
          tx.insertAltPageId("other-kind-of-id-With-UPPercase", otherPageId)
        }
      }

      "load alt page ids" in {
        dao.readOnlyTransaction { tx =>
          tx.loadRealPageId("aabbccdd") mustBe Some(pageId)
          tx.loadRealPageId("http://www.example.com/some/path") mustBe Some(otherPageId)
          tx.loadRealPageId("http://www.example.com/another/path") mustBe Some(otherPageId)
          tx.loadRealPageId("other-kind-of-id-With-UPPercase") mustBe Some(otherPageId)
          tx.loadRealPageId("non_existing_id") mustBe None
          tx.loadRealPageId("") mustBe None
        }
      }

      "list alt page ids" in {
        dao.readOnlyTransaction { tx =>
          tx.listAltPageIds("0") mustBe Set.empty // no such id
          tx.listAltPageIds("99999") mustBe Set.empty // no such id
          tx.listAltPageIds(pageId) mustBe Set("aabbccdd")
          tx.listAltPageIds(otherPageId) mustBe Set(
            "http://www.example.com/some/path",
            "http://www.example.com/another/path",
            "other-kind-of-id-With-UPPercase")
          tx.listAltPageIds(thirdPageId) mustBe Set.empty
        }
      }
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
        numLikesReceived = firstNumber + 41,
        tourTipsSeen = Some(Vector()))   // [7AKBR24] change Null in db and None here, to empty array?
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


    "load and save PageReadingProgress" - {

      var progressLowNrs: PageReadingProgress = null
      var progressHighNrs: PageReadingProgress = null

      "empty PageReadingProgress" in {
        dao.readWriteTransaction { transaction =>
          val progress = PageReadingProgress(
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

      "PageReadingProgress with low post nrs only" in {
        dao.readWriteTransaction { transaction =>
          progressLowNrs = PageReadingProgress(
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

      "PageReadingProgress with high post nr" in {
        dao.readWriteTransaction { transaction =>
          progressHighNrs = PageReadingProgress(
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

      "overwrite PageReadingProgress" in {
        dao.readWriteTransaction { transaction =>
          val progress = PageReadingProgress(
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


  "SiteTransaction can handle posts read stats" - {
      lazy val dao: SiteDao = globals.siteDao(Site.FirstSiteId)

      lazy val forumId = dao.createForum(title = "Forum to delete", folder = "/", isForEmbCmts = false,
        Who(SystemUserId, browserIdData)).get.pagePath.thePageId

      var admin: Participant = null
      var userA: Participant = null
      var userB: Participant = null
      var guestA: Participant = null
      var guestB: Participant = null
      var pageAId: PageId = null
      var pageBId: PageId = null

      "prepare: create users" in {
        admin = createPasswordOwner(s"prs_adm", dao)
        userA = createPasswordUser(s"prs_u_a", dao)
        userB = createPasswordUser(s"prs_u_b", dao)
        guestA = dao.loginAsGuest(GuestLoginAttempt(ip = "2.2.2.2", globals.now().toJavaDate,
          name = "Guestellina", guestBrowserId = "guestellinacookie"))
        guestB = dao.loginAsGuest(GuestLoginAttempt(ip = "3.3.3.3", globals.now().toJavaDate,
          name = "Gunnar", guestBrowserId = "gunnarcookie"))
      }

      "prepare: create pages" in {
        pageAId = createPage(PageType.Discussion, textAndHtmlMaker.forTitle("Page Title XY 12 AB"),
          textAndHtmlMaker.forBodyOrComment("Page body."), authorId = admin.id, browserIdData,
          dao, anyCategoryId = None)
        reply(admin.id, pageAId, s"Post 2")(dao)
        reply(admin.id, pageAId, s"Post 3")(dao)
        reply(admin.id, pageAId, s"Post 4")(dao)
        reply(admin.id, pageAId, s"Post 5")(dao)
        reply(admin.id, pageAId, s"Post 6")(dao)

        pageBId = createPage(PageType.Discussion, textAndHtmlMaker.forTitle("Other Page Title"),
          textAndHtmlMaker.forBodyOrComment("Other page body."), authorId = admin.id, browserIdData,
          dao, anyCategoryId = None)
        reply(admin.id, pageBId, s"Post 2")(dao)
        reply(admin.id, pageBId, s"Post 3")(dao)
        reply(admin.id, pageBId, s"Post 4")(dao)
        reply(admin.id, pageBId, s"Post 5")(dao)
        reply(admin.id, pageBId, s"Post 6")(dao)
        reply(admin.id, pageBId, s"Post 7")(dao)
        reply(admin.id, pageBId, s"Post 8")(dao)
      }

      "load and save posts read stats, for members" in {
        dao.readWriteTransaction { transaction =>
          transaction.updatePostsReadStats(pageAId, postNrsRead = Set(1), userA.id,
            readFromIp = "1.2.3.4")
          transaction.updatePostsReadStats(pageBId, postNrsRead = Set(1,2,3,5), userA.id,
            readFromIp = "1.2.3.4")
          transaction.updatePostsReadStats(pageBId, postNrsRead = Set(1,5), userB.id,
            readFromIp = "1.2.3.4")

          val pageAStats = transaction.loadPostsReadStats(pageAId)

          info("May not query for negative numbers and the title — that'd always be a bug")
          intercept[IllegalArgumentException] {
            pageAStats.readCountFor(-2)
          }
          intercept[IllegalArgumentException] {
            pageAStats.readCountFor(PageParts.TitleNr)
          }
          intercept[IllegalArgumentException] {
            pageAStats.readCountFor(PageParts.NoNr)
          }

          info("Non-existing posts = never read")
          pageAStats.readCountFor(9999) mustBe 0

          info("Real posts have correct counts")
          pageAStats.readCountFor(1) mustBe 1
          pageAStats.readCountFor(2) mustBe 0
          pageAStats.readCountFor(3) mustBe 0
          pageAStats.readCountFor(4) mustBe 0

          val pageBStats = transaction.loadPostsReadStats(pageBId)
          pageBStats.readCountFor(1) mustBe 2
          pageBStats.readCountFor(2) mustBe 1
          pageBStats.readCountFor(3) mustBe 1
          pageBStats.readCountFor(4) mustBe 0
          pageBStats.readCountFor(5) mustBe 2
          pageBStats.readCountFor(6) mustBe 0
          pageBStats.readCountFor(7) mustBe 0
          pageBStats.readCountFor(8) mustBe 0

          info("Handles dupl inserts: post 5 already inserted")
          transaction.updatePostsReadStats(pageBId, postNrsRead = Set(5, 7), userB.id,
            readFromIp = "1.2.3.4")
          val pageBStats2 = transaction.loadPostsReadStats(pageBId)
          pageBStats2.readCountFor(5) mustBe 2  // wasn't incremented to 3, because is same user
          pageBStats2.readCountFor(6) mustBe 0
          pageBStats2.readCountFor(7) mustBe 1  // was incremented, no one had read it before
          pageBStats2.readCountFor(8) mustBe 0

          info("Won't find non-existing pages")
          val nonExistingStats = transaction.loadPostsReadStats("9999")
          nonExistingStats.readCountFor(1) mustBe 0
          nonExistingStats.readCountFor(2) mustBe 0
          nonExistingStats.readCountFor(3) mustBe 0
          nonExistingStats.readCountFor(4) mustBe 0
        }
      }

      "load and save posts read stats, for guests" in {
        dao.readWriteTransaction { transaction =>
          transaction.updatePostsReadStats(pageAId, postNrsRead = Set(1,3), guestA.id,
            readFromIp = "2.2.2.2")
          val pageAStats = transaction.loadPostsReadStats(pageAId)
          pageAStats.readCountFor(1) mustBe 2  // userA and guestA have read it
          pageAStats.readCountFor(2) mustBe 0
          pageAStats.readCountFor(3) mustBe 1  // only gustA has read it
          pageAStats.readCountFor(4) mustBe 0

          info("Handles dupl guest inserts: post 3 already inserted")
          transaction.updatePostsReadStats(pageAId, postNrsRead = Set(3,4), guestA.id,
            readFromIp = "2.2.2.2")
          val pageAStats2 = transaction.loadPostsReadStats(pageAId)
          pageAStats2.readCountFor(1) mustBe 2
          pageAStats2.readCountFor(2) mustBe 0
          pageAStats2.readCountFor(3) mustBe 1  // wasn't incremented, is same user
          pageAStats2.readCountFor(4) mustBe 1
          pageAStats2.readCountFor(5) mustBe 0

          info("But other guest can read that post")
          transaction.updatePostsReadStats(pageAId, postNrsRead = Set(3,5), guestB.id,
            readFromIp = "3.3.3.3")
          val pageAStats3 = transaction.loadPostsReadStats(pageAId)
          pageAStats3.readCountFor(1) mustBe 2
          pageAStats3.readCountFor(2) mustBe 0
          pageAStats3.readCountFor(3) mustBe 2  // was incremented, becaues different guest
          pageAStats3.readCountFor(4) mustBe 1
          pageAStats3.readCountFor(5) mustBe 1
        }
      }
  }

}
