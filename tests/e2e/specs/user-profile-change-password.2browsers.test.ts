/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import make = require('../utils/make');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import { buildSite } from '../utils/site-builder';
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

let browser: TyE2eTestBrowser;



let forum: LargeTestForum;

let everyonesBrowsers;
let richBrowserA;
let richBrowserB;
let owen;
let owensBrowser: TyE2eTestBrowser;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let mallory;
let mallorysBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId;
let forumTitle = "Change Password Test Forum";

let mariasPassword2 = "kittens-I-pat-cute-cute-347-each-day";
let mariasPassword3 = "kittens-I-not-eat-they-are-not-food";


describe("user-profile-change-password.test.ts  TyT6HJ2RD1", () => {

  it("import a site, init people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owensBrowser = richBrowserA;
    mariasBrowser = richBrowserB;
    mallorysBrowser = richBrowserB;

    forum = buildSite().addLargeForum({ title: forumTitle });
    owen = forum.members.owen;
    maria = forum.members.maria;
    mallory = forum.members.mallory;

    idAddress = server.importSiteData(forum.siteData);
    siteId = idAddress.id;
  });

  it("Maria logs in", () => {
    everyonesBrowsers.go(idAddress.origin + '/');
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });


  // ------- Changing one's own password

  it("... goes to her profile page", () => {
    mariasBrowser.topbar.clickGoToProfile();
    mariasBrowser.userProfilePage.clickGoToPreferences();
  });

  it("... and changes her password", () => {
    mariasBrowser.userProfilePage.preferences.clickChangePassword();
    mariasBrowser.changePasswordDialog.clickYesChange();
  });

  let mariasResetPasswordLink;

  it("She gets a password reset email", () => {
    mariasResetPasswordLink = server.waitAndGetResetPasswordLinkEmailedTo(
        siteId, maria.emailAddress, browser);
  });

  it("... clicks the reset-password link", () => {
    mariasBrowser.go(mariasResetPasswordLink);
  });

  it("... chooses a new password", () => {
    mariasBrowser.chooseNewPasswordPage.typeAndSaveNewPassword(mariasPassword2);
  });

  it("Maria goes back to the homepage", () => {
    mariasBrowser.chooseNewPasswordPage.navToHomepage();
  });

  it("Maria logs out", () => {
    mariasBrowser.topbar.clickLogout();
  });

  it("Opens the login dialog, cannot login with the old password", () => {
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria, { resultInError: true });
  });

  it("... but yes Maria's new password works", () => {
    mariasBrowser.loginDialog.loginWithPassword(maria.username, mariasPassword2);
  });

  it("Maria leaves", () => {
    mariasBrowser.topbar.clickLogout();
  });

  it("Mallory cannot login with Maria's old password", () => {
    mallorysBrowser.topbar.clickLogin();
    mallorysBrowser.loginDialog.loginButBadPassword(mallory.username, maria.password);
  });

  it("... not with her new", () => {
    mallorysBrowser.loginDialog.loginButBadPassword(mallory.username,  mariasPassword2);
  });

  it("... yes though, with his own", () => {
    mallorysBrowser.loginDialog.loginWithPassword(mallory.username, mallory.password);
  });

  it("... he gets logged in properly", () => {
    mallorysBrowser.topbar.waitForMyMenuVisible();
    mallorysBrowser.topbar.assertMyUsernameMatches(mallory.username);
  });

  it("Mallory leaves", () => {
    mallorysBrowser.topbar.clickLogout();
  });


  // ------- Cannot use the same reset-password link twice

  it("Maria's old reset-password link no longer works", () => {
    mariasBrowser.go(mariasResetPasswordLink);
    mariasBrowser.waitUntilPageHtmlSourceMatches_1('TyEPWRSTUSD_');
  });


  // ------- Reset-password links expire after some day(s)

  it("Owen goes to Maria's profile page", () => {
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    owensBrowser.userProfilePage.openPreferencesFor(maria.username);
  });

  it("... and sends a change-password email to Maria", () => {
    owensBrowser.userProfilePage.preferences.clickChangePassword();
    owensBrowser.changePasswordDialog.clickYesChange();
  });

  it("She gets a 2nd password reset email", () => {
    mariasResetPasswordLink = server.waitAndGetResetPasswordLinkEmailedTo(
        siteId, maria.emailAddress, browser);
  });

  it("... falls asleep, and forgets about it, for four days", () => {
    server.playTimeDays(4);
  });

  it("... then she clicks the 2nd reset-password link", () => {
    mariasBrowser.go(mariasResetPasswordLink);
  });

  it("... but oh no, it has expired", () => {
    mariasBrowser.waitUntilPageHtmlSourceMatches_1('TyEPWRSTEXP_');
  });


  // ------- Admins can send reset-password links to others

  it("Owen sends a third change-password email to Maria", () => {
    owensBrowser.stupidDialog.close();
    owensBrowser.userProfilePage.preferences.clickChangePassword();
    owensBrowser.changePasswordDialog.clickYesChange();
  });

  it("She gets a 3nd password reset email", () => {
    mariasResetPasswordLink = server.waitAndGetResetPasswordLinkEmailedTo(
        siteId, maria.emailAddress, browser);
  });

  it("... clicks the 3nd reset-password link", () => {
    mariasBrowser.go(mariasResetPasswordLink);
  });

  it("... chooses a new password", () => {
    mariasBrowser.chooseNewPasswordPage.typeAndSaveNewPassword(mariasPassword3);
  });

  it("Maria returns to the homepage, again", () => {
    mariasBrowser.chooseNewPasswordPage.navToHomepage();
  });

  it("... she's now logged in as Maria (not Owen)", () => {
    mariasBrowser.topbar.assertMyUsernameMatches(maria.username);
  });

  it("Maria logs out, again", () => {
    mariasBrowser.topbar.clickLogout();
  });

  it("... cannot login with the first password", () => {
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria, { resultInError: true });
  });

  it("... and not with the second password", () => {
    mariasBrowser.refresh();
    mariasBrowser.complex.loginWithPasswordViaTopbar(
        { ...maria, password: mariasPassword2 }, { resultInError: true });
  });

  it("... but the very newest password works", () => {
    mariasBrowser.loginDialog.loginWithPassword(maria.username, mariasPassword3);
  });

  it("Owen never got any emails", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, owen.emailAddress), 0);
  });

  it("Maria got three emails", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), 3);
  });

});

