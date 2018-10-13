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

describe('create-site-github-oauth-uppercase-email  @createsite  @login @github  TyT5AKR2Z95', () => {

  if (!settings.include3rdPartyDependentTests) {
    console.log("Skipping this spec; no 3rd party login credentials specified.");
    return;
  }

  it('initialize', () => {
    browser = _.assign(browser, pagesFor(browser));
  });

  it("The test really uses mixed case OpenAuth email and username  [TyTMXDCSEOAUTH]", () => {
    const email = settings.githubEmailMixedCase;
    const username = settings.githubUsernameMixedCase;
    assert(email && email !== email.toLowerCase(),
        "githubEmailMixedCase is not mixed case: " + email);
    assert(username && username !== username.toLowerCase(),
        "githubUsernameMixedCase is not mixed case: " + username);
  });

  it('can create a new site as a GitHub user, when not logged in to GitHub', () => {
    makeForumWithGitHubAdminAccount({ alreadyLoggedInAtGitHub: false });
  });

  it('can actually use the GitHub admin account to create stuff', () => {
    pages.complex.createAndSaveTopic({ title: "GitHub topic title", body: "Body" });
    pages.topbar.clickLogout(); // (6HRWJ3)
  });

  it('can create a new site as GitHub user, when already logged in to GitHub', () => {
    // Now we're logged in already, so the GitHub login flow is / might-be slightly different.
    makeForumWithGitHubAdminAccount({ alreadyLoggedInAtGitHub: true });
  });

  it("Goes to profile page, views account info", () => {
    pages.topbar.clickGoToProfile();
    pages.userProfilePage.goToPreferences();
    pages.userProfilePage.preferences.switchToEmailsLogins();
  });

  it("... signup is indeed via GitHub and a mixed case email address  [TyT4AR8GFAH]", () => {
    pages.userProfilePage.preferences.emailsLogins.waitAndAssertLoginMethodId({
        providerName: 'github', id: settings.githubEmailMixedCase });
  });

  it("... which was converted to lowercase", () => {
    pages.userProfilePage.preferences.emailsLogins.waitUntilEmailAddressListed(
        settings.githubEmailMixedCase.toLowerCase(), { shallBeVerified: true });
  });

  function makeForumWithGitHubAdminAccount(ps: { alreadyLoggedInAtGitHub: boolean }) {
    const data = createTestData();
    data.email = settings.githubEmailMixedCase;
    browser.go(utils.makeCreateSiteWithFakeIpUrl());
    browser.disableRateLimits(); // there're signup rate limits
    pages.createSite.fillInFieldsAndSubmit(data);
    pages.createSite.clickOwnerSignupButton();
    pages.loginDialog.createGitHubAccount({
        username: settings.githubUsernameMixedCase, password: settings.githubPassword,
        shallBecomeOwner: true, alreadyLoggedInAtGitHub: ps.alreadyLoggedInAtGitHub });
    pages.createSomething.createForum("GitHub Forum Title");
  }

});

