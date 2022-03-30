/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from './ty-assert';
import { j2s, logMessage, dieIf, logExtSrvResp, logExtSrvRespVerb, logExtServerRequest,
        } from './log-and-die';
import axios from 'axios';


const fakewebOrigin = 'http://localhost:8090';

let numHandled = 0;



export async function checkNewReq(siteId: SiteId, expectedEvent: Partial<Event_>,
      opts: { atLeastHowManyIdentical?: Nr, skipEventId?: Nr, answered?: Bo } = {}) {

  const reqs: WebhookReq[] = await waitForMoreTalkyardWebhookReqs(siteId, {
        howManyMore: opts.atLeastHowManyIdentical, skipEventId: opts.skipEventId });

  if (opts.atLeastHowManyIdentical) {
    assert.that(reqs.length >= opts.atLeastHowManyIdentical || 1);
  }
  else {
    assert.eq(reqs.length, 1, "reqs.length");
  }

  for (let req of reqs) {
    assert.ok(req.events);
    assert.eq(req.events.length, 1, "events.length");
    const actualEvent = req.events[0];
    assert.eq(actualEvent.eventType, expectedEvent.eventType, "event type");
    assert.eq(actualEvent.id, expectedEvent.id, "event id");
    switch (expectedEvent.eventType) {
      case 'PageCreated': {
        const actEv = actualEvent as PageCreatedEvent;
        const expEv = expectedEvent as PageCreatedEvent;
        if (expEv.eventData?.page?.posts?.[0]?.approvedHtmlSanitized) {
          assert.includes(
                actEv.eventData.page.posts[0].approvedHtmlSanitized,
                expEv.eventData.page.posts[0].approvedHtmlSanitized);
        }
        break;
      }
      case 'PageUpdated': {
        const actEv = actualEvent as PageUpdatedEvent;
        const expEv = expectedEvent as PageUpdatedEvent;
        !expEv.eventData?.page?.closedStatus || assert.eq(
              actEv.eventData.page.closedStatus,
              expEv.eventData.page.closedStatus);

        if (!_.isUndefined(opts.answered)) {
          // We don't know what the post id is, though.
          assert.eq(opts.answered, !!actEv.eventData.page.answerPostId);
        }

        break;
      }
      case 'PostCreated': {
        const actEv = actualEvent as PostCreatedEvent;
        const expEv = expectedEvent as PostCreatedEvent;
        assert.includes(
              actEv.eventData.post.approvedHtmlSanitized,
              expEv.eventData.post.approvedHtmlSanitized);
        break;
      }
      case 'PatCreated': {
        const actEv = actualEvent as PatCreatedEvent;
        const expEv = expectedEvent as PatCreatedEvent;
        assert.eq(actEv.eventData.pat.username, expEv.eventData.pat.username);
        break;
      }
      default:
        // Noop, for now.
    }
  }
}



export async function getWebhookReqsTalkyardHasSent(params: { siteId: SiteId })
      : Pr<WebhookReq[]> {
  // For now:
  logExtServerRequest(`Calling /list-webhook-reqs`);
  const resp = await axios.get(fakewebOrigin + `/list-webhook-reqs`, { params });
  logExtSrvResp(`resp.status: ${resp.status} ${resp.statusText}`);
  logExtSrvResp(`resp.headers: ${j2s(resp.headers)}`);
  logExtSrvResp(`resp.data: ${j2s(resp.data)}`);
  dieIf(resp.status !== 200, `Bad response HTTP status, not 200: ${resp.status}\n` +
        `resp body:\n${JSON.stringify(resp.data)}`);
  dieIf(!resp.data, 'TyE70MWEJXS0');
  dieIf(!resp.data.webhookReqs, 'No webhookReqs obj in response [TyE70MWEJXS4]')
  logExtSrvResp(`Got back ${resp.data.webhookReqs.length} webhook reqs from fakeweb.`);
  return resp.data.webhookReqs;
}


export interface WebhookReq {
  origin: St;
  events: Event_[];
}


// For now
const settings = { waitforTimeout: 3600 * 1000 };


