/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';
import * as fakeweb from '../utils/fakeweb';
import * as webhooksRetryImpl from './webhooks-retry-impl';
import type { WebhookRetryTestState } from './webhooks-retry-impl';
import server from '../utils/server';
import settings from '../utils/settings';
import { makeCreateTypeAction, makeCreatePageAction,
    makeCreateCommentAction } from '../utils/do-api-actions';

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

const categoryAExtId = 'categoryAExtId';

const nextEvent: Partial<Event_> = {
  eventData: {
    page: {},
    post: {},
    pat: {},
  },
};

const citationsTypeParams: UpsertTypeParams = {
                  kindOfType: 'TagType',
                  refId: 'num_citations',
                  dispName: 'Citations',
                  urlSlug: 'num-citations',
                  valueType: 'Int32',
                };
const publYearTypeParams: UpsertTypeParams = {
                  kindOfType: 'TagType',
                  refId: 'publ_year',
                  dispName: 'Year',
                  urlSlug: 'publ-year',
                  valueType: 'Int32',
                };
const kittenMealsTypeParams: UpsertTypeParams = {
                  kindOfType: 'TagType',
                  refId: 'kitten_meals',
                  dispName: 'Kitten Meals',
                  urlSlug: 'kitten-meals',
                  valueType: 'Flt64',
                };
const keywordTypeParams: UpsertTypeParams = {
                  kindOfType: 'TagType',
                  refId: 'some_kwd',
                  dispName: 'Some Keyword',
                  urlSlug: 'some-keyword',
                  valueType: 'StrKwd',
                };
const compSciTypeParams: UpsertTypeParams = {
                  kindOfType: 'TagType',
                  refId: 'comp_sci',
                  dispName: 'Computer Scienec',
                  urlSlug: 'comp-sci',
                };
const physicsTypeParams: UpsertTypeParams = {
                  kindOfType: 'TagType',
                  refId: 'physics',
                  dispName: 'Physics',
                };

const pageOne: CreatePageParams = {
  // id: assigned by the server
  refId: 'page_one_ref_id',
  pageType: 'Discussion' as PageTypeSt, //c.TestPageRole.Idea,
  inCategory: 'rid:' + categoryAExtId,
  // The author won't get notified about this new page.
  //authorRef: 'username:maja',
  title: 'PageOneTitle',
  bodySrc: 'PageOneBody I have two, plus one, plus four, ideas',
  bodyFmt: 'CommonMark',
  withTags: [{
    tagType: 'rid:' + citationsTypeParams.refId,
    valType: 'Int32',
    valInt32: 123,
  }, {
    tagType: 'rid:' + publYearTypeParams.refId,
    valType: 'Int32',
    valInt32: 1990,
  }, {
    tagType: 'rid:' + kittenMealsTypeParams.refId,
    valType: 'Flt64',
    valFlt64: 12.345,
  }, {
    tagType: 'rid:' + keywordTypeParams.refId,
    valType: 'StrKwd',
    valStr: 'Abcd'
  }, {
    tagType: 'rid:' + compSciTypeParams.refId,
  }, {
    tagType: 'rid:' + physicsTypeParams.refId,
  }],
};

const commentOne: CreateCommentParams = {
  refId: 'commentOne refId',
  // postType: c.TestPostType.Normal,
  parentNr: c.BodyNr,
  whatPage: `rid:${pageOne.refId}`,
  // by: `username:memah`,
  bodySrc: 'replyOneBody Hello Maja, such good ideas! So many',
  bodyFmt: 'CommonMark',
  withTags: [{
    tagType: 'rid:' + kittenMealsTypeParams.refId,
    valType: 'Flt64',
    valFlt64: 100.2,
  }, {
    tagType: 'rid:' + keywordTypeParams.refId,
    valType: 'StrKwd',
    valStr: 'CommentNrOne'
  }, {
    tagType: 'rid:' + compSciTypeParams.refId,
  }],
};


// Related test, partly almost the same, but uses the old deprecated upsert-simple API:
//    webhooks-for-api-upserts.2br  TyTE2EWBHK4API
//
describe(`do-api-create-pages-comts-check-webhooks-search.2br  TyTDOAPI_TAGD_PGS_WBHK_SRCH`,
        () => {

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
  });



  // ----- Create page via the Do API, webhook sent

  // Related test:  api-upsert-page-notfs.2br  TyT502RKTLXM296

  let apiResp;

  it("Upsert tag types", async () => {
    apiResp = await server.apiV0.do_({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        doActions: [
            makeCreateTypeAction(citationsTypeParams),
            makeCreateTypeAction(publYearTypeParams),
            makeCreateTypeAction(kittenMealsTypeParams),
            makeCreateTypeAction(keywordTypeParams),
            makeCreateTypeAction(compSciTypeParams),
            makeCreateTypeAction(physicsTypeParams),
        ]},
    });
  });

  it("Create a page", async () => {
    apiResp = await server.apiV0.do_({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        doActions: [
            makeCreatePageAction(
                'username:maja',
                pageOne)
                ],
      },
    });
    /*
    upsertResponse = server.apiV0.upsertSimple({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        upsertOptions: { sendNotifications: true },
        pages: [pageOne],
      },
    }); */
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

  // Related & old deprecated! test:  api-upsert-posts.2br.d  TyT60RKNJF24C

  it("Upsert a reply", async () => {
    apiResp = await server.apiV0.do_({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        doActions: [
            makeCreateCommentAction(
                `username:memah`, commentOne)],
      },
    });
  });

  it(`Ty sends a webhook req about the comment upserted via the API`, async () => {
    (nextEvent as PostCreatedEvent).eventData.post.approvedHtmlSanitized = 'replyOneBody';
    nextEvent.eventType = 'PostCreated';
    await fakeweb.checkNewReq(site.id, nextEvent);
    nextEvent.id += 1;
  });


  // Also:  Close page via API?   TESTS_MISSING  TyTEWHKSAPICLS


});