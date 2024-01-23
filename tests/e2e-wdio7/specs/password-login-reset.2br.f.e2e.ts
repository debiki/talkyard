/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser, MemberBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');


let everyone;
let owen: MemberBrowser;
let michael: MemberBrowser;

let idAddress;
const forumTitle = "Reset Pwd Test Forum";


describe("password-login-reset  TyT5KAES20W", function() {

  it("initialize people", function() {
    everyone = new TyE2eTestBrowser(wdioBrowser);
    owen = _.assign(new TyE2eTestBrowser(browserA), make.memberOwenOwner());
    michael = _.assign(new TyE2eTestBrowser(browserB), make.memberMichael());
  });

  it("import a site", function() {
    const site: SiteData = make.forumOwnedByOwen('reset-pwd', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;
    site.members.push(make.memberMichael());
    _.assign(michael, make.memberMichael());
    _.assign(owen, make.memberOwenOwner());
    idAddress = server.importSiteData(site);
  });

  it("Owen and Michael go to the homepage", function() {
    everyone.go(idAddress.origin);
    owen.assertPageTitleMatches(forumTitle);
    michael.assertPageTitleMatches(forumTitle);
    // There'll be lots of login attempts.
    everyone.disableRateLimits();
  });

  it("Owen logs in with password", function() {
    owen.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... Michael too", function() {
    michael.complex.loginWithPasswordViaTopbar(michael);
  });

  it("... and can logout", function() {
    //everyone.topbar.clickLogout(); [EVRYBUG]
    owen.topbar.clickLogout();
    michael.topbar.clickLogout();
  });

  it("But they cannot login with the wrong password (they forgot the real ones)", () => {
    //everyone.topbar.clickLogin(); [EVRYBUG]
    owen.topbar.clickLogin();
    michael.topbar.clickLogin();
  });

  it("... Owen cannot", function() {
    owen.loginDialog.loginButBadPassword(owen.username, 'wrong-password');
  });

  it("... Michael cannot", function() {
    michael.loginDialog.loginButBadPassword(michael.username, 'even-more-wrong');
  });

  it("... and cannot login with the wrong username", function() {
    // Don't: everyone.loginDialog.reopenToClearAnyError();  because [4JBKF20]
    owen.loginDialog.reopenToClearAnyError();
    owen.loginDialog.loginButBadPassword('not_owen', owen.password);
    michael.loginDialog.reopenToClearAnyError();
    michael.loginDialog.loginButBadPassword('not_michael', michael.password);
  });

  it("... and cannot login with each other's passwords", function() {
    owen.loginDialog.reopenToClearAnyError();
    owen.loginDialog.loginButBadPassword(owen.username, michael.password);
    michael.loginDialog.reopenToClearAnyError();
    michael.loginDialog.loginButBadPassword(michael.username, owen.password);
  });

  it("Michael clicks Forgot Password", function() {
    michael.loginDialog.clickResetPasswordCloseDialogSwitchTab();
  });

  it("... submits his email address", function() {
    michael.resetPasswordPage.submitAccountOwnerEmailAddress(michael.emailAddress);
  });

  let resetPwdPageLink;

  it("... he gets a reset-pwd email with a choose-new-password page link", function() {
    const email = server.getLastEmailSenTo(idAddress.id, michael.emailAddress, wdioBrowserA);
    resetPwdPageLink = utils.findFirstLinkToUrlIn(
      idAddress.origin + '/-/reset-password/choose-password/', email.bodyHtmlText);
  });

  it("... he goes to that page", function() {
    michael.rememberCurrentUrl();
    michael.go(resetPwdPageLink);
    michael.waitForNewUrl();
  });

  const newPassword = "new_password";

  it("... types a new password", function() {
    michael.chooseNewPasswordPage.typeAndSaveNewPassword(newPassword);
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

});

