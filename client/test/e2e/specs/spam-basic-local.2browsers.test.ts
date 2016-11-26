/// <reference path="../test-types.ts"/>
/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import * as _ from 'lodash';
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import assert = require('assert');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;
declare let browserA: any;
declare let browserB: any;

let everyone;
let owen;
let owensBrowser;
let maria;
let mariasBrowser;
let mallory;
let mallorysBrowser;
let mons;
let monsBrowser;
let guest;
let guestsBrowser;

let idAddress: IdAddress;
let forumTitle = "Basic Spam Test Forum";
let topicTitle = "Links links links";
let post2Selector = '#post-2';
let post3Selector = '#post-3';


describe("spam test, no external services:", () => {

  it("initialize people", () => {
    browser.perhapsDebugBefore();
    everyone = _.assign(browser, pagesFor(browser));
    owen = make.memberOwenOwner();
    owensBrowser = _.assign(browserA, pagesFor(browserA));
    mons = make.memberModeratorMons();
    maria = make.memberMaria();
    mallory = make.memberMallory();
    guest = make.guestGunnar();
    // Reuse the same browser.
    monsBrowser = _.assign(browserB, pagesFor(browserB));
    mariasBrowser = monsBrowser;
    mallorysBrowser = monsBrowser;
    guestsBrowser = monsBrowser;
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('basicspam', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.members.push(mons);
    site.members.push(maria);
    site.members.push(mallory);
    idAddress = server.importSiteData(site);
  });

  it("Owen and Mallory go to the homepage and log in", () => {
    everyone.go(idAddress.siteIdOrigin);
    everyone.assertPageTitleMatches(forumTitle);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    owensBrowser.disableRateLimits();
    mallorysBrowser.complex.loginWithPasswordViaTopbar(mallory);
    mallorysBrowser.disableRateLimits();
  });

  it("Mallory posts too many links, the server thinks it's spam and rejects the comment", () => {
    mallorysBrowser.forumButtons.clickCreateTopic();
    mallorysBrowser.editor.editTitle(topicTitle);
    mallorysBrowser.editor.editText(`<3 links <3 <3 <3
        http://www.example.com/link-1
        http://www.example.com/link-2
        http://www.example.com/link-3
        http://www.example.com/link-4
        http://www.example.com/link-5
        http://www.example.com/link-6
        http://www.example.com/link-7
        http://www.example.com/link-8
        http://www.example.com/link-9
        http://www.example.com/link-10`);
    mallorysBrowser.editor.save();
    mallorysBrowser.waitAndAssertVisibleTextMatches(
        '.modal-dialog.dw-server-error', /links.*EdE4KFY2_/);
    mallorysBrowser.click('.e_ServerErrorD_CloseB');
  });

  it("Mallory posts a topic with a few links only, that's OK", () => {
    mallorysBrowser.editor.editText(`Not many links :-(
        http://www.example.com/link-1
        http://www.example.com/link-2`);
    mallorysBrowser.rememberCurrentUrl();
    mallorysBrowser.editor.save();
    mallorysBrowser.waitForNewUrl();
    mallorysBrowser.assertPageTitleMatches(topicTitle);
  });

  it("... then a *spam* comment", () => {
    mallorysBrowser.complex.replyToOrigPost('__ed_spam' + '_test_123__');
  });

  it("... which will be visible, initially", () => {
    assert(mallorysBrowser.isVisible(post2Selector));
  });

  it("... then he posts a *not* spam comment", () => {
    mallorysBrowser.complex.replyToOrigPost("Not spam. Ham.");
  });

  it("The spam comment gets hidden, eventually", () => {
    mallorysBrowser.refreshUntilGone(post2Selector);
  });

  it("... but the not-spam comment is still visible", () => {
    assert(mallorysBrowser.isVisible(post3Selector));
  });

  it("... and remains visible", () => {
    mallorysBrowser.pause(2000); // later: server.waitUntilSpamCheckQueueEmpty()
    assert(mallorysBrowser.isVisible('#post-3'));
  });

  it("Done", () => {
    everyone.perhapsDebug();
  });

});

