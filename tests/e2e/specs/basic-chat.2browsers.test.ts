/// <reference path="../test-types.ts"/>
/// <reference path="../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import * as _ from 'lodash';
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
    browser.perhapsDebugBefore();
    everyone = browser;
    owen = _.assign(browserA, pagesFor(browserA), make.memberOwenOwner());
    maria = _.assign(browserB, pagesFor(browserB), make.memberMaria());

    const site: SiteData = make.forumOwnedByOwen('basicchat');
    site.members.push(make.memberMaria());
    const idAddress = server.importSiteData(site);
    everyone.go(idAddress.origin);
  });

  it("Owen logs in, creates a chat topic", function() {
    owen.watchbar.clickCreateChat();
    owen.loginDialog.loginWithPassword(owen);
    owen.waitAndSetValue('.esEdtr_titleEtc_title', "Chat channel title");
    owen.setValue('textarea', "Chat channel purpose");
    owen.rememberCurrentUrl();
    owen.waitAndClick('.e2eSaveBtn');
    owen.waitForNewUrl();
    owen.waitAndClick('#theJoinChatB');
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
    maria.waitAndClick('#theJoinChatB');
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

  /* For demos:
  it("Maria replies", function() {
    maria.disableRateLimits();
    maria.chat.addChatMessage("What?");
    //maria.pause(3500);
    maria.chat.addChatMessage("Why, yes.");
  });

  it("Owen posts another chat message", function() {
    owen.disableRateLimits();
    owen.chat.addChatMessage("Can I call you Maria then?");
  });

  it("Maria replies", function() {
    //maria.pause(5000);
    maria.chat.addChatMessage("Yes, sure");
  });

  it("They talk", function() {
    owen.chat.addChatMessage("Ok super :- )");
    owen.chat.addChatMessage("Hi Maria. Lorem ipsizzle dolizzle crackalackin, boom shackalack adipiscing elit. Nullizzle fo velizzle, i'm in the shizzle volutpizzle, suscipit quis, gravida boofron, arcu. Nice talking with you!");
    maria.chat.addChatMessage("You too");
  }); */

  it("Done?", function() {
    everyone.perhapsDebug();
  });
});

