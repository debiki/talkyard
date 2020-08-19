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
import { logMessage, dj, logBoring, dieIf } from '../utils/log-and-die';


let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let merche: Member;
let merchesBrowser: TyE2eTestBrowser;
let trillian: Member;
let trilliansBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let site: IdAddress;

let forum: EmptyTestForum;
const owensPagePath = '/owens-page';
let owensPageId;

const merchesTopicA_title = 'merchesTopicA_title';
const merchesTopicA_body = 'merchesTopicA_body';
const merchesReplyOne = 'merchesReplyOne';
const merchesReplyTwo = 'merchesReplyTwo';

const trilliansReplyOne_skipsMods = 'trilliansReplyOne_skipsMods';
const trilliansReplyTwo_reqApprBef = 'trilliansReplyTwo_reqApprBef';
const trilliansReplyThree_reqApprBef = 'trilliansReplyThree_reqApprBef';
const trilliansReplyFour = 'trilliansReplyFour';
const trilliansReplyFive = 'trilliansReplyFive';
const trilliansReplySix = 'trilliansReplySix';

const mariasReplyOne_skipsMods = 'mariasReplyOne_skipsMods';
const mariasReplyTwo_skipsMods = 'mariasReplyTwo_skipsMods';
const mariasReplyThree_skipsMods = 'mariasReplyThree_skipsMods';
const mariasReplyFour = 'mariasReplyFour';
const mariasReplyFive = 'mariasReplyFive';
const mariasReplySix = 'mariasReplySix';
const mariasReplySeven = 'mariasReplySeven';
const mariasReplyEight = 'mariasReplyEight';
const mariasReplyNine = 'mariasReplyNine';
const mariasReplyTen = 'mariasReplyTen';
const mariasReplyEleven = 'mariasReplyEleven';

