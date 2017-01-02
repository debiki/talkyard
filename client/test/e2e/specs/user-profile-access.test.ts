/// <reference path="../test-types.ts"/>
/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import * as _ from 'lodash';
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import buildSite = require('../utils/site-builder');
import assert = require('assert');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;

let forum;

let everyone;
let owen;
let owensBrowser;
let mons;
let monsBrowser;
let modya;
let modyasBrowser;
let maria;
let mariasBrowser;
let michael;
let michaelsBrowser;
let mallory;
let mallorysBrowser;
let guest;
let guestsBrowser;

let idAddress: IdAddress;
let forumTitle = "User Profile Access Test Forum";

let mariasPublicReplyToMichael = "Maria's public reply to Michael";
let mariasPrivateMessageTitle = "Maria's private message to Michael";
let mariasPrivateMessageBody = "Maria's private message to Michael";
let michaelPublicReplyToMarias = "Michael's public reply to Maria";
let michaelPrivateMessageReply = "Michael's private message reply";

describe("user profile access:", () => {

  it("import a site", () => {
    browser.perhapsDebugBefore();
    forum = buildSite().addLargeForum({ title: forumTitle });
    idAddress = server.importSiteData(forum.siteData);
  });

  it("initialize people", () => {
    browser = _.assign(browser, pagesFor(browser));
    everyone = browser;
    owen = forum.members.owen;
    owensBrowser = browser;

    mons = forum.members.mons;
    monsBrowser = browser;
    modya = forum.members.modya;
    modyasBrowser = browser;
    maria = forum.members.maria;
    mariasBrowser = browser;
    michael = forum.members.michael;
    michaelsBrowser = browser;
    mallory = forum.members.mallory;
    mallorysBrowser = browser;
    guest = forum.guests.gunnar;
    guestsBrowser = browser;
  });


  // ----- Maria posts stuff

  it("Member Maria logs in", () => {
    mariasBrowser.go(idAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... and replies to Michael", () => {
    mariasBrowser.complex.replyToOrigPost(mariasPublicReplyToMichael);
  });

  it("... and sends him a private message", () => {
    mariasBrowser.complex.sendMessageToPageAuthor(
        mariasPrivateMessageTitle, mariasPrivateMessageBody);
  });


  // ----- Michael replies

  it("Michael logs in", () => {
    mariasBrowser.topbar.clickLogout({ waitForLoginButton: false });
    michaelsBrowser.assertNotFoundError();
    michaelsBrowser.go('/' + forum.topics.byMichaelCategoryA.slug);
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
  });

  it("... and replies to Maria's public reply", () => {
    michaelsBrowser.complex.replyToPostNr(2, michaelPublicReplyToMarias)
  });

  it("... and clicks a notification about Maria's private message", () => {
    michaelsBrowser.topbar.openNotfToMe();
  });

  it("... and replies to it", () => {
    michaelsBrowser.complex.replyToOrigPost(michaelPrivateMessageReply);
  });


  // ----- Members see only public activity

  it("Michael opens Maria's profile page", () => {
    michaelsBrowser.complex.openPageAuthorProfilePage();
  });

  it("... he sees Maria's pages and the reply to him, in Maria's activity list", () => {
  });

  it("... but he doesn't see the private message", () => {
  });

  it("... and he doesn't see the Notifications tab", () => {
  });


  // ----- Strangers also see only public activity


  // ----- Moderators see more activity

  it("Moderator Modya logs in", () => {
  });

  it("... Modya sees Maria's pages and public reply", () => {
  });

  it("... but not the private message", () => {
  });

  it("... and not the Notifications tab", () => {
  });


  // ----- Admins see everything

  it("Admin Alice logs in", () => {
  });

  it("... she sees all Marias activity, incl the private message", () => {
  });

  it("... and the Notifications tab, incl all notifiations", () => {
  });


  it("Done", () => {
    everyone.perhapsDebug();
  });

});

