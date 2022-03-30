/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';
import * as fakeweb from '../utils/fakeweb';
import * as webhooksRetryImpl from './webhooks-retry-impl';
import type { WebhookRetryTestState } from './webhooks-retry-impl';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;

let testState: WebhookRetryTestState;

let site: IdAddress;
let forum: TwoCatsTestForum;

const owensReply = 'owensReply';
const memahsReplyOne = 'memahsReplyOne';
const memahsReplyTwo = 'memahsReplyTwo';

const nextEvent: Partial<Event_> = {
  eventData: {
    post: {},
  },
};


describe(`webhooks-retry.2br  TyTE2EWBHKRETRY`, () => {

  webhooksRetryImpl.addWebhooksRetryStartSteps({ postIdeaCheckWebhook: true });

  it(`Init vars for this specific test`, async () => {
    testState = webhooksRetryImpl.getTestState();
    site = testState.site;
    forum = testState.forum;
    owen = forum.members.owen;
    owen_brA = brA = testState.brA;
    memah = forum.members.memah;
    memah_brB = brB = testState.brB;
    nextEvent.id = testState.nextEventId;
  });

  it(`The ext server breaks`, async () => {
    await fakeweb.breakWebhooks({ siteId: site.id, status: 500 });
  });

  it(`Owen replies`, async () => {
    await owen_brA.go2(site.origin + testState.ideaUrlPath);
    await owen_brA.complex.replyToOrigPost(owensReply);
    nextEvent.eventType = 'PostCreated';
    (nextEvent as PostCreatedEvent).eventData.post.approvedHtmlSanitized = owensReply;
  });

  it(`Memah replies to Owen`, async () => {
    await memah_brB.complex.replyToPostNr(c.FirstReplyNr, memahsReplyOne);
  });

  it(`... twice`, async () => {
    await memah_brB.complex.replyToPostNr(c.FirstReplyNr, memahsReplyTwo);
  });

  it(`Ty keeps trying to send webhook reqs about Owen's reply, won't work`, async () => {
    await fakeweb.checkNewReq(site.id, nextEvent, { atLeastHowManyIdentical: 4,
          skipEventId: nextEvent.id - 1  });
  });

  it(`The ext server starts working`, async () => {
    await fakeweb.mendWebhooks({ siteId: site.id });
  });

  it(`Ty retries the webhook about Owen's reply — now it works`, async () => {
    await fakeweb.checkNewReq(site.id, nextEvent, { skipEventId: nextEvent.id - 1,
          // They Ty server might have sent more webhook reqs, whilst the mend-webhook
          // requset was in-flight. So allow >= 1 reqs.
          atLeastHowManyIdentical: 1 });
    nextEvent.id += 1;
  });

  it(`Ty then sends a webhook about Memah's first reply to Owen`, async () => {
    (nextEvent as PostCreatedEvent).eventData.post.approvedHtmlSanitized = memahsReplyOne;
    await fakeweb.checkNewReq(site.id, nextEvent, { skipEventId: nextEvent.id - 1 });
    nextEvent.id += 1;
  });

  it(`... and Memah's 2nd reply`, async () => {
    (nextEvent as PostCreatedEvent).eventData.post.approvedHtmlSanitized = memahsReplyTwo;
    await fakeweb.checkNewReq(site.id, nextEvent, { skipEventId: nextEvent.id - 1 });
    nextEvent.id += 1;
  });



  // TESTS_MISSING [webhook_tests_missing]

  // Webhook starts replying 400 and 500
  // Ty Retries ...
  // Webhook does not start working again — Ty disables it.
  // Admin makes Ty retry,
  // Webhook still broken, Ty stops again directly.
  // Admin makes Ty retry,
  // Webhook works — Ty continues as usual.
  // Webhook starts replying 400 and 500
  // Ty Retries ...
  // Webhook starts working, all fine.


  // Webhook becomes unreachable, connection times out (edit webhook,
  // connect to the wrong port or hostname?)
  // Ty retries ...
  // Webhook starts working again.


  // Webhook takes too long to reply; request times out
  // Ty retries ...
  // Webhook starts working again.


  // Webhook disabled, some events happen
  // Admin enables webhook.
  // Ty won't send events from before it got enabled.
  // Webhook stops working.
  // Admin disables webhook.
  // Webhook starts working.
  // Admin enables webhook.
  // Ty won't send events from before it got enabled.


  // Webhook disabled, some events happen
  // Admin enables webhook.
  // Ty won't send events from before it got enabled.
  // Webhook stops working.
  // Admin disables webhook.
  // Admin enables webhook.
  // Webhook still broken..  <—————————.
  // Webhook starts working.            \
  // Ty retries and resends events from still-broken and on.


  // Custom headers: Basic Auth,  X-3pd-Api-Secret

});