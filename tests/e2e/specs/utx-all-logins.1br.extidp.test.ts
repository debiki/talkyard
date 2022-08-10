/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import { buildSite } from '../utils/site-builder';
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');
import utxImpl = require('./utx-impl');

let browser: TyE2eTestBrowser;

let forum;

let everyone;
let owen;
let owensBrowser: TyE2eTestBrowser;
let maria;
let mariasBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let forumTitle = "UTX All Logins Test Forum";

const gmailUsersSiteHostname = 'gmail-user.example.com';
const gmailUser = {
  email: settings.gmailEmail,
  password: settings.gmailPassword,
  username: 'gmailuser' };

const fbUsersSiteHostname = 'fb.something.example.com';
const fbUsersSiteInstrs = 'fbUsersSiteInstrs';
const fbUsersFeedbackOne = 'fbUsersFeedbackOne';
const fbUser = !settings.skipFacebook ? {
  email: settings.facebookUserEmail,
  password: settings.facebookUserPassword,
  username: 'fbuser'
} : {
  email: '0facebook@example.com',
  password: 'pub-0fa020',
  username: 'not_fb',
  fullName: 'Pwd Not Facebook',
};

const passwordUsersSiteHostname = 'pwd-user.example.com';
const passwordUsersSiteHostname2 = 'pwd-user-2.example.com';
const passwordUsersInstrs1 = 'passwordUsersInstrs1';
const passwordUsersInstrs2 = 'passwordUsersInstrs2';
const passwordUsersFeedbackToGmail = 'passwordUsersFeedbackToGmail';
const passwordUser = {
  email: 'pascal@paris.example.com',
  password: 'publ-pa020',
  username: 'pascal',
  fullName: '',
};


const queueCategoryId = 3;

