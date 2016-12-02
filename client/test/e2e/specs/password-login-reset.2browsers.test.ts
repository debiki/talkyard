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
var owen;
var michael;

var idAddress;
var forumTitle = "Reset Pwd Test Forum";


describe("private chat", function() {

  it("initialize people", function() {
    browser.perhapsDebugBefore();
    everyone = _.assign(browser, pagesFor(browser));
    owen = _.assign(browserA, pagesFor(browserA), make.memberOwenOwner());
    michael = _.assign(browserB, pagesFor(browserB), make.memberMichael());
  });

  it("import a site", function() {
    var site: SiteData = make.forumOwnedByOwen('reset-pwd', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.members.push(make.memberMichael());
    _.assign(michael, make.memberMichael());
    _.assign(owen, make.memberOwenOwner());
    idAddress = server.importSiteData(site);
  });

  it("Owen and Michael go to the homepage", function() {
    everyone.go(idAddress.origin);
    everyone.assertPageTitleMatches(forumTitle);
    // There'll be lots of login attempts.
    everyone.disableRateLimits();
  });

  it("They can login with password", function() {
    owen.complex.loginWithPasswordViaTopbar(owen);
    michael.complex.loginWithPasswordViaTopbar(michael);
  });

  it("... and can logout", function() {
    everyone.topbar.clickLogout();
  });

  it("... but cannot login with the wrong password (they forgot the real ones)", function() {
    everyone.topbar.clickLogin();
    owen.loginDialog.loginButBadPassword(owen.username, 'wrong-password');
    michael.loginDialog.loginButBadPassword(michael.username, 'even-more-wrong');
  });

  it("... and cannot login with the wrong username", function() {
    everyone.loginDialog.reopenToClearAnyError();
    owen.loginDialog.loginButBadPassword('not_owen', owen.password);
    michael.loginDialog.loginButBadPassword('not_michael', michael.password);
  });

  it("... and cannot login with each other's passwords", function() {
    everyone.loginDialog.reopenToClearAnyError();
    owen.loginDialog.loginButBadPassword(owen.username, michael.password);
    michael.loginDialog.loginButBadPassword(michael.username, owen.password);
  });

  it("Michael resets his password", function() {
    michael.loginDialog.clickResetPasswordCloseDialogSwitchTab();
    michael.resetPasswordPage.fillInAccountOwnerEmailAddress(michael.emailAddress);
    michael.rememberCurrentUrl();
    michael.resetPasswordPage.clickSubmit();
    michael.waitForNewUrl();
    michael.waitForVisible('#e2eRPP_ResetEmailSent');
  });

  var resetPwdPageLink;

  it("... he gets a reset-pwd email with a choose-new-password page link", function() {
    var email = server.getLastEmailSenTo(idAddress.id, michael.emailAddress);
    resetPwdPageLink = utils.findFirstLinkToUrlIn(
      idAddress.origin + '/-/reset-password/choose-password/', email.bodyHtmlText);
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

  it("... he can login with the new password", function() {
    michael.goAndWaitForNewUrl(idAddress.origin);
    michael.topbar.clickLogout();
    michael.complex.loginWithPasswordViaTopbar(michael.username, newPassword);
  });

  it("... but not with the old password", function() {
    michael.topbar.clickLogout();
    michael.topbar.clickLogin();
    michael.loginDialog.loginButBadPassword(michael.username, michael.password);
  });

  it("Owen cannot login with Michael's new password", function() {
    owen.loginDialog.loginButBadPassword(owen.username, newPassword);
  });

  it("... but with his own, when he remembers it", function() {
    owen.loginDialog.loginWithPassword(owen.username, owen.password);
  });

  it("Done", function() {
    everyone.perhapsDebug();
  });

});

