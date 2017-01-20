/// <reference path="../test-types.ts"/>
/// <reference path="../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import * as _ from 'lodash';
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import assert = require('assert');
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
let forumTitle = "Flag Block Agree Forum";

let topics = {
  majasTopicTitle: "Icecream?",
  majasTopicText: "I can haz icecream?",
  majasTopicUrl: '',
  oldTopicTitle: "Old Topic",
  oldTopicUrl: 'old_topic',
};


describe("new user, review, ok:", () => {

  it("initialize people", () => {
    browser.perhapsDebugBefore();

    everyone = _.assign(browser, pagesFor(browser));
    owensBrowser = _.assign(browserA, pagesFor(browserA));
    majasBrowser = _.assign(browserB, pagesFor(browserB));
    guestsBrowser = majasBrowser;
    strangersBrowser = majasBrowser;

    owen = make.memberOwenOwner();
    maja = make.memberMaja();
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('basicflags', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    // This means a new member can post any number of posts (subjected to new user rate
    // limits), and they'll be shown directly — but the first 2 will be enqueued for review
    // by staff.
    site.settings.numFirstPostsToReview = 2;
    site.members.push(maja);

    let page = make.page({
      id: topics.oldTopicUrl,
      role: c.TestPageRole.Discussion,
      authorId: maja.id,
      categoryId: 1,
    });
    site.pages.push(page);
    site.pagePaths.push(make.pagePath(page.id, '/', false, 'old-topic'));
    site.posts.push(make.post({ page: page, nr: 0, approvedSource: topics.oldTopicTitle }));
    site.posts.push(make.post({ page: page, nr: 1, approvedSource: 'Text text text.' }));

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
    topics.majasTopicUrl = majasBrowser.url().value;
  });

  it("... it doesn't need to be approved by staff", () => {
    majasBrowser.topic.assertPageNotPendingApproval();
  });

  it("... she posts three replies to an old topic", () => {
    majasBrowser.go('/');
    majasBrowser.forumTopicList.goToTopic(topics.oldTopicTitle);
    majasBrowser.complex.replyToOrigPost("My appears-directly first reply, post nr 2");
    majasBrowser.complex.replyToOrigPost("My appears-directly second reply");
    majasBrowser.complex.replyToOrigPost("One two three, done.");
    topics.oldTopicUrl = majasBrowser.url().value;
  });

  it("... they don't need to be approved by staff", () => {
    majasBrowser.topic.assertPostNotPendingApproval(2);
    majasBrowser.topic.assertPostNotPendingApproval(3);
    majasBrowser.topic.assertPostNotPendingApproval(4);
  });


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
    strangersBrowser.topic.assertPostNotPendingApproval(3);
    strangersBrowser.topic.assertPostNotPendingApproval(4);
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
    owensBrowser.adminArea.review.approveNextWhatever();
  });

  it("... and reviews Maja's second reply, also ok", () => {
    owensBrowser.adminArea.review.approveNextWhatever();
  });

  it("... now there's nothing more to review", () => {
    assert(!owensBrowser.adminArea.review.isMoreStuffToReview());
    owensBrowser.refresh();
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
    strangersBrowser.topic.assertPostNotPendingApproval(3);
    strangersBrowser.topic.assertPostNotPendingApproval(4);
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
    assert(!owensBrowser.adminArea.review.isMoreStuffToReview());
  });


  // Quick guest test: Guests are also enqueued for review
  // -------------------------------------

  it("A guest arrives", () => {
    assert(strangersBrowser === guestsBrowser);
    guestsBrowser.complex.loginAsGuestViaTopbar("I-The-Guest");
    guestsBrowser.complex.replyToOrigPost("I'm a guest, becomes post nr 6.");
    guestsBrowser.complex.replyToOrigPost("I'm a guest, my 2nd reply, post nr 7.");
    guestsBrowser.complex.replyToOrigPost("I'm a guest, my 3rd reply, post nr 8.");
    guestsBrowser.topic.assertPostNotPendingApproval(6);
    guestsBrowser.topic.assertPostNotPendingApproval(7);
    guestsBrowser.topic.assertPostNotPendingApproval(8);
  });

  it("Owen approves the guest's first two replies", () => {
    owensBrowser.refresh();
    owensBrowser.adminArea.review.approveNextWhatever();
    owensBrowser.adminArea.review.approveNextWhatever();
  });

  it("... then Owen is done", () => {
    assert(!owensBrowser.adminArea.review.isMoreStuffToReview());
    owensBrowser.refresh();
    assert(!owensBrowser.adminArea.review.isMoreStuffToReview());
  });

  it("A stranger sees all the guest's posts", () => {
    guestsBrowser.topbar.clickLogout();
    assert(guestsBrowser === strangersBrowser);
    strangersBrowser.topic.assertPostNotPendingApproval(6);
    strangersBrowser.topic.assertPostNotPendingApproval(7);
    strangersBrowser.topic.assertPostNotPendingApproval(8);
  });

  it("Done", () => {
    everyone.perhapsDebug();
  });

});

