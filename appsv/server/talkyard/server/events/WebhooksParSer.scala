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
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

package talkyard.server.events

import com.debiki.core._
import com.debiki.core.Prelude.MessAborter
import talkyard.server.JsX._
import debiki.JsonUtils._

import play.api.libs.json._


object WebhooksParSer {


  /** Sync w Typescript:  interface Webhook  */
  def JsWebhook(webhook: Webhook): JsObject = {
    //val eventTypeJsNrs: Seq[JsValue] =
    //      webhook.sendEventTypes.toSeq.map(et => JsNumber(et.toInt))
    Json.obj(
          "id" -> webhook.id,
          "ownerId" -> JsNumber(webhook.ownerId),
          "runAsId" -> JsNum32OrNull(webhook.runAsId),
          "enabled" -> webhook.enabled,
          "deleted" -> webhook.deleted,
          "descr" -> JsStringOrNull(webhook.descr),

          "sendToUrl" -> webhook.sendToUrl,
          //"sendEventTypes" -> JsArray(eventTypeJsNrs),
          //"sendEventSubtypes" ->
          "apiVersion" -> webhook.apiVersion,
          //"toExtAppVersion" ->
          //"sendMaxReqsPerSec" -> JsNum32OrNull(webhook.sendMaxReqsPerSec),
          "sendMaxEventsPerReq" -> JsNum32OrNull(webhook.sendMaxEventsPerReq),
          "sendCustomHeaders" -> JsObjOrNull(webhook.sendCustomHeaders),

          "retryMaxSecs" -> JsNum32OrNull(webhook.retryMaxSecs),
          "retryExtraTimes" -> JsNum32OrNull(webhook.retryExtraTimes),

          "failedSince" -> JsWhenMsOrNull(webhook.failedSince),
          "lastFailedHow" -> JsNum32OrNull(webhook.lastFailedHow.map(_.toInt)),
          "lastErrMsgOrResp" -> JsStringOrNull(webhook.lastErrMsgOrResp),
          "retriedNumTimes" -> JsNum32OrNull(webhook.retriedNumTimes),
          "retriedNumSecs" -> JsNum32OrNull(webhook.retriedNumSecs),
          "brokenReason" -> JsNum32OrNull(webhook.brokenReason.map(_.toInt)),

          "sentUpToWhen" -> JsWhenMs(webhook.sentUpToWhen),
          "sentUpToEventId" -> JsNum32OrNull(webhook.sentUpToEventId),
          "numPendingMaybe" -> JsNum32OrNull(webhook.numPendingMaybe),
          "doneForNow" -> JsBoolOrNull(webhook.doneForNow),
          // "retryEventIds" -> JsArray(webhook.retryEventIds.toSeq.map(n => JsNumber(n))),
          )
  }


  def parseWebhook(jsVal: JsValue, mab: MessAborter): Webhook = {
    try {
      val jsOb = asJsObject(jsVal, "webhook")
      Webhook(
            id = parseInt32(jsOb, "id"),
            ownerId = parseInt32(jsOb, "ownerId"),
            runAsId = parseOptInt32(jsOb, "runAsId"),
            enabled = parseOptBo(jsOb, "enabled") getOrElse false,
            deleted = parseOptBo(jsOb, "deleted") getOrElse false,
            descr = parseOptSt(jsOb, "descr"),
            sendToUrl = parseSt(jsOb, "sendToUrl"),
            //sendEventTypes = parse..(jsOb, "sendEventTypes"),
            //sendEventSubtypes =
            apiVersion = parseOptSt(jsOb, "apiVersion"),
            //toExtAppVersion =
            //sendMaxReqsPerSec = parseOptFloat32(jsOb, "sendMaxReqsPerSec"),
            sendMaxEventsPerReq = parseOptInt32(jsOb, "sendMaxEventsPerReq"),
            sendCustomHeaders = parseOptJsObject(jsOb, "sendCustomHeaders", emptyAsNone = true),
            retryMaxSecs = parseOptInt32(jsOb, "retryMaxSecs"),
            retryExtraTimes = parseOptInt32(jsOb, "retryExtraTimes"),

            failedSince = parseOptWhen(jsOb, "failedSince"),
            lastFailedHow = SendFailedHow.fromOptInt(parseOptInt32(jsOb, "lastFailedHow")),
            lastErrMsgOrResp = parseOptSt(jsOb, "lastErrMsgOrResp"),
            retriedNumTimes = parseOptInt32(jsOb, "retriedNumTimes"),
            retriedNumSecs = parseOptInt32(jsOb, "retriedNumSecs"),
            brokenReason = WebhookBrokenReason.fromOptInt(parseOptInt32(jsOb, "brokenReason")),

            sentUpToWhen = parseOptWhen(jsOb, "sentUpToWhen") getOrElse When.Genesis,
            sentUpToEventId = parseOptInt32(jsOb, "sentUpToEventId"),
            numPendingMaybe = parseOptInt32(jsOb, "numPendingMaybe"),
            doneForNow = parseOptBo(jsOb, "doneForNow"),
            // retryEventIds = Set.empty, parseInt32(jsOb, "retryEventIds"),
            )(mab)
    }
    catch {
      case ex: BadJsonException =>
        mab.abort("TyEJSNWBHK", s"Invalid webhook JSON: ${ex.getMessage}")
    }
  }


  /** Sync w Typescript:  interface WebhookReqOut  */
  def JsWebhookReqOut(reqSent: WebhookReqOut): JsObject = {
    Json.obj(
          "webhookId" -> reqSent.webhookId,
          "reqNr" -> reqSent.reqNr,

          "sentAt" -> JsWhenMs(reqSent.sentAt),
          "sentAsId" -> JsNum32OrNull(reqSent.sentAsId),
          "sentToUrl" -> reqSent.sentToUrl,
          "sentByAppVer" -> reqSent.sentByAppVer,
          "sentApiVersion" -> reqSent.sentApiVersion,
          // sentToExtAppVersion
          "sentEventTypes" -> JsArray(reqSent.sentEventTypes.toSeq.map(t => JsNumber(t.toInt))),
          // sentEventSubTypes
          "sentEventIds" -> JsArray(reqSent.sentEventIds.toSeq.map(id => JsNumber(id))),
          "sentJson" -> reqSent.sentJson,
          "sentHeaders" -> JsObjOrNull(reqSent.sentHeaders),

          "retryNr" -> JsNum32OrNull(reqSent.retryNr.map(_.toInt)),

          "failedAt" -> JsWhenMsOrNull(reqSent.failedAt),
          "failedHow" -> JsNum32OrNull(reqSent.failedHow.map(_.toInt)),
          "errMsg" -> JsStringOrNull(reqSent.errMsg),

          "respAt" -> JsWhenMsOrNull(reqSent.respAt),
          "respStatus" -> JsNum32OrNull(reqSent.respStatus),
          "respStatusText" -> JsStringOrNull(reqSent.respStatusText),
          "respBody" -> JsStringOrNull(reqSent.respBody),
          "respHeaders" -> JsObjOrNull(reqSent.respHeaders))
  }


}
