/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import make = require('../utils/make');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import { buildSite } from '../utils/site-builder';
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;
declare var browserA: any;
declare var browserB: any;

let forum: LargeTestForum;

let everyonesBrowser;
let owen;
let owensBrowser;
let maria;
let mariasBrowser;
let michael;
let michaelsBrowser;
let mallory;
let mallorysBrowser;

let idAddress: IdAddress;
let siteId;
let forumTitle = "Change Email Test Forum";

let mariasAddress2 = "e2e-test--maria2@example.com";

const michalesFirstReply = 'michalesFirstReply';
const michalesSecondReply = 'michalesSecondReply';

const mariasTopicATitle = 'mariasTopicATitle';
const mariasTopicABody = 'mariasTopicABody';


describe("user profile change email:", () => {

  it("import a site, init people", () => {
    browser.perhapsDebugBefore();

    everyonesBrowser = _.assign(browser, pagesFor(browser));
    mariasBrowser = _.assign(browserA, pagesFor(browserA));
    michaelsBrowser = _.assign(browserB, pagesFor(browserB));
    mallorysBrowser = michaelsBrowser;
    owensBrowser = michaelsBrowser;

    forum = buildSite().addLargeForum({ title: forumTitle });
    owen = forum.members.owen;
    maria = forum.members.maria;
    michael = forum.members.michael;
    mallory = forum.members.mallory;

    idAddress = server.importSiteData(forum.siteData);
    siteId = idAddress.id;
  });

  it("Michael replies to one of Maria's topics", () => {
    michaelsBrowser.go(idAddress.origin + '/' + forum.topics.byMariaCategoryA.slug);
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    michaelsBrowser.complex.replyToOrigPost(michalesFirstReply);
  });

  it("Maria gets a reply notf email", () => {
    server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress,
        [forum.topics.byMariaCategoryA.title, michalesFirstReply], browser);
  });

  it("Mallory logs in", () => {
    michaelsBrowser.topbar.clickLogout();
    mallorysBrowser.complex.loginWithPasswordViaTopbar(mallory);
  });

  it("... he goes to his email addresses page", () => {
    mallorysBrowser.topbar.clickGoToProfile();
    mallorysBrowser.userProfilePage.clickGoToPreferences();
    mallorysBrowser.userProfilePage.preferences.switchToEmailsLogins();
  });

  it("... and adds Maria's email address", () => {
    mallorysBrowser.userProfilePage.preferences.emailsLogins.addEmailAddress(maria.emailAddress);
  });

  it("... Maria gets an address verification email, but doesn't click the link", () => {
    server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, [
            "To finish adding", // [B4FR20L_]
            maria.emailAddress], browser);
  });

  // UX What happens if she *does* click the link? Currently a unique key error dialog gets shown,
  // and the attempt to verify it and set it as primary fails (because already primary).

  it("... so Mallory cannot set Maria's address as his primary", () => {
    mallorysBrowser.refresh();
    assert(!mallorysBrowser.userProfilePage.preferences.emailsLogins.canMakeOtherEmailPrimary());
  });

  it("Mallory removes Maria's address", () => {
    mallorysBrowser.userProfilePage.preferences.emailsLogins.removeOneEmailAddress();
  });


  it("Maria logs in", () => {
    mariasBrowser.go(idAddress.origin + '/');
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... goes to her profile page", () => {
    mariasBrowser.topbar.clickGoToProfile();
    mariasBrowser.userProfilePage.clickGoToPreferences();
    mariasBrowser.userProfilePage.preferences.switchToEmailsLogins();
  });

  it("... and adds a 2nd address", () => {
    mariasBrowser.userProfilePage.preferences.emailsLogins.addEmailAddress(mariasAddress2);
  });

  let mariasEmailVerifLink;

  it("Maria gets an address verification email, she remembers the link", () => {
    mariasEmailVerifLink = server.waitAndGetVerifyAnotherEmailAddressLinkEmailedTo(
        siteId, mariasAddress2, browser);
  });

  it("Mallory adds the same address", () => {
    mallorysBrowser.userProfilePage.preferences.emailsLogins.addEmailAddress(mariasAddress2);
  });

  it("Maria cannot set the new email as her primary, because not verified", () => {
    mariasBrowser.refresh();
    assert(!mariasBrowser.userProfilePage.preferences.emailsLogins.canMakeOtherEmailPrimary());
  });

  it("Mallory also cannot", () => {
    mallorysBrowser.refresh();
    assert(!mallorysBrowser.userProfilePage.preferences.emailsLogins.canMakeOtherEmailPrimary());
  });

  it("Maria clicks the email verif link", () => {
    mariasBrowser.go(mariasEmailVerifLink);
  });

  it("... now she can set the new address as her primary", () => {
    assert(mariasBrowser.userProfilePage.preferences.emailsLogins.canMakeOtherEmailPrimary());
  });

  it("Mallory still cannot set the email to his primary", () => {
    mallorysBrowser.refresh();
    assert(!mallorysBrowser.userProfilePage.preferences.emailsLogins.canMakeOtherEmailPrimary());
  });

  it("Maria sets the new email as her primary", () => {
    mariasBrowser.userProfilePage.preferences.emailsLogins.makeOtherEmailPrimary();
  });

  it("Mallory goes back to Maria's topic, then leaves", () => {
    mallorysBrowser.go(idAddress.origin + '/' + forum.topics.byMariaCategoryA.slug);
    mallorysBrowser.topbar.clickLogout();
  });

  it("Michael posts another reply to Maria", () => {
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    michaelsBrowser.complex.replyToOrigPost(michalesSecondReply);
  });

  it("The notification gets sent to Maria's new address", () => {
    server.waitUntilLastEmailMatches(
        siteId, mariasAddress2, [
            forum.topics.byMariaCategoryA.title, michalesSecondReply], browser);
  });

  it("... not to her old address", () => {
    const email = server.getLastEmailSenTo(siteId, maria.emailAddress, browser);
    assert(email.bodyHtmlText.search("To finish adding") > 0); // [B4FR20L_]
    assert(email.bodyHtmlText.search(michalesSecondReply) === -1);
  });

  let mariasEmailsUrl;

  it("Maria logs out", () => {
    mariasEmailsUrl = mariasBrowser.url().value;
    mariasBrowser.go(idAddress.origin);
    mariasBrowser.topbar.clickLogout();
  });

  it("She attempts to login via the old address", () => {
    mariasBrowser.topbar.clickLogin();
    mariasBrowser.loginDialog.loginWithEmailAndPassword(maria.emailAddress, maria.password, 'BAD_LOGIN');
  });

  it("but doesn't work", () => {
    mariasBrowser.loginDialog.waitForBadLoginMessage();
  });

  it("Instead she can login via the new address", () => {
    mariasBrowser.loginDialog.loginWithEmailAndPassword(mariasAddress2, maria.password);
  });

  it("She removes her old address", () => {
    mariasBrowser.go(mariasEmailsUrl);
    mariasBrowser.userProfilePage.preferences.emailsLogins.removeOneEmailAddress();
  });

  it("But she cannot delete the only remaining address", () => {
    assert(!mariasBrowser.userProfilePage.preferences.emailsLogins.canRemoveEmailAddress());
    // Test after refresh too.
    mariasBrowser.refresh();
    assert(!mariasBrowser.userProfilePage.preferences.emailsLogins.canRemoveEmailAddress());
  });

  it("... it's her new address", () => {
    const address = mariasBrowser.userProfilePage.preferences.emailsLogins.getEmailAddress();
    assert(address === mariasAddress2);
  });

  it("... and it's listed as her login method", () => {
    const text = mariasBrowser.getText('.s_UP_EmLg_LgL');
    assert(text.search("Password") >= 0);
    assert(text.search(mariasAddress2) > 0);
  });

});

