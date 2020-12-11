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

let forum: EmptyTestForum;

let everyonesBrowser: TyE2eTestBrowser;
let gmailUsersBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId;
let forumTitle = "Cannot Remove OpenAuth Email Test Forum";

const emailAddress2 = "e2e-test--email-addr-2@example.com";
const emailAddress3 = "e2e-test--email-addr-3@example.com";


describe("user profile cannot delete openauth email:", () => {

  if (!settings.include3rdPartyDependentTests)
    return;

  it("import a site, init people", () => {
    everyonesBrowser = new TyE2eTestBrowser(wdioBrowser);
    gmailUsersBrowser = everyonesBrowser;

    forum = buildSite().addEmptyForum({ title: forumTitle });

    idAddress = server.importSiteData(forum.siteData);
    siteId = idAddress.id;
  });

  it("A user signs up, with Gmail", () => {
    gmailUsersBrowser.go(idAddress.origin);
    gmailUsersBrowser.complex.signUpAsGmailUserViaTopbar({ username: 'gmailuser' });
  });

  it("... hen goes to hens email addresses page", () => {
    gmailUsersBrowser.topbar.clickGoToProfile();
    gmailUsersBrowser.userProfilePage.clickGoToPreferences();
    gmailUsersBrowser.userProfilePage.preferences.switchToEmailsLogins();
  });

  it("Hens gmail address is listed as login method", () => {
    const text = gmailUsersBrowser.getText('.s_UP_EmLg_LgL');
    assert(text.search("Google") >= 0);
    assert(text.search(settings.gmailEmail) > 0);
  });

  it("Hen adds a new email address", () => {
    gmailUsersBrowser.userProfilePage.preferences.emailsLogins.addEmailAddress(emailAddress2);
  });

  let email2VerifLink;

  it("... hen gets an address verification email", () => {
    email2VerifLink = server.waitAndGetVerifyAnotherEmailAddressLinkEmailedTo(
        siteId, emailAddress2, browser);
  });

  it("... and clicks the verif link", () => {
    gmailUsersBrowser.go(email2VerifLink);
    gmailUsersBrowser.hasVerifiedEmailPage.waitUntilLoaded({ needToLogin: false });
    gmailUsersBrowser.hasVerifiedEmailPage.goToProfile();
  });

  it("... sets the new address as hens primary", () => {
    gmailUsersBrowser.userProfilePage.preferences.emailsLogins.makeOtherEmailPrimary();
  });

  it("... but cannot delete the original address, because it's used for OpenAuth login", () => {
    gmailUsersBrowser.waitForGone('.e_RemoveEmB');
    assert(!gmailUsersBrowser.userProfilePage.preferences.emailsLogins.canRemoveEmailAddress());
  });

  it("Hen adds a third address", () => {
    gmailUsersBrowser.userProfilePage.preferences.emailsLogins.addEmailAddress(emailAddress3);
  });

  it("... clicks an address verification link", () => {
    const url = server.waitAndGetVerifyAnotherEmailAddressLinkEmailedTo(
        siteId, emailAddress3, browser);
    gmailUsersBrowser.go(url);
    gmailUsersBrowser.hasVerifiedEmailPage.waitUntilLoaded({ needToLogin: false });
    gmailUsersBrowser.hasVerifiedEmailPage.goToProfile();
  });

  it("... makes it the primary email", () => {
    // Emails are sorted alphabetically, so:
    // List item 1 = address 2,  item 2 = address 3,  item 3 = the gmail address.
    gmailUsersBrowser.waitAndClick('.e_MakeEmPrimaryB', { clickFirst: true });

    // Before, when not sorted, usually could click the 3rd i.e. the last:
    // gmailUsersBrowser.waitAndClick('.s_UP_EmLg_EmL_It:last-child .e_MakeEmPrimaryB');
  });

  it("Now hen can remove address no. 2", () => {
    gmailUsersBrowser.userProfilePage.preferences.emailsLogins.removeFirstEmailAddrOutOf(1);
  });

  it("The gmail address and third address remains", () => {
    const text = gmailUsersBrowser.getText('.s_UP_EmLg_EmL');
    logAndDie.logMessage(`Text: ${text}`)
    assert(text.search(settings.gmailEmail) >= 0);
    assert(text.search(emailAddress2) === -1);
    assert(text.search(emailAddress3) >= 0);
  });

  it("But hen still cannot delete the OpenAuth address", () => {
    assert(!gmailUsersBrowser.userProfilePage.preferences.emailsLogins.canRemoveEmailAddress());
    // Test after refresh too.
    gmailUsersBrowser.refresh();
    assert(!gmailUsersBrowser.userProfilePage.preferences.emailsLogins.canRemoveEmailAddress());
  });

  it("... it's still listed as her login method", () => {
    const text = gmailUsersBrowser.getText('.s_UP_EmLg_LgL');
    assert(text.search("Google") >= 0);
    assert(text.search(settings.gmailEmail) > 0);
  });

});

