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

let discussionPageUrl;

const angryReplyOne = 'angryReplyOne';
const angryReplyOneNr = c.FirstReplyNr;
const angryReplyTwo = 'angryReplyTwo';
const angryReplyTwoNr = c.FirstReplyNr + 1;
const angryReplyThree = 'angryReplyThree';
const angryReplyThreeNr = c.FirstReplyNr + 2;

describe("admin-review-invalidate-for-reply [TyT6KWB42A]", () => {

  it("import a site", () => {
    forum = buildSite().addLargeForum({ title: forumTitle, members: null /* default = everyone */ });
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

  it("Mallory posts three very angry replies", () => {
    mallorysBrowser.go(discussionPageUrl);
    mallorysBrowser.complex.loginWithPasswordViaTopbar(mallory);
    mallorysBrowser.complex.replyToOrigPost(angryReplyOne);
    mallorysBrowser.complex.replyToOrigPost(angryReplyTwo);
    mallorysBrowser.complex.replyToOrigPost(angryReplyThree);
  });

  it("Maria flags all of them", () => {
    mallorysBrowser.topbar.clickLogout();
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.complex.flagPost(angryReplyOneNr, 'Inapt');
    mariasBrowser.complex.flagPost(angryReplyTwoNr, 'Inapt');
    mariasBrowser.complex.flagPost(angryReplyThreeNr, 'Inapt')
  });

  it("Michael flags the two first too", () => {
    mariasBrowser.topbar.clickLogout();
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    michaelsBrowser.complex.flagPost(angryReplyOneNr, 'Inapt');
    michaelsBrowser.complex.flagPost(angryReplyTwoNr, 'Inapt');
  });

  it("Owen arrives, sees there're 5 high priority things to review", () => {
    owensBrowser.go(siteIdAddress.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    owensBrowser.topbar.waitForNumPendingUrgentReviews(5); // 3 + 2 = maria's + michael's
    owensBrowser.topbar.waitForNumPendingOtherReviews(1);  // because reply posted by new user = Mallory
  });

  it("The number of tasks per post are correct", () => {
    owensBrowser.adminArea.goToReview();
    const count = owensBrowser.adminArea.review.countReviewTasksFor;
    // 3 tasks for reply one (2 flags + 1, new users' first post)
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: true }) === 3);
    // 2 tasks for reply two (2 flags)
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: true }) === 2);
    // 1 task for reply three (3 flag by Maria only)
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyThreeNr, { waiting: true }) === 1);
  });

  it("Owen reject-delete's Mallory's reply nr 2", () => {
    // Post 2 flagged last, so is at the top.
    owensBrowser.adminArea.review.rejectDeleteTaskIndex(1);
  });

  it("... the server carries out this decision", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions(
        forum.topics.byMichaelCategoryA.id, angryReplyTwoNr);
  });

  it("... then all review tasks for post 2 disappear", () => {
    const count = owensBrowser.adminArea.review.countReviewTasksFor;
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: true }) === 0);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: false }) === 2);
  });

  it("... the others tasks aren't affected", () => {
    const count = owensBrowser.adminArea.review.countReviewTasksFor;
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: true }) === 3);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyThreeNr, { waiting: true }) === 1);
  });

  it("Topbar review counts are correct", () => {
    owensBrowser.topbar.waitForNumPendingUrgentReviews(3); // 2 + 1 = maria's + michael's remaining flags
    owensBrowser.topbar.waitForNumPendingOtherReviews(1);  // because reply posted by new user = Mallory
  });

  it("Owen reject-deletes 2 tasks (out of 3) for post 1", () => {
    // task 1 = for post 2, its last flag, Michael <— rejected already
    // task 2 = for post 1, its last flag, Michael <— **click Delete**
    // task 3 = for post 3, its first flag, Maria
    // task 4 = for post 2, its first flag, Maria  <— rejected already
    // task 5 = for post 1, its first flag, Maria  <— will get invalidated, since post deleted
    // task 6 = for post 1, new user's first post  <— **click Delete**
    owensBrowser.adminArea.review.rejectDeleteTaskIndex(2);
    owensBrowser.adminArea.review.rejectDeleteTaskIndex(6);
  });

  it("... the server carries out the decisions", () => {
    // Because of a React-Router? bug, now worked around [5QKBRQ], the ui failed to auto update
    // completely here, and the test blocked & failed here.  ... but ... see below
    owensBrowser.adminArea.review.playTimePastUndo();

    // [E2EBUG] this problem: [5QKBRQ] happens here, despite the workaround, not sure how that's
    // possible. Hasn't happened in real life though (after the workaround). Anyway, refreshing
    // the page here, updates the UI and then all is fine.
    owensBrowser.refresh();
    owensBrowser.adminArea.review.waitUntilLoaded();

    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions(
        forum.topics.byMichaelCategoryA.id, angryReplyOneNr);
  });

  it("... then all review tasks for post 1 disappear", () => {
    const count = owensBrowser.adminArea.review.countReviewTasksFor;
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: true }) === 0);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: false }) === 3);
  });

  it("So now only a task for angry-reply-three remains", () => {
    const count = owensBrowser.adminArea.review.countReviewTasksFor;
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: true }) === 0);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: false }) === 2);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyThreeNr, { waiting: true }) === 1);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyThreeNr, { waiting: false }) === 0);
  });

  it("Needs-to-review counts are correct", () => {
    owensBrowser.topbar.waitForNumPendingUrgentReviews(1); // Maria flagged angryReplyThree
    assert(!owensBrowser.topbar.isNeedsReviewOtherVisible());
  });

  it("Owen deletes Mallory's angryReplyThree by visiting it directly", () => {
    owensBrowser.go(discussionPageUrl);
    owensBrowser.topic.deletePost(angryReplyThreeNr);
  });

  it("Now there's a 'Keep deleted' button in the Review section, for that post", () => {
    owensBrowser.adminArea.goToReview();
    assert(owensBrowser.adminArea.review.isTasksPostDeleted(angryReplyThreeNr));
    const count = owensBrowser.adminArea.review.countReviewTasksFor;
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyThreeNr, { waiting: true }) === 1);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyThreeNr, { waiting: false }) === 0);
  });

  it("... and still a topbar review icon for that post", () => {
    owensBrowser.topbar.waitForVisible();
    // UX SHOULD not show as Urgent. It's been deleted, not urgent any longer. [5WKBQRS0]
    owensBrowser.topbar.waitForNumPendingUrgentReviews(1); // Maria flagged post nr 3
    assert(!owensBrowser.topbar.isNeedsReviewOtherVisible());
  });

  it("Owen klicks 'Keep deleted'", () => {
    owensBrowser.adminArea.review.rejectDeleteTaskIndex(3);  // task 3 is for post 3
  });

  it("... the server carries out the decisions", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions(
        forum.topics.byMichaelCategoryA.id, angryReplyThreeNr);
  });

  it("Thereafter, there're no more review tasks waiting", () => {
    assert(!owensBrowser.adminArea.review.isMoreStuffToReview());
  });

  it("... and the topbar needs-review icons are gone", () => {
    assert(!owensBrowser.topbar.isNeedsReviewUrgentVisible());
    assert(!owensBrowser.topbar.isNeedsReviewOtherVisible());
  });

  /* TESTS_MISSING   [UNDELPOST]
  it("Owen undeletes Mallory's post nr 3", () => {
    owensBrowser.go(discussionPageUrl);
    owensBrowser.topic.undeletePost(angryReplyThreeNr);
  });

  it("... its review task then reappears", () => {
  });

  it("... he deletes it by rejecting the review task instead", () => {
  });

  it("Owen also un-deletes Mallory's first reply", () => {
  });

  it("... its review task then reappears, except for the one whose Delete btn clicked", () => {
  });  */

});

