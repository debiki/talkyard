/**
 * Copyright (c) 2017 Kaj Magnus Lindberg
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

package ed.server.summaryemails

import com.debiki.core._
import com.debiki.core.Prelude._
import debiki.dao._
import scala.collection.immutable


/** Tests this:
  *
  * Users: Adm (is owner & admin), Mia (is basic member), Mod (is moderator), Max (member),
  * Ign (basic member).
  *
  * Adm & Mia: daily summaries, unless active,
  * Mod & Max: weekly summaries, also if active.
  * Ign doesn't want summaries.
  * Def = inherits default.
  *
  * Adm & Mia creates one page, each.
  * Adm & Mia & Mod & Max then gets summaries:
  *   Adm gets Mia's page only, Mia gets Adm's page, Mod gets both Adm and Mia.
  *
  * Adm creates a new topic: Now no summary sent, because was sent just recently.
  * Fast-forward time 1 hour —> nothing.
  * Fast-forward time 1 day —> summary sent to Mia.
  * Fast-forward time 5 days —> nothing.
  * Fast-forward time 7 days (in total)  —> summary sent to Mod.
  * Fast-forward time 1 month —> nothing.
  *
  * Mia creates a new topic. Mod reads it, Max doesn't.
  * Play time 8 days —>
  *   summaries get sent to Max, but not to Mod (who has read it already).
  *
  * Adm creates a page, Mia and Mod visits the website, but not the page.
  * Play time 8 days —>
  *   summary sent to Mod only (who wants summaries also if has visited the site)
  *
  * Adm creates a page in a staff-only category. Only Mod has access.
  * Fast-forward time 8 days —>
  *   summaries get sent to Mod, not Mia.
  *
  * Adm creates a page in a no-summaries category.
  * No summaries sent, not to anyone.
  *
  * Summaries aren't sent immediately when new topic created.
  *
  * Mia and Ign changes their settings: Mia no longer wants, but Ign wants, summaries.
  * Mod creates a topic —>
  *   summary sent to Adm and Ign, not to Mia.
  *
  * Change Everyone so default = get summary. Then, user Defa gets summary.
  *
  * Fast-forward time 2 months, 2 times —> nothing
  */
