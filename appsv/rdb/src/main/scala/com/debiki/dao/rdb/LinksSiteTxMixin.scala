/**
 * Copyright (c) 2020 Kaj Magnus Lindberg
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

import com.debiki.core._
import com.debiki.core.Prelude._
import java.{sql => js}
import Rdb._
import RdbUtil.makeInListFor
import play.api.libs.json.JsNull
import scala.collection.mutable
import scala.collection.mutable.ArrayBuffer



trait LinksSiteTxMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  override def upsertLinkPreview(linkPreview: LinkPreview): Unit = {  QUOTA  // [lnpv_quota]
    val upsertStatement = s"""
          insert into link_previews_t (
              site_id_c,
              link_url_c,
              fetched_from_url_c,
              fetched_at_c,
              cache_max_secs_c,
              status_code_c,
              preview_type_c,
              first_linked_by_id_c,
              content_json_c)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict (site_id_c, link_url_c, fetched_from_url_c)
          do update set
              fetched_at_c = excluded.fetched_at_c,
              cache_max_secs_c = excluded.cache_max_secs_c,
              status_code_c = excluded.status_code_c,
              preview_type_c = excluded.preview_type_c,
              content_json_c = excluded.content_json_c """

    val values = List(
          siteId.asAnyRef,
          linkPreview.linkUrl,
          linkPreview.fetchedFromUrl,
          linkPreview.fetchedAt.asTimestamp,
          NullInt, // linkPreview.cache_max_secs_c, — later
          linkPreview.statusCode.asAnyRef,
          linkPreview.previewType.asAnyRef,
          linkPreview.firstLinkedById.asAnyRef,
          linkPreview.contentJson)

    runUpdateSingleRow(upsertStatement, values)
  }


  override def loadLinkPreviewByUrl(linkUrl: String, fetchedFromUrl: String)
        : Option[LinkPreview] = {
    val query = s"""
          select * from link_previews_t
          where site_id_c = ?
            and link_url_c = ?
            and fetched_from_url_c = ?  """
    val values = List(siteId.asAnyRef, linkUrl, fetchedFromUrl)
    runQueryFindOneOrNone(query, values, rs => {
      parseLinkPreview(rs)
    })
  }


  override def loadAllLinkPreviewsByUrl(linkUrl: String): Seq[LinkPreview] = {
    val query = s"""
          select * from link_previews_t
          where site_id_c = ?
            and link_url_c = ?
          order by site_id_c, link_url_c, fetched_from_url_c  -- ix: pk  """
    val values = List(siteId.asAnyRef, linkUrl)
    runQueryFindMany(query, values, rs => {
      parseLinkPreview(rs)
    })
  }


  override def deleteLinkPreviews(linkUrl: String): Int = {
    val deleteStatement = s"""
          delete from link_previews_t
          where site_id_c = ?
            and link_url_c = ?  """
    val values = List(siteId.asAnyRef, linkUrl)
    runUpdate(deleteStatement, values)
  }


  override def upsertLink(link: Link): Boolean = {   QUOTA
    val upsertStatement = s"""
          insert into links_t (
              site_id_c,
              from_post_id_c,
              link_url_c,
              added_at_c,
              added_by_id_c,
              is_external_c,
              to_page_id_c,
              to_post_id_c,
              to_pp_id_c,
              to_tag_id_c,
              to_category_id_c)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict (site_id_c, from_post_id_c, link_url_c)
             do nothing """

    val values = List(
      siteId.asAnyRef,
      link.fromPostId.asAnyRef,
      link.linkUrl,
      link.addedAt.asTimestamp,
      link.addedById.asAnyRef,
      link.isExternal.asTrueOrNull,
      link.toPageId.orNullVarchar,
      link.toPostId.orNullInt,
      link.toPpId.orNullInt,
      link.toTagId.orNullInt,
      link.toCategoryId.orNullInt)

    runUpdateSingleRow(upsertStatement, values)
  }


  override def deleteLinksFromPost(postId: PostId, urls: Set[String]): Int = {
    if (urls.isEmpty)
      return 0

    val deleteStatement = s"""
          delete from links_t
          where site_id_c = ?
            and from_post_id_c = ?
            and link_url_c in (${ makeInListFor(urls) }) """
    val values = siteId.asAnyRef :: postId.asAnyRef :: urls.toList
    runUpdate(deleteStatement, values)
  }


  override def deleteAllLinksFromPost(postId: PostId): Int = {
    unused("TyE406MRUKT", "deleteAllLinksFromPost(postId")
    val deleteStatement = s"""
          delete from links_t
          where site_id_c = ?
            and from_post_id_c = ? """
    val values = List(siteId.asAnyRef, postId.asAnyRef)
    runUpdate(deleteStatement, values)
  }


  override def loadLinksFromPost(postId: PostId): Seq[Link] = {
    val query = s"""
          select * from links_t
          where site_id_c = ?
            and from_post_id_c = ?
          order by site_id_c, from_post_id_c, link_url_c  -- ix: pk
          """
    val values = List(siteId.asAnyRef, postId.asAnyRef)
    runQueryFindMany(query, values, rs => {
      parseLink(rs)
    })
  }


  override def loadLinksToPage(pageId: PageId): Seq[Link] = {
    val query = s"""
        select * from (
          -- Post to page links.
          select * from links_t
          where site_id_c = ?
            and to_page_id_c = ?
          union
          -- Post to post links. Not implemented (except for here) [post_2_post_ln].
          select ls.* from posts3 po inner join links_t ls
            on po.site_id = ls.site_id_c
            and po.unique_post_id = ls.to_post_id_c
          where po.site_id = ?
            and po.page_id = ?
          ) as lns
          order by
            lns.from_post_id_c, lns.link_url_c """
    val values = List(siteId.asAnyRef, pageId, siteId.asAnyRef, pageId)
    runQueryFindMany(query, values, rs => {
      parseLink(rs)
    })
  }


  def loadPageIdsLinkedFromPage(pageId: PageId): Set[PageId] = {
    loadPageIdsLinkedImpl(Left(pageId))
  }


  def loadPageIdsLinkedFromPosts(postIds: Set[PostId]): Set[PageId] = {
    loadPageIdsLinkedImpl(Right(postIds))
  }


  def loadPageIdsLinkedImpl(pageIdOrPostIds: Either[PageId, Set[PostId]])
        : Set[PageId] = {
    // Later, do  union  with post—>post links. [post_2_post_ln]
    // Right now, only post to page links.
    val values = mutable.ArrayBuffer[AnyRef](siteId.asAnyRef)
    val andWhat = pageIdOrPostIds match {
      case Left(pageId) =>
        values.append(pageId)
        "and po.page_id = ?"
      case Right(postIds) =>
        if (postIds.isEmpty) return Set.empty
        values.appendAll(postIds.map(_.asAnyRef))
        s"and po.unique_post_id in (${ makeInListFor(postIds) })"
    }
    val query = s"""
          select distinct ls.to_page_id_c
          from posts3 po inner join links_t ls
              on po.unique_post_id = ls.from_post_id_c
              and po.site_id = ls.site_id_c
          where po.site_id = ?
            $andWhat
          order by
            to_page_id_c"""
    runQueryFindManyAsSet(query, values.toList, rs => {
      rs.getString("to_page_id_c")
    })
  }


  def loadPageIdsLinkingToPage(pageId: PageId, inclDeletedHidden: Boolean): Set[PageId] = {
    unimplementedIf(inclDeletedHidden,
          "inclDeletedHidden must be false  [TyE593RKD]  [q_deld_lns]")

    val query = s"""
          select distinct po.page_id
          from links_t ls
              inner join posts3 po
                  on ls.from_post_id_c = po.unique_post_id and ls.site_id_c = po.site_id
                  -- Excl links from deleted posts  TyT602AMDUN   [q_deld_lns]
                  -- and from hidden posts  TyT5KD20G7)
                  -- Need not check approved_* — links aren't inserted until the
                  -- new post or new edits got approved.
                  and po.deleted_status = ${DeletedStatus.NotDeleted.toInt}
                  and po.hidden_at is null
              inner join pages3 pg
                  on po.site_id = pg.site_id
                  and po.page_id = pg.page_id
                  -- Excl links from deleted pages  TyT7RD3LM5  [q_deld_lns]
                  -- and hidden pages TESTS_MISSING.
                  -- But incl links from not yet published pages — that's
                  -- more author friendly? Handled in Scala code instead.
                  and pg.deleted_at is null
                  and pg.hidden_at is null
          where ls.site_id_c = ?
            and ls.to_page_id_c = ?
            -- Not in a deleted category  TyT042RKD36  [q_deld_lns]
            -- (But if the page is not in any category — that's fine.)
            -- This does an Anti Join with categories3, good.
            and not exists (
                select 1 from categories3 cs
                where pg.site_id = cs.site_id
                  and pg.category_id = cs.id
                  and cs.deleted_at is not null)
          order by
            page_id """

    val values = List(siteId.asAnyRef, pageId)
    runQueryFindManyAsSet(query, values, rs => {
      rs.getString("page_id")
    })
  }


  private def parseLinkPreview(rs: js.ResultSet): LinkPreview = {
    LinkPreview(
          linkUrl = getString(rs, "link_url_c"),
          fetchedFromUrl = getString(rs, "fetched_from_url_c"),
          fetchedAt = getWhen(rs, "fetched_at_c"),
          // cache_max_secs_c = ... — later
          statusCode = getInt(rs, "status_code_c"),
          previewType = getInt(rs, "preview_type_c"),
          firstLinkedById = getInt(rs, "first_linked_by_id_c"),
          contentJson = getOptJsObject(rs, "content_json_c").getOrElse(JsNull))
  }


  private def parseLink(rs: js.ResultSet): Link = {
    Link(
          fromPostId = getInt(rs, "from_post_id_c"),
          linkUrl = getString(rs, "link_url_c"),
          addedAt = getWhen(rs, "added_at_c"),
          addedById = getInt(rs, "added_by_id_c"),
          isExternal = getOptBool(rs, "is_external_c") is true,
          //to_staff_page: getOptBool(rs, "to_staff_page") is true,
          toPageId = getOptString(rs, "to_page_id_c"),
          toPostId = getOptInt(rs, "to_post_id_c"),
          toPpId = getOptInt(rs, "to_pp_id_c"),
          toTagId = getOptInt(rs, "to_tag_id_c"),
          toCategoryId = getOptInt(rs, "to_category_id_c"))
  }

}
