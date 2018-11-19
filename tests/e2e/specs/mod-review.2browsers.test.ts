/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

let forum: LargeTestForum;

let everyonesBrowsers;
let staffsBrowser;
let othersBrowser;
let owen: Member;
let owensBrowser;
let maria: Member;
let mariasBrowser;
let michael: Member;
let michaelsBrowser;
let mallory: Member;
let mallorysBrowser;
let strangersBrowser;


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
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    staffsBrowser = _.assign(browserA, pagesFor(browserA));
    othersBrowser = _.assign(browserB, pagesFor(browserB));

    owen = forum.members.owen;
    owensBrowser = staffsBrowser;

    maria = forum.members.maria;
    mariasBrowser = othersBrowser;
    michael = forum.members.michael;
    michaelsBrowser = othersBrowser;
    mallory = forum.members.mallory;
    mallorysBrowser = othersBrowser;
    strangersBrowser = othersBrowser;
  });

  it("Mallory has posted 2 spammy replies. He now sends a spammy message to Michael", () => {
    mallorysBrowser.go(discussionPageUrl);
    mallorysBrowser.complex.loginWithPasswordViaTopbar(mallory);
    mallorysBrowser.complex.sendMessageToPageAuthor(mallorysMessageTitle, mallorysMessageText);
    directMessageUrl = mallorysBrowser.url().value;
  });

  it("Michael flags two angry replies by Mallory", () => {
    mallorysBrowser.go(discussionPageUrl);
    mallorysBrowser.topbar.clickLogout();
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    michaelsBrowser.complex.flagPost(angryReplyOneNr, 'Inapt');
    michaelsBrowser.complex.flagPost(angryReplyTwoNr, 'Inapt');
  });

  it("... and the direct message", () => {
    michaelsBrowser.topbar.openNotfToMe();
    michaelsBrowser.complex.flagPost(c.BodyNr, 'Inapt');
  });

  it("Maria logs in, sees no review tasks, she isn't a staff member", () => {
    michaelsBrowser.topbar.clickLogout();
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.topbar.waitForMyMenuVisible();
    assert(!mariasBrowser.topbar.isNeedsReviewUrgentVisible());
    assert(!mariasBrowser.topbar.isNeedsReviewOtherVisible());
  });

  it("Owen arrives, sees there're 3 high priority things to review", () => {
    owensBrowser.go(siteIdAddress.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    owensBrowser.topbar.waitForNumPendingUrgentReviews(3);
    assert(!owensBrowser.topbar.isNeedsReviewOtherVisible());
  });

  it("Owen grants Moderator to Maria", () => {
    owensBrowser.adminArea.goToUser(forum.members.maria);
    owensBrowser.adminArea.user.grantModerator();
  });

  it("Maria now sees the review tasks", () => {
    mariasBrowser.refresh();
    mariasBrowser.topbar.waitForNumPendingUrgentReviews(3);
    assert(!mariasBrowser.topbar.isNeedsReviewOtherVisible());
  });

  it("She cannot access the direct message (only admins can)  TyT6KRBEQ2", () => {
    mariasBrowser.go(directMessageUrl);
    mariasBrowser.assertMayNotSeePage();
  });

  it("She goes to the Review page", () => {
    mariasBrowser.back();
    mariasBrowser.topbar.myMenu.goToAdminReview();
  });

  it("... and sees only the Users, Groups and Review tabs", () => {
    mariasBrowser.adminArea.waitAssertVisible();
    assert(mariasBrowser.adminArea.isReviewTabVisible());
    assert(mariasBrowser.adminArea.isUsersTabVisible());
    assert(mariasBrowser.adminArea.isGroupsTabVisible());
    assert.equal(mariasBrowser.adminArea.numTabsVisible(), 3);
  });

  it("There's a review task for each one of Mallory's replies One and Two", () => {
    const count = mariasBrowser.adminArea.review.countReviewTasksFor;
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: true }) === 1);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: true }) === 1);
  });

  it("... but she cannot see Mallory's flagged direct message  TyT6KRBEQ2", () => {
    const num = mariasBrowser.adminArea.review.countThingsToReview();
    assert(num === 2, `Found ${num} things to review`);
  });

  it("Maria reject-delete's Mallory's reply nr 2  TyT4WKBDTQ", () => {
    // Post 2 flagged last, so is at the top.
    mariasBrowser.adminArea.review.rejectDeleteTaskIndex(1);
  });

  it("... the server carries out Maria's decision", () => {
    mariasBrowser.adminArea.review.playTimePastUndo();
    mariasBrowser.adminArea.review.waitForServerToCarryOutDecisions(
        forum.topics.byMichaelCategoryA.id, angryReplyTwoNr);
  });

  it("... then the review tasks for post 2 disappear", () => {
    const count = mariasBrowser.adminArea.review.countReviewTasksFor;
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: true }) === 0);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: false }) === 1);
  });

  it("... the other task isn't affected", () => {
    const count = mariasBrowser.adminArea.review.countReviewTasksFor;
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: true }) === 1);
    const num = mariasBrowser.adminArea.review.countThingsToReview();       // = 2
    //const num = mariasBrowser.adminArea.review.countReviewTasksWaiting(); // = 1 <— better? later.
    assert(num === 2, `Found ${num} things to review`);
  });

  it("Owen sees all review tasks, incl direct message", () => {
    owensBrowser.adminArea.goToReview();
    const count = owensBrowser.adminArea.review.countReviewTasksFor;
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: true }) === 1);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: false }) === 0);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: true }) === 0);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: false }) === 1);
    // Could check that the flagged direct message appears.
    // Well, Owen clicks it below, so ... it's there, otherwise later test fails (4WBKSD21).
  });

  it("Owen rejects Mallory's private message", () => {
    owensBrowser.adminArea.review.rejectDeleteTaskIndex(1);  // task 1 is for the direct message
  });

  it("... the server carries out Owen's decision", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions(
        forum.topics.byMichaelCategoryA.id, angryReplyTwoNr);
  });

  it("Thereafter, Michael sees spammy post Two is gone", () => {
    mariasBrowser.topbar.clickLogout();
    michaelsBrowser.go(discussionPageUrl);
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    michaelsBrowser.topic.waitForLoaded();
    michaelsBrowser.topic.waitUntilPostTextMatches(angryReplyOneNr, angryReplyOne);
    // Post nr Two got rejected-deleted.
    assert(!michaelsBrowser.topic.isPostNrVisible(angryReplyTwoNr));
  });

  it("... and Mallory's priv message got deleted", () => {
    michaelsBrowser.go(directMessageUrl);
    michaelsBrowser.topic.waitForPostVisibleAsDeleted(c.BodyNr);  // (4WBKSD21)
  });

});

