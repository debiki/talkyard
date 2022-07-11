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

package com.debiki.dao.rdb
import java.sql.ResultSet
import com.debiki.core._
import com.debiki.core.Prelude._
import scala.collection.immutable
import Rdb._
import RdbUtil.makeInListFor
import scala.collection.mutable.ArrayBuffer


/** Loads and saves members of direct message conversations.
  */
trait PageUsersSiteDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  def insertPageParticipant(pageParticipant: PageParticipant) {
    val statement = """
      insert into page_users3 (
        site_id,
        page_id,
        user_id,
        joined_by_id,
        kicked_by_id,
        notf_level,   -- will remove, use page_notf_prefs_t instead [036KRMP4]
        notf_reason,  --
        incl_in_summary_email_at_mins,
        num_seconds_reading,
        num_low_posts_read,
        first_visited_at_mins,
        last_visited_at_mins,
        last_viewed_post_nr,
        last_read_at_mins,
        last_read_post_nr,
        recently_read_nrs,
        low_post_nrs_read)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """

    val pp = pageParticipant
    val anyProgr = pp.readingProgress

    val values = List[AnyRef](
      siteId.asAnyRef,
      pp.pageId,
      pp.userId.asAnyRef,
      pp.addedById.orNullInt,
      pp.removedById.orNullInt,
      NullInt,  // will remove, use page_notf_prefs_t instead [036KRMP4]
      NullInt,  //
      pp.inclInSummaryEmailAtMins.asAnyRef,
      // Similar code: insert list items. [04RKJUMS2]
      anyProgr.map(_.secondsReading).getOrElse(0).asAnyRef,
      anyProgr.map(_.lowPostNrsRead.size).getOrElse(0).asAnyRef,
      anyProgr.map(_.firstVisitedAt.unixMinutes).orNullInt,
      anyProgr.map(_.lastVisitedAt.unixMinutes).orNullInt,
      anyProgr.map(_.lastViewedPostNr).orNullInt,
      anyProgr.flatMap(_.lastReadAt.map(_.unixMinutes)).orNullInt,
      anyProgr.flatMap(_.lastPostNrsReadRecentFirst.headOption).orNullInt,
      NullBytea, // for now
      anyProgr.map(_.lowPostNrsReadAsBitsetBytes).getOrElse(Array.empty).orNullByteaIfEmpty)

