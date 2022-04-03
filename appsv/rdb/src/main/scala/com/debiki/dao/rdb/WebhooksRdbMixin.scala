/**
 * Copyright (c) 2022 Kaj Magnus Lindberg
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
import RdbUtil._
import java.sql.{ResultSet => j_ResultSet}
import WebhooksRdb._


/** Saves webhook endpoint configurations and state, and webhook requests sent.
  */
trait WebhooksRdbMixin extends SiteTransaction {
  self: RdbSiteTransaction =>


  def loadWebhook(id: WebhookId): Opt[Webhook] = {
    loadWebhooksImpl(Some(id)).headOption
  }


  def loadAllWebhooks(): ImmSeq[Webhook] = {
    loadWebhooksImpl(None)
  }


  private def loadWebhooksImpl(anyId: Opt[WebhookId]): ImmSeq[Webhook] = {
    val values = MutArrBuf[AnyRef]()
    values.append(siteId.asAnyRef)

    val andIdEq = anyId map { id =>
      values.append(id.asAnyRef)
      "and webhook_id_c = ?"
    } getOrElse ""

    val query = s"""
          select * from webhooks_t
          where site_id_c = ?
            and not deleted_c
            $andIdEq
          order by webhook_id_c """
    runQueryFindMany(query, values.toList, parseWebhook)
  }


  def upsertWebhook(webhook: Webhook): U = {
    val statement = s"""
          insert into webhooks_t (
              site_id_c,
              webhook_id_c,
              owner_id_c,
              run_as_id_c,
              enabled_c,
              deleted_c,
              descr_c,
              send_to_url_c,
              send_event_types_c,
              send_event_subtypes_c,
              api_version_c,
              to_ext_app_ver_c,
              send_max_reqs_per_sec_c,
              send_max_events_per_req_c,
              send_max_delay_secs_c,
              send_header_names_c,
              send_header_values_c,
              retry_max_secs_c,
              retry_extra_times_c,
              failed_since_c,
              last_failed_how_c,
              last_err_msg_or_resp_c,
              retried_num_times_c,
              retried_num_secs_c,
              broken_reason_c,
              sent_up_to_when_c,
              sent_up_to_event_id_c,
              num_pending_maybe_c,
              done_for_now_c
              -- retry_event_ids_c,
              )
<<<<<<< HEAD
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?, ?, ?, ?, ?)
||||||| parent of 6e054e27f... Try using text[] and text[][] instead of jsonb
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?, ?, ?, ?, ?)
=======
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
>>>>>>> 6e054e27f... Try using text[] and text[][] instead of jsonb
          on conflict (site_id_c, webhook_id_c)   -- pk
          do update set
              owner_id_c = excluded.owner_id_c,
              run_as_id_c = excluded.run_as_id_c,
              enabled_c = excluded.enabled_c,
              deleted_c = excluded.deleted_c,
              descr_c = excluded.descr_c,
              send_to_url_c = excluded.send_to_url_c,
              send_event_types_c = excluded.send_event_types_c,
              send_event_subtypes_c = excluded.send_event_subtypes_c,
              api_version_c = excluded.api_version_c,
              to_ext_app_ver_c = excluded.to_ext_app_ver_c,
              send_max_reqs_per_sec_c = excluded.send_max_reqs_per_sec_c,
              send_max_events_per_req_c = excluded.send_max_events_per_req_c,
              send_max_delay_secs_c = excluded.send_max_delay_secs_c,
              send_header_names_c = excluded.send_header_names_c,
              send_header_values_c = excluded.send_header_values_c,
              retry_max_secs_c = excluded.retry_max_secs_c,
              retry_extra_times_c = excluded.retry_extra_times_c,
              failed_since_c = excluded.failed_since_c,
              last_failed_how_c = excluded.last_failed_how_c,
              last_err_msg_or_resp_c = excluded.last_err_msg_or_resp_c,
              retried_num_times_c = excluded.retried_num_times_c,
              retried_num_secs_c = excluded.retried_num_secs_c,
              broken_reason_c = excluded.broken_reason_c,
              sent_up_to_when_c = excluded.sent_up_to_when_c,
              sent_up_to_event_id_c = excluded.sent_up_to_event_id_c,
              num_pending_maybe_c = excluded.num_pending_maybe_c,
              done_for_now_c = excluded.done_for_now_c
              -- retry_event_ids_c = excluded.retry_event_ids_c  """

    val values = List(
          siteId.asAnyRef,
          webhook.id.asAnyRef,
          webhook.ownerId.asAnyRef,
          webhook.runAsId.orNullInt32,
          webhook.enabled.asAnyRef,
          webhook.deleted.asAnyRef,
          webhook.descr.trimOrNullVarchar,
          webhook.sendToUrl,
          NullArray,  // makeSqlArrayOfInt32(webhook.sendEventTypes)
          NullArray,  // makeSqlArrayOfInt32(webhook.sendEventsubTypes)
          webhook.apiVersion.orNullVarchar,
          NullVarchar,  // webhook.toExtAppVersion
          NullInt,      // webhook.sendMaxReqsPerSec
          webhook.sendMaxEventsPerReq.orNullInt32,
          NullInt,      // webhook.sendMaxDelaySecs
          makeSqlArrayOfStrings(webhook.sendCustomHeaders.keys),
          makeSqlArrayOfStringsStrings(webhook.sendCustomHeaders.values),
          webhook.retryMaxSecs.orNullInt32,
          webhook.retryExtraTimes.orNullInt32,

          webhook.failedSince.orNullTimestamp,
          webhook.lastFailedHow.map(_.toInt).orNullInt32,
          webhook.lastErrMsgOrResp.trimOrNullVarchar,
          webhook.retriedNumTimes.orNullInt32,
          webhook.retriedNumSecs.orNullInt32,
          webhook.brokenReason.map(_.toInt).orNullInt32,

          webhook.sentUpToWhen.asTimestamp,
          webhook.sentUpToEventId.orNullInt32,
          webhook.numPendingMaybe.orNullInt32,
          webhook.doneForNow.orNullBo)

    runUpdateSingleRow(statement, values)
  }


