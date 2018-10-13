/// <reference path="../test-types.ts"/>

import _ = require('lodash');
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pages = require('../utils/pages');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import createTestData = require('./create-site-impl');
const logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
const logMessage = logAndDie.logMessage;

declare let browser: any;

const newMembersEmail = 'e2e-test--mia@example.com';
const newMembersTopicTitle = 'newMembersTopicTitle';
const newMembersTopicText = 'newMembersTopicText';

describe('create-site-gmail  @createsite  @login @gmail TyT7KKTEHS24', () => {

  if (!settings.include3rdPartyDependentTests) {
    console.log("Skipping this spec; no 3rd party login credentials specified.");
    return;
  }

  it('initialize', () => {
    browser = _.assign(browser, pagesFor(browser));
  });

  it('can create a new site as a Gmail user, when not logged in to Gmail', () => {
    makeForumWithGmailAdminAccount();
  });

  it('can actually use the Gmail admin account to create stuff', () => {
    pages.complex.createAndSaveTopic({ title: "Gmail topic title", body: "Body" });
    pages.topbar.clickLogout(); // (6HRWJ3)
  });

  // This is for OpenAuth created users. [7LERTA1]
  //describe('owner gets notifications about new topics (because is owner)', () => {  'describe' —> ignored
    it('a new member signs up', () => {
      pages.complex.signUpAsMemberViaTopbar({
          emailAddress: newMembersEmail, username: 'Mia', password: 'public1122' });
    });
    it('verifies hens email address', () => {
      const siteId = pages.getSiteId();
      const link = server.getLastVerifyEmailAddressLinkEmailedTo(siteId, newMembersEmail, browser);
      browser.go(link);
    });
    it('posts a topic', () => {
      browser.go('/');
      pages.complex.createAndSaveTopic({ title: newMembersTopicTitle, body: newMembersTopicText });
    });
    it('the owner gets an email notification', () => {
      const siteId = pages.getSiteId();
      server.waitUntilLastEmailMatches(
          siteId, settings.gmailEmail, [newMembersTopicTitle, newMembersTopicText], browser);
      pages.topbar.clickLogout(); // (6HRWJ3)
    });
  //});

  it('can create a new site as a Gmail user, when already logged in to Gmail', () => {
    // Now we're logged in already, so the Gmail login flow is / might-be slightly different.
    makeForumWithGmailAdminAccount();
    pages.topbar.clickLogout(); // (6HRWJ3)
  });

  function makeForumWithGmailAdminAccount() {
    const data = createTestData();
    data.email = settings.gmailEmail;
    data.password = settings.gmailPassword;
    browser.go(utils.makeCreateSiteWithFakeIpUrl());
    browser.disableRateLimits(); // there're signup rate limits
    pages.createSite.fillInFieldsAndSubmit(data);
    pages.createSite.clickOwnerSignupButton();
    pages.loginDialog.createGmailAccount(data, true);
    pages.createSomething.createForum("Gmail Forum Title");
  }

});

