/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');





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
describe("impersonate  TyT502KNG24", () => {

  it("initialize people", () => {
    everyone = new TyE2eTestBrowser(wdioBrowser);
    owen = _.assign(new TyE2eTestBrowser(browserA), make.memberOwenOwner());
    maria = _.assign(new TyE2eTestBrowser(browserB), make.memberMaria());
  });

  it("import a site", () => {
    var site: SiteData = make.forumOwnedByOwen('impersonate', { title: forumTitle });
    site.members.push(make.memberMaria());
    idAddress = server.importSiteData(site);
    _.assign(maria, make.memberMaria());
    _.assign(owen, make.memberOwenOwner());
  });

  it("Maria goes to the homepage and logs in", () => {
    maria.go(idAddress.origin);
    maria.assertPageTitleMatches(forumTitle);
    maria.complex.loginWithPasswordViaTopbar(maria);
  });

  it("Owen logs in to the admin area", () => {
    owen.adminArea.goToUsersEnabled(idAddress.origin);
    owen.loginDialog.loginWithPassword(owen);
  });

  it("... opens Maria's profile", () => {
    owen.waitForThenClickText('.dw-username', maria.username);
  });

  it("... and clicks Impersonate", () => {
    owen.topbar.assertMyUsernameMatches(owen.username);
    owen.rememberCurrentUrl();
    owen.adminArea.user.startImpersonating();
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
    owen.userProfilePage.clickGoToPreferences();
    owen.userProfilePage.preferences.setFullName(marilonFullName);
    owen.userProfilePage.preferences.save();
    owen.refresh();
    owen.userProfilePage.waitUntilUsernameVisible();
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
    assert(owen.topbar.isNeedsReviewOtherVisible());
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
    assert(owen.topbar.isNeedsReviewOtherVisible());
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
    maria.topic.waitForPostAssertTextMatches(c.FirstReplyNr, origPostReplyText);
  });

  it("... she goes to her profile page", () => {
    // timed out once
    maria.topbar.clickGoToProfile();
    maria.userProfilePage.assertIsMyProfile();
  });

  it("... her name is now Marilon", () => {
    maria.userProfilePage.assertUsernameIs(maria.username);
    maria.userProfilePage.assertFullNameIs(marilonFullName);
    maria.userProfilePage.assertFullNameIsNot(maria.fullName);
  });

  it("... she contacts the tax agency and tells them about her new name", () => {
    // to-do, later
  });

});

