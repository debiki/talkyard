/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;



describe(`hide-unhide-tips.2br.f  TyTE2EHIDETPS329`, () => {

  if (settings.prod) {
    console.log(`Prod mode: Skipping this spec — the server
            wouldn't show the e2e test announcement.`);
    return;
  }

  it(`construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: 'Hide_Unhide_Tips_',
      members: ['memah'],
    });

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    memah = forum.members.memah;
    memah_brB = brB;

    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Owen and Memah arrives ... `, async () => {
    await owen_brA.go2(site.origin);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
    await memah_brB.go2(site.origin);
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });


  // ----- Admins


  it(`Owen sees 3 admin tips`, async () => {
    assert.eq(await owen_brA.tips.numTipsDisplayed(), 3);
  });
  it(`... and 1 admin announcement`, async () => {
    assert.eq(await owen_brA.tips.numAnnouncementsDisplayed(), 1);
  });

  it(`Owen hides two tips`, async () => {
    await owen_brA.tips.hideATips();
    await owen_brA.tips.waitForExactlyNumTips(2);
    await owen_brA.tips.hideATips();
    await owen_brA.tips.waitForExactlyNumTips(1);
  });

  it(`... they're still gone, after page reload`, async () => {
    await owen_brA.refresh2();
    await owen_brA.tips.waitForExactlyNumTips(1);
  });

  it(`... the announcement is still there`, async () => {
    assert.eq(await owen_brA.tips.numAnnouncementsDisplayed(), 1);
  });
  it(`... Owen hides it`, async () => {
    await owen_brA.tips.hideAnAnnouncement();
    await owen_brA.tips.waitForExactlyNumAnnouncements(0);
  });

  it(`After page reload, only a tips visible`, async () => {
    await owen_brA.refresh2();
    await owen_brA.tips.waitForExactlyNumTips(1);
  });
  it(`... no announcement`, async () => {
    assert.eq(await owen_brA.tips.numAnnouncementsDisplayed(), 0);
  });


  // ----- Unhiding tips, won't unhide announcements

  it(`Owen unhides all tips`, async () => {
    await owen_brA.tips.unhideAllTips();
    await owen_brA.tips.waitForExactlyNumTips(3);
  });
  it(`... the announcement stays hidden though`, async () => {
    assert.eq(await owen_brA.tips.numAnnouncementsDisplayed(), 0);
  });
  it(`... also after page reload`, async () => {
    await owen_brA.refresh2();
    await owen_brA.tips.waitForExactlyNumTips(3);
    assert.eq(await owen_brA.tips.numAnnouncementsDisplayed(), 0);
  });


  // ----- Unhiding announcements, won't unhide tips

  it(`Owen hides a tips`, async () => {
    await owen_brA.tips.hideATips();
    await owen_brA.tips.waitForExactlyNumTips(2);
  });

  it(`... unhides all announcements`, async () => {
    await owen_brA.tips.unhideAllAnnouncements();
    await owen_brA.tips.waitForExactlyNumAnnouncements(1);
  });
  it(`... the hidden tips stays hidden`, async () => {
    assert.eq(await owen_brA.tips.numTipsDisplayed(), 2);
  });
  it(`... also after reload`, async () => {
    await owen_brA.refresh2();
    await owen_brA.tips.waitForExactlyNumAnnouncements(1);
    assert.eq(await owen_brA.tips.numTipsDisplayed(), 2);
  });



  // ----- Members


  it(`Memah sees no tips or announcements`, async () => {
    assert.eq(await memah_brB.tips.numTipsDisplayed(), 0);
    assert.eq(await memah_brB.tips.numAnnouncementsDisplayed(), 0);
  });


  it(`... but when she starts typing`, async () => {
    await memah_brB.forumButtons.clickCreateTopic();
  });
  it(`... a tips abot the preview appears`, async () => {
    await memah_brB.tips.waitForPreviewTips();
  });
  it(`Memah hides that tips`, async () => {
    await memah_brB.tips.hideATips();
  });
  it(`... it disappears`, async () => {
    await memah_brB.tips.waitForPreviewTipsGone();
  });


  it(`... reloads the page, starts typing again`, async () => {
    await memah_brB.refresh2();
    await memah_brB.forumButtons.clickCreateTopic();
  });
  it(`... sees the preview panel`, async () => {
    await memah_brB.preview.waitForDisplayedInEditor();
  });
  it(`... now, no tips appears`, async () => {
    assert.not(await memah_brB.tips.isPreviewTipsDisplayed());
  });


  it(`Memah unhides all tips`, async () => {
    await memah_brB.tips.unhideAllTips();
  });
  it(`... directly, the preview tips appears`, async () => {
    await memah_brB.tips.waitForPreviewTips();
  });
  it(`... and after reload`, async () => {
    await memah_brB.refresh2();
  });
  it(`... it's still there`, async () => {
    await memah_brB.forumButtons.clickCreateTopic();
    await memah_brB.tips.waitForPreviewTips();
  });


});

