/// <reference path="../test-types.ts"/>
/// <reference path="../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import * as _ from 'lodash';
import server = require('../utils/server');
import pagesFor = require('../utils/pages-for');
import buildSite = require('../utils/site-builder');
import assert = require('assert');

declare let browser: any;

let forum;

let everyone;
let owen;
let owensBrowser;

let idAddress: IdAddress;
let forumTitle = "View as stranger forum";

function assertPublicTopicsVisible(browser) {
  browser.forumTopicList.assertTopicVisible("About category CategoryA");
  browser.forumTopicList.assertTopicVisible("About category CategoryB");
  browser.forumTopicList.assertTopicVisible(forum.topics.byMariaCategoryA.title);
  browser.forumTopicList.assertTopicVisible(forum.topics.byMariaCategoryANr2.title);
  browser.forumTopicList.assertTopicVisible(forum.topics.byMariaCategoryB.title);
  browser.forumTopicList.assertTopicVisible(forum.topics.byMichaelCategoryA.title);
}

function assertRestrictedTopicsVisible(browser) {
  browser.forumTopicList.assertTopicVisible(forum.topics.byMariaUnlistedCat.title);
  browser.forumTopicList.assertTopicVisible(forum.topics.byMariaStaffOnlyCat.title);
  browser.forumTopicList.assertTopicVisible(forum.topics.byMariaDeletedCat.title);
  browser.forumTopicList.assertTopicVisible(forum.topics.aboutUnlistedCategory.title);
  browser.forumTopicList.assertTopicVisible(forum.topics.aboutStaffOnlyCategory.title);
  browser.forumTopicList.assertTopicVisible(forum.topics.aboutDeletedCategory.title);
}

function assertRestrictedTopicsAbsent(browser) {
  browser.forumTopicList.assertTopicNotVisible(forum.topics.byMariaUnlistedCat.title);
  browser.forumTopicList.assertTopicNotVisible(forum.topics.byMariaStaffOnlyCat.title);
  browser.forumTopicList.assertTopicNotVisible(forum.topics.byMariaDeletedCat.title);
  browser.forumTopicList.assertTopicNotVisible(forum.topics.aboutUnlistedCategory.title);
  browser.forumTopicList.assertTopicNotVisible(forum.topics.aboutStaffOnlyCategory.title);
  browser.forumTopicList.assertTopicNotVisible(forum.topics.aboutDeletedCategory.title);
}


describe("view as stranger:", () => {

  it("import a site", () => {
    browser.perhapsDebugBefore();
    forum = buildSite().addLargeForum({ title: forumTitle });
    idAddress = server.importSiteData(forum.siteData);
  });

  it("initialize people", () => {
    browser = _.assign(browser, pagesFor(browser));
    everyone = browser;
    owen = forum.members.owen;
    owensBrowser = browser;
  });


  // ------ Start as admin

  it("Owen logs in", () => {
    owensBrowser.go(idAddress.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    owensBrowser.complex.closeSidebars();
  });

  it("... sees public topics", () => {
    owensBrowser.forumTopicList.waitForTopics();
    assertPublicTopicsVisible(owensBrowser);
  });

  it("... and also topics from restricted categories", () => {
    assertRestrictedTopicsVisible(owensBrowser);
  });


  // ------ View as stranger

  it("Owen clicks View As Stranger ...", () => {
    owensBrowser.topbar.viewAsStranger();
  });

  it("... and no longer sees the restricted topics", () => {
    assertRestrictedTopicsAbsent(owensBrowser);
  });

  it("... but still sees the public topics", () => {
    assertPublicTopicsVisible(owensBrowser);
  });

  it("As stranger, he gets 404 Not Found when viewing a staff-only page", () => {
    owensBrowser.go('/' + forum.topics.byMariaStaffOnlyCat.slug);
    owensBrowser.assertNotFoundError();
  });

  it("Owen goes back to the forum, still doesn't see any restricted topic", () => {
    owensBrowser.go('/');
    assertRestrictedTopicsAbsent(owensBrowser);
  });


  // ------ Back as admin

  it("Owen stops viewing-as-stranger", () => {
    owensBrowser.topbar.stopViewingAsStranger();
  });

  it("... now he sees restricted topics again", () => {
    owensBrowser.forumTopicList.waitForTopics();
    assertRestrictedTopicsVisible(owensBrowser);
  });

  it("... and public topics too, of course", () => {
    assertPublicTopicsVisible(owensBrowser);
  });

  it("... and he also sees the staff-only page", () => {
    owensBrowser.go('/' + forum.topics.byMariaStaffOnlyCat.slug);
    owensBrowser.assertPageTitleMatches(forum.topics.byMariaStaffOnlyCat.title);
  });

  it("Done", () => {
    everyone.perhapsDebug();
  });

});

