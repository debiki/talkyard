/// <reference path="../test-types.ts"/>
/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import * as _ from 'lodash';
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import assert = require('assert');
import logAndDie = require('../utils/log-and-die');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

var everyone;
var owen;
var maria;

var forumTitle = "Adm Guide";
var editedForumTitle = "Adm Guide Edtd";
var testId = utils.generateTestId();
var newOrgName = "New Org Name";
var newIntroText = "Intro text text text.";
var newWelcomeTopicText = "New welcome topic text text text";
var newWelcomeTopicTitle = "New Welcome Title Title Title";
var newCategoryName = "Wasteland";
var newTopicTitle = "Total Desert";
var newTopicText = "No water here text text text";
var siteId: string;
var siteUrl: string;


describe("create site, follow the admin guide", function() {

  it("initialize people", function() {
    browser.perhapsDebugBefore();
    everyone = _.assign(browser, pagesFor(everyone));
    owen = _.assign(browserA, pagesFor(browserA), make.memberOwenOwner());
    // Use an unique address so won't run into max-sites-per-email limit.
    owen.emailAddress = "e2e-test--owen-" + testId + "@example.com";
    maria = _.assign(browserB, pagesFor(browserB), make.memberMaria());
  });

  it("Owen creates a site", function() {
    var localHostname = settings.localHostname ||
                        settings.testLocalHostnamePrefix + 'create-site-' + testId;
    var newSiteData = {
      testId: testId,
      localHostname: localHostname,
      name: localHostname,
      origin: utils.makeSiteOrigin(localHostname),
      originRegexEscaped: utils.makeSiteOriginRegexEscaped(localHostname),
      orgName: "Owen's E2E Org",
      fullName: 'E2E Test ' + testId,
      email: owen.emailAddress,
    };
    owen.go(utils.makeCreateSiteWithFakeIpUrl());
    owen.createSite.fillInFieldsAndSubmit(newSiteData);
    owen.click('#e2eLogin');
    owen.disableRateLimits();
    owen.loginDialog.createPasswordAccount(owen);
    siteId = owen.getSiteId();
    var link = server.getLastVerifyEmailAddressLinkEmailedTo(siteId, owen.emailAddress);
    owen.go(link);
    owen.waitAndClick('#e2eContinue');
    owen.createSomething.createForum(forumTitle);
    siteUrl = owen.url().value;
  });

  it("Maria sees it", function() {
    maria.go(siteUrl);
    maria.assertPageTitleMatches(forumTitle);
  });

  it("Owen edits settings: requires people to login", function() {
    owen.topbar.clickGoToAdmin();
    owen.complex.closeSidebars(); // otherwise might open later and bump setting positions
    owen.adminArea.settings.legal.editOrgName(newOrgName);
    owen.adminArea.settings.clickLoginNavLink();
    owen.adminArea.settings.login.clickLoginRequired();
    owen.adminArea.settings.clickSaveAll();
  });

  it("Now Maria needs to create an account", function() {
    maria.loginDialog.refreshUntilFullScreen();
  });

  it("... she creates an account", function() {
    maria.loginDialog.clickCreateAccountInstead();
    maria.loginDialog.createPasswordAccount(maria);
  });

  it("... clicks an email confirmation link", function() {
    var link = server.getLastVerifyEmailAddressLinkEmailedTo(siteId, maria.emailAddress);
    maria.go(link);
  });

  it("... and can see the homepage again", function() {
    maria.go(siteUrl);
    maria.assertPageTitleMatches(forumTitle);
  });

  it("... and the new organization name, on the ToU page", function() {
  });

  it("Owen leaves the admin area, goes back to the forum", function() {
    owen.adminArea.clickLeaveAdminArea();
    owen.assertPageTitleMatches(forumTitle);
  });

  it("... he edits the forum title", function() {
    owen.pageTitle.clickEdit();
    owen.pageTitle.editTitle(editedForumTitle);
    owen.pageTitle.save();
    owen.assertPageTitleMatches(editedForumTitle);
  });

  it("... and the forum intro text", function() {
    owen.forumButtons.clickEditIntroText();
    owen.editor.editText(newIntroText);
    owen.editor.save();
    owen.waitAndAssertVisibleTextMatches('.esForumIntro', newIntroText);
  });

  it("... opens the Welcome topic", function() {
    owen.forumTopicList.goToTopic("Welcome");
  });

  it("... edits title and text", function() {
    owen.topic.clickEditOrigPost();
    owen.editor.editText(newWelcomeTopicText);
    owen.editor.save();
    owen.pageTitle.clickEdit();
    owen.pageTitle.editTitle(newWelcomeTopicTitle);
    owen.pageTitle.save();
    owen.assertPageTitleMatches(newWelcomeTopicTitle);
  });

  it("... returns to the forum", function() {
    owen.topic.clickHomeNavLink();
  });

  it("... views categories", function() {
    owen.forumButtons.clickViewCategories();
  });

  it("... creates a category", function() {
    owen.forumButtons.clickCreateCategory();
    owen.categoryDialog.fillInFields({ name: newCategoryName });
    owen.categoryDialog.submit();
  });

  it("... and a topic in that category", function() {
    owen.forumCategoryList.openCategory(newCategoryName);
    owen.complex.createAndSaveTopic({ title: newTopicTitle, body: newTopicText });
  });

  it("... returns to the topic list", function() {
    owen.topic.clickHomeNavLink();
  });

  it("Now both Owen and Maria see all changes Owen did", function() {
    maria.refresh();
    everyone.assertPageTitleMatches(editedForumTitle);
    // ...
  });

  it("Done", function() {
    everyone.perhapsDebug();
  });

});

