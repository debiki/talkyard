/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');





let forum: LargeTestForum;

let everyonesBrowsers;
let staffsBrowser: TyE2eTestBrowser;
let othersBrowser: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let michael: Member;
let michael_brB: TyE2eTestBrowser;
let mallory: Member;
let mallory_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;


let siteIdAddress: IdAddress;
let forumTitle = "Admin Review Invalidate Tasks about a reply";

let discussionPageUrl: string;
let directMessageUrl: string;

const angryReplyOne = 'angryReplyOne';
const angryReplyOneNr = c.FirstReplyNr;
const angryReplyTwo = 'angryReplyTwo';
const angryReplyTwoNr = c.FirstReplyNr + 1;

const mallorysMessageTitle = "Want money? Get $90 for free";
const mallorysMessageText = "You'll get $90 for free! If you send $99 to me: mallory@clever.ideas";


describe("mod-review  TyT5WB2R0", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addLargeForum({ title: forumTitle, members: null /* default = everyone */ });
    builder.addPost({
      page: forum.topics.byMichaelCategoryA,
      nr: angryReplyOneNr,
      parentNr: c.BodyNr,
      authorId: forum.members.mallory.id,
      approvedSource: angryReplyOne,
    });
    builder.addPost({
      page: forum.topics.byMichaelCategoryA,
      nr: angryReplyTwoNr,
      parentNr: c.BodyNr,
      authorId: forum.members.mallory.id,
      approvedSource: angryReplyTwo,
    });
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    discussionPageUrl = siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    staffsBrowser = new TyE2eTestBrowser(browserA);
    othersBrowser = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owen_brA = staffsBrowser;

    maria = forum.members.maria;
    maria_brB = othersBrowser;
    michael = forum.members.michael;
    michael_brB = othersBrowser;
    mallory = forum.members.mallory;
    mallory_brB = othersBrowser;
    stranger_brB = othersBrowser;
  });

  it("Mallory has posted 2 spammy replies. He now sends a spammy message to Michael", () => {
    mallory_brB.go(discussionPageUrl);
    mallory_brB.complex.loginWithPasswordViaTopbar(mallory);
    mallory_brB.complex.sendMessageToPageAuthor(mallorysMessageTitle, mallorysMessageText);
    directMessageUrl = mallory_brB.getUrl();
  });

  it("Michael flags two angry replies by Mallory", () => {
    mallory_brB.go(discussionPageUrl);
    mallory_brB.topbar.clickLogout();
    michael_brB.complex.loginWithPasswordViaTopbar(michael);
    michael_brB.complex.flagPost(angryReplyOneNr, 'Inapt');
    michael_brB.complex.flagPost(angryReplyTwoNr, 'Inapt');
  });

  it("... and the direct message", () => {
    michael_brB.topbar.openNotfToMe();
    michael_brB.complex.flagPost(c.BodyNr, 'Inapt');
  });

  it("Maria logs in, sees no review tasks, she isn't a staff member", () => {
    michael_brB.topbar.clickLogout();
    maria_brB.complex.loginWithPasswordViaTopbar(maria);
    maria_brB.topbar.waitForMyMenuVisible();
    assert(!maria_brB.topbar.isNeedsReviewUrgentVisible());
    assert(!maria_brB.topbar.isNeedsReviewOtherVisible());
  });

  it("Owen arrives, sees there're 3 high priority things to review", () => {
    owen_brA.go(siteIdAddress.origin);
    owen_brA.complex.loginWithPasswordViaTopbar(owen);
    owen_brA.topbar.waitForNumPendingUrgentReviews(3);
    assert(!owen_brA.topbar.isNeedsReviewOtherVisible());
  });

  it("Owen grants Moderator to Maria", () => {
    owen_brA.adminArea.goToUser(forum.members.maria);
    owen_brA.adminArea.user.grantModerator();
  });

  it("Maria now sees the review tasks", () => {
    maria_brB.refresh();
    maria_brB.topbar.waitForNumPendingUrgentReviews(3);
    assert(!maria_brB.topbar.isNeedsReviewOtherVisible());
  });

  it("She cannot access the direct message (only admins can)  TyT6KRBEQ2", () => {
    maria_brB.go(directMessageUrl);
    maria_brB.assertMayNotSeePage();
  });

  it("She goes to the Review page", () => {
    maria_brB.back();
    maria_brB.topbar.myMenu.goToAdminReview();
  });

  it("... and sees only the Users, Groups and Review tabs", () => {
    maria_brB.adminArea.waitAssertVisible();
    assert(maria_brB.adminArea.isReviewTabVisible());
    assert(maria_brB.adminArea.isUsersTabVisible());
    assert.equal(maria_brB.adminArea.numTabsVisible(), 2);
  });

  it("There's a review task for each one of Mallory's replies One and Two", () => {
    const count = maria_brB.adminArea.review.countReviewTasksFor;
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: true }) === 1);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: true }) === 1);
  });

  it("... but she cannot see Mallory's flagged direct message  TyT6KRBEQ2", () => {
    const num = maria_brB.adminArea.review.countThingsToReview();
    assert(num === 2, `Found ${num} things to review`);
  });

  it("Maria reject-delete's Mallory's reply nr 2  TyT4WKBDTQ", () => {
    // Post 2 flagged last, so is at the top.
    maria_brB.adminArea.review.rejectDeleteTaskIndex(1);
  });

  it("... the server carries out Maria's decision", () => {
    maria_brB.adminArea.review.playTimePastUndo();
    maria_brB.adminArea.review.waitForServerToCarryOutDecisions(
        forum.topics.byMichaelCategoryA.id, angryReplyTwoNr);
  });

  it("... then the review tasks for post 2 disappear", () => {
    const count = maria_brB.adminArea.review.countReviewTasksFor;
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: true }) === 0);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: false }) === 1);
  });

  it("... the other task isn't affected", () => {
    const count = maria_brB.adminArea.review.countReviewTasksFor;
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: true }) === 1);
    const num = maria_brB.adminArea.review.countThingsToReview();       // = 2
    //const num = mariasBrowser.adminArea.review.countReviewTasksWaiting(); // = 1 <— better? later.
    assert(num === 2, `Found ${num} things to review`);
  });

  it("Owen sees all review tasks, incl direct message", () => {
    owen_brA.adminArea.goToReview();
    const count = owen_brA.adminArea.review.countReviewTasksFor;
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: true }) === 1);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: false }) === 0);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: true }) === 0);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: false }) === 1);
    // Could check that the flagged direct message appears.
    // Well, Owen clicks it below, so ... it's there, otherwise later test fails (4WBKSD21).
  });

  it("Owen rejects Mallory's private message", () => {
    owen_brA.adminArea.review.rejectDeleteTaskIndex(1);  // task 1 is for the direct message
  });

  it("... the server carries out Owen's decision", () => {
    owen_brA.adminArea.review.playTimePastUndo();
    owen_brA.adminArea.review.waitForServerToCarryOutDecisions(
        forum.topics.byMichaelCategoryA.id, angryReplyTwoNr);
  });

  it("Thereafter, Michael sees spammy post Two is gone", () => {
    maria_brB.topbar.clickLogout();
    michael_brB.go(discussionPageUrl);
    michael_brB.complex.loginWithPasswordViaTopbar(michael);
    michael_brB.topic.waitForLoaded();
    michael_brB.topic.waitUntilPostTextMatches(angryReplyOneNr, angryReplyOne);
    // Post nr Two got rejected-deleted.
    assert(!michael_brB.topic.isPostNrVisible(angryReplyTwoNr));
  });

  it("... and Mallory's priv message got deleted: Michael cannot see it", () => {
    michael_brB.go(directMessageUrl);
    michael_brB.assertNotFoundError({ whyNot: 'PageDeleted' }); // (4WBKSD21)
  });

  it("... owen can see it, and that it's been deleted", () => {
    owen_brA.go(directMessageUrl);
    owen_brA.topic.waitUntilPageDeleted();
  });

  it("Owen thinks Michael wants $90 after all, and undeletes the page", () => {
    owen_brA.topbar.pageTools.restorePage();
  });

  it("Now Michael sees it again", () => {
    michael_brB.refresh2();
    michael_brB.topic.assertPostTextIs(c.TitleNr, mallorysMessageTitle, { wait: true });
  });

});

