/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
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
let forumTitle = "Admin Review Invalidate Tasks when Page Deleted";

let discussionPageUrl;

const angryReplyOne = 'angryReplyOne';
const angryReplyOneNr = c.FirstReplyNr;
const angryReplyTwo = 'angryReplyTwo';
const angryReplyTwoNr = c.FirstReplyNr + 1;
const friendlyReplyThree = 'friendlyReplyThree';
const friendlyReplyThreeNr = c.FirstReplyNr + 2;
const friendlyReplyFour = 'friendlyReplyFour';
const friendlyReplyFourNr = c.FirstReplyNr + 3;

describe("admin-review-invalidate-page-deld [TyT5FKBSQ]", () => {

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

  it("Mallory posts two really angry, and two kind and friendly, replies", () => {
    mallorysBrowser.go(discussionPageUrl);
    mallorysBrowser.disableRateLimits();
    mallorysBrowser.complex.loginWithPasswordViaTopbar(mallory);
    mallorysBrowser.complex.replyToOrigPost(angryReplyOne);
    mallorysBrowser.complex.replyToOrigPost(angryReplyTwo);
    mallorysBrowser.complex.replyToOrigPost(friendlyReplyThree);
    mallorysBrowser.complex.replyToOrigPost(friendlyReplyFour);
  });

  it("Maria reads the first angry reply, sees red and flags everything", () => {
    mallorysBrowser.topbar.clickLogout();
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.complex.flagPost(angryReplyOneNr, 'Inapt');
    mariasBrowser.complex.flagPost(angryReplyTwoNr, 'Inapt');
    mariasBrowser.complex.flagPost(friendlyReplyThreeNr, 'Inapt');
    mariasBrowser.complex.flagPost(friendlyReplyFourNr, 'Inapt');
  });

  it("Owen arrives", () => {
    owensBrowser.adminArea.goToReview(siteIdAddress.origin, { loginAs: owen });
  });

  it("... sees there're 4 urgent things to review", () => {
    owensBrowser.topbar.waitForNumPendingUrgentReviews(4); // 4 = Maria's flags
    owensBrowser.topbar.waitForNumPendingOtherReviews(1);  // because reply posted by new user, Mallory
  });

  it("The number of tasks per post are correct", () => {
    const count = owensBrowser.adminArea.review.countReviewTasksFor;
    // 2 tasks for reply one: 1 flag + 1 new users' first post.
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: true }) === 2);
    // 1 task for each one of reply two, three, four.
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: true }) === 1);
    assert(count(forum.topics.byMichaelCategoryA.id, friendlyReplyThreeNr, { waiting: true }) === 1);
    assert(count(forum.topics.byMichaelCategoryA.id, friendlyReplyFourNr, { waiting: true }) === 1);
  });

  it("Owen goes to the discussion page", () => {
    owensBrowser.go(discussionPageUrl);
    owensBrowser.topic.waitUntilTitleMatches(forum.topics.byMichaelCategoryA.title);
  });

  it("... and deletes the whole page", () => {
    owensBrowser.topbar.pageTools.deletePage();
  });

  // Review tasks are:  (4WKBAQ2)
  // task 1 = for reply 4, Maria flagged friendlyReplyFour
  // task 2 = for reply 3, Maria flagged friendlyReplyThree
  // task 3 = for reply 2, Maria flagged angryReplyTwo
  // task 4 = for reply 1, Maria flagged angryReplyOne
  // task 5 = for reply 1, because first post

  it("Owen reject-deletes angry reply 1 (review tasks don't disappear when page deleted)", () => {
    owensBrowser.adminArea.goToReview();
    owensBrowser.adminArea.review.rejectDeleteTaskIndex(4);
  });

  it("... and accepts friendly reply 4", () => {
    owensBrowser.adminArea.review.approvePostForTaskIndex(1);
  });

  it("... the server carries out the decisions", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    const wait = owensBrowser.adminArea.review.waitForServerToCarryOutDecisions;
    wait(forum.topics.byMichaelCategoryA.id, friendlyReplyFourNr);
    owensBrowser.refresh(); // unmount bug workaround [5QKBRQ].
    wait(forum.topics.byMichaelCategoryA.id, angryReplyOneNr);
  });

  it("... then all review tasks for angry reply 1, and friendly reply 4, disappear", () => {  // (5WBQST2)
    const count = owensBrowser.adminArea.review.countReviewTasksFor;
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: true }) === 0);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: false }) === 2);
    assert(count(forum.topics.byMichaelCategoryA.id, friendlyReplyFourNr, { waiting: true }) === 0);
    assert(count(forum.topics.byMichaelCategoryA.id, friendlyReplyFourNr, { waiting: false }) === 1);
  });

  it("Topbar review counts are: 2 urgent, 0 other", () => {
    owensBrowser.topbar.waitForNumPendingUrgentReviews(2);     // Maria's flags for reply 2 and 3
    assert(!owensBrowser.topbar.isNeedsReviewOtherVisible());  // Mallory's new-user-reply got deleted
  });

  it("Owen un-deletes the page", () => {
    owensBrowser.go(discussionPageUrl);
    owensBrowser.topbar.pageTools.restorePage();
  });

  it("... and returns to the review area", () => {
    owensBrowser.adminArea.goToReview();
  });

  it("All tasks are in the same state as before", () => {   // (5WBQST2)
    const count = owensBrowser.adminArea.review.countReviewTasksFor;
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: true }) === 0);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyOneNr, { waiting: false }) === 2);
    assert(count(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr, { waiting: true }) === 1);
    assert(count(forum.topics.byMichaelCategoryA.id, friendlyReplyThreeNr, { waiting: true }) === 1);
    assert(count(forum.topics.byMichaelCategoryA.id, friendlyReplyFourNr, { waiting: true }) === 0);
    assert(count(forum.topics.byMichaelCategoryA.id, friendlyReplyFourNr, { waiting: false }) === 1);
  });

  it("Owen rejects angry reply 2, and approves friendly reply 3", () => {
    // See review task list: (4WKBAQ2)
    owensBrowser.adminArea.review.approvePostForTaskIndex(2);  // friendlyReplyThree
    owensBrowser.adminArea.review.rejectDeleteTaskIndex(3);    // angryReplyTwo
  });

  it("... and now the topbar shows no things-to-review icons", () => {
    assert(!owensBrowser.topbar.isNeedsReviewUrgentVisible());
    assert(!owensBrowser.topbar.isNeedsReviewOtherVisible());
  });

  it("... the server carries out the decisions", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    const wait = owensBrowser.adminArea.review.waitForServerToCarryOutDecisions;
    wait(forum.topics.byMichaelCategoryA.id, friendlyReplyThreeNr);
    wait(forum.topics.byMichaelCategoryA.id, angryReplyTwoNr);
  });

  it("... now no waiting tasks", () => {
    assert(!owensBrowser.adminArea.review.isMoreStuffToReview());
  });

  it("Needs-to-review counts are still zero (i.e. absent)", () => {
    assert(!owensBrowser.topbar.isNeedsReviewUrgentVisible());
    assert(!owensBrowser.topbar.isNeedsReviewOtherVisible());
  });


});

