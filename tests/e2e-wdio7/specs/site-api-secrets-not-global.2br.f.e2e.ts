/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { makeVoteAction } from '../utils/do-api-actions';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import { logBoring } from '../utils/log-and-die';
import c from '../test-constants';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

let mariasPageUrl: St;
const mariasPageExtId = 'mariasPageExtId';

const apiSecret: TestApiSecret = {
  nr: 1,
  userId: c.SysbotUserId,
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSysbotSecretAbc789',
};


describe(`site-api-secrets-not-global.2br.f  TyTSITESECR0GLOB`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Site or System Secret E2E Test",
      members: ['maria', 'michael']
    });
    // Enable API.
    builder.settings({ enableApi: true });
    builder.getSite().apiSecrets = [apiSecret];

    // So we can interact with this page via the API.
    builder.updatePage(forum.topics.byMariaCatA.id, (page: PageToAdd) => {
      page.extId = mariasPageExtId;
    });

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria_brB = brB;
    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
    mariasPageUrl = site.origin + '/' + forum.topics.byMariaCatA.slug;
  });



  it(`Maria goes to her page (doesn't log in)`, async () => {
    await maria_brB.go2(mariasPageUrl);
    // Can skip:
    // await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });

  // ----- Ttt: The Do API works?

  let apiResp;

  it(`Owen likes Maria's page — via a Do API secret  ttt`, async () => {
    apiResp = await server.apiV0.do_({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        doActions: [
              makeVoteAction(
                  'userid:' + owen.id, {
                    whatPage: 'pageid:' + forum.topics.byMariaCatA.id,
                    voteType: 'Like', howMany: 1 })],
      },
    });
  });

  it(`It works, Maria sees the Like vote  ttt`, async () => {
    await maria_brB.refresh2();
    await maria_brB.waitForMyDataAdded();
    assert.that(await maria_brB.topic.isPostLiked(c.BodyNr));  // ttt
  });


  // ----- Ttt: The Maintenance API works?

  it(`There's no under-maintenance message  ttt`, async () => {
    await maria_brB.waitForExist('.c_SrvAnns');
    assert.not(await maria_brB.isDisplayed('.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt'));
  });

  it(`A server admin starts maintenance mode, using an API secret
          in a server config file  ttt`, async () => {
    const resp = await server.apiV0.planMaintenance({ origin: site.origin,
        basicAuthUsername: 'sysmaint', apiSecret: 'test_sysmaint_api_secret',
        data: {
            maintenanceUntilUnixSecs: 1,
            maintWordsHtml: `Maint_mode_ok`,
            maintMessageHtml: `<h1>Maint_mode_ok</h1>` }});
    logBoring(`server.apiV0.planMaintenance() says: ` + resp);
  });

  it(`Maria sees the maint message  ttt`, async () => {
    await maria_brB.refresh2();
    await maria_brB.waitUntilAnyTextMatches(
          '.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt', /Maint_mode_ok/, { refreshBetween: true });
  });


  // ----- Try using a real API secret, but the wrong one  TyTMAINTSECR

  let maintRespText: St;

  it(`Owen tries to edit the maint message, using the same *per site* API secret`,
          async () => {
    maintRespText = await server.apiV0.planMaintenance({ origin: site.origin,
        basicAuthUsername: 'talkyardId=' + c.SysbotUserId,
        apiSecret: apiSecret.secretKey, // 'test_sysmaint_api_secret',
        fail: true,   // fok
        data: {
            maintenanceUntilUnixSecs: 1,
            maintWordsHtml: `Maint_mode_BAD_EDITED`,
            maintMessageHtml: `<h1>Maint_mode_BAD_EDITED</h1>` }});
    logBoring(`server.apiV0.planMaintenance() says: ` + maintRespText);
  });

  it(`... the server sent back error code TyEBASAUN_UN_`, async () => {
    assert.includes(maintRespText, 'TyEBASAUN_UN_');
  });
  it(`... and says that this endpoint is for user 'sysmaint'`, async () => {
    assert.includes(maintRespText, `'sysmaint'`);
  });


  it(`Someone else tries, using the email webhooks API secret`,
          async () => {
    // The correct username-password, but for the *wrong* endpoint.
    maintRespText = await server.apiV0.planMaintenance({ origin: site.origin,
        basicAuthUsername: 'emailwebhooks',
        apiSecret: 'publicEmailWebhooksApiTestSecret',
        fail: true,
        data: {
            maintenanceUntilUnixSecs: 1,
            maintWordsHtml: `Maint_mode_BAD_EDITED`,
            maintMessageHtml: `<h1>Maint_mode_BAD_EDITED</h1>` }});
    logBoring(`server.apiV0.planMaintenance() says: ` + maintRespText);
  });

  it(`... the server sent back error code TyEBASAUN_UN_, this time too`, async () => {
    assert.includes(maintRespText, 'TyEBASAUN_UN_');
  });
  it(`... and again says that this endpoint is for user 'sysmaint'`, async () => {
    assert.includes(maintRespText, `'sysmaint'`);
  });


  it(`Mallory tries again, using 'sysmaint' but the wrong API secret`,
          async () => {
    maintRespText = await server.apiV0.planMaintenance({ origin: site.origin,
        basicAuthUsername: 'sysmaint',
        apiSecret: 'wrong-secret',
        fail: true,
        data: {
            maintenanceUntilUnixSecs: 1,
            maintWordsHtml: `Maint_mode_BAD_EDITED`,
            maintMessageHtml: `<h1>Maint_mode_BAD_EDITED</h1>` }});
    logBoring(`server.apiV0.planMaintenance() says: ` + maintRespText);
  });

  it(`... the server sent back error code TyEBASAUN_SECR_`, async () => {
    assert.includes(maintRespText, 'TyEBASAUN_SECR_');
  });


  it(`The suspicious bad maint message won't appear`, async () => {   // fok
    await maria_brB.refresh2();
    // Fragile, if typos. Break out fn?
    await maria_brB.assertNoTextMatches('.c_SrvAnns', /Maint_mode_BAD_EDITED/);
  });

  it(`Maria sees the *old* maint message`, async () => {
    await maria_brB.refresh2();
    await maria_brB.waitUntilAnyTextMatches(   // fok
          '.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt', /Maint_mode_ok/, { refreshBetween: true });
  });

  it(`*Not* the suspicious bad maint msg (testing again, since there's a race)`, async () => {
    await maria_brB.refresh2();
    // Fragile, if typos. Break out fn?
    await maria_brB.assertNoTextMatches('.c_SrvAnns', /Maint_mode_BAD_EDITED/);
  });


  // ----- Switch off maint mode, & ttt

  it(`But the server admin can remove the maint msg, using the server secret`, async () => {
    const resp = await server.apiV0.planMaintenance({ origin: site.origin,
        basicAuthUsername: 'sysmaint', apiSecret: 'test_sysmaint_api_secret',
        data: {
            maintenanceUntilUnixSecs: 1,
            maintWordsHtml: `Maint_mode_OK_EDITED`,
            maintMessageHtml: `<p>Maint_mode_OK_EDITED</p>` }});
    logBoring(`server.apiV0.planMaintenance() says: ` + resp);
  });

  it(`Maria sees the maint message no more`, async () => {
    await maria_brB.refresh2();
    await maria_brB.waitUntilAnyTextMatches(
            '.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt', /Maint_mode_OK_EDITED/, {
      refreshBetween: true,
    });
  });

  it(`The server admin stops maint mode`, async () => {
    const resp = await server.apiV0.planMaintenance({ origin: site.origin,
        basicAuthUsername: 'sysmaint', apiSecret: 'test_sysmaint_api_secret',
        data: {
            maintenanceUntilUnixSecs: null, maintWordsHtml: null, maintMessageHtml: null }});
    logBoring(`server.apiV0.planMaintenance() says: ` + resp);
  });


  // ----- Sysbot secret won't work for /-/v0/create-site

  let createSiteResp: St | A;

  it(`Owen can't use his sysbot API secret to call  /-/v0/create-site  either`, async () => {
    createSiteResp = await server.apiV0.createSite({ data: 123,
        origin: site.origin,
        apiRequester: 'talkyardId=' + c.SysbotUserId,
        apiSecret: apiSecret.secretKey,
        wrongApiSecret: true });
  });

  it(`... the server sent back error code TyEBASAUN_UN_`, async () => {
    assert.includes(createSiteResp, 'TyEBASAUN_UN_');
  })


  // ----- The wrong secrets won't work for /-/v0/handle-email

  let emailWebhookResp: St | A;

  it(`Owen can't use his sysbot API secret to call  /-/handle-email  either`, async () => {
    emailWebhookResp = await server.sendIncomingEmailWebhook({
        to: '1234+dummy-hash@example.com', body: '1234', format: 'Postmarkapp',
        origin: site.origin,
        apiRequester: 'talkyardId=' + c.SysbotUserId,
        apiSecret: apiSecret.secretKey,
        wrongApiSecret: true });
  });

  it(`... the server sent back error code TyEBASAUN_UN_`, async () => {
    assert.includes(emailWebhookResp, 'TyEBASAUN_UN_');
  })

  it(`Someone who only toggles on maintenance, can't call /-/handle-email`, async () => {
    emailWebhookResp = await server.sendIncomingEmailWebhook({
        to: '1234+dummy-hash@example.com', body: '1234', format: 'Postmarkapp',
        origin: site.origin,
        apiRequester: 'sysmaint', apiSecret: 'test_sysmaint_api_secret',
        wrongApiSecret: true });
  });

  it(`... the server sent back error code TyEBASAUN_UN_ now too`, async () => {
    assert.includes(emailWebhookResp, 'TyEBASAUN_UN_');
  })


});

