/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import { logBoring } from '../utils/log-and-die';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let stranger_brA: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

let michaelsTopicUrl: St;
let mariasTopicUrl: St;


describe(`plan-maintenance.2br.d  TyTPLANMAINT01`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Plan Maintenance E2E Test",
      members: ['maria', 'michael']
    });

    builder.settings({ enableApi: true });

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;
    stranger_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
    michaelsTopicUrl = site.origin + '/' + forum.topics.byMichaelCategoryA.slug;
    mariasTopicUrl = site.origin + '/' + forum.topics.byMariaCategoryA.slug;
  });



  it(`Maria logs in`, async () => {
    await maria_brB.go2(michaelsTopicUrl);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });


  it(`There's no under-maintenance message`, async () => {
    await maria_brB.waitForExist('.c_SrvAnns');
    assert.not(await maria_brB.isDisplayed('.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt'));
  });


  it(`A cave troll hiding in a cave below the data center, decides it's time to eat another
          Uninterruptible Power Supply, and hence mind-writing manipulates the data center
          employees to make a plan-maintenance-API-request`, async () => {
    const resp = await server.apiV0.planMaintenance({ origin: site.origin,
        basicAuthUsername: 'sysmaint', apiSecret: 'test_sysmaint_api_secret',
        data: {
            maintenanceUntilUnixSecs: 1,
            maintWordsHtml: `Under_Maintenance_One`,
            maintMessageHtml: `<h1>Under Maintenance</h1>
<p>We are currently working on buying more UPS:es, ice cream and stone_cakes.
This shouldn't take more than 5-15 minutes. While we're working,
you can access the forum in read-only mode. Tell us if you have any UPS or cakes.
</p>
` }});
    logBoring(`server.apiV0.planMaintenance() says: ` + resp);
  });

  it(`Maint message appears, in the forum & discussion section`, async () => {
    await maria_brB.refresh2();
    await maria_brB.waitUntilAnyTextMatches(
          '.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt', /stone_cakes/, { refreshBetween: true });
  });

  it(`... on the about-user pages`, async () => {
    await maria_brB.userProfilePage.openActivityFor(owen.username);
    await maria_brB.userProfilePage.waitUntilUsernameIs(owen.username);
    await maria_brB.waitForTextVisibleAssertMatches(
          '.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt', /stone_cakes/);
  });

  it(`... strangers see it too`, async () => {
    await stranger_brA.go2(michaelsTopicUrl);
    await stranger_brA.waitForTextVisibleAssertMatches(
          '.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt', /stone_cakes/);
  });

  it(`Owen logs in to admin area, ... `, async () => {
    await owen_brA.adminArea.goToUsersEnabled(site.origin);
    await owen_brA.loginDialog.loginWithPassword(owen);
  });

  it(`... the maint message is in the admin area too`, async () => {
    await owen_brA.waitForTextVisibleAssertMatches(
          '.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt', /stone_cakes/);
  });


  it(`Change maint msg`, async () => {
    const resp = await server.apiV0.planMaintenance({ origin: site.origin,
        basicAuthUsername: 'sysmaint', apiSecret: 'test_sysmaint_api_secret',
        data: {
            maintenanceUntilUnixSecs: 1,
            maintWordsHtml: `Under_Maintenance_Two`,
            maintMessageHtml: `<p>If you have a power_cable, call us</p>` }});
    logBoring(`server.apiV0.planMaintenance() says: ` + resp);
  });


  it(`Maint message changed, in the forum & discussion section`, async () => {
    await maria_brB.refresh2();
    await maria_brB.waitUntilAnyTextMatches(
            '.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt', /power_cable/, {
      refreshBetween: true,
    });
  });

  it(`... changed in the admin area too`, async () => {
    await owen_brA.refresh2();
    await owen_brA.waitForTextVisibleAssertMatches(
          '.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt', /power_cable/);
  });

  it(`Owen leaves`, async () => {
    await owen_brA.topbar.clickLogout({ waitForLoginButton: false });
  });

  it(`Strangers also see the updated message`, async () => {
    await stranger_brA.go2('/');
    await stranger_brA.waitForTextVisibleAssertMatches(
          '.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt', /power_cable/);
  });



  it(`Stop maint work ...`, async () => {
    const resp = await server.apiV0.planMaintenance({ origin: site.origin,
        basicAuthUsername: 'sysmaint', apiSecret: 'test_sysmaint_api_secret',
        data: {
            maintenanceUntilUnixSecs: null }});
    logBoring(`server.apiV0.planMaintenance() says: ` + resp);
  });
  it(`Maint message gone`, async () => {
    await maria_brB.refresh2();
    await maria_brB.waitUntil(async () => {
      await maria_brB.waitForExist('.c_SrvAnns');
      return !await maria_brB.isDisplayed('.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt');
    }, {
      refreshBetween: true,
    });
  });
  it(`... Starting again`, async () => {
    const resp = await server.apiV0.planMaintenance({ origin: site.origin,
        basicAuthUsername: 'sysmaint', apiSecret: 'test_sysmaint_api_secret',
        data: {
            maintenanceUntilUnixSecs: 1 }});
    logBoring(`server.apiV0.planMaintenance() says: ` + resp);
  });
  it(`... doesn't forget the maintenance message`, async () => {
    await maria_brB.refresh2();
    await maria_brB.waitUntilAnyTextMatches(
            '.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt', /power_cable/, {
      refreshBetween: true,
    });
  });


  it(`Change message`, async () => {
    const resp = await server.apiV0.planMaintenance({ origin: site.origin,
        basicAuthUsername: 'sysmaint', apiSecret: 'test_sysmaint_api_secret',
        data: {
            maintWordsHtml: `Give us all_your_cats`,
            maintMessageHtml: `<p>We want cables of power and cat_cakes, yum yum</p>` }});
    logBoring(`server.apiV0.planMaintenance() says: ` + resp);
  });
  it(`... doesn't disable maint mode, just changes the message`, async () => {
    await maria_brB.refresh2();
    await maria_brB.waitUntilAnyTextMatches(
            '.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt', /cat_cakes/, {
      refreshBetween: true,
    });
  });


  it(`Stop maint work — all done. Everyone is happy`, async () => {
    const resp = await server.apiV0.planMaintenance({ origin: site.origin,
        basicAuthUsername: 'sysmaint', apiSecret: 'test_sysmaint_api_secret',
        data: {
            maintenanceUntilUnixSecs: null, maintWordsHtml: null, maintMessageHtml: null }});
    logBoring(`server.apiV0.planMaintenance() says: ` + resp);
  });


  it(`Maint message gone`, async () => {
    await maria_brB.refresh2();
    await maria_brB.waitUntil(async () => {
      await maria_brB.waitForExist('.c_SrvAnns');
      return !await maria_brB.isDisplayed('.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt');
    }, {
      refreshBetween: true,
    });
  });

  it(`... maint message gone for strangers too`, async () => {
    await stranger_brA.refresh2();
    await maria_brB.waitForExist('.c_SrvAnns');
    assert.not(await stranger_brA.isDisplayed('.c_SrvAnns .c_MaintWorkM .n_SysMsg_Txt'));
  });

});

