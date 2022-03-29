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


describe('create-site-facebook  @createsite @login @facebook  TyT8KA9AW3', () => {

  if (!settings.include3rdPartyDependentTests) {
    console.log("Skipping this spec; no 3rd party login credentials specified.");
    return;
  }

  if (settings.skipFacebook) {
    console.log("Skipping Facebook login tests.");
    return;
  }

  it('initialize', () => {
    browser = new TyE2eTestBrowser(wdioBrowser);
  });


  addCreateSiteWithFacebookTestSteps({ alreadyLoggedIn: false });

  it('Can actually use the FB admin account to create stuff', () => {
    browser.complex.createAndSaveTopic({ title: "Facebook topic title", body: "Body" });
  });

  it('Logout from Talkyard after', () => {
    // This logs out from the Talkyard site only, to clear Ty cookies,
    // so won't affect other tests.
    browser.topbar.clickLogout(); // (6HRWJ3)
  });


  // Now we're logged in over at Facebook already, so the Facebook login flow
  // can be slightly different.
  addCreateSiteWithFacebookTestSteps({ alreadyLoggedIn: true });

  it('Logout after', () => {
    browser.topbar.clickLogout(); // (6HRWJ3)
  });


  function addCreateSiteWithFacebookTestSteps(ps: { alreadyLoggedIn: boolean }) {
    const maybe = ps.alreadyLoggedIn ? "already" : "not";
    let newSiteResult: NewSiteResult;

    it(`can create site as Facebook user, when ${maybe} logged in to Facebook`, () => {
      const data = createTestData({
        newSiteOwner: NewSiteOwnerType.FacebookAccount,
        alreadyLoggedInAtIdProvider: ps.alreadyLoggedIn,
      });
      console.log("Create new site:");
      newSiteResult = browser.newSite.createNewSite(data);
    });

    it('Sign up as owner', () => {
      browser.newSite.signUpAsOwner(newSiteResult);
    });

    it('Create forum', () => {
      browser.createSomething.createForum("Facebook Forum Title");
    });
  }

});

