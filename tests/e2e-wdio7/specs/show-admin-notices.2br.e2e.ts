/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let modya: Member;
let modya_brB: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;



describe(`show-admin-notices.2br.e2e.ts  TyTE2EADMNTC`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: 'Admin_Notices_',
      members: ['owen', 'modya', 'memah'],
    });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    modya = forum.members.modya;
    modya_brB = brB;
    memah = forum.members.memah;
    memah_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Owen logs in to admin area, ... `, async () => {
    await owen_brA.adminArea.goToUsersEnabled(site.origin);
    await owen_brA.loginDialog.loginWithPassword(owen);
  });
  it(`There's a new version announcement`, async () => {
    await owen_brA.tips.waitForExactlyNumAnnouncements(1);
    await owen_brA.tips.assertAnnouncementDisplayed('.e_LstTyV');
  });


  it(`Suddenly something happens! Admins should get notified!`, async () => {
    await server.addAdminNotice({ siteId: site.id, noticeId: 1001 });
  });


  it(`Owen reloads the page`, async () => {
    await owen_brA.refresh2();
  });
  it(`... now there's an admin notice (and the latest version ann.)`, async () => {
    await owen_brA.tips.waitForExactlyNumAnnouncements(2);
    await owen_brA.tips.assertAnnouncementDisplayed('.e_TwLgI-Conf');
    await owen_brA.tips.assertAnnouncementDisplayed('.e_LstTyV');
  });


  it(`Something else happens!`, async () => {
    await server.addAdminNotice({ siteId: site.id, noticeId: 1002 });
  });


  it(`Owen goes to the forum homepage — notices should be shown here too`, async () => {
    await owen_brA.go2('/');
  });
  it(`... now there're two admin notices, and the ver. ann.`, async () => {
    await owen_brA.waitForMyDataAdded();
    assert.eq(await owen_brA.tips.numAnnouncementsDisplayed(), 2 + 1);  // ttt
  });
  it(`... about Twitter configured, and in use, and the server version`, async () => {
    await owen_brA.tips.assertAnnouncementDisplayed('.e_TwLgI-InUse');
    await owen_brA.tips.assertAnnouncementDisplayed('.e_TwLgI-Conf');
    await owen_brA.tips.assertAnnouncementDisplayed('.e_LstTyV');
  });


  it(`Memah logs in`, async () => {
    await memah_brB.go2(site.origin);
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });
  it(`There are no announcements, nothing`, async () => {
    await memah_brB.waitForMyDataAdded();
    assert.eq(await memah_brB.tips.numAnnouncementsDisplayed(), 0);
  });


  it(`Moderator Modya arrives`, async () => {
    await memah_brB.topbar.clickLogout();
    await modya_brB.complex.loginWithPasswordViaTopbar(modya);
  });
  it(`She also sees no notices or announcements`, async () => {
    await modya_brB.waitForMyDataAdded();
    assert.eq(await memah_brB.tips.numAnnouncementsDisplayed(), 0);
  });


  it(`Owen hides the most recent admin notice`, async () => {
    await owen_brA.tips.hideAnAnnouncement();
  });
  it(`... now there're just one notice, and an announcement`, async () => {
    await owen_brA.waitForMyDataAdded();
    assert.eq(await owen_brA.tips.numAnnouncementsDisplayed(), 2);
  });
  it(`... namely about Twitter login in use, and the server version`, async () => {
    await owen_brA.tips.assertAnnouncementDisplayed('.e_TwLgI-InUse');
    await owen_brA.tips.assertAnnouncementDisplayed('.e_LstTyV');
  });


  it(`Owen reloads the page`, async () => {
    await owen_brA.refresh2();
  });
  it(`... the hidden notice is still hidden`, async () => {
    await owen_brA.waitForMyDataAdded();
    assert.eq(await owen_brA.tips.numAnnouncementsDisplayed(), 2);
  });
  it(`... the other two are the same`, async () => {
    await owen_brA.tips.assertAnnouncementDisplayed('.e_TwLgI-InUse');
    await owen_brA.tips.assertAnnouncementDisplayed('.e_LstTyV');
  });

  it(`Owen unhides the notices`, async () => {
    await owen_brA.tips.unhideAllAnnouncements();
  });
  it(`... they're back`, async () => {
    await owen_brA.tips.waitForExactlyNumAnnouncements(2 + 1);
  });
  it(`... also after page relod`, async () => {
    // There's a race, so try a few times. [e2e_tips_race]  (The browser doesn't wait
    // for the server to be done un-hiding the announcements.)
    await owen_brA.refreshUntil(async () => {
      await owen_brA.waitForMyDataAdded();
      return await owen_brA.tips.numAnnouncementsDisplayed() === 2 + 1;  // ttt
    });
  });
  it(`... namely about Twitter, and the server version`, async () => {
    await owen_brA.tips.assertAnnouncementDisplayed('.e_TwLgI-InUse');
    await owen_brA.tips.assertAnnouncementDisplayed('.e_TwLgI-Conf');
    await owen_brA.tips.assertAnnouncementDisplayed('.e_LstTyV');
  });

});

