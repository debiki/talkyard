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


let everyonesBrowsers: TyAllE2eTestBrowsers;
let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let mons: Member;
let monsBrowser: TyE2eTestBrowser;
let modya: Member;
let modyasBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let site: IdAddress;
let forum: EmptyTestForum;

const topicOneTitle = 'topicOneTitle';
const topicOneBody = 'topicOneBody';

const replA_txt = 'replA_txt';
const replA_nr = c.FirstReplyNr;
const replB_txt = 'replB_txt';
const replB_nr = c.FirstReplyNr + 1;
const replC_toRej_txt = 'replC_toRej_txt';
const replC_toRej_nr = c.FirstReplyNr + 2;
const replD_toApr_txt = 'replD_toApr_txt';
const replD_toApr_nr = c.FirstReplyNr + 3;
const modyasMoreText = ' modyasMoreText';

const topicTwoTitle = 'topicTwoTitle';
const topicTwoBody = 'topicTwoBody';

describe(`modn-from-disc-page-approve-before  TyTE2E603RTJ`, () => {

  it(`construct site`, () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({  // or: builder.addLargeForum
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });

    builder.settings({
      numFirstPostsToApprove: 0,
      requireApprovalIfTrustLte: c.TestTrustLevel.FullMember,
      maxPostsPendApprBefore: 4,
      numFirstPostsToReview: 0,
    });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    mons = forum.members.mons;
    monsBrowser = richBrowserA;
    modya = forum.members.modya;
    modyasBrowser = richBrowserA;

    maria = forum.members.maria;
    mariasBrowser = richBrowserB;

    michael = forum.members.michael;
    michaelsBrowser = richBrowserB;

    strangersBrowser = richBrowserB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });

  it(`Maria logs in`, () => {
    mariasBrowser.go2(site.origin + '/');
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  let topicOneUrl: S;
  let topicTwoUrl: S;

  it(`... posts a new topic`, () => {
    mariasBrowser.complex.createAndSaveTopic({
          title: topicOneTitle, body: topicOneBody, willBePendingApproval: true });
    topicOneUrl = mariasBrowser.getUrl();
  });

  it(`... it becomes pending approval`, () => {
    mariasBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, topicOneBody);
    mariasBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, topicOneTitle);
    mariasBrowser.topic.assertPagePendingApprovalBodyVisible();
  });

  it(`Maria navigates away, ... and back`, () => {
    mariasBrowser.topbar.clickHome();
    mariasBrowser.forumTopicList.goToTopic(topicOneTitle);
  });

  it(`... text stil visible, after SPA-navigated away and back  TyTE2E603SKD`, () => {
    mariasBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, topicOneBody);
    mariasBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, topicOneTitle);
    mariasBrowser.topic.assertPagePendingApprovalBodyVisible();
  });

  it(`... and after reload  TyTE2E603SKD`, () => {
    mariasBrowser.refresh2();
    mariasBrowser.waitForMyDataAdded();
    mariasBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, topicOneBody);
    mariasBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, topicOneTitle);
    mariasBrowser.topic.assertPagePendingApprovalBodyVisible();
  });

  it(`Maria posts another topic`, () => {
    mariasBrowser.topbar.clickHome();
    mariasBrowser.complex.createAndSaveTopic({
          title: topicTwoTitle, body: topicTwoBody, willBePendingApproval: true });
    topicTwoUrl = mariasBrowser.getUrl();
  });

  it(`... it becomes pending approval`, () => {
    mariasBrowser.topic.assertPagePendingApprovalBodyVisible();
  });

  it(`A stranger somehow navigates to the page`, () => {
    modyasBrowser.go2(topicTwoUrl);  // not yet logged in
  });

  it(`... but page not visible — not yet approved  TyTE2E603SKD`, () => {
    modyasBrowser.assertWholePageHidden();  // not yet logged in
  });

  it(`Modya logs in`, () => {
    modyasBrowser.loginDialog.loginWithPassword(modya);
  });

  it(`... the unapproved title & body get loaded via page load  TyTE2E603SKD`, () => {
    modyasBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, topicTwoBody);
    modyasBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, topicTwoTitle);
  });

  it(`Modya rejects topic two`, () => {
    modyasBrowser.topic.rejectPostNr(c.BodyNr);
  });

  it(`... that deletes the page`, () => {
    modyasBrowser.topic.waitUntilPageDeleted();
  });

  it(`Modya navigates to topic one`, () => {
    modyasBrowser.topbar.clickHome();
    modyasBrowser.forumTopicList.goToTopic(topicOneTitle);
  });

  it(`... the unapproved posts get loaded, via SPA navigation  TyTE2E603SKD`, () => {
    modyasBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, topicOneTitle);
    modyasBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, topicOneBody);
    /* Not created yet:
    modyasBrowser.topic.waitForPostAssertTextMatches(replA_nr, replA_txt);
    modyasBrowser.topic.waitForPostAssertTextMatches(replB_nr, replB_txt);
    modyasBrowser.topic.waitForPostAssertTextMatches(replC_toRej_nr, replC_toRej_txt);
    modyasBrowser.topic.waitForPostAssertTextMatches(replD_toApr_nr, replD_toApr_txt);
    */
  });

  it(`... approves topic one`, () => {
    modyasBrowser.topic.approvePostNr(c.BodyNr);
  });


  it(`Maria now cannot see topic 2`, () => {
    assert.eq(mariasBrowser.getUrl(), topicTwoUrl);
    mariasBrowser.refresh2();
    mariasBrowser.assertNotFoundError({ whyNot: 'PageDeleted' });
  });

  it(`... and that topic one got approved`, () => {
    mariasBrowser.go2(topicOneUrl);
    mariasBrowser.topic.assertPageNotPendingApproval();
  });

  it(`Maria posts four replies, in topic one`, () => {
    mariasBrowser.complex.replyToOrigPost(replA_txt);
    mariasBrowser.complex.replyToOrigPost(replB_txt);
    mariasBrowser.complex.replyToOrigPost(replC_toRej_txt);
    mariasBrowser.complex.replyToOrigPost(replD_toApr_txt);
  });

  it(`... they become pending-approval`, () => {
    mariasBrowser.topic.assertPostNeedsApprovalBodyVisible(replA_nr);
    mariasBrowser.topic.assertPostNeedsApprovalBodyVisible(replB_nr);
    mariasBrowser.topic.assertPostNeedsApprovalBodyVisible(replC_toRej_nr);
    mariasBrowser.topic.assertPostNeedsApprovalBodyVisible(replD_toApr_nr);
  });

  it(`Modya rejects reply C`, () => {
    modyasBrowser.topic.rejectPostNr(replC_toRej_nr);
  });

  it(`... edits reply D`, () => {
    modyasBrowser.complex.editPostNr(replD_toApr_nr, modyasMoreText, { append: true });
  });

  it(`... edititing it won't approve it  TyTE2E407RKS`, () => {
    modyasBrowser.refresh2();
    modyasBrowser.topic.waitForPostAssertTextMatches(
          replD_toApr_nr, replD_toApr_txt + modyasMoreText);
    modyasBrowser.topic.assertPostNeedsApprovalBodyVisible(replD_toApr_nr);
    assert.deepEq(modyasBrowser.topic.countReplies({ skipWait: true }),
          { numNormal: 0, numPreviews: 0, numUnapproved: 3, numDeleted: 1 });
  });

  it(`... approves reply D`, () => {
    modyasBrowser.topic.approvePostNr(replD_toApr_nr);
  });

  //  TyT204RKSTEM
  //  Mons approves from disc page, Modya approves & rejects from modn page.
  //  Mons rejects from disc page, Modya approves & rejects from modn page.

  it(`Maria sees the page and reply D got approved`, () => {
    mariasBrowser.topic.refreshUntilPostNotPendingApproval(replD_toApr_nr);
  });

  it(`... and reply C is deleted`, () => {
    mariasBrowser.topic.waitForPostVisibleAsDeleted(replC_toRej_nr);
  });

  it(`... and two pending approval`, () => {
    assert.deepEq(strangersBrowser.topic.countReplies({ skipWait: true }),
          { numNormal: 1, numPreviews: 0, numUnapproved: 2, numDeleted: 1 });
  });


  it(`A stranger sees reply D  TyTE2E603SKD`, () => {
    mariasBrowser.topbar.clickLogout();
    strangersBrowser.topic.waitForPostAssertTextMatches(
          replD_toApr_nr, replD_toApr_txt + modyasMoreText);
  });

  it(`... A and B still pending approval`, () => {
    strangersBrowser.topic.assertPostNeedsApprovalBodyHidden(replA_nr);
    strangersBrowser.topic.assertPostNeedsApprovalBodyHidden(replB_nr);
  });

  it(`... C gone`, () => {
    assert.not(strangersBrowser.topic.isPostNrVisible(replC_toRej_nr));
  });

  it(`... those are all posts`, () => {
    assert.deepEq(strangersBrowser.topic.countReplies({ skipWait: true }),
          { numNormal: 1, numPreviews: 0, numUnapproved: 2, numDeleted: 0 });
  });


  // TESTS_MISSING  TyT204RKSTEM
  //  Modya approves from modn page, Mons approves & rejects from disc page.
  //  Modya rejects from modn page, Mons approves & rejects from disc page.

  it(`Mons tries to approve and reject C and D via the mod page`, () => {
  });

  it(`Mons instead approves A and B`, () => {
  });

  it(`Modya approves A — before Mons' undo timeout`, () => {
  });

  it(`Modya tries to approve B — after Mons' undo timeout`, () => {
  });

});

