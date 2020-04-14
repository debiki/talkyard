/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');





let forum: EmptyTestForum;

let everyonesBrowsers;
let staffsBrowser: TyE2eTestBrowser;
let othersBrowser: TyE2eTestBrowser;
let owen: Member;
let modya: Member;
let modyasBrowser: TyE2eTestBrowser;
let janesBrowser: TyE2eTestBrowser;

let siteId;
let siteIdAddress: IdAddress;
let forumTitle = "Some E2E Test";

const janesEmailAddress = 'e2e-test--jane@example.com';
const janesUsername = 'e2e_test_jane';
const janesPassword = 'publ-ja020';


describe("invites-by-mod-try-signup-after TyT4FGJA20M", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: forumTitle,
      members: ['modya']
    });
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    staffsBrowser = new TyE2eTestBrowser(browserA);
    othersBrowser = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    modya = forum.members.modya;
    modyasBrowser = staffsBrowser;
    janesBrowser = othersBrowser;
  });

  it("Modya goes to the Invites tab", () => {
    modyasBrowser.adminArea.goToUsersEnabled(siteIdAddress.origin);
    modyasBrowser.loginDialog.loginWithPassword(modya);
    modyasBrowser.adminArea.users.switchToInvites();
  });

  it("She sends an invite to Jane", () => {
    assert(modyasBrowser.invitedUsersList.countNumInvited() === 0);
    modyasBrowser.adminArea.users.invites.clickSendInvite();
    modyasBrowser.inviteDialog.typeAndSubmitInvite(janesEmailAddress);
  });

  it("... it appears in the Invites-Sent list", () => {
    modyasBrowser.invitedUsersList.waitAssertInviteRowPresent(
        1, { email: janesEmailAddress, accepted: false, sentByUsername: modya.username });
    assert(modyasBrowser.invitedUsersList.countNumInvited() === 1);
    modyasBrowser.invitedUsersList.assertHasNotAcceptedInvite(janesUsername);
  });

  it("... Jane is *not yet* in the New Members list", () => {
    modyasBrowser.adminArea.users.switchToNew();
    modyasBrowser.adminArea.users.asserExactlyNumUsers(2);  // Owen, Modya
    modyasBrowser.adminArea.users.assertUserListed(modya);
    modyasBrowser.adminArea.users.assertUserListed(owen);
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

  it("Modya now sees Jane in the New Members list", () => {
    modyasBrowser.refresh();
    modyasBrowser.adminArea.users.asserExactlyNumUsers(3);  // Jane, Modya, Owen
    modyasBrowser.adminArea.users.assertUserListed({ username: janesUsername });
    modyasBrowser.adminArea.users.assertUserListed(modya);
    modyasBrowser.adminArea.users.assertUserListed(owen);
  });

  it("... and sees in the invited users list that Jane has accepted the invite", () => {
    modyasBrowser.adminArea.users.switchToInvites();
    assert(modyasBrowser.invitedUsersList.countNumInvited() === 1);
    modyasBrowser.invitedUsersList.assertHasAcceptedInvite(janesUsername);
  });

  it("... Jane is in the the Enabled-users list  TyT2PK703S", () => {
    modyasBrowser.adminArea.users.switchToEnabled();
    modyasBrowser.adminArea.users.asserExactlyNumUsers(3);  // Jane, Modya, Owen
    modyasBrowser.adminArea.users.assertUserListed({ username: janesUsername });
    modyasBrowser.adminArea.users.assertUserListed(modya);
    modyasBrowser.adminArea.users.assertUserListed(owen);
  });

  it("... but not in the Staff list; invited users don't auto-become staff  TyT4WK0AQ2", () => {
    modyasBrowser.adminArea.users.switchToStaff();
    modyasBrowser.adminArea.users.asserExactlyNumUsers(2);  // Owen, Modya
    modyasBrowser.adminArea.users.assertUserListed(modya);
    modyasBrowser.adminArea.users.assertUserListed(owen);
  });

  it("Jane logs out", () => {
    janesBrowser.topbar.clickLogout();
  });

  it("She forgots that she has an account already, tries to sign up", () => {
    janesBrowser.topbar.clickSignUp();
    janesBrowser.loginDialog.fillInEmail(janesEmailAddress);
    janesBrowser.loginDialog.fillInUsername('janejane');
    janesBrowser.loginDialog.fillInPassword('publ-abc123def');
    janesBrowser.loginDialog.clickSubmit();
    janesBrowser.loginDialog.acceptTerms();
  });

  let resetPwdLink;

  it("... and gets an email that she has an account already", () => {
    resetPwdLink =
        server.waitForAlreadyHaveAccountEmailGetResetPasswordLink(siteId, janesEmailAddress, browserA);
  });

  it("... and doesn't get logged in", () => {
    janesBrowser.topbar.waitUntilLoginButtonVisible();
  });

  it("She clicks the reset-password link in the email", () => {
    janesBrowser.go(resetPwdLink);
  });

  it("... types her email address", () => {
    janesBrowser.resetPasswordPage.submitAccountOwnerEmailAddress(janesEmailAddress);
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

  it("She logs out", () => {
    janesBrowser.go('/');
    janesBrowser.topbar.clickLogout();
  });

  it("... and can login in with the correct password", () => {
    janesBrowser.complex.loginWithPasswordViaTopbar(janesUsername, janesPassword)
  });

});

