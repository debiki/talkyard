/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { j2s, logDebugIf } from '../utils/log-and-die';
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
let mysteryCat_brB: TyE2eTestBrowser;

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
const memahsReplySix = 'gkfw96mt euw2gps 20LMmsNMXarxnpSRMRMJ206';
const memahsReplySeven = 'memahsReplySeven';
const memahsReplyEight = 'Mjaooo 11 mice outside the window'; // but cats can count to 10 only
const memahsReplyNine = 'Three lions in the chimney';

const nextEvent: Partial<Event_> = {
  eventData: {
    post: {},
  },
};


/// In this test:  Owen starts and stops a webhook in various ways,
/// and we verify that the right events get sent.
///
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
    mysteryCat_brB = memah_brB; // cat takes control over Memah's laptop
    nextEvent.id = testState.nextEventId;
  });

  it(`Memah posts a problem topic`, async () => {
    await memah_brB.complex.createAndSaveTopic({ title: problemTitle, body: problemBody,
          type: c.TestPageRole.Problem })
    topicUrl = await memah_brB.urlPath();
    nextEvent.id += 1;
  });


  // ----- Start webhook

  // Skips old events.

  it(`Owen enables the webhook — not until now`, async () => {
    await owen_brA.adminArea.apiTab.webhooks.startWebhook();
  });


  it(`Memah replies to herself`, async () => {
    await memah_brB.complex.replyToPostNr(c.BodyNr, memahsReplyOne);
    nextEvent.eventType = 'PostCreated';
    (nextEvent as PostCreatedEvent).eventData.post.approvedHtmlSanitized = memahsReplyOne;
  });

  it(`Just one webhook request gets sent — none for the PageCreated event, from before
          the webhook got enabled   [start_webhook_at_now]`, async () => {
    await fakeweb.checkNewReq(site.id, nextEvent);
    nextEvent.id += 1;
  });

  it(`Memah replies again`, async () => {
    await memah_brB.complex.replyToPostNr(c.FirstReplyNr, memahsReplyTwo);
    (nextEvent as PostCreatedEvent).eventData.post.approvedHtmlSanitized = memahsReplyTwo;
  });

  it(`Another webhook req gets sent`, async () => {
    await fakeweb.checkNewReq(site.id, nextEvent);
    nextEvent.id += 1;
  });


  // ----- Stop, start fresh

  it(`Owen disables the webhook`, async () => {
    await owen_brA.adminArea.apiTab.webhooks.pauseWebhook();
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
    logDebugIf(allReqs.length !== 2, "This'll fail, num webhook reqs !== 2: " + j2s(allReqs));
    assert.eq(allReqs.length, 2);
  });

  it(`Owen clicks Start Fresh — so no webhooks get sent about replies 3 and 4`, async () => {
    await owen_brA.refresh2(); // so the start buttons appear
    await owen_brA.adminArea.apiTab.webhooks.startFresh();
  });

  it(`Memah posts a 5th reply. It's her last — thereafter, her cat, and an unknown cat,
          fall asleep on the keyboard`, async () => {
    await memah_brB.complex.replyToPostNr(c.FirstReplyNr, memahsReplyFive);
    (nextEvent as PostCreatedEvent).eventData.post.approvedHtmlSanitized = memahsReplyFive;
  });

  it(`A webhook req about reply 5 gets sent — but not about 3 and 4`, async () => {
    await fakeweb.checkNewReq(site.id, nextEvent);
    nextEvent.id += 1;
  });


  it(`3 webhook reqs have been sent`, async () => {
    const allReqs = await fakeweb.getWebhookReqsTalkyardHasSent({ siteId: site.id });
    logDebugIf(allReqs.length !== 3, "This'll fail, num webhook reqs !== 3: " + j2s(allReqs));
    assert.eq(allReqs.length, 3);
  });


  // ----- Stop, resume

  it(`Owen pauses the webhook`, async () => {
    await owen_brA.adminArea.apiTab.webhooks.pauseWebhook();
  });

  it(`The unknown cat steps on Memah's keyboard, seemingly at random, and posts a 6th reply.
        This cat is in fact a secret agent, sending encrypted codewords`, async () => {
    await memah_brB.complex.replyToPostNr(c.FirstReplyNr, memahsReplySix);
    // Webhooks paused.
  });

  it(`Owen reloads the page`, async () => {
    await owen_brA.refresh2();
  });

  it(`... sees that the webhook is paused`, async () => {
    assert.that(await owen_brA.adminArea.apiTab.webhooks.isPaused());
    assert.not(await owen_brA.adminArea.apiTab.webhooks.isRunning());
  });

  it(`... lagging after a bit`, async () => {
    assert.that(await owen_brA.adminArea.apiTab.webhooks.lagsAfter());
    assert.not(await owen_brA.adminArea.apiTab.webhooks.allCaughtUp());
  });

  it(`Owen resumes the webhook`, async () => {
    await owen_brA.adminArea.apiTab.webhooks.startWebhook();

    // Now this old message will get sent — the webhook continues where it left off,
    // when clicking Resume:
    (nextEvent as PostCreatedEvent).eventData.post.approvedHtmlSanitized = memahsReplySix;
  });

  it(`A webhook req about reply 6 gets sent — although happened when paused`, async () => {
    await fakeweb.checkNewReq(site.id, nextEvent);
    nextEvent.id += 1;
  });

  it(`Memah posts a 7th reply (the cats are away buying, I mean drinking, milk)`, async () => {
    await memah_brB.complex.replyToPostNr(c.FirstReplyNr, memahsReplySeven);
    (nextEvent as PostCreatedEvent).eventData.post.approvedHtmlSanitized = memahsReplySeven;
  });

  it(`A webhook req about reply 7 gets sent`, async () => {
    await fakeweb.checkNewReq(site.id, nextEvent);
    nextEvent.id += 1;
  });

  it(`Webhook statuses look ok`, async () => {
    await owen_brA.refresh2();
    assert.not(await owen_brA.adminArea.apiTab.webhooks.lagsAfter());
    assert.that(await owen_brA.adminArea.apiTab.webhooks.allCaughtUp());

    assert.not(await owen_brA.adminArea.apiTab.webhooks.isPaused());
    assert.that(await owen_brA.adminArea.apiTab.webhooks.isRunning());
  });

  it(`In total, 5 webhook reqs sent this far`, async () => {
    const allReqs = await fakeweb.getWebhookReqsTalkyardHasSent({ siteId: site.id });
    logDebugIf(allReqs.length !== 5, "This'll fail, num webhook reqs !== 5: " + j2s(allReqs));
    assert.eq(allReqs.length, 5);
  });


  // ----- Stop, skip-to-now, resume

  it(`Owen disables the webhook — he need to think: the random letters, why?`, async () => {
    await owen_brA.adminArea.apiTab.webhooks.pauseWebhook();
  });

  it(`The mystery cat pretends to be just a cat, but too smart for its own good!`, async () => {
    await mysteryCat_brB.complex.replyToPostNr(c.FirstReplyNr, memahsReplyEight);
    nextEvent.id += 1;
  });

  // Skip to now.
  it(`Owen clicks Skip-to-Now, so no webhook sent about reply 8`, async () => {
    await owen_brA.refresh2(); // so the Skip button appears
    await owen_brA.adminArea.apiTab.webhooks.skipToNow();
  });

  it(`Owen resumes the webhook`, async () => {
    await owen_brA.adminArea.apiTab.webhooks.startWebhook();  // not startFresh()
  });

  it(`The mystery cat posts a code words message, but forgets to encrypt it!`, async () => {
    await memah_brB.complex.replyToPostNr(c.FirstReplyNr, memahsReplyNine);
    (nextEvent as PostCreatedEvent).eventData.post.approvedHtmlSanitized = memahsReplyNine;
  });

  it(`A webhook req about reply 9 gets sent — but not about reply 8`, async () => {
    await fakeweb.checkNewReq(site.id, nextEvent);
    nextEvent.id += 1;
  });


  it(`6 webhook reqs have been sent`, async () => {
    const allReqs = await fakeweb.getWebhookReqsTalkyardHasSent({ siteId: site.id });
    logDebugIf(allReqs.length !== 6, "This'll fail, num webhook reqs !== 6: " + j2s(allReqs));
    assert.eq(allReqs.length, 6);
  });


});

