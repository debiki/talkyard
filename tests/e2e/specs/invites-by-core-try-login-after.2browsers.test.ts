/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

let forum: EmptyTestForum;

let staffsBrowser;
let othersBrowser;
let owen: Member;
let owensBrowser;
let corax: Member;
let coraxBrowser;
let janesBrowser;

let siteId;
let siteIdAddress: IdAddress;
let forumTitle = "Some E2E Test";

const janesEmailAddress = 'e2e-test--jane@example.com';
const janesUsername = 'e2e_test_jane';
const janesPassword = 'publ-ja020';


describe("invites-by-core-try-login-after TyT2WKF5PF30", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: forumTitle,
      members: ['corax']  // is core member
    });
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
  });

  it("initialize people", () => {
    staffsBrowser = _.assign(browserA, pagesFor(browserA));
    othersBrowser = _.assign(browserB, pagesFor(browserB));

    owen = forum.members.owen;
    owensBrowser = staffsBrowser;
    corax = forum.members.corax;
    coraxBrowser = staffsBrowser;

    janesBrowser = othersBrowser;
  });

  it("Corax Core Member goes to his profile page", () => {
    coraxBrowser.go(siteIdAddress.origin);
    coraxBrowser.complex.loginWithPasswordViaTopbar(corax);
    coraxBrowser.topbar.clickGoToProfile();
  });

  it("He sends an invite to Jane", () => {
    assert(coraxBrowser.userProfilePage.isInvitesTabVisible()); // tests that this test fn works (42BK6)
    coraxBrowser.userProfilePage.switchToInvites();
    assert(coraxBrowser.invitedUsersList.countNumInvited() === 0);
    coraxBrowser.userProfilePage.invites.clickSendInvite();
    coraxBrowser.inviteDialog.typeAndSubmitInvite(janesEmailAddress);
  });

  it("... it appears in the Invites-Sent list", () => {
    coraxBrowser.invitedUsersList.waitAssertInviteRowPresent(1, { email: janesEmailAddress });
    assert(coraxBrowser.invitedUsersList.countNumInvited() === 1);
    coraxBrowser.invitedUsersList.assertHasNotAcceptedInvite(janesUsername);
  });

  let inviteLinkJane;

  it("Jane gets an invite email", () => {
    inviteLinkJane = server.waitAndGetInviteLinkEmailedTo(siteId, janesEmailAddress, browserA);
  });

  it("... clicks the link", () => {
    janesBrowser.go(inviteLinkJane);
  });

  it("... and get auto logged in", () => {
    janesBrowser.topbar.waitForMyMenuVisible();
    janesBrowser.topbar.assertMyUsernameMatches(janesUsername);
  });

  it("... and gets a 'Thanks for accepting the invitation' email", () => {
    server.waitAndGetThanksForAcceptingInviteEmailResetPasswordLink(siteId, janesEmailAddress, browserA);
  });

  it("Corax sees in the invited users list that Jane has accepted the invite", () => {
    coraxBrowser.refresh();
    coraxBrowser.invitedUsersList.waitUntilLoaded();
    assert(coraxBrowser.invitedUsersList.countNumInvited() === 1);
    coraxBrowser.invitedUsersList.assertHasAcceptedInvite(janesUsername);
  });

  it("Jane logs out", () => {
    janesBrowser.topbar.clickLogout();
  });

  it("Now she wants to log in, types username but no password, she hasn't created one", () => {
    janesBrowser.topbar.clickLogin();
    janesBrowser.loginDialog.fillInUsername(janesUsername);
    janesBrowser.loginDialog.clickSubmit();
  });

  it("... sees the create password dialog", () => {
    // Other things she could have done: Clicked the choose-password link in the email she got,
    // see  invites-by-adm-click-email-set-pwd-link  TyT45FKAZZ2.
    janesBrowser.loginDialog.waitForNotCreatedPasswordDialog();
  });

  it("... clicks Create Password", () => {
    janesBrowser.loginDialog.clickCreatePasswordButton();
  });

  it("... types her email address", () => {
    janesBrowser.swithToOtherTabOrWindow();
    janesBrowser.resetPasswordPage.submitAccountOwnerEmailAddress(janesEmailAddress);
    janesBrowser.switchBackToFirstTabOrWindow();
  });

  let resetLink;

  it("... gets a reset pwd email", () => {
    resetLink = server.waitAndGetResetPasswordLinkEmailedTo(siteId, janesEmailAddress, browserA);
  });

  it("... clicks the reset link", () => {
    janesBrowser.go(resetLink);
  });

  it("... and chooses a password", () => {
    janesBrowser.chooseNewPasswordPage.typeAndSaveNewPassword(janesPassword);
  });

  it("Jane now logs out", () => {
    janesBrowser.go('/');
    janesBrowser.topbar.clickLogout();
  });

  it("... and can login in with the correct password", () => {
    janesBrowser.complex.loginWithPasswordViaTopbar(janesUsername, janesPassword)
  });

  it("Jane goes to her profile", () => {
    janesBrowser.topbar.clickGoToProfile();
  });

  it("There is no Invite tab, she's a new member, not yet allowed to invite others", () => {
    janesBrowser.userProfilePage.waitForTabsVisible();
    assert(!janesBrowser.userProfilePage.isInvitesTabVisible());  // (42BK6)
    // It's her own notifications.
    assert(janesBrowser.userProfilePage.isNotfsTabVisible());
  });

  it("Owen logs in", () => {
    coraxBrowser.topbar.clickLogout();
    owensBrowser.adminArea.goToUsersInvited(siteIdAddress.origin, { loginAs: owen });
  });

  it("... and sees in the admin Invited Users tab, that Jane accepted an invite", () => {
    owensBrowser.invitedUsersList.waitUntilLoaded();
    assert(owensBrowser.invitedUsersList.countNumInvited() === 1);
    owensBrowser.invitedUsersList.assertHasAcceptedInvite(janesUsername);
  });

  it("... and that she was inited by Corax", () => {
    owensBrowser.invitedUsersList.waitAssertInviteRowPresent(
        1, { email: janesEmailAddress, sentByUsername: corax.username });
  });

});

