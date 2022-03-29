/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';
import * as fakeweb from '../utils/fakeweb';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

const apiSecret: TestApiSecret = {
  nr: 1,
  userId: c.SysbotUserId,
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSecretKeyFGH678',
};

const webhook: any = {  // : Webhook
  id: 1,
  ownerId: c.AdminsId,
  runAsId: c.SysbotUserId,
  enabled: true,
  descr: "E2e test webhook",
  sendToUrl: 'http://fakeweb:8090/webhooks',
  // sendEventTypes
  // sendEventSubtypes
  apiVersion: '0.0.1',
  //toExtAppVersion:  'Matrix/1.0'  ?
  //sendMaxReqsPerSec?: Nr;
  sendMaxEventsPerReq: 1,
  sendCustomHeaders: {},
  retryMaxSecs: 7,
  //retryExtraTimes
}

const ideaTitle = 'ideaTitle';
const ideaTextOrig = 'ideaTextOrig';


export interface WebhookRetryTestState {
  site: IdAddress;
  forum: TwoCatsTestForum;
  ideaUrlPath?: St;
  nextEventId: Nr;
  brA: TyE2eTestBrowser;
  brB: TyE2eTestBrowser;
}


const testState: Partial<WebhookRetryTestState> = {
  nextEventId: c.StartEventId,
};


export function getTestState(): WebhookRetryTestState {
  return testState as WebhookRetryTestState;
}


export function addWebhooksRetryStartSteps(ps: { postIdeaCheckWebhook?: Bo,
      leaveWebhooksDisabled?: Bo }) {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some Webhooks E2E Test",
      members: ['memah', 'maja']
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

    // Enable API, so can fetch old events. And add a webhook.
    builder.settings({ enableApi: true });
    builder.getSite().apiSecrets = [apiSecret];
    builder.getSite().webhooks = [webhook];
    webhook.enabled = !ps.leaveWebhooksDisabled;

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;
    memah = forum.members.memah;
    memah_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    testState.site = site;
    testState.forum = forum;
    testState.brA = brA;
    testState.brB = brB;
    server.skipRateLimits(site.id);
  });


  it(`Clear saved webhook reqs, in case other old test w same site id`, async () => {
    fakeweb.forgetWebhookReqsTalkyardHasSent(site.id);
    fakeweb.mendWebhooks({ siteId: site.id });
  });


  it(`Owen logs in to admin area, ...`, async () => {
    await owen_brA.adminArea.goToApi(site.origin, { loginAs: owen });
  });


  let webhookUrl;

  it(`There's a webhook already — it got imported`, async () => {
    webhookUrl = await owen_brA.adminArea.apiTab.webhooks.getUrl();
  });

  it(`... Owen adds the site id to the webhook`, async () => {
    await owen_brA.adminArea.apiTab.webhooks.setUrl(webhookUrl + `?siteId=${site.id}`);
    await owen_brA.adminArea.apiTab.webhooks.clickSave();
  });



  it(`Memah arrives`, async () => {
    await memah_brB.go2(site.origin);
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });



  if (ps.postIdeaCheckWebhook) {
    testState.nextEventId = 3;

    it(`Memah posts an idea`, async () => {
      await memah_brB.complex.createAndSaveTopic({ title: ideaTitle, body: ideaTextOrig,
            type: c.TestPageRole.Idea })
      testState.ideaUrlPath = await memah_brB.urlPath();
    });

    it(`Ty sends a webhook req`, async () => {
      await fakeweb.checkNewReq(site.id, { eventType: 'PageCreated', id: 2 });
    });
  }
}
