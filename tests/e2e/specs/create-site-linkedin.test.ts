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

describe('create-site-linkedin  @createsite @login @linkedin  TyT8KA9AW3', () => {

  if (!settings.include3rdPartyDependentTests) {
    console.log("Skipping this spec; no 3rd party login credentials specified.");
    return;
  }

  it('initialize', () => {
    browser = _.assign(browser, pagesFor(browser));
  });

  it('can create a new site as a LinkedIn user, when not logged in to LinkedIn', () => {
    makeForumWithLinkedInAdminAccount();
  });

  it('can actually use the LinkedIn admin account to create stuff', () => {
    pages.complex.createAndSaveTopic({ title: "LinkedIn topic title", body: "Body" });
    pages.topbar.clickLogout(); // (6HRWJ3)
  });

  it('can create a new site as LinkedIn user, when already logged in to LinkedIn', () => {
    // Now we're logged in already, so the LinkedIn login flow is / might-be slightly different.
    makeForumWithLinkedInAdminAccount();
    pages.topbar.clickLogout(); // (6HRWJ3)
  });

  function makeForumWithLinkedInAdminAccount() {
    const data = createTestData();
    data.email = settings.linkedinEmail;
    data.password = settings.linkedinPassword;
    browser.go(utils.makeCreateSiteWithFakeIpUrl());
    browser.disableRateLimits(); // there're signup rate limits
    pages.createSite.fillInFieldsAndSubmit(data);
    pages.createSite.clickOwnerSignupButton();
    pages.loginDialog.createLinkedInAccount(data, true);
    pages.createSomething.createForum("Linkedin Forum Title");
  }

});