describe("modn-approve-before  TyTE2E52RKDHI", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "Approve Before Forum",
      members: ['trillian', 'maria', 'owen'],
    });

    builder.addPage({
      id: '45678',
      folder: '/',
      showId: false,
      slug: owensPagePath.substr(1), // drop slash
      role: c.TestPageRole.Discussion,
      title: "Owen's Appr Bef Page",
      body: "Text text.",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.owen.id,
    });

    const siteData: SiteData2 = forum.siteData;
    siteData.settings.numFirstPostsToApprove = 0;
    siteData.settings.requireApprovalIfTrustLte = 1;
    siteData.settings.maxPostsPendApprBefore = 2;

    siteData.settings.numFirstPostsToReview = 0;
    siteData.settings.reviewAfterIfTrustLte = 0;
    siteData.settings.maxPostsPendRevwAftr = 0;

    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    merche = make.memberMerche();
    merchesBrowser = richBrowserA;
    // Trust level will be: New Member.

    trillian = forum.members.trillian;
    trilliansBrowser = richBrowserB;
    // Trust level is: Trusted Member.

    mariasBrowser = richBrowserB;
    maria = forum.members.maria;
    maria.trustLevel = c.TestTrustLevel.Basic;

    strangersBrowser = richBrowserB;

    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });



  it("Merche goes to the forum", () => {
    merchesBrowser.go(site.origin);
  });

  it("... signs up", () => {
    merchesBrowser.complex.signUpAsMemberViaTopbar(merche);
  });

  it("... verifies her email", function() {
    const url = server.getLastVerifyEmailAddressLinkEmailedTo(
            site.id, merche.emailAddress);
    merchesBrowser.go(url);
    merchesBrowser.hasVerifiedSignupEmailPage.clickContinue();
  });



  it("Merche creates a new topic, will be pending approval", () => {
    merchesBrowser.complex.createAndSaveTopic({
          title: merchesTopicA_title,
          body: merchesTopicA_body,
          willBePendingApproval: true });
  });

  it("Merche goes to Owen's page", () => {
    merchesBrowser.go2(owensPagePath);
  });

  let lastReplyNr;

  it("Merche can post one reply", () => {
    merchesBrowser.complex.replyToOrigPost(merchesReplyOne);
    lastReplyNr = c.FirstReplyNr;
    owensPageId = merchesBrowser.getPageId();
  });

  it(`But not more`, () => {
    merchesBrowser.complex.replyToOrigPost(merchesReplyTwo);
  });

  it(`... she sees: "cannot post more until ... previous posts ... approved"`, () => {
    merchesBrowser.serverErrorDialog.waitForTooManyPendingApproval();
    merchesBrowser.serverErrorDialog.close();
  });

  it("... and in the page, there's a preview, and her old unapproved reply", () => {
    merchesBrowser.preview.waitForExist('', { where: 'InPage' });
    const counts = merchesBrowser.topic.countReplies();
    logBoring(`Reply counts: ${JSON.stringify(counts)}`);
    assert.deepEq(counts, { numNormal: 0, numPreviews: 1, numUnapproved: 1, numDeleted: 0 });
  });



  it("trillian arrives", () => {
    trilliansBrowser.go2(site.origin + owensPagePath);
    trilliansBrowser.complex.loginWithPasswordViaTopbar(trillian);
  });

  it("She's a trusted member, her posts won't get queued for moderation", () => {
    trilliansBrowser.complex.replyToOrigPost(trilliansReplyOne_skipsMods);
    lastReplyNr += 1;
    trilliansBrowser.topic.waitUntilPostTextIs(lastReplyNr, trilliansReplyOne_skipsMods);
  });

  it("... now there's Trillian's auto appr reply, and Merche's unappr reply", () => {
    const counts = trilliansBrowser.topic.countReplies();
    logBoring(`Reply counts: ${JSON.stringify(counts)}`);
    assert.deepEq(counts, { numNormal: 1, numPreviews: 0, numUnapproved: 1, numDeleted: 0 });
  });



  it("Trillian leaves, Maria arrives", () => {
    trilliansBrowser.topbar.clickLogout();
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  let lastApprovedPostNr;

  it("Maria is a Basic member, won't get moderated", () => {
    mariasBrowser.complex.replyToPostNr(lastReplyNr, mariasReplyOne_skipsMods);
    mariasBrowser.complex.replyToPostNr(lastReplyNr, mariasReplyTwo_skipsMods);
    mariasBrowser.complex.replyToPostNr(lastReplyNr, mariasReplyThree_skipsMods);
    lastReplyNr += 3;
    lastApprovedPostNr = lastReplyNr;
    mariasBrowser.topic.waitUntilPostTextIs(lastReplyNr, mariasReplyThree_skipsMods);
  });

  it(`... now there's Merche's unapproved reply, 
        and Trillian's + Maria's 1 + 3 auto appr replies`, () => {
    const counts = mariasBrowser.topic.countReplies();
    logBoring(`Reply counts: ${JSON.stringify(counts)}`);
    assert.deepEq(counts, {
          numNormal: 1 + 3, numPreviews: 0, numUnapproved: 1, numDeleted: 0 });
  });



  it("Merche leaves", () => {
    merchesBrowser.topbar.clickLogout();
  });

  it("Owen logs in to the admin area", () => {
    owensBrowser.adminArea.settings.moderation.goHere(site.origin, { loginAs: owen });
  });

  it(`Owen changes the appr-before limit from New to Basic Member
        — this includes Maria`, () => {
    owensBrowser.adminArea.settings.moderation.setApproveBeforeTrustLevel(
          c.TestTrustLevel.Basic);
  });

  it("... saves", () => {
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("Maria posts two more replies — will be pending mod", () => {
    mariasBrowser.complex.replyToPostNr(lastApprovedPostNr, mariasReplyFour);
    mariasBrowser.complex.replyToPostNr(lastApprovedPostNr, mariasReplyFive);
    lastReplyNr += 2;
  });

  it("... but shown directly", () => {
    mariasBrowser.topic.waitUntilPostTextIs(lastReplyNr, mariasReplyFive);
  });

  it("Maria cannot post more — max 2 pending mod", () => {
    mariasBrowser.complex.replyToPostNr(lastApprovedPostNr, mariasReplySix);
    mariasBrowser.serverErrorDialog.waitForTooManyPendingApproval();
    mariasBrowser.serverErrorDialog.close();
  });

  it(`... her previous 2 was enqueued for moderation`, () => {
    mariasBrowser.preview.waitForExist('', { where: 'InPage' });
    const counts = mariasBrowser.topic.countReplies();
    logBoring(`Reply counts: ${JSON.stringify(counts)}`);
    const numUnapproved = 1 + 2; // Merche's 1 + Maria's 2
    assert.deepEq(counts, { numNormal: 4, numPreviews: 1, numUnapproved, numDeleted: 0 });
  });



  it("Owen goes to the Moderation tab", () => {
    owensBrowser.adminArea.review.goHere();
  });

  it("There are 2 + 2 = Merche's and Maria's posts waiting for review", () => {
    // Merche: 1 page, 1 reply.  Maria: 2 replies.
    assert.eq(owensBrowser.adminArea.review.countThingsToReview(), 2 + 2);
  });

  it(`Owen okays Maria's posts 'mariasReplyFive'`, () => {
    // Maria's posts are the most recent ones:  mariasReplyFour,  mariasReplyFive
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
  });

  it("... waits until the server is done", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions(owensPageId, lastReplyNr);
  });

  it("Now Maria can post one more reply", () => {
    mariasBrowser.complex.replyToPostNr(lastApprovedPostNr, mariasReplySix);
    lastReplyNr += 1;
  });

  it("... but not two", () => {
    mariasBrowser.complex.replyToPostNr(lastApprovedPostNr, mariasReplySeven);
    mariasBrowser.serverErrorDialog.waitForTooManyPendingApproval();
    mariasBrowser.serverErrorDialog.close();
  });



  it("Owen zeroes the Approve-Before trust level", () => {
    owensBrowser.adminArea.settings.moderation.goHere();
    owensBrowser.adminArea.settings.moderation.setApproveBeforeTrustLevel(0);
  });
  it("... but sets Num-first-to-approve-before to 2", () => {
    owensBrowser.adminArea.settings.moderation.setNumFirstToApproveBefore(2);
  });
  it("... and max pending approval, to 2  (do although was 2 already, just to test)", () => {
    owensBrowser.adminArea.settings.moderation.setMaxNumPendingApproval(2);
  });
  it("... saves", () => {
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("Maria still cannot post more replies — just 1 of 2 first posts yet approved", () => {
    mariasBrowser.complex.replyToPostNr(lastApprovedPostNr, mariasReplySeven);
  });
  it("... there's a First-posts-not-approved error dialog", () => {
    mariasBrowser.serverErrorDialog.waitForFirstPostsNotApproved();
    mariasBrowser.serverErrorDialog.close();
  });


  it("... but Owen goes to the Moderation tab", () => {
    owensBrowser.adminArea.review.goHere();
  });
  it("... and approves another one of Maria's replies:  mariasReplySix", () => {
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
  });
  it("... waits until the server is done", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions(owensPageId, lastReplyNr);
  });
  it("Refresh page", () => {
    mariasBrowser.refresh2();
    mariasBrowser.waitForMyDataAdded();
    lastApprovedPostNr = lastReplyNr;
  });


  it("Now Maria can post as many replies as she wants", () => {
    mariasBrowser.complex.replyToPostNr(lastApprovedPostNr, mariasReplySeven);
    lastReplyNr += 1;
    lastApprovedPostNr = lastReplyNr;
    // (Reply to bottom-most posts, so won't need to scroll up to the OP
    // reply button all the time.)
    mariasBrowser.complex.replyToPostNr(lastApprovedPostNr, mariasReplyEight);
    mariasBrowser.complex.replyToPostNr(lastApprovedPostNr, mariasReplyNine);
    mariasBrowser.complex.replyToPostNr(lastApprovedPostNr, mariasReplyTen);
    mariasBrowser.complex.replyToPostNr(lastApprovedPostNr, mariasReplyEleven);
    lastReplyNr += 4;
    lastApprovedPostNr = lastReplyNr;
  });

  it("... they all appear directly, also for strangers", () => {
    mariasBrowser.topbar.clickLogout();

    assert.eq(lastReplyNr, c.FirstReplyNr + 11 + 1); // ttt
    strangersBrowser.topic.waitUntilPostTextIs(lastReplyNr, mariasReplyEleven);
    const counts = strangersBrowser.topic.countReplies();
    logBoring(`Reply counts: ${JSON.stringify(counts)}`);
    assert.deepEq(counts, {
          numNormal: 11 + 1, // Maria + Trillian
          numPreviews: 0,
          numUnapproved: 1, // Merche
          numDeleted: 0 });
  });



  it("Trillian is back", () => {
    trilliansBrowser.complex.loginWithPasswordViaTopbar(trillian);
  });

  it("... she posts a 2nd and 3rd post — but won't get approved", () => {
    // because Owen configured require-approval-before of everyone's 2 first posts.
    trilliansBrowser.complex.replyToPostNr(lastApprovedPostNr, trilliansReplyTwo_reqApprBef);
    trilliansBrowser.complex.replyToPostNr(lastApprovedPostNr, trilliansReplyThree_reqApprBef);
    lastReplyNr += 2;
  });

  it("... then she has to *wait*! with posting more — max pending = 2", () => {
    trilliansBrowser.complex.replyToPostNr(lastApprovedPostNr, trilliansReplyFour);
  });
  it("... there's the First-posts-not-approved error dialog", () => {
    trilliansBrowser.serverErrorDialog.waitForFirstPostsNotApproved();
    trilliansBrowser.serverErrorDialog.close();
  });

  let numToModerate: number;
  let numTotal: number;

  it("There are 2 + 1 + 2 = Merche's, Maria's and Trillian's posts waiting for review", () => {
    numToModerate =
        2 +  // Merche's topic and reply
        1 +  // mariasReplyFour
        2;   // Trillian's two last replies
    numTotal = numToModerate + 2;  // already approved: mariasReplyFive & -Six
    owensBrowser.refresh2();
    assert.eq(owensBrowser.adminArea.review.countThingsToReview(), numTotal);
  });



  it("Owen checks the 'Hide completed' checkbox  TyT05KD2SM1", () => {
    owensBrowser.adminArea.review.hideCompletedTasks();
  });

  it("... sees only pending tasks", () => {
    assert.eq(owensBrowser.adminArea.review.countThingsToReview(), numToModerate);
  });



  it("Owen approves Trillian's replies", () => {
    // Trillian posted the two most recent replies.
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
    numToModerate -= 2;
  });

  it("... waits until the server is done", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions(owensPageId, lastReplyNr);
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions(owensPageId, lastReplyNr - 1);
  });

  it("Now Trillian can post more replies — because her first posts got approved", () => {
    trilliansBrowser.complex.replyToPostNr(lastApprovedPostNr, trilliansReplyFour);
    trilliansBrowser.complex.replyToPostNr(lastApprovedPostNr, trilliansReplyFive);
    trilliansBrowser.complex.replyToPostNr(lastApprovedPostNr, trilliansReplySix);
    lastReplyNr += 3;
    lastApprovedPostNr = lastReplyNr;
  });

  it("... they appear directly, also for strangers", () => {
    trilliansBrowser.scrollToTop();  // speed up test [305RKTJ205]
    trilliansBrowser.topbar.clickLogout();
    strangersBrowser.topic.waitUntilPostTextIs(lastReplyNr, trilliansReplySix);
    const counts = strangersBrowser.topic.countReplies();
    logBoring(`Reply counts: ${JSON.stringify(counts)}`);
    assert.deepEq(counts, {
          numNormal: 11 + 6, // Maria + Trillian
          numPreviews: 0,
          numUnapproved: 1, // Merche's reply
          numDeleted: 0 });
  });

  it("Nothing more to review for Owen", () => {
    owensBrowser.refresh2();
    owensBrowser.adminArea.review.hideCompletedTasks();
    assert.eq(owensBrowser.adminArea.review.countThingsToReview(), numToModerate);
  });


  // TESTS_MISSING maybe verify that Merche still cannot post more?

});

