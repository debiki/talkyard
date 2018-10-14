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



trait SpamCheckQueueDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  def spamCheckPostsSoon(byWho: Who, spamRelReqStuff: SpamRelReqStuff, posts: Post*) {
    posts.foreach(enqueuePost(byWho, spamRelReqStuff, _))
  }


  private def enqueuePost(byWho: Who, spamRelReqStuff: SpamRelReqStuff, post: Post) {
    val statement = s"""
      insert into spam_check_queue3 (
        action_at,
        site_id,
        post_id,
        post_rev_nr,
        user_id,
        browser_id_cookie,
        browser_fingerprint,
        req_user_agent,
        req_referer,
        req_ip,
        req_uri)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict (site_id, post_id) do update set
        post_rev_nr = greatest(spam_check_queue3.post_rev_nr, excluded.post_rev_nr)
      """
    // What if appr rev nr gets decremented? should that perhaps not be allowed? [85YKF30]
    // For example, someone inserting spam. But then edits and removes it — then the edited
    // version will be spam checked. And then (if this can be done, not yet implemented)
    // the user reverts to the earlier spammy version.
    // Think about this if I implement some revert-to-earlier-version functionality that
    // decrements the post revision nr.
    val actionAt = post.currentRevLastEditedAt.getOrElse(post.createdAt)
    val values = List(
      actionAt, siteId.asAnyRef, post.id.asAnyRef, post.currentRevisionNr.asAnyRef,
      byWho.id.asAnyRef, byWho.idCookie.orNullVarchar, byWho.browserFingerprint.asAnyRef,
      spamRelReqStuff.userAgent.orNullVarchar, spamRelReqStuff.referer.orNullVarchar,
      byWho.ip, spamRelReqStuff.uri)

    runUpdateSingleRow(statement, values)
  }

}
