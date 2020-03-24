/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
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
let owensBrowser;
let maria;
let mariasBrowser;
let michael;
let michaelsBrowser;

let siteId;


describe('chat', function() {

  it('create site with two members', function() {
    everyone = _.assign(browser, pagesFor(browser));
    owen = _.assign(browserA, pagesFor(browserA), make.memberOwenOwner());
    owensBrowser = owen;
    maria = _.assign(browserB, pagesFor(browserB), make.memberMaria());
    mariasBrowser = maria;
    michael = make.memberMichael();
    michaelsBrowser = mariasBrowser;

    const site: SiteData = make.forumOwnedByOwen('basicchat');
    site.members.push(make.memberMaria());
    site.members.push(michael);
    const idAddress = server.importSiteData(site);
    siteId = idAddress.id;
    everyone.go(idAddress.origin);
    mariasBrowser.disableRateLimits();
    owensBrowser.disableRateLimits();
  });

  it("Owen logs in, creates a chat topic", function() {
    owensBrowser.watchbar.clickCreateChat();
    owensBrowser.loginDialog.loginWithPassword(owen);
    owensBrowser.waitAndSetValue('.esEdtr_titleEtc_title', "Chat channel title");
    owensBrowser.setValue('textarea', "Chat channel purpose");
    owensBrowser.rememberCurrentUrl();
    owensBrowser.editor.clickSave();
    owensBrowser.waitForNewUrl();
    owensBrowser.chat.joinChat();
  });


  // ----- In public chat, can @mention-notify others  [PUBPRIVNOTF]

  let prevNumEmails: number;

  it("Owen writes a chat message, mentions @maria", function() {
    prevNumEmails = server.getEmailsSentToAddrs(siteId).num;
    owensBrowser.chat.addChatMessage(`Hi, I'm Owen, and my name is Owen. Who is @${maria.username}?`);
    owensBrowser.chat.waitForNumMessages(1);
    owensBrowser.assertTextMatches('.esC_M', /Owen/);
  });
  it("... Maria gets email notf, since @mentioned, and chat not private [PUBPRIVNOTF]", () => {
    server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, ['my name is Owen'], mariasBrowser);
  });
  it("... but only Maria", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.eq(num, prevNumEmails + 1, `Emails sent to: ${addrsByTimeAsc}`);
    prevNumEmails = num;
  });

  it("Maria opens the chat page, sees Owens message", function() {
    mariasBrowser.go(owensBrowser.url().value);
    mariasBrowser.chat.waitForNumMessages(1);
    mariasBrowser.assertTextMatches('.esC_M', /Owen/);
  });


  // ----- Live updates work

  it("Maria joins the chat topic", function() {
    mariasBrowser.chat.joinChat();
    mariasBrowser.loginDialog.loginWithPassword(maria);
  });

  it("Maria posts a chat message, and sees it", function() {
    mariasBrowser.chat.addChatMessage("Hi, I'm Maria.");
    mariasBrowser.chat.waitForNumMessages(2);
    mariasBrowser.assertNthTextMatches('.esC_M', 2, /Maria/);
  });

  it("Owen sees it", function() {
    owensBrowser.chat.waitForNumMessages(2);
    owensBrowser.assertNthTextMatches('.esC_M', 2, /Maria/);
  });

  it("Owen posts a chat message, and sees it", function() {
    owensBrowser.chat.addChatMessage("Hi, and is your name Maria?");
    owensBrowser.assertNthTextMatches('.esC_M', 3, /is your name/);
  });

  it("Maria sees it", function() {
    mariasBrowser.assertNthTextMatches('.esC_M', 3, /is your name/);
  });

  it("A minute elapses, ... the browsers re-send long polling requests", () => { // break out fn? [4KWBFG5]  [8T5WKBQT]
    const mariaReqNrBefore = mariasBrowser.countLongPollingsDone();
    const owenReqNrBefore = owensBrowser.countLongPollingsDone();

    // This'll make the browsers send 2 new long polling requests.
    everyone.playTimeSeconds(60);
    everyone.pause(c.MagicTimeoutPollMs + 100);  // ... nr 1 gets sent here
    everyone.playTimeSeconds(60);
    everyone.pause(c.MagicTimeoutPollMs + 100);  // ... nr 2

    const mariaReqNrAfter = mariasBrowser.countLongPollingsDone();
    const owenReqNrAfter = owensBrowser.countLongPollingsDone();

    console.log(`Maria's num long pollings after: ${mariaReqNrAfter}, before: ${mariaReqNrBefore}`);
    console.log(`Owen's num long pollings after: ${owenReqNrAfter}, before: ${owenReqNrBefore}`);

    assert.ok(mariaReqNrAfter > mariaReqNrBefore + 1,
        `Maria's browser: Long polling didn't happen? Req nr after: ${mariaReqNrAfter}, ` +
        `before: ${mariaReqNrBefore} [TyE4WKBZW1]`);
    assert.ok(owenReqNrAfter > owenReqNrBefore + 1,
        `Owen's browser: Long polling didn't happen? Req nr after: ${owenReqNrAfter}, ` +
        `before: ${owenReqNrBefore} [TyE4WKBZW2]`);
  });

  it("Maria replies, and Owen posts another message", function() {
    mariasBrowser.chat.addChatMessage("What?");
    //mariasBrowser.pause(3500);
    mariasBrowser.chat.addChatMessage("Why, yes.");
    owensBrowser.chat.addChatMessage("Can I call you Maria then?");
  });

  it("Owen sees Maria's last chat message — live updates still work, after many minutes", () => {
    owensBrowser.assertNthTextMatches('.esC_M', 4, /Why, yes/);
  });

  it("Maria sees Owen's", function() {
    mariasBrowser.assertNthTextMatches('.esC_M', 5, /Can I call you Maria/);
  });


  // ----- No notfs in public chat, unless @mentioned  [PUBPRIVNOTF]

  it("Maria goes to another page", () => {
    mariasBrowser.topbar.clickHome();
  });

  it("?? Annoyingly, needs to click the chat channel so it stops being unread ??", () => {
    // This makes the topic unread. Why is this needed? Mildly annoying.
    mariasBrowser.watchbar.openUnreadTopic();
    // Then go back to Home.
    mariasBrowser.topbar.clickHome();
  });

  it("Owen posts another message — Maria won't get notified, because " +
     "not directly to her and isn't a private chat", function() {
    prevNumEmails = server.getEmailsSentToAddrs(siteId).num;
    assert.eq(mariasBrowser.watchbar.numUnreadTopics(), 0);
    owensBrowser.chat.addChatMessage(`But what is @${michael.username}'s name?`);
  });
  it("... Michael gets notified", () => {
    server.waitUntilLastEmailMatches(
        siteId, michael.emailAddress, ['But what is @michael'], michaelsBrowser);
  });
  it("... Maria sees the topic get highlighted in the sidebar", () => {
    mariasBrowser.watchbar.waitUntilNumUnreadTopics(1);
    assert.eq(mariasBrowser.watchbar.numUnreadTopics(), 1);
  });
  it("... but she won't get any email notf", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.eq(num, prevNumEmails + 1, `Emails sent to: ${addrsByTimeAsc}`);
    prevNumEmails = num;
  });


});

