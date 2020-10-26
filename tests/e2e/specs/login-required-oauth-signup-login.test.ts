/// <reference path="../test-types.ts"/>

import _ = require('lodash');
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');

let idAddress: IdAddress;
let browser: TyE2eTestBrowser;

const googleUsersTopic =
    { title: "I am the Goog of Email", body: "Faster than snails I send mails" };

const testName = 'login-required-oauth-signup-login.test.ts';


describe(`${testName}  TyT406MRTJW2`, () => {

  if (!settings.include3rdPartyDependentTests) {
    lad.logMessage(`Skipping test '${testName}' because 3rd party related tests not enabled.`);
    return;
  }

  it("create site", () => {
    browser = new TyE2eTestBrowser(wdioBrowser);
    const site: SiteData2 = make.forumOwnedByOwen('oauth-login', { title: "OAuth Login Forum" });
    site.settings.userMustBeAuthenticated = true;
    idAddress = server.importSiteData(site);
  });


  // ---------- Signup with OpenAuth, when wesite requires login

  // This loads the /-/login-oauth-continue endpoint full screen, instead of in a
  // popup — which triggers slightly different code paths.
  // (Because login is required to access the site:  userMustBeAuthenticated is true.)

  it("Can sign up with Gmail @login @gmail @google", () => {
    browser.go(idAddress.origin);
    browser.disableRateLimits();
    browser.loginDialog.createGmailAccount({
      username: 'gmail_user',
      email: settings.gmailEmail,
      password: settings.gmailPassword,
    }, {
      isInFullScreenLogin: true,
      anyWelcomeDialog: 'THERE_WILL_BE_NO_WELCOME_DIALOG',
    });
  });

  it("... the topbar updates to show the username", () => {
    browser.topbar.assertMyUsernameMatches('gmail_user');
    browser.disableRateLimits();
  });

  it("The Gmail user can create a topic  @gmail @google", () => {
    browser.complex.createAndSaveTopic(googleUsersTopic);
  });

  it("Logs out", () => {
    browser.rememberCurrentUrl();
    assert.equal(browser.urlPath(), `/-${c.SecondPageId}/i-am-the-goog-of-email`);
    browser.topbar.clickLogout({ waitForLoginButton: false });
  });

  it("... gets redirected to the homepage, because may not see the topic, [TyT503KRDHJ2] " +
      "and leaving the url visible in the address bar could reveal that the topic exists", () => {
    browser.waitForNewUrl();
    assert.equal(browser.urlPath(), '/');
  });


  // ---------- Login with OpenAuth, when wesite requires login


  it("Reloads the page", () => {
    browser.refresh();
  });

  it("Can log in with Gmail @login @gmail @google", () => {
    browser.loginDialog.loginWithGmail({
      email: settings.gmailEmail,
      password: settings.gmailPassword,
    }, undefined, {
      isInFullScreenLogin: true,
      anyWelcomeDialog: 'THERE_WILL_BE_NO_WELCOME_DIALOG',
    });
  });

  it("... gets logged in with the correct username", () => {
    browser.topbar.assertMyUsernameMatches('gmail_user');
  });


  it("Sees the topic in the topic list", () => {
    browser.forumTopicList.waitForTopicVisible(googleUsersTopic.title);
    browser.forumTopicList.assertNumVisible(1);
  });


  it("... opens it", () => {
    browser.forumTopicList.goToTopic(googleUsersTopic.title);
  });


  it("The topic is visible @gmail @google", () => {
    browser.topic.waitForPostAssertTextMatches(c.BodyNr, googleUsersTopic.body);
  });

});

