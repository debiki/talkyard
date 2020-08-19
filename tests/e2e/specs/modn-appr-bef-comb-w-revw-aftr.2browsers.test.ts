/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');
import { logMessage, dj, logBoring } from '../utils/log-and-die';


let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let merche: Member;
let merchesBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let memah: Member;
let memahsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let site: IdAddress;

let forum: EmptyTestForum;
const owensPagePath = '/owens-page';
let owensPageId;
let merchesPageId;

const merchesTopicA_title = 'merchesTopicA_title';
const merchesTopicA_body = 'merchesTopicA_body';
const merchesReplyOne = 'merchesReplyOne';
const merchesReplyTwo = 'merchesReplyTwo';

const mariasReplyOne = 'mariasReplyOne';
const mariasReplyTwo = 'mariasReplyTwo';
const mariasReplyThree = 'mariasReplyThree';
const mariasReplyFour = 'mariasReplyFour';

const memahsReplyOne = 'memahsReplyOne';
const memahsReplyTwo = 'memahsReplyTwo';
const memahsReplyThree = 'memahsReplyThree';
const memahsReplyFour = 'memahsReplyFour';
const memahsReplyFive = 'memahsReplyFive';


describe("modn-appr-bef-comb-w-revw-aftr  TyTE2E05RKD3", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "Req Appr Before And Revw After Forum",
      members: ['maria', 'memah', 'owen'],
    });

    builder.addPage({
      id: '45678',
      folder: '/',
      showId: false,
      slug: owensPagePath.substr(1), // drop slash
      role: c.TestPageRole.Discussion,
      title: "Owen's Page",
      body: "Text text.",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.owen.id,
    });

    const siteData: SiteData2 = forum.siteData;
    siteData.settings.numFirstPostsToApprove = 1;
    siteData.settings.requireApprovalIfTrustLte = 1;
    siteData.settings.maxPostsPendApprBefore = 1;

    siteData.settings.numFirstPostsToReview = 2;
    siteData.settings.reviewAfterIfTrustLte = 2;
    siteData.settings.maxPostsPendRevwAftr = 2;

    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    merche = make.memberMerche();
    merchesBrowser = richBrowserB;
    // Trust level will be: New Member.

    maria = forum.members.maria;
    maria.trustLevel = c.TestTrustLevel.Basic;
    mariasBrowser = richBrowserB;

    memah = forum.members.memah;
    memah.trustLevel = c.TestTrustLevel.FullMember;
    memahsBrowser = richBrowserB;

    strangersBrowser = richBrowserB;

    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });



  // ----- Approve-Before: First posts


  it("Merche goes to the forum", () => {
    merchesBrowser.go(site.origin);
  });

  it("... signs up", () => {
    merchesBrowser.complex.signUpAsMemberViaTopbar(merche);
  });

  it("... verifies her email", function() {
    const url = server.getLastVerifyEmailAddressLinkEmailedTo(
            site.id, merche.emailAddress, merchesBrowser);
    merchesBrowser.go(url);
    merchesBrowser.hasVerifiedSignupEmailPage.clickContinue();
  });


  it("Merche creates a new topic, will be pending approval", () => {
    merchesBrowser.complex.createAndSaveTopic({
          title: merchesTopicA_title,
          body: merchesTopicA_body,
          willBePendingApproval: true });
    merchesPageId = merchesBrowser.getPageId();
  });

  it("Merche goes to Owen's page", () => {
    merchesBrowser.go2(owensPagePath);
  });

  it("Merche cannot reply  — max pending req-appr-before is 1", () => {
    merchesBrowser.complex.replyToOrigPost(merchesReplyOne);
    owensPageId = merchesBrowser.getPageId();
  });
  it(`... she sees: "cannot post more until ... first posts ... approved"`, () => {
    merchesBrowser.serverErrorDialog.waitForFirstPostsNotApproved();
    merchesBrowser.serverErrorDialog.close();
  });

  it("... in the page, there's a reply preview only", () => {
    merchesBrowser.preview.waitForExist('', { where: 'InPage' });
    const counts = merchesBrowser.topic.countReplies();
    assert.deepEq(counts, { numNormal: 0, numPreviews: 1, numUnapproved: 0, numDeleted: 0 });
  });



  // ----- Approve-Before: Low trust level


  it("Owen logs in to the admin area, moderation page", () => {
    owensBrowser.adminArea.review.goHere(site.origin, { loginAs: owen });
  });

  it(`... approves Merche's new topic`, () => {
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
  });
  it("... waits until the server is done", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions(merchesPageId, c.BodyNr);
  });

  it("Now Merche can post a reply", () => {
    merchesBrowser.complex.replyToOrigPost(merchesReplyOne);
    merchesBrowser.topic.waitUntilPostTextIs(c.FirstReplyNr, merchesReplyOne);
  });

  it("... it gets pending approval", () => {
    merchesBrowser.topic.assertPostNeedsApprovalBodyVisible(c.FirstReplyNr);
    const counts = merchesBrowser.topic.countReplies();
    assert.deepEq(counts, { numNormal: 0, numPreviews: 0, numUnapproved: 1, numDeleted: 0 });
  });

  it(`Merche cannot post more — too low trust level`, () => {
    merchesBrowser.complex.replyToOrigPost(merchesReplyTwo);
  });
  it(`... a different error now, not about the *first* posts:
          "cannot post more until ... previous posts ... approved"`, () => {
    merchesBrowser.serverErrorDialog.waitForTooManyPendingApproval();
    merchesBrowser.serverErrorDialog.close();
  });



  // ----- Approve-before, again (setup later tests)


  let lastPostNr;
  let mariasPostOneNr;

  it("Maria arrives", () => {
    merchesBrowser.topbar.clickLogout();
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("Maria can post a reply", () => {
    mariasBrowser.complex.replyToOrigPost(mariasReplyOne);
    lastPostNr = c.FirstReplyNr + 1;
    mariasPostOneNr = lastPostNr;
  });
  it(`... she sees it; it's pending-approval`, () => {
    mariasBrowser.topic.waitUntilPostTextMatches(lastPostNr, mariasReplyOne);
    mariasBrowser.topic.assertPostNeedsApprovalBodyVisible(lastPostNr);
  });
  it(`... Merche's and Maria's posts are pending approval`, () => {
    // There was a bug previously, with the server auto approving Merche's first reply,
    // just because her page had beene approved — in perhapsCascadeApproval() TyT305RKDJ26.
    // Resulted in  numNormal: 1  namely Merche's reply.

    const counts = merchesBrowser.topic.countReplies();
    assert.deepEq(counts, { numNormal: 0, numPreviews: 0, numUnapproved: 2, numDeleted: 0 });
  });

  it(`Maria cannot post more`, () => {
    mariasBrowser.complex.replyToOrigPost(mariasReplyTwo);
  });
  it(`... her first post needs to get approved first`, () => {
    mariasBrowser.serverErrorDialog.waitForFirstPostsNotApproved();
    mariasBrowser.serverErrorDialog.close();
  });

  it(`Owen approves Maria's first post`, () => {
    owensBrowser.refresh2();
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
  });
  it("... waits until the server is done", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions(owensPageId, lastPostNr);
  });



  // ----- Review-After first posts  (after first posts approved)


  let lastApprPostNr;

  it("Now Maria can post two more", () => {
    mariasBrowser.topic.refreshUntilPostNotPendingApproval(mariasPostOneNr);
    mariasBrowser.complex.replyToOrigPost(mariasReplyTwo);
    mariasBrowser.complex.replyToOrigPost(mariasReplyThree);
    lastPostNr += 2;
    lastApprPostNr = lastPostNr;
  });
  it(`... shown directly`, () => {
    mariasBrowser.topic.waitUntilPostTextIs(lastPostNr, mariasReplyThree);
  });
  it(`... and approved`, () => {
    const counts = mariasBrowser.topic.countReplies();
    const numNormal = 3; // Maria's
    const numUnapproved = 1; // Merche's
    assert.deepEq(counts, { numNormal,  numPreviews: 0, numUnapproved,  numDeleted: 0 });
  });


  it(`But cannt post a fourth — Owen needs to Review-After two replies`, () => {
    mariasBrowser.complex.replyToPostNr(lastApprPostNr, mariasReplyFour);
  });
  it(`... error dialog`, () => {
    // Should be  waitForFirstPostsNotReviewedAfter(), Not impl [05KHAD6KF52]
    mariasBrowser.serverErrorDialog.waitForTooManyPendingReview();
    mariasBrowser.serverErrorDialog.close();
  });

  // After Owen approved,  waitForFirstPostsNotReviewedAfter()
  // should change to: waitForTooManyPendingReview()
  // — because still too low trust level.  Not impl [05KHAD6KF52] TESTS_MISSING



  // ----- High trust level: Can post freely, after first posts


  it("Memah arrives", () => {
    mariasBrowser.topbar.clickLogout();
    memahsBrowser.complex.loginWithPasswordViaTopbar(memah);
  });

  it("Memah can post a reply", () => {
    memahsBrowser.complex.replyToPostNr(lastApprPostNr, memahsReplyOne);
    memahsBrowser.preview.waitUntilGone();
    lastPostNr += 1;
  });
  it(`... she sees it; it's pending-approval — it's her 1st post`, () => {
    memahsBrowser.topic.waitUntilPostTextMatches(lastPostNr, memahsReplyOne);
    memahsBrowser.topic.assertPostNeedsApprovalBodyVisible(lastPostNr);
  });
  it(`... Merche's and Memah's posts are pending approval`, () => {
    const counts = memahsBrowser.topic.countReplies();
    const numNormal = 3;  // Maria's
    const numUnapproved = 2;
    assert.deepEq(counts, { numNormal,  numPreviews: 0, numUnapproved,  numDeleted: 0 });
  });

  it(`Owen approves Memah's reply`, () => {
    owensBrowser.refresh2();
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
  });
  it("... waits until the server is done", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions(owensPageId, lastPostNr);
  });
  it("Now Memah can post two more  — max pending posts to review-after is 2", () => {
    memahsBrowser.complex.replyToPostNr(lastApprPostNr, memahsReplyTwo);
    memahsBrowser.complex.replyToPostNr(lastApprPostNr, memahsReplyThree);
    lastPostNr += 2;
    lastApprPostNr = lastPostNr;
  });

  /* Not impl  [05KHAD6KF52] TESTS_MISSING
  it(`But not more — Owen needs to Review-After the two first replies`, () => {
    memahsBrowser.complex.replyToPostNr(lastApprPostNr, mariasReplyFour);
  });
  it(`... error dialog`, () => {
    memahsBrowser.serverErrorDialog.waitForFirstPostsNotReviewedAfter
    memahsBrowser.serverErrorDialog.close();
  });
  */

  it(`Owen reviews Memah's two replies`, () => {
    owensBrowser.refresh2();
    owensBrowser.adminArea.review.hideCompletedTasks();
    // Merhce's 1 + Maria's 2 + Memah's 2.
    assert.eq(owensBrowser.adminArea.review.countThingsToReview(), 1 + 2 + 2);
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
  });
  it("... waits until the server is done", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions(owensPageId, lastPostNr);
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions(owensPageId, lastPostNr - 1);
  });

  it("Now Memah can post, no more reviews", () => {
    memahsBrowser.complex.replyToPostNr(lastApprPostNr, memahsReplyFour);
    memahsBrowser.complex.replyToPostNr(lastApprPostNr, memahsReplyFive);
    lastPostNr += 2;
    lastApprPostNr = lastPostNr;
  });

  it(`Nothing more for Owen to review`, () => {
    owensBrowser.refresh2()
    owensBrowser.adminArea.review.hideCompletedTasks();
    assert.eq(owensBrowser.adminArea.review.countThingsToReview(), 1 + 2);
  });

});

