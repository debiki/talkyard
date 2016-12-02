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
let maria;
let guest;

let idAddress: IdAddress;
let forumTitle = "Unsubscription Forum";

let topicTitle = "Unsub Topic Title";
let topicBody = "Unsub topic text.";
let topicUrl;

let owensReplyText = "Owen's reply text.";
let owensReplyText2 = "Owen's reply 2.";
let owensReplyText3 = "Owen's reply 3.";
let owensFirstEmailLink: string;

let guestName = "Gestelina";
let guestEmail = "e2e-test--guestella@example.com";
let guestReplyText = "Guest's reply text.";
let guestReplyText2 = "Guest's reply 2.";
let guestsFirstEmailLink: string;

let mariasReplyText = "Maria's reply.";


describe("unsubscribe", () => {

  it("initialize people", () => {
    browser.perhapsDebugBefore();
    everyone = _.assign(browser, pagesFor(browser));
    owen = _.assign(browserA, pagesFor(browserA), make.memberOwenOwner());
    maria = _.assign(browserB, pagesFor(browserB), make.memberMaria());
    // Reuse the same browser.
    guest = maria;
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('unsub', { title: forumTitle });
    site.settings.allowGuestLogin = true;
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
    guest.complex.loginAsGuestViaTopbar(guestName, guestEmail);
    guest.complex.replyToOrigPost(guestReplyText);
    guest.topic.assertPostTextMatches(c.FirstReplyNr, guestReplyText);
  });

  it("... logs out", () => {
    guest.topbar.clickLogout();
  });

  it("Owen replies to the guest", () => {
    owen.refresh();
    owen.complex.replyToPostNr(c.FirstReplyNr, owensReplyText);
    owen.topic.assertPostTextMatches(c.FirstReplyNr + 1, owensReplyText);
  });

  it("... and logs out", () => {
    owen.topbar.clickLogout();
  });

  // If the send-emails-every-X-seconds interval was too large,
  // the following would time out and make this test fail randomly. [5KF0WU2T4]

  it("The server sent a reply notf email to Owen. He clicks the unsubscribe link", () => {
    owensFirstEmailLink =
        server.getLastUnsubscriptionLinkEmailedTo(idAddress.id, owen.emailAddress);
    owen.go(owensFirstEmailLink);
  });

  it("... the guest also got an email, s/he clicks the unsubscribe link too", () => {
    guestsFirstEmailLink = server.getLastUnsubscriptionLinkEmailedTo(idAddress.id, guestEmail);
    guest.go(guestsFirstEmailLink);
  });

  it("They both unsubscribe", () => {
    owen.rememberCurrentUrl();
    guest.rememberCurrentUrl();
    everyone.waitAndClick('input[type="submit"]');
    owen.waitForNewUrl();
    guest.waitForNewUrl();
    everyone.waitForVisible('#e2eBeenUnsubscribed');
  });

  it("The guest replies again to Owen", () => {
    everyone.go(topicUrl);
    guest.complex.loginAsGuestViaTopbar(guestName, guestEmail);
    guest.complex.replyToPostNr(c.FirstReplyNr + 1, guestReplyText2);
    owen.refresh();
    everyone.topic.assertPostTextMatches(c.FirstReplyNr + 2, guestReplyText2);
  });

  it("... who replies again to the guest", () => {
    owen.refresh();
    owen.complex.loginWithPasswordViaTopbar(owen);
    owen.complex.replyToPostNr(c.FirstReplyNr + 2, owensReplyText2);
    guest.refresh();
    everyone.topic.assertPostTextMatches(c.FirstReplyNr + 3, owensReplyText2);
  });

  it("Maria logs in, in the guest's browser", () => {
    assert(guest === maria);
    guest.topbar.clickLogout();
    maria.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... posts a reply and logs out", () => {
    maria.complex.replyToPostNr(c.FirstReplyNr + 3, mariasReplyText);
    maria.topic.assertPostTextMatches(c.FirstReplyNr + 4, mariasReplyText);
    maria.topbar.clickLogout();
  });

  it("Owen replies to Maria", () => {
    owen.refresh();
    owen.complex.replyToPostNr(c.FirstReplyNr + 4, owensReplyText3);
    owen.topic.assertPostTextMatches(c.FirstReplyNr + 5, owensReplyText3);
  });

  it("Maria gets a notf email", () => {
    let url = server.getLastUnsubscriptionLinkEmailedTo(idAddress.id, maria.emailAddress);
    assert(!!url);
  });

  // Maria should get her email after Owen and the guest, if any email is sent to them,
  // because the replies to Owen and the guest, were posted before the reply to Maria.

  it("Owen gets no more emails", () => {
    let url = server.getLastUnsubscriptionLinkEmailedTo(idAddress.id, owen.emailAddress);
    assert(url === owensFirstEmailLink, "Owen got a *new* unsubscription email");
  });

  it("The guest also gets no more emails", () => {
    let url = server.getLastUnsubscriptionLinkEmailedTo(idAddress.id, guestEmail);
    assert(url === guestsFirstEmailLink, "The guest got a *new* unsubscription email");
  });

  it("Done", () => {
    everyone.perhapsDebug();
  });

});

