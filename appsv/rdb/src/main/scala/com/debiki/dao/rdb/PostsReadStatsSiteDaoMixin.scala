/**
 * Copyright (C) 2014 Kaj Magnus Lindberg (born 1979)
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

package com.debiki.dao.rdb

import scala.collection.Seq
import com.debiki.core.Prelude._
import collection.immutable
import collection.mutable.ArrayBuffer
import com.debiki.core._
import java.{sql => js}
import scala.collection.mutable
import Rdb._
import RdbUtil._


/** Saves and loads info on how many times each post has been read and by whom.
  */
trait PostsReadStatsSiteDaoMixin extends SiteTransaction { // RENAME to ReadStats...
  self: RdbSiteTransaction =>


  def updatePostsReadStats(pageId: PageId, postNrsRead: Set[PostNr],
        readById: UserId, readFromIp: Opt[IpAdr]): Unit = {
    for (postNr <- postNrsRead) {
      // Do nothing if the row already exists — simply means the user has already read the post.
      val sql = s"""
        insert into post_read_stats3 (site_id, page_id, post_nr, ip, user_id, read_at)
        values (?, ?, ?, ?, ?, ?)
        on conflict do nothing
        """
      val values = List[AnyRef](siteId.asAnyRef, pageId, postNr.asAnyRef,
        readFromIp.orNullVarchar, readById.asAnyRef, now.asTimestamp)
      runUpdate(sql, values)
    }
  }


  def loadPostsReadStats(pageId: PageId): PostsReadStats =
    loadPostsReadStats(pageId, postNr = None)


  def loadPostsReadStats(pageId: PageId, postNr: Option[PostNr]): PostsReadStats = {
    var sql = s"""
      select post_nr, IP, USER_ID from post_read_stats3
      where SITE_ID = ? and PAGE_ID = ?"""
    val values = ArrayBuffer[AnyRef](siteId.asAnyRef, pageId)
    postNr foreach { id =>
      sql += " and post_nr = ?"
      values.append(id.asAnyRef)
    }
    val ipsByPostNr = mutable.HashMap[PostNr, ArrayBuffer[String]]()
    val roleIdsByPostNr = mutable.HashMap[PostNr, ArrayBuffer[RoleId]]()

    runQuery(sql, values.toList, rs => {
      while (rs.next) {
        val postNr = rs.getInt("post_nr")
        val ip = rs.getString("IP")
        val anyUserId = getOptionalIntNoneNot0(rs, "USER_ID")
        anyUserId match {
          case Some(id) if Participant.isRoleId(id) =>
            val buffer = roleIdsByPostNr.getOrElseUpdate(postNr, new ArrayBuffer[RoleId])
            buffer += id
          case _ =>
            val buffer = ipsByPostNr.getOrElseUpdate(postNr, new ArrayBuffer[String])
            buffer += ip
        }
      }
    })

    val immutableIpsMap = ipsByPostNr.map({ case (postNr, ips) =>
      (postNr, ips.toSet)
    }).toMap
    val immutableRolesMap = roleIdsByPostNr.map({ case (postNr, roleIds) =>
      (postNr, roleIds.toSet)
    }).toMap

    PostsReadStats(immutableIpsMap, immutableRolesMap)
  }


  def movePostsReadStats(oldPageId: PageId, newPageId: PageId,
        newPostNrsByOldNrs: Map[PostNr, PostNr]): Unit = {
    require(oldPageId != newPageId, "EsE7YJK830")
    if (newPostNrsByOldNrs.isEmpty)
      return

    val oldPostNrs = newPostNrsByOldNrs.keys.toList
    val values = ArrayBuffer[AnyRef](newPageId)
    val whens: String = newPostNrsByOldNrs.toSeq.map(_ match {
      case (oldNr: PostNr, newNr: PostNr) =>
        values.append(oldNr.asAnyRef)
        values.append(newNr.asAnyRef)
        s"when ? then ?"
    }).mkString(" ")
    values.append(siteId.asAnyRef)
    values.append(oldPageId)
    val statement = s"""
      update post_read_stats3 set
        page_id = ?,
        post_nr =
          case post_nr
          $whens
          else post_nr
          end
      where site_id = ? and page_id = ? and post_nr in (${makeInListFor(oldPostNrs)})
      """
    values.appendAll(oldPostNrs.map(_.asAnyRef))
    runUpdate(statement, values.toList)
  }


  def loadUserStats(userId: UserId): Option[UserStats] = {
    val query = """
      select * from user_stats3
      where site_id = ? and user_id = ?
      """
    runQueryFindOneOrNone(query, List(siteId.asAnyRef, userId.asAnyRef), getUserStats)
  }


  def loadAllUserStats(): immutable.Seq[UserStats] = {
    val query = s"""
      select * from user_stats3
      where site_id = ?
        -- Exclude built-in users like System:
        and (user_id <= $MaxCustomGuestId or $LowestAuthenticatedUserId <= user_id)
      """
    runQueryFindMany(query, List(siteId.asAnyRef), getUserStats)
  }