  def updateWebhookState(webhook: Webhook): U = {
    // Don't update any config fields — that'd be the lost update bug.
    val statement = s"""
          update webhooks_t set
              retry_extra_times_c = ?,
              failed_since_c = ?,
              last_failed_how_c = ?,
              last_err_msg_or_resp_c = ?,
              retried_num_times_c = ?,
              retried_num_secs_c = ?,
              broken_reason_c = ?,
              sent_up_to_when_c = ?,
              sent_up_to_event_id_c = ?,
              num_pending_maybe_c = ?,
              done_for_now_c = ?
              -- retry_event_ids_c,
          where
              -- ix: webhooks_p_id
              site_id_c = ? and
              webhook_id_c = ? """

    val values = List(
          webhook.retryExtraTimes.orNullInt32,
          webhook.failedSince.orNullTimestamp,
          webhook.lastFailedHow.map(_.toInt).orNullInt32,
          webhook.lastErrMsgOrResp.trimOrNullVarchar,
          webhook.retriedNumTimes.orNullInt32,
          webhook.retriedNumSecs.orNullInt32,
          webhook.brokenReason.map(_.toInt).orNullInt32,
          webhook.sentUpToWhen.asTimestamp,
          webhook.sentUpToEventId.orNullInt32,
          webhook.numPendingMaybe.orNullInt32,
          webhook.doneForNow.orNullBo,
          siteId.asAnyRef,
          webhook.id.asAnyRef)

    runUpdateSingleRow(statement, values)
  }


  def deleteWebhook(webhookId: WebhookId): U = {
    unimpl("TyE32057MRT")
  }


  def loadWebhookReqsOutRecentFirst(webhookId: WebhookId, limit: i32): ImmSeq[WebhookReqOut] = {
    dieIf(limit > 1000, "TyE2BIGLIM50276")
    val query = s"""
          select * from webhook_reqs_out_t
          where
              -- ix: webhookreqsout_p_webhookid_reqnr
              site_id_c = ? and
              webhook_id_c = ?
          order by req_nr_c desc limit $limit  """
    runQueryFindMany(query, List(siteId.asAnyRef, webhookId.asAnyRef), parseWebhookSent)
  }


  def loadWebhookReqsOutRecentFirst(limit: i32): ImmSeq[WebhookReqOut] = {
    dieIf(limit > 1000, "TyE2BIGLIM50277")
    val query = s"""
          select * from webhook_reqs_out_t
          -- ix: webhookreqsout_i_sentat
          where site_id_c = ?
          order by sent_at_c desc limit $limit  """
    runQueryFindMany(query, List(siteId.asAnyRef), parseWebhookSent)
  }


