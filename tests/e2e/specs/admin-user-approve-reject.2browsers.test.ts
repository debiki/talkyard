/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

let everyone;
let owen: Member;
let owensBrowser;
let michael: Member;
let michaelsBrowser;
let maria: Member;
let mariasBrowser;
let strangersBrowser;

let siteIdAddress;
const forumTitle = "Admin User Page Forum";

let michaelsPageUrl: string;
let mariaPageUrl: string;


describe("admin-user-approve-reject [TyT5KHEWQ2]", function() {

  it("initialize people", function() {
    browser.perhapsDebugBefore();
    everyone = _.assign(browser, pagesFor(browser));
    owen = make.memberOwenOwner();
    owensBrowser = _.assign(browserA, pagesFor(browserA));
    michael = make.memberMichael();
    michaelsBrowser = _.assign(browserB, pagesFor(browserB));
    maria = make.memberMaria();
    mariasBrowser = michaelsBrowser;
    strangersBrowser = michaelsBrowser;
  });

  it("import a site", function() {
    const site: SiteData = make.forumOwnedByOwen('approve-members', { title: forumTitle });
    site.settings.userMustBeAuthenticated = true;
    site.members.push(michael);
    siteIdAddress = server.importSiteData(site);
  });

  it("Owen logs in to admin area", function() {
    owensBrowser.adminArea.goToLoginSettings(siteIdAddress.origin);
    owensBrowser.loginDialog.loginWithPassword(owen);
  });

  it("Sees two enabled users listed: Owen and Michael", function() {
    owensBrowser.adminArea.goToUsersEnabled();
    owensBrowser.adminArea.users.waitForLoaded();
    owensBrowser.adminArea.users.assertUserListed(owen);
    owensBrowser.adminArea.users.assertUserListed(michael);
    owensBrowser.adminArea.users.asserExactlyNumUsers(2);
  });

  it("... clicks Michael", function() {
    owensBrowser.adminArea.users.goToUser(michael);
    michaelsPageUrl = owensBrowser.url().value;
  });

  it("Michael's admin page also says Enabled", function() {
    owensBrowser.adminArea.user.assertEnabled();
  });

  it("... and doesn't show any is-approved info", function() {
    owensBrowser.adminArea.user.assertApprovedInfoAbsent();

  });

  it("... and Michael *can* login", function() {
    michaelsBrowser.go(siteIdAddress.origin);
    michaelsBrowser.loginDialog.loginWithPassword(michael);
    michaelsBrowser.assertPageTitleMatches(forumTitle);
  });

  it("Owen enables approval-of-members-required", function() {
    owensBrowser.adminArea.goToLoginSettings();
    owensBrowser.adminArea.settings.login.setApproveUsers(true);
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("... Michael now *not* enabled, because not yet approved", function() {
    owensBrowser.go(michaelsPageUrl);
    owensBrowser.adminArea.user.assertDisabledBecauseNotYetApproved();
  });

  it("... and approved status = waiting", function() {
    owensBrowser.adminArea.user.assertWaitingForApproval();
  });

  it("... and Michael now *cannot* login: not-yet-approved message", function() {
    michaelsBrowser.topbar.clickLogout({ waitForLoginButton: false });
    michaelsBrowser.loginDialog.loginWithPassword(michael);
    michaelsBrowser.assertMayNotLoginBecauseNotYetApproved();
  });

  it("Owen approves Michal", function() {
    owensBrowser.adminArea.user.approveUser();
  });

  it("... Michael now Enabled", function() {
    owensBrowser.adminArea.user.assertEnabled();
  });

  it("... and Michael can login again", function() {
    michaelsBrowser.go(siteIdAddress.origin);
    michaelsBrowser.loginDialog.loginWithPassword(michael);
    michaelsBrowser.assertPageTitleMatches(forumTitle);
  });


  // *** A new user joins ***

  it("Maria signs up.", function() {
    michaelsBrowser.topbar.clickLogout({ waitForLoginButton: false });
    mariasBrowser.loginDialog.createPasswordAccount(maria);
  });

  it("... and cannot login, hasn't verified her email addr", function() {
    mariasBrowser.refresh();
    mariasBrowser.loginDialog.tryLogin(maria.username, maria.password);
    mariasBrowser.loginDialog.waitForEmailUnverifiedError();
  });

  it("Owen sees Maria in the New users list, email not verified", function() {
    owensBrowser.adminArea.goToUsersEnabled();
    owensBrowser.adminArea.users.switchToNew();
    owensBrowser.adminArea.users.assertUserListed(maria);
    owensBrowser.adminArea.users.assertEmailVerified_1_user(maria, false);
    owensBrowser.adminArea.users.asserExactlyNumUsers(3);  // maria, michael, owen
  });

  it("... not in the Waiting lists", function() {
    owensBrowser.adminArea.users.switchToWaiting();
    owensBrowser.adminArea.users.assertUserListEmpty();
  });

  it("... not in the Enabled lists", function() {
    owensBrowser.adminArea.users.switchToEnabled();
    owensBrowser.adminArea.users.assertUserAbsent(maria);
    owensBrowser.adminArea.users.asserExactlyNumUsers(2);  // michael, owen
  });

  it("... her admin page says *not* enabled: email not verified (and not yet approved)", function() {
    owensBrowser.adminArea.users.switchToNew();
    owensBrowser.adminArea.users.goToUser(maria);
    owensBrowser.adminArea.user.assertDisabledBecauseEmailNotVerified();
    owensBrowser.adminArea.user.assertEmailNotVerified();
    owensBrowser.adminArea.user.assertWaitingForApproval();
    mariaPageUrl = owensBrowser.url().value;
  });

  it("Maria verifies her email", function() {
    const url = server.getLastVerifyEmailAddressLinkEmailedTo(
      siteIdAddress.id, maria.emailAddress, mariasBrowser);
    mariasBrowser.go(url);
    mariasBrowser.waitForVisible('#e2eContinue')
  });

  it("... still not enabled: not yet approved", function() {
    owensBrowser.refresh();
    owensBrowser.adminArea.user.assertDisabledBecauseNotYetApproved();
    owensBrowser.adminArea.user.assertEmailVerified();
    owensBrowser.adminArea.user.assertWaitingForApproval();
  });

  it("... doesn't appear in the Enabled list", function() {
    owensBrowser.adminArea.goToUsersEnabled();
    owensBrowser.adminArea.users.assertUserAbsent(maria);
    owensBrowser.adminArea.users.asserExactlyNumUsers(2);  // michael, owen
  });

  it("... but yes in the Waiting list, email verified", function() {
    owensBrowser.adminArea.users.switchToWaiting();
    owensBrowser.adminArea.users.assertUserListed(maria);
    owensBrowser.adminArea.users.asserExactlyNumUsers(1);
    owensBrowser.adminArea.users.assertEmailVerified_1_user(maria, true);
  });

  it("Owen approves Maria, via profile page", function() {
    owensBrowser.go(mariaPageUrl);
    owensBrowser.adminArea.user.approveUser();
  });

  it("... Maria now enabled", function() {
    owensBrowser.adminArea.user.assertEnabled();
  });

  it("... and in the Enabled list, but not the Waiting list", function() {
    owensBrowser.adminArea.goToUsersEnabled();
    owensBrowser.adminArea.users.assertUserListed(maria);
    owensBrowser.adminArea.users.asserExactlyNumUsers(3);  // maria, michael, owen
    owensBrowser.adminArea.users.switchToWaiting();
    owensBrowser.adminArea.users.assertUserListEmpty();
  });

  it("... she can login (and first logs out again)", function() {
    mariasBrowser.go(siteIdAddress.origin);
    mariasBrowser.topbar.clickLogout({ waitForLoginButton: false });
    mariasBrowser.loginDialog.loginWithPassword(maria);
    mariasBrowser.assertPageTitleMatches(forumTitle);
  });

  it("Owen undoes the approval", function() {
    owensBrowser.go(mariaPageUrl);
    owensBrowser.adminArea.user.undoApproveOrReject();
  });

  it("... Maria now becomes Disabled: not yet approved", function() {
    owensBrowser.adminArea.user.assertDisabledBecauseNotYetApproved();
    owensBrowser.adminArea.user.assertEmailVerified();
    owensBrowser.adminArea.user.assertWaitingForApproval();
  });

  it("... she re-appears in the Waiting list, gone from the Enabled list", function() {
    owensBrowser.adminArea.goToUsersEnabled();
    owensBrowser.adminArea.users.assertUserAbsent(maria);
    owensBrowser.adminArea.users.switchToWaiting();
    owensBrowser.adminArea.users.assertUserListed(maria);
  });

  it("... and cannot login: waiting for approval message", function() {
    mariasBrowser.topbar.clickLogout({ waitForLoginButton: false });
    mariasBrowser.loginDialog.loginWithPassword(maria);
    mariasBrowser.assertMayNotLoginBecauseNotYetApproved();
  });

  it("Owen rejects Maria", function() {
    owensBrowser.go(mariaPageUrl);
    owensBrowser.adminArea.user.rejectUser();
    owensBrowser.adminArea.user.assertRejected();
  });

  it("... she now sees a be-gone message, when trying to login", function() {
    mariasBrowser.go(siteIdAddress.origin);
    mariasBrowser.loginDialog.loginWithPassword(maria);
    mariasBrowser.assertMayNotLoginBecauseRejected();
  });

  it("Owen undoes", function() {
    owensBrowser.adminArea.user.undoApproveOrReject();
  });

  it("... and disables require-approval", function() {
    owensBrowser.adminArea.goToLoginSettings();
    owensBrowser.adminArea.settings.login.setApproveUsers(false);
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("... he sees Maria is now enabled", function() {
    owensBrowser.go(mariaPageUrl);
    owensBrowser.adminArea.user.assertEnabled();
    owensBrowser.adminArea.user.assertApprovedInfoAbsent();
  });

  it("... Maria can now login", function() {
    mariasBrowser.go(siteIdAddress.origin);
    mariasBrowser.loginDialog.loginWithPassword(maria);
    mariasBrowser.assertPageTitleMatches(forumTitle);
  });

  // ----- Un-verifying email

  it("Owen unverifies Maria's email", function() {
    owensBrowser.adminArea.user.setEmailToVerified(false);
  });

  it("... so now Maria gets disabled", function() {
    owensBrowser.adminArea.user.assertDisabledBecauseEmailNotVerified();
    owensBrowser.adminArea.user.assertEmailNotVerified()
  });

  it("... and is not in the Enabled list", function() {
    owensBrowser.adminArea.goToUsersEnabled();
    owensBrowser.adminArea.users.waitForLoaded();
    owensBrowser.adminArea.users.assertUserAbsent(maria);
    owensBrowser.adminArea.users.asserExactlyNumUsers(2);
  });

  it("... there is no Waiting list; Owen disabled approve-users", function() {
    assert(!owensBrowser.adminArea.users.isWaitingTabVisible());
  });

  it("... Maria appears in the New list, email unverified", function() {
    owensBrowser.adminArea.users.switchToNew();
    owensBrowser.adminArea.users.assertUserListed(maria);
    owensBrowser.adminArea.users.assertEmailVerified_1_user(maria, false);
    owensBrowser.adminArea.users.asserExactlyNumUsers(3);  // maria, michael, owen
  });

  it("... Maria again cannot login", function() {
    mariasBrowser.topbar.clickLogout({ waitForLoginButton: false });
    mariasBrowser.loginDialog.tryLogin(maria.username, maria.password);
    mariasBrowser.loginDialog.waitForEmailUnverifiedError();
  });

  it("Owen sets the email to verified", function() {
    owensBrowser.go(mariaPageUrl);
    owensBrowser.adminArea.user.assertDisabledBecauseEmailNotVerified();
    owensBrowser.adminArea.user.setEmailToVerified(true);
  });

  it("... now Maria is enabled again", function() {
    owensBrowser.adminArea.user.assertEnabled();
  });

  it("Owen unverifies the email again", function() {
    owensBrowser.adminArea.user.setEmailToVerified(false);
    owensBrowser.adminArea.user.assertDisabledBecauseEmailNotVerified();
  });

  it("... and sends a verification email", function() {
    owensBrowser.adminArea.user.resendEmailVerifEmail();
  });

  it("... Maria cannot login, because email not verified", function() {
    mariasBrowser.refresh();
    mariasBrowser.loginDialog.tryLogin(maria.username, maria.password);
    mariasBrowser.loginDialog.waitForEmailUnverifiedError();
  });

  it("Maria clicks the verif link in the email", function() {
    const url = server.waitAndGetVerifyAnotherEmailAddressLinkEmailedTo(
        siteIdAddress.id, maria.emailAddress, mariasBrowser, { isOldAddr: true });
    mariasBrowser.go(url);
    mariasBrowser.hasVerifiedEmailPage.waitUntilLoaded({ needToLogin: true });
  });

  it("... now she can login again", function() {
    mariasBrowser.hasVerifiedEmailPage.goToHomepage();
    mariasBrowser.loginDialog.loginWithPassword(maria);
    mariasBrowser.assertPageTitleMatches(forumTitle);
  });

  it("... and Owen sees her account is enabled again", function() {
    owensBrowser.refresh();
    owensBrowser.adminArea.user.assertEnabled();
    owensBrowser.adminArea.user.assertEmailVerified();
  });

  it("The Manage... go-to-emails link works", function() {
    owensBrowser.waitAndClick('.s_A_Us_U_Rows_Row_EmlManage');
    owensBrowser.waitForVisible('.s_UP_EmLg');
  });

  it("... and Marias address appears, status verified", function() {
    owensBrowser.userProfilePage.preferences.emailsLogins.waitUntilEmailAddressListed(
        maria.emailAddress, { shallBeVerified: true });
  });

});

