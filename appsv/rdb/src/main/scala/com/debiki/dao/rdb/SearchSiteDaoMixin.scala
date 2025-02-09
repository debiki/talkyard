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

  // Don't update `inserted_at`, only `action_at`.
  val OnPostConflictAction = o"""
    on conflict (site_id, do_what_c, post_id) where post_id is not null
    do update set
      post_rev_nr = greatest(job_queue_t.post_rev_nr, excluded.post_rev_nr),
      site_version = greatest(job_queue_t.site_version, excluded.site_version),
      action_at    = greatest(job_queue_t.action_at, excluded.action_at)
      """
      // Later? But how make unique?
      //   lang_codes_c      = array_cat(lang_codes_c,       excluded.lang_codes_c),
      //   search_eng_vers_c = array_cat(dsearch_eng_vers_c, exclude.search_eng_vers_c)

  val PostShouldBeIndexedTests = /* [do_not_index] */ o"""
    posts3.approved_rev_nr is not null and
    posts3.deleted_status = ${DeletedStatus.NotDeleted.toInt} and
    posts3.hidden_at is null
    """
}


trait SearchSiteDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction =>

  val selectSiteVersion = "select version from sites3 where id = ?"

  /** Returns how many posts were enqueued *or updated* if already in the queue. */
  def indexPostsSoon(posts: Post*): i32 = {
    var numEnqueued = 0
    posts foreach { p =>
      val gotEnqueued = _enqueuePost(p)
      if (gotEnqueued) numEnqueued += 1
    }
    numEnqueued
  }

  private def _enqueuePost(post: Post): Bo = {
    // COULD skip 'post' if it's a code page, e.g. CSS or JS?
    val statement = s""" -- _enqueuePost
      insert into job_queue_t (action_at, site_id, site_version, post_id, post_rev_nr)
        values (?, ?, ($selectSiteVersion), ?, ?)
      $OnPostConflictAction
      """

    BUG; UX; COULD // pretty harmless: Might make it take a tiny bit longer for edits to
    // become visible to the full-text-search engine:
    //      action_at shouldn't always be createdAt? What if the post
    // just got *edited* recently?  Then, better use now().

    // What if appr rev nr gets decremented? should that perhaps not be allowed? [85YKF30]
    val revNr = post.approvedRevisionNr.getOrElse(post.currentRevisionNr)
    val values = List(post.createdAt, siteId.asAnyRef, siteId.asAnyRef,
      post.id.asAnyRef, revNr.asAnyRef)
    runUpdateSingleRow(statement, values)
  }

  def indexPostIdsSoon_unimpl(postIds: Set[PostId]): Unit = {
    unimpl("Not implemented:  indexPostIdsSoon_unimpl")
    /* Sth like this:
    val statement = s"""
        insert into job_queue_t (action_at, site_id, site_version, post_id, post_rev_nr)
        select ?, ?, ($selectSiteVersion), post_id, post_rev_nr
        from posts3 where site_id = ? and unique_post_id in (${makeInListFor(postIds)})
        $OnPostConflictAction """

    val values = List(
        tx.now(), siteId.asAnyRef, siteId.asAnyRef,
        ...postIds.asAnyRef,
        // For looking up the post rev nr:
        siteId.asAnyRef, post.id.asAnyRef)
    runUpdate(statement, values)
     */
  }

  def indexAllPostsOnPage(pageId: PageId): Unit = {
    val statement = s""" -- indexAllPostsOnPage
      insert into job_queue_t (action_at, site_id, site_version, post_id, post_rev_nr)
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


  def indexPagesSoon(pages: PageMeta*): Unit = {
    pages.foreach(_enqueuePage)
  }

  private def _enqueuePage(pageMeta: PageMeta): U = {
    die("Untested", "EsE4YKG02")
    val statement = s""" -- _enqueuePage
      insert into job_queue_t (action_at, site_id, site_version, do_what_c, page_id, page_version)
        values (?, ?, ($selectSiteVersion), ?, ?, ?)
      on conflict (site_id, do_what_c, page_id) where page_id is not null
      do update set
        page_version = greatest(job_queue_t.page_version, excluded.page_version),
        site_version = greatest(job_queue_t.site_version, excluded.site_version),
        action_at    = greatest(job_queue_t.action_at, excluded.action_at)
      """
    val values = List(pageMeta.createdAt, siteId.asAnyRef,
          siteId.asAnyRef, // for selecting site version
          JobType.Index.asAnyRef, pageMeta.pageId, pageMeta.version.asAnyRef)
    runUpdateSingleRow(statement, values)
  }


  def alterJobQueueRange(range: TimeRange, newEndWhen: When, newEndOffset: PostId): U = {
    // For now, there can be just one range per site, and  [all_time_ranges_start_at_time_0].
    val zero = When.Genesis.secondsFlt64
    val statement = s""" -- alterJobQueueRange
          update  job_queue_t
          set  time_range_to_c          = ?,
               time_range_to_ofs_c      = ?
          where  site_id                = ?
            and  time_range_from_c      = to_timestamp($zero)
            and  time_range_from_ofs_c  = 0
            and  time_range_to_c        is not null
            and  time_range_to_ofs_c    is not null  """

    val values = List(newEndWhen.asTimestamp, newEndOffset.asAnyRef, siteId.asAnyRef)
    runUpdateSingleRow(statement, values)
  }


  def deleteJobQueueRange(range: TimeRange): U = {
    // Just one range per site, and  [all_time_ranges_start_at_time_0].
    val zero = When.Genesis.secondsFlt64
    val statement = s""" -- deleteJobQueueRange
          delete from  job_queue_t
          where  site_id                = ?
            and  time_range_from_c      = to_timestamp($zero)
            and  time_range_from_ofs_c  = 0
            and  time_range_to_c        is not null
            and  time_range_to_ofs_c    is not null  """

    runUpdateSingleRow(statement, List(siteId.asAnyRef))
  }
}

