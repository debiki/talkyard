/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import { buildSite } from '../utils/site-builder';
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');
import utxImpl = require('./utx-impl');

declare let browser: any;

let forum;

let everyone;
let owen;
let owensBrowser;
let maria;
let mariasBrowser;

let idAddress: IdAddress;
let forumTitle = "UTX All Logins Test Forum";

const gmailUsersSiteHostname = 'gmail-user.ex.co';
const gmailUser = {
  email: settings.gmailEmail,
  password: settings.gmailPassword,
  username: 'gmailuser' };

const fbUsersSiteHostname = 'fb-user.ex.co';
const fbUsersSiteInstrs = 'fbUsersSiteInstrs';
const fbUsersFeedbackOne = 'fbUsersFeedbackOne';
const fbUser = {
  email: settings.facebookUserEmail,
  password: settings.facebookUserPassword,
  username: 'fbuser'
};

const passwordUsersSiteHostname = 'pwd-user.ex.co';
const passwordUsersSiteHostname2 = 'pwd-user-2.ex.co';
const passwordUsersInstrs1 = 'passwordUsersInstrs1';
const passwordUsersInstrs2 = 'passwordUsersInstrs2';
const passwordUsersFeedbackToGmail = 'passwordUsersFeedbackToGmail';
const passwordUser = {
  email: 'pascal@paris.fr',
  password: 'publicPascal123',
  username: 'pascal',
  fullName: '',
};


const queueCategoryId = 3;

describe("usability testing exchange, all logins:", () => {

  it("import a site", () => {
    browser.perhapsDebugBefore();
    const builder = buildSite();
    forum = builder.addEmptyForum({ title: forumTitle });

    builder.addPage({
      id: '_javascript',
      folder: '/',
      showId: true,
      slug: '',
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
    browser = _.assign(browser, pagesFor(browser));
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
      browser.loginDialog.createGmailAccount(gmailUser, undefined, 'THERE_WILL_BE_NO_WELCOME_DIALOG');
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

    it("sees own topic in test queue", () => {
      utxImpl.goToQueue(browser, idAddress);
      browser.forumTopicList.waitForTopics();
      browser.forumTopicList.assertTopicVisible(gmailUsersSiteHostname);
      browser.forumTopicList.goToTopic(gmailUsersSiteHostname);
    });

    it("opens it, looks ok", () => {
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

    it("login with Facebook", () => {
      browser.loginDialog.createFacebookAccount(fbUser, undefined, 'THERE_WILL_BE_NO_WELCOME_DIALOG');
      browser.disableRateLimits();
    });

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
      browser.forumTopicList.waitForTopics();
      browser.forumTopicList.assertTopicVisible(passwordUsersSiteHostname2);
    });
  });


  /* Move to other test suite?
  describe("login to help someone, with password", () => {
  });  */

});

