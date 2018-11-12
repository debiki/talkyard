/**
 * Copyright (C) 2015 Kaj Magnus Lindberg
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
import collection.mutable.ArrayBuffer
import com.debiki.core._
import com.debiki.core.Prelude._
import java.{sql => js, util => ju}
import scala.collection.mutable
import Rdb._
import RdbUtil._
import PostsSiteDaoMixin._


/** Loads and saves pages and cached page content html.
  */
trait PagesSiteDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  def loadOpenChatsPinnedGlobally(): immutable.Seq[PageMeta] = {
    val sql = s"""
      select g.page_id, ${_PageMetaSelectListItems}
      from pages3 g
      where g.site_id = ?
        and g.page_role = ${PageRole.OpenChat.toInt}
        and g.pin_order is not null
        and g.pin_where = ${PinPageWhere.Globally.toInt}
      order by g.pin_order desc
      """
    runQueryFindMany(sql, List(siteId.asAnyRef), rs => {
      _PageMeta(rs)
    })
  }


  def markPagesWithUserAvatarAsStale(userId: UserId) {
    // Currently a user's avatar is shown in posts written by him/her.
    val statement = s"""
      update pages3
        set version = version + 1, updated_at = now_utc()
        where site_id = ?
          and page_id in (
            select distinct page_id from posts3
            where site_id = ? and created_by_id = ?)
      """
    runUpdate(statement, List(siteId.asAnyRef, siteId.asAnyRef, userId.asAnyRef))
  }


  def markSectionPageContentHtmlAsStale(categoryId: CategoryId) {
    val statement = s"""
      update page_html3 h
        set page_version = -1, updated_at = now_utc()
        where site_id = ?
          and page_id = (
            select page_id from categories3
            where site_id = ? and id = ?)"""
    runUpdate(statement, List(siteId.asAnyRef, siteId.asAnyRef, categoryId.asAnyRef))
  }


  override def loadCachedPageContentHtml(pageId: PageId, params: PageRenderParams)
        : Option[(String, CachedPageVersion)] = {
    val query = s"""
      select
        width_layout,
        is_embedded,
        origin,
        cdn_origin,
        site_version,
        page_version,
        app_version,
        react_store_json_hash,
        react_store_json,
        cached_html
      from page_html3
      where site_id = ?
        and page_id = ?
        and width_layout = ?
        and is_embedded = ?
        and origin = ?
        and cdn_origin = ?
      """
    val values = List(siteId.asAnyRef, pageId.asAnyRef, params.widthLayout.toInt.asAnyRef,
      params.isEmbedded.asAnyRef, params.remoteOriginOrEmpty, params.cdnOriginOrEmpty)
    runQueryFindOneOrNone(query, values, rs => {
      val cachedHtml = rs.getString("cached_html")
      val cachedVersion = getCachedPageVersion(rs)
      (cachedHtml, cachedVersion)
    })
  }


  override def upsertCachedPageContentHtml(pageId: PageId, version: CachedPageVersion,
        reactStorejsonString: String, html: String) {
    // Not impossible that we'll overwrite a new version with an older,
    // but unlikely. And harmless anyway. Don't worry about it.
    val insertStatement = s"""
      insert into page_html3 (
        site_id,
        page_id,
        width_layout,
        is_embedded,
        origin,
        cdn_origin,
        site_version,
        page_version,
        app_version,
        react_store_json_hash,
        updated_at,
        react_store_json,
        cached_html)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now_utc(), ?::jsonb, ?)
      on conflict (site_id, page_id, width_layout, is_embedded, origin, cdn_origin) do update set
        site_version = excluded.site_version,
        page_version = excluded.page_version,
        app_version = excluded.app_version,
        react_store_json_hash = excluded.react_store_json_hash,
        updated_at = now_utc(),
        react_store_json = excluded.react_store_json,
        cached_html = excluded.cached_html
      """

    val params = version.renderParams
    runUpdateSingleRow(insertStatement, List(
      siteId.asAnyRef, pageId,
      params.widthLayout.toInt.asAnyRef, params.isEmbedded.asAnyRef,
      params.remoteOriginOrEmpty, params.cdnOriginOrEmpty,
      version.siteVersion.asAnyRef, version.pageVersion.asAnyRef, version.appVersion,
      version.reactStoreJsonHash, reactStorejsonString, html))
  }


  def loadPagePopularityScore(pageId: PageId): Option[PagePopularityScores] = {
    val sql = s"""
      select * from page_popularity_scores3
      where site_id = ?
        and page_id = ?
      """
    runQueryFindOneOrNone(sql, List(siteId.asAnyRef, pageId), rs => {
      PagePopularityScores(
        pageId = rs.getString("page_id"),
        updatedAt = getWhen(rs, "updated_at"),
        algorithmVersion = rs.getInt("algorithm"),
        dayScore = rs.getFloat("day_score"),
        weekScore = rs.getFloat("week_score"),
        monthScore = rs.getFloat("month_score"),
        quarterScore = rs.getFloat("quarter_score"),
        yearScore = rs.getFloat("year_score"),
        allScore = rs.getFloat("all_score"))
    })
  }


  def upsertPagePopularityScore(scores: PagePopularityScores) {
    val statement = s"""
      insert into page_popularity_scores3 (
        site_id,
        page_id,
        popular_since,
        updated_at,
        algorithm,
        day_score,
        week_score,
        month_score,
        quarter_score,
        year_score,
        all_score)
      values (?, ?, now_utc(), now_utc(), ?, ?, ?, ?, ?, ?, ?)
      on conflict (site_id, page_id) do update set
        updated_at = excluded.updated_at,
        algorithm = excluded.algorithm,
        day_score = excluded.day_score,
        week_score = excluded.week_score,
        month_score = excluded.month_score,
        quarter_score = excluded.quarter_score,
        year_score = excluded.year_score,
        all_score = excluded.all_score
      """

    val values = List(
      siteId.asAnyRef, scores.pageId, scores.algorithmVersion.asAnyRef,
      scores.dayScore.asAnyRef, scores.weekScore.asAnyRef,
      scores.monthScore.asAnyRef, scores.quarterScore.asAnyRef,
      scores.yearScore.asAnyRef, scores.allScore.asAnyRef)

    runUpdateSingleRow(statement, values)
  }


  def insertAltPageId(altPageId: AltPageId, realPageId: PageId) {
    insertAltPageIdImpl(altPageId, realPageId = realPageId, ignoreDuplKeyError = false)
  }


  def insertAltPageIdIfFree(altPageId: AltPageId, realPageId: PageId) {
    insertAltPageIdImpl(altPageId, realPageId = realPageId, ignoreDuplKeyError = true)
  }


  def insertAltPageIdImpl(altPageId: AltPageId, realPageId: PageId, ignoreDuplKeyError: Boolean) {
    val onConflictMaybeNothing = ignoreDuplKeyError ? "on conflict do nothing" | ""
    val statement = s"""
      insert into alt_page_ids3 (site_id, alt_page_id, real_page_id)
      values (?, ?, ?)
      $onConflictMaybeNothing
      """
    runUpdateSingleRow(statement, List(siteId.asAnyRef, altPageId, realPageId.asAnyRef))
  }


  def listAltPageIds(realPageId: PageId): Set[AltPageId] = {
    val sql = s"""
      select alt_page_id
      from alt_page_ids3
      where site_id = ?
        and real_page_id = ?
      """
    runQueryFindManyAsSet(sql, List(siteId.asAnyRef, realPageId.asAnyRef), rs => {
      rs.getString("alt_page_id")
    })
  }


  def loadRealPageId(altPageId: AltPageId): Option[PageId] = {
    val sql = s"""
      select real_page_id
      from alt_page_ids3
      where site_id = ?
        and alt_page_id = ?
      """
    runQueryFindOneOrNone(sql, List(siteId.asAnyRef, altPageId), rs => {
      rs.getString("real_page_id")
    })
  }


  override def loadPagePostNrsByPostIds(postIds: Iterable[PostId]): Map[PostId, PagePostNr] = {
    // Tested here: [7WKABZP2]
    if (postIds.isEmpty)
      return Map.empty
    val uniqueIds = postIds.toSet
    val values = siteId.asAnyRef :: uniqueIds.toList.map(_.asAnyRef)
    val query = s"""
      select page_id, unique_post_id, post_nr from posts3
      where site_id = ?
        and unique_post_id in (${makeInListFor(uniqueIds)})"""
    runQueryBuildMap(query, values, rs => {
      val postId = getInt(rs, "unique_post_id")
      val pageId = getString(rs, "page_id")
      val postNr = getInt(rs, "post_nr")
      postId -> PagePostNr(pageId, postNr)
    })
  }

}

