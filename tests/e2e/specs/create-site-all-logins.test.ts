/// <reference path="../test-types.ts"/>

import _ = require('lodash');
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pages = require('../utils/pages');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
const logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
const logMessage = logAndDie.logMessage;

declare let browser: any;

const newMembersEmail = 'e2e-test--mia@example.com';
const newMembersTopicTitle = 'newMembersTopicTitle';
const newMembersTopicText = 'newMembersTopicText';

describe('/-/create-site  @createsite  TyT5KBWAZ2', () => {

  function createPasswordTestData() {
    const testId = utils.generateTestId();
    const localHostname = settings.localHostname ||
                        settings.testLocalHostnamePrefix + 'create-site-' + testId;
    return {
      testId: testId,
      localHostname: localHostname,
      origin: utils.makeSiteOrigin(localHostname),
      originRegexEscaped: utils.makeSiteOriginRegexEscaped(localHostname),
      orgName: "E2E Org Name",
      fullName: 'E2E Test ' + testId,
      email: settings.testEmailAddressPrefix + testId + '@example.com',
      // Prefix the number with 'z' because '..._<number>' is reserved. [7FLA3G0L]
      username: 'e2e_test_z' + testId,
      password: 'pub5KFV2FY8C',
    }
  }

  it('initialize', () => {
    browser = _.assign(browser, pagesFor(browser));
  });

  it('can create a new site as a Password user  @login @password', () => {
    // Something timed out in here, twice. [E2EBUG]
    // Break up into smaller steps then? To find out what.
    browser.perhapsDebugBefore();
    const data = createPasswordTestData();
    browser.go(utils.makeCreateSiteWithFakeIpUrl());
    browser.disableRateLimits();
    pages.createSite.fillInFieldsAndSubmit(data);
    // New site; disable rate limits here too.
    browser.disableRateLimits();
    browser.click('#e2eLogin');
    pages.loginDialog.createPasswordAccount(data, true);
    const siteId = pages.getSiteId();
    const email = server.getLastEmailSenTo(siteId, data.email, browser);
    const link = utils.findFirstLinkToUrlIn(
        data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    browser.go(link);
    browser.waitAndClick('#e2eContinue');
    pages.createSomething.createForum("Password Forum Title");
  });

  // Done with create site stuff. But let's test a little bit more, so we know the forum can
  // actually be used, once it's been created: Edit forum title and post a topic.

  it("the forum works: can edit forum title", () => {
    // --- Edit title
    pages.pageTitle.clickEdit();
    pages.pageTitle.editTitle("Pwd Frm Edtd");
    pages.pageTitle.save();
    browser.assertPageTitleMatches(/Pwd Frm Edtd/);
  });

  it("the forum works: can post a topic", () => {
    browser.waitAndClick('#e2eCreateSth');
    browser.waitAndSetValue('.esEdtr_titleEtc_title', "New tpc ttl");
    browser.setValue('textarea', "New tpc txt");
    browser.rememberCurrentUrl();
    browser.click('.e2eSaveBtn');
    browser.waitForNewUrl();
    browser.assertTextMatches('h1', /New tpc ttl/);
    browser.assertTextMatches('#post-1', /New tpc txt/);

    // Logout, to delete cookies, so subsequent create-site-at-same-URL tests won't fail
    // because of them.  (6HRWJ3)
    pages.topbar.clickLogout();
  });

  if (!settings.include3rdPartyDependentTests) {
    console.log("Skipping this spec; no 3rd party login credentials specified.");
    return;
  }

  it('can create a new site as a Gmail user, when not logged in to Gmail  @login @gmail @google', () => {
    makeForumWithGmailAdminAccount();
  });

  it('can actually use the Gmail admin account to create stuff @gmail @google', () => {
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

  it('can create a new site as a Gmail user, when already logged in to Gmail  @login @gmail @google', () => {
    // Now we're logged in already, so the Gmail login flow is / might-be slightly different.
    makeForumWithGmailAdminAccount();
    pages.topbar.clickLogout(); // (6HRWJ3)
  });

  function makeForumWithGmailAdminAccount() {
    const data = createPasswordTestData();
    data.email = settings.gmailEmail;
    data.password = settings.gmailPassword;
    browser.go(utils.makeCreateSiteWithFakeIpUrl());
    browser.disableRateLimits(); // there're signup rate limits
    pages.createSite.fillInFieldsAndSubmit(data);
    browser.click('#e2eLogin');
    pages.loginDialog.createGmailAccount(data, true);
    pages.createSomething.createForum("Gmail Forum Title");
  }

  it('can create a new site as a Facebook user, when not logged in to FB  @login @facebook', () => {
    makeForumWithFacebookAdminAccount();
  });

  it('can actually use the FB admin account to create stuff @facebook', () => {
    pages.complex.createAndSaveTopic({ title: "Facebook topic title", body: "Body" });
    pages.topbar.clickLogout(); // (6HRWJ3)
  });

  it('can create a new site as Facebook user, when already logged in to FB  @login @facebook', () => {
    // Now we're logged in already, so the Facebook login flow is / might-be slightly different.
    makeForumWithFacebookAdminAccount();
    pages.topbar.clickLogout(); // (6HRWJ3)
  });

  function makeForumWithFacebookAdminAccount() {
    const data = createPasswordTestData();
    data.email = settings.facebookAdminEmail;
    data.password = settings.facebookAdminPassword;
    browser.go(utils.makeCreateSiteWithFakeIpUrl());
    browser.disableRateLimits(); // there're signup rate limits
    pages.createSite.fillInFieldsAndSubmit(data);
    browser.click('#e2eLogin');
    pages.loginDialog.createFacebookAccount(data, true);
    pages.createSomething.createForum("Facebook Forum Title");
  }

  it("Done.", () => {
    browser.perhapsDebug();
  });

});

