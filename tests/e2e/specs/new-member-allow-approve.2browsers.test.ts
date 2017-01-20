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
let michael;
let michaelsBrowser;
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


describe("new member, allow, approve:", () => {

  it("initialize people", () => {
    browser.perhapsDebugBefore();

    everyone = _.assign(browser, pagesFor(browser));
    owensBrowser = _.assign(browserA, pagesFor(browserA));
    majasBrowser = _.assign(browserB, pagesFor(browserB));
    michaelsBrowser = majasBrowser;
    strangersBrowser = majasBrowser;

    owen = make.memberOwenOwner();
    //mons = make.memberModeratorMons();
    maja = make.memberMaja();
    michael = make.memberMichael();
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('basicflags', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    // This means a new member can post 5 posts, but after that, hen needs to wait until
    // some of those posts have been approved. And when two of them have been approved,
    // the last approval "cascades" and auto-approves all 5 posts. Thereafter the new memeber
    // can post how many posts hen wants to (subjected to new user rate limits).
    site.settings.numFirstPostsToApprove = 2;
    site.settings.numFirstPostsToAllow = 4;
    site.members.push(maja);
    site.members.push(michael);

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

  it("... it needs to be approved by staff", () => {
    // Would be better if the body wasn't hidden, so Maja could edit it. [27WKTU02]
    majasBrowser.topic.assertPagePendingApprovalBodyHidden();
  });

  it("... she posts three replies to an old topic", () => {
    majasBrowser.go('/');
    majasBrowser.forumTopicList.goToTopic(topics.oldTopicTitle);
    majasBrowser.complex.replyToOrigPost("My first reply, post nr 2");
    majasBrowser.complex.replyToOrigPost("My second reply");
    majasBrowser.complex.replyToOrigPost("Three is my lucky number");
    topics.oldTopicUrl = majasBrowser.url().value;
  });

  it("... they all need to be approved by staff", () => {
    majasBrowser.topic.assertPostNeedsApprovalBodyVisible(2);
    majasBrowser.topic.assertPostNeedsApprovalBodyVisible(3);
    majasBrowser.topic.assertPostNeedsApprovalBodyVisible(4);
  });

  it("But now she may not post more replies, until the ones posted already gets reviewed", () => {
    majasBrowser.topic.clickReplyToOrigPost();
    majasBrowser.editor.editText("won't be accepted");
    majasBrowser.editor.clickSave();
    majasBrowser.serverErrorDialog.waitAndAssertTextMatches(/approve.*EsE6YKF2_/);
    majasBrowser.serverErrorDialog.close();
    majasBrowser.editor.cancel();
  });


  // A stranger doesn't see Maja's posts
  // -------------------------------------

  it("Maja leaves, a stranger arrives", () => {
    majasBrowser.go('/');
    majasBrowser.topbar.clickLogout();
    assert(majasBrowser === strangersBrowser);
  });

  it("The stranger doesn't see Maja's not-yet-approved topic in the topic list", () => {
    strangersBrowser.refresh();
    strangersBrowser.forumTopicList.waitForTopics();
    strangersBrowser.forumTopicList.assertNumVisible(1);
    strangersBrowser.forumTopicList.assertTopicVisible(topics.oldTopicTitle);
  });

  it("... and sees that Maja's replies need approval", () => {
    strangersBrowser.go(topics.oldTopicUrl);
    strangersBrowser.topic.assertPostNeedsApprovalBodyHidden(2);
    strangersBrowser.topic.assertPostNeedsApprovalBodyHidden(3);
    strangersBrowser.topic.assertPostNeedsApprovalBodyHidden(4);
  });

  it("... and, when accessed directly, Maja' page is pending approval", () => {
    strangersBrowser.go(topics.majasTopicUrl);
    strangersBrowser.topic.assertPagePendingApprovalBodyHidden();
  });


  // Michael also doesn't see Maja's posts
  // -------------------------------------

  it("Michael logs in", () => {
    assert(strangersBrowser === michaelsBrowser);
    michaelsBrowser.go('/');
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
  });

  it("... he doesn't see Maja's not-yet-approved topic in the topic list", () => {
    michaelsBrowser.forumTopicList.waitForTopics();
    michaelsBrowser.forumTopicList.assertNumVisible(1);
    michaelsBrowser.forumTopicList.assertTopicVisible(topics.oldTopicTitle);
  });

  it("... and when accessed directly, Maja' page is pending approval", () => {
    michaelsBrowser.go(topics.majasTopicUrl);
    michaelsBrowser.topic.assertPagePendingApprovalBodyHidden();
  });

  it("... and he doesn't see Maja's not-yet-approved replies", () => {
    michaelsBrowser.go(topics.oldTopicUrl);
    michaelsBrowser.topic.assertPostNeedsApprovalBodyHidden(2);
    michaelsBrowser.topic.assertPostNeedsApprovalBodyHidden(3);
    michaelsBrowser.topic.assertPostNeedsApprovalBodyHidden(4);
  });


  // Owen approves
  // -------------------------------------

  it("Owen logs in", () => {
    owensBrowser.go(idAddress.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... goes to the admin area", () => {
    owensBrowser.topbar.myMenu.goToAdminReview();
  });

  it("... approves Maja's first reply", () => {
    owensBrowser.adminArea.review.approveNextWhatever();
  });

  it("Then Michael sees that reply, but not any others", () => {
    michaelsBrowser.topic.refreshUntilPostNotPendingApproval(4);
  });

  /* Currently she cannot post any more replies, although one was approved, hmm.

  it("Maja can post one more reply (because 4 pending replies are allowed)", () => {
    assert(michaelsBrowser === majasBrowser);
    michaelsBrowser.topbar.clickLogout();
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
    majasBrowser.complex.replyToOrigPost("My yet-another-reply");
  });

  it("... but not more than one", () => {
    majasBrowser.complex.replyToOrigPost("Won't be accepted");
    majasBrowser.serverErrorDialog.waitAndAssertTextMatches(/approve.*EsE6YKF2_/);
    majasBrowser.serverErrorDialog.close();
    majasBrowser.editor.cancel();
  });
  */


  // Owen's next approval cascades
  // -------------------------------------

  it("Owen approves another reply, the approval cascades...", () => {
    owensBrowser.adminArea.review.approveNextWhatever();
  });

  it("So now Michael sees all Maja's replies", () => {
    // This often fails:
    // michaelsBrowser.refresh();
    // michaelsBrowser.topic.assertPostNotPendingApproval(2); then 3 then 4
    // Instead: (and need to do like this for all of 2,3,4)
    michaelsBrowser.topic.refreshUntilPostNotPendingApproval(2);
    michaelsBrowser.topic.refreshUntilPostNotPendingApproval(3);
    michaelsBrowser.topic.refreshUntilPostNotPendingApproval(4);
  });

  it("... and sees Maja's topic in the topic list", () => {
    michaelsBrowser.go('/');
    michaelsBrowser.forumTopicList.waitForTopics();
    michaelsBrowser.forumTopicList.assertNumVisible(2);
    michaelsBrowser.forumTopicList.assertTopicVisible(topics.oldTopicTitle);
    michaelsBrowser.forumTopicList.assertTopicVisible(topics.majasTopicTitle);
  });

  it("... and can access it", () => {
    michaelsBrowser.forumTopicList.goToTopic(topics.majasTopicTitle);
    michaelsBrowser.topic.assertPageNotPendingApproval();
  });


  // Maja allowed
  // -------------------------------------

  it("Maja can now post more replies, without them being queued for approval", () => {
    michaelsBrowser.topbar.clickLogout();
    assert(michaelsBrowser === majasBrowser);
    majasBrowser.go(topics.oldTopicUrl);
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
    majasBrowser.complex.replyToOrigPost("My more replies");
    majasBrowser.complex.replyToOrigPost("My even more replies");
    majasBrowser.topic.assertPostNotPendingApproval(5);
    majasBrowser.topic.assertPostNotPendingApproval(6);
  });


  // The stranger sees all Maja's stuff
  // -------------------------------------

  it("The stranger sees all Maja's replies", () => {
    majasBrowser.topbar.clickLogout();
    assert(majasBrowser === strangersBrowser);
    strangersBrowser.topic.assertPostNotPendingApproval(2);
    strangersBrowser.topic.assertPostNotPendingApproval(3);
    strangersBrowser.topic.assertPostNotPendingApproval(4);
    strangersBrowser.topic.assertPostNotPendingApproval(5);
    strangersBrowser.topic.assertPostNotPendingApproval(6);
  });

  it("... and her topic in the topc list", () => {
    strangersBrowser.go('/');
    strangersBrowser.forumTopicList.waitForTopics();
    strangersBrowser.forumTopicList.assertNumVisible(2);
    strangersBrowser.forumTopicList.assertTopicVisible(topics.oldTopicTitle);
    strangersBrowser.forumTopicList.assertTopicVisible(topics.majasTopicTitle);
  });


  it("Done", () => {
    everyone.perhapsDebug();
  });

});