describe("usability testing exchange, all logins:", () => {

  if (!settings.include3rdPartyDependentTests)
    return;

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({ title: forumTitle });
    builder.getSite().meta.featureFlags = 'ffIsUtx';

    builder.addPage({
      id: '_javascript',
      role: c.TestPageRole.Code,
      title: "Site Javascript",
      body: utxImpl.javascript,
      categoryId: 1,
      authorId: c.SystemUserId,
    });

    builder.addPage({
      id: 'homepage',
      folder: '/',
      showId: false,
      slug: 'homepage',
      role: c.TestPageRole.CustomHtmlPage,
      title: "Homepage",
      body: utxImpl.homepageHtml,
      categoryId: forum.categories.categoryA.id,
      authorId: c.SystemUserId,
    });

    builder.addPage({
      id: 'submitSite',
      folder: '/',
      showId: false,
      slug: 'submit-site',
      role: c.TestPageRole.WebPage,
      title: "Submit Site",
      body: utxImpl.submitSitePageHtml,
      categoryId: forum.categories.categoryA.id,
      authorId: c.SystemUserId,
    });

    builder.addPage({
      id: 'afterSubmittedOwnSite',
      folder: '/',
      showId: false,
      slug: 'after-submitted-own-site',
      role: c.TestPageRole.WebPage,
      title: "Thanks",
      body: utxImpl.afterSubmittedOwnSitePageHtml,
      categoryId: forum.categories.categoryA.id,
      authorId: c.SystemUserId,
    });

    builder.addPage({
      id: 'giveMeATask',
      folder: '/',
      showId: false,
      slug: 'give-me-a-task',
      role: c.TestPageRole.WebPage,
      title: "Task",
      body: utxImpl.giveMeATaskPageHtml,
      categoryId: forum.categories.categoryA.id,
      authorId: c.SystemUserId,
    });

    builder.addPage({
      id: 'nothingMoreToDo',
      folder: '/',
      showId: false,
      slug: 'nothing-more-to-do',
      role: c.TestPageRole.WebPage,
      title: "Nothing more to do",
      body: utxImpl.nothingMoreToDoPageHtml,
      categoryId: forum.categories.categoryA.id,
      authorId: c.SystemUserId,
    });

    forum.categories.categoryA = builder.addCategoryWithAboutPage(forum.forumPage, {
      id: queueCategoryId,
      parentCategoryId: forum.forumPage.categoryId,
      name: "The Queue",
      slug: 'queue',
      aboutPageText: "The Queue description.",
    });
    builder.addDefaultCatPerms(forum.siteData, queueCategoryId, 11);

    forum.siteData.settings.requireVerifiedEmail = false;
    forum.siteData.settings.mayComposeBeforeSignup = true;
    forum.siteData.settings.mayPostBeforeEmailVerified = true;
    idAddress = server.importSiteData(forum.siteData);
  });


  it("initialize people", () => {
    browser = new TyE2eTestBrowser(wdioBrowser);
    everyone = browser;
    owen = forum.members.owen;
    owensBrowser = browser;

    maria = forum.members.maria;
    mariasBrowser = browser;
  });


  describe("signup and submit, with Gmail", () => {
    it("types address and submit", () => {
      utxImpl.goToHomepage(browser, idAddress);
      utxImpl.typeAddressSubmit(browser, gmailUsersSiteHostname);
    });

    it("fills in instructions, click submit", () => {
      utxImpl.typeInstructionsSubmit(browser);
    });

    it("signs up with Gmail", () => {
      browser.disableRateLimits();
      browser.loginDialog.createGmailAccount(
          gmailUser, { anyWelcomeDialog: 'THERE_WILL_BE_NO_WELCOME_DIALOG' });
      browser.disableRateLimits();
    });

    it("sees thanks page, continues", () => {
      utxImpl.checkIsThanksPageContinue(browser);
    });

    it("picks a task", () => {
      utxImpl.pickATask(browser);
    });

    it("there's nothing to test", () => {
      utxImpl.checkIsNoMoreTasksPage(browser);
    });

    it("goes to test queue", () => {
      utxImpl.goToQueue(browser, idAddress);
    });

    it("sees own topic", () => {
      browser.forumTopicList.waitForTopicVisible(gmailUsersSiteHostname);
    });

    it("... goes to own topic", () => {
      browser.forumTopicList.goToTopic(gmailUsersSiteHostname);
    });

    it("it's the right topic — the correct source text", () => {
      const source = browser.getSource();
      assert(source.indexOf('4GKR02QX') >= 0);
    });

    it("logs out", () => {
      browser.topbar.clickLogout();
    });
  });


  describe("signup and submit, with Facebook", () => {
    it("type address and submit", () => {
      utxImpl.goToHomepage(browser, idAddress);
      utxImpl.typeAddressSubmit(browser, '');
    });

    it("fill in instructions, click submit", () => {
      utxImpl.typeInstructionsSubmit(browser, fbUsersSiteHostname, fbUsersSiteInstrs);
    });

    if (settings.skipFacebook) {  //---------------------------------------------
      console.log("Skipping Facebook login tests.");
      it("login with password", () => {
        browser.loginDialog.createPasswordAccount(fbUser, undefined,
            'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG');
        browser.disableRateLimits();
      });
    }
    else {  //-------------------------------------------------------------------
    it("login with Facebook", () => {
      browser.loginDialog.createFacebookAccount(fbUser, { mustVerifyEmail: false });
      browser.disableRateLimits();
    });
    } // ------------------------------------------------------------------------

    it("sees thanks page", () => {
      utxImpl.checkIsThanksPageContinue(browser);
    });

    it("be asked to test the Gmail user's website", () => {
      utxImpl.pickATask(browser);
      browser.pageTitle.waitForVisible();
      browser.pageTitle.assertMatches(gmailUsersSiteHostname);
      const source = browser.getSource();
      assert(source.indexOf('4GKR02QX') >= 0);
    });

    it("post feedback", () => {
      browser.complex.replyToOrigPost(fbUsersFeedbackOne);
      utxImpl.continueWithNextTaskAfterHavingSubmittedFeedback(browser);
    });

    it("wants a new task", () => {
      utxImpl.pickATask(browser);
    });

    it("there's nothing to test", () => {
      utxImpl.checkIsNoMoreTasksPage(browser);
    });

    it("goes to submit page and logs out", () => {
      // Need logout on the homepage, otherwise won't detect via topbar that logged out ok.
      utxImpl.goToQueue(browser, idAddress);
      browser.topbar.clickLogout();
    });
  });


  describe("signup and submit, with password", () => {

    it("type address and submit", () => {
      utxImpl.goToSubmitPage(browser, idAddress);
    });

    it("fill in instructions, click submit", () => {
      utxImpl.typeInstructionsSubmit(browser, passwordUsersSiteHostname, passwordUsersInstrs1);
    });

    it("login with password", () => {
      browser.loginDialog.createPasswordAccount(passwordUser, undefined,
          'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG');
      browser.disableRateLimits();
    });

    it("sees thanks page", () => {
      utxImpl.checkIsThanksPageContinue(browser);
    });

    it("be asked to test the Facebook's user's website", () => {
      utxImpl.pickATask(browser);
      browser.pageTitle.waitForVisible();
      browser.pageTitle.assertMatches(fbUsersSiteHostname);
      const source = browser.getSource();
      assert(source.indexOf(fbUsersSiteInstrs) >= 0);
    });

    it("skip this task", () => {
      utxImpl.skipTask(browser);
    });

    it("picks a new task", () => {
      utxImpl.pickATask(browser);
    });

    it("submits feedback to the Gmail user", () => {
      browser.complex.replyToOrigPost(passwordUsersFeedbackToGmail);
      utxImpl.continueWithNextTaskAfterHavingSubmittedFeedback(browser);
    });

    it("picks a task again", () => {
      utxImpl.pickATask(browser);
    });

    it("there's nothing to test", () => {
      utxImpl.checkIsNoMoreTasksPage(browser);
    });

    it("restarts", () => {
      browser.waitAndClick('.e_utxRestart');
    });

    it("picks a task, really", () => {
      utxImpl.pickATask(browser);
    });

    it("be asked to test the Facebook's user's website", () => {
      browser.pageTitle.waitForVisible();
      browser.pageTitle.assertMatches(fbUsersSiteHostname);
      const source = browser.getSource();
      assert(source.indexOf(fbUsersSiteInstrs) >= 0);
    });
  });


  describe("submit when logged in already", () => {
    it("go to submit page", () => {
      utxImpl.goToSubmitPage(browser, idAddress);
    });

    it("fill in instructions, click submit", () => {
      utxImpl.typeInstructionsSubmit(browser, passwordUsersSiteHostname2, passwordUsersInstrs2);
    });

    it("sees thanks page", () => {
      utxImpl.checkIsThanksPageContinue(browser);
    });

    it("goes to queue", () => {
      utxImpl.goToQueue(browser, idAddress);
    });

    it("sees topic", () => {
      browser.forumTopicList.waitForTopicVisible(passwordUsersSiteHostname2);
    });
  });


  /* Move to other test suite?
  describe("login to help someone, with password", () => {
  });  */

});

