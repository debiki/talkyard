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
import debiki._
import debiki.dao._
import ed.server.auth.ForumAuthzContext
import scala.collection.immutable



trait SummaryEmailsDao {
  this: SiteDao =>


  def sendSummaryEmailsTo(userStats: immutable.Seq[UserStats], now: When): Unit = {
    // Quick hack, for now, until there's a groups table and real custom groups:  [7FKQCUW0-todonow]
    // (Everyone is a member of the NewUsers group.)
    val allGroups = readOnlyTransaction(_.loadGroupsAsMap())
    val groups = allGroups.get(Group.NewMembersId).toVector

    val members = loadMembersInclDetailsById(userStats.map(_.userId))
    for {
      member <- members
      if member.emailAddress.nonEmpty
      if member.emailNotfPrefs == EmailNotfPrefs.Receive
    } {
      val stats = userStats.find(_.userId == member.id) getOrDie "EdE2KWG05"
      val nextEmailAt: Option[When] = member.whenTimeForNexSummaryEmail(stats, groups)
      if (true) { // nextEmailAt.exists(_ isBefore now)) {
        val millisSinceLastEmail =
          now.millis - stats.lastSummaryEmailAt.map(_.millis).getOrElse(member.createdAt.getTime)
        val categoryId = 1 ; CLEAN_UP; HACK // this should be the forum's root category. [8UWKQXN45]
        val period =
          if (millisSinceLastEmail > OneWeekInMillis) TopTopicsPeriod.Month
          else if (millisSinceLastEmail > OneDayInMillis) TopTopicsPeriod.Week
          else TopTopicsPeriod.Day
        val pageQuery = PageQuery(PageOrderOffset.ByScoreAndBumpTime(offset = None, period),
          PageFilter.ShowAll)

        COULD_OPTIMIZE // load all groups only once. Batch load perms. Use same tx as a bit below.
        val authzCtx = readOnlyTransaction { tx =>
          val groupIds = tx.loadGroupIds(member.briefUser)
          val permissions = tx.loadPermsOnPages()
          ForumAuthzContext(Some(member.briefUser), groupIds, permissions)
        }

        val topTopics =
          ForumController.listMaySeeTopicsInclPinned(categoryId, pageQuery, this,
            includeDescendantCategories = true, authzCtx = authzCtx)
        val readingProgresses: Seq[(PagePathAndMeta, (Option[ReadingProgress], Boolean))] =
          readOnlyTransaction { tx =>
            COULD_OPTIMIZE // batch load all at once, not one at a time
            topTopics map { topic =>
              topic -> tx.loadReadProgressAndIfHasSummaryEmailed(member.id, topic.pageId)
            }
          }
        // Remove all topics the user has spent more than 10 seconds reading, or that have
        // been included in summary emails to that user already.
        val unreadTopTopics = topTopics filterNot { topTopic =>
          readingProgresses.exists(topicAndProgress => {
            val topic: PagePathAndMeta = topicAndProgress._1
            val (readingProgresses, hasSummaryEmailedBefore) = topicAndProgress._2
            topic.pageId == topTopic.pageId && (
              readingProgresses.exists(p => p.secondsReading > 10) || hasSummaryEmailedBefore)
          })
        }

        val topicsToListInEmail = unreadTopTopics take 7
        if (topicsToListInEmail.nonEmpty) {
          val email = createActivitySummaryEmail(member, now, topicsToListInEmail, authzCtx)
          SHOULD_LOG_STH
          topicsToListInEmail foreach { t =>
            System.out.println(s"site $siteId: Smry tpc: ${t.path.value} to: ${member.username}")
          }

          readWriteTransaction { tx =>
            tx.saveUnsentEmail(email)
            topicsToListInEmail foreach { topic =>
              tx.rememberHasIncludedInSummaryEmail(member.id, topic.pageId, now)
            }
            tx.bumpNextAndLastSummaryEmailDate(member.id, lastAt = now,
                nextAt = member.summaryEmailIntervalMins.map(now.plusMinutes))
          }

          Globals.sendEmail(email, siteId)
        }
      }
      else if (nextEmailAt.exists(_ isBefore now.plusSeconds(30))) {
        // Need not bump the database next-summary date — it's so soon anyway. Just wait 30 seconds.
      }
      else if (nextEmailAt != stats.nextSummaryEmailAt) {
        // The database next-email date is inaccurate. E.g. because the inherited default value
        // was changed, or the user was just created so there's no next-date. Update it.
        bumpNextSummaryEmailDate(member.id, nextEmailAt)
      }
      else {
        // Weird. This stats shouldn't have been loaded.
        // However... right now, yes it will get loaded, because most entries = null —> None,
        // and next-date None.
        // Later, when next-date = year 99999 instead of null, to indicate no-emails, then
        // throw error here.
      }
    }
  }


  def bumpNextSummaryEmailDate(memberId: UserId, nextEmailWhen: Option[When]) {
    readWriteTransaction { tx =>
      tx.bumpNextSummaryEmailDate(memberId, nextEmailWhen)
    }
  }


  private def createActivitySummaryEmail(member: MemberInclDetails, now: When,
        unreadTopTopics: Iterable[PagePathAndMeta], authzCtx: ForumAuthzContext): Email = {

    val site = theSite()
    val anyPrettyHostname = site.canonicalHost.map(_.hostname)
    val anyPrettyOrigin = site.canonicalHost.map(Globals.schemeColonSlashSlash + _.hostname)
    val siteName = anyPrettyHostname getOrElse site.name
    val origin = anyPrettyOrigin getOrElse Globals.siteByIdOrigin(siteId)

    val subject = s"New topics and stuff at $siteName"

    val email = Email(EmailType.ActivitySummary, createdAt = Globals.now(),
      sendTo = member.emailAddress, toUserId = Some(member.id),
      subject = subject, bodyHtmlText = (emailId: String) => "?")

    val contents = {
      <div>
        <p>Dear {member.username},</p>
        <p>Here're some new topics, and other things that has happened recently, at {siteName}:
        </p>
        <h3>Some new topics:</h3>
        <ul>
        {
          for (topic <- unreadTopTopics) yield {
            <li><a href={topic.path.value}>{topic.path.value}</a></li>
          }
        }
        </ul>
        {
          ed.server.util.email.makeFooter(regardsFromName = siteName, regardsFromUrl = origin,
              unsubUrl = "???") // MUST be possible to unsub
        }
      </div>
    }

    email.copy(bodyHtmlText = contents.toString)
  }
}