class SummaryEmailsAppSpec extends DaoAppSuite(
  startTime = When.fromMillis(3100010001000L)) {


  val createdAt: When = startTime minusMillis 10001000L
  val summaryEmailIntervalMins = 60

  var dao: SiteDao = _

  lazy val forum = dao.createForum(title = "Forum to delete", folder = "/",
    isForEmbCmts = false, Who(SystemUserId, browserIdData))

  var categoryNoSummaries: CreateCategoryResult = _

  var page1IdByAdm: PageId = null
  var page2IdByMia: PageId = null
  var page3IdByMia: PageId = null
  var page4IdByAdm: PageId = null
  var page5IdByAdm: PageId = null
  var page6IdByAdm: PageId = null
  var staffOnlyPageIdByAdm: PageId = null
  var everyonePageIdByAdm: PageId = null
  var newPageAfterIdleId: PageId = null
  var editedSettingsPageIdByAdm: PageId = null
  var editedSettingsPage2IdByAdm: PageId = null
  var everyoneTestPageIdByAdm: PageId = null
  var everyoneTestPageId2ByAdm: PageId = null
  var everyoneTestPageId3ByAdm: PageId = null
  var everyoneTestPageId4ByAdm: PageId = null

  var adm: User = null
  var mia: User = null
  var mod: User = null
  var max: User = null
  var ign: User = null
  var defa: User = null

  def makeStats(userId: UserId, now: When,
        nextSummaryEmailAt: Option[When]): UserStats = {
    UserStats(
      userId,
      lastSeenAt = startTime,
      firstSeenAtOr0 = startTime,
      topicsNewSince = startTime,
      nextSummaryEmailAt = nextSummaryEmailAt)
  }


  def makeSummary(userId: UserId): Option[ActivitySummary] = {
    val stats = loadUserStats(userId)(dao)
    val results = dao.makeActivitySummaryEmails(Vector(stats), currentTime)
    val summaries = results.map(_._2)
    summaries.size mustBe <=(1)
    dieIf(summaries.headOption.exists(_.toMember.id != userId), "EdE2FWKP0")
    summaries.headOption
  }


  def makeSummaries(userIds: immutable.Seq[UserId]): immutable.Seq[ActivitySummary] = {
    val stats = userIds.map(loadUserStats(_)(dao))
    val results = dao.makeActivitySummaryEmails(stats, currentTime)
    val summaries = results.map(_._2)
    dieIf(summaries.map(_.toMember.id).toSet != userIds.toSet, "EdE4JKWQ0")
    summaries
  }


  "prepare: create site and forum and users" in {
    globals.systemDao.getOrCreateFirstSite()
    dao = globals.siteDao(Site.FirstSiteId)
    forum // creates the forum
  }


  "prepare: create no-summaries and staff-only categories" in {
    val noSummariesCategoryId = dao.readWriteTransaction { tx =>
      tx.nextCategoryId()
    }
    categoryNoSummaries = dao.createCategory(
      CategoryToSave(
        anyId = Some(noSummariesCategoryId),
        sectionPageId = forum.pagePath.pageId.get,
        parentId = forum.staffCategoryId,
        name = "NoSummariesCat",
        slug = "nosummariescat",
        description = CategoriesDao.CategoryDescriptionSource,
        position = 11,
        newTopicTypes = List(PageRole.Discussion),
        shallBeDefaultCategory = false,
        unlistCategory = false,
        unlistTopics = false,
        includeInSummaries = IncludeInSummaries.NoExclude),
      immutable.Seq(ForumDao.makeEveryonesDefaultCategoryPerms(noSummariesCategoryId)),
      Who.System)
  }


  "prepare: create users" in {
    adm = createPasswordOwner("adm", dao, createdAt = Some(startTime), emailVerified = true)
    updateMemberPreferences(dao, adm.id, _.copy(summaryEmailIntervalMins = Some(60 * 24)))

    mia = createPasswordUser("mia", dao, createdAt = Some(startTime), emailVerified = true)
    updateMemberPreferences(dao, mia.id, _.copy(summaryEmailIntervalMins = Some(60 * 24)))

    mod = createPasswordModerator("mod", dao, createdAt = Some(startTime), emailVerified = true)
    updateMemberPreferences(dao, mod.id, _.copy(
      summaryEmailIfActive = Some(true),
      summaryEmailIntervalMins = Some(60 * 24 * 7)))

    // Email not verified, for Max.
    max = createPasswordUser("max", dao, createdAt = Some(startTime))
    updateMemberPreferences(dao, max.id, _.copy(
      summaryEmailIfActive = Some(true),
      summaryEmailIntervalMins = Some(60 * 24 * 7)))

    ign = createPasswordUser("ign", dao, createdAt = Some(startTime), emailVerified = true)
    // Ign = ignore, doesn't want summary emails.

    defa = createPasswordUser("defa", dao, createdAt = Some(startTime), emailVerified = true)
    // Inherits settings from Everyone. Doesn't want, by default.
  }


  "create no emails when there are no topics, about-category topics don't count" in {
    val miasStats = loadTheUserStats(mia.id)(dao)
    dao.makeActivitySummaries(Vector(miasStats), currentTime) mustBe empty
  }


  "Adm and Mia create one page, each, and summary emails are sent, to users with verified email" - {
    "they create the pages" in {
      page1IdByAdm = createPage(PageRole.Discussion, textAndHtmlMaker.forTitle("Page By Adm"),
        textAndHtmlMaker.forBodyOrComment("Page body."), authorId = adm.id, browserIdData,
        dao, anyCategoryId = Some(forum.defaultCategoryId))
      page2IdByMia = createPage(PageRole.Discussion, textAndHtmlMaker.forTitle("Page By Mia"),
        textAndHtmlMaker.forBodyOrComment("Page body."), authorId = mia.id, browserIdData,
        dao, anyCategoryId = Some(forum.defaultCategoryId))
    }

    "no summaries are sent immediately (all users were just created)" in {
      makeSummary(adm.id) mustBe empty
      makeSummary(mia.id) mustBe empty
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
      makeSummary(ign.id) mustBe empty
    }

    "after 23 hours, still no summaries sent" in {
      playTimeMillis(23 * OneHourInMillis)
      makeSummary(adm.id) mustBe empty
      makeSummary(mia.id) mustBe empty
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
      makeSummary(ign.id) mustBe empty
    }

    "but after 25 hours, Adm and Mia get an email" - {
      "create no summaries to no people" in {
        dao.makeActivitySummaries(Vector.empty, currentTime) mustBe empty
      }

      "create no summaries to non-existing people" in {
        dao.makeActivitySummaries(Vector(makeStats(999, currentTime, None)), currentTime) mustBe empty
      }

      "Adm gets summary email with Mia's page" in {
        playTimeMillis(2 * OneHourInMillis)
        val summary = makeSummary(adm.id).get
        summary.topTopics.size mustBe 1
        summary.topTopics.head.meta.authorId mustBe mia.id
        summary.topTopics.head.meta.pageId mustBe page2IdByMia
      }

      "Mia gets summary email with Adm's page" in {
        val summary = makeSummary(mia.id).get
        summary.topTopics.size mustBe 1
        summary.topTopics.head.meta.authorId mustBe adm.id
        summary.topTopics.head.meta.pageId mustBe page1IdByAdm
      }

      "They get no more summaries about the same topics" in {
        makeSummary(adm.id) mustBe empty
        makeSummary(mia.id) mustBe empty
      }

      "Mod, Max & Ign haven't gotten any summaries" in {
        makeSummary(mod.id) mustBe empty
        makeSummary(max.id) mustBe empty
        makeSummary(ign.id) mustBe empty
      }
    }

    "After 6 days, still no summary to Mod & Max" in {
      playTimeMillis(5 * OneDayInMillis)  // 25 hours + 5 days < 7 days
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
    }

    "After 7 days, Mod get summaries: both Adm's and Mia's pages" in {
      playTimeMillis(1 * OneDayInMillis)  // 25 hours + 5 + 1 > 7 days
      val summary = makeSummary(mod.id).get
      summary.topTopics.size mustBe 2
      val metas = summary.topTopics.map(_.meta)
      metas.map(_.authorId).toSet mustBe Set(adm.id, mia.id)
      metas.map(_.pageId).toSet mustBe Set(page1IdByAdm, page2IdByMia)
    }

    "summaries not sent until email address verified" - {
      "Max hasn't gotten any summary, because email not yet verified" in {
        makeSummary(max.id) mustBe empty
      }

      "Max verifies his email address" in {
        dao.verifyPrimaryEmailAddress(max.id, globals.now().toJavaDate)
      }

      "now he gets a summary email: both Adm's and Mia's pages" in {
        val summary = makeSummary(max.id).get
        summary.topTopics.size mustBe 2
        val metas = summary.topTopics.map(_.meta)
        metas.map(_.authorId).toSet mustBe Set(adm.id, mia.id)
        metas.map(_.pageId).toSet mustBe Set(page1IdByAdm, page2IdByMia)
      }
    }

    "Mod & Max gets no more summaries" in {
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
    }

    "and the others also don't" in {
      makeSummary(adm.id) mustBe empty
      makeSummary(mia.id) mustBe empty
      makeSummary(ign.id) mustBe empty
    }

    "not even after one month" in {
      playTimeMillis(32 * OneDayInMillis)
      makeSummary(adm.id) mustBe empty
      makeSummary(mia.id) mustBe empty
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
      makeSummary(ign.id) mustBe empty
    }
  }


  "summaries not sent, if has read topic already" - {
    "Mia creates a page" in {
      page3IdByMia = createPage(PageRole.Discussion, textAndHtmlMaker.forTitle("Page 3 By Mia"),
        textAndHtmlMaker.forBodyOrComment("Page body."), authorId = mia.id, browserIdData,
        dao, anyCategoryId = Some(forum.defaultCategoryId))
    }

    "Mod reads it, but Max reads another page instead" in {
      playTimeMillis(OneHourInMillis)
      dao.readWriteTransaction { tx =>
        // Mod reads the new page.
        tx.upsertReadProgress(mod.id, pageId = page3IdByMia, ReadingProgress(
          firstVisitedAt = currentTime minusMinutes 10,
          lastVisitedAt = currentTime,
          lastViewedPostNr = PageParts.BodyNr,
          lastReadAt = Some(currentTime),
          lastPostNrsReadRecentFirst = Vector.empty,
          lowPostNrsRead = Set(PageParts.BodyNr),
          secondsReading = 60 * 10))

        // Max reads another page.
        tx.upsertReadProgress(max.id, pageId = page1IdByAdm, ReadingProgress(
          firstVisitedAt = currentTime minusMinutes 10,
          lastVisitedAt = currentTime,
          lastViewedPostNr = PageParts.BodyNr,
          lastReadAt = Some(currentTime),
          lastPostNrsReadRecentFirst = Vector.empty,
          lowPostNrsRead = Set(PageParts.BodyNr),
          secondsReading = 60 * 10))

        dao.addUserStats(UserStats(
          mod.id, lastSeenAt = currentTime, numDaysVisited = 1, numSecondsReading = 600))(tx)
        dao.addUserStats(UserStats(
          max.id, lastSeenAt = currentTime, numDaysVisited = 1, numSecondsReading = 600))(tx)
      }
    }

    "A week elapses" in {
      playTimeMillis(7 * OneDayInMillis + OneHourInMillis)
    }

    "Mod gets no summary, because he has read the page" in {
      makeSummary(mod.id) mustBe empty
    }

    "but Max gets a summary; he hasn't read the page" in {
      val summary = makeSummary(max.id).get
      summary.topTopics.size mustBe 1
      summary.topTopics.head.meta.authorId mustBe mia.id
      summary.topTopics.head.meta.pageId mustBe page3IdByMia
    }

    "(Adm gets a summary too)" in {
      val summary = makeSummary(adm.id).get
      summary.topTopics.head.meta.authorId mustBe mia.id
      summary.topTopics.head.meta.pageId mustBe page3IdByMia
    }

    "nothing more happens" in {
      playTimeMillis(32 * OneDayInMillis)
      makeSummary(adm.id) mustBe empty
      makeSummary(mia.id) mustBe empty
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
      makeSummary(ign.id) mustBe empty
    }
  }


  "summaries not sent, if has visited the website recently" - {
    "Adm creates a page" in {
      page4IdByAdm = createPage(PageRole.Discussion, textAndHtmlMaker.forTitle("Page 4 By Adm"),
        textAndHtmlMaker.forBodyOrComment("Page body."), authorId = adm.id, browserIdData,
        dao, anyCategoryId = Some(forum.defaultCategoryId))
    }

    "A week elapses" in {
      playTimeMillis(7 * OneDayInMillis)
    }

    "Mia & Mod visits the website" in {
      dao.readWriteTransaction { tx =>
        dao.addUserStats(UserStats(
          mia.id, lastSeenAt = currentTime, numDaysVisited = 1, numSecondsReading = 100))(tx)
        dao.addUserStats(UserStats(
          mod.id, lastSeenAt = currentTime, numDaysVisited = 1, numSecondsReading = 100))(tx)
      }
      playTimeMillis(OneHourInMillis)
    }

    "Mod gets a summary; he wants summaries, also if active at the website" in {
      val summary = makeSummary(mod.id).get
      summary.topTopics.size mustBe 1
      summary.topTopics.head.meta.authorId mustBe adm.id
      summary.topTopics.head.meta.pageId mustBe page4IdByAdm
    }

    "(Max gets a summary too; he hasn't visited recently)" in {
      val summary = makeSummary(max.id).get
      summary.topTopics.size mustBe 1
      summary.topTopics.head.meta.authorId mustBe adm.id
      summary.topTopics.head.meta.pageId mustBe page4IdByAdm
    }

    "Mia gets no summary, because she just visited the website" in {
      makeSummary(mia.id) mustBe empty
    }

    "a day later, Mia gets a summary (because now no longer has visited 'recently')" in {
      playTimeMillis(22 * OneHourInMillis)  // 1 + 22 = 23 < 24
      makeSummary(mia.id) mustBe empty
      playTimeMillis(2 * OneHourInMillis) // 1 + 22 + 2 > 24, so time for summary, again
      val summary = makeSummary(mia.id).get
      summary.topTopics.size mustBe 1
      summary.topTopics.head.meta.authorId mustBe adm.id
      summary.topTopics.head.meta.pageId mustBe page4IdByAdm
    }

    "nothing more happens" in {
      playTimeMillis(32 * OneDayInMillis)
      makeSummary(adm.id) mustBe empty
      makeSummary(mia.id) mustBe empty
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
      makeSummary(ign.id) mustBe empty
    }
  }


  "summaries not sent, if the last summary was sent recently" - {
    "Adm creates a page" in {
      page5IdByAdm = createPage(PageRole.Discussion, textAndHtmlMaker.forTitle("Page 5 By Adm"),
        textAndHtmlMaker.forBodyOrComment("Page body."), authorId = adm.id, browserIdData,
        dao, anyCategoryId = Some(forum.defaultCategoryId))
    }

    "everyone gets a summary (and let's send them all at the same time)" in {
      playTimeMillis(7 * OneDayInMillis + OneHourInMillis)
      makeSummary(mia.id) mustBe defined
      makeSummary(mod.id) mustBe defined
      makeSummary(max.id) mustBe defined
      makeSummary(ign.id) mustBe empty
    }

    "Adm creates another page" in {
      page6IdByAdm = createPage(PageRole.Discussion, textAndHtmlMaker.forTitle("Page 6 By Adm"),
        textAndHtmlMaker.forBodyOrComment("Page body."), authorId = adm.id, browserIdData,
        dao, anyCategoryId = Some(forum.defaultCategoryId))
    }

    "one hour elapses" in {
      playTimeMillis(OneHourInMillis)
    }

    "Mia, Mod & Max get no new summary directly, because they got one, an hour ago" in {
      makeSummary(mia.id) mustBe empty
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
    }

    "after almost a day, still no summaries sent" in {
      playTimeMillis(22 * OneHourInMillis) // 1 + 22 < 24
      makeSummary(mia.id) mustBe empty
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
    }

    "after a day, Mia gets a summary (she wants daily)" in {
      playTimeMillis(2 * OneHourInMillis)  // 1 + 22 + 2 > 24
      val summary = makeSummary(mia.id).get
      summary.topTopics.size mustBe 1
      summary.topTopics.head.meta.authorId mustBe adm.id
      summary.topTopics.head.meta.pageId mustBe page6IdByAdm
    }

    "but not Mod & Max (who wants weekly)" in {
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
    }

    "after almost a week, still no summaries" in {
      playTimeMillis(5 * OneDayInMillis)  // 6 days and 1 hour
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
    }

    "after a week, Mod & Max get their summaries too" in {
      playTimeMillis(OneDayInMillis)  // 7 days and 1 hour
      val summaries = makeSummaries(immutable.Seq(mod.id, max.id))
      summaries foreach { summary =>
        summary.topTopics.size mustBe 1
        summary.topTopics.head.meta.authorId mustBe adm.id
        summary.topTopics.head.meta.pageId mustBe page6IdByAdm
      }
    }

    "nothing more happens" in {
      playTimeMillis(32 * OneDayInMillis)
      makeSummary(adm.id) mustBe empty
      makeSummary(mia.id) mustBe empty
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
      makeSummary(ign.id) mustBe empty
    }
  }


  "pages one may not access aren't included in summary" - {
    "Adm creates a staff-only page, plus a page for everyone" in {
      staffOnlyPageIdByAdm = createPage(PageRole.Discussion, textAndHtmlMaker.forTitle("Staff Page"),
        textAndHtmlMaker.forBodyOrComment("Page body."), authorId = adm.id, browserIdData,
        dao, anyCategoryId = Some(forum.staffCategoryId))

      everyonePageIdByAdm = createPage(PageRole.Discussion, textAndHtmlMaker.forTitle("Everyone Page"),
        textAndHtmlMaker.forBodyOrComment("Page body."), authorId = adm.id, browserIdData,
        dao, anyCategoryId = Some(forum.defaultCategoryId))
    }

    "a week elapses" in {
      playTimeMillis(7 * OneDayInMillis + OneHourInMillis)
    }

    "Mod gets a summary with both pages (hen's a moderator)" in {
      val summary = makeSummary(mod.id).get
      summary.topTopics.size mustBe 2
      val metas = summary.topTopics.map(_.meta)
      metas.map(_.authorId).toSet mustBe Set(adm.id)
      metas.map(_.pageId).toSet mustBe Set(staffOnlyPageIdByAdm, everyonePageIdByAdm)
    }

    "Mia and Max get summaries with only the for-everyone page (they aren't staff)" in {
      val summaries = makeSummaries(immutable.Seq(mia.id, max.id))
      summaries foreach { summary =>
        summary.topTopics.size mustBe 1
        summary.topTopics.head.meta.authorId mustBe adm.id
        summary.topTopics.head.meta.pageId mustBe everyonePageIdByAdm
      }
    }
  }


  "no summaries creted for pages in a don't-create-summaries category" - {
    "Adm creates a page in a no-summaries category" in {
      staffOnlyPageIdByAdm = createPage(PageRole.Discussion, textAndHtmlMaker.forTitle("No Summaries"),
        textAndHtmlMaker.forBodyOrComment("Page body."), authorId = adm.id, browserIdData,
        dao, anyCategoryId = Some(categoryNoSummaries.category.id))
    }

    "a month elapses" in {
      playTimeMillis(31 * OneDayInMillis + OneHourInMillis)
    }

    "No one gets any summary" in {
      makeSummary(mia.id) mustBe empty
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
      makeSummary(ign.id) mustBe empty
    }
  }


  "summaries aren't sent immediately when new topic created [3RGKW8O1]" - {
    "lots of time elapses, so now time for everyone to get a summary" in {
      playTimeMillis(2 * OneMonthInMillis)
    }

    "Adm creates a topic" in {
      newPageAfterIdleId = createPage(PageRole.Discussion, textAndHtmlMaker.forTitle("New After Idle"),
        textAndHtmlMaker.forBodyOrComment("Page body."), authorId = adm.id, browserIdData,
        dao, anyCategoryId = Some(forum.defaultCategoryId))
    }

    "the others will *not* immediately get a summary with this page" in {
      makeSummary(mia.id) mustBe empty
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
      makeSummary(ign.id) mustBe empty
    }

    o"""not until after their individual summary-interval / divisor
          (divisor = ${SummaryEmailsDao.MinTopicAgeDivisor})""" - {

      val dayDivDivisor = (24 / SummaryEmailsDao.MinTopicAgeDivisor - 1) * OneHourInMillis
      val twoHours = 2 * OneHourInMillis

      "almost a day / divisor elapses, no summaries sent" in {
        playTimeMillis(dayDivDivisor)
        makeSummary(mia.id) mustBe empty
        makeSummary(mod.id) mustBe empty
        makeSummary(max.id) mustBe empty
        makeSummary(ign.id) mustBe empty
      }

      "one hour more than day/divisor elapses" in {
        playTimeMillis(twoHours)
      }

      "now Mia gets a summary email (her summary interval = one day)" in {
        val summary = makeSummary(mia.id).get
        summary.topTopics.size mustBe 1
        summary.topTopics.head.meta.authorId mustBe adm.id
        summary.topTopics.head.meta.pageId mustBe newPageAfterIdleId
      }

      "but not the others" in {
        makeSummary(mod.id) mustBe empty
        makeSummary(max.id) mustBe empty
        makeSummary(ign.id) mustBe empty
      }

      "almost a week/divisor elapses" in {
        playTimeMillis(OneWeekInMillis / SummaryEmailsDao.MinTopicAgeDivisor
            - dayDivDivisor - twoHours - OneHourInMillis)
      }

      "no summaries sent" in {
        makeSummary(mia.id) mustBe empty
        makeSummary(mod.id) mustBe empty
        makeSummary(max.id) mustBe empty
        makeSummary(ign.id) mustBe empty
      }

      "some hours time than week/divisor elapses" in {
        playTimeMillis(2 * OneHourInMillis)
      }

      "now Mod & Max get a summary email (their summary interval = one week)" in {
        val summaries = makeSummaries(immutable.Seq(mod.id, max.id))
        summaries foreach { summary =>
          summary.topTopics.size mustBe 1
          summary.topTopics.head.meta.authorId mustBe adm.id
          summary.topTopics.head.meta.pageId mustBe newPageAfterIdleId
        }
      }

      "lots of time elapses, no summaries sent" in {
        playTimeMillis(OneMonthInMillis)
        makeSummary(adm.id) mustBe empty
        makeSummary(mia.id) mustBe empty
        makeSummary(mod.id) mustBe empty
        makeSummary(max.id) mustBe empty
        makeSummary(ign.id) mustBe empty
      }
    }
  }


  "one can change one's settings" - {   // (5FKWDW01)
    "Max no longer wants summaries, Mod inherits from group (won't get), Ign wants each month" in {
      updateMemberPreferences(dao, max.id, _.copy(
        summaryEmailIntervalMins = Some(SummaryEmails.DoNotSend)))
      updateMemberPreferences(dao, mod.id, _.copy(
        summaryEmailIntervalMins = None))
      updateMemberPreferences(dao, ign.id, _.copy(
        summaryEmailIntervalMins = Some(60 * 24 * 7)))
      TESTS_MISSING // the find-to-email should now find these users
    }

    "Ign gets a summary of lots of old topics" in {
      val summary = makeSummary(ign.id).get
      summary.topTopics.size mustBe SummaryEmailsDao.MaxTopTopics
      // Only Adm and Mia have created pages
      summary.topTopics.map(_.meta.authorId).toSet mustBe Set(adm.id, mia.id)
      val pageIds = summary.topTopics.map(_.meta.pageId).toSet
      pageIds.size mustBe SummaryEmailsDao.MaxTopTopics
    }

    "Topics that didn't fit in the summary, won't be sent later (we don't want stale summaries)" in {
      makeSummary(ign.id) mustBe empty
      playTimeMillis(OneWeekInMillis + OneDayInMillis)
      makeSummary(ign.id) mustBe empty
      playTimeMillis(OneMonthInMillis)
      makeSummary(ign.id) mustBe empty
    }

    "Adm creates a topic" in {
      editedSettingsPageIdByAdm = createPage(PageRole.Discussion, textAndHtmlMaker.forTitle("New Stngs"),
        textAndHtmlMaker.forBodyOrComment("Page body."), authorId = adm.id, browserIdData,
        dao, anyCategoryId = Some(forum.defaultCategoryId))
    }

    "after a week, Mia & Ign get a summary" in {
      playTimeMillis(7 * OneDayInMillis + OneHourInMillis)
      val summaries = makeSummaries(immutable.Seq(mia.id, ign.id))
      summaries foreach { summary =>
        summary.topTopics.size mustBe 1
        summary.topTopics.head.meta.authorId mustBe adm.id
        summary.topTopics.head.meta.pageId mustBe editedSettingsPageIdByAdm
      }
    }

    "but not Mod and Max" in {
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
    }

    "Max wants summaries again, Ign doesn't" in {
      updateMemberPreferences(dao, max.id, _.copy(
        summaryEmailIntervalMins = Some(60 * 24)))
      updateMemberPreferences(dao, ign.id, _.copy(
        summaryEmailIntervalMins = Some(SummaryEmails.DoNotSend)))
    }

    "Adm creates yet another topic" in {
      editedSettingsPage2IdByAdm = createPage(PageRole.Discussion, textAndHtmlMaker.forTitle("Nw Stngs 2"),
        textAndHtmlMaker.forBodyOrComment("Page body."), authorId = adm.id, browserIdData,
        dao, anyCategoryId = Some(forum.defaultCategoryId))
    }

    "after a week, Max gets a summary, with the new topic, plus the old he didn't get before" in {
      playTimeMillis(7 * OneDayInMillis + OneHourInMillis)
      val summary = makeSummary(max.id).get
      summary.topTopics.size mustBe 2
      summary.topTopics.map(_.meta.authorId).toSet mustBe Set(adm.id)
      summary.topTopics.map(_.meta.pageId).toSet mustBe Set(
          editedSettingsPageIdByAdm, editedSettingsPage2IdByAdm)
    }

    "Mia gets the new topic only" in {
      val summary = makeSummary(mia.id).get
      summary.topTopics.size mustBe 1
      summary.topTopics.head.meta.authorId mustBe adm.id
      summary.topTopics.head.meta.pageId mustBe editedSettingsPage2IdByAdm
    }

    "but Mod and Ign get no summaries" in {
      makeSummary(mod.id) mustBe empty
      makeSummary(ign.id) mustBe empty
    }
  }


  "one inherits the Everyone group's settings" - {
    "Defa has never gotten any summary" in {
      makeSummary(defa.id) mustBe empty
    }

    "change everyone's default setting to summaries-every-day" in {
      updateGroupPreferences(dao, Group.EveryoneId, Who(adm.id, browserIdData),
        _.copy(summaryEmailIntervalMins = Some(60 * 24)))
      TESTS_MISSING // the find-to-email should now find everyone
    }

    "Defa now gets a summary with MaxTopTopics topics, because default setting = send summaries" in {
      val summary = makeSummary(defa.id).get
      summary.topTopics.size mustBe SummaryEmailsDao.MaxTopTopics
    }

    "Mod gets 2 unseen topics" in {
      val summary = makeSummary(mod.id).get
      summary.topTopics.size mustBe 2  // sent in (5FKWDW01) a bit above
    }

    "Adm creates a topic" in {
      everyoneTestPageIdByAdm = createPage(PageRole.Discussion, textAndHtmlMaker.forTitle("Everyone Test"),
        textAndHtmlMaker.forBodyOrComment("Page body."), authorId = adm.id, browserIdData,
        dao, anyCategoryId = Some(forum.defaultCategoryId))
    }

    "almost a day elapses, nothing happens" in {
      playTimeMillis(23 * OneHourInMillis)
      makeSummary(mod.id) mustBe empty
      makeSummary(defa.id) mustBe empty
    }

    "after a day, Mod and Defa get a summary, because default settings = send summaries" in {
      playTimeMillis(2 * OneHourInMillis)
      val summaries = makeSummaries(immutable.Seq(mod.id, defa.id))
      summaries foreach { summary =>
        summary.topTopics.size mustBe 1
        summary.topTopics.head.meta.authorId mustBe adm.id
        summary.topTopics.head.meta.pageId mustBe everyoneTestPageIdByAdm
      }
    }

    "after a week, Max and Mia too" in {
      playTimeMillis((7 - 1) * OneDayInMillis)
      val summaries = makeSummaries(immutable.Seq(max.id, mia.id))
      summaries foreach { summary =>
        summary.topTopics.size mustBe 1
        summary.topTopics.head.meta.authorId mustBe adm.id
        summary.topTopics.head.meta.pageId mustBe everyoneTestPageIdByAdm
      }
    }

    "but not Ign" in {
      makeSummary(ign.id) mustBe empty
    }

    "summary-if-active works, also for groups" - {
      "Adm creates a topic" in {
        everyoneTestPageId2ByAdm = createPage(PageRole.Discussion, textAndHtmlMaker.forTitle("Everyone 2"),
          textAndHtmlMaker.forBodyOrComment("Page body."), authorId = adm.id, browserIdData,
          dao, anyCategoryId = Some(forum.defaultCategoryId))
      }

      "half a day later, Defa visits the site (but doesn't read the new topic)" in {
        playTimeMillis(12 * OneHourInMillis)
        dao.readWriteTransaction { tx =>
          dao.addUserStats(UserStats(
            defa.id, lastSeenAt = currentTime, numDaysVisited = 1, numSecondsReading = 600))(tx)
        }
      }

      "Defa won't get a summary, because was active" in {
        playTimeMillis(13 * OneHourInMillis)
        makeSummary(defa.id) mustBe empty
      }

      "but Mod gets a summary — hen wasn't active" in {
        val summary = makeSummary(mod.id).get
        summary.topTopics.size mustBe 1
        summary.topTopics.head.meta.authorId mustBe adm.id
        summary.topTopics.head.meta.pageId mustBe everyoneTestPageId2ByAdm
      }

      "the others get summaries as usual" in {
        playTimeMillis(OneWeekInMillis)
        val summaries = makeSummaries(immutable.Seq(max.id, mia.id))
        summaries foreach { summary =>
          summary.topTopics.size mustBe 1
          summary.topTopics.head.meta.authorId mustBe adm.id
          summary.topTopics.head.meta.pageId mustBe everyoneTestPageId2ByAdm
        }
      }

      "enable everyone's summaries-also-if-active setting" in {
        updateGroupPreferences(dao, Group.EveryoneId, Who(adm.id, browserIdData),
          _.copy(summaryEmailIfActive = Some(true)))
        TESTS_MISSING // the find-to-email should now find everyone
      }

      "now Defa gets a summary too, although was active" in {
        val summary = makeSummary(defa.id).get
        summary.topTopics.size mustBe 1
        summary.topTopics.head.meta.authorId mustBe adm.id
        summary.topTopics.head.meta.pageId mustBe everyoneTestPageId2ByAdm
      }
    }

    "change everyone's default setting back to no-summaries" in {
      updateGroupPreferences(dao, Group.EveryoneId, Who(adm.id, browserIdData),
          _.copy(summaryEmailIntervalMins = Some(SummaryEmails.DoNotSend)))
      TESTS_MISSING // the find-to-email should now find everyone
    }

    "Adm creates another topic" in {
      everyoneTestPageId4ByAdm = createPage(PageRole.Discussion, textAndHtmlMaker.forTitle("Everyone 4"),
        textAndHtmlMaker.forBodyOrComment("Page body."), authorId = adm.id, browserIdData,
        dao, anyCategoryId = Some(forum.defaultCategoryId))
    }

    "a week elapses" in {
      playTimeMillis(7 * OneDayInMillis + OneHourInMillis)
    }

    "but now Mod and Defa got no summaries" in {
      makeSummary(mod.id) mustBe empty
      makeSummary(defa.id) mustBe empty
    }

    "Ign also didn't get one" in {
      makeSummary(ign.id) mustBe empty
    }

    "Max and Mia get summaries as usual" in {
      val summaries = makeSummaries(immutable.Seq(max.id, mia.id))
      summaries foreach { summary =>
        summary.topTopics.size mustBe 1
        summary.topTopics.head.meta.authorId mustBe adm.id
        summary.topTopics.head.meta.pageId mustBe everyoneTestPageId4ByAdm
      }
    }
  }

  "nothing more happens" - {
    "nothing" in {
      playTimeMillis(32 * OneDayInMillis)
      makeSummary(adm.id) mustBe empty
      makeSummary(mia.id) mustBe empty
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
      makeSummary(ign.id) mustBe empty
    }

    "really really nothing" in {
      playTimeMillis(64 * OneDayInMillis)
      makeSummary(adm.id) mustBe empty
      makeSummary(mia.id) mustBe empty
      makeSummary(mod.id) mustBe empty
      makeSummary(max.id) mustBe empty
      makeSummary(ign.id) mustBe empty
    }
  }

}
