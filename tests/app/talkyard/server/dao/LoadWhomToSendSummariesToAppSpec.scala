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

package  talkyard.server.dao

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki._
import debiki.dao.{CreateForumResult, DaoAppSuite, SiteDao}


class LoadWhomToSendSummariesToAppSpec extends DaoAppSuite {

  val when: When = When.fromMillis(3100010001000L)
  val createdAt: When = when.minusMillis(10001000)

  import globals.systemDao

  lazy val dao: SiteDao = {
    globals.systemDao.getOrCreateFirstSite()
    globals.siteDao(Site.FirstSiteId)
  }

  lazy val forumId = dao.createForum(title = "Forum to delete", folder = "/", isForEmbCmts = false,
    Who(SystemUserId, browserIdData)).get.pagePath.pageId

  lazy val (site2, daoSite2) = createSite("site2")

  lazy val forumSite2Id = daoSite2.createForum(title = "Forum site 2", folder = "/", isForEmbCmts = false,
    Who(SystemUserId, browserIdData)).get.pagePath.pageId

  var admin: Participant = null
  var pageId: PageId = null
  var otherPageId: PageId = null
  var thirdPageId: PageId = null

  var ownerSite2: Participant = null
  var memberASite2: Participant = null
  var memberBSite2: Participant = null
  var memberCSite2: Participant = null
  var memberDSite2: Participant = null
  var memberESite2: Participant = null

  var memberASite2Stats: UserStats = null
  var memberBSite2Stats: UserStats = null
  var memberCSite2Stats: UserStats = null
  var memberDSite2Stats: UserStats = null

  def makeAndUpsertStats(dao: SiteDao, userId: UserId, minutes: Int): UserStats = {
    val stats = UserStats(
      userId,
      lastSeenAt = when,
      firstSeenAtOr0 = when minusDays 10,
      topicsNewSince = when,
      nextSummaryEmailAt = Some(when plusMinutes minutes),
      tourTipsSeen = Some(Vector.empty))  // [7AKBR24] change Null in db and None here, to empty array?
    dao.readWriteTransaction(_.upsertUserStats(stats))
    stats
  }


  "prepare: create site 1 and 2" in {
    dao // creates site 1
    daoSite2 // creates site 2, incl owner
  }

  "prepare: create forums" in {
    forumId // creates forum, site 1
    forumSite2Id  // creates forum, site 2
  }

  "prepare: create users" in {
    admin = createPasswordOwner(s"smr_adm", dao, createdAt = Some(createdAt))
    ownerSite2 = createPasswordOwner("site2_owner", daoSite2, createdAt = Some(createdAt))
  }


  "load UserStats to find users to send summary emails to" - {
    "find stats for site owner, with limit = 1" in {
      var savedOwnerStats = makeAndUpsertStats(daoSite2, ownerSite2.id, -60)
      val stats = systemDao.loadStatsForUsersToMaybeEmailSummariesTo(when, limit = 1)
      stats.size mustBe 1
      val (siteWithStatsId, loadedOwnerStats) = stats.head
      siteWithStatsId mustBe daoSite2.siteId
      loadedOwnerStats.size mustBe 1
      loadedOwnerStats.head mustBe savedOwnerStats
    }

    "change the next-summary date, so it's in the future — now, won't find that user" in {
      makeAndUpsertStats(daoSite2, ownerSite2.id, +60)
      // Now, the owner will be skipped, some other user will be found instead, at FirstSiteId.
      val stats = systemDao.loadStatsForUsersToMaybeEmailSummariesTo(when, limit = 1)
      stats.size mustBe 1
      val (siteWithStatsId, userStats) = stats.head
      siteWithStatsId mustBe dao.siteId
    }

    "create more users" in {
      memberASite2 = createPasswordUser(s"s2_ma", daoSite2, createdAt = Some(createdAt))
      memberBSite2 = createPasswordUser(s"s2_mb", daoSite2, createdAt = Some(createdAt))
      memberCSite2 = createPasswordUser(s"s2_mc", daoSite2, createdAt = Some(createdAt))
      memberDSite2 = createPasswordUser(s"s2_md", daoSite2, createdAt = Some(createdAt))
      memberESite2 = createPasswordUser(s"s2_me", daoSite2, createdAt = Some(createdAt))

      memberASite2Stats = makeAndUpsertStats(daoSite2, memberASite2.id, -1)  // 3rd
      memberBSite2Stats = makeAndUpsertStats(daoSite2, memberBSite2.id, -10) // loaded first
      memberCSite2Stats = makeAndUpsertStats(daoSite2, memberCSite2.id, -5)  // 2nd
      memberDSite2Stats = makeAndUpsertStats(daoSite2, memberDSite2.id, +10) // not loaded
      // member E: next-summary-email-at = null, means unknown, so loaded
    }

    "check loads correct send-summaries-to stats" in {
      val stats = systemDao.loadStatsForUsersToMaybeEmailSummariesTo(when, limit = 999)
      stats.size mustBe 2
      stats.keys must contain(dao.siteId)
      stats.keys must contain(daoSite2.siteId)
      val firstSiteStats = stats(dao.siteId)
      firstSiteStats.size mustBe 1
      firstSiteStats.head.userId mustBe admin.id

      val secondSiteStats = stats(daoSite2.siteId)
      secondSiteStats.size mustBe 4
      secondSiteStats(0) mustBe memberBSite2Stats // first: -10 is oldest
      secondSiteStats(1) mustBe memberCSite2Stats // 2nd:   - 5
      secondSiteStats(2) mustBe memberASite2Stats // 3rd:   - 1 is the most recent
      // But D: +10 minutes from now = not yet time to send summary email.
      // E: time-to-send = null = unknown —> sorted last
      secondSiteStats(3).userId mustBe memberESite2.id
      secondSiteStats(3).nextSummaryEmailAt mustBe None
    }
  }

}