  def upsertUserStats(userStats: UserStats): Unit = {
    // Dupl code, also in Scala [7FKTU02], perhaps add param `addToOldStats: Boolean`?
    val statement = s"""
      insert into user_stats3 (
        site_id,
        user_id,
        snooze_notfs_until,
        last_seen_at,
        last_posted_at,
        last_emailed_at,
        last_summary_email_at,
        next_summary_maybe_at,
        email_bounce_sum,
        first_seen_at,
        first_new_topic_at,
        first_discourse_reply_at,
        first_chat_message_at,
        topics_new_since,
        notfs_new_since_id,
        num_days_visited,
        num_seconds_reading,
        num_discourse_replies_read,
        num_discourse_replies_posted,
        num_discourse_topics_entered,
        num_discourse_topics_replied_in,
        num_discourse_topics_created,
        num_chat_messages_read,
        num_chat_messages_posted,
        num_chat_topics_entered,
        num_chat_topics_replied_in,
        num_chat_topics_created,
        num_likes_given,
        num_likes_received,
        num_solutions_provided,
        tour_tips_seen)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict (site_id, user_id) do update set
        snooze_notfs_until =
            excluded.snooze_notfs_until,
        last_seen_at =
            greatest(user_stats3.last_seen_at, excluded.last_seen_at),
        last_posted_at =
            greatest(user_stats3.last_posted_at, excluded.last_posted_at),
        last_emailed_at =
            greatest(user_stats3.last_emailed_at, excluded.last_emailed_at),
        last_summary_email_at =
            greatest(user_stats3.last_summary_email_at, excluded.last_summary_email_at),
        next_summary_maybe_at =
            excluded.next_summary_maybe_at, -- not least(...), because then cannot bump date
        email_bounce_sum =
            excluded.email_bounce_sum,
        first_seen_at =
            least(user_stats3.first_seen_at, excluded.first_seen_at),
        first_new_topic_at =
            least(user_stats3.first_new_topic_at, excluded.first_new_topic_at),
        first_discourse_reply_at =
            least(user_stats3.first_discourse_reply_at, excluded.first_discourse_reply_at),
        first_chat_message_at =
            least(user_stats3.first_chat_message_at, excluded.first_chat_message_at),
        topics_new_since =
            greatest(user_stats3.topics_new_since, excluded.topics_new_since),
        notfs_new_since_id =
            greatest(user_stats3.notfs_new_since_id, excluded.notfs_new_since_id),
        num_days_visited = excluded.num_days_visited,
        num_seconds_reading = excluded.num_seconds_reading,
        num_discourse_replies_read = excluded.num_discourse_replies_read,
        num_discourse_replies_posted = excluded.num_discourse_replies_posted,
        num_discourse_topics_entered = excluded.num_discourse_topics_entered,
        num_discourse_topics_replied_in = excluded.num_discourse_topics_replied_in,
        num_discourse_topics_created = excluded.num_discourse_topics_created,
        num_chat_messages_read = excluded.num_chat_messages_read,
        num_chat_messages_posted = excluded.num_chat_messages_posted,
        num_chat_topics_entered = excluded.num_chat_topics_entered,
        num_chat_topics_replied_in = excluded.num_chat_topics_replied_in,
        num_chat_topics_created = excluded.num_chat_topics_created,
        num_likes_given = excluded.num_likes_given,
        num_likes_received = excluded.num_likes_received,
        num_solutions_provided = excluded.num_solutions_provided,
        tour_tips_seen = excluded.tour_tips_seen
      """

    val values = List(
      siteId.asAnyRef,
      userStats.userId.asAnyRef,
      userStats.snoozeUntil.orNullTimestamp,
      userStats.lastSeenAt.asTimestamp,
      userStats.lastPostedAt.orNullTimestamp,
      userStats.lastEmailedAt.orNullTimestamp,
      userStats.lastSummaryEmailAt.orNullTimestamp,
      userStats.nextSummaryEmailAt.orNullTimestamp,
      userStats.emailBounceSum.asAnyRef,
      userStats.firstSeenAtNot0.asTimestamp,
      userStats.firstNewTopicAt.orNullTimestamp,
      userStats.firstDiscourseReplyAt.orNullTimestamp,
      userStats.firstChatMessageAt.orNullTimestamp,
      userStats.topicsNewSince.asTimestamp,
      userStats.notfsNewSinceId.asAnyRef,
      userStats.numDaysVisited.asAnyRef,
      userStats.numSecondsReading.asAnyRef,
      userStats.numDiscourseRepliesRead.asAnyRef,
      userStats.numDiscourseRepliesPosted.asAnyRef,
      userStats.numDiscourseTopicsEntered.asAnyRef,
      userStats.numDiscourseTopicsRepliedIn.asAnyRef,
      userStats.numDiscourseTopicsCreated.asAnyRef,
      userStats.numChatMessagesRead.asAnyRef,
      userStats.numChatMessagesPosted.asAnyRef,
      userStats.numChatTopicsEntered.asAnyRef,
      userStats.numChatTopicsRepliedIn.asAnyRef,
      userStats.numChatTopicsCreated.asAnyRef,
      userStats.numLikesGiven.asAnyRef,
      userStats.numLikesReceived.asAnyRef,
      userStats.numSolutionsProvided.asAnyRef,
      makeSqlArrayOfStringsUnique(userStats.tourTipsSeen getOrElse Nil))

    runUpdateExactlyOneRow(statement, values)
  }


