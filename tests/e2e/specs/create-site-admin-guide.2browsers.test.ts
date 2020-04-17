/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');





let everyone;
let owen;
let maria;

const forumTitle = "Adm Guide";
const editedForumTitle = "Adm Guide Edtd";
const testId = utils.generateTestId();
const newOrgName = "New Org Name";
const newIntroText = "Intro text text text.";
const newWelcomeTopicText = "New welcome topic text text text";
const newWelcomeTopicTitle = "New Welcome Title Title Title";
const newCategoryName = "Wasteland";
const newTopicTitle = "Total Desert";
const newTopicText = "No water here text text text";
let siteId: SiteId;
let siteUrl: string;

const mariasTopicTitle = "mariasTopicTitle";
const mariasTopicText = "mariasTopicText";

describe("create site, follow the admin guide  TyT62RJHLPK4", function() {

  it("initialize people", function() {
    everyone = new TyE2eTestBrowser(wdioBrowser);
    owen = _.assign(new TyE2eTestBrowser(browserA), make.memberOwenOwner());
    // Use an unique address so won't run into max-sites-per-email limit.
    owen.emailAddress = "e2e-test--owen-" + testId + "@example.com";
    maria = _.assign(new TyE2eTestBrowser(browserB), make.memberMaria());
  });

  it("Owen creates a site", function() {
    var localHostname = global['localHostname'] || settings.localHostname ||
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
    console.log("Fills in fields and submits");
    owen.createSite.fillInFieldsAndSubmit(newSiteData);
    console.log("Clicks login");
    owen.createSite.clickOwnerSignupButton();
    owen.disableRateLimits();
    console.log("Creates password account");
    owen.loginDialog.createPasswordAccount(owen);
    siteId = owen.getSiteId();
    console.log("Gets a verification email");
    var link = server.getLastVerifyEmailAddressLinkEmailedTo(siteId, owen.emailAddress);
    owen.go(link);
    console.log("Clicks continue");
    owen.waitAndClick('#e2eContinue');
    console.log("Creates a forum");
    owen.createSomething.createForum(forumTitle);
    siteUrl = owen.getUrl();
  });

  it("Maria sees it", function() {
    maria.go(siteUrl);
    maria.assertPageTitleMatches(forumTitle);
    maria.disableRateLimits();
  });

  it("Owen edits settings: requires people to login", function() {
    owen.topbar.clickGoToAdmin();
    owen.complex.closeSidebars(); // otherwise might open later and bump setting positions
    owen.adminArea.settings.legal.editOrgName(newOrgName);
    owen.adminArea.settings.clickLoginNavLink();
    owen.adminArea.settings.login.setLoginRequired(true);
    owen.adminArea.settings.clickSaveAll();
  });

  it("Now Maria needs to create an account", function() {
    maria.loginDialog.refreshUntilFullScreen();
  });

  it("... she creates an account", function() {
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
    maria.assertPageTitleMatches(editedForumTitle);
    owen.assertPageTitleMatches(editedForumTitle);
    // ...
  });

  it("Maria creates a topic", function() {
    maria.complex.createAndSaveTopic({ title: mariasTopicTitle, body: mariasTopicText });
  });

  // This is for email + password users. [7LERTA1]
  it("Owen gets a notification (site owners get notified about everything)", function() {
    server.waitUntilLastEmailMatches(
        siteId, owen.emailAddress, [mariasTopicTitle, mariasTopicText], browser);
  });

});

