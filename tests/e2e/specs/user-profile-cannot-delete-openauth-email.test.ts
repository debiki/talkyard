/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import make = require('../utils/make');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import { buildSite } from '../utils/site-builder';
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;

let forum: EmptyTestForum;

let everyonesBrowser;
let gmailUsersBrowser;

let idAddress: IdAddress;
let siteId;
let forumTitle = "Cannot Remove OpenAuth Email Test Forum";

const emailAddress2 = "e2e-test--email-addr-2@example.com";
const emailAddress3 = "e2e-test--email-addr-3@example.com";


describe("user profile cannot delete openauth email:", () => {

  if (!settings.include3rdPartyDependentTests)
    return;

  it("import a site, init people", () => {
    browser.perhapsDebugBefore();

    everyonesBrowser = _.assign(browser, pagesFor(browser));
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
  });

  it("... sets the new address as hens primary", () => {
    gmailUsersBrowser.userProfilePage.preferences.emailsLogins.makeOtherEmailPrimary();
  });

  it("... but cannot delete the original address, because it's used for OpenAuth login", () => {
    assert(!gmailUsersBrowser.userProfilePage.preferences.emailsLogins.canRemoveEmailAddress());
  });

  it("Hen adds a third address", () => {
    gmailUsersBrowser.userProfilePage.preferences.emailsLogins.addEmailAddress(emailAddress3);
  });

  it("... clicks an address verification link", () => {
    const url = server.waitAndGetVerifyAnotherEmailAddressLinkEmailedTo(
        siteId, emailAddress3, browser);
    gmailUsersBrowser.go(url);
  });

  it("... makes it the primary email", () => {
    // No. 1 = the gmail address, no. 2 = address 2, no. 3 = address 3.
    browser.waitAndClick('.s_UP_EmLg_EmL_It:last-child .e_MakeEmPrimaryB');
  });

  it("Now hen can remove address no. 2", () => {
    gmailUsersBrowser.userProfilePage.preferences.emailsLogins.removeOneEmailAddress();
  });

  it("The gmail address and third address remains", () => {
    const text = gmailUsersBrowser.getText('.s_UP_EmLg_EmL');
    assert(text.search(settings.gmailEmail) >= 0);
    assert(text.search(emailAddress2) === -1);
    assert(text.search(emailAddress3) > 0);
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

