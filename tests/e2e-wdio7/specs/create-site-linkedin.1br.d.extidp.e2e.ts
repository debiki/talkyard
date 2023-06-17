/// <reference path="../test-types.ts"/>

import * as utils from '../utils/utils';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { die } from '../utils/log-and-die';
import { NewSiteOwnerType } from '../test-constants';

let browser: TyE2eTestBrowser;


describe('create-site-linkedin.1br.d.extidp  @createsite @login @linkedin  TyT402KDTT5Z', () => {

  if (!settings.include3rdPartyDependentTests) {
    console.log("Skipping this spec; no 3rd party login credentials specified.");
    return;
  }

  if (settings.secure) {
    die("LinkedIn authn e2e test creds currently use http [TyE8020756PM3]");
  }

  it('initialize', async () => {
    browser = new TyE2eTestBrowser(wdioBrowserA, 'brA');
  });

  addCreateSiteWithLinkedInTestSteps({ alreadyLoggedIn: false });

  it('can actually use the LinkedIn admin account to create stuff', async () => {
    await browser.complex.createAndSaveTopic({ title: "LinkedIn topic title", body: "Body" });
    await browser.topbar.clickLogout(); // (6HRWJ3)
  });

  // Now we're logged in already, so the LinkedIn login flow can be slightly different.
  addCreateSiteWithLinkedInTestSteps({ alreadyLoggedIn: true });

  it('Log out from Talkyard', async () => {
    await browser.topbar.clickLogout(); // (6HRWJ3)
  });


  function addCreateSiteWithLinkedInTestSteps(ps: { alreadyLoggedIn: boolean }) {
    const maybe = ps.alreadyLoggedIn ? "already" : "not";
    let newSiteResult: NewSiteResult;

    it(`can create site as LinkedIn user, when ${maybe} logged in to LinkedIn`, async () => {
      const data = utils.generateNewSiteData({
        newSiteOwner: NewSiteOwnerType.LinkedInAccount,
        alreadyLoggedInAtIdProvider: ps.alreadyLoggedIn,
      });
      newSiteResult = await browser.newSite.createNewSite(data);
    });

    it('Sign up as owner', async () => {
      await browser.newSite.signUpAsOwner(newSiteResult);
    });

    it('create forum', async () => {
      await browser.createSomething.createForum("Linkedin Forum Title");
    });
  }

});

