/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
// import fs = require('fs');  EMBCMTS
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


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




describe(`hide-unhide-tips.2br  TyTE2EHIDETPS329`, () => {

  it(`construct site`, () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Hide_Unhide_Tips_",
      members: ['memah'],
    });

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    brA = new TyE2eTestBrowser(wdioBrowserA);
    brB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owen_brA = brA;

    memah = forum.members.memah;
    memah_brB = brB;

    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Owen and Memah arrives ... `, () => {
    owen_brA.go2(site.origin);
    owen_brA.complex.loginWithPasswordViaTopbar(owen);
    memah_brB.go2(site.origin);
    memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });


  // ----- Admins


  it(`Owen sees 3 admin tips`, () => {
    assert.eq(owen_brA.tips.numTipsDisplayed(), 3);
  });
  it(`... and 1 admin announcement`, () => {
    assert.eq(owen_brA.tips.numAnnouncementsDisplayed(), 1);
  });

  it(`Owen hides two tips`, () => {
    owen_brA.tips.hideATips();
    owen_brA.tips.waitForExactlyNumTips(2);
    owen_brA.tips.hideATips();
    owen_brA.tips.waitForExactlyNumTips(1);
  });

  it(`... they're still gone, after page reload`, () => {
    owen_brA.refresh2();
    owen_brA.tips.waitForExactlyNumTips(1);
  });

  it(`... the announcement is still there`, () => {
    assert.eq(owen_brA.tips.numAnnouncementsDisplayed(), 1);
  });
  it(`... Owen hides it`, () => {
    owen_brA.tips.hideAnAnnouncement();
    owen_brA.tips.waitForExactlyNumAnnouncements(0);
  });

  it(`After page reload, only a tips visible`, () => {
    owen_brA.refresh2();
    owen_brA.tips.waitForExactlyNumTips(1);
  });
  it(`... no announcement`, () => {
    assert.eq(owen_brA.tips.numAnnouncementsDisplayed(), 0);
  });


  // ----- Unhiding tips, won't unhide announcements

  it(`Owen unhides all tips`, () => {
    owen_brA.tips.unhideAllTips();
    owen_brA.tips.waitForExactlyNumTips(3);
  });
  it(`... the announcement stays hidden though`, () => {
    assert.eq(owen_brA.tips.numAnnouncementsDisplayed(), 0);
  });
  it(`... also after page reload`, () => {
    owen_brA.refresh2();
    owen_brA.tips.waitForExactlyNumTips(3);
    assert.eq(owen_brA.tips.numAnnouncementsDisplayed(), 0);
  });


  // ----- Unhiding announcements, won't unhide tips

  it(`Owen hides a tips`, () => {
    owen_brA.tips.hideATips();
    owen_brA.tips.waitForExactlyNumTips(2);
  });

  it(`... unhides all announcements`, () => {
    owen_brA.tips.unhideAllAnnouncements();
    owen_brA.tips.waitForExactlyNumAnnouncements(1);
  });
  it(`... the hidden tips stays hidden`, () => {
    assert.eq(owen_brA.tips.numTipsDisplayed(), 2);
  });
  it(`... also after reload`, () => {
    owen_brA.refresh2();
    owen_brA.tips.waitForExactlyNumAnnouncements(1);
    assert.eq(owen_brA.tips.numTipsDisplayed(), 2);
  });



  // ----- Members


  it(`Memah sees no tips or announcements`, () => {
    assert.eq(memah_brB.tips.numTipsDisplayed(), 0);
    assert.eq(memah_brB.tips.numAnnouncementsDisplayed(), 0);
  });


  it(`... but when she starts typing`, () => {
    memah_brB.forumButtons.clickCreateTopic();
  });
  it(`... a tips abot the preview appears`, () => {
    memah_brB.tips.waitForPreviewTips();
  });
  it(`Memah hides that tips`, () => {
    memah_brB.tips.hideATips();
  });
  it(`... it disappears`, () => {
    memah_brB.tips.waitForPreviewTipsGone();
  });


  it(`... reloads the page, starts typing again`, () => {
    memah_brB.refresh2();
    memah_brB.forumButtons.clickCreateTopic();
  });
  it(`... sees the preview panel`, () => {
    memah_brB.preview.waitForDisplayedInEditor();
  });
  it(`... now, no tips appears`, () => {
    assert.not(memah_brB.tips.isPreviewTipsDisplayed());
  });


  it(`Memah unhides all tips`, () => {
    memah_brB.tips.unhideAllTips();
  });
  it(`... directly, the preview tips appears`, () => {
    memah_brB.tips.waitForPreviewTips();
  });
  it(`... and after reload`, () => {
    memah_brB.refresh2();
  });
  it(`... it's still there`, () => {
    memah_brB.forumButtons.clickCreateTopic();
    memah_brB.tips.waitForPreviewTips();
  });


});