  def insertWebhookReqOut(reqOut: WebhookReqOut): U = {
    val statement = s"""
          insert into webhook_reqs_out_t (
              site_id_c,
              webhook_id_c,
              req_nr_c,
              sent_at_c,
              sent_as_id_c,
              sent_to_url_c,
              sent_by_app_ver_c,
              sent_api_version_c,
              sent_to_ext_app_ver_c,
              sent_event_types_c,
              sent_event_subtypes_c,
              sent_event_ids_c,
              sent_json_c,
<<<<<<< HEAD
              sent_headers_c,
              retry_nr_c)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) """
||||||| parent of 6e054e27f... Try using text[] and text[][] instead of jsonb
              sent_headers_c)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) """
=======
              sent_header_names_c,
              sent_header_values_c)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) """
>>>>>>> 6e054e27f... Try using text[] and text[][] instead of jsonb

    val values = List(
          siteId.asAnyRef,
          reqOut.webhookId.asAnyRef,
          reqOut.reqNr.asAnyRef,
          reqOut.sentAt.asTimestamp,
          reqOut.sentAsId.orNullInt32,
          reqOut.sentToUrl,
          reqOut.sentByAppVer,
          reqOut.sentApiVersion,
          NullVarchar,
          makeSqlArrayOfInt32(reqOut.sentEventTypes.map(_.toInt)),
          NullArray, //reqOut.sentEventSubTypes,
          makeSqlArrayOfInt32(reqOut.sentEventIds),
          reqOut.sentJson,
<<<<<<< HEAD
          reqOut.sentHeaders.orNullJson,
          reqOut.retryNr.map(_.toInt).orNullInt32)
||||||| parent of 6e054e27f... Try using text[] and text[][] instead of jsonb
          reqOut.sentHeaders.orNullJson)
=======
          makeSqlArrayOfStrings(reqOut.sentHeaders.keys),
          makeSqlArrayOfStringsStrings(reqOut.sentHeaders.values))
>>>>>>> 6e054e27f... Try using text[] and text[][] instead of jsonb

    runUpdateSingleRow(statement, values)
  }


  def updateWebhookReqOutWithResp(reqOut: WebhookReqOut): U = {
    val statement = s"""
          update webhook_reqs_out_t set
              failed_at_c          = ?,
              failed_how_c         = ?,
              failed_msg_c         = ?,
              resp_at_c            = ?,
              resp_status_c        = ?,
              resp_status_text_c   = ?,
              resp_body_c          = ?,
              resp_header_names_c  = ?,
              resp_header_values_c = ?,
          where
              -- ix: webhookreqsout_p_webhookid_reqnr
              site_id_c = ? and
              webhook_id_c = ? and
              req_nr_c = ?  """

    val values = List(
          reqOut.failedAt.orNullTimestamp,
          reqOut.failedHow.map(_.toInt).orNullInt,
          reqOut.errMsg.trimOrNullVarchar,
          reqOut.respAt.orNullTimestamp,
          reqOut.respStatus.orNullInt,
<<<<<<< HEAD
          reqOut.respStatusText.trimOrNullVarchar,
          reqOut.respBody.trimOrNullVarchar,
          reqOut.respHeaders.orNullJson,
||||||| parent of 6e054e27f... Try using text[] and text[][] instead of jsonb
          reqOut.respStatusText.orNullVarchar,
          reqOut.respBody.orNullVarchar,
          reqOut.respHeaders.orNullJson,
=======
          reqOut.respStatusText.orNullVarchar,
          reqOut.respBody.orNullVarchar,
          reqOut.respHeaders.map(hs => makeSqlArrayOfStrings(hs.keys)) getOrElse NullArray,
          reqOut.respHeaders.map(hs => makeSqlArrayOfStringsStrings(hs.values)) getOrElse NullArray,
>>>>>>> 6e054e27f... Try using text[] and text[][] instead of jsonb
          siteId.asAnyRef,
          reqOut.webhookId.asAnyRef,
          reqOut.reqNr.asAnyRef)

    runUpdateSingleRow(statement, values)
  }
}


object WebhooksRdb {


