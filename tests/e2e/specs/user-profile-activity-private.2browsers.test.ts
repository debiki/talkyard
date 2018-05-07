/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import { buildSite } from '../utils/site-builder';
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;
declare let browserA: any;
declare let browserB: any;

let forum: LargeTestForum;

let everyonesBrowser;
let owen: Member;
let owensBrowser;
let maria: Member;
let mariasBrowser;
let mallory: Member;
let mallorysBrowser;
let michael: Member;
let michaelsBrowser;
let guestsBrowser;
let strangersBrowser;

let idAddress: IdAddress;
const forumTitle = "User Profile Access Test Forum";

let oneOfMariasPosts: string;
let oneOfMariasTopicTitles: string;


describe("user profile access:", () => {

  it("import a site", () => {
    browser.perhapsDebugBefore();
    forum = buildSite().addLargeForum({ title: forumTitle });

    // Make Michael a full member so he can see activity that strangers may not see.
    forum.members.michael.trustLevel = c.TestTrustLevel.FullMember;

    idAddress = server.importSiteData(forum.siteData);
    oneOfMariasPosts = forum.topics.byMariaCategoryANr2.body;
    oneOfMariasTopicTitles = forum.topics.byMariaCategoryA.title;
  });

  it("initialize people", () => {
    everyonesBrowser = _.assign(browser, pagesFor(browser));

    owensBrowser = _.assign(browserA, pagesFor(browserA));
    owen = forum.members.owen;

    mariasBrowser = _.assign(browserB, pagesFor(browserB));
    maria = forum.members.maria;

    mallorysBrowser = owensBrowser;
    mallory = forum.members.mallory;

    michaelsBrowser = owensBrowser;
    michael = forum.members.michael;
    michael.trustLevel = c.TestTrustLevel.FullMember; // so he can se posts that strangers may not see

    guestsBrowser = owensBrowser;
    strangersBrowser = owensBrowser;
  });

  /*
  // ----- Maria posts stuff

  it("Member Maria logs in", () => {
    mariasBrowser.go(idAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... and replies to Michael", () => {
    mariasBrowser.complex.replyToOrigPost(mariasReply);
  }); */

  // ----- Everyone sees Maria's stuff

  it("Everyone sees Maria's public posts", () => {
    strangersBrowser.userProfilePage.openActivityFor(maria.username, idAddress.origin);
    strangersBrowser.userProfilePage.activity.posts.waitForPostTextsVisible();
    strangersBrowser.userProfilePage.activity.posts.assertPostTextVisible(oneOfMariasPosts);
  });

  it("... and topics", () => {
    strangersBrowser.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
    strangersBrowser.userProfilePage.activity.topics.waitForTopicTitlesVisible();
    strangersBrowser.userProfilePage.activity.topics.assertTopicTitleVisible(oneOfMariasTopicTitles);
  });


  // ----- Hide activity for strangers


  it("Maria hides her activity for strangers", () => {
    mariasBrowser.userProfilePage.openActivityFor(maria.username, idAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.userProfilePage.goToPreferences();
    mariasBrowser.userProfilePage.preferences.switchToPrivacy();
    mariasBrowser.userProfilePage.preferences.privacy.setHideActivityForStrangers(true);
    mariasBrowser.userProfilePage.preferences.privacy.savePrivacySettings();
  });

  it("The stranger no longer sees her topics", () => {
    strangersBrowser.refresh();
    strangersBrowser.userProfilePage.activity.topics.waitForNothingToShow();
  });

  it("... and not her posts", () => {
    strangersBrowser.userProfilePage.activity.switchToPosts({ shallFindPosts: 'NoSinceActivityHidden' });
    strangersBrowser.userProfilePage.activity.posts.waitForNothingToShow(); // hmm redundant
  });

  /* Guest login not enabled in this forum. Maybe later? skip for now:
  it("A guest also doesn't see her posts", () => {
    guestsBrowser.complex.logInAsGuestViaTopbar("Curiosiy Guestiy");
    guestsBrowser.refresh();
    guestsBrowser.userProfilePage.activity.posts.waitForNothingToShow();
    guestsBrowser.topbar.clickLogout();
  }); */

  it("Mallory is a new membmer, won't see posts", () => {
    mallorysBrowser.complex.loginWithPasswordViaTopbar(mallory);
    mallorysBrowser.userProfilePage.activity.posts.waitForNothingToShow();
  });

  it("But Michael is a full member, does see the posts", () => {
    mallorysBrowser.topbar.clickLogout();
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    michaelsBrowser.userProfilePage.activity.posts.waitForPostTextsVisible();
    michaelsBrowser.userProfilePage.activity.posts.assertPostTextVisible(oneOfMariasPosts);
  });

  it("... and the topics", () => {
    michaelsBrowser.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
    michaelsBrowser.userProfilePage.activity.topics.waitForTopicTitlesVisible();
    michaelsBrowser.userProfilePage.activity.topics.assertTopicTitleVisible(oneOfMariasTopicTitles);
  });

  it("Maria also sees her posts", () => {
    mariasBrowser.userProfilePage.goToActivity();
    mariasBrowser.userProfilePage.activity.posts.waitForPostTextsVisible();
    mariasBrowser.userProfilePage.activity.posts.assertPostTextVisible(oneOfMariasPosts);
  });


  // ----- Hide activity for everyone (except staff)


  it("Maria hides her activity for everyone", () => {
    mariasBrowser.userProfilePage.goToPreferences();
    mariasBrowser.userProfilePage.preferences.switchToPrivacy();
    mariasBrowser.userProfilePage.preferences.privacy.setHideActivityForAll(true);
    mariasBrowser.userProfilePage.preferences.privacy.savePrivacySettings();
  });

  it("Michael now cannot see Maria's topics", () => {
    michaelsBrowser.refresh();
    michaelsBrowser.userProfilePage.activity.topics.waitForNothingToShow();
  });

  it("... or posts", () => {
    michaelsBrowser.userProfilePage.activity.switchToPosts({ shallFindPosts: 'NoSinceActivityHidden' });
    michaelsBrowser.userProfilePage.activity.posts.waitForNothingToShow(); // hmm redundant
  });

  it("The stranger still don't see the posts", () => {
    michaelsBrowser.topbar.clickLogout();
    strangersBrowser.userProfilePage.activity.posts.waitForNothingToShow();
  });

  it("But Owen sees the posts — he's admin", () => {
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    owensBrowser.userProfilePage.activity.posts.waitForPostTextsVisible();
    owensBrowser.userProfilePage.activity.posts.assertPostTextVisible(oneOfMariasPosts);
  });

  it("... and the topics too", () => {
    owensBrowser.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
    owensBrowser.userProfilePage.activity.topics.waitForTopicTitlesVisible();
    owensBrowser.userProfilePage.activity.topics.assertTopicTitleVisible(oneOfMariasTopicTitles);
  });

  it("Maria still sees her own posts", () => {
    mariasBrowser.userProfilePage.goToActivity();
    mariasBrowser.userProfilePage.activity.posts.waitForPostTextsVisible();
    mariasBrowser.userProfilePage.activity.posts.assertPostTextVisible(oneOfMariasPosts);
  });

  it("... and topics", () => {
    mariasBrowser.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
    mariasBrowser.userProfilePage.activity.topics.waitForTopicTitlesVisible();
    mariasBrowser.userProfilePage.activity.topics.assertTopicTitleVisible(oneOfMariasTopicTitles);
  });


  // If implementing search-for-pots-by-user in the advanced search dialog, add e2e tests here
  // that disables that, if user has hidden hens activity.  [6UKDSQ29]


  // ----- Show activity again


  it("Maria shows her activity again", () => {
    mariasBrowser.userProfilePage.goToPreferences();
    mariasBrowser.userProfilePage.preferences.switchToPrivacy();
    mariasBrowser.userProfilePage.preferences.privacy.setHideActivityForStrangers(false);
    mariasBrowser.userProfilePage.preferences.privacy.savePrivacySettings();
  });

  it("Now the stranger sees her topics again", () => {
    owensBrowser.topbar.clickLogout();
    strangersBrowser.refresh();
    strangersBrowser.userProfilePage.activity.topics.waitForTopicTitlesVisible();
    strangersBrowser.userProfilePage.activity.topics.assertTopicTitleVisible(oneOfMariasTopicTitles);
  });

  it("... and posts", () => {
    strangersBrowser.userProfilePage.activity.switchToPosts({ shallFindPosts: true });
    strangersBrowser.userProfilePage.activity.posts.waitForPostTextsVisible();
    strangersBrowser.userProfilePage.activity.posts.assertPostTextVisible(oneOfMariasPosts);
  });

});

