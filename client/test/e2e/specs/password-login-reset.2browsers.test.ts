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
declare var browserC: any;

var everyone;
var everyonesPages;
var owen;
var owensPages;
var michael;
var michaelsPages;

var idAddress;
var forumTitle = "Reset Pwd Test Forum";


describe("private chat", function() {

  it("initialize people", function() {
    everyone = browser;
    everyonesPages = pagesFor(everyone);
    owen = browserA;
    owensPages = pagesFor(owen);
    michael = browserB;
    michaelsPages = pagesFor(michael);
  });

  it("import a site", function() {
    var site: SiteData = make.forumOwnedByOwen('reset-pwd', { title: forumTitle });
    site.settings = { allowGuestLogin: true };
    site.members.push(make.memberMichael());
    _.assign(michael, make.memberMichael());
    _.assign(owen, make.memberOwenOwner());
    idAddress = server.importSiteData(site);
  });

  it("Owen and Michael go to the homepage", function() {
    everyone.go(idAddress.siteIdOrigin);
    everyone.assertPageTitleMatches(forumTitle);
    // There'll be lots of login attempts.
    everyone.disableRateLimits();
  });

  it("They can login with password", function() {
    owensPages.complex.loginWithPasswordViaTopbar(owen.username, owen.password);
    michaelsPages.complex.loginWithPasswordViaTopbar(michael.username, michael.password);
  });

  it("... and can logout", function() {
    everyonesPages.topbar.clickLogout();
  });

  it("... but cannot login with the wrong password (they forgot the real ones)", function() {
    everyonesPages.topbar.clickLogin();
    owensPages.loginDialog.loginButBadPassword(owen.username, 'wrong-password');
    michaelsPages.loginDialog.loginButBadPassword(michael.username, 'even-more-wrong');
  });

  it("... and cannot login with the wrong username", function() {
    everyonesPages.loginDialog.reopenToClearAnyError();
    owensPages.loginDialog.loginButBadPassword('not_owen', owen.password);
    michaelsPages.loginDialog.loginButBadPassword('not_michael', michael.password);
  });

  it("... and cannot login with each other's passwords", function() {
    everyonesPages.loginDialog.reopenToClearAnyError();
    owensPages.loginDialog.loginButBadPassword(owen.username, michael.password);
    michaelsPages.loginDialog.loginButBadPassword(michael.username, owen.password);
  });

  it("Michael resets his password", function() {
    michaelsPages.loginDialog.clickResetPasswordSwitchTab();
    michaelsPages.resetPasswordPage.fillInAccountOwnerEmailAddress(michael.emailAddress);
    michael.rememberCurrentUrl();
    michaelsPages.resetPasswordPage.clickSubmit();
    michael.waitForNewUrl();
    michael.waitForVisible('#e2eRPP_ResetEmailSent');
  });

  var resetPwdPageLink;

  it("... he gets a reset-pwd email with a choose-new-password page link", function() {
    var email = server.getLastEmailSenTo(idAddress.id, michael.emailAddress);
    resetPwdPageLink = utils.findFirstLinkToUrlIn(
      idAddress.siteIdOrigin + '/-/reset-password/choose-password/', email.bodyHtmlText);
  });

  it("... he goes to that page", function() {
    michael.rememberCurrentUrl();
    michael.go(resetPwdPageLink);
    michael.waitForNewUrl();
  });

  var newPassword = "new_password";

  it("... types a new password", function() {
    michael.waitAndSetValue('#e2ePassword', newPassword);
    michael.waitAndClick('#e2eSubmit');
    // (stays at the same url)
    michael.waitForVisible("#e2eRPP_PasswordChanged");
  });

  it("... with the new password, he can login, logout and login", function() {
    michael.switchBackToFirstTabOrWindow();
    michaelsPages.loginDialog.loginWithPassword(michael.username, newPassword);
    michaelsPages.topbar.clickLogout();
    michaelsPages.complex.loginWithPasswordViaTopbar(michael.username, newPassword)
  });

  it("... but not with the old password", function() {
    michaelsPages.topbar.clickLogout();
    michaelsPages.topbar.clickLogin();
    michaelsPages.loginDialog.loginButBadPassword(michael.username, michael.password);
  });

  it("Owen cannot login with Michael's new password", function() {
    owensPages.loginDialog.loginButBadPassword(owen.username, newPassword);
  });

  it("... but with his own, when he remembers it", function() {
    owensPages.loginDialog.loginWithPassword(owen.username, owen.password);
  });

  it("Done", function() {
    everyone.perhapsDebug();
  });

});

