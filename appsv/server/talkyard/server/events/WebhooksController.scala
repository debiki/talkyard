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

package talkyard.server.events

import com.debiki.core._
import com.debiki.core.Prelude._
import talkyard.server.{TyContext, TyController}
import talkyard.server.http._
import WebhooksParSer._
import debiki.JsonUtils.{parseJsArray, parseInt32}
import debiki.EdHttp.throwBadReqIf
import debiki.RateLimits

import javax.inject.Inject
import play.api.libs.json._
import play.api.mvc._



class WebhooksController @Inject()(cc: ControllerComponents, tyContext: TyContext)
  extends TyController(cc, tyContext) {


  def listWebhooks(): Action[U] = AdminGetAction { req: GetRequest =>
    listWebhooksImpl(req)
  }


  private def listWebhooksImpl(req: DebikiRequest[_]): Result = {
    import req.dao
    val webhooks = dao.readTx { tx =>
      tx.loadAllWebhooks()
    }
    OkSafeJson(Json.obj(
        "webhooks" -> JsArray(webhooks map JsWebhook)))
  }


  def upsertWebhooks: Action[JsValue] = AdminPostJsonAction2(RateLimits.AdminWritesToDb,
        maxBytes = 8000) { req: JsonPostRequest =>
    import req.dao
    val jsWebhooks: Seq[JsValue] = parseJsArray(req.body, "webhooks")
    val webhooks: Seq[Webhook] =
          jsWebhooks.map(json => WebhooksParSer.parseWebhook(json, IfBadAbortReq))
    throwBadReqIf(webhooks.length > 1, "TyE2MNYWEBHS", "At most one webhook, for now")
    throwBadReqIf(webhooks.isEmpty, "TyE2MNYWEBH3", "No webhooks specified")
    val webhooksAfter = webhooks map dao.upsertWebhookConf
    OkSafeJson(Json.obj(
        "webhooks" -> JsArray(webhooksAfter map JsWebhook)))
  }


  def deleteWebhooks: Action[JsValue] = AdminPostJsonAction2(RateLimits.AdminWritesToDb,
        maxBytes = 5000) { req: JsonPostRequest =>
    throwUnimpl("Deleting webhooks is unimplemented. Disable it instead [TyE5R2MRSH35]")
    // Maybe makes sense to allow this, even if API not enabled, so one can still
    // delete old webhooks?
    import req.dao

    val jsWebhooks: Seq[JsValue] = parseJsArray(req.body, "webhooks")
    val webhookIds: Seq[WebhookId] = jsWebhooks.map(json => parseInt32(json, "id"))
    dao.writeTx { (tx, _) =>
      webhookIds foreach tx.deleteWebhook
    }
    listWebhooksImpl(req)
  }


  def retryWebhook: Action[JsValue] = AdminPostJsonAction2(RateLimits.AdminWritesToDb,
        maxBytes = 80) { req: JsonPostRequest =>
    val webhookId: WebhookId = parseInt32(req.body, "webhookId")
    // Move to WebhooksSiteDaoMixin?
    req.dao.writeTx { (tx, _) =>
      val webhook = tx.loadWebhook(webhookId) getOrElse {
        debiki.EdHttp.throwNotFound("TyE0WBHK028054", s"No webhook with id $webhookId")
      }
      val webhookAft = webhook.copy(retryExtraTimes = Some(1))(IfBadAbortReq)
      tx.upsertWebhook(webhookAft)
    }
    Ok
  }


  def listWebhookReqsOut(webhookId: WebhookId): Action[U] = AdminGetAction { req: GetRequest =>
    listWebhookReqsOutImpl(webhookId, req)
  }


  private def listWebhookReqsOutImpl(webhookId: WebhookId, req: DebikiRequest[_]): Result = {
    import req.dao
    val reqsOut = dao.readTx { tx =>
      tx.loadWebhookReqsOutRecentFirst(webhookId = webhookId, limit = 50)
    }
    OkSafeJson(Json.obj(
        "webhookReqsOut" -> JsArray(reqsOut map JsWebhookReqOut)))
  }


}
