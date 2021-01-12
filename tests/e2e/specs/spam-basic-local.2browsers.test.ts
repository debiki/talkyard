/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

let everyone: TyAllE2eTestBrowsers;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let mallory: Member;
let mallorysBrowser: TyE2eTestBrowser;
let mons: Member;
let monsBrowser: TyE2eTestBrowser;
let guest: TestGuest;
let guestsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let forumTitle = "Basic Spam Test Forum";
let topicTitleOne = "Soo many links more than ten";
let topicTitleTwo = "Links links links";
let post2Selector = '#post-2';
let post3Selector = '#post-3';


describe("spam test, no external services  TyT530KRM1R", () => {

  it("initialize people", () => {
    everyone = new TyE2eTestBrowser(wdioBrowser);
    owen = make.memberOwenOwner();
    owensBrowser = new TyE2eTestBrowser(browserA);
    mons = make.memberModeratorMons();
    maria = make.memberMaria();
    mallory = make.memberMallory();
    guest = make.guestGunnar();
    // Reuse the same browser.
    monsBrowser = new TyE2eTestBrowser(browserB);
    mariasBrowser = monsBrowser;
    mallorysBrowser = monsBrowser;
    guestsBrowser = monsBrowser;
    strangersBrowser = monsBrowser;
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('basicspam', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;
    site.members.push(mons);
    site.members.push(maria);
    site.members.push(mallory);
    idAddress = server.importSiteData(site);
  });

  it("Owen and Mallory go to the homepage and log in", () => {
    everyone.go(idAddress.origin);
    owensBrowser.assertPageTitleMatches(forumTitle);
    mallorysBrowser.assertPageTitleMatches(forumTitle);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    owensBrowser.disableRateLimits();
    mallorysBrowser.complex.loginWithPasswordViaTopbar(mallory);
    mallorysBrowser.disableRateLimits();
  });

  // Use both http and https links.
  // 11 is max [TyT603RTDJ43].
  const tooManyLinks = `<3 links <3 <3 <3
        http://example.com/link-1
        http://example.com/link-2
        https://example.com/link-3
        https://example.com/link-4
        https://example.com/link-5
        https://example.com/link-6
        https://example.com/link-7
        https://example.com/link-8
        https://example.com/link-9
        https://example.com/link-10
        https://example.com/link-11
        https://example.com/link-12`;

  it("Mallory posts too many links, the server thinks it's spam and rejects the comment", () => {
    mallorysBrowser.forumButtons.clickCreateTopic();
    mallorysBrowser.editor.editTitle(topicTitleOne);
    mallorysBrowser.editor.editText(tooManyLinks);
    mallorysBrowser.editor.clickSave();
    mallorysBrowser.serverErrorDialog.waitAndAssertTextMatches(/links.*EdE4KFY2_/);
    mallorysBrowser.serverErrorDialog.close();
  });

  it("... but when wrapping in ``` it's ok — in a <pre>, links aren't real links", () => {
    const title = "Soo many links in ``` ticks";
    mallorysBrowser.editor.editText("```\n" + tooManyLinks + "\n```\n");
    mallorysBrowser.rememberCurrentUrl();
    mallorysBrowser.editor.save();
    mallorysBrowser.waitForNewUrl();
    mallorysBrowser.assertPageTitleMatches(topicTitleOne);
  });

  it("Mallory posts a topic with a few links only, that's OK too", () => {
    mallorysBrowser.go2('/');
    mallorysBrowser.forumButtons.clickCreateTopic();
    mallorysBrowser.editor.editTitle(topicTitleTwo);
    // (Use both http and https links.)
    mallorysBrowser.editor.editText(`Not many links :-(
        http://www.example.com/link-1
        https://www.example.com/link-2`);
    mallorysBrowser.rememberCurrentUrl();
    mallorysBrowser.editor.save();
    mallorysBrowser.waitForNewUrl();
    mallorysBrowser.assertPageTitleMatches(topicTitleTwo);
  });

  it("... then a *spam* comment", () => {
    mallorysBrowser.complex.replyToOrigPost('talkyard_spam' + '_test_1234');
  });

  it("... which will be visible, initially", () => {
    mallorysBrowser.waitForVisible(post2Selector);
  });

  it("... then he posts a *not* spam comment", () => {
    mallorysBrowser.complex.replyToOrigPost("Not spam. Ham.");
  });

  it("The spam comment gets hidden, eventually", () => {
    // [E2EBUG] failed x 2:
    //    "FAIL: Error: unexpected alert open: {Alert text : You were writing something?}"
    mallorysBrowser.topic.refreshUntilBodyHidden(2);
  });

  it("... but the not-spam comment is still visible", () => {
    // There's a race: for a short while, the server might return a cached page,
    // where this new post isn't yet included.
    mallorysBrowser.topic.refreshUntilPostPresentBodyNotHidden(3);
  });

  it("... and remains visible", () => {
    mallorysBrowser.pause(2000); // later: server.waitUntilSpamCheckQueueEmpty()
    assert(mallorysBrowser.isVisible('#post-3'));
  });

  it("Mallory logs out", () => {
    mallorysBrowser.topbar.clickLogout();
  });

  it("A stranger attempts to sign up with password + a spammer's email: fills in details,", () => {
    strangersBrowser.topbar.clickSignUp();
    strangersBrowser.loginDialog.fillInUsername("stranger");
    strangersBrowser.loginDialog.fillInEmail('talkyard_spam' + '_test_1234@ex.co');
    strangersBrowser.loginDialog.fillInPassword("public1234");
  });

  it("... clicks submit", () => {
    strangersBrowser.loginDialog.clickSubmit();
  });

  it("... accepts terms", () => {
    strangersBrowser.loginDialog.acceptTerms();
  });

  it("... but is rejected", () => {
    strangersBrowser.serverErrorDialog.waitForIsRegistrationSpamError();
  });

  it("... closes the error dialog", () => {
    strangersBrowser.serverErrorDialog.close();
    strangersBrowser.loginDialog.clickCancel();
  });

  it("The stranger sees Mallory's posts that weren't auto-hidden as spm", () => {
    // ...
  });

});