  def bumpNextSummaryEmailDate(memberId: UserId, nextEmailAt: Option[When]): Unit = {
    bumpNextSummaryEmailDateImpl(Some(memberId), nextEmailAt)
  }

  def reconsiderSendingSummaryEmailsToEveryone(): Unit = {
    bumpNextSummaryEmailDateImpl(None, None)
  }

  private def bumpNextSummaryEmailDateImpl(memberId: Option[UserId], nextEmailAt: Option[When]): Unit = {
    val values = ArrayBuffer[AnyRef](nextEmailAt.orNullTimestamp, siteId.asAnyRef)
    val andUserId = memberId match {
      case None =>
        COULD_OPTIMIZE // update only if current date is in the future [8YQKSD10]
        ""
      case Some(id) =>
        values.append(id.asAnyRef)
        " and user_id = ?"
    }
    val statement = s"""
      update user_stats3 set next_summary_maybe_at = ?
      where site_id = ? $andUserId
      """
    val numRowsUpdated = runUpdate(statement, values.toList)
    dieIf(memberId.isDefined && numRowsUpdated != 1, "EdE7FKQS1",
      s"$numRowsUpdated rows changed, user ${memberId.get}@$siteId")
  }


  def bumpNextAndLastSummaryEmailDate(memberId: UserId, lastAt: When, nextAt: Option[When]): Unit = {
    val statement = s"""
      update user_stats3 set last_summary_email_at = ?, next_summary_maybe_at = ?
      where site_id = ? and user_id = ?
      """
    val values = List(lastAt.asTimestamp, nextAt.orNullTimestamp, siteId.asAnyRef, memberId.asAnyRef)
    runUpdateExactlyOneRow(statement, values)
  }


  def loadAllUserVisitStats(): immutable.Seq[UserVisitStats] = {
    loadVisitStatsImpl(None)
  }


  def loadUserVisitStats(memberId: UserId): immutable.Seq[UserVisitStats] = {
    loadVisitStatsImpl(Some(memberId))
  }


  private def loadVisitStatsImpl(memberId: Option[UserId]): immutable.Seq[UserVisitStats] = {
    require(memberId.forall(_ >= LowestNonGuestId), "EdE84SZMI8")
    val values = ArrayBuffer(siteId.asAnyRef)

    val andUserIdEq = memberId map { id =>
      values.append(id.asAnyRef)
      "and user_id = ?"
    } getOrElse ""

    val query = s"""
      select * from user_visit_stats3
      where site_id = ? $andUserIdEq
      order by visit_date desc
      """

    runQueryFindMany(query, values.toList, rs => {
      UserVisitStats(
        userId = rs.getInt("user_id"),
        visitDate = getWhen(rs, "visit_date").toDays,
        numSecondsReading = rs.getInt("num_seconds_reading"),
        numDiscourseRepliesRead = rs.getInt("num_discourse_replies_read"),
        numDiscourseTopicsEntered = rs.getInt("num_discourse_topics_entered"),
        numChatMessagesRead = rs.getInt("num_chat_messages_read"),
        numChatTopicsEntered = rs.getInt("num_chat_topics_entered"))
    })
  }


  def upsertUserVisitStats(visitStats: UserVisitStats): Unit = {
    val statement = s"""
      insert into user_visit_stats3 (
        site_id,
        user_id,
        visit_date,
        num_seconds_reading,
        num_discourse_replies_read,
        num_discourse_topics_entered,
        num_chat_messages_read,
        num_chat_topics_entered)
      values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict (site_id, user_id, visit_date) do update set
        num_seconds_reading = excluded.num_seconds_reading,
        num_discourse_replies_read = excluded.num_discourse_replies_read,
        num_discourse_topics_entered = excluded.num_discourse_topics_entered,
        num_chat_messages_read = excluded.num_chat_messages_read,
        num_chat_topics_entered = excluded.num_chat_topics_entered
      """

    val values = List(
      siteId.asAnyRef,
      visitStats.userId.asAnyRef,
      visitStats.visitDate.toJavaDate.asTimestamp,
      visitStats.numSecondsReading.asAnyRef,
      visitStats.numDiscourseRepliesRead.asAnyRef,
      visitStats.numDiscourseTopicsEntered.asAnyRef,
      visitStats.numChatMessagesRead.asAnyRef,
      visitStats.numChatTopicsEntered.asAnyRef)

    runUpdateExactlyOneRow(statement, values)
  }

}
