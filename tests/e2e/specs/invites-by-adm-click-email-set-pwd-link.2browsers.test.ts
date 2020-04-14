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
let owensBrowser: TyE2eTestBrowser;
let janesBrowser: TyE2eTestBrowser;

let siteId;
let siteIdAddress: IdAddress;
let forumTitle = "Some E2E Test";

const janesEmailAddress = 'e2e-test--jane@example.com';
const janesUsername = 'e2e_test_jane';
const janesTopicData = { title: "Hello I'm Jane", body: "Where am I?" };
const janesTopicData2 = { title: "I'm Jane", body: "I said I'll be back. Now I am back." };
const janesPassword = 'publ-ja020';


describe("invites-by-adm-click-email-set-pwd-link  TyT45FKAZZ2", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: forumTitle,
      members: []
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
    owensBrowser = staffsBrowser;

    janesBrowser = othersBrowser;
  });

  it("Owen goes to the Invites tab", () => {
    owensBrowser.adminArea.goToUsersInvited(siteIdAddress.origin, { loginAs: owen });
  });

  it("He sends an invite to Jane", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeAndSubmitInvite(janesEmailAddress, { numWillBeSent: 1 });
  });

  let inviteLinkJane;

  it("Jane gets an invite email", () => {
    inviteLinkJane = server.waitAndGetInviteLinkEmailedTo(siteId, janesEmailAddress, browserA);
  });

  it("... the email tells her what her username will probably be", () => {
    const { bodyHtmlText } = server.getLastEmailSenTo(siteId, janesEmailAddress, browserA);
    assert(bodyHtmlText.search(janesUsername) >= 0);
  });

  it("... clicks the link", () => {
    janesBrowser.go(inviteLinkJane);
  });

  it("... and gets logged in directly", () => {
    janesBrowser.topbar.waitForMyMenuVisible();
    janesBrowser.topbar.assertMyUsernameMatches(janesUsername);
    janesBrowser.disableRateLimits();
  });

  let choosePasswordLink;

  it("Jane gets a 'Thanks for accepting the invitation' email", () => {
    choosePasswordLink = server.waitAndGetThanksForAcceptingInviteEmailResetPasswordLink(
        siteId, janesEmailAddress, browserA);
  });

  it("... that email tells her what her username now is", () => {
    const { bodyHtmlText } = server.getLastEmailSenTo(siteId, janesEmailAddress, browserA);
    // Double check we're checking for the username in the correct email.
    assert(bodyHtmlText.search("thanks for accepting the invitation") >= 0);  // [5FJB2AZY_]
    assert(bodyHtmlText.search(janesUsername) >= 0);
  });

  it("Jane can create a topic", () => {
    janesBrowser.complex.createAndSaveTopic(janesTopicData);
  });

  it("Jane logs out", () => {
    janesBrowser.topbar.clickLogout();
  });

  it("She clicks the choose-password link in the email", () => {
    janesBrowser.go(choosePasswordLink);
  });

  it("... and chooses a password", () => {
    janesBrowser.chooseNewPasswordPage.typeAndSaveNewPassword(janesPassword);
  });

  it("She logs out", () => {
    janesBrowser.go('/');
    janesBrowser.topbar.clickLogout();
  });

  it("She tries to login with no password", () => {
    janesBrowser.topbar.clickLogin();
    janesBrowser.loginDialog.loginButBadPassword(janesUsername, '');
  });

  it("... then, the wrong password", () => {
    janesBrowser.loginDialog.loginButBadPassword(janesUsername, "bad-password");
  });

  it("... finally with the correct password", () => {
    janesBrowser.loginDialog.loginWithPassword(janesUsername, janesPassword)
  });

  it("She posts a 2nd topic", () => {
    janesBrowser.complex.createAndSaveTopic(janesTopicData2);
  });

});

