/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import * as logAndDie from '../utils/log-and-die';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let brC: TyE2eTestBrowser;

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


describe(`private-chat.3br.d  TyT2ABKR045`, async () => {

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    brC = new TyE2eTestBrowser(wdioBrowserC, 'brC');

    owen = _.assign(brA, make.memberOwenOwner());
    michael = _.assign(brB, make.memberMichael());
    maria = _.assign(brC, make.memberMaria());
    // Let's reuse the same browser.
    guest = maria;
  });

  it("import a site", async () => {
    var site: SiteData = make.forumOwnedByOwen('priv-chat', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;
    site.settings.mayPostBeforeEmailVerified = true; // remove later, if email not required [0KPS2J]
    site.members.push(make.memberMichael());
    site.members.push(make.memberMaria());
    idAddress = await server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("Owen creates a private chat", async () => {
    await owen.go2(idAddress.origin);
    await owen.assertPageTitleMatches(forumTitle);
    await owen.complex.loginWithPasswordViaTopbar(owen);
    await owen.complex.createChatChannelViaWatchbar(
        { name: chatNameOrig, purpose: chatPurpose, public_: false });
    chatUrl = await owen.getUrl();
  });

  it("... edits the title  TyT7UKAB20", async () => {
    await owen.pageTitle.clickEdit();
    await owen.pageTitle.editTitle(chatNameEdited);
    await owen.pageTitle.save();
    await owen.pageTitle.assertMatches(chatNameEdited);
  });


  // ----- A private chat is private

  it("Maria, when not logged in, cannot access it via direct link", async () => {
    await maria.go2(chatUrl);
    await maria.assertNotFoundError();
  });

  it("... and doesn't see it listed in the forum", async () => {
    await maria.go2(idAddress.origin);
    await maria.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("Maria logs in, still cannot access it, doesn't see it listed", async () => {
    await maria.complex.loginWithPasswordViaTopbar(maria);
    await maria.go2(chatUrl);
    await maria.assertNotFoundError();
    await maria.go2(idAddress.origin);
    await maria.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("Owen adds Maria to the chat: clicks View People ...", async () => {
    await owen.watchbar.clickViewPeople();
  });

  it("... and adds Maria", async () => {
    await owen.complex.addPeopleToPageViaContextbar(['maria']);
  });


  // ----- Priv chat members get notified about all messages  [PRIVCHATNOTFS]

  let prevNumEmails: number;

  it("Owen writes something, not directly to Maria though", async () => {
    prevNumEmails = (await server.getEmailsSentToAddrs(siteId)).num;
    await owen.chat.addChatMessage(owensFirstMessageMariaNotified);
  });
  it("... Maria gets an email notf, although the reply wasn't directly to her " +
        "— being a private topic member is enough", async () => {
    await server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, [owensFirstMessageMariaNotified], maria);
  });
  it("... but only Maria", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, prevNumEmails + 1, `Emails sent to: ${addrsByTimeAsc}`);
    prevNumEmails = num;
  });


  // ----- More access permissions tests

  it("Now Maria sees the chat in her watchbar", async () => {
    await maria.refresh2();
    await maria.watchbar.waitForTopicVisible(chatNameEdited);
  });

  it("... but not in the forum topic list", async () => {
    await maria.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... she clicks and opens that topic", async () => {
    await maria.watchbar.goToTopic(chatNameEdited);
  });

  it("Michael logs in, cannot access it", async () => {
    await michael.go2(idAddress.origin);
    await michael.complex.loginWithPasswordViaTopbar(michael);
    await michael.go2(chatUrl);
    await michael.assertNotFoundError();
  });

  it("Owen adds Michael to the chat", async () => {
    await owen.complex.addPeopleToPageViaContextbar(['michael']);
  });


  // ----- Another notifications test

  it("Maria writes something", async () => {
    await maria.chat.addChatMessage(mariasMessageOwenMichaelNotified);
  });

  it("... now Owen get notified", async () => {
    await server.waitUntilLastEmailMatches(
        siteId, owen.emailAddress, [mariasMessageOwenMichaelNotified], owen);
  });

  it("... and Michael", async () => {
    await server.waitUntilLastEmailMatches(
        siteId, michael.emailAddress, [mariasMessageOwenMichaelNotified], michael);
  });

  it("... no one else", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, prevNumEmails + 2, `Emails sent to: ${addrsByTimeAsc}`);
    prevNumEmails = num;
  });


  it("Now Michael can access it", async () => {
    await michael.refresh2();
    await michael.assertPageTitleMatches(chatNameEdited);
  });


  // ----- Live updates work

  it("All three post a chat message ...", async () => {
    await owen.chat.addChatMessage("I'm Owen.");
    await maria.chat.addChatMessage("I'm Maria.");
    await michael.chat.addChatMessage("Me too. No, I mean, I'm Michael.");
  });


  it("... which all of them see", async () => {
    await logAndDie.logMessage(`Owen ...`);
    await owen.chat.waitForNumMessages(5);
    await logAndDie.logMessage(`Maria ...`);
    await maria.chat.waitForNumMessages(5);
    await logAndDie.logMessage(`Michael ...`);
    await michael.chat.waitForNumMessages(5);
  });

  // 1 minute passes (so new long pollling requests gets sent)   // break out fn? [4KWBFG5]
  // TESTS_MISSING
  // ... everyone says sth, everyone sees
  // + eveeryone sees 3 members in the chat ...


  // ----- One can leave the chat

  it("Maria leaves the chat", async () => {
    await maria.watchbar.clickLeaveChat();
  });

  // ... and the others see now she's offline  TESTS_MISSING

  it("... and thereafter no longer sees the chat page", async () => {
    // For now. Should probably redirect to / instead, after refresh? COULD
    await maria.refresh2();
    await maria.assertNotFoundError();
    await maria.go2(idAddress.origin);
    await maria.forumTopicList.waitUntilKnowsIsEmpty();
    await maria.watchbar.waitForTopicVisible(c.WatchbarHomeLinkTitle);
    await maria.watchbar.assertTopicAbsent(chatNameEdited);
    await maria.watchbar.asserExactlyNumTopics(1); // the forum
  });

  it("... she logs out, still doesn't see the chat", async () => {
    await maria.topbar.clickLogout();
    await maria.refresh2();
    await maria.forumTopicList.waitUntilKnowsIsEmpty();
    await maria.watchbar.asserExactlyNumTopics(1);
    await maria.go2(chatUrl);
    await maria.assertNotFoundError();
  });

  it("But Michael still sees it", async () => {
    await michael.refresh2();
    await michael.assertPageTitleMatches(chatNameEdited);
  });


  // ----- After having left the chat: No more notifications

  it("Owen writes something, Top Top secret, Maria must not see", async () => {
    prevNumEmails = (await server.getEmailsSentToAddrs(siteId)).num;
    await owen.chat.addChatMessage(owensTopTopSecretToMichael);
  });

  it("... Michael gets a notf email, although wasn't directly to him", async () => {
    await server.waitUntilLastEmailMatches(
        siteId, michael.emailAddress, [owensTopTopSecretToMichael], michael);
  });

  it("... but only Michael (not Maria)", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, prevNumEmails + 1, `Emails sent to: ${addrsByTimeAsc}`);
    prevNumEmails = num;
  });


  // ----- Cannot @mention-notify people outside private chat  [PRIVCHATNOTFS]

  it("Mentioning someone not in this *private* chat, generates *no* notf " +
        "(but does, in a public chat)", async () => {
    await michael.chat.addChatMessage(michaelMentionsMaria + ` @${maria.username}`);
  });

  it("... Owen gets a notf email (since he's in the chat)", async () => {
    await server.waitUntilLastEmailMatches(
        siteId, owen.emailAddress, [michaelMentionsMaria], michael);
  });

  it("... but not Maria", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, prevNumEmails + 1, `Emails sent to: ${addrsByTimeAsc}`);
    prevNumEmails = num;
  });


  // ----- More leave-chat access permission tests

  it("Owen removs Michael from the chat", async () => {
    await owen.contextbar.clickUser('michael');
    await owen.aboutUserDialog.clickRemoveFromPage();
  });

  it("Now Michael can no longer access the page", async () => {
    // For now. Later, SECURITY SHOULD kick user via pub/sub-message [pubsub]  TyT6P03MRKD
    await michael.refresh2();
    await michael.assertNotFoundError();
  });

  it("... doesn't see it in the topic list", async () => {
    await michael.go2(idAddress.origin);
    await michael.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... and doesn't see it in the watchbar", async () => {
    await michael.watchbar.waitForTopicVisible(c.WatchbarHomeLinkTitle);
    await michael.watchbar.assertTopicAbsent(chatNameEdited);
    await michael.watchbar.asserExactlyNumTopics(1); // the forum
  });

  it("A guest logs in (in Maria's browser)", async () => {
    assert.refEq(guest, maria);
    await guest.go2(idAddress.origin);
    await guest.complex.signUpAsGuestViaTopbar("Gunnar Guest");
  });

  it("... the guest cannot access it via a direct link", async () => {
    await guest.go2(chatUrl);
    await guest.assertNotFoundError();
  });

  it("... and doesn't see the chat in the forum topic list", async () => {
    await guest.go2(idAddress.origin);
    await guest.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... and it won't appear in the watchbar", async () => {
    await guest.watchbar.waitForTopicVisible(c.WatchbarHomeLinkTitle);
    await guest.watchbar.assertTopicAbsent(chatNameEdited);
    await guest.watchbar.asserExactlyNumTopics(1); // the forum
  });

});

