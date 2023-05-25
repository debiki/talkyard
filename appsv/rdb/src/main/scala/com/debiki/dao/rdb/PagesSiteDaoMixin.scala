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
        -- [open_chat_dupl]
        and g.page_role in (${PageType.JoinlessChat.toInt}, ${PageType.OpenChat.toInt})
        and g.pin_order is not null
        and g.pin_where = ${PinPageWhere.Globally.toInt}
      order by g.pin_order desc
      """
    runQueryFindMany(sql, List(siteId.asAnyRef), rs => {
      _PageMeta(rs)
    })
  }


  @deprecated("Use StaleStuff.addPagesWithVisiblePostsBy() instead", "Now")
  def markPagesHtmlStaleIfVisiblePostsBy(patId: PatId): i32 = {
    BUG // sleeping (since caller clears whole cache anyway)
    // This won't clear the mem cache. Use StaleStuff and addPagesWithVisiblePostsBy() instead.
    val statement = s"""
      update pages3
        set version = version + 1, updated_at = now_utc()
        where site_id = ?
          and page_id in (
            select distinct page_id from posts3
            where site_id = ?
              and created_by_id = ?   -- + pat_node_rels_t [AuthorOf] !
              and approved_at is not null
              and deleted_status = 0
              and hidden_at is null)
            -- COULD_OPTIMIZE:  and not collapsed so invisible
      """
    val numStale = runUpdate(statement, List(siteId.asAnyRef, siteId.asAnyRef, patId.asAnyRef))
    numStale
  }


  def markPagesHtmlStale(pageIds: Set[PageId]): Unit = {
    if (pageIds.isEmpty) return
    val statement = s"""
          update page_html_cache_t
          set cached_page_version_c = -1, updated_at_c = ?
          where site_id_c = ?
            and cached_page_version_c <> -1
            and page_id_c in (${ makeInListFor(pageIds) }) """
    runUpdate(statement, now.asTimestamp :: siteId.asAnyRef :: pageIds.toList)
  }


  def markSectionPageContentHtmlAsStale(categoryId: CategoryId) {
    val statement = s"""
      update page_html_cache_t h
        set cached_page_version_c = -1, updated_at_c = ?
        where site_id_c = ?
          and cached_page_version_c <> -1
          and page_id_c = (
            select page_id from categories3
            where site_id = ? and id = ?)"""
    val values = List(now.asTimestamp, siteId.asAnyRef, siteId.asAnyRef, categoryId.asAnyRef)
    runUpdate(statement, values)
  }


  override def loadCachedPageContentHtml(pageId: PageId, params: PageRenderParams)
        : Option[(String, CachedPageVersion)] = {
    val query = s"""
      select
        cached_site_version_c,
        cached_page_version_c,
        cached_app_version_c,
        cached_store_json_hash_c,
        -- Not used, no need to load. (Need only the hash)
        -- cached_store_json_c,
        cached_html_c
      from page_html_cache_t
      where site_id_c = ?
        and page_id_c = ?
        and param_comt_order_c = ?
        and param_comt_nesting_c = ?
        and param_width_layout_c = ?
        and param_theme_id_c_u = 2
        and param_is_embedded_c = ?
        and param_origin_or_empty_c = ?
        and param_cdn_origin_or_empty_c = ?
        and param_ugc_origin_or_empty_c = ?
      """
    val values = List(siteId.asAnyRef, pageId.asAnyRef,
          params.comtOrder.toInt.asAnyRef, params.comtNesting.asAnyRef,
          params.widthLayout.toInt.asAnyRef,
          params.isEmbedded.asAnyRef, params.embeddedOriginOrEmpty,
          params.cdnOriginOrEmpty, params.ugcOriginOrEmpty)
    runQueryFindOneOrNone(query, values, rs => {
      val cachedHtml = rs.getString("cached_html_c")
      val cachedVersion = getCachedPageVersion(rs, Some(params))
      (cachedHtml, cachedVersion)
    })
  }


  override def upsertCachedPageContentHtml(pageId: PageId, version: CachedPageVersion,
        reactStorejsonString: String, html: String) {
    // Not impossible that we'll overwrite a new version with an older,
    // but unlikely. And harmless anyway. Don't worry about it.
    COULD // edit the on-conflict part and use the highest site_version + page_version?
    val insertStatement = s"""
          insert into page_html_cache_t (
              site_id_c,
              page_id_c,
              param_comt_order_c,
              param_comt_nesting_c,
              param_width_layout_c,
              param_theme_id_c_u,
              param_is_embedded_c,
              param_origin_or_empty_c,
              param_cdn_origin_or_empty_c,
              param_ugc_origin_or_empty_c,
              cached_site_version_c,
              cached_page_version_c,
              cached_app_version_c,
              cached_store_json_hash_c,
              updated_at_c,
              cached_store_json_c,
              cached_html_c)
          values (?, ?, ?, ?, ?, 2, ?, ?, ?, ?, ?, ?, ?, ?, now_utc(), ?::jsonb, ?)
          on conflict (
              site_id_c,
              page_id_c,
              param_comt_order_c,
              param_comt_nesting_c,
              param_width_layout_c,
              param_theme_id_c_u,
              param_is_embedded_c,
              param_origin_or_empty_c,
              param_cdn_origin_or_empty_c,
              param_ugc_origin_or_empty_c)
          do update set
              cached_site_version_c = excluded.cached_site_version_c,
              cached_page_version_c = excluded.cached_page_version_c,
              cached_app_version_c = excluded.cached_app_version_c,
              cached_store_json_hash_c = excluded.cached_store_json_hash_c,
              updated_at_c = now_utc(),
              cached_store_json_c = excluded.cached_store_json_c,
              cached_html_c = excluded.cached_html_c
          """

    val params = version.renderParams
    runUpdateSingleRow(insertStatement, List(
      siteId.asAnyRef, pageId,
      params.comtOrder.toInt.asAnyRef, params.comtNesting.asAnyRef,
      params.widthLayout.toInt.asAnyRef, params.isEmbedded.asAnyRef,
      params.embeddedOriginOrEmpty, params.cdnOriginOrEmpty, params.ugcOriginOrEmpty,
      version.siteVersion.asAnyRef, version.pageVersion.asAnyRef, version.appVersion,
      version.storeJsonHash, reactStorejsonString, html))
  }


  override def deleteCachedPageContentHtml(pageId: PageId, version: CachedPageVersion): U = {
    val statement = s"""
          delete from page_html_cache_t
          where
              site_id_c = ? and
              page_id_c = ? and
              param_comt_order_c = ? and
              param_comt_nesting_c = ? and
              param_width_layout_c = ? and
              param_theme_id_c_u = 2 and
              param_is_embedded_c = ? and
              param_origin_or_empty_c = ? and

              -- We didn't look at the CDN params when loading pages to rerender. So,
              -- ignore them now too — delete all old versions [regardless_of_cdn] address.
              -- Ignore:  param_cdn_origin_or_empty_c
              --    and:  param_ugc_origin_or_empty_c

              -- Compare with cached_* too, so we won't delete, if a fresh cache entry has
              -- just been added (a race):  [rerndr_stale_q]
              --
              cached_site_version_c = ? and
              -- We know that version.pageVersion is out-of-date, [stale_version_check]
              -- and if there happens to be many old stale rows (can that happen?)
              -- why not delete all of them? (so use `<=`)
              cached_page_version_c <= ? and
              cached_app_version_c = ? and
              cached_store_json_hash_c = ?  """

    val ps = version.renderParams
    runUpdate(statement, List(
          siteId.asAnyRef, pageId,
          ps.comtOrder.toInt.asAnyRef, ps.comtNesting.asAnyRef,
          ps.widthLayout.toInt.asAnyRef, ps.isEmbedded.asAnyRef,
          ps.embeddedOriginOrEmpty,
          version.siteVersion.asAnyRef, version.pageVersion.asAnyRef, version.appVersion,
          version.storeJsonHash))
  }


  def loadAllPagePopularityScores(): Seq[PagePopularityScores] = {
    val sql = s"""
      select * from page_popularity_scores3
      where site_id = ?
      """
    runQueryFindMany(sql, List(siteId.asAnyRef), parsePagePopularityScore)
  }


  def loadPagePopularityScore(pageId: PageId, scoreAlg: PageScoreAlg): Opt[PagePopularityScores] = {
    val sql = s"""
      select * from page_popularity_scores3
      where site_id = ?
        and page_id = ?
        and score_alg_c = ?
      """
    val values = List(siteId.asAnyRef, pageId, scoreAlg.asAnyRef)
    runQueryFindOneOrNone(sql, values, parsePagePopularityScore)
  }


  private def parsePagePopularityScore(rs: js.ResultSet): PagePopularityScores = {
      PagePopularityScores(
        pageId = rs.getString("page_id"),
        updatedAt = getWhen(rs, "updated_at"),
        scoreAlgorithm = rs.getInt("score_alg_c"),
        dayScore = rs.getFloat("day_score"),
        weekScore = rs.getFloat("week_score"),
        monthScore = rs.getFloat("month_score"),
        quarterScore = rs.getFloat("quarter_score"),
        yearScore = rs.getFloat("year_score"),
        triennialScore = rs.getFloat("triennial_score_c"),
        allScore = rs.getFloat("all_score"))
  }


  def upsertPagePopularityScore(scores: PagePopularityScores) {
    val statement = s"""
      insert into page_popularity_scores3 (
        site_id,
        page_id,
        popular_since,
        updated_at,
        score_alg_c,
        day_score,
        week_score,
        month_score,
        quarter_score,
        year_score,
        triennial_score_c,
        all_score)
      values (?, ?, now_utc(), now_utc(), ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict (site_id, page_id, score_alg_c) do update set
        updated_at = excluded.updated_at,
        day_score = excluded.day_score,
        week_score = excluded.week_score,
        month_score = excluded.month_score,
        quarter_score = excluded.quarter_score,
        year_score = excluded.year_score,
        triennial_score_c = excluded.triennial_score_c,
        all_score = excluded.all_score
      """

    val values = List(
      siteId.asAnyRef, scores.pageId, scores.scoreAlgorithm.asAnyRef,
      scores.dayScore.asAnyRef, scores.weekScore.asAnyRef,
      scores.monthScore.asAnyRef, scores.quarterScore.asAnyRef,
      scores.yearScore.asAnyRef, scores.triennialScore.asAnyRef,
      scores.allScore.asAnyRef)

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


  def deleteAltPageId(altPageId: AltPageId) {
    TESTS_MISSING
    val statement = s"""
      delete from alt_page_ids3 where site_id = ? and alt_page_id = ?
      """
    runUpdateSingleRow(statement, List(siteId.asAnyRef, altPageId))
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


  def loadAllAltPageIds(): Map[AltPageId, PageId] = {
    val sql = s"""
      select alt_page_id, real_page_id
      from alt_page_ids3
      where site_id = ?
      """
    runQueryBuildMap(sql, List(siteId.asAnyRef), rs => {
      val altId = rs.getString("alt_page_id")
      val realId = rs.getString("real_page_id")
      altId -> realId
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

