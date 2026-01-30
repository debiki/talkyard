/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import assert from '../utils/ty-assert';
import c from '../test-constants';
import * as fakeweb from '../utils/fakeweb';
import * as webhooksRetryImpl from './webhooks-retry-impl';
import type { WebhookRetryTestState } from './webhooks-retry-impl';
import server from '../utils/server';
import settings from '../utils/settings';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;

let testState: WebhookRetryTestState;

let site: IdAddress;
let forum: TwoCatsTestForum;
let apiSecret: TestApiSecret;

let upsSimpleParams;

const categoryAExtId = 'categoryAExtId';

const nextEvent: Partial<Event_> = {
  eventData: {
    page: {},
    post: {},
    pat: {},
  },
};


const pageOne = {
  // id: assigned by the server
  extId: 'page_one_ext_id',
  pageType: c.TestPageRole.Idea,
  categoryRef: 'extid:' + categoryAExtId,
  // The author won't get notified about this new page.
  authorRef: 'username:maja',
  title: 'PageOneTitle',
  body: 'PageOneBody I have two, plus one, plus four, ideas',
};

const replyOne = {
  extId: 'replyOne extId',
  postType: c.TestPostType.Normal,
  parentNr: c.BodyNr,
  pageRef: `extid:${pageOne.extId}`,
  authorRef: `username:memah`,
  body: 'replyOneBody Hello Maja, such good ideas! So many',
};

const body700k = 'BigPageBody_700k_chars-' + 'o'.repeat(700_000 - 32);
// Subtracting 3 chars because of "<p>" in the beginning of the html,  250 * 1000 - 3 = 249997.
const body249997 = body700k.substring(0, 250 * 1000 - 3);

// The webhook request json body is max 500k bytes, so this 700k page is too big to fit
// in Talkyard's webhook request. In fact, most 250KB is sent [max_webhook_text_bytes]
const bigPage700K = {
  extId: 'big_page_700k',
  pageType: c.TestPageRole.Question,
  categoryRef: 'extid:' + categoryAExtId,
  authorRef: 'username:maja',
  title: 'BigPageTitle',
  body: body700k,
}


describe(`webhooks-for-api-upserts.2br  TyTE2EWBHK4API`, () => {

  if (settings.prod) {
    console.log("Skipping this spec — the server needs to have upsert conf vals enabled."); // E2EBUG
    return;
  }

  webhooksRetryImpl.addWebhooksRetryStartSteps({ genApiSecret: true, categoryAExtId });

  it(`Init vars for this specific test`, async () => {
    testState = webhooksRetryImpl.getTestState();
    site = testState.site;
    forum = testState.forum;
    apiSecret = testState.apiSecret;
    owen = forum.members.owen;
    owen_brA = brA = testState.brA;
    memah = forum.members.memah;
    memah_brB = brB = testState.brB;
    nextEvent.id = testState.nextEventId;

    upsSimpleParams = {
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
    };
  });



  // ----- Upsert page via API, webhook sent

  // Related test:  api-upsert-page-notfs.2br  TyT502RKTLXM296

  let upsertResponse;

  it("Upsert a page", async () => {
    upsertResponse = server.apiV0.upsertSimple({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        upsertOptions: { sendNotifications: true },
        pages: [pageOne],
      },
    });
  });

  it(`Ty sends a webhook req about the page upserted via the API`, async () => {
    nextEvent.eventType = 'PageCreated';

    const origPost: Partial<PostWrappedInPage> = {
      approvedHtmlSanitized: 'PageOneBody',
    };
    (nextEvent as PageCreatedEvent).eventData.page.posts = [origPost as PostWrappedInPage];

    await fakeweb.checkNewReq(site.id, nextEvent);

    delete (nextEvent as PageCreatedEvent).eventData.page.posts;
    nextEvent.id += 1;
  });



  // ----- Upsert comment via API, webhook sent

  // Related test:  api-upsert-posts.2br.d  TyT60RKNJF24C

  it("Upsert a reply", async () => {
    upsertResponse = server.apiV0.upsertSimple({
      ...upsSimpleParams,
      data: {
        upsertOptions: { sendNotifications: true },
        posts: [replyOne],
      },
    });
  });

  it(`Ty sends a webhook req about the page upserted via the API`, async () => {
    (nextEvent as PostCreatedEvent).eventData.post.approvedHtmlSanitized = 'replyOneBody';
    nextEvent.eventType = 'PostCreated';
    await fakeweb.checkNewReq(site.id, nextEvent);
    nextEvent.id += 1;
  });



  // ----- Too long pages get truncated

  // Later: Or rejected, depending on server settings.  [page_api_limits]

  // Related test:  api-upsert-page-notfs.2br  TyT502RKTLXM296

  it("Upsert a BIG 700 KB page", async () => {
    upsertResponse = server.apiV0.upsertSimple({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        upsertOptions: { sendNotifications: true },
        pages: [bigPage700K],
      },
    });
  });

  it(`Ty sends a webhook req. Page text truncated to 250k [max_webhook_text_bytes]`, async () => {
    nextEvent.eventType = 'PageCreated';

    const origPost: Partial<PostWrappedInPage> = {
      approvedHtmlSanitized: body249997,
    };
    (nextEvent as PageCreatedEvent).eventData.page.posts = [origPost as PostWrappedInPage];

    const lastEvent: PageCreatedEvent =
            await fakeweb.checkNewReq(site.id, nextEvent) as PageCreatedEvent;

    assert.that(
            lastEvent.eventData.page.posts[0].approvedHtmlSanitized.length
            <= 250 * 1000);

    delete (nextEvent as PageCreatedEvent).eventData.page.posts;
    nextEvent.id += 1;
  });



  // ----- Too long comments get truncated

  // TESTS_MISSING



  // Also:  Close page via API?   TESTS_MISSING  TyTEWHKSAPICLS


});
