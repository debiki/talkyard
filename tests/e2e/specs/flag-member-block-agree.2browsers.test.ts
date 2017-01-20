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
//let mons;
//let monsBrowser;
let maja;
let majasBrowser;
let maria;
let mariasBrowser;
let michael;
let michaelsBrowser;
let mallory;
let mallorysBrowser;
let guest;
let guestsBrowser;
let strangersBrowser;

let idAddress: IdAddress;
let forumTitle = "Flag Block Agree Forum";

let topics = {
  puppiesOneReplyTitle: "Puppies be gone",
  puppiesOneReplyUrl: '',
  kittensTwoRepliesTitle: "Two facts about kittens",
  kittensTwoRepliesUrl: '',
  bunniesNoRepliesTitle: "Are bunnies smart?",
  bunniesNoRepliesUrl: '',
  hummingbirdMajasReplyTitle: "Why do hummingbirds hum?",
  hummingbirdMajasReplyUrl: '',
  oldTopicTitle: "Old Topic",
  oldTopicUrl: 'old_page',
};


describe("spam test, no external services:", () => {

  it("initialize people", () => {
    browser.perhapsDebugBefore();

    everyone = _.assign(browser, pagesFor(browser));
    mallorysBrowser = _.assign(browserA, pagesFor(browserA));
    owensBrowser =  _.assign(browserB, pagesFor(browserB));
    //monsBrowser = owensBrowser;
    majasBrowser = owensBrowser;
    mariasBrowser = owensBrowser;
    michaelsBrowser = owensBrowser;
    guestsBrowser = owensBrowser;
    strangersBrowser = owensBrowser;

    owen = make.memberOwenOwner();
    //mons = make.memberModeratorMons();
    maja = make.memberMaja();
    maja.id = 1001;
    maja.trustLevel = c.TestTrustLevel.Basic;
    maria = make.memberMaria();
    maria.trustLevel = c.TestTrustLevel.Basic;
    michael = make.memberMichael();
    michael.trustLevel = c.TestTrustLevel.Basic;
    mallory = make.memberMallory();
    guest = make.guestGunnar();
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('basicflags', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.numFlagsToHidePost = 2;
    //site.members.push(mons);
    site.members.push(maja);
    site.members.push(maria);
    site.members.push(michael);
    site.members.push(mallory);

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

  // Mallory posts stuff
  // -------------------------------------

  it("Mallory logs in", () => {
    mallorysBrowser.go(idAddress.origin);
    mallorysBrowser.disableRateLimits();
    mallorysBrowser.complex.loginWithPasswordViaTopbar(mallory);
  });

  it("... posts replies to an old topic", () => {
    mallorysBrowser.forumTopicList.goToTopic(topics.oldTopicTitle);
    mallorysBrowser.complex.replyToOrigPost("Come and buy my hat");
    mallorysBrowser.complex.replyToOrigPost("I sell hats, you can buy them");
    mallorysBrowser.complex.replyToOrigPost("Today the sun is shining");
    topics.oldTopicUrl = mallorysBrowser.url().value;
  });

  it("... posts a topics with two replies", () => {
    mallorysBrowser.go(idAddress.origin);
    mallorysBrowser.complex.createAndSaveTopic(
        { title: topics.kittensTwoRepliesTitle, body: "About kittens..." });
    mallorysBrowser.complex.replyToOrigPost("Kittens are dog food");
    mallorysBrowser.complex.replyToOrigPost("I feed my snake with kittens");
    topics.kittensTwoRepliesUrl = mallorysBrowser.url().value;
  });

  it("... and another with one reply", () => {
    mallorysBrowser.go(idAddress.origin);
    mallorysBrowser.complex.createAndSaveTopic(
        { title: topics.puppiesOneReplyTitle, body: "Puppies not allowed" });
    mallorysBrowser.complex.replyToOrigPost("Puppies poo");
    topics.puppiesOneReplyUrl = mallorysBrowser.url().value;
  });

  it("... and one with no replies", () => {
    mallorysBrowser.go(idAddress.origin);
    mallorysBrowser.complex.createAndSaveTopic(
      { title: topics.bunniesNoRepliesTitle, body: "Yes, they can multiply" });
    topics.bunniesNoRepliesUrl = mallorysBrowser.url().value;
  });

  it("... and another, to which Maja will reply later", () => {
    mallorysBrowser.go(idAddress.origin);
    mallorysBrowser.complex.createAndSaveTopic(
      { title: topics.hummingbirdMajasReplyTitle, body: "They forgot the words" });
    topics.hummingbirdMajasReplyUrl = mallorysBrowser.url().value;
  });


  // Maja flags things
  // -------------------------------------

  it("Maja logs in", () => {
    majasBrowser.go(topics.hummingbirdMajasReplyUrl);
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
  });

  it("... replies to Mallory's Hummingbird topic", () => {
    majasBrowser.complex.replyToOrigPost("I think they simply like humming.");
  });

  // Puppies page: OP & post 2 flagged

  it("... and, in another topic, flags one reply and the OrigPost", () => {
    majasBrowser.go(topics.puppiesOneReplyUrl);
    majasBrowser.complex.flagPost(1, 'Inapt');
    majasBrowser.complex.flagPost(2, 'Inapt');
  });

  // Old topic: post 2 flagged

  it("... and in the old topic, flags a reply", () => {
    majasBrowser.go(topics.oldTopicUrl);
    majasBrowser.complex.flagPost(2, 'Inapt');
  });


  // Maria flags things
  // -------------------------------------

  it("Maria logs in", () => {
    majasBrowser.topbar.clickLogout();
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  // Old page: post 2 gets hidden

  it("... flags a reply", () => {
    mariasBrowser.complex.flagPost(2, 'Inapt');
  });

  it("Now that reply got two flags, and gets hidden", () => {
    mariasBrowser.topic.assertPostHidden(2);
  });

  it("... also after page reload", () => {
    mariasBrowser.refresh();
    mariasBrowser.topic.waitForPostNrVisible(2);
    mariasBrowser.topic.assertPostHidden(2);
  });

  it("... but other replies didn't get hidden", () => {
    mariasBrowser.topic.assertPostNotHidden(3);
  });

  // Puppies page: one reply, gets hidden

  it("Maria sees goes to puppy page", () => {
    majasBrowser.go('/');
    majasBrowser.forumTopicList.goToTopic(topics.puppiesOneReplyTitle);
  });

  it("... flags Mallory's reply", () => {
    majasBrowser.complex.flagPost(2, 'Inapt');
  });

  it("... it gets hidden", () => {
    mariasBrowser.topic.assertPostHidden(2);
  });

  it("... but not the whole page", () => {
    mariasBrowser.refresh();
    mariasBrowser.pageTitle.assertPageNotHidden();
  });

  // Puppies page: OP & whole page gets hidden

  it("Maria flags puppet page orig post", () => {
    majasBrowser.complex.flagPost(1, 'Inapt');
  });

  it("... it also gets hidden", () => {
    mariasBrowser.topic.assertPostHidden(1);
  });

  it("... now the whole page got hidden", () => {
    mariasBrowser.refresh();
    mariasBrowser.pageTitle.assertPageHidden();
  });

  it("... the page is no longer listed in the topic list", () => {
    mariasBrowser.go('/');
    mariasBrowser.forumTopicList.waitForTopics();
    mariasBrowser.forumTopicList.assertTopicNotVisible(topics.puppiesOneReplyTitle);
  });


  // Michael flags things
  // -------------------------------------

  it("Michael logs in", () => {
    mariasBrowser.topbar.clickLogout();
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
  });

  // Puppies page: post 3 hidden, + *all* Mallory's posts

  it("... and flags one of Mallory's posts — now lots of flags (7), by 3 people", () => {
    michaelsBrowser.go(topics.oldTopicUrl);
    michaelsBrowser.complex.flagPost(3, 'Inapt');
  });


  // Mallory gets censored
  // -------------------------------------

  it("So now *all* Mallory's posts get hidden", () => {
    michaelsBrowser.topic.assertPostHidden(2);
    michaelsBrowser.topic.assertPostHidden(3);
    michaelsBrowser.topic.assertPostHidden(4);
  });

  it("And his other pages also get hidden", () =>  {
    michaelsBrowser.go(topics.bunniesNoRepliesUrl);
    michaelsBrowser.pageTitle.assertPageHidden();
  });

  it("... unless it includes someone else's not-hidden post", () =>  {
    michaelsBrowser.go(topics.hummingbirdMajasReplyUrl);
    michaelsBrowser.pageTitle.assertPageNotHidden();
  });

  function assertHiddenTopicsHidden(browser) {
    browser.forumTopicList.waitForTopics();
    // Sync with assertHiddenTopicsVisible() just below.
    browser.forumTopicList.assertTopicNotVisible(topics.bunniesNoRepliesTitle);
    browser.forumTopicList.assertTopicNotVisible(topics.puppiesOneReplyTitle);
    browser.forumTopicList.assertTopicNotVisible(topics.kittensTwoRepliesTitle);
  }

  function assertHiddenTopicsVisible(browser) {
    browser.forumTopicList.waitForTopics();
    // Sync with assertHiddenTopicsVisible() just above.
    browser.forumTopicList.assertTopicVisibleAsHidden(topics.bunniesNoRepliesTitle);
    browser.forumTopicList.assertTopicVisibleAsHidden(topics.puppiesOneReplyTitle);
    browser.forumTopicList.assertTopicVisibleAsHidden(topics.kittensTwoRepliesTitle);
  }

  function assertOtherTopicsVisible(browser) {
    browser.forumTopicList.waitForTopics();
    browser.forumTopicList.assertTopicVisible(topics.hummingbirdMajasReplyTitle);
    browser.forumTopicList.assertTopicVisible(topics.oldTopicTitle);
  }

  it("... and the hidden pages aren't listed in the forum topic list", () =>  {
    michaelsBrowser.go('/');
    assertHiddenTopicsHidden(michaelsBrowser);
  });

  it("... but the page with someone elses post, is listed", () =>  {
    assertOtherTopicsVisible(michaelsBrowser);
  });

  it("After clicking view Top...", () =>  {
    michaelsBrowser.forumTopicList.clickViewTop();
  });

  it("... the hidden topics remain hidden", () =>  {
    assertHiddenTopicsHidden(michaelsBrowser);
  });

  it("... and the others remain visible", () =>  {
    assertOtherTopicsVisible(michaelsBrowser);
  });

  it("And after going back to the Latest view...", () =>  {
    michaelsBrowser.forumTopicList.clickViewLatest();
  });

  it("... the hidden topics remain hidden", () =>  {
    assertHiddenTopicsHidden(michaelsBrowser);
  });

  it("... and the others remain visible", () =>  {
    assertOtherTopicsVisible(michaelsBrowser);
  });

  it("The hidden topics are absent in the category tree too", () =>  {
    // todo
  });


  // Staff see everything
  // -------------------------------------

  it("Owen logs in...", () =>  {
    // Timed out once, sth in here.
    michaelsBrowser.topbar.clickLogout();
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    owensBrowser.refresh();
  });

  it("... and sees the hidden topics", () =>  {
    assertHiddenTopicsVisible(owensBrowser);
  });

  it("... and the other topics too", () =>  {
    assertOtherTopicsVisible(owensBrowser);
  });


  // Mallory considered a threat
  // -------------------------------------

  it("Now, when Mallory posts more comments, they get queued for review", () => {
  });

  it(".. until he's created too many pending-review comments, then he gets blocked", () => {
  });

  it("... and cannot post more comments", () => {
  });

  it("... and cannot create more topics", () => {
  });


  // Strangers
  // -------------------------------------

  it("A stranger won't see Mallory's old replies and topics", () => {
  });

  it("... and not the new ones pending review", () => {
  });

  it("Done", () => {
    everyone.perhapsDebug();
  });

});

