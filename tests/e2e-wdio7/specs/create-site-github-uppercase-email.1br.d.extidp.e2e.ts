/// <reference path="../test-types.ts"/>

import assert from '../utils/ty-assert';
import * as utils from '../utils/utils';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { die } from '../utils/log-and-die';
import c from '../test-constants';
import { NewSiteOwnerType } from '../test-constants';

let browser: TyE2eTestBrowser;

const newMembersEmail = 'e2e-test--mia@example.com';
const newMembersTopicTitle = 'newMembersTopicTitle';
const newMembersTopicText = 'newMembersTopicText';


describe('create-site-github-uppercase-email.1br.d.extidp  @createsite  @login @github  TyT5AKR2Z95', () => {

  if (!settings.include3rdPartyDependentTests) {
    console.log("Skipping this spec; no 3rd party login credentials specified.");
    return;
  }

  if (settings.secure) {
    die("GitHub authn e2e test creds currently use http [TyE8020756SRM]");
  }

  it('initialize', async () => {
    browser = new TyE2eTestBrowser(wdioBrowserA, 'brA');
  });

  it("The test really uses mixed case OpenAuth email and username  [TyTMXDCSEOAUTH]", async () => {
    const email = settings.githubEmailMixedCase;
    const username = settings.githubUsernameMixedCase;
    assert.ok(email && email !== email.toLowerCase(),
        "githubEmailMixedCase is not mixed case: " + email);
    assert.ok(username && username !== username.toLowerCase(),
        "githubUsernameMixedCase is not mixed case: " + username);
  });

  it("The email addr local part is too long for a username [6AKBR20Q]", async () => {
    assert.ok(settings.githubUsernameMixedCase.length > c.MaxUsernameLength);
  });



  addCreateSiteWithGitHubTestSteps({ alreadyLoggedIn: false });

  it('gets the correct username, truncted to MaxUsernameLength = 20, ' +
        'although the email addr local part is longer [6AKBR20Q]', async () => {
    assert.eq(
        await browser.topbar.getMyUsername(),
        settings.githubUsernameMixedCase
            .replace(/-/g, '_')
            .substr(0, c.MaxUsernameLength));
  });

  it('can actually use the GitHub admin account to create stuff', async () => {
    await browser.complex.createAndSaveTopic({ title: "GitHub topic title", body: "Body" });
    await browser.topbar.clickLogout(); // (6HRWJ3)
  });



  // Now we're logged in already, so the GitHub login flow can be slightly different.
  addCreateSiteWithGitHubTestSteps({ alreadyLoggedIn: true });

  it("Goes to profile page, views account info", async () => {
    await browser.topbar.clickGoToProfile();
    await browser.userProfilePage.goToPreferences();
    await browser.userProfilePage.preferences.switchToEmailsLogins();
  });

  it("... signup is indeed via GitHub and a mixed case email address  [TyT4AR8GFAH]", async () => {
    await browser.userProfilePage.preferences.emailsLogins.waitAndAssertLoginMethod({
          providerName: 'github', username: settings.githubUsernameMixedCase,
          emailAddr: settings.githubEmailMixedCase });
  });

  it("... which was converted to lowercase", async () => {
    await browser.userProfilePage.preferences.emailsLogins.waitUntilEmailAddressListed(
        settings.githubEmailMixedCase.toLowerCase(), { shallBeVerified: true });
  });


  function addCreateSiteWithGitHubTestSteps(ps: { alreadyLoggedIn: boolean }) {
    const maybe = ps.alreadyLoggedIn ? "already" : "not";
    let newSiteResult: NewSiteResult;

    it(`can create site as GitHub user, when ${maybe} logged in to GitHub`, async () => {
      const data = utils.generateNewSiteData({
        newSiteOwner: NewSiteOwnerType.GitHubAccount,
        alreadyLoggedInAtIdProvider: ps.alreadyLoggedIn,
      });
      newSiteResult = await browser.newSite.createNewSite(data);
    });

    it('Sign up as owner', async () => {
      await browser.newSite.signUpAsOwner(newSiteResult);
    });

    it('create forum', async () => {
      await browser.createSomething.createForum("GitHub Forum Title");
    });
  }

});

