/**
 * Copyright (c) 2018 Kaj Magnus Lindberg
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
import java.{sql => js}
import Rdb._
import scala.collection.mutable.ArrayBuffer


/** Loads and saves Draft:s.
  */
trait DraftsSiteDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  override def nextDraftNr(userId: UserId): DraftNr = {
    val query = """
      -- can use pk index
      select max(draft_nr) max_nr from drafts3 where site_id = ? and by_user_id = ?
      """
    runQueryFindExactlyOne(query, List(siteId.asAnyRef, userId.asAnyRef), rs => {
      val maxNr = rs.getInt("max_nr") // null becomes 0, fine
      maxNr + 1
    })
  }


  override def upsertDraft(draft: Draft) {
    // Probably the same person won't be editing the same draft, in two places at once,
    // humans cannot do such things. So upserting and overwriting = fine.
    // Well actually, can happen if one has a text open in two browser tabs, and edits
    // first in one tab, then forgets about that and edits in the 2nd tab instead. [5ABRQP0]

    val insertStatement = s"""
      insert into drafts3 (
        site_id,
        by_user_id,
        draft_nr,
        draft_type,
        created_at,
        last_edited_at,
        deleted_at,
        category_id,
        topic_type,
        page_id,
        post_nr,
        post_id,
        post_type,
        to_user_id,
        title,
        text)
      values (?, ?, ?, ?, ?, null, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict (site_id, by_user_id, draft_nr)
      do update set
        -- Use the new version, it should be more recent. [5ABRQP0]
        draft_type = excluded.draft_type,
        created_at = least(drafts3.created_at, excluded.created_at),
        -- If there's an older row, excluded.created_at is instead an *edit* date. [5AKJWX0]
        last_edited_at = case
          -- If got deleted, or undeleted, don't bump edit date. [TyT2ARDW3]
          when excluded.deleted_at is null and drafts3.deleted_at is null then excluded.created_at
          else drafts3.last_edited_at
        end,
        deleted_at = excluded.deleted_at,
        category_id = excluded.category_id,
        topic_type = excluded.topic_type,
        page_id = excluded.page_id,
        post_nr = excluded.post_nr,
        post_id = excluded.post_id,
        post_type = excluded.post_type,
        to_user_id = excluded.to_user_id,
        title = excluded.title,
        text = excluded.text
      """

    val locator = draft.forWhat

    runUpdateSingleRow(insertStatement, List(
      siteId.asAnyRef,
      draft.byUserId.asAnyRef,
      draft.draftNr.asAnyRef,
      locator.draftType.toInt.asAnyRef,
      draft.createdAt.asTimestamp,
      draft.deletedAt.orNullTimestamp,
      locator.categoryId.orNullInt,
      draft.topicType.map(_.toInt).orNullInt,
      locator.pageId.orNullVarchar,
      locator.postNr.orNullInt,
      locator.postId.orNullInt,
      draft.postType.map(_.toInt).orNullInt,
      locator.toUserId.orNullInt,
      draft.title,
      draft.text))
  }


  override def deleteDraft(userId: UserId, draftNr: DraftNr): Boolean = {
    val deleteStatement = s"""
      delete from drafts3 where site_id = ? and by_user_id = ? and draft_nr = ?
      """
    runUpdateSingleRow(deleteStatement, List(siteId.asAnyRef, userId.asAnyRef, draftNr.asAnyRef))
  }


  override def loadAllDrafts(): immutable.Seq[Draft] = {
    val query = s"""
      select * from drafts3 where site_id = ?
      """
    runQueryFindMany(query, List(siteId.asAnyRef), readDraft)
  }


  override def loadDraftByNr(userId: UserId, draftNr: DraftNr): Option[Draft] = {
    val query = s"""
      select * from drafts3 where site_id = ? and by_user_id = ? and draft_nr = ?
      """
    runQueryFindOneOrNone(query, List(siteId.asAnyRef, userId.asAnyRef, draftNr.asAnyRef), readDraft)
  }


  override def loadDraftsByUserOnPage(userId: UserId, pageId: PageId): immutable.Seq[Draft] = {
    TESTS_MISSING
    val query = s"""
      select d.* from drafts3 d inner join posts3 p
        on d.site_id = p.site_id
        -- This finds edit drafts, and also reply drafts — then, post_id is the parent
        -- post being replied to.
        and d.post_id = p.unique_post_id
      where d.site_id = ?
        and d.by_user_id = ?
        and d.deleted_at is null
        and d.draft_type in (
          ${DraftType.Edit.toInt},
          ${DraftType.Reply.toInt},
          ${DraftType.ProgressPost.toInt})
        and p.page_id = ?
        order by coalesce(d.last_edited_at, d.created_at) desc"""
    runQueryFindMany(query, List(siteId.asAnyRef, userId.asAnyRef, pageId), readDraft)
  }


  override def loadDraftsByLocator(userId: UserId, draftLocator: DraftLocator): immutable.Seq[Draft] = {
    val values = ArrayBuffer[AnyRef](
      siteId.asAnyRef, userId.asAnyRef, draftLocator.draftType.toInt.asAnyRef)

    val locatorClauses = draftLocator.draftType match {
      case DraftType.Topic =>
        // Load all new topic drafts, and show a dialog that lets the user choose which one
        // to continue composing.
        "category_id is not null"
      case DraftType.DirectMessage =>
        values.append(draftLocator.toUserId.getOrDie("TyE2ABK47").asAnyRef)
        "to_user_id = ?"
      case DraftType.Reply | DraftType.ProgressPost | DraftType.Edit =>
        values.append(draftLocator.postId.getOrDie("TyE2ABSL7").asAnyRef)
        "post_id = ?"
    }

    val query = s"""
      select * from drafts3
      where site_id = ?
        and by_user_id = ?
        and deleted_at is null
        and draft_type = ?
        and ($locatorClauses)
        order by coalesce(last_edited_at, created_at) desc"""

    runQueryFindMany(query, values.toList, readDraft)
  }


  override def listDraftsRecentlyEditedFirst(userId: UserId, limit: Int): immutable.Seq[Draft] = {
    val query = s"""
      -- Can use index drafts_byuser_editedat_i ?
      select * from drafts3 where site_id = ? and by_user_id = ? and deleted_at is null
      order by coalesce(last_edited_at, created_at) desc
      limit $limit
      """
    runQueryFindMany(query, List(siteId.asAnyRef, userId.asAnyRef), readDraft)
  }


  private def readDraft(rs: js.ResultSet): Draft = {
    val draftLocator = DraftLocator(
      draftType = DraftType.fromInt(getInt(rs, "draft_type")).getOrElse(DraftType.Scratch),
      categoryId = getOptInt(rs, "category_id"),
      toUserId = getOptInt(rs, "to_user_id"),
      postId = getOptInt(rs, "post_id"),
      pageId = getOptString(rs, "page_id"),
      postNr = getOptInt(rs, "post_nr"))

    Draft(
      byUserId = getInt(rs, "by_user_id"),
      draftNr = getInt(rs, "draft_nr"),
      forWhat = draftLocator,
      createdAt = getWhen(rs, "created_at"),
      lastEditedAt = getOptWhen(rs, "last_edited_at"),
      deletedAt = getOptWhen(rs, "deleted_at"),
      topicType = getOptInt(rs, "topic_type").flatMap(PageType.fromInt),
      postType = getOptInt(rs, "post_type").flatMap(PostType.fromInt),
      title = getString(rs, "title"),
      text = getString(rs, "text"))
  }

}
