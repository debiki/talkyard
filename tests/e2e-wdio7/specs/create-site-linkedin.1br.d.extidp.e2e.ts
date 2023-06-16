/// <reference path="../test-types.ts"/>

import _ = require('lodash');
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import createTestData = require('./create-site-impl');
const logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
const logMessage = logAndDie.logMessage;

let browser: TyE2eTestBrowser;

describe('create-site-linkedin  @createsite @login @linkedin  TyT402KDTT5Z', () => {

  if (!settings.include3rdPartyDependentTests) {
    console.log("Skipping this spec; no 3rd party login credentials specified.");
    return;
  }

  if (settings.secure) {
    die("LinkedIn authn e2e test creds currently use http [TyE8020756PM3]");
  }

  it('initialize', () => {
    browser = new TyE2eTestBrowser(wdioBrowser);
  });

  addCreateSiteWithLinkedInTestSteps({ alreadyLoggedIn: false });

  it('can actually use the LinkedIn admin account to create stuff', () => {
    browser.complex.createAndSaveTopic({ title: "LinkedIn topic title", body: "Body" });
    browser.topbar.clickLogout(); // (6HRWJ3)
  });

  // Now we're logged in already, so the LinkedIn login flow can be slightly different.
  addCreateSiteWithLinkedInTestSteps({ alreadyLoggedIn: true });

  it('Log out from Talkyard', () => {
    browser.topbar.clickLogout(); // (6HRWJ3)
  });


  function addCreateSiteWithLinkedInTestSteps(ps: { alreadyLoggedIn: boolean }) {
    const maybe = ps.alreadyLoggedIn ? "already" : "not";
    let newSiteResult: NewSiteResult;

    it(`can create site as LinkedIn user, when ${maybe} logged in to LinkedIn`, () => {
      const data = createTestData({
        newSiteOwner: NewSiteOwnerType.LinkedInAccount,
        alreadyLoggedInAtIdProvider: ps.alreadyLoggedIn,
      });
      newSiteResult = browser.newSite.createNewSite(data);
    });

    it('Sign up as owner', () => {
      browser.newSite.signUpAsOwner(newSiteResult);
    });

    it('create forum', () => {
      browser.createSomething.createForum("Linkedin Forum Title");
    });
  }

});

