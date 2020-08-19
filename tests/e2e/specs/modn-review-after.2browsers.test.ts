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
let trillian: Member;
let trilliansBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let site: IdAddress;

let forum: EmptyTestForum;
const owensPagePath = '/owens-page';
let owensPageId;

const mariasReplyOne = 'mariasReplyOne';
const mariasReplyTwo = 'mariasReplyTwo';
const mariasReplyThree = 'mariasReplyThree';
const mariasReplyFour = 'mariasReplyFour';
const mariasReplyFive = 'mariasReplyFive';
const mariasReplySix = 'mariasReplySix';
const mariasReplySeven = 'mariasReplySeven';
const mariasReplyEight = 'mariasReplyEight';
const mariasReplyNine = 'mariasReplyNine';
const mariasReplyTen = 'mariasReplyTen';
const mariasReplyEleven = 'mariasReplyEleven';

const trilliansReplyOne_skipsMods = 'trilliansReplyOne_skipsMods';
const trilliansReplyTwo_reqRevwAftr = 'trilliansReplyTwo_reqRevwAftr';
const trilliansReplyThree = 'trilliansReplyThree';
const trilliansReplyFour = 'trilliansReplyFour';

describe("modn-review-after  TyTE2E402GRM", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "Review After Forum",
      members: ['trillian', 'maria', 'owen'],
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
    siteData.settings.numFirstPostsToApprove = 0;
    siteData.settings.requireApprovalIfTrustLte = 0;
    siteData.settings.maxPostsPendApprBefore = 0;

    siteData.settings.numFirstPostsToReview = 0;
    siteData.settings.reviewAfterIfTrustLte = 2;
    siteData.settings.maxPostsPendRevwAftr = 3;

    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    trillian = forum.members.trillian;
    trilliansBrowser = richBrowserB;
    // Trust level is: Trusted Member.

    maria = forum.members.maria;
    maria.trustLevel = c.TestTrustLevel.Basic;
    mariasBrowser = richBrowserB;

    strangersBrowser = richBrowserB;

    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });



  // ----- ttt: Verify that Trillian can post


  it("Trillian arrives", () => {
    trilliansBrowser.go2(site.origin + owensPagePath);
    trilliansBrowser.complex.loginWithPasswordViaTopbar(trillian);
    owensPageId = trilliansBrowser.getPageId();
  });

  let lastReplyNr;
  let lastApprovedReplyNr;

  it("She's a trusted member, her posts won't get queued for moderation", () => {
    trilliansBrowser.complex.replyToOrigPost(trilliansReplyOne_skipsMods);
    trilliansBrowser.topic.waitUntilPostTextIs(c.FirstReplyNr, trilliansReplyOne_skipsMods);
    lastReplyNr = lastApprovedReplyNr = c.FirstReplyNr;
  });

  it("... now there's Trillian's auto appr reply", () => {
    const counts = trilliansBrowser.topic.countReplies();
    logBoring(`Reply counts: ${JSON.stringify(counts)}`);
    assert.deepEq(counts, { numNormal: 1, numPreviews: 0, numUnapproved: 0, numDeleted: 0 });
  });



  // ----- Too many posts pending review-after


  it("Trillian leaves, Maria arrives", () => {
    trilliansBrowser.topbar.clickLogout();
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("Maria can post three replies", () => {
    mariasBrowser.complex.replyToPostNr(lastApprovedReplyNr, mariasReplyOne);
    mariasBrowser.complex.replyToPostNr(lastApprovedReplyNr, mariasReplyTwo);
    mariasBrowser.complex.replyToPostNr(lastApprovedReplyNr, mariasReplyThree);
    lastReplyNr += 3;
    lastApprovedReplyNr = lastReplyNr;
  });

  it("... they appear directly — Owen will review them *after*", () => {
    // Trillian's + Maria's 3 replies
    assert.eq(lastReplyNr, c.FirstReplyNr + 3);  // ttt
    mariasBrowser.topic.waitForPostAssertTextMatches(lastReplyNr, mariasReplyThree);
    const counts = mariasBrowser.topic.countReplies();
    logBoring(`Reply counts: ${JSON.stringify(counts)}`);
    assert.deepEq(counts, {
          numNormal: 1 + 3,
          numPreviews: 0,
          numUnapproved: 0,
          numDeleted: 0 });
  });

  it("Maria cannot post a 4th reply — would be > the 3-pending-review limit", () => {
    mariasBrowser.complex.replyToPostNr(lastApprovedReplyNr, mariasReplyFour);
  });
  it(`... she sees: "cannot post more until ... reviewed"`, () => {
    mariasBrowser.serverErrorDialog.waitForTooManyPendingReview();
    mariasBrowser.serverErrorDialog.close();
  });



  it("Owen logs in to the admin area", () => {
    owensBrowser.adminArea.settings.moderation.goHere(site.origin, { loginAs: owen });
  });

  it("Owen bumps max-num-pending-review from 3 to 4", () => {
    owensBrowser.adminArea.settings.moderation.setMaxNumPendingReview(4);
  });

  it("... saves", () => {
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("... now Maria can post one more reply  (gets auto approved)", () => {
    mariasBrowser.complex.replyToPostNr(lastApprovedReplyNr, mariasReplyFour);
    lastReplyNr += 1;
    lastApprovedReplyNr = lastReplyNr;
  });

  it("... but not two", () => {
    mariasBrowser.complex.replyToPostNr(lastApprovedReplyNr, mariasReplyFive);
  });
  it(`... Maria sees the error dialog again`, () => {
    mariasBrowser.serverErrorDialog.waitForTooManyPendingReview();
    mariasBrowser.serverErrorDialog.close();
  });



  it("Owen goes to the Moderation tab", () => {
    owensBrowser.adminArea.review.goHere();
  });

  it("Maria's 4 posts are waiting for review  (but approved & published already)", () => {
    assert.eq(owensBrowser.adminArea.review.countThingsToReview(), 4);
  });

  it("Owen okays two of Maria's posts", () => {   // (0MFGJ462)
    // Maria's posts are the most recent ones:  mariasReplyThree and mariasReplyFour
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
  });

  it("... waits until the server is done", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions(owensPageId, lastReplyNr);
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions(owensPageId, lastReplyNr - 1);
  });

  it("Now Maria can post two more replies", () => {
    mariasBrowser.complex.replyToPostNr(lastApprovedReplyNr, mariasReplyFive);
    mariasBrowser.complex.replyToPostNr(lastApprovedReplyNr, mariasReplySix);
    lastReplyNr += 2;
  });
  it("... they become visible directly", () => {
    mariasBrowser.topic.waitUntilPostTextIs(lastReplyNr, mariasReplySix); // ttt
  });

  it("... but cannot post a third:  3 pending review-after, already", () => {
    mariasBrowser.complex.replyToPostNr(lastApprovedReplyNr, mariasReplySeven);
    mariasBrowser.serverErrorDialog.waitForTooManyPendingReview();
    mariasBrowser.serverErrorDialog.close();
  });



  it("Owen zeroes the Review-After trust level", () => {
    owensBrowser.adminArea.settings.moderation.goHere();
    owensBrowser.adminArea.settings.moderation.setReviewAfterTrustLevel(0);
  });
  it("... but sets Num-first-to-review-after to 1", () => {
    owensBrowser.adminArea.settings.moderation.setNumFirstToReviewAfter(1);
  });
  it("... and max pending to review, to just 1", () => {
    owensBrowser.adminArea.settings.moderation.setMaxNumPendingReview(1);
  });
  it("... saves", () => {
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it(`Now Maria can post as many replies as she wants
        — one of her first replies has already beeen approved`, () => {
    mariasBrowser.complex.replyToPostNr(lastApprovedReplyNr, mariasReplySeven);
    lastReplyNr += 1;
    lastApprovedReplyNr = lastReplyNr;
    mariasBrowser.complex.replyToPostNr(lastApprovedReplyNr, mariasReplyEight);
    mariasBrowser.complex.replyToPostNr(lastApprovedReplyNr, mariasReplyNine);
    mariasBrowser.complex.replyToPostNr(lastApprovedReplyNr, mariasReplyTen);
    mariasBrowser.complex.replyToPostNr(lastApprovedReplyNr, mariasReplyEleven);
    lastReplyNr += 4;
    lastApprovedReplyNr = lastReplyNr;
  });

  it("... they all appear directly, also for strangers", () => {
    mariasBrowser.topbar.clickLogout();

    // Trillian: 1 reply, Maria: 11.
    assert.eq(lastReplyNr, c.FirstReplyNr + 11);  // ttt
    strangersBrowser.topic.waitUntilPostTextIs(lastReplyNr, mariasReplyEleven);
    const counts = strangersBrowser.topic.countReplies();
    logBoring(`Reply counts: ${JSON.stringify(counts)}`);
    assert.deepEq(counts, {
          numNormal: 11 + 1, // Maria + Trillian
          numPreviews: 0,
          numUnapproved: 0,
          numDeleted: 0 });
  });



  it("Trillian is back", () => {
    trilliansBrowser.complex.loginWithPasswordViaTopbar(trillian);
  });

  it(`... she posts a 2nd post; it gets added to Owen's review queue,
        because Owen configured review of everyone's very first post`, () => {

    // Since none of Trillian's posts has been reviewed, this'll be the 1st one
    // to reviw. (Her very first post skipped moderation.)

    // However, if Trillian had already posted 100 posts that staff had read
    // and replied to, then, should not start moderating the "first" posts now.
    // That's a different e2e test though.

    trilliansBrowser.complex.replyToPostNr(
          lastApprovedReplyNr, trilliansReplyTwo_reqRevwAftr);
    lastReplyNr += 1;
    lastApprovedReplyNr = lastReplyNr;
  });

  /* Not impl!   [05KHAD6KF52]  TESTS_MISSING
  it("... then she has to *wait*! with posting more", () => {
    // because Owen configured max pending reviews = 1.
    trilliansBrowser.complex.replyToOrigPost(trilliansReplyThree);
  });

  it("... there's the too-many-pending-review error dialog", () => {
    trilliansBrowser.serverErrorDialog.waitForTooManyPendingReview();
    trilliansBrowser.serverErrorDialog.close();
  });
  */

  it("Owen goes to the Moderation tab", () => {
    owensBrowser.adminArea.review.goHere();
  });

  let numToModerate: number;
  let numTotal: number;

  it("There are 4 + 1 = Maria's and Trillian's posts waiting for review", () => {
    // Owen never reviewed all Maria's replies — he just zeroed the
    // review-after trust level ...
    numToModerate = 4 + 1;
    numTotal = numToModerate + 2;  // but he did review 2 of Maria's replies (0MFGJ462)
    assert.eq(owensBrowser.adminArea.review.countThingsToReview(), numTotal);
  });



  it("Owen checks the 'Hide completed' checkbox  TyT05KD2SM1", () => {
    owensBrowser.adminArea.review.hideCompletedTasks();
  });
  it("... sees only pending tasks", () => {
    assert.eq(owensBrowser.adminArea.review.countThingsToReview(), numToModerate);
  });



  it("Owen approves Trillian's reply", () => {
    // It's the most recent one.
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
    numToModerate -= 1;
  });

  it("... waits until the server is done", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions(
          owensPageId, lastReplyNr);
  });

  it("Now Trillian can post more replies", () => {
    trilliansBrowser.complex.replyToPostNr(lastApprovedReplyNr, trilliansReplyThree);
    trilliansBrowser.complex.replyToPostNr(lastApprovedReplyNr, trilliansReplyFour);
    lastReplyNr += 2;
    lastApprovedReplyNr = lastReplyNr;
  });

  it("... she sees them directly", () => {
    trilliansBrowser.topic.waitUntilPostTextIs(lastReplyNr, trilliansReplyFour);
  });

  it("... also strangers see them", () => {
    trilliansBrowser.scrollToTop();  // speed up test [305RKTJ205]
    trilliansBrowser.topbar.clickLogout();

    strangersBrowser.topic.waitUntilPostTextIs(lastReplyNr, trilliansReplyFour);
    const counts = strangersBrowser.topic.countReplies();
    logBoring(`Reply counts: ${JSON.stringify(counts)}`);
    assert.deepEq(counts, {
          numNormal: 11 + 4, // Maria + Trillian
          numPreviews: 0,
          numUnapproved: 0,
          numDeleted: 0 });
  });

  it("Nothing more to review for Owen", () => {
    owensBrowser.adminArea.review.hideCompletedTasks();
    assert.eq(owensBrowser.adminArea.review.countThingsToReview(), numToModerate);
  });


});

