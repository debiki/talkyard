/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;
declare let browserA: any;
declare let browserB: any;

let everyone;
let owen;
let owensBrowser;
let maja;
let majasBrowser;
let guest;
let guestsBrowser;
let strangersBrowser;

let idAddress: IdAddress;
let forumTitle = "New User Reveiw Forum";

let topics = {
  majasTopicTitle: "Icecream?",
  majasTopicText: "I can haz icecream?",
  majasTopicUrl: '',
  oldTopicTitle: "Old Topic",
  oldTopicUrl: 'old_topic',
};

const majasReplyOne = "My appears-directly first reply, post nr 2";
const guestsFirstReplyBecomesPostNr6 = "I'm a guest, becomes post nr 6.";
const guestsSecondReplyBecomesPostNr7 = "I'm a guest, my 2nd reply, post nr 7.";


describe("new user, review, ok   TyT39657MRDT2", () => {

  it("initialize people", () => {
    everyone = _.assign(browser, pagesFor(browser));
    owensBrowser = _.assign(browserA, pagesFor(browserA));
    majasBrowser = _.assign(browserB, pagesFor(browserB));
    guestsBrowser = majasBrowser;
    strangersBrowser = majasBrowser;

    owen = make.memberOwenOwner();
    maja = make.memberMaja();
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('newusrrvw', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;
    site.settings.mayPostBeforeEmailVerified = true; // remove later, if email not required [0KPS2J]
    // This means a new member can post any number of posts (subjected to new user rate
    // limits), and they'll be shown directly — but the first 2 will be enqueued for review
    // by staff.
    site.settings.numFirstPostsToReview = 2;
    site.members.push(maja);

    let page = make.page({
      id: topics.oldTopicUrl,
      role: c.TestPageRole.Discussion,
      authorId: maja.id,
      categoryId: 2,
    });
    site.pages.push(page);
    site.pagePaths.push(make.pagePath(page.id, '/', false, 'old-topic'));
    site.posts.push(make.post({ page: page, nr: c.TitleNr, approvedSource: topics.oldTopicTitle }));
    site.posts.push(make.post({ page: page, nr: c.BodyNr, approvedSource: 'Text text text.' }));

    idAddress = server.importSiteData(site);
  });


  // Maja posts stuff
  // -------------------------------------

  it("Maja logs in", () => {
    majasBrowser.go(idAddress.origin);
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
    majasBrowser.disableRateLimits();
  });

  it("... posts a topic", () => {
    majasBrowser.complex.createAndSaveTopic(
      { title: topics.majasTopicTitle, body: topics.majasTopicText, matchAfter: false });
    topics.majasTopicUrl = majasBrowser.getUrl();
  });

  it("... it doesn't need to be approved by staff, before shown", () => {
    majasBrowser.topic.assertPageNotPendingApproval();
  });

  it("Owen got a review task notification (to review after topic shown already)", () => {
    server.waitUntilLastEmailMatches(
        idAddress.id, owen.emailAddress, topics.majasTopicText, owensBrowser);  // revw task notf 1
  });

  it("... she posts three replies to an old topic", () => {
    majasBrowser.go('/');
    majasBrowser.forumTopicList.goToTopic(topics.oldTopicTitle);
  });

  it("... reply 1", () => {
    majasBrowser.complex.replyToOrigPost(majasReplyOne);
  });

  it("... Owen gets a notification for reply 1", () => {
    server.waitUntilLastEmailMatches(
        idAddress.id, owen.emailAddress, majasReplyOne, owensBrowser);  // revw task notf 2
  });

  it("... reply 2 and 3", () => {
    majasBrowser.complex.replyToOrigPost("My appears-directly second reply");
    majasBrowser.complex.replyToOrigPost("One two three, done.");
  });

  it("... Owen got no review task notfs for replies 2 and 3 — numFirstPostsToReview is only 2", () => {
    // ... so only the two first posts by a new user (Maja) generate any notifications.
    server.waitUntilLastEmailMatches(
        idAddress.id, owen.emailAddress, majasReplyOne, owensBrowser);

    topics.oldTopicUrl = majasBrowser.getUrl();
  });

  it("... they don't need to be approved by staff, before they're shown", () => {
    majasBrowser.topic.assertPostNotPendingApproval(2);
    majasBrowser.topic.assertPostNotPendingApproval(3, { wait: false });
    majasBrowser.topic.assertPostNotPendingApproval(4, { wait: false });
  });

  // Todo: Verify cannot post more than this. Set allow = 4 ?


  // A stranger sees Maja's posts
  // -------------------------------------

  it("Maja leaves, a stranger arrives", () => {
    majasBrowser.go('/');
    majasBrowser.topbar.clickLogout();
    assert(majasBrowser === strangersBrowser);
  });

  it("The stranger sees Maja's topic in the topic list", () => {
    strangersBrowser.refresh();
    strangersBrowser.forumTopicList.waitForTopics();
    strangersBrowser.forumTopicList.assertNumVisible(2);
    strangersBrowser.forumTopicList.assertTopicVisible(topics.oldTopicTitle);
    strangersBrowser.forumTopicList.assertTopicVisible(topics.majasTopicTitle);
  });

  it("... and sees Maja's replies", () => {
    strangersBrowser.go(topics.oldTopicUrl);
    strangersBrowser.topic.assertPostNotPendingApproval(2);
    strangersBrowser.topic.assertPostNotPendingApproval(3, { wait: false });
    strangersBrowser.topic.assertPostNotPendingApproval(4, { wait: false });
  });

  it("... and can access Maja' page", () => {
    strangersBrowser.go(topics.majasTopicUrl);
    strangersBrowser.topic.assertPageNotPendingApproval();
  });


  // Owen reviews
  // -------------------------------------

  it("Owen logs in", () => {
    owensBrowser.go(idAddress.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... goes to the admin area", () => {
    owensBrowser.topbar.myMenu.goToAdminReview();
  });

  it("... reviews Maja's first reply, it looks ok", () => {
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
  });

  it("... and reviews Maja's second reply, also ok", () => {
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
  });

  it("... the server carries out the review decisions", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions();
  });

  it("... now there's nothing more to review", () => {
    assert(!owensBrowser.adminArea.review.isMoreStuffToReview());
    owensBrowser.refresh();
    owensBrowser.adminArea.goToReview(); // avoid mysterious unmount [5QKBRQ].
    assert(!owensBrowser.adminArea.review.isMoreStuffToReview());
  });


  // Nothing has changed, for the stranger
  // -------------------------------------

  it("The stranger can still access Maja's topic", () => {
    strangersBrowser.assertUrlIs(topics.majasTopicUrl);
    strangersBrowser.topic.assertPageNotPendingApproval();
  });

  it("... still sees Maja's old replies", () => {
    strangersBrowser.go(topics.oldTopicUrl);
    strangersBrowser.topic.assertPostNotPendingApproval(2);
    strangersBrowser.topic.assertPostNotPendingApproval(3, { wait: false });
    strangersBrowser.topic.assertPostNotPendingApproval(4, { wait: false });
  });

  it("... still sees Maja's topic in the topic list", () => {
    strangersBrowser.go('/');
    strangersBrowser.forumTopicList.waitForTopics();
    strangersBrowser.forumTopicList.assertNumVisible(2);
    strangersBrowser.forumTopicList.assertTopicVisible(topics.oldTopicTitle);
    strangersBrowser.forumTopicList.assertTopicVisible(topics.majasTopicTitle);
  });


  // Maja allowed, no more reviews needed
  // -------------------------------------

  it("Maja can post more replies, without them being queued for approval", () => {
    assert(strangersBrowser === majasBrowser);
    majasBrowser.go(topics.oldTopicUrl);
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
    majasBrowser.complex.replyToOrigPost("My last reply");
    majasBrowser.topic.assertPostNotPendingApproval(5);
  });

  it("The stranger sees all Maja's replies", () => {
    majasBrowser.topbar.clickLogout();
    assert(majasBrowser === strangersBrowser);
    strangersBrowser.topic.assertPostNotPendingApproval(5);
  });

  it("The admin doesn't need to review", () => {
    owensBrowser.refresh();
    owensBrowser.adminArea.goToReview(); // avoid mysterious unmount [5QKBRQ].
    assert(!owensBrowser.adminArea.review.isMoreStuffToReview());
  });

  it("And Owen gets no more review task emails, for Maja", () => {
    server.assertLastEmailMatches(
        idAddress.id, owen.emailAddress, majasReplyOne, owensBrowser);
  });


  // Quick guest test: Guests are also enqueued for review
  // -------------------------------------

  it("A guest arrives", () => {
    assert(strangersBrowser === guestsBrowser);
    guestsBrowser.complex.signUpAsGuestViaTopbar("I-The-Guest");
  });

  it("... and posts a reply to the orig post", () => {
    guestsBrowser.complex.replyToOrigPost(guestsFirstReplyBecomesPostNr6);
  });

  it("... Owen gets a review task notification for the guest's reply", () => {
    server.waitUntilLastEmailMatches(
        idAddress.id, owen.emailAddress, guestsFirstReplyBecomesPostNr6, owensBrowser);
  });

  it("... the guest posts two more replies to the orig post", () => {
    guestsBrowser.complex.addProgressReply(guestsSecondReplyBecomesPostNr7);
    guestsBrowser.complex.addProgressReply("I'm a guest, my 3rd reply, post nr 8.");
    guestsBrowser.topic.assertPostNotPendingApproval(6);
    guestsBrowser.topic.assertPostNotPendingApproval(7, { wait: false });
    guestsBrowser.topic.assertPostNotPendingApproval(8, { wait: false });
  });

  it("Owen approves the guest's first two replies", () => {
    owensBrowser.refresh();
    owensBrowser.adminArea.goToReview(); // avoid mysterious unmount [5QKBRQ].
    owensBrowser.waitUntilLoadingOverlayGone();
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions();
  });

  it("... then Owen is done", () => {
    assert(!owensBrowser.adminArea.review.isMoreStuffToReview());
  });

  it("... He has gotten a review task notification for the guest's second reply, not the third", () => {
    // Because numFirstPostsToReview = 2 only.
    server.waitUntilLastEmailMatches(
        idAddress.id, owen.emailAddress, guestsSecondReplyBecomesPostNr7, owensBrowser);
  });

  it("A stranger sees all the guest's posts", () => {
    guestsBrowser.topbar.clickLogout();
    assert(guestsBrowser === strangersBrowser);
    strangersBrowser.topic.assertPostNotPendingApproval(6);
    strangersBrowser.topic.assertPostNotPendingApproval(7, { wait: false });
    strangersBrowser.topic.assertPostNotPendingApproval(8, { wait: false });
  });

});

