/// <reference path="../test-types.ts"/>

import * as utils from '../utils/utils';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { logMessage } from '../utils/log-and-die';

let browser: TyE2eTestBrowser;


describe('create-site-facebook.1br.d.extidp  @createsite @login @facebook  TyT8KA9AW3', () => {

  if (!settings.include3rdPartyDependentTests) {
    logMessage("Skipping this spec; no 3rd party login credentials specified.");
    return;
  }

  if (settings.skipFacebook) {
    logMessage("Skipping Facebook login tests.");
    return;
  }

  it('initialize', async () => {
    browser = new TyE2eTestBrowser(wdioBrowserA, 'brA');
  });


  addCreateSiteWithFacebookTestSteps({ alreadyLoggedIn: false });

  it('Can actually use the FB admin account to create stuff', async () => {
    await browser.complex.createAndSaveTopic({ title: "Facebook topic title", body: "Body" });
  });

  it('Logout from Talkyard after', async () => {
    // This logs out from the Talkyard site only, to clear Ty cookies,
    // so won't affect other tests.
    await browser.topbar.clickLogout(); // (6HRWJ3)
  });


  // Now we're logged in over at Facebook already, so the Facebook login flow
  // can be slightly different.
  addCreateSiteWithFacebookTestSteps({ alreadyLoggedIn: true });

  it('Logout after', async () => {
    await browser.topbar.clickLogout(); // (6HRWJ3)
  });


  function addCreateSiteWithFacebookTestSteps(ps: { alreadyLoggedIn: boolean }) {
    const maybe = ps.alreadyLoggedIn ? "already" : "not";
    let newSiteResult: NewSiteResult;

    it(`can create site as Facebook user, when ${maybe} logged in to Facebook`, async () => {
      const data = utils.generateNewSiteData({
        newSiteOwner: NewSiteOwnerType.FacebookAccount,
        alreadyLoggedInAtIdProvider: ps.alreadyLoggedIn,
      });
      logMessage("Create new site:");
      newSiteResult = await browser.newSite.createNewSite(data);
    });

    it('Sign up as owner', async () => {
      await browser.newSite.signUpAsOwner(newSiteResult);
    });

    it('Create forum', async () => {
      await browser.createSomething.createForum("Facebook Forum Title");
    });
  }

});

