/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import pagesFor = require('../utils/pages-for');
import { buildSite } from '../utils/site-builder';
import logMessageModule = require('../utils/log-and-die');
var logMessage = logMessageModule.logMessage;

declare let browser: any;

let forum;

let everyone;
let owen;
let owensBrowser;

let idAddress: IdAddress;
let forumTitle = "View as stranger forum";

function logAndAssertVisible(browser, topicTitle: string, shallBeVisible: boolean = true) {
  process.stdout.write('■');
  //logMessage(`Testing if topic ${shallBeVisible ? 'visible' : 'absent'}: ${topicTitle}`);
  if (shallBeVisible)
    browser.forumTopicList.assertTopicVisible(topicTitle);
  else
    browser.forumTopicList.assertTopicNotVisible(topicTitle);
}

function assertPublicTopicsVisible(browser) {
  logAndAssertVisible(browser,"About category CategoryA");
  logAndAssertVisible(browser,"About category CategoryB");
  logAndAssertVisible(browser, forum.topics.byMariaCategoryA.title);
  logAndAssertVisible(browser, forum.topics.byMariaCategoryANr2.title);
  logAndAssertVisible(browser, forum.topics.byMariaCategoryANr3.title);
  logAndAssertVisible(browser, forum.topics.byMariaCategoryB.title);
  logAndAssertVisible(browser, forum.topics.byMichaelCategoryA.title);
  process.stdout.write('\n');
}

function assertRestrictedTopicsVisible(browser) {
  logAndAssertVisible(browser, forum.topics.byMariaUnlistedCat.title);
  logAndAssertVisible(browser, forum.topics.byMariaStaffOnlyCat.title);
  logAndAssertVisible(browser, forum.topics.byMariaDeletedCat.title);
  logAndAssertVisible(browser, forum.topics.aboutUnlistedCategory.title);
  logAndAssertVisible(browser, forum.topics.aboutStaffOnlyCategory.title);
  logAndAssertVisible(browser, forum.topics.aboutDeletedCategory.title);
  process.stdout.write('\n');
}

function assertRestrictedTopicsAbsent(browser) {
  logAndAssertVisible(browser, forum.topics.byMariaUnlistedCat.title, false);
  logAndAssertVisible(browser, forum.topics.byMariaStaffOnlyCat.title, false);
  logAndAssertVisible(browser, forum.topics.byMariaDeletedCat.title, false);
  logAndAssertVisible(browser, forum.topics.aboutUnlistedCategory.title, false);
  logAndAssertVisible(browser, forum.topics.aboutStaffOnlyCategory.title, false);
  logAndAssertVisible(browser, forum.topics.aboutDeletedCategory.title, false);
  process.stdout.write('\n');
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