/// Returns webhook requests, at least opts.howManyMore or 1, all of them
/// about one specific event. But skips the next events about opts.skipEventId
/// — which suppposedly have been handled already by the test suite.
///
export async function waitForMoreTalkyardWebhookReqs(siteId: SiteId,
        opts: { howManyMore?: Nr, skipEventId?: Nr } = {})
        : Pr<WebhookReq[]> {

  const howManyMore = opts.howManyMore || 1;
  let interval = 300;

  for (let attemptNr = 1; attemptNr <= settings.waitforTimeout / interval; ++attemptNr) {
    if (attemptNr >= 2) {
      await wdioBrowserA.pause(interval - 50); // 50 ms for a request, perhaps?
      interval = Math.min(3300, interval * 1.5);  // exp backoff, or fills terminal output win
    }

    // Could tell fakeweb to not return the first numHandled requests — otherwise
    // (as things are now), when logging the requests, they can fill the terminal output win.
    const reqs = await getWebhookReqsTalkyardHasSent({ siteId });
    if (!reqs?.length) {
      logMessage(`No webhook requests at all, waiting ...`);
      continue;
    }

    const numNew = reqs.length - numHandled;
    logMessage(
          (numNew === 0
              ? "No new webhook requests, waiting; "
              : `${numNew} new webhook requests, `) +
          `skipEventId: ${opts.skipEventId}, numHandled: ${numHandled} ...`);

    if (!numNew)
      continue;

    // startIx will be the index of the first request about a new event,
    // and endIx will be one past the last request about that same event.
    // (The Ty server sends the same event, retries many times, on errors.)
    let startIx = numHandled;
    let startEventId: Nr = -1;
    for (; startIx < reqs.length; startIx += 1) {
      const req = reqs[startIx];
      if (req.events[0].id === opts.skipEventId) {
        logMessage(`Skipping req at ix ${startIx} about event id ${opts.skipEventId}.`);
      }
      else {
        startEventId = req.events[0].id;
        logMessage(`New reqs at startIx: ${startIx} about event id ${startEventId}.`);
        break;
      }
    }

    let endIx = startIx + 1;
    while (true) {
      if (endIx >= reqs.length) {
        logMessage(`No subsequent reqs about other more recent events`);
        break;
      }
      const req = reqs[endIx];
      if (req.events[0].id !== startEventId) {
        logMessage(`At endIx: ${endIx} there's a req about another event, id ${
              req.events[0].id} — will skip, this time`);
        break;
      }
      endIx += 1;
    }

    const numAboutStartEventId = endIx - startIx;
    const numMissing = howManyMore - numAboutStartEventId;

    logMessage(`Done looking at new reqs: skipEventId: ${opts.skipEventId
          }, startEventId: ${startEventId
          }, numAboutStartEventId: ${numAboutStartEventId
          }, startIx: ${startIx}, endIx: ${endIx}`);

    // (If startEventId === -1, all new events were opts.skipEventId.)
    if (startEventId === -1 || numMissing >= 1) {
      const msg = howManyMore === 1
            ? `Waiting for one webhook req`
            : `Waiting for ${numMissing} out of ${howManyMore} expected reqs`
      logMessage(msg + ` about event id ${startEventId}`);
    }
    else {
      const newReqs = reqs.slice(startIx, endIx);
      numHandled = endIx;
      logMessage(`Returning ${newReqs.length} new webhook requests about event id ${
            startEventId}.`);
      return newReqs;
    }
  }
}


export async function forgetWebhookReqsTalkyardHasSent(params: { siteId: SiteId }) {
  logExtServerRequest(`Telling fakemail to forget old webhook reqs: ${j2s(params)}`);
  // Dupl code, here and below.
  const resp = await axios.post(fakewebOrigin + `/clear-webhook-reqs`, {}, { params });
  logExtSrvRespVerb(`resp.status: ${resp.status} ${resp.statusText}`);
  if (resp.data) logExtSrvRespVerb(`resp.data: ${j2s(resp.data)}`);
  dieIf(resp.status !== 200, `Bad fakeweb response HTTP status, not 200: ${resp.status}`);
}


export async function breakWebhooks(params: { siteId: SiteId, status: Nr }) {
  logExtServerRequest(`Telling fakemail to break webhooks: ${j2s(params)}`);
  // Dupl code, here and above and below.
  const resp = await axios.post(fakewebOrigin + `/break-webhooks`, {}, { params });
  logExtSrvRespVerb(`resp.status: ${resp.status} ${resp.statusText}`);
  if (resp.data) logExtSrvRespVerb(`resp.data: ${j2s(resp.data)}`);
  dieIf(resp.status !== 200, `Bad fakeweb response HTTP status, not 200: ${resp.status}`);
}


export async function mendWebhooks(params: { siteId: SiteId }) {
  logExtServerRequest(`Telling fakemail to mend webhooks: ${j2s(params)}`);
  // Dupl code, here and above.
  const resp = await axios.post(fakewebOrigin + '/mend-webhooks', {}, { params });
  logExtSrvRespVerb(`resp.status: ${resp.status} ${resp.statusText}`);
  if (resp.data) logExtSrvRespVerb(`resp.data: ${j2s(resp.data)}`);
  dieIf(resp.status !== 200, `Bad fakeweb response HTTP status, not 200: ${resp.status}`);
}
