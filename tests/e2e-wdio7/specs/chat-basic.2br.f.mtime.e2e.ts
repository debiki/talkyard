/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';


let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;

let everyone;
let owen;
let owensBrowser: TyE2eTestBrowser;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let maja;
let michael;
let michaelsBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId;


describe('chat-basic.2br.f.mtime  TyTCHATBASC', () => {

  it('create site with two members', async () => {
    everyone = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = make.memberOwenOwner();
    owensBrowser = brA;
    maria = make.memberMaria();
    mariasBrowser = brB;

    maja = make.memberMaja();
    michael = make.memberMichael();
    michaelsBrowser = mariasBrowser;

    const site: SiteData = make.forumOwnedByOwen('basicchat');
    site.members.push(maria);
    site.members.push(maja);
    site.members.push(michael);
    idAddress = await server.importSiteData(site);
    siteId = idAddress.id;
  });

  it(`Everyone goes to the forum`, async () => {
    await everyone.go2(idAddress.origin);
    mariasBrowser.disableRateLimits();
    owensBrowser.disableRateLimits();
  });

  it("Owen logs in", async () => {
    await owensBrowser.watchbar.clickCreateChat();
    await owensBrowser.loginDialog.loginWithPassword(owen);
  });

  it("... creates a chat topic", async () => {
    await owensBrowser.editor.editTitle("Chat channel title");
    await owensBrowser.editor.editText("Chat channel purpose");
    await owensBrowser.rememberCurrentUrl();
    await owensBrowser.editor.clickSave();
    await owensBrowser.waitForNewUrl();
    await owensBrowser.chat.joinChat();
  });


  // ----- In public chat, can @mention-notify others  [PRIVCHATNOTFS]

  let prevNumEmails: number;

  it("Owen writes a chat message, mentions @maria", async () => {
    prevNumEmails = (await server.getEmailsSentToAddrs(siteId)).num;
    await owensBrowser.chat.addChatMessage(`Hi, I'm Owen, and my name is Owen. Who is @${maria.username}?`);
    await owensBrowser.chat.waitForNumMessages(1);
    await owensBrowser.assertTextMatches('.esC_M', /Owen/);
  });
  it("... Maria gets email notf, since @mentioned, and chat not private [PRIVCHATNOTFS]", async () => {
    await server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, ['my name is Owen'], mariasBrowser);
  });
  it("... but only Maria", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    assert.eq(num, prevNumEmails + 1, `Emails sent to: ${addrsByTimeAsc}`);
    prevNumEmails = num;
  });

  it("Maria opens the chat page", async () => {
    await mariasBrowser.go2(await owensBrowser.getUrl());
  });

  it("... sees Owens message", async () => {
    await mariasBrowser.chat.waitForNumMessages(1);
    await mariasBrowser.assertTextMatches('.esC_M', /Owen/);
  });


  // ----- Live updates work

  it("Maria joins the chat topic", async () => {
    await mariasBrowser.chat.joinChat();
    await mariasBrowser.loginDialog.loginWithPassword(maria);
  });

  it("Maria posts a chat message, and sees it", async () => {
    await mariasBrowser.chat.addChatMessage("Hi, I'm Maria.");
    await mariasBrowser.chat.waitForNumMessages(2);
    await mariasBrowser.assertNthTextMatches('.esC_M', 2, /Maria/);
  });

  it("Owen sees it", async () => {
    await owensBrowser.chat.waitForNumMessages(2);
    await owensBrowser.assertNthTextMatches('.esC_M', 2, /Maria/);
  });

  it("Owen posts a chat message, and sees it", async () => {
    await owensBrowser.chat.addChatMessage("Hi, and is your name Maria?");
    await owensBrowser.assertNthTextMatches('.esC_M', 3, /is your name/);
  });

  it("Maria sees it", async () => {
    await mariasBrowser.assertNthTextMatches('.esC_M', 3, /is your name/);
  });

  it("A minute elapses, ... the browsers re-send long polling requests", async () => { // break out fn? [4KWBFG5]  [8T5WKBQT]
    //const mariaReqNrBefore = await mariasBrowser.countLongPollingsDone();
    //const owenReqNrBefore = await owensBrowser.countLongPollingsDone();

    // This'll make the browsers send 2 new long polling requests.
    await everyone.playTimeSeconds(60);
    await everyone.pause(c.MagicTimeoutPollMs + 100);  // ... nr 1 gets sent here
    await everyone.playTimeSeconds(60);
    await everyone.pause(c.MagicTimeoutPollMs + 100);  // ... nr 2

    /*
    const mariaReqNrAfter = await mariasBrowser.countLongPollingsDone();
    const owenReqNrAfter = await owensBrowser.countLongPollingsDone();

    console.log(`Maria's num long pollings after: ${mariaReqNrAfter}, before: ${mariaReqNrBefore}`);
    console.log(`Owen's num long pollings after: ${owenReqNrAfter}, before: ${owenReqNrBefore}`);

    TESTS_MISSING  TyT20956QKSP2  these were for LongPolling — are some similar types of tests
    needed for WebSocket? Maybe disconnect and reconnect tests?

    assert.ok(mariaReqNrAfter > mariaReqNrBefore + 1,
        `Maria's browser: Long polling didn't happen? Req nr after: ${mariaReqNrAfter}, ` +
        `before: ${mariaReqNrBefore} [TyE4WKBZW1]`);
    assert.ok(owenReqNrAfter > owenReqNrBefore + 1,
        `Owen's browser: Long polling didn't happen? Req nr after: ${owenReqNrAfter}, ` +
        `before: ${owenReqNrBefore} [TyE4WKBZW2]`);
        */
  });

  it("Maria replies, and Owen posts another message", async () => {
    await mariasBrowser.chat.addChatMessage("What?");
    await mariasBrowser.chat.addChatMessage("Why, yes.");
    await owensBrowser.chat.addChatMessage("Can I call you Maria then?");
  });

  it("Owen sees Maria's last chat message — live updates still work, after many minutes", async () => {
    await owensBrowser.assertNthTextMatches('.esC_M', 4, /Why, yes/);
  });

  it("Maria sees Owen's", async () => {
    await mariasBrowser.assertNthTextMatches('.esC_M', 5, /Can I call you Maria/);
  });


  // ----- No notfs in public chat, unless @mentioned  [PRIVCHATNOTFS]

  it("Maria goes to another page", async () => {
    await mariasBrowser.topbar.clickHome();
  });

  it("?? BUG Annoyingly, needs to click the chat channel so it stops being unread ??", async () => {
    // This makes the topic unread. Why is this needed? Mildly annoying.
    await mariasBrowser.watchbar.openUnreadTopic();
    await mariasBrowser.watchbar.waitUntilNumUnreadTopics({ atMost: 0, exactly: 0 });
    // Then go back to Home.
    await mariasBrowser.topbar.clickHome();
  });

  it("Owen posts another message — Maria won't get notified, because " +
     "not directly to her and isn't a private chat", async () => {
    prevNumEmails = (await server.getEmailsSentToAddrs(siteId)).num;
    assert.eq(await mariasBrowser.watchbar.numUnreadTopics(), 0);
    await owensBrowser.chat.addChatMessage(`But what is @${michael.username}'s name?`);
  });
  it("... Michael gets notified", async () => {
    await server.waitUntilLastEmailMatches(
        siteId, michael.emailAddress, ['But what is @michael'], michaelsBrowser);
  });
  it("... Maria sees the topic get highlighted in the sidebar", async () => {
    await mariasBrowser.watchbar.waitUntilNumUnreadTopics({ atLeast: 1, exactly: 1 });
    assert.eq(await mariasBrowser.watchbar.numUnreadTopics(), 1);
  });
  it("... but she won't get any email notf", async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(siteId);
    // Only 1 email, to Michael.
    assert.eq(num, prevNumEmails + 1, `Emails sent to: ${addrsByTimeAsc}`);
    prevNumEmails = num;
  });


  // ----- Appends to the last message, unless @mention sbd else   TyT306WKCDE4

  let numMessages: number;

  it("Owen continues typing", async () => {
    numMessages = await owensBrowser.chat.countMessages({ inclAnyPreview: false }); // [DRAFTS_BUG] ...
    // ... namely Owen's browser might show a preview of an empty chat message, after this,
    // resulting in +1 more chat messages for Owen, than for Maria;
    // then, mariasBrowser.chat.waitForNumMessages(numMessages) below never completes.

    await owensBrowser.chat.addChatMessage(`Nothing going`);
    await owensBrowser.chat.addChatMessage(`on here`);
  });

  it("Maria clicks the chat in the watchbar — curious about what's going on", async () => {
    await mariasBrowser.watchbar.openUnreadTopic();
  });

  it("... She sees Owens last messages in a single post", async () => {
    await mariasBrowser.chat.waitForNumMessages(numMessages);
    assert.eq(await mariasBrowser.chat.countMessages(), numMessages);  // but not more
  });

  // The regex modifier /s makes '.' match line breaks too.
  const chatMessage6Regex = /.*michael's name.*Nothing going.*on here/s;

  it("... with the 3 last texts Owen typed", async () => {
    await mariasBrowser.chat.assertMessageNrMatches(6, chatMessage6Regex);
  });

  it("Owen continues typing, @mentions Maja", async () => {
    await owensBrowser.chat.addChatMessage(`@${maja.username} do you know what's ANYONE'S name?`);
  });

  it("... this becomes a separate message, since @mentions sbd else", async () => {
    numMessages += 1;
    await mariasBrowser.chat.waitForNumMessages(numMessages);
    await mariasBrowser.chat.assertMessageNrMatches(7, /ANYONE'S name/);
  });

  it("... didn't change Owen's previous message", async () => {
    await mariasBrowser.chat.assertMessageNrMatches(6, chatMessage6Regex);
  });

});

