/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;
declare let browserA: any;
declare let browserB: any;

let everyone;
let owen;
let maria;
let guest; // should rename to guestsBrowser
let guestsBrowser;

let idAddress: IdAddress;
let forumTitle = "Unsubscription Forum";

let topicTitle = "Unsub Topic Title";
let topicBody = "Unsub topic text.";
let topicUrl;

let owensReplyText = "Owen's reply text.";
let owensReplyText2 = "Owen's reply 2.";
let owensReplyText3 = "Owen's reply 3.";
let owensLastUnsubLink: string;

let guestName = "Gestelina";
let guestEmail = "e2e-test--guestella@example.com";
let guestReplyText = "Guest's reply text.";
let guestReplyText2 = "Guest's reply 2: gröt_med_gurka.";
let guestReplyTextAfterUnsub = "Guest's reply, after unsub.";
let guestsUnsubscribeLink: string;

let mariasReplyText = "Maria's reply.";


describe("unsubscribe", () => {

  it("initialize people", () => {
    everyone = _.assign(browser, pagesFor(browser));
    owen = _.assign(browserA, pagesFor(browserA), make.memberOwenOwner());
    maria = _.assign(browserB, pagesFor(browserB), make.memberMaria());
    // Reuse the same browser.
    guest = maria;
    guestsBrowser = guest;
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('unsub', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;
    site.settings.mayPostBeforeEmailVerified = true;
    site.members.push(make.memberMaria());
    idAddress = server.importSiteData(site);
    _.assign(maria, make.memberMaria());
    _.assign(owen, make.memberOwenOwner());
  });

  it("Owen goes to the homepage and logs in", () => {
    owen.go(idAddress.origin);
    owen.assertPageTitleMatches(forumTitle);
    owen.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... he posts a topic", () => {
    owen.complex.createAndSaveTopic({ title: topicTitle, body: topicBody });
    topicUrl = owen.url().value;
  });

  it("A guest logs in, with email, and replies", () => {
    guest.go(topicUrl);
    guest.complex.signUpAsGuestViaTopbar(guestName, guestEmail);
    guest.complex.replyToOrigPost(guestReplyText);
    guest.topic.waitUntilPostTextMatches(c.FirstReplyNr, guestReplyText);
  });

  it("Owen replies to the guest", () => {
    owen.refresh();
    owen.complex.replyToPostNr(c.FirstReplyNr, owensReplyText);
    owen.topic.waitUntilPostTextMatches(c.FirstReplyNr + 1, owensReplyText);
  });

  it("... and logs out", () => {
    owen.topbar.clickLogout();
  });

  // If the send-emails-every-X-seconds interval was too large,
  // the following would time out and make this test fail randomly. [5KF0WU2T4]

  it("The server sent reply notf email to Owen. He clicks unsub link, but waits w clicking unsub button", () => {
    const unsubLink = server.getLastUnsubscriptionLinkEmailedTo(idAddress.id, owen.emailAddress, owen);
    owen.go(unsubLink);
  });

  let verifyAddrLink: string;

  it("The guest got an email-addr-verification-email, but doesn't click it directly", () => {
    verifyAddrLink = server.getLastVerifyEmailAddressLinkEmailedTo(idAddress.id, guestEmail);
  });

  it("... instead hen posts another reply to Owen", () => {
    guest.complex.replyToOrigPost(guestReplyText2);
    guest.topic.waitUntilPostTextMatches(c.FirstReplyNr + 2, guestReplyText2);
  });

  it("... then hen logs out", () => {
    guest.topbar.clickLogout();
  });

  // If the guest *did* get a reply notf, it would have arrived before this 2nd notf to Owen.
  // So, if Owen gets the notf, but the guest doesn't, then the don't-send-notfs-before-
  // email-verified stuff works.
  it("Owen gets a 2nd reply notf email — it arrives, although ...", () => {
    server.waitUntilLastEmailMatches(idAddress.id, owen.emailAddress, 'gröt_med_gurka', browser);
    owensLastUnsubLink =
        server.getLastUnsubscriptionLinkEmailedTo(idAddress.id, owen.emailAddress, owen);
  });

  it("... no reply notf email sent to the guest, because hen hasn't clicked email-verif-link", () => {
    const link = server.getAnyUnsubscriptionLinkEmailedTo(idAddress.id, guestEmail);
    assert(!link);
  });

  it("... now the guest clicks the email-addr-verification-email", () => {
    guestsBrowser.go(verifyAddrLink);
  });

  // Logout, because want to test guest login (not just signup), later.
  it("... gets logged in; logs out again", () => {
    // SECURITY perhaps shouldn't auto-login — instead, only do that if clicking
    // a "Login and continue" btn? To prevent accidentally logging in by just clicking
    // email link & then forgetting about it.
    guestsBrowser.go('/');
    guestsBrowser.topbar.clickLogout();
  });

  it("... after having confirmed the address, hen gets a reply notf email, with unsub link", () => {
    guestsUnsubscribeLink = server.waitForUnsubscriptionLinkEmailedTo(
        idAddress.id, guestEmail, guestsBrowser);
  });

  it("... the guest also got an email, s/he clicks the unsubscribe link too", () => {
    guest.go(guestsUnsubscribeLink);
  });

  it("They both unsubscribe", () => {
    owen.rememberCurrentUrl();
    guest.rememberCurrentUrl();
    //everyone.waitAndClick('input[type="submit"]');  [EVRYBUG]
    //  —> "TypeError: Cannot read property 'promise' of undefined"
    // in webdriverio/build/lib/multibrowser.js
    browserA.waitAndClick('input[type="submit"]');
    browserB.waitAndClick('input[type="submit"]');
    browserA.waitForNewUrl();
    browserB.waitForNewUrl();
    browserA.waitForVisible('#e2eBeenUnsubscribed');
    browserB.waitForVisible('#e2eBeenUnsubscribed');
  });

  it("The guest replies again to Owen", () => {
    everyone.go(topicUrl);
    guest.complex.logInAsGuestViaTopbar(guestName, guestEmail);
    guest.complex.replyToPostNr(c.FirstReplyNr + 1, guestReplyTextAfterUnsub);
    owen.refresh();
    browserA.topic.waitUntilPostTextMatches(c.FirstReplyNr + 3, guestReplyTextAfterUnsub);
    browserB.topic.waitUntilPostTextMatches(c.FirstReplyNr + 3, guestReplyTextAfterUnsub);
  });

  it("... who replies again to the guest", () => {
    owen.refresh();
    owen.complex.loginWithPasswordViaTopbar(owen);
    owen.complex.replyToPostNr(c.FirstReplyNr + 3, owensReplyText2);
    guest.refresh();
    browserA.topic.waitUntilPostTextMatches(c.FirstReplyNr + 4, owensReplyText2);
    browserB.topic.waitUntilPostTextMatches(c.FirstReplyNr + 4, owensReplyText2);
  });

  it("Maria logs in, in the guest's browser", () => {
    assert(guest === maria);
    guest.topbar.clickLogout();
    maria.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... posts a reply and logs out", () => {
    maria.complex.replyToPostNr(c.FirstReplyNr + 4, mariasReplyText);
    maria.topic.waitUntilPostTextMatches(c.FirstReplyNr + 5, mariasReplyText);
    maria.topbar.clickLogout();
  });

  it("Owen replies to Maria", () => {
    owen.refresh();
    owen.complex.replyToPostNr(c.FirstReplyNr + 5, owensReplyText3);
    owen.topic.waitUntilPostTextMatches(c.FirstReplyNr + 6, owensReplyText3);
  });

  it("Maria gets a notf email", () => {
    let url = server.getLastUnsubscriptionLinkEmailedTo(idAddress.id, maria.emailAddress, maria);
    assert(!!url);
  });

  // Maria should get her email after Owen and the guest, if any email is sent to them,
  // because the replies to Owen and the guest, were posted before the reply to Maria.

  it("Owen gets no more emails", () => {
    let url = server.getLastUnsubscriptionLinkEmailedTo(idAddress.id, owen.emailAddress, owen);
    assert(url === owensLastUnsubLink, "Owen got a *new* unsubscription email:\n" +
        `  First unsub url: ${owensLastUnsubLink}\n` +
        `  Last unsub url: ${url}`);
  });

  it("The guest also gets no more emails", () => {
    let url = server.getLastUnsubscriptionLinkEmailedTo(idAddress.id, guestEmail, guest);
    assert(url === guestsUnsubscribeLink, "The guest got a *new* unsubscription email");
  });

});

