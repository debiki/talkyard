/**
 * Copyright (c) 2015, 2018 Kaj Magnus Lindberg
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

import collection.immutable
import com.debiki.core._
import com.debiki.core.Prelude._
import java.{sql => js, util => ju}
import Rdb._
import RdbUtil.makeInListFor


/** Loads and saves ReviewTask:s.
  */
trait ReviewTasksSiteDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  override def nextReviewTaskId(): ReviewTaskId = {
    val query = """
      select max(id) max_id from review_tasks3 where site_id = ?
      """
    runQueryFindExactlyOne(query, List(siteId.asAnyRef), rs => {
      val maxId = rs.getInt("max_id") // null becomes 0, fine
      maxId + 1
    })
  }


  override def upsertReviewTask(reviewTask: ReviewTask) {
    CLEAN_UP // now with Postgres >= 9.5, use its built-in upsert.
    val updateStatement = """
      update review_tasks3 set
        reasons = ?,
        created_by_id = ?,
        created_at = ?,
        created_at_rev_nr = ?,
        more_reasons_at = ?,
        completed_at = ?,
        decided_at_rev_nr = ?,
        decided_by_id = ?,
        invalidated_at = ?,
        decided_at = ?,
        decision = ?,
        user_id = ?,
        page_id = ?,
        post_id = ?,
        post_nr = ?
      where site_id = ? and id = ?
      """
    val updateValues = List[AnyRef](
      ReviewReason.toLong(reviewTask.reasons).asAnyRef,
      reviewTask.createdById.asAnyRef,
      reviewTask.createdAt,
      reviewTask.createdAtRevNr.orNullInt,
      reviewTask.moreReasonsAt.orNullTimestamp,
      reviewTask.completedAt.orNullTimestamp,
      reviewTask.decidedAtRevNr.orNullInt,
      reviewTask.decidedById.orNullInt,
      reviewTask.invalidatedAt.orNullTimestamp,
      reviewTask.decidedAt.orNullTimestamp,
      reviewTask.decision.map(_.toInt).orNullInt,
      reviewTask.maybeBadUserId.asAnyRef,
      reviewTask.pageId.orNullVarchar,
      reviewTask.postId.orNullInt,
      reviewTask.postNr.orNullInt,
      siteId.asAnyRef,
      reviewTask.id.asAnyRef)

    val found = runUpdateSingleRow(updateStatement, updateValues)
    if (found)
      return

    val statement = """
      insert into review_tasks3(
        site_id,
        id,
        reasons,
        created_by_id,
        created_at,
        created_at_rev_nr,
        more_reasons_at,
        completed_at,
        decided_at_rev_nr,
        decided_by_id,
        invalidated_at,
        decided_at,
        decision,
        user_id,
        page_id,
        post_id,
        post_nr)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """
    val values = List[AnyRef](
      siteId.asAnyRef,
      reviewTask.id.asAnyRef,
      ReviewReason.toLong(reviewTask.reasons).asAnyRef,
      reviewTask.createdById.asAnyRef,
      reviewTask.createdAt,
      reviewTask.createdAtRevNr.orNullInt,
      reviewTask.moreReasonsAt.orNullTimestamp,
      reviewTask.completedAt.orNullTimestamp,
      reviewTask.decidedAtRevNr.orNullInt,
      reviewTask.decidedById.orNullInt,
      reviewTask.invalidatedAt.orNullTimestamp,
      reviewTask.decidedAt.orNullTimestamp,
      reviewTask.decision.map(_.toInt).orNullInt,
      reviewTask.maybeBadUserId.asAnyRef,
      reviewTask.pageId.orNullVarchar,
      reviewTask.postId.orNullInt,
      reviewTask.postNr.orNullInt)
    runUpdateSingleRow(statement, values)
  }


  override def loadPendingPostReviewTask(postId: PostId): Option[ReviewTask] = {
    loadReviewTaskImpl(
      s"completed_at is null and invalidated_at is null and post_id = ?",
      Seq(postId.asAnyRef))
  }


  override def loadUndecidedPostReviewTask(postId: PostId, taskCreatedById: UserId)
        : Option[ReviewTask] = {
    loadReviewTaskImpl(o"""
        completed_at is null and
        decided_at is null and
        invalidated_at is null and
        created_by_id = ? and
        post_id = ?""",
      Seq(taskCreatedById.asAnyRef, postId.asAnyRef))
  }


  override def loadReviewTask(id: ReviewTaskId): Option[ReviewTask] = {
    loadReviewTaskImpl("id = ?", List(id.asAnyRef))
  }


  private def loadReviewTaskImpl(whereClauses: String, values: Seq[AnyRef]): Option[ReviewTask] = {
    val query = i"""
      select * from review_tasks3 where site_id = ? and
      """ + whereClauses
    runQueryFindOneOrNone(query, (siteId.asAnyRef +: values).toList, rs => {
      readReviewTask(rs)
    })
  }


  override def loadReviewTasks(olderOrEqualTo: ju.Date, limit: Int): Seq[ReviewTask] = {
    // Sort by id, desc, if same timestamp, because higher id likely means more recent.
    val query = i"""
      select * from review_tasks3 where site_id = ? and created_at <= ?
      order by created_at desc, id desc limit ?
      """
    runQueryFindMany(query, List(siteId.asAnyRef, olderOrEqualTo, limit.asAnyRef), rs => {
      readReviewTask(rs)
    })
  }


  def loadAllReviewTasks(): Seq[ReviewTask] = {
    val query = "select * from review_tasks3 where site_id = ?"
    runQueryFindMany(query, List(siteId.asAnyRef), rs => {
      readReviewTask(rs)
    })
  }


  override def loadReviewTasksAboutUser(userId: UserId, limit: Int, orderBy: OrderBy)
        : Seq[ReviewTask] = {
    val desc = orderBy.isDescending ? "desc" | ""
    val query = i"""
      select * from review_tasks3 where site_id = ? and user_id = ?
      order by created_at $desc, id $desc limit ?
      """
    runQueryFindMany(query, List(siteId.asAnyRef, userId.asAnyRef, limit.asAnyRef), rs => {
      readReviewTask(rs)
    })
  }


  def loadReviewTasksAboutPostIds(postIds: Iterable[PostId]): immutable.Seq[ReviewTask] = {
    if (postIds.isEmpty) return Nil
    val query = i"""
      select * from review_tasks3
      where site_id = ?
        and post_id in (${ makeInListFor(postIds) })
      """
    runQueryFindMany(query, siteId.asAnyRef :: postIds.toList.map(_.asAnyRef), rs => {
      val task = readReviewTask(rs)
      dieIf(task.postId.isEmpty, "EdE2KTP8V")
      task
    })
  }


  override def loadReviewTaskCounts(isAdmin: Boolean): ReviewTaskCounts = {
    BUG; SHOULD // not urgent. Shouldn't count tasks one may not see (if !isAdmin).
    // Tasks one may not see, are filtered away here: [5FSLW20] — but the counts loaded
    // below can be wrong, unless is admin.
    // To fix that, needs to actually load all tasks, and do access check, for each one?
    // Maybe load only up to 9 tasks? instead of 99? so won't take long to check all of them.
    // Also, can cache the result?
    // Right now, though, almost always, moderators are allowed to see the same tasks,
    // as admins. Only if people flags things in private messages or admin-only topics,
    // admins may see, but moderators may not. So, can wait a bit with fixing this.

    UX; SHOULD // include deleted things only in the Other non-urgent count — currently  [5WKBQRS0]
    // flagged & undecided things are incl in the Urget count, even if they've been deleted.

    val urgentBits = ReviewReason.PostFlagged.toInt // + ... later if more urgent tasks
    val query = i"""
      select
        (select count(1) from review_tasks3
          where site_id = ?
            and decision is null
            and completed_at is null
            and invalidated_at is null
            and reasons & $urgentBits != 0
        ) num_urgent,
        (select count(1) from review_tasks3
          where site_id = ?
            and decision is null
            and completed_at is null
            and invalidated_at is null
            and reasons & $urgentBits = 0
        ) num_other
      """
    runQueryFindExactlyOne(query, List(siteId.asAnyRef, siteId.asAnyRef), rs => {
      ReviewTaskCounts(rs.getInt("num_urgent"), rs.getInt("num_other"))
    })
  }


  private def readReviewTask(rs: js.ResultSet): ReviewTask = {
    ReviewTask(
      id = rs.getInt("id"),
      reasons = ReviewReason.fromLong(rs.getLong("reasons")),
      createdById = rs.getInt("created_by_id"),
      createdAt = getDate(rs, "created_at"),
      createdAtRevNr = getOptInt(rs, "created_at_rev_nr"),
      moreReasonsAt = getOptionalDate(rs, "more_reasons_at"),
      completedAt = getOptionalDate(rs, "completed_at"),
      decidedAtRevNr = getOptInt(rs, "decided_at_rev_nr"),
      decidedById = getOptInt(rs, "decided_by_id"),
      invalidatedAt = getOptionalDate(rs, "invalidated_at"),
      decidedAt = getOptionalDate(rs, "decided_at"),
      decision = getOptInt(rs, "decision").flatMap(ReviewDecision.fromInt),
      maybeBadUserId = getOptInt(rs, "user_id").getOrElse(UnknownUserId),
      pageId = Option(rs.getString("page_id")),
      postId = getOptInt(rs, "post_id"),
      postNr = getOptInt(rs, "post_nr"))
  }

}
