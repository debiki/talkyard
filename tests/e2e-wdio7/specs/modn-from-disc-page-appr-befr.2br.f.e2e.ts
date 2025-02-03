/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

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


describe(`modn-from-disc-page-appr-befr.2br.f  TyTE2E603RTJ`, () => {

  it(`construct site`, async () => {
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

    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

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

  it(`import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });

  it(`Maria logs in`, async () => {
    await mariasBrowser.go2(site.origin + '/');
    await mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  let topicOneUrl: St;
  let topicTwoUrl: St;

  it(`... posts a new topic`, async () => {
    await mariasBrowser.complex.createAndSaveTopic({
          title: topicOneTitle, body: topicOneBody, willBePendingApproval: true });
    topicOneUrl = await mariasBrowser.getUrl();
  });

  it(`... it becomes pending approval`, async () => {
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, topicOneBody);
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, topicOneTitle);
    await mariasBrowser.topic.assertPagePendingApprovalBodyVisible();
  });

  it(`Maria navigates away, ... and back`, async () => {
    await mariasBrowser.topbar.clickHome();
    await mariasBrowser.forumTopicList.goToTopic(topicOneTitle);
  });

  it(`... text stil visible, after SPA-navigated away and back  TyTE2E603SKD`, async () => {
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, topicOneBody);
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, topicOneTitle);
    await mariasBrowser.topic.assertPagePendingApprovalBodyVisible();
  });

  it(`... and after reload  TyTE2E603SKD`, async () => {
    await mariasBrowser.refresh2();
    await mariasBrowser.waitForMyDataAdded();
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, topicOneBody);
    await mariasBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, topicOneTitle);
    await mariasBrowser.topic.assertPagePendingApprovalBodyVisible();
  });

  it(`Maria posts another topic`, async () => {
    await mariasBrowser.topbar.clickHome();
    await mariasBrowser.complex.createAndSaveTopic({
          title: topicTwoTitle, body: topicTwoBody, willBePendingApproval: true });
    topicTwoUrl = await mariasBrowser.getUrl();
  });

  it(`... it becomes pending approval`, async () => {
    await mariasBrowser.topic.assertPagePendingApprovalBodyVisible();
  });

  it(`A stranger somehow navigates to the page`, async () => {
    await modyasBrowser.go2(topicTwoUrl);  // not yet logged in
  });

  it(`... but page not visible — not yet approved  TyTE2E603SKD`, async () => {
    await modyasBrowser.assertWholePageHidden();  // not yet logged in
  });

  it(`Modya logs in`, async () => {
    await modyasBrowser.loginDialog.loginWithPassword(modya);
  });

  it(`... the unapproved title & body get loaded via page load  TyTE2E603SKD`, async () => {
    await modyasBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, topicTwoBody);
    await modyasBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, topicTwoTitle);
  });

  it(`Modya rejects topic two`, async () => {
    await modyasBrowser.topic.rejectPostNr(c.BodyNr);
  });

  it(`... that deletes the page`, async () => {
    await modyasBrowser.topic.waitUntilPageDeleted();
  });

  it(`Modya navigates to topic one`, async () => {
    await modyasBrowser.topbar.clickHome();
    await modyasBrowser.forumTopicList.goToTopic(topicOneTitle);
  });

  it(`... the unapproved posts get loaded, via SPA navigation  TyTE2E603SKD`, async () => {
    await modyasBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, topicOneTitle);
    await modyasBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, topicOneBody);
    /* Not created yet:
    await modyasBrowser.topic.waitForPostAssertTextMatches(replA_nr, replA_txt);
    await modyasBrowser.topic.waitForPostAssertTextMatches(replB_nr, replB_txt);
    await modyasBrowser.topic.waitForPostAssertTextMatches(replC_toRej_nr, replC_toRej_txt);
    await modyasBrowser.topic.waitForPostAssertTextMatches(replD_toApr_nr, replD_toApr_txt);
    */
  });

  it(`... approves topic one`, async () => {
    await modyasBrowser.topic.approvePostNr(c.BodyNr);
  });


  it(`Maria now cannot see topic 2`, async () => {
    assert.eq(await mariasBrowser.getUrl(), topicTwoUrl);
    await mariasBrowser.refresh2();
    await mariasBrowser.assertNotFoundError({ whyNot: 'PageDeleted' });
  });

  it(`... and that topic one got approved`, async () => {
    await mariasBrowser.go2(topicOneUrl);
    await mariasBrowser.topic.assertPageNotPendingApproval();
  });

  it(`Maria posts four replies, in topic one`, async () => {
    await mariasBrowser.complex.replyToOrigPost(replA_txt);
    await mariasBrowser.complex.replyToOrigPost(replB_txt);
    await mariasBrowser.complex.replyToOrigPost(replC_toRej_txt);
    await mariasBrowser.complex.replyToOrigPost(replD_toApr_txt);
  });

  it(`... they become pending-approval`, async () => {
    await mariasBrowser.topic.assertPostNeedsApprovalBodyVisible(replA_nr);
    await mariasBrowser.topic.assertPostNeedsApprovalBodyVisible(replB_nr);
    await mariasBrowser.topic.assertPostNeedsApprovalBodyVisible(replC_toRej_nr);
    await mariasBrowser.topic.assertPostNeedsApprovalBodyVisible(replD_toApr_nr);
  });

  it(`Modya rejects reply C`, async () => {
    await modyasBrowser.topic.rejectPostNr(replC_toRej_nr);
  });

  it(`... edits reply D`, async () => {
    await modyasBrowser.complex.editPostNr(replD_toApr_nr, modyasMoreText, { append: true });
  });

  it(`... edititing it won't approve it  TyTE2E407RKS`, async () => {
    await modyasBrowser.refresh2();
    await modyasBrowser.topic.waitForPostAssertTextMatches(
          replD_toApr_nr, replD_toApr_txt + modyasMoreText);
    await modyasBrowser.topic.assertPostNeedsApprovalBodyVisible(replD_toApr_nr);
    assert.deepEq(await modyasBrowser.topic.countReplies({ skipWait: true }),
          { numNormal: 0, numPreviews: 0, numDrafts: 0, numUnapproved: 3, numDeleted: 0 });
  });

  it(`... approves reply D`, async () => {
    await modyasBrowser.topic.approvePostNr(replD_toApr_nr);
  });

  //  TyT204RKSTEM
  //  Mons approves from disc page, Modya approves & rejects from modn page.
  //  Mons rejects from disc page, Modya approves & rejects from modn page.

  it(`Maria sees the page and reply D got approved`, async () => {
    await mariasBrowser.topic.refreshUntilPostNotPendingApproval(replD_toApr_nr);
  });

  /* Now deleted unapproved posts are no longer loaded.  [opt_show_deld_posts]
  it(`... and reply C is deleted`, async () => {
    await mariasBrowser.topic.waitForPostVisibleAsDeleted(replC_toRej_nr);
  }); */

  it(`... and two pending approval`, async () => {
    assert.deepEq(await strangersBrowser.topic.countReplies({ skipWait: true }),
          { numNormal: 1, numPreviews: 0, numDrafts: 0, numUnapproved: 2, numDeleted: 0 });
  });


  it(`A stranger sees reply D  TyTE2E603SKD`, async () => {
    await mariasBrowser.topbar.clickLogout();
    await strangersBrowser.topic.waitForPostAssertTextMatches(
          replD_toApr_nr, replD_toApr_txt + modyasMoreText);
  });

  it(`... A and B still pending approval`, async () => {
    await strangersBrowser.topic.assertPostNeedsApprovalBodyHidden(replA_nr);
    await strangersBrowser.topic.assertPostNeedsApprovalBodyHidden(replB_nr);
  });

  it(`... C gone`, async () => {
    assert.not(await strangersBrowser.topic.isPostNrVisible(replC_toRej_nr));
  });

  it(`... those are all posts`, async () => {
    assert.deepEq(await strangersBrowser.topic.countReplies({ skipWait: true }),
          { numNormal: 1, numPreviews: 0, numDrafts: 0, numUnapproved: 2, numDeleted: 0 });
  });


  // TESTS_MISSING  TyT204RKSTEM
  //  Modya approves from modn page, Mons approves & rejects from disc page.
  //  Modya rejects from modn page, Mons approves & rejects from disc page.

  it(`Mons tries to approve and reject C and D via the mod page`, async () => {
  });

  it(`Mons instead approves A and B`, async () => {
  });

  it(`Modya approves A — before Mons' undo timeout`, async () => {
  });

  it(`Modya tries to approve B — after Mons' undo timeout`, async () => {
  });

});

