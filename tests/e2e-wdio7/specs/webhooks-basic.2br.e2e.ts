/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { dieIf, j2s } from '../utils/log-and-die';
import c from '../test-constants';
import * as fakeweb from '../utils/fakeweb';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let mei: Member;
let mei_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

let webhBasicQuUrl: St | U;
const webhBasicQuTitle = 'webhBasicQuTitle';
const webhBasicQuBodyOrig = 'webhBasicQuBodyOrig';
const webhBasicQuBodyEdited = 'webhBasicQuBodyEdited';
const webhBasicQuAnsOrig = 'webhBasicQuAnsOrig';
const webhBasicQuAnsEdited = 'webhBasicQuAnsEdited';


const nextEvent: Partial<Event_> = {
  id: c.StartEventId,
  eventData: {
    page: {},
    post: {},
    pat: {},
  },
};


describe(`webhooks-basic.2br  TyTE2EWBHKBASIC`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Basic Webhooks E2E Test",
      members: undefined, // default = everyone
        // ['mons', 'modya', 'regina', 'corax', 'memah', 'maria', 'michael', 'mallory']
    });

    // Disable notifications, or notf email counts will be off
    // (since Owen would get emails).
    builder.settings({
      numFirstPostsToApprove: 0,
      //maxPostsPendApprBefore: 0,
      numFirstPostsToReview: 0,
    });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    // Enable API, so can configure webhooks.
    builder.settings({ enableApi: true });

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;
    mei = make.memberMei();
    mei_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });

  it(`Clear saved webhook reqs, in case other old test w same site id`, async () => {
    fakeweb.forgetWebhookReqsTalkyardHasSent({ siteId: site.id });
  });


  it(`Owen logs in to admin area, ... `, async () => {
    await owen_brA.adminArea.goToApi(site.origin, { loginAs: owen });
  });


  it(`Owen configures a webhook endpoint`, async () => {
    await owen_brA.adminArea.apiTab.webhooks.setUrl(
          'http://fakeweb:8090/webhooks?siteId=' + site.id);
    await owen_brA.adminArea.apiTab.webhooks.setEnabled(true);
  });

  it(`... saves`, async () => {
    await owen_brA.adminArea.apiTab.webhooks.clickSave();
  });



  it(`Mei signs up`, async () => {
    await mei_brB.go2(site.origin);
    await mei_brB.complex.signUpAsMemberViaTopbar(mei);
  });
  it("... verifies her email", async () => {
    const url = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(
            site.id, mei.emailAddress);
    await mei_brB.go2(url);
    await mei_brB.hasVerifiedSignupEmailPage.clickContinue();
  });

  it(`Ty sends a webhook req about Mei having joined`, async () => {
    nextEvent.eventType = 'PatCreated';
    (nextEvent.eventData as any).pat = { username: mei.username };
    await fakeweb.checkNewReq(site.id, nextEvent);
    (nextEvent.eventData as any).pat = {};
    nextEvent.id += 1;
  });



  it(`Mei posts a question`, async () => {
    await mei_brB.complex.createAndSaveTopic({ title: webhBasicQuTitle,
          body: webhBasicQuBodyOrig, type: c.TestPageRole.Question })
    webhBasicQuUrl = await mei_brB.urlPath();
  });

  it(`Ty sends a webhook req`, async () => {
    nextEvent.eventType = 'PageCreated';

    const origPost: Partial<PostWrappedInPage> = {
      approvedHtmlSanitized: webhBasicQuBodyOrig,
    };
    (nextEvent as PageCreatedEvent).eventData.page.posts = [origPost as PostWrappedInPage];

    await fakeweb.checkNewReq(site.id, nextEvent, { answered: false });
    delete (nextEvent as PageCreatedEvent).eventData.page.posts;
    nextEvent.id += 1;
  });



  it(`Owen replies`, async () => {
    await owen_brA.go2(webhBasicQuUrl);
    await owen_brA.complex.replyToOrigPost(webhBasicQuAnsOrig);
  });

  it(`Ty sends a webhook req`, async () => {
    nextEvent.eventType = 'PostCreated';
    (nextEvent as PostCreatedEvent).eventData.post.approvedHtmlSanitized = webhBasicQuAnsOrig;
    await fakeweb.checkNewReq(site.id, nextEvent);
    nextEvent.id += 1;
  });



  it(`Mei accepts the answer — this closes the question`, async () => {
    await mei_brB.refresh2();
    await mei_brB.topic.selectPostNrAsAnswer(c.FirstReplyNr);
  });

  it(`Ty sends a webhook req — now the page is answered, got closed`, async () => {
    nextEvent.eventType = 'PageUpdated';
    (nextEvent as PageUpdatedEvent).eventData.page.closedStatus = 'Closed';
    await fakeweb.checkNewReq(site.id, nextEvent, { answered: true });
    nextEvent.id += 1;
  });


  it(`Owen edits the reply`, async () => {
    await owen_brA.complex.editPostNr(c.FirstReplyNr, webhBasicQuAnsEdited);
  });

  it(`Ty sends a webhook req`, async () => {
    nextEvent.eventType = 'PostUpdated';
    (nextEvent as PostUpdatedEvent).eventData.post.approvedHtmlSanitized = webhBasicQuAnsEdited;
    await fakeweb.checkNewReq(site.id, nextEvent);
    nextEvent.id += 1;
  });



  it(`Mei edits the question`, async () => {
    await mei_brB.complex.editPageBody(webhBasicQuBodyEdited);
  });

  it(`Ty sends a webhook req`, async () => {
    (nextEvent as PostUpdatedEvent).eventData.post.approvedHtmlSanitized = webhBasicQuBodyEdited;
    await fakeweb.checkNewReq(site.id, nextEvent);
    nextEvent.id += 1;
  });


  it(`In total, 6 webhook reqs received:`, async () => {
    const allReqs = await fakeweb.getWebhookReqsTalkyardHasSent({ siteId: site.id });
    console.log("Webhook reqs: " + j2s(allReqs));
    assert.eq(allReqs.length, 6);
  });

});

