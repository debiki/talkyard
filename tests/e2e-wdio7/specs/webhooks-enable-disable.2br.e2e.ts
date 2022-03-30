/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { j2s } from '../utils/log-and-die';
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

let topicUrl: St | U;
const problemTitle = 'problemTitle';
const problemBody = 'problemBody';

const memahsReplyOne = 'memahsReplyOne';
const memahsReplyTwo = 'memahsReplyTwo';
const memahsReplyThree = 'memahsReplyThree';
const memahsReplyFour = 'memahsReplyFour';
const memahsReplyFive = 'memahsReplyFive';

const nextEvent: Partial<Event_> = {
  eventData: {
    post: {},
  },
};


describe(`webhooks-enable-disable.2br  TyTE2EWBHKENADIS`, () => {

  webhooksRetryImpl.addWebhooksRetryStartSteps({ leaveWebhooksDisabled: true });

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

  it(`Memah posts a problem topic`, async () => {
    await memah_brB.complex.createAndSaveTopic({ title: problemTitle, body: problemBody,
          type: c.TestPageRole.Problem })
    topicUrl = await memah_brB.urlPath();
    nextEvent.id += 1;
  });


  it(`Owen enables the webhook — not until now`, async () => {
    await owen_brA.adminArea.apiTab.webhooks.setEnabled(true);
    await owen_brA.adminArea.apiTab.webhooks.clickSave();
  });


  it(`Memah replies to herself`, async () => {
    await memah_brB.complex.replyToPostNr(c.BodyNr, memahsReplyOne);
    nextEvent.eventType = 'PostCreated';
    (nextEvent as PostCreatedEvent).eventData.post.approvedHtmlSanitized = memahsReplyOne;
  });

  it(`Just one webhook request gets sent — none for the PageCreated event, from before
          the webhook got enabled`, async () => {
    await fakeweb.checkNewReq(site.id, nextEvent, { skipEventId: nextEvent.id - 1 });
    nextEvent.id += 1;
  });

  it(`Memah replies again`, async () => {
    await memah_brB.complex.replyToPostNr(c.FirstReplyNr, memahsReplyTwo);
    (nextEvent as PostCreatedEvent).eventData.post.approvedHtmlSanitized = memahsReplyTwo;
  });

  it(`Another webhook req gets sent`, async () => {
    await fakeweb.checkNewReq(site.id, nextEvent, { skipEventId: nextEvent.id - 1 });
    nextEvent.id += 1;
  });

  it(`Owen disables the webhook`, async () => {
    await owen_brA.adminArea.apiTab.webhooks.setEnabled(false);
    await owen_brA.adminArea.apiTab.webhooks.clickSave();
  });

  it(`Memah just cannot stop typing. She replies a 3rd time and a 4th`, async () => {
    await memah_brB.complex.replyToPostNr(c.FirstReplyNr, memahsReplyThree);
    nextEvent.id += 1;
    await memah_brB.complex.replyToPostNr(c.FirstReplyNr, memahsReplyFour);
    nextEvent.id += 1;
  });

  it(`... but no webhook requests get sent; the webhook is disabled`, async () => {
    // This is just an extra test, makes it simpler to debug.
    // There's a race: this test might run before any webhook reqs get sent, but
    // probably not. — But the memahsReplyFive test below would then always fail, for sure.
    const allReqs = await fakeweb.getWebhookReqsTalkyardHasSent({ siteId: site.id });
    assert.eq(allReqs.length, 2);
  });

  it(`Owen enables the webhook`, async () => {
    await owen_brA.adminArea.apiTab.webhooks.setEnabled(true);
    await owen_brA.adminArea.apiTab.webhooks.clickSave();
  });

  it(`Memah posts a 5th reply. It's her last — thereafter, her cat, and an unknown cat,
          fall asleep on the keyboard`, async () => {
    await memah_brB.complex.replyToPostNr(c.FirstReplyNr, memahsReplyFive);
    (nextEvent as PostCreatedEvent).eventData.post.approvedHtmlSanitized = memahsReplyFive;
  });

  it(`A webhook req about reply 5 gets sent — but not about 3 and 4`, async () => {
    await fakeweb.checkNewReq(site.id, nextEvent, { skipEventId: nextEvent.id - 1 });
    nextEvent.id += 1;
  });


  it(`In total, 3 webhook reqs got sent:`, async () => {
    const allReqs = await fakeweb.getWebhookReqsTalkyardHasSent({ siteId: site.id });
    console.log("Webhook reqs: " + j2s(allReqs));
    assert.eq(allReqs.length, 3);
  });

});