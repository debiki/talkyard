/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

let browser: TyE2eTestBrowser;
declare const browserA: any;
declare const browserB: any;
declare const browserC: any;

let everyone;
let owen;
let michael;
let maria;
let guest;

let idAddress;
let siteId;
const forumTitle = "Forum with Private Chat";
const chatNameOrig = "Chat Name Orig";
const chatNameEdited = "Chat Name Edited";
const chatPurpose = "Chat purpose";
let chatUrl;

const owensFirstMessageMariaNotified = 'owensFirstMessageMariaNotified';
const mariasMessageOwenMichaelNotified = 'mariasMessageOwenMichaelNotified';
const owensTopTopSecretToMichael = 'owensTopTopSecretToMichael';
const michaelMentionsMaria = 'michaelMentionsMaria';


describe("private chat  TyT2ABKR045", function() {

  it("initialize people", function() {
    everyone = new TyE2eTestBrowser(wdioBrowser);
    owen = _.assign(new TyE2eTestBrowser(browserA), make.memberOwenOwner());
    michael = _.assign(new TyE2eTestBrowser(browserB), make.memberMichael());
    maria = _.assign(new TyE2eTestBrowser(browserC), make.memberMaria());
    // Let's reuse the same browser.
    guest = maria;
  });

  it("import a site", function() {
    var site: SiteData = make.forumOwnedByOwen('priv-chat', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;
    site.settings.mayPostBeforeEmailVerified = true; // remove later, if email not required [0KPS2J]
    site.members.push(make.memberMichael());
    site.members.push(make.memberMaria());
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("Owen creates a private chat", function() {
    owen.go(idAddress.origin);
    owen.assertPageTitleMatches(forumTitle);
    owen.complex.loginWithPasswordViaTopbar(owen);
    owen.complex.createChatChannelViaWatchbar(
        { name: chatNameOrig, purpose: chatPurpose, public_: false });
    chatUrl = owen.getUrl();
  });

  it("... edits the title  TyT7UKAB20", function() {
    owen.pageTitle.clickEdit();
    owen.pageTitle.editTitle(chatNameEdited);
    owen.pageTitle.save();
    owen.pageTitle.assertMatches(chatNameEdited);
  });


  // ----- A private chat is private

  it("Maria, when not logged in, cannot access it via direct link", function() {
    maria.go(chatUrl);
    maria.assertNotFoundError();
  });

  it("... and doesn't see it listed in the forum", function() {
    maria.go(idAddress.origin);
    maria.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("Maria logs in, still cannot access it, doesn't see it listed", function() {
    maria.complex.loginWithPasswordViaTopbar(maria);
    maria.go(chatUrl);
    maria.assertNotFoundError();
    maria.go(idAddress.origin);
    maria.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("Owen adds Maria to the chat: clicks View People ...", function() {
    owen.watchbar.clickViewPeople();
  });

  it("... and adds Maria", function() {
    owen.complex.addPeopleToPageViaContextbar(['maria']);
  });


  // ----- Priv chat members get notified about all messages  [PRIVCHATNOTFS]

  let prevNumEmails: number;

  it("Owen writes something, not directly to Maria though", () => {
    prevNumEmails = server.getEmailsSentToAddrs(siteId).num;
    owen.chat.addChatMessage(owensFirstMessageMariaNotified);
  });
  it("... Maria gets an email notf, although the reply wasn't directly to her " +
        "— being a private topic member is enough", () => {
    server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, [owensFirstMessageMariaNotified], maria);
  });
  it("... but only Maria", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.eq(num, prevNumEmails + 1, `Emails sent to: ${addrsByTimeAsc}`);
    prevNumEmails = num;
  });


  // ----- More access permissions tests

  it("Now Maria sees the chat in her watchbar", () => {
    maria.refresh();
    maria.watchbar.waitForTopicVisible(chatNameEdited);
  });

  it("... but not in the forum topic list", function() {
    maria.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... she clicks and opens that topic", function() {
    maria.watchbar.goToTopic(chatNameEdited);
  });

  it("Michael logs in, cannot access it", function() {
    michael.go(idAddress.origin);
    michael.complex.loginWithPasswordViaTopbar(michael);
    michael.go(chatUrl);
    michael.assertNotFoundError();
  });

  it("Owen adds Michael to the chat", function() {
    owen.complex.addPeopleToPageViaContextbar(['michael']);
  });


  // ----- Another notifications test

  it("Maria writes something", () => {
    maria.chat.addChatMessage(mariasMessageOwenMichaelNotified);
  });

  it("... now Owen get notified", () => {
    server.waitUntilLastEmailMatches(
        siteId, owen.emailAddress, [mariasMessageOwenMichaelNotified], owen);
  });

  it("... and Michael", () => {
    server.waitUntilLastEmailMatches(
        siteId, michael.emailAddress, [mariasMessageOwenMichaelNotified], michael);
  });

  it("... no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.eq(num, prevNumEmails + 2, `Emails sent to: ${addrsByTimeAsc}`);
    prevNumEmails = num;
  });


  it("Now Michael can access it", function() {
    michael.refresh();
    michael.assertPageTitleMatches(chatNameEdited);
  });


  // ----- Live updates work

  it("All three post a chat message ...", function() {
    owen.chat.addChatMessage("I'm Owen.");
    maria.chat.addChatMessage("I'm Maria.");
    michael.chat.addChatMessage("Me too. No, I mean, I'm Michael.");
    //everyone.chat.waitForNumMessages(3); [EVRYBUG]
  });


  it("... which all of them see", function() {
    logAndDie.logMessage(`Owen ...`);
    owen.chat.waitForNumMessages(5);
    logAndDie.logMessage(`Maria ...`);
    maria.chat.waitForNumMessages(5);
    logAndDie.logMessage(`Michael ...`);
    michael.chat.waitForNumMessages(5);
  });

  // 1 minute passes (so new long pollling requests gets sent)   // break out fn? [4KWBFG5]
  // TESTS_MISSING
  // ... everyone says sth, everyone sees
  // + eveeryone sees 3 members in the chat ...


  // ----- One can leave the chat

  it("Maria leaves the chat", function() {
    maria.watchbar.clickLeaveChat();
  });

  // ... and the others see now she's offline  TESTS_MISSING

  it("... and thereafter no longer sees the chat page", function() {
    // For now. Should probably redirect to / instead, after refresh? COULD
    maria.refresh();
    maria.assertNotFoundError();
    maria.go(idAddress.origin);
    maria.forumTopicList.waitUntilKnowsIsEmpty();
    maria.watchbar.waitForTopicVisible(c.WatchbarHomeLinkTitle);
    maria.watchbar.assertTopicAbsent(chatNameEdited);
    maria.watchbar.asserExactlyNumTopics(1); // the forum
  });

  it("... she logs out, still doesn't see the chat", function() {
    maria.topbar.clickLogout();
    maria.refresh();
    maria.forumTopicList.waitUntilKnowsIsEmpty();
    maria.watchbar.asserExactlyNumTopics(1);
    maria.go(chatUrl);
    maria.assertNotFoundError();
  });

  it("But Michael still sees it", function() {
    michael.refresh();
    michael.assertPageTitleMatches(chatNameEdited);
  });


  // ----- After having left the chat: No more notifications

  it("Owen writes something, Top Top secret, Maria must not see", () => {
    prevNumEmails = server.getEmailsSentToAddrs(siteId).num;
    owen.chat.addChatMessage(owensTopTopSecretToMichael);
  });

  it("... Michael gets a notf email, although wasn't directly to him", () => {
    server.waitUntilLastEmailMatches(
        siteId, michael.emailAddress, [owensTopTopSecretToMichael], michael);
  });

  it("... but only Michael (not Maria)", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.eq(num, prevNumEmails + 1, `Emails sent to: ${addrsByTimeAsc}`);
    prevNumEmails = num;
  });


  // ----- Cannot @mention-notify people outside private chat  [PRIVCHATNOTFS]

  it("Mentioning someone not in this *private* chat, generates *no* notf " +
        "(but does, in a public chat)", () => {
    michael.chat.addChatMessage(michaelMentionsMaria + ` @${maria.username}`);
  });

  it("... Owen gets a notf email (since he's in the chat)", () => {
    server.waitUntilLastEmailMatches(
        siteId, owen.emailAddress, [michaelMentionsMaria], michael);
  });

  it("... but not Maria", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.eq(num, prevNumEmails + 1, `Emails sent to: ${addrsByTimeAsc}`);
    prevNumEmails = num;
  });


  // ----- More leave-chat access permission tests

  it("Owen removs Michael from the chat", function() {
    owen.contextbar.clickUser('michael');
    // Failed once:
    // "FAIL: Error: An element could not be located on the page using the given search parameters."
    // in _waitAndClick, this line:  browser.click(selector);
    // Perhaps I just interrupted the test? Delete this comment after 2017-04-01.
    owen.aboutUserDialog.clickRemoveFromPage();
  });

  it("Now Michael can no longer access the page", function() {
    // For now. Later, SECURITY SHOULD kick user via pub/sub-message [pubsub]
    michael.refresh();
    michael.assertNotFoundError();
  });

  it("... doesn't see it in the topic list", function() {
    michael.go(idAddress.origin);
    michael.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... and doesn't see it in the watchbar", function() {
    michael.watchbar.waitForTopicVisible(c.WatchbarHomeLinkTitle);
    michael.watchbar.assertTopicAbsent(chatNameEdited);
    michael.watchbar.asserExactlyNumTopics(1); // the forum
  });

  it("A guest logs in (in Maria's browser)", function() {
    assert.refEq(guest, maria);
    guest.go(idAddress.origin);
    guest.complex.signUpAsGuestViaTopbar("Gunnar Guest");
  });

  it("... the guest cannot access it via a direct link", function() {
    guest.go(chatUrl);
    guest.assertNotFoundError();
  });

  it("... and doesn't see the chat in the forum topic list", function() {
    guest.go(idAddress.origin);
    guest.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... and it won't appear in the watchbar", function() {
    guest.watchbar.waitForTopicVisible(c.WatchbarHomeLinkTitle);
    guest.watchbar.assertTopicAbsent(chatNameEdited);
    guest.watchbar.asserExactlyNumTopics(1); // the forum
  });

});

