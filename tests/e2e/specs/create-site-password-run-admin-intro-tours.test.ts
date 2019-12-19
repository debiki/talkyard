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

describe('create-site-password  @createsite @login @password  TyT7BAWFPK9', () => {

  it('initialize', () => {
    browser = _.assign(browser, pagesFor(browser));
  });

  it('can create a new site as a Password user', () => {
    // Something timed out in here, twice. [E2EBUG]
    // Break up into smaller steps then? To find out what.
    const data = createTestData();
    browser.go(utils.makeCreateSiteWithFakeIpUrl());
    browser.disableRateLimits();
    pages.createSite.fillInFieldsAndSubmit(data);
    // New site; disable rate limits here too.
    browser.disableRateLimits();
    pages.createSite.clickOwnerSignupButton();
    pages.loginDialog.createPasswordAccount(data, true);
    const siteId = pages.getSiteId();
    const email = server.getLastEmailSenTo(siteId, data.email, browser);
    const link = utils.findFirstLinkToUrlIn(
        data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    browser.go(link);
    browser.waitAndClick('#e2eContinue');

    browser.tour.runToursAlthoughE2eTest();

    pages.createSomething.createForum("Password Forum Title");
  });

  it("the forum admin tour works", () => {
    browser.tour.assertTourStarts(true);
    console.log('Step 1');
    browser.waitAndClick('.s_Tour-Step-1 .s_Tour_D_Bs_NextB');
    console.log('Step 2');
    browser.waitAndClick('.s_Tour-Step-2 .s_Tour_D_Bs_NextB');
    console.log('Step 3');
    browser.waitAndClick('.s_Tour-Step-3 .s_Tour_D_Bs_NextB');
    console.log('Step 4');
    browser.waitAndClick('#e_ViewCatsB');
    console.log('Step 5');
    browser.waitAndClick('.s_Tour-Step-5 .s_Tour_D_Bs_NextB');
    console.log('Step 6');
    browser.waitAndClick('.esAvtrName_name');
    console.log('Step 7');
    browser.waitAndClick('.s_Tour-Step-7 .s_Tour_D_Bs_NextB');
  });

  it("Closes the my-menu dropdown, goes to the topic list again", () => {
    browser.clickBackdrop();
    browser.forumButtons.viewTopics();
  });

  it("The tour won't restart", () => {
    browser.tour.assertTourStarts(false);
  });

  it("Owen goes to the admin area", () => {
    browser.topbar.clickGoToAdmin();
  });

  it("the admin area admin tour works", () => {
    console.log('Step 1');
    browser.waitAndClick('.s_Tour-Step-1 .s_Tour_D_Bs_NextB');
    console.log('Step 2');
    browser.waitAndClick('#e2eAA_Ss_LoginL');
    console.log('Step 3');
    browser.waitAndClick('.s_Tour-Step-3 .s_Tour_D_Bs_NextB');
    console.log('Step 4');
    browser.waitAndClick('.e_UsrsB');
    console.log('Step 5');
    browser.waitAndClick('.e_InvitedUsB');
    console.log('Step 6');
    browser.waitAndClick('.s_Tour-Step-6 .s_Tour_D_Bs_NextB');
    console.log('Step 7');
    browser.waitAndClick('.s_Tour-Step-7 .s_Tour_D_Bs_NextB');
  });

  // Done with create site stuff. But let's test a little bit more, so we know the forum can
  // actually be used, once it's been created: Edit forum title and post a topic.

  it("goes back to the topic list", () => {
    browser.go('/');
  });

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
    browser.editor.clickSave();
    browser.waitForNewUrl();
    browser.assertTextMatches('h1', /New tpc ttl/);
    browser.assertTextMatches('#post-1', /New tpc txt/);
  });


  it("the forum intro tour is shown just once", () => {
    browser.go('/');
    browser.tour.assertTourStarts(false);
  });

  it("... and the admin area tour, just once, it too", () => {
    browser.topbar.clickGoToAdmin();
    browser.tour.assertTourStarts(false);
  });

});

