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
let michael;
let michaelsBrowser;
let mallory;
let guest;
let guestsBrowser;
let strangersBrowser;

let idAddress: IdAddress;
let forumTitle = "Flag Block Agree Forum";

let topics = {
  oldTopicTitle: "Old Topic",
  oldTopicUrl: 'old_page',
  birdsNoRepliesTitle: "What are two birds with wings that cannot fly?",
  birdsNoRepliesUrl: '',
  unrelatedTopicTitle: "Unrelated Topic",
  unrelatedTopicTitle2: "Maja's unrelated topic 2",
};


describe("spam test, no external services:", () => {

  it("initialize people", () => {
    browser.perhapsDebugBefore();

    everyone = _.assign(browser, pagesFor(browser));
    guestsBrowser = _.assign(browserA, pagesFor(browserA));
    owensBrowser =  _.assign(browserB, pagesFor(browserB));
    majasBrowser = owensBrowser;
    michaelsBrowser = owensBrowser;
    strangersBrowser = owensBrowser;

    owen = make.memberOwenOwner();
    maja = make.memberMaja();
    maja.trustLevel = c.TestTrustLevel.Basic;
    michael = make.memberMichael();
    michael.trustLevel = c.TestTrustLevel.Basic;
    guest = make.guestGunnar();
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('basicflags', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.numFlagsToHidePost = 2;
    site.settings.numFlagsToBlockNewUser = 3;
    site.settings.numFlaggersToBlockNewUser = 2;
    site.members.push(maja);
    site.members.push(michael);

    let oldPage = make.page({
      id: 'oldpage',
      role: c.TestPageRole.Discussion,
      authorId: maja.id,
      categoryId: 1,
    });
    site.pages.push(oldPage);
    site.pagePaths.push(make.pagePath(oldPage.id, '/', false, 'old-topic'));
    site.posts.push(make.post({ page: oldPage, nr: 0, approvedSource: topics.oldTopicTitle }));
    site.posts.push(make.post({ page: oldPage, nr: 1, approvedSource: 'Text text text.' }));

    let unrelatedPage = make.page({
      id: 'unrelpage',
      role: c.TestPageRole.Discussion,
      authorId: maja.id,
      categoryId: 1,
    });
    site.pages.push(unrelatedPage);
    site.pagePaths.push(make.pagePath(unrelatedPage.id, '/', false, 'unrelated-topic'));
    site.posts.push(make.post({ page: unrelatedPage, nr: 0, approvedSource: topics.unrelatedTopicTitle }));
    site.posts.push(make.post({ page: unrelatedPage, nr: 1, approvedSource: 'Unrelated text.' }));

    idAddress = server.importSiteData(site);
  });

  // A guest posts stuff
  // -------------------------------------

  it("A guest logs in", () => {
    guestsBrowser.go(idAddress.origin);
    guestsBrowser.disableRateLimits();
    guestsBrowser.complex.loginAsGuestViaTopbar(guest);
  });

  it("... posts three replies to an old topic", () => {
    guestsBrowser.forumTopicList.goToTopic(topics.oldTopicTitle);
    guestsBrowser.complex.replyToOrigPost("Wanna buy carrots?");
    guestsBrowser.complex.replyToOrigPost("A carrot for your cat!");
    guestsBrowser.complex.replyToOrigPost("Carrots for your kittens!");
    topics.oldTopicUrl = guestsBrowser.url().value;
  });

  it("... posts a topic no replies", () => {
    guestsBrowser.go(idAddress.origin);
    guestsBrowser.complex.createAndSaveTopic(
      { title: topics.birdsNoRepliesTitle, body: "Donald Duck and Uncle Scrooge." });
    topics.birdsNoRepliesUrl = guestsBrowser.url().value;
  });


  // Maja flags things
  // -------------------------------------

  it("Maja logs in", () => {
    majasBrowser.go(idAddress.origin);
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
  });

  it("Creates another unrelated topic", () => {
    majasBrowser.complex.createAndSaveTopic({ title: topics.unrelatedTopicTitle2, body: "Text." });
  });

  it("... flags the guests's first reply, in the old topic", () => {
    majasBrowser.go(topics.oldTopicUrl);
    majasBrowser.complex.flagPost(2, 'Inapt');
  });


  // Michael flags things
  // -------------------------------------

  it("Michael logs in", () => {
    majasBrowser.topbar.clickLogout();
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
  });

  it("... and flags the same reply", () => {
    michaelsBrowser.go(topics.oldTopicUrl);
    michaelsBrowser.complex.flagPost(2, 'Inapt');
  });

  it("... which now gets hidden", () => {
    michaelsBrowser.topic.assertPostHidden(2);
    michaelsBrowser.topic.assertPostNotHidden(3);
    michaelsBrowser.topic.assertPostNotHidden(4);
  });


  // The guest gets censored
  // -------------------------------------

  it("Michael flags another reply", () => {
    michaelsBrowser.go(topics.oldTopicUrl);
    michaelsBrowser.complex.flagPost(3, 'Inapt');
  });

  it("Now *all* the guest's posts get hidden", () => {
    michaelsBrowser.topic.assertPostHidden(2);
    michaelsBrowser.topic.assertPostHidden(3);
    michaelsBrowser.topic.assertPostHidden(4);
  });

  it("... but not the Orig Post, by Maja", () => {
    michaelsBrowser.topic.assertPostNotHidden(1);
  });

  it("And hens topic also get hidden", () =>  {
    michaelsBrowser.go(topics.birdsNoRepliesUrl);
    michaelsBrowser.pageTitle.assertPageHidden();
    michaelsBrowser.topic.assertPostHidden(1);
  });

  it("... and the hidden pages aren't listed in the forum topic list", () =>  {
    michaelsBrowser.go('/');
    michaelsBrowser.forumTopicList.waitForTopics();
    michaelsBrowser.forumTopicList.assertTopicNotVisible(topics.birdsNoRepliesTitle);
  });

  it("... but the page with someone elses post, and an unrelated page, are still listed", () =>  {
    michaelsBrowser.forumTopicList.assertTopicVisible(topics.oldTopicTitle);
    michaelsBrowser.forumTopicList.assertTopicVisible(topics.unrelatedTopicTitle);
    michaelsBrowser.forumTopicList.assertTopicVisible(topics.unrelatedTopicTitle2);
  });

  it("After clicking view Top...", () =>  {
    michaelsBrowser.forumTopicList.clickViewTop();
  });

  it("... the hidden topics remain hidden", () =>  {
    michaelsBrowser.forumTopicList.waitForTopics();
    michaelsBrowser.forumTopicList.assertTopicNotVisible(topics.birdsNoRepliesTitle);
  });

  it("... and the others remain visible", () =>  {
    michaelsBrowser.forumTopicList.assertTopicVisible(topics.oldTopicTitle);
    michaelsBrowser.forumTopicList.assertTopicVisible(topics.unrelatedTopicTitle);
    michaelsBrowser.forumTopicList.assertTopicVisible(topics.unrelatedTopicTitle2);
  });

  it("The hidden topics are absent in the category tree too", () =>  {
    // todo
  });


  // Staff see everything
  // -------------------------------------

  it("Owen logs in...", () =>  {
    michaelsBrowser.topbar.clickLogout();
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    owensBrowser.refresh();
  });

  it("... and sees the hidden topic", () =>  {
    owensBrowser.go('/');
    owensBrowser.forumTopicList.waitForTopics();
    owensBrowser.forumTopicList.assertTopicVisibleAsHidden(topics.birdsNoRepliesTitle);
  });

  it("... and the other topics too", () =>  {
    owensBrowser.forumTopicList.assertTopicVisible(topics.oldTopicTitle);
    owensBrowser.forumTopicList.assertTopicVisible(topics.unrelatedTopicTitle);
  });


  // The guest is considered a threat
  // -------------------------------------

  it("Now, when the guest posts more comments, they get queued for review", () => {
  });

  it(".. until too many pending-review comments, then hen gets blocked", () => {
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

