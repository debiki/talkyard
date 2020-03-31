/// <reference path="../test-types.ts"/>

import _ = require('lodash');
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import createTestData = require('./create-site-impl');
const logUnusual = logAndDie.logUnusual, die = logAndDie.die, dieIf = logAndDie.dieIf;
const logMessage = logAndDie.logMessage;

declare let browser: any;

describe('create-site-linkedin  @createsite @login @linkedin  TyT8KA9AW3', () => {

  if (!settings.include3rdPartyDependentTests) {
    console.log("Skipping this spec; no 3rd party login credentials specified.");
    return;
  }

  it('initialize', () => {
    browser = _.assign(browser, pagesFor(browser));
  });

  it('can create a new site as a LinkedIn user, when not logged in to LinkedIn', () => {
    makeForumWithLinkedInAdminAccount({ alreadyLoggedIn: false });
  });

  it('can actually use the LinkedIn admin account to create stuff', () => {
    browser.complex.createAndSaveTopic({ title: "LinkedIn topic title", body: "Body" });
    browser.topbar.clickLogout(); // (6HRWJ3)
  });

  it('can create a new site as LinkedIn user, when already logged in to LinkedIn', () => {
    // Now we're logged in already, so the LinkedIn login flow is / might-be slightly different.
    makeForumWithLinkedInAdminAccount({ alreadyLoggedIn: true });
    browser.topbar.clickLogout(); // (6HRWJ3)
  });

  function makeForumWithLinkedInAdminAccount(ps: { alreadyLoggedIn: boolean }) {
    const data = createTestData({
      newSiteOwner: NewSiteOwnerType.LinkedInAccount,
      alreadyLoggedInAtIdProvider: ps.alreadyLoggedIn,
    });
    console.log("Create new site:");
    browser.createNewSite(data);
    console.log("Create forum:");
    browser.createSomething.createForum("Linkedin Forum Title");
  }

});

