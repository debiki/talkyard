/**
 * Copyright (C) 2016 Kaj Magnus Lindberg
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
import Rdb._
import SearchSiteDaoMixin._



object SearchSiteDaoMixin {
  val OnPostConflictAction = o"""
    on conflict (site_id, post_id) do update set
      post_rev_nr = greatest(index_queue3.post_rev_nr, excluded.post_rev_nr)"""

  val PostShouldBeIndexedTests = o"""
    posts3.approved_rev_nr is not null and
    posts3.deleted_status = ${DeletedStatus.NotDeleted.toInt} and
    posts3.hidden_at is null
    """
}


trait SearchSiteDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction =>

  val selectSiteVersion = "select version from sites3 where id = ?"

  def indexPostsSoon(posts: Post*) {
    posts.foreach(enqueuePost)
  }

  private def enqueuePost(post: Post) {
    // COULD skip 'post' if it's a code page, e.g. CSS or JS?
    val statement = s"""
      insert into index_queue3 (action_at, site_id, site_version, post_id, post_rev_nr)
        values (?, ?, ($selectSiteVersion), ?, ?)
      $OnPostConflictAction
      """
    // What if appr rev nr gets decremented? should that perhaps not be allowed? [85YKF30]
    val revNr = post.approvedRevisionNr.getOrElse(post.currentRevisionNr)
    val values = List(post.createdAt, siteId.asAnyRef, siteId.asAnyRef,
      post.id.asAnyRef, revNr.asAnyRef)
    runUpdateSingleRow(statement, values)
  }


  def indexAllPostsOnPage(pageId: PageId) {
    val statement = s"""
      insert into index_queue3 (action_at, site_id, site_version, post_id, post_rev_nr)
      select
        posts3.created_at,
        sites3.id,
        sites3.version,
        posts3.unique_post_id,
        posts3.approved_rev_nr
      from posts3 inner join sites3
        on posts3.site_id = sites3.id
      where
        posts3.site_id = ? and
        posts3.page_id = ? and
        $PostShouldBeIndexedTests
      ${SearchSiteDaoMixin.OnPostConflictAction}
      """
    runUpdate(statement, List(siteId.asAnyRef, pageId))
  }


  def indexPagesSoon(pages: PageMeta*) {
    pages.foreach(enqueuePage)
  }

  private def enqueuePage(pageMeta: PageMeta) {
    die("Untested", "EsE4YKG02")
    val statement = s"""
      insert into index_queue3 (action_at, site_id, site_version, page_id, page_version)
        values (?, ?, ($selectSiteVersion), ?, ?)
      on conflict (site_id, page_id) do update set
        page_version = greatest(index_queue3.page_version, excluded.page_version)
      """
    val values = List(pageMeta.createdAt, siteId.asAnyRef, siteId.asAnyRef, pageMeta.pageId,
      pageMeta.version.asAnyRef)
    runUpdateSingleRow(statement, values)
  }

}
