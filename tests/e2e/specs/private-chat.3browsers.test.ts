/// <reference path="../test-types.ts"/>
/// <reference path="../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import * as _ from 'lodash';
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import assert = require('assert');
import logAndDie = require('../utils/log-and-die');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;
declare var browserC: any;

var everyone;
var owen;
var michael;
var maria;
var guest;

var idAddress;
var forumTitle = "Forum with Private Chat";
var chatName = "Chat Name";
var chatPurpose = "Chat purpose";
var chatUrl;


describe("private chat", function() {

  it("initialize people", function() {
    browser.perhapsDebugBefore();
    everyone = _.assign(browser, pagesFor(browser));
    owen = _.assign(browserA, pagesFor(browserA), make.memberOwenOwner());
    michael = _.assign(browserB, pagesFor(browserB), make.memberMichael());
    maria = _.assign(browserC, pagesFor(browserC), make.memberMaria());
    // Let's reuse the same browser.
    guest = maria;
  });

  it("import a site", function() {
    var site: SiteData = make.forumOwnedByOwen('priv-chat', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.members.push(make.memberMichael());
    site.members.push(make.memberMaria());
    idAddress = server.importSiteData(site);
  });

  it("Owen creates a private chat", function() {
    owen.go(idAddress.origin);
    owen.assertPageTitleMatches(forumTitle);
    owen.complex.loginWithPasswordViaTopbar(owen);
    owen.complex.createChatChannelViaWatchbar(
        { name: chatName, purpose: chatPurpose, public_: false });
    chatUrl = owen.url().value;
  });

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

  it("Owen adds Maria to the chat", function() {
    owen.watchbar.clickViewPeople();
    owen.complex.addPeopleToPageViaContextbar(['maria']);
  });

  it("Now Maria sees the chat in her watchbar, but not in the forum topic list", function() {
    maria.refresh();
    maria.watchbar.assertTopicVisible(chatName);
    maria.forumTopicList.waitUntilKnowsIsEmpty();
    maria.watchbar.goToTopic(chatName);
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

  it("Now Michael can access it", function() {
    michael.refresh();
    michael.assertPageTitleMatches(chatName);
  });

  it("All three post a chat message, which all of them see", function() {
    owen.chat.addChatMessage("I'm Owen.");
    maria.chat.addChatMessage("I'm Maria.");
    michael.chat.addChatMessage("I'm Michael.");
    everyone.chat.waitForNumMessages(3);
  });

  it("Maria leaves the chat", function() {
    maria.watchbar.clickLeaveChat();
  });

  it("... and thereafter no longer sees the chat page", function() {
    // For now. Should probably redirect to / instead, after refresh? COULD
    maria.refresh();
    maria.assertNotFoundError();
    maria.go(idAddress.origin);
    maria.forumTopicList.waitUntilKnowsIsEmpty();
    maria.watchbar.assertTopicAbsent(chatName);
    maria.watchbar.assertTopicVisible(forumTitle);
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
    michael.assertPageTitleMatches(chatName);
  });

  it("Owen remvoes Michael from the chat", function() {
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
    michael.watchbar.assertTopicAbsent(chatName);
    michael.watchbar.assertTopicVisible(forumTitle);
    michael.watchbar.asserExactlyNumTopics(1); // the forum
  });

  it("A guest logs in (in Maria's browser)", function() {
    assert(guest === maria, 'EsE4FKG6FY0');
    guest.go(idAddress.origin);
    guest.complex.loginAsGuestViaTopbar("Gunnar Guest");
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
    guest.watchbar.assertTopicAbsent(chatName);
    guest.watchbar.assertTopicVisible(forumTitle);
    guest.watchbar.asserExactlyNumTopics(1); // the forum
  });

  it("Done", function() {
    everyone.perhapsDebug();
  });

});

