/**
 * Copyright (C) 2016, 2019 Kaj Magnus Lindberg
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
import scala.collection.immutable



trait SpamCheckQueueDaoMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  def insertSpamCheckTask(spamCheckTask: SpamCheckTask) {
    val statement = s"""
      insert into spam_check_queue3 (
        created_at,
        site_id,
        post_id,
        post_nr,
        post_rev_nr,
        page_id,
        page_type,
        page_available_at,
        html_to_spam_check,
        language,
        author_id_c,
        auhtor_true_id_c,
        browser_id_cookie,
        browser_fingerprint,
        req_user_agent,
        req_referer,
        req_ip,
        req_uri,
        author_name,
        author_email_addr,
        author_trust_level,
        author_url)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      -- can happen if appending to same chat message? or ninja editing post [SPMCHKED]
      on conflict (site_id, post_id, post_rev_nr) do nothing
      """
    val values = List(
      spamCheckTask.createdAt.asTimestamp,
      siteId.asAnyRef,
      spamCheckTask.postToSpamCheck.map(_.postId).orNullInt,
      spamCheckTask.postToSpamCheck.map(_.postNr).orNullInt,
      spamCheckTask.postToSpamCheck.map(_.postRevNr).orNullInt,
      spamCheckTask.postToSpamCheck.map(_.pageId).orNullVarchar,
      spamCheckTask.postToSpamCheck.map(_.pageType.toInt).orNullInt,
      spamCheckTask.postToSpamCheck.map(_.pageAvailableAt).orNullTimestamp,
      // There's a constraint, spamcheckqueue_c_texttospamcheck_len, 20200 chars. Maybe 15 000 enough?
      spamCheckTask.postToSpamCheck.map(_.htmlToSpamCheck.take(15*1000)).trimOrNullVarchar,
      spamCheckTask.postToSpamCheck.map(_.language).orNullVarchar,
      spamCheckTask.who.trueId.curId.asAnyRef,
      spamCheckTask.who.trueId.anyTrueId.orNullInt,
      spamCheckTask.who.idCookie.trimOrNullVarchar,
      spamCheckTask.who.browserFingerprint.asAnyRef,
      spamCheckTask.requestStuff.userAgent.trimOrNullVarchar,
      spamCheckTask.requestStuff.referer.trimOrNullVarchar,
      spamCheckTask.who.ip,
      spamCheckTask.requestStuff.uri,
      spamCheckTask.requestStuff.userName.trimOrNullVarchar,
      spamCheckTask.requestStuff.userEmail.trimOrNullVarchar,
      spamCheckTask.requestStuff.userTrustLevel.map(_.toInt).orNullInt,
      spamCheckTask.requestStuff.userUrl.trimOrNullVarchar)

    runUpdateSingleRow(statement, values)
  }


  def loadSpamCheckTasksWaitingForHumanLatestLast(postId: PostId): immutable.Seq[SpamCheckTask] = {
    val query = s"""
      select * from spam_check_queue3
      where
        site_id = ? and
        post_id = ? and
        human_says_is_spam is null
      order by created_at
      """
    val values = List(siteId.asAnyRef, postId.asAnyRef)
    runQueryFindMany(query, values, RdbUtil.getSpamCheckTask)
  }


  def updateSpamCheckTaskForPostWithResults(spamCheckTask: SpamCheckTask) {
    val postToSpamCheck = spamCheckTask.postToSpamCheck.getOrDie("TyE60TQL2")
    val statement = """
      update spam_check_queue3 set
        results_at = ?,
        results_json = ?,
        results_text = ?,
        num_is_spam_results = ?,
        num_not_spam_results = ?,
        human_says_is_spam = ?,
        is_misclassified = ?,
        misclassifications_reported_at = ?
      where
        site_id = ? and
        post_id = ? and
        post_rev_nr = ?
      """
    val values = List(
      spamCheckTask.resultsAt.orNullTimestamp,
      spamCheckTask.resultsJson.orNullJson,
      spamCheckTask.resultsText.trimOrNullVarchar,
      spamCheckTask.numIsSpamResults.orNullInt,
      spamCheckTask.numNotSpamResults.orNullInt,
      spamCheckTask.humanSaysIsSpam.orNullBoolean,
      spamCheckTask.isMisclassified.orNullBoolean,
      spamCheckTask.misclassificationsReportedAt.orNullTimestamp,
      spamCheckTask.siteId.asAnyRef,
      postToSpamCheck.postId.asAnyRef,
      postToSpamCheck.postRevNr.asAnyRef)
    runUpdateSingleRow(statement, values)
  }

}
