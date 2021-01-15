/// <reference path="../test-types.ts"/>

import _ = require('lodash');
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import createTestData = require('./create-site-impl');
import c = require('../test-constants');
const logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
const logMessage = logAndDie.logMessage;

let browser: TyE2eTestBrowser;

const newMembersEmail = 'e2e-test--mia@example.com';
const newMembersTopicTitle = 'newMembersTopicTitle';
const newMembersTopicText = 'newMembersTopicText';

describe('create-site-github-oauth-uppercase-email  @createsite  @login @github  TyT5AKR2Z95', () => {

  if (!settings.include3rdPartyDependentTests) {
    console.log("Skipping this spec; no 3rd party login credentials specified.");
    return;
  }

  if (settings.secure) {
    die("GitHub authn e2e test creds currently use http [TyE8020756SRM]");
  }

  it('initialize', () => {
    browser = new TyE2eTestBrowser(wdioBrowser);
  });

  it("The test really uses mixed case OpenAuth email and username  [TyTMXDCSEOAUTH]", () => {
    const email = settings.githubEmailMixedCase;
    const username = settings.githubUsernameMixedCase;
    assert(email && email !== email.toLowerCase(),
        "githubEmailMixedCase is not mixed case: " + email);
    assert(username && username !== username.toLowerCase(),
        "githubUsernameMixedCase is not mixed case: " + username);
  });

  it("The email addr local part is too long for a username [6AKBR20Q]", () => {
    assert(settings.githubUsernameMixedCase.length > c.MaxUsernameLength);
  });



  addCreateSiteWithGitHubTestSteps({ alreadyLoggedIn: false });

  it('gets the correct username, truncted to MaxUsernameLength = 20, ' +
        'although the email addr local part is longer [6AKBR20Q]', () => {
    assert.equal(
        browser.topbar.getMyUsername(),
        settings.githubUsernameMixedCase
            .replace(/-/g, '_')
            .substr(0, c.MaxUsernameLength));
  });

  it('can actually use the GitHub admin account to create stuff', () => {
    browser.complex.createAndSaveTopic({ title: "GitHub topic title", body: "Body" });
    browser.topbar.clickLogout(); // (6HRWJ3)
  });



  // Now we're logged in already, so the GitHub login flow can be slightly different.
  addCreateSiteWithGitHubTestSteps({ alreadyLoggedIn: true });

  it("Goes to profile page, views account info", () => {
    browser.topbar.clickGoToProfile();
    browser.userProfilePage.goToPreferences();
    browser.userProfilePage.preferences.switchToEmailsLogins();
  });

  it("... signup is indeed via GitHub and a mixed case email address  [TyT4AR8GFAH]", () => {
    browser.userProfilePage.preferences.emailsLogins.waitAndAssertLoginMethod({
          providerName: 'github', username: settings.githubUsernameMixedCase,
          emailAddr: settings.githubEmailMixedCase });
  });

  it("... which was converted to lowercase", () => {
    browser.userProfilePage.preferences.emailsLogins.waitUntilEmailAddressListed(
        settings.githubEmailMixedCase.toLowerCase(), { shallBeVerified: true });
  });


  function addCreateSiteWithGitHubTestSteps(ps: { alreadyLoggedIn: boolean }) {
    const maybe = ps.alreadyLoggedIn ? "already" : "not";
    let newSiteResult: NewSiteResult;

    it(`can create site as GitHub user, when ${maybe} logged in to GitHub`, () => {
      const data = createTestData({
        newSiteOwner: NewSiteOwnerType.GitHubAccount,
        alreadyLoggedInAtIdProvider: ps.alreadyLoggedIn,
      });
      newSiteResult = browser.newSite.createNewSite(data);
    });

    it('Sign up as owner', () => {
      browser.newSite.signUpAsOwner(newSiteResult);
    });

    it('create forum', () => {
      browser.createSomething.createForum("GitHub Forum Title");
    });
  }

});

