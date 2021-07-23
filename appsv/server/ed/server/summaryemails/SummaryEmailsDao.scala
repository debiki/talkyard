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

package ed.server.summaryemails

import com.debiki.core._
import com.debiki.core.Prelude._
import controllers.ForumController
import debiki.dao._
import ed.server.auth.ForumAuthzContext
import scala.collection.immutable
import scala.collection.mutable.ArrayBuffer
import SummaryEmailsDao._


case class ActivitySummary(toMember: UserInclDetails, topTopics: immutable.Seq[PagePathAndMeta]) {
}


object SummaryEmailsDao {

  val MinTopicAgeDivisor = 4
  val MaxTopTopics = 7

}


trait SummaryEmailsDao {
  this: SiteDao =>


  def makeActivitySummaryEmails(userStats: immutable.Seq[UserStats], now: When)
        : Vector[(Email, ActivitySummary)] = {
    val summaries = makeActivitySummaries(userStats, now)
    // Do in many transactions, one per summary, to avoid locking lots of rows = risk for deadlocks.
    summaries map { summary =>
      val email = createActivitySummaryEmail(summary.toMember, now, summary.topTopics)
      readWriteTransaction { tx =>
        tx.saveUnsentEmail(email)
        summary.topTopics foreach { topic =>
          tx.rememberHasIncludedInSummaryEmail(summary.toMember.id, topic.pageId, now)
        }
        tx.bumpNextAndLastSummaryEmailDate(summary.toMember.id, lastAt = now,
          nextAt = summary.toMember.summaryEmailIntervalMins.map(now plusMinutes _.toLong))
      }
      (email, summary)
    }
  }


