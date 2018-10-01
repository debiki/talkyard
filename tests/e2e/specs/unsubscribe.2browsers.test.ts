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
const forumTitle = "Unsubscription Forum";

const topicTitle = "Unsub Topic Title";
const topicBody = "Unsub topic text.";
let topicUrl;

const owensTextMentionsPwdPerson = "@Gestelina owensTextMentionsPwdPerson";
const owensText2MentionsPwdPerson = "owensText2MentionsPwdPerson @Gestelina";
const owenMentionsMaria = 'owenMentionsMaria @maria';
let owensLastUnsubLink: string;

const guestName = "Gestelina";
const guestEmail = "e2e-test--guestella@example.com";
const guestReplyText = "Guest's reply text.";
const guestsText2MentionsOwen = "guestsText2MentionsOwen @owen_owner";
const guestsTextAfterUnsubMentionsOwen  = "guestsTextAfterUnsubMentionsOwen @owen_owner";
let guestsUnsubscribeLink: string;

const mariaMentionsOwen = "mariaMentionsOwen @owen_owner, hi!";


describe("unsubscribe  TyT2ABKG4RUR", () => {

  it("initialize people", () => {
    everyone = _.assign(browser, pagesFor(browser));
    owen = _.assign(browserA, pagesFor(browserA), make.memberOwenOwner());
    maria = _.assign(browserB, pagesFor(browserB), make.memberMaria());
    // Reuse the same browser.
    guest = maria;
    guestsBrowser = guest;
  });

  it("import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('unsub', { title: forumTitle });
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

  it("... and goes to the topic list page, so won't see any replies (they'd get marked as seen)", () => {
    owen.go('/');
  });

  it("A guest logs in, with email, and replies", () => {
    guest.go(topicUrl);
    guest.complex.signUpAsGuestViaTopbar(guestName, guestEmail);
    guest.complex.replyToOrigPost(guestReplyText);
    guest.topic.waitUntilPostTextMatches(c.FirstReplyNr, guestReplyText);
  });

  it("Owen @mentions guest", () => {
    owen.complex.createAndSaveTopic({ title: "Hello Pwd Person", body: owensTextMentionsPwdPerson });
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

  it("... instead hen @mention's Owen, in a new topic", () => {
    guest.go('/');
    guest.complex.createAndSaveTopic({ title: "Hello Owen", body: guestsText2MentionsOwen });
  });

  it("... then hen logs out", () => {
    guest.topbar.clickLogout();
  });

  // If the guest *did* get a reply notf, it would have arrived before this 2nd notf to Owen.
  // So, if Owen gets the notf, but the guest doesn't, then the don't-send-notfs-before-
  // email-verified stuff works.
  it("Owen gets a 2nd reply notf email — it arrives, although ...", () => {
    server.waitUntilLastEmailMatches(idAddress.id, owen.emailAddress, 'guestsText2MentionsOwen', browser);
    owensLastUnsubLink =
        server.getLastUnsubscriptionLinkEmailedTo(idAddress.id, owen.emailAddress, owen);
  });

  it("... no reply notf email sent to the guest: hasn't clicked email-verif-link  [TyT2ABKR04]", () => {
    const link = server.getAnyUnsubscriptionLinkEmailedTo(idAddress.id, guestEmail);
    assert(!link);
  });

  it("... now the guest clicks the email-addr-verification-email", () => {
    guestsBrowser.go(verifyAddrLink);
  });

  // Logout, because want to test guest login (not just signup), later.
  it("... gets logged in [TyT2ABK5I0]; logs out again", () => {
    // SECURITY perhaps shouldn't auto-login — instead, only do that if clicking
    // a "Login and continue" btn? To prevent accidentally logging in by just clicking
    // email link & then forgetting about it.
    guestsBrowser.go('/');
    guestsBrowser.topbar.clickLogout();
  });

  it("... now after having confirmed the address, hen gets a reply notf email, with unsub link", () => {
    guestsUnsubscribeLink = server.waitForUnsubscriptionLinkEmailedTo(
        idAddress.id, guestEmail, guestsBrowser);
  });

  it("... s/he clicks the unsubscribe link", () => {
    guest.go(guestsUnsubscribeLink);
  });

  it("They both unsubscribe", () => {
    //everyone.waitAndClick('input[type="submit"]');  [EVRYBUG]
    //  —> "TypeError: Cannot read property 'promise' of undefined"
    // in webdriverio/build/lib/multibrowser.js
    browserA.unsubscribePage.confirmUnsubscription();
    browserB.unsubscribePage.confirmUnsubscription();
  });

  it("The guest again @mentions Owen, in a new topic", () => {
    guest.go('/');
    guest.complex.logInAsGuestViaTopbar(guestName, guestEmail);
    guest.complex.createAndSaveTopic({ title: "Hello 3 Owen", body: guestsTextAfterUnsubMentionsOwen });
  });

  it("Owen @mentions the guest, in another new topic", () => {
    owen.go('/');
    owen.complex.loginWithPasswordViaTopbar(owen);
    owen.complex.createAndSaveTopic({ title: "Hello Pwd Person", body: owensText2MentionsPwdPerson });
  });

  it("Maria logs in, in the guest's browser", () => {
    assert(guest === maria);
    guest.topbar.clickLogout();
    maria.go('/');
    maria.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... @mentions Owen", () => {
    maria.complex.createAndSaveTopic({ title: "Hello Owen", body: mariaMentionsOwen });
  });

  it("Owen @mentions Maria", () => {
    owen.go('/');
    owen.complex.createAndSaveTopic({ title: "Hello Maria", body: owenMentionsMaria });
  });

  it("Maria gets a notf email", () => {
    const url = server.getLastUnsubscriptionLinkEmailedTo(idAddress.id, maria.emailAddress, maria);
    assert(!!url);
  });

  // Maria should get her email after Owen and the guest, if any email got sent to them,
  // because the @mentions of Owen and the guest, were posted before the @mention to Maria.

  it("Owen gets no more emails", () => {
    const url = server.getLastUnsubscriptionLinkEmailedTo(idAddress.id, owen.emailAddress, owen);
    assert(url === owensLastUnsubLink, "Owen got a *new* unsubscription email:\n" +
        `  First unsub url: ${owensLastUnsubLink}\n` +
        `  Last unsub url: ${url}`);
  });

  it("The guest also gets no more emails", () => {
    const url = server.getLastUnsubscriptionLinkEmailedTo(idAddress.id, guestEmail, guest);
    assert(url === guestsUnsubscribeLink, "The guest got a *new* unsubscription email");
  });

});