    runUpdateSingleRow(statement, values)
  }


  override def insertMessageMember(pageId: PageId, userId: UserId, addedById: UserId): Boolean = {
    val statement = """
      insert into page_users3 (site_id, page_id, user_id, joined_by_id)
      values (?, ?, ?, ?)
      on conflict (site_id, page_id, user_id) do update set
        joined_by_id = excluded.joined_by_id,
        kicked_by_id = null
      """
    val values = List[AnyRef](siteId.asAnyRef, pageId, userId.asAnyRef, addedById.asAnyRef)
    runUpdateSingleRow(statement, values)
  }


  override def removePageMember(pageId: PageId, userId: UserId, removedById: UserId): Boolean = {
    val statement = """
      update page_users3
      set kicked_by_id = ?
      where site_id = ? and page_id = ? and user_id = ?
      """
    val values = List[AnyRef](removedById.asAnyRef, siteId.asAnyRef, pageId, userId.asAnyRef)
    runUpdateSingleRow(statement, values)
  }


  override def removeDeletedMemberFromAllPages(userId: UserId) {
    TESTS_MISSING
    val statement = s"""
      update page_users3 set
        kicked_by_id = $SystemUserId,
        notf_level = null,
        notf_reason = null
      where
        kicked_by_id is null and
        site_id = ? and
        user_id = ?
      """
    val values = List[AnyRef](siteId.asAnyRef, userId.asAnyRef)
    runUpdate(statement, values)
  }


  override def loadMessageMembers(pageId: PageId): Set[UserId] = {
    val query = """
      select user_id from page_users3
      where site_id = ?
        and page_id = ?
        and joined_by_id is not null
        and kicked_by_id is null
      """
    runQueryFindManyAsSet(query, List(siteId.asAnyRef, pageId), rs => {
      rs.getInt("user_id")
    })
  }


  override def loadPageIdsUserIsMemberOf(userId: UserId, onlyPageRoles: Set[PageType])
        : immutable.Seq[PageId] = {
    require(onlyPageRoles.nonEmpty, "EsE4G8U1")
    // Inline the page roles (rather than (?, ?, ?, ...)) because they'll always be the same
    // for each caller (hardcoded somewhere).
    CLEAN_UP // what? why load page_role? remove?
    val query = s"""
      select tu.page_id, p.page_role
      from page_users3 tu inner join pages3 p
        on tu.site_id = p.site_id and tu.page_id = p.page_id and p.page_role in (
            ${ onlyPageRoles.map(_.toInt).mkString(",") })
      where tu.site_id = ? and tu.user_id = ?
      order by p.last_reply_at desc
      """
    runQueryFindMany(query, List(siteId.asAnyRef, userId.asAnyRef), rs => {
      rs.getString("page_id")
    })
  }


  override def loadPageIdsWithVisiblePostsBy(patIds: Set[PatId], limit: i32): Set[PageId] = {
    if (patIds.isEmpty) return Set.empty
    val query = s"""
          select distinct page_id
          from posts3
          where site_id = ?
            and created_by_id in (${ makeInListFor(patIds) })
            and approved_at is not null
            and deleted_status = 0
            and hidden_at is null
          limit $limit"""

    val values = siteId.asAnyRef :: patIds.map(_.asAnyRef).toList
    runQueryFindMany(query, values, rs => {
      getString(rs, "page_id")
    }).toSet
  }


  def loadReadProgress(userId: UserId, pageId: PageId): Option[PageReadingProgress] = {
    loadReadProgressAndIfHasSummaryEmailed(userId, pageId = pageId)._1
  }


  def loadReadProgressAndIfHasSummaryEmailed(userId: UserId, pageId: PageId)
      : (Option[PageReadingProgress], Boolean) = {
    loadAllPageParticipantsImpl(Some(userId), anyPageId = Some(pageId)).headOption match {
      case None =>
        (None, false)
      case Some(pagePp) =>
        (pagePp.readingProgress, pagePp.inclInSummaryEmailAtMins > 0)
    }
  }


  def loadAllPageParticipantsAllPages(): Vector[PageParticipant] = {
    loadAllPageParticipantsImpl(None, None)
  }


  def loadAllPageParticipantsImpl(anyUserId: Option[UserId], anyPageId: Option[PageId])
        : Vector[PageParticipant] = {

    dieIf(anyUserId.isDefined != anyPageId.isDefined, "TyE502KNS2")
    val oneUserAndPage = anyUserId.isDefined
    val values = ArrayBuffer(siteId.asAnyRef)

    var query = """
      select
        page_id,
        user_id,
        joined_by_id,
        kicked_by_id,
        incl_in_summary_email_at_mins,
        num_seconds_reading,
        first_visited_at_mins,
        last_visited_at_mins,
        last_viewed_post_nr,
        last_read_at_mins,
        last_read_post_nr,
        recently_read_nrs,
        low_post_nrs_read
      from page_users3
      where site_id = ?"""
    if (oneUserAndPage) {
      query += """
        and page_id = ?
        and user_id = ?
        """
      values.append(anyPageId.get)
      values.append(anyUserId.get.asAnyRef)
    }

    val pageParticipants = runQueryFindMany(query, values.toList, rs => {
      PageParticipant(
        pageId = rs.getString("page_id"),
        userId = rs.getInt("user_id"),
        addedById = getOptInt(rs, "joined_by_id"),
        removedById = getOptInt(rs, "kicked_by_id"),
        inclInSummaryEmailAtMins = rs.getInt("incl_in_summary_email_at_mins"),
        readingProgress = getPageReadingProgress(rs))
    })

    pageParticipants
  }


  private def getPageReadingProgress(rs: ResultSet): Option[PageReadingProgress] = {
      val firstVisitedAt = getWhenMinutes(rs, "first_visited_at_mins")
      if (rs.wasNull) {
        // There's a row for this user, although hen hasn't visited the page — apparently
        // someone else has made hen a page member, e.g. added hen to a chat channel.
        // Or there's a row because hen got an activity-summary-email that mentions this page.
        return None
      }

      // This is the very last post nr read.
      val lastReadPostNr = rs.getInt("last_read_post_nr")
      // These bits store even more recently read posts: the 2nd, 3rd, 4th, ... most recent ones.
      val recentlyReadNrsBytes: Array[Byte] =
        Option(rs.getBytes("recently_read_nrs")) getOrElse Array.empty

      // (For now, skip the bytes, not impl anywhere.)
      // *Add test* when implementing: [7GPKW205]
      val lastPostNrsRead =
        if (lastReadPostNr != 0) Vector(lastReadPostNr)
        else Vector.empty

      val lowPostNrsReadBytes: Array[Byte] =
        Option(rs.getBytes("low_post_nrs_read")) getOrElse Array.empty
      val lowPostNrsRead = PageReadingProgress.parseLowPostNrsReadBitsetBytes(lowPostNrsReadBytes)

      Some(PageReadingProgress(
        firstVisitedAt = firstVisitedAt,
        lastVisitedAt = getWhenMinutes(rs, "last_visited_at_mins"),
        lastViewedPostNr = rs.getInt("last_viewed_post_nr"),
        lastReadAt = getOptWhenMinutes(rs, "last_read_at_mins"),
        lastPostNrsReadRecentFirst = lastPostNrsRead,
        lowPostNrsRead = lowPostNrsRead,
        secondsReading = rs.getInt("num_seconds_reading")))
  }


  def upsertReadProgress(userId: UserId, pageId: PageId, progress: PageReadingProgress) {
    val statement = """
      insert into page_users3 (
        site_id,
        page_id,
        user_id,
        num_seconds_reading,
        num_low_posts_read,
        first_visited_at_mins,
        last_visited_at_mins,
        last_viewed_post_nr,
        last_read_at_mins,
        last_read_post_nr,
        recently_read_nrs,
        low_post_nrs_read)
      values (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict (site_id, page_id, user_id) do update set
        num_seconds_reading = excluded.num_seconds_reading,
        num_low_posts_read = excluded.num_low_posts_read,
        first_visited_at_mins = excluded.first_visited_at_mins,
        last_visited_at_mins = excluded.last_visited_at_mins,
        last_viewed_post_nr = excluded.last_viewed_post_nr,
        last_read_at_mins = excluded.last_read_at_mins,
        last_read_post_nr = excluded.last_read_post_nr,
        recently_read_nrs = excluded.recently_read_nrs,
        low_post_nrs_read = excluded.low_post_nrs_read
      """

    val values = List(
      siteId.asAnyRef,
      pageId,
      userId.asAnyRef,
      // Similar code: insert list items. [04RKJUMS2]
      progress.secondsReading.asAnyRef,
      progress.lowPostNrsRead.size.asAnyRef,
      progress.firstVisitedAt.unixMinutes.asAnyRef,
      progress.lastVisitedAt.unixMinutes.asAnyRef,
      progress.lastViewedPostNr.asAnyRef,
      progress.lastReadAt.map(_.unixMinutes).orNullInt,
      progress.lastPostNrsReadRecentFirst.headOption.orNullInt,
      NullBytea, // for now
      progress.lowPostNrsReadAsBitsetBytes.orNullByteaIfEmpty)

    runUpdateExactlyOneRow(statement, values)
  }


  def rememberHasIncludedInSummaryEmail(userId: UserId, pageId: PageId, now: When) {
    val statement = """
      insert into page_users3 (
        site_id,
        page_id,
        user_id,
        incl_in_summary_email_at_mins)
      values (
        ?, ?, ?, ?)
      on conflict (site_id, page_id, user_id) do update set
        incl_in_summary_email_at_mins = greatest(
            page_users3.incl_in_summary_email_at_mins, excluded.incl_in_summary_email_at_mins)
      """

    val values = List(
      siteId.asAnyRef,
      pageId,
      userId.asAnyRef,
      now.unixMinutes.asAnyRef)

    runUpdateExactlyOneRow(statement, values)
  }


  def loadPageVisitTrusts(pageId: PageId): Map[UserId, VisitTrust] = {
    val query = s"""
      select
        pu.user_id,
        pu.first_visited_at_mins,
        case
          when u.suspended_at is not null then ${TrustLevel.StrangerDummyLevel}
          when u.is_admin then ${TrustLevel.AdminDummyLevel}
          when u.is_moderator then ${TrustLevel.ModeratorDummyLevel}
          else coalesce(u.locked_trust_level, u.trust_level)
        end trust_level
      from page_users3 pu left join users3 u
        on pu.site_id = u.site_id and pu.user_id = u.user_id
      where
        pu.site_id = ? and
        pu.page_id = ?
      order by pu.first_visited_at_mins asc
      """
    runQueryBuildMap(query, List(siteId.asAnyRef, pageId), rs => {
      val userId = rs.getInt("user_id")
      val minute = rs.getInt("first_visited_at_mins")
      val trustLevelInt = rs.getInt("trust_level")
      userId -> VisitTrust(visitMinute = minute, trustLevelInt)
    })
  }

}
