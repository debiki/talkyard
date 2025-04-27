/**
 * Copyright (c) 2025 Kaj Magnus Lindberg
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
import com.debiki.core.Prelude.IfBadDie
import org.scalatest.freespec.AnyFreeSpec
import org.scalatest.matchers.must
import play.api.libs.json.Json


/** Tests that the test helper, `WebhooksSiteDaoMixin.fakeBugImpl()`, works.
  */
class WebhooksSiteDaoMixinSpec extends AnyFreeSpec with must.Matchers {

  def mkDummyReq(reqNr: i32, inclText: St): WebhookReqOut =
    WebhookReqOut(
          webhookId = 1,
          reqNr = reqNr,
          sentAt = When.JanOne2020HalfPastFive,
          sentAsId = None,
          sentToUrl = "https://example.com/api/webhook",
          sentByAppVer = "1.2.3",
          sentApiVersion = "0.0.1",
          //sentToExtAppVersion: Opt[St]
          sentEventTypes = Set[EventType](PageEventType.PageCreated),
          //sentEventSubtypes: Set[EventSubtype],
          sentEventIds = Set[EventId](123),
          sentJson = Json.obj("testText" -> s"abcd $inclText efgh"),
          // sentThingFields: Set[ThingField],
          sentHeaders = None,
          retryNr = None,
          )

  def mkDummyWebhook(): Webhook =
    Webhook(
        id = 1,
        ownerId = Group.AdminsId,
        runAsId = Some(Participant.SysbotUserId),
        enabled = true,
        deleted = false,
        descr = None,
        sendToUrl = "https://example.com/test-webhook",
        apiVersion = None,
        sendMaxEventsPerReq = None,
        sendCustomHeaders = None,
        retryMaxSecs = None,
        retryExtraTimes = None)(IfBadDie)


  "WebhooksSiteDaoMixin can" - {
    lazy val webhook = mkDummyWebhook()

    "fake bugs" in {
      val errText = "__fakebug_test_a__"
      val req = mkDummyReq(reqNr = 1, errText)

      // Shouldn't throw.
      WebhooksSiteDaoMixin.fakeBugImpl(webhook, req, "not bug")

      // But this includes the magic fake-a-bug text, and should throw.
      val ex = intercept[RuntimeException] {
        WebhooksSiteDaoMixin.fakeBugImpl(webhook, req, errText)
      }
      ex.getMessage must include(errText)

      // This does not; shouldn't throw.
      WebhooksSiteDaoMixin.fakeBugImpl(webhook, req, "if a bird is a bug is a bug a bird")
    }

    "stop faking bugs" in {
      val errText = "__fakebug_test_b__"
      val brokenWebhook = webhook.copy(
            failedSince = Some(When.Genesis),
            lastFailedHow = Some(SendFailedHow.TalkyardBug))(IfBadDie)

      // This means: Fail trice, then start working.
      val req = mkDummyReq(reqNr = 1, errText + " 3")

      // Throws — first time.
      var ex = intercept[RuntimeException] {
        WebhooksSiteDaoMixin.fakeBugImpl(brokenWebhook, req, errText)
      }

      // Throws — retry nr 1.
      ex = intercept[RuntimeException] {
        WebhooksSiteDaoMixin.fakeBugImpl(
              brokenWebhook.copy(retriedNumTimes = Some(1))(IfBadDie),
              req,
              errText)
      }
      ex.getMessage must include(errText)

      // Throws — retry nr 2, 3rd failure in total, incl very first (which wasn't a retry).
      ex = intercept[RuntimeException] {
        WebhooksSiteDaoMixin.fakeBugImpl(
              brokenWebhook.copy(retriedNumTimes = Some(2))(IfBadDie),
              req,
              errText)
      }
      ex.getMessage must include(errText)

      // Shouldn't throw, because retry nr 3 >= 2 = num times to fail.
      WebhooksSiteDaoMixin.fakeBugImpl(
            brokenWebhook.copy(retriedNumTimes = Some(3))(IfBadDie),
            req,  // could:  .copy(retryNr = Some(RetryNr.Automatic(3))),
            errText)
    }
  }

}