  def parseWebhook(rs: j_ResultSet): Webhook = {
    Webhook(
          id = getInt32(rs, "webhook_id_c"),

          ownerId = getInt32(rs, "owner_id_c"),
          runAsId = getOptInt32(rs, "run_as_id_c"),

          enabled = getBool(rs, "enabled_c"),
          deleted = getBool(rs, "deleted_c"),
          descr = getOptString(rs, "descr_c"),
          sendToUrl = getString(rs, "send_to_url_c"),
          // checkDestCert = getOptBool(rs, "check_dest_cert_c"),
          // sendEventTypes = getOptArrayOfInt32(rs, "send_event_types_c"),
          // sendEventSubtypes = getOptArrayOfInt32(rs, "send_event_subtypes_c"),
          apiVersion = getOptString(rs, "api_version_c"),
          // getOptString(rs, "to_ext_app_ver_c"),
          //sendMaxReqsPerSec = getOptInt32(rs, "send_max_reqs_per_sec_c"),
          sendMaxEventsPerReq = getOptInt32(rs, "send_max_events_per_req_c"),
          // sendMaxDelaySecs  = send_max_delay_secs_c
<<<<<<< HEAD
          sendCustomHeaders = getOptJsObject(rs, "send_custom_headers_c"),

||||||| parent of 6e054e27f... Try using text[] and text[][] instead of jsonb
          sendCustomHeaders = getOptJsObject(rs, "send_custom_headers_c"),
=======
          sendCustomHeaders = getMapOfKeysAndValues2(
                rs, "send_header_names_c", "send_header_values_c"),
          //sendHeaderNames = getArrayOfStrings(rs, "send_header_names_c"),
          //sendHeaderValues = getArrayOfStringsStrings(rs, "send_header_values_c"),
>>>>>>> 6e054e27f... Try using text[] and text[][] instead of jsonb
          retryMaxSecs = getOptInt32(rs, "retry_max_secs_c"),
          retryExtraTimes = getOptInt32(rs, "retry_extra_times_c"),

          failedSince = getOptWhen(rs, "failed_since_c"),
          lastFailedHow = SendFailedHow.fromOptInt(getOptInt32(rs, "last_failed_how_c")),
          lastErrMsgOrResp = getOptString(rs, "last_err_msg_or_resp_c"),
          retriedNumTimes = getOptInt32(rs, "retried_num_times_c"),
          retriedNumSecs = getOptInt32(rs, "retried_num_secs_c"),
          brokenReason = WebhookBrokenReason.fromOptInt(getOptInt32(rs, "broken_reason_c")),

          sentUpToWhen = getWhen(rs, "sent_up_to_when_c"),
          sentUpToEventId = getOptInt32(rs, "sent_up_to_event_id_c"),
          numPendingMaybe = getOptInt32(rs, "num_pending_maybe_c"),
          doneForNow = getOptBool(rs, "done_for_now_c"),
          //retryEventIds = Set.empty, //getOptArrayOfInt32(rs, "retry_event_ids_c"))
          )(IfBadDie)
  }


  def parseWebhookSent(rs: j_ResultSet): WebhookReqOut = {
    WebhookReqOut(
          webhookId = getInt32(rs, "webhook_id_c"),
          reqNr = getInt32(rs, "req_nr_c"),

          sentAt = getWhen(rs, "sent_at_c"),
          sentAsId = getOptInt32(rs, "sent_as_id_c"),
          sentToUrl = getString(rs, "sent_to_url_c"),
          sentByAppVer = getString(rs, "sent_by_app_ver_c"),
          sentApiVersion = getString(rs, "sent_api_version_c"),
          // sent_to_ext_app_ver_c
          sentEventTypes = getArrayOfInt32(rs, "sent_event_types_c").toSet
                              .flatMap(EventType.fromInt),
          //sentEventSubTypes = sent_event_subtypes_c
          sentEventIds = getArrayOfInt32(rs, "sent_event_ids_c").toSet,
          sentJson = getJsObject(rs, "sent_json_c"),
          sentHeaders = getMapOfKeysAndValues2(
                rs, "sent_header_names_c", "sent_header_values_c"),
          //sentHeaderNames = getArrayOfStrings(rs, "sent_header_names_c"),
          //sentHeaderValues = getArrayOfStringsStrings(rs, "sent_header_values_c"),

          retryNr = RetryNr.fromOptInt(getOptInt32(rs, "retry_nr_c")),

          failedAt = getOptWhen(rs, "failed_at_c"),
          failedHow = SendFailedHow.fromOptInt(getOptInt32(rs, "failed_how_c")),
          errMsg = getOptString(rs, "failed_msg_c"),

          respAt = getOptWhen(rs, "resp_at_c"),
          respStatus = getOptInt32(rs, "resp_status_c"),
          respStatusText = getOptString(rs, "resp_status_text_c"),
          respBody = getOptString(rs, "resp_body_c"),
          respHeaders = getOptMapOfKeysAndValues2(
                rs, "resp_header_names_c", "resp_header_values_c"),
          )
  }

}