  def makeActivitySummaries(userStats: immutable.Seq[UserStats], now: When)
        : Vector[ActivitySummary] = {
    val activitySummaries = ArrayBuffer[ActivitySummary]()
    val allGroups = readOnlyTransaction(_.loadAllGroupsAsMap())
    val settings = getWholeSiteSettings()

    val members = loadUsersInclDetailsById(userStats.map(_.userId))
    for (member <- members) {
      val stats = userStats.find(_.userId == member.id) getOrDie "EdE2KWG05"

      COULD_OPTIMIZE // load all groups only once. Batch load perms. Use same tx as a bit below.
      val (authzCtx, groups) = readOnlyTransaction { tx =>
        val groupIds = tx.loadGroupIdsMemberIdFirst(member.briefUser)
        val permissions = tx.loadPermsOnPages()
        val authCtx = ForumAuthzContext(Some(member.briefUser), groupIds, permissions)
        val groups = groupIds.flatMap(allGroups.get)
        (authCtx, groups)
      }

      val nextEmailAt: Option[When] = member.whenTimeForNexSummaryEmail(stats, groups)
      if (nextEmailAt.isEmpty) {
        // Avoid loading this user again and again. [5KRDUQ0]
        readWriteTransaction { tx =>
          tx.bumpNextSummaryEmailDate(member.id, Some(When.Never))
        }
      }
      else if (nextEmailAt.exists(_ isBefore now)) {
        val theSummaryEmailIntervalMins =
          member.effectiveSummaryEmailIntervalMins(groups).getOrDie("EdE4PKES0")
        val millisSinceLast =
          now.millis - stats.lastSummaryEmailAt.map(_.millis).getOrElse(member.createdAt.millis)
        val categoryId = 1 ; CLEAN_UP; HACK // this should be the forum's root category. [8UWKQXN45]
        val period =
          if (millisSinceLast > OneWeekInMillis) TopTopicsPeriod.Month
          else if (millisSinceLast > OneDayInMillis) TopTopicsPeriod.Week
          else TopTopicsPeriod.Day
        val pageQuery = PageQuery(PageOrderOffset.ByScoreAndBumpTime(offset = None, period),
          PageFilter(PageFilterType.ForActivitySummaryEmail, includeDeleted = false),
          // About-category pages can be interesting? E.g. new category created & everyone clicks Like.
          includeAboutCategoryPages = settings.showCategories)

        val topTopicsInclTooOld =
          listMaySeeTopicsInclPinned(categoryId, pageQuery,
            includeDescendantCategories = true, authzCtx = authzCtx,
            limit = ForumController.NumTopicsToList)

        // Don't include in this summary email, topics that would have been included in the
        // *last* summary email (if we didn't have the max-topics-per-email limit).
        val topTopics = topTopicsInclTooOld filterNot { topic =>
          stats.lastSummaryEmailAt.exists(_.millis > topic.meta.createdAt.getTime)
        }

        val readingProgresses: Seq[(PagePathAndMeta, (Option[PageReadingProgress], Boolean))] =
          readOnlyTransaction { tx =>
            COULD_OPTIMIZE // batch load all at once, not one at a time
            topTopics map { topic =>
              topic -> tx.loadReadProgressAndIfHasSummaryEmailed(member.id, topic.pageId)
            }
          }
        // Remove all topics the user has spent more than 10 seconds reading, or that have
        // been included in summary emails to that user already.
        // Also remove topics the user created — hen might not have looked at them, after posting,
        // so time spent reading might be 0.
        val unreadTopTopics = topTopics filterNot { topTopic =>
          topTopic.meta.authorId == member.id || readingProgresses.exists(topicAndProgress => {
            val topic: PagePathAndMeta = topicAndProgress._1
            val (readingProgresses, hasSummaryEmailedBefore) = topicAndProgress._2
            topic.pageId == topTopic.pageId && (
              readingProgresses.exists(p => p.secondsReading > 10) || hasSummaryEmailedBefore)
          })
        }

        // If all unread topics were just created, don't send a summary immediately. [3RGKW8O1]
        // Better wait for a little while, so other members get time to click Like and reply.
        // That should make the summary more interesting.
        // If one wants summaries at most once per week or month, then one likely doesn't
        // care about being notified immediately, if there's a new topic. Instead, the point
        // is to get a summary with interesting stuff.
        // So, if all topics are very new, wait for summary-interval / divisor, so there's
        // some time for others to interact with the topics and make them more interesting.
        val minOldestAgeMins = theSummaryEmailIntervalMins / MinTopicAgeDivisor
        val minsToWait =
          if (unreadTopTopics.isEmpty) minOldestAgeMins
          else {
            val oldestUnread = unreadTopTopics.minBy(_.meta.createdAt.getTime)
            val oldestAgeMs = now.minusMillis(oldestUnread.meta.createdAt.getTime).millis
            val oldestAgeMins = oldestAgeMs / 1000L / 60L
            minOldestAgeMins - oldestAgeMins
          }

        if (minsToWait > 0) {
          val waitUntil = now plusMinutes minsToWait
          readWriteTransaction { tx =>
            tx.bumpNextSummaryEmailDate(member.id, Some(waitUntil))
          }
        }
        else {
          val topicsToListInEmail = unreadTopTopics take MaxTopTopics
          if (topicsToListInEmail.nonEmpty) {
            val summary = ActivitySummary(member, topicsToListInEmail.toVector)
            SHOULD_LOG_STH
            activitySummaries.append(summary)
          }
        }
      }
      else if (nextEmailAt.exists(_ isBefore now.plusSeconds(30))) {
        // Need not bump the database next-summary date — it's so soon anyway. Just wait 30 seconds.
      }
      else if (nextEmailAt != stats.nextSummaryEmailAt) {
        // The database next-email date is inaccurate. E.g. because the inherited default value
        // was changed, or the user was just created so there's no next-date. Update it.
        // (Could refactor, move to caller?)
        readWriteTransaction { tx =>
          tx.bumpNextSummaryEmailDate(member.id, nextEmailAt orElse Some(When.Never))
        }
      }
      else {
        // Weird. This stats shouldn't have been loaded.
        // However... right now, yes it will get loaded, because most entries = null —> None,
        // and next-date None.
        // Later, when next-date = year 99999 instead of null, to indicate no-emails, then
        // throw error here.
      }
    }
    activitySummaries.toVector
  }


  private def createActivitySummaryEmail(member: UserInclDetails, now: When,
        unreadTopTopics: Iterable[PagePathAndMeta]): Email = {
    TESTS_MISSING

    val (siteName, origin) = theSiteNameAndOrigin()

    val subject = s"[$siteName] Recent activity summary"

    val email = Email.createGenId(EmailType.ActivitySummary, createdAt = now,
      sendTo = member.primaryEmailAddress, toUserId = Some(member.id),
      subject = subject, bodyHtml = "?")

    val contents = {
      <div class="e_ActSumEm">
        <p>Dear {member.username},</p>
        <p>Recent activity at {siteName}:</p>
        <h3>Some new topics:</h3>
        <ul>
        {
          for (topic <- unreadTopTopics) yield {
            <li><a href={origin + topic.path.value}>{topic.path.value}</a>
            </li>
          }
        }
        </ul>
        <p>This email is sent if we haven't seen you in a while.</p>
        {
          ed.server.util.email.makeFooter(
            regardsFromName = siteName,
            regardsFromUrl = origin,
            unsubUrl = origin + routes.UnsubFromSummariesController.showUnsubForm(email.id).url)
        }
      </div>
    }

    email.copy(bodyHtmlText = contents.toString)
  }
}


