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
import c = require('../test-constants');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

var everyone;
var owen;
var maria;

var idAddress;
var forumTitle = "Impersonation Forum";
var impTopicTitle = "Impersonated Topic Title";
var impTopicBody = "Impersonated Topic Body";
var marilonFullName = "Marilon";
var editedPageText = "Edited page text";
var origPostReplyText = "Orig post reply text";


// Please note! The purpose with impersonating people, is to troubleshoot e.g. security
// settings. Forum admins have access to everything posted by all users anyway.
//
describe("impersonate", () => {

  it("initialize people", () => {
    browser.perhapsDebugBefore();
    everyone = _.assign(browser, pagesFor(browser));
    owen = _.assign(browserA, pagesFor(browserA), make.memberOwenOwner());
    maria = _.assign(browserB, pagesFor(browserB), make.memberMaria());
  });

  it("import a site", () => {
    var site: SiteData = make.forumOwnedByOwen('impersonate', { title: forumTitle });
    site.members.push(make.memberMaria());
    idAddress = server.importSiteData(site);
    _.assign(maria, make.memberMaria());
    _.assign(owen, make.memberOwenOwner());
  });

  it("Maria goes to the homepage and logsin", () => {
    maria.go(idAddress.origin);
    maria.assertPageTitleMatches(forumTitle);
    maria.complex.loginWithPasswordViaTopbar(maria);
  });

  it("Owen logs in to the admin area", () => {
    owen.adminArea.goToUsers(idAddress.origin);
    owen.loginDialog.loginWithPassword(owen);
  });

  it("... opens Maria's profile", () => {
    owen.waitForThenClickText('.dw-username', maria.username);
  });

  it("... and clicks Impersonate", () => {
    owen.topbar.assertMyUsernameMatches(owen.username);
    owen.rememberCurrentUrl();
    owen.waitAndClick('#e2eA_Us_U_ImpersonateB');
    owen.waitForNewUrl();
  });

  it("... the browser jumped to the homepage", () => {
    owen.assertPageTitleMatches(forumTitle);
  });

  it("... and he's now logged in as Maria", () => {
    owen.topbar.assertMyUsernameMatches(maria.username);
  });

  it("... also after page reload", () => {
    owen.refresh();
    owen.topbar.waitForVisible();
    owen.topbar.assertMyUsernameMatches(maria.username);
  });

  it("... he posts a forum topic, as Maria", () => {
    owen.complex.createAndSaveTopic({ title: impTopicTitle, body: impTopicBody });
  });

  it("... visits her profile", () => {
    owen.topbar.clickGoToProfile();
    owen.userProfilePage.assertIsMyProfile();
    owen.userProfilePage.assertUsernameIs(maria.username);
    owen.userProfilePage.assertFullNameIs(maria.fullName);
    owen.userProfilePage.assertFullNameIsNot(marilonFullName);
  });

  it("... goes to preferences and changes the full name", () => {
    owen.waitAndClick('#e2eUP_PrefsB');
    owen.waitAndSetValue('#fullName', marilonFullName);
    owen.waitAndClick('#e2eUP_Prefs_SaveB');
    owen.refresh();
    owen.userProfilePage.assertUsernameIs(maria.username);
    owen.userProfilePage.assertFullNameIs(marilonFullName);
    owen.userProfilePage.assertFullNameIsNot(maria.fullName);
  });

  it("... then stops impersonating", () => {
    owen.topbar.clickStopImpersonating();
  });

  it("... now he's logged in as Owen again", () => {
    owen.topbar.assertMyUsernameMatches(owen.username);
  });

  it("... the system thinks he should review the topic he created as Maria", () => {
    owen.topbar.assertNeedsReviewVisible();
  });

  it("... he goes to the homepage, he's still Owen", () => {
    owen.go(idAddress.origin);
    owen.topbar.waitForVisible();
    owen.topbar.assertMyUsernameMatches(owen.username);
  });

  it("... he reloads the page, still Owen", () => {
    owen.refresh();
    owen.topbar.waitForVisible();
    owen.topbar.assertMyUsernameMatches(owen.username);
    // Just check the needs-review notf icon hasn't disappeared:
    owen.topbar.assertNeedsReviewVisible();
  });

  it("Maria is still logged in", () => {
    maria.topbar.assertMyUsernameMatches(maria.username);
  });

  it("... also after page reload", () => {
    maria.refresh();
    maria.topbar.assertMyUsernameMatches(maria.username);
  });

  it("... she can logout and login again", () => {
    maria.topbar.clickLogout();
    maria.refresh();
    maria.complex.loginWithPasswordViaTopbar(maria);
    maria.topbar.assertMyUsernameMatches(maria.username);
  });

  it("... and edit the topic Owen created via her account", () => {
    maria.forumTopicList.goToTopic(impTopicTitle);
    maria.complex.editPageBody(editedPageText);
  });

  it("... and post replies", () => {
    maria.complex.replyToOrigPost(origPostReplyText);
    maria.topic.assertPostTextMatches(c.FirstReplyNr, origPostReplyText);
  });

  it("... she goes to her profile page", () => {
    maria.topbar.clickGoToProfile();
    maria.userProfilePage.assertIsMyProfile();
  });

  it("... her name is now Marilon", () => {
    maria.userProfilePage.assertUsernameIs(maria.username);
    maria.userProfilePage.assertFullNameIs(marilonFullName);
    maria.userProfilePage.assertFullNameIsNot(maria.fullName);
  });

  it("... she contacts the tax agency and tells them about this", () => {
    // to-do, later
  });

  it("Done", () => {
    everyone.perhapsDebug();
  });

});

