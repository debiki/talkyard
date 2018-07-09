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


describe('chat', function() {

  it('create site with two members', function() {
    everyone = _.assign(browser, pagesFor(browser));
    owen = _.assign(browserA, pagesFor(browserA), make.memberOwenOwner());
    maria = _.assign(browserB, pagesFor(browserB), make.memberMaria());

    const site: SiteData = make.forumOwnedByOwen('basicchat');
    site.members.push(make.memberMaria());
    const idAddress = server.importSiteData(site);
    everyone.go(idAddress.origin);
    maria.disableRateLimits();
    owen.disableRateLimits();
  });

  it("Owen logs in, creates a chat topic", function() {
    owen.watchbar.clickCreateChat();
    owen.loginDialog.loginWithPassword(owen);
    owen.waitAndSetValue('.esEdtr_titleEtc_title', "Chat channel title");
    owen.setValue('textarea', "Chat channel purpose");
    owen.rememberCurrentUrl();
    owen.waitAndClick('.e2eSaveBtn');
    owen.waitForNewUrl();
    owen.chat.joinChat();
  });

  it("Owen writes a chat message", function() {
    owen.chat.addChatMessage("Hi, I'm Owen, and my name is Owen.");
    owen.chat.waitForNumMessages(1);
    owen.assertTextMatches('.esC_M', /Owen/);
  });

  it("Maria opens the chat page, sees Owens message", function() {
    maria.go(owen.url().value);
    maria.chat.waitForNumMessages(1);
    maria.assertTextMatches('.esC_M', /Owen/);
  });

  it("Maria joins the chat topic", function() {
    maria.chat.joinChat();
    maria.loginDialog.loginWithPassword(maria);
  });

  it("Maria posts a chat message, and sees it", function() {
    maria.chat.addChatMessage("Hi, I'm Maria.");
    maria.chat.waitForNumMessages(2);
    maria.assertNthTextMatches('.esC_M', 2, /Maria/);
  });

  it("Owen sees it", function() {
    owen.chat.waitForNumMessages(2);
    owen.assertNthTextMatches('.esC_M', 2, /Maria/);
  });

  it("Owen posts a chat message, and sees it", function() {
    owen.chat.addChatMessage("Hi, and is your name Maria?");
    owen.assertNthTextMatches('.esC_M', 3, /is your name/);
  });

  it("Maria sees it", function() {
    maria.assertNthTextMatches('.esC_M', 3, /is your name/);
  });

  it("A minute elapses, ... the browsers re-send long polling requests", function() { // break out fn? [4KWBFG5]  [8T5WKBQT]
    const mariaReqNrBefore = maria.countLongPollingsDone();
    const owenReqNrBefore = owen.countLongPollingsDone();

    // This'll make the browsers send 2 new long polling requests.
    everyone.playTimeSeconds(60);
    everyone.pause(c.MagicTimeoutPollMs + 100);  // ... nr 1 gets sent here
    everyone.playTimeSeconds(60);
    everyone.pause(c.MagicTimeoutPollMs + 100);  // ... nr 2

    const mariaReqNrAfter = maria.countLongPollingsDone();
    const owenReqNrAfter = owen.countLongPollingsDone();

    console.log(`Maria's num long pollings after: ${mariaReqNrAfter}, before: ${mariaReqNrBefore}`);
    console.log(`Owen's num long pollings after: ${owenReqNrAfter}, before: ${owenReqNrBefore}`);

    assert.ok(mariaReqNrAfter > mariaReqNrBefore,
        `Maria's browser: Long polling didn't happen? Req nr after: ${mariaReqNrAfter}, ` +
        `before: ${mariaReqNrBefore} [TyE4WKBZW1]`);
    assert.ok(owenReqNrAfter > owenReqNrBefore,
        `Owen's browser: Long polling didn't happen? Req nr after: ${owenReqNrAfter}, ` +
        `before: ${owenReqNrBefore} [TyE4WKBZW2]`);
  });

  it("Maria replies, and Owen posts another message", function() {
    maria.chat.addChatMessage("What?");
    //maria.pause(3500);
    maria.chat.addChatMessage("Why, yes.");
    owen.chat.addChatMessage("Can I call you Maria then?");
  });

  it("Owen sees Maria's last chat message — live updates still work, after many minutes", function() {
    owen.assertNthTextMatches('.esC_M', 4, /Why, yes/);
  });

  it("Maria sees Owen's", function() {
    maria.assertNthTextMatches('.esC_M', 5, /Can I call you Maria/);
  });

  /* For demos:
  it("Maria replies", function() {
    //maria.pause(5000);
    maria.chat.addChatMessage("Yes, sure");
  });

  it("They talk", function() {
    owen.chat.addChatMessage("Ok super :- )");
    owen.chat.addChatMessage("Hi Maria. Lorem ipsizzle dolizzle crackalackin, boom shackalack adipiscing elit. Nullizzle fo velizzle, i'm in the shizzle volutpizzle, suscipit quis, gravida boofron, arcu. Nice talking with you!");
    maria.chat.addChatMessage("You too");
  }); */

});

