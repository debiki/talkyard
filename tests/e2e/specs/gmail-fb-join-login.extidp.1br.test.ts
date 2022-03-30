/// <reference path="../test-types.ts"/>

import _ = require('lodash');
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
const logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
const logMessage = logAndDie.logMessage;

const testName = 'gmail-fb-join-login.extidp.1br.test.ts  TyTE2EGMFBJOINLGI';
let idAddress: IdAddress;
let browser: TyE2eTestBrowser;


describe(testName, () => {

  if (!settings.include3rdPartyDependentTests) {
    console.log(`Skipping test '${testName}' because 3rd party related tests not enabled.`);
    return;
  }

  it("create site", () => {
    browser = new TyE2eTestBrowser(wdioBrowser);
    let site: SiteData = make.forumOwnedByOwen('oauth-login', { title: "OAuth Login Forum" });
    idAddress = server.importSiteData(site);
  });


  // ---------- Gmail

  it("can sign up and reply with Gmail @login @gmail @google", () => {
    browser.go(idAddress.origin);
    browser.disableRateLimits();
    browser.topbar.clickSignUp();
    browser.loginDialog.createGmailAccount({
      username: 'gmail_user',
      email: settings.gmailEmail,
      password: settings.gmailPassword,
    });
    browser.topbar.assertMyUsernameMatches('gmail_user');
    browser.disableRateLimits();
  });

  it("the Gmail user can create a topic  @gmail @google", () => {
    browser.complex.createAndSaveTopic({title: "Gmail user's topic", body: "Body."});
  });

  it("can reply, as Gmail user  @gmail @google", () => {
    browser.complex.replyToOrigPost("Me the gmail_user's reply.");
  });

  it("can log in with Gmail @login @gmail @google", () => {
    browser.topbar.clickLogout();
    browser.topbar.clickLogin();
    browser.loginDialog.loginWithGmail({
      email: settings.gmailEmail,
      password: settings.gmailPassword,
    }, undefined);
    browser.topbar.assertMyUsernameMatches('gmail_user');
  });


  // ---------- Facebook

  if (settings.skipFacebook) {  //---------------------------------------------
    console.log("Skipping Facebook login tests.");
  }
  else {
  it("can sign up and reply with Facebook @login @facebook", () => {
    browser.topbar.clickLogout();
    browser.topbar.clickSignUp();
    browser.loginDialog.createFacebookAccount({
      username: 'fb_user',
      email: settings.facebookUserEmail,
      password: settings.facebookUserPassword,
    });
    browser.topbar.assertMyUsernameMatches('fb_user');
  });

  it("can reply, as Facebook user  @facebook", () => {
    browser.complex.replyToOrigPost("Me too, the fb_user's reply.");
  });

  it("can log in with Facebook @login @facebook", () => {
    browser.topbar.clickLogout();
    browser.topbar.clickLogin();
    browser.loginDialog.loginWithFacebook({
      email: settings.facebookUserEmail,
      password: settings.facebookUserPassword,
    });
    browser.topbar.assertMyUsernameMatches('fb_user');
  });
  } //---------------------------------------------------------------------------


  // ---------- All fine?

  it("the gmail user's reply is visible @gmail @google", () => {
    browser.topic.waitForPostAssertTextMatches(2, 'the gmail_user');
  });

  if (!settings.skipFacebook) {  //----------------------------------------------
  it("the facebook user's reply is visible @facebook", () => {
    browser.topic.waitForPostAssertTextMatches(3, 'the fb_user');
  });
  } //---------------------------------------------------------------------------

});

