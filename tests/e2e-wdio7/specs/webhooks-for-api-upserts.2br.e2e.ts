/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
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

  it("Upsert a page", () => {
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



  // ----- Upsert post via API, webhook sent

  // Related test:  api-upsert-posts.d.2br  TyT60RKNJF24C

  it("Upsert a reply", () => {
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



  // Also:  Close page via API?   TESTS_MISSING  TyTEWHKSAPICLS


});