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
import debiki.dao.{DaoAppSuite, TestSiteAndDao, CreateForumResult}
import debiki.dao.DaoAppSuite.Jan2020

import play.api.libs.json.Json


class WebhooksAppSpec extends DaoAppSuite(
        disableScripts = true, disableBackgroundJobs = true) {

  val site1 = new TestSiteAndDao(1, this)
  val site2 = new TestSiteAndDao(2, this)


  lazy val createForumOneResult: CreateForumResult = site1.dao.createForum(
        title = "Forum One", folder = "/forum1/", isForEmbCmts = false,
        Who(SystemUserId, browserIdData)).get

  lazy val createForumTwoResult: CreateForumResult = site1.dao.createForum(
        title = "Forum Two", folder = "/forum2/", isForEmbCmts = false,
        Who(SystemUserId, browserIdData)).get


  // ----- Webhook, site 1

  val site1WebhookA: Webhook = Webhook(
        id = 1001,
        ownerId = Group.AdminsId,
        runAsId = Some(SysbotUserId),
        enabled = true,
        deleted = false,
        descr = Some("This is site1WebhookA — that is, site 1"),
        sendToUrl = "https://somewhere.ex.co/abcde",
        //checkDestCert
        //sendEventTypes
        //sendEventSubTypes
        apiVersion = Some("0.0.1"),
        //sendMaxReqsPerSec
        sendMaxEventsPerReq = None,
        //sendMaxDelaySecs
        sendCustomHeaders = Some(Json.obj("Cust-Hdr-Name" -> "Value")),
        retryMaxSecs = Some(123),
        retryExtraTimes = None,
        sentUpToWhen = When.Genesis,
        sentUpToEventId = None,
        numPendingMaybe = None,
        doneForNow = None,
        )(IfBadDie)

  val site1WebhookAUpdatedOnce: Webhook = site1WebhookA.copy(
        descr = Some("Descr edited"),
        enabled = false,
        deleted = true,
        sendToUrl = "https://somewhere.ex.co/url-edited",
        )(IfBadDie)

  val site1WebhookAUpdatedTwice: Webhook = site1WebhookAUpdatedOnce.copy(
        enabled = true,
        deleted = false,
        sentUpToWhen = Jan2020,
        sentUpToEventId = Some(1456),
        numPendingMaybe = Some(3),
        doneForNow = Some(true),
        )(IfBadDie)

  val site1WebhookB: Webhook = Webhook(
        id = 1002,
        ownerId = Group.AdminsId,
        runAsId = Some(SysbotUserId),
        enabled = false,
        deleted = false,
        descr = Some("This is site1WebhookB, disabled"),
        sendToUrl = "https://elsewhere.ex.co/abcde",
        apiVersion = None,
        sendMaxEventsPerReq = Some(1),
        sendCustomHeaders = None,
        retryMaxSecs = None,
        retryExtraTimes = None,
        sentUpToWhen = When.Genesis,
        sentUpToEventId = None,
        numPendingMaybe = None,
        doneForNow = None,
        )(IfBadDie)


  // ----- Webhook, site 2

  val site2WebhookA: Webhook = site1WebhookA.copy(
        descr = Some("This is site2WebhookA — note: site 2"),
        sendToUrl = "https://for-site-2.example.co",
        )(IfBadDie)


  // ----- Webhook requests

  val sentEvent1001WithHeaders: WebhookReqOut = WebhookReqOut(
        webhookId = site1WebhookB.id,
        reqNr = 1,
        sentAt = Jan2020.plusHours(1001),
        sentAsId = Some(Pat.SysbotUserId),
        sentToUrl = site1WebhookB.sendToUrl,
        sentByAppVer = generatedcode.BuildInfo.dockerTag,
        sentApiVersion = "0.0.1",
        sentEventTypes = Set(PageEventType.PageCreated),
        sentEventIds = Set(1001),
        sentJson = Json.obj("test" -> "event 1001"),
        sentHeaders = Some(Json.obj("Hdr-A" -> "Hdr Value")),
        retryNr = None)

  val sentEvent1001AfterWithHeaders: WebhookReqOut = sentEvent1001WithHeaders.copy(
        respAt = Some(sentEvent1001WithHeaders.sentAt.plusSeconds(1)),
        respStatus = Some(200),
        respBody = Some("All went fine."),
        respHeaders = Some(Json.obj("Resp-Hdr" -> Json.arr("Val 1", "Val 2"))))


  val sentEvents1021To23: WebhookReqOut = WebhookReqOut(
        webhookId = site1WebhookB.id,
        reqNr = 2,
        sentAt = Jan2020.plusHours(1021),
        sentAsId = None,
        sentToUrl = site1WebhookB.sendToUrl,
        sentByAppVer = generatedcode.BuildInfo.dockerTag,
        sentApiVersion = "0.0.1",
        sentEventTypes = Set(PageEventType.PageCreated,
              PageEventType.PageUpdated, PostEventType.PostCreated),
        sentEventIds = Set(1021, 1022, 2013),
        sentJson = Json.obj("test" -> "event 1021, 1022, 1023"),
        sentHeaders = None,
        retryNr = Some(RetryNr.Manual))

  val sentEvent1021To23After: WebhookReqOut = sentEvents1021To23.copy(
        respAt = Some(sentEvents1021To23.sentAt.plusSeconds(1)),
        respStatus = Some(200),
        respBody = Some("All went fine, 3 events processed, test test test."))


  val sentEvent1102WillFail: WebhookReqOut = sentEvent1001WithHeaders.copy(
        reqNr = 3,
        sentAt = Jan2020.plusHours(1102),
        sentEventTypes = Set(PageEventType.PageUpdated),
        sentEventIds = Set(1102),
        sentJson = Json.obj("test" -> "event 1102 will fail w 500 Int Srv Err"),
        sentHeaders = None,
        retryNr = Some(RetryNr.Automatic(123)))

  val sentEvent1102Failed500Resp: WebhookReqOut = sentEvent1102WillFail.copy(
        failedAt = Some(sentEvent1102WillFail.sentAt.plusSeconds(5)),
        failedHow = Some(SendFailedHow.ErrorResponseStatusCode),
        respAt = Some(sentEvent1102WillFail.sentAt.plusSeconds(5)),
        respStatus = Some(500),
        respBody = Some("500 Internal Error"))


  val sentEvent1103WillFail: WebhookReqOut = sentEvent1001WithHeaders.copy(
        reqNr = 4,
        sentAt = Jan2020.plusHours(1103),
        sentEventIds = Set(1103),
        sentJson = Json.obj("test" -> "event 1103 will fail"),
        sentHeaders = None,
        retryNr = None)

  val sentEvent1103CouldntConnect: WebhookReqOut = sentEvent1103WillFail.copy(
        failedAt = Some(sentEvent1103WillFail.sentAt.plusSeconds(5)),
        failedHow = Some(SendFailedHow.CouldntConnect),
        errMsg = Some(o"""My rabbit bit through the network cable, then the power cable.
              Won't happen again"""))


  "The server can save and update webhooks" - {

    "Create test sites and things, try to fail fast" in {
      // This will lazy init. Do in order, so db transactions happen in the right order,
      // and so any init problems get noticed here.
      site1.dao
      site2.dao
    }

    "Save a webhook endpoint, site 1" in {
      site1.dao.writeTx { (tx, _) =>
        tx.upsertWebhook(site1WebhookA)
      }
    }

    "Save a webhook endpoint, site 2" in {
      site2.dao.writeTx { (tx, _) =>
        tx.upsertWebhook(site2WebhookA)
      }
    }


    "Save another webhook endpoint, site 1 again" in {
      site1.dao.writeTx { (tx, _) =>
        tx.upsertWebhook(site1WebhookB)
      }
    }

    "Now there are two webhooks in site 1" in {
      site1.dao.readTx { tx =>
        val webhooks = tx.loadAllWebhooks()
        webhooks.length mustBe 2
        webhooks(0) mustEqual site1WebhookA
        webhooks(1) mustEqual site1WebhookB
      }
    }

    "... and one in site 2" in {
      site2.dao.readTx { tx =>
        val webhooks = tx.loadAllWebhooks()
        webhooks.length mustBe 1
        webhooks(0) mustEqual site2WebhookA
      }
    }


    "Update a webhook" in {
      site1.dao.writeTx { (tx, _) =>
        tx.upsertWebhook(site1WebhookAUpdatedOnce)
      }
    }


    "Update a webhook twice" in {
      site1.dao.writeTx { (tx, _) =>
        tx.upsertWebhook(site1WebhookAUpdatedTwice)
      }
    }

    "The correct webhook got updated" in {
      site1.dao.readTx { tx =>
        val webhooks = tx.loadAllWebhooks()
        webhooks.length mustBe 2
        webhooks(0) mustEqual site1WebhookAUpdatedTwice
        webhooks(1) mustEqual site1WebhookB
      }
    }

    "... not any webhook in site 2" in {
      site2.dao.readTx { tx =>
        val webhooks = tx.loadAllWebhooks()
        webhooks.length mustBe 1
        webhooks(0) mustEqual site2WebhookA
      }
    }

  }


  "The server can save and update webhook requests sent" - {

    "Save a webhook request sent" in {
      site1.dao.writeTx { (tx, _) =>
        tx.insertWebhookReqOut(sentEvent1001WithHeaders)
      }
    }

    "Save a webhook request sent, with 3 events" in {
      site1.dao.writeTx { (tx, _) =>
        tx.insertWebhookReqOut(sentEvents1021To23)
      }
    }

    "Now there are two webhook requests" in {
      site1.dao.readTx { tx =>
        info("The loadWebhookReqsOutRecentFirst(limit = ...) param works fine")
        tx.loadWebhookReqsOutRecentFirst(1).length mustBe 1 // there are 2
        info("Loading all webhooks")
        val reqs = tx.loadWebhookReqsOutRecentFirst(99)
        reqs.length mustBe 2
        reqs(0) mustEqual sentEvents1021To23
        reqs(1) mustEqual sentEvent1001WithHeaders
      }
    }

    "Update the first request, once a response has arrived" in {
      site1.dao.writeTx { (tx, _) =>
        tx.updateWebhookReqOutWithResp(sentEvent1001AfterWithHeaders)
      }
    }

    "Update the 2nd webhook request sent (the one with 3 events)" in {
      site1.dao.writeTx { (tx, _) =>
        tx.updateWebhookReqOutWithResp(sentEvent1021To23After)
      }
    }

    "The two webhook requests got updated" in {
      site1.dao.readTx { tx =>
        val reqs = tx.loadWebhookReqsOutRecentFirst(99)
        reqs.length mustBe 2
        info("The 3 events response looks fine")
        reqs(0) mustEqual sentEvent1021To23After
        info("The 1 event response looks fine, incl headers")
        reqs(1) mustEqual sentEvent1001AfterWithHeaders
      }
    }

    "Save two webhook request sent, which will fail" in {
      site1.dao.writeTx { (tx, _) =>
        tx.insertWebhookReqOut(sentEvent1102WillFail)
        tx.insertWebhookReqOut(sentEvent1103WillFail)
      }
    }

    "Update the first failed request: 500 Internal Error response" in {
      site1.dao.writeTx { (tx, _) =>
        tx.updateWebhookReqOutWithResp(sentEvent1102Failed500Resp)
      }
    }

    "Update the 2nd failed request: Couldn't send it at all" in {
      site1.dao.writeTx { (tx, _) =>
        tx.updateWebhookReqOutWithResp(sentEvent1103CouldntConnect)
      }
    }

    "There are now four webhook requests" in {
      site1.dao.readTx { tx =>
        val reqs = tx.loadWebhookReqsOutRecentFirst(99)
        reqs.length mustBe 4
        reqs(0) mustEqual sentEvent1103CouldntConnect
        reqs(1) mustEqual sentEvent1102Failed500Resp
        reqs(2) mustEqual sentEvent1021To23After
        reqs(3) mustEqual sentEvent1001AfterWithHeaders
      }
    }
  }

}
