/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

let everyone;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let alice: Member;
let alicesBrowser: TyE2eTestBrowser;
let mallory: Member;
let mallorysBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;
let guest;
let guestsBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let forumTitle = "Priv Chat Forum";

let chatTopicTitle = "Chat Topic Title";
let chatTopicPurpose = "The purpose is to chat";
let topicUrl;

let coolWord = 'cool';
let wontBeFoundWord = "wont_be_found";

let owensFirstMessage = "Hi let's chat!";
let michaelsFirstMessage = `Ok ${coolWord} yes let's do that. Hello hello`;
let owensSecondMessage = "Hello hello. Hello!";
let michaelsSecondMessage = "Well yea. Bye for now then!";


describe("search-private-chat.2br  TyTSEARCHPRIVCHAT", () => {

  it("initialize people", () => {
    everyone = new TyE2eTestBrowser(wdioBrowser);
    owen = make.memberOwenOwner();
    alice = make.memberAdminAlice();
    michael = make.memberMichael();
    mallory = make.memberMallory();
    guest = make.guestGunnar();
    michaelsBrowser = new TyE2eTestBrowser(browserA);
    owensBrowser = new TyE2eTestBrowser(browserB);
    // Reuse the same browser.
    mallorysBrowser = owensBrowser;
    alicesBrowser = owensBrowser;
    guestsBrowser = owensBrowser;
    strangersBrowser = owensBrowser;
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('search-priv-chat', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;
    site.settings.mayPostBeforeEmailVerified = true;
    site.members.push(alice);
    site.members.push(mallory);
    site.members.push(michael);
    idAddress = server.importSiteData(site);
  });


  // Owen and Michael chats
  // -------------------------------------

  it("Owen goes to the homepage and log in", () => {
    owensBrowser.go(idAddress.origin);
    owensBrowser.assertPageTitleMatches(forumTitle);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    owensBrowser.disableRateLimits();
  });

  it("Owen creates a private chat", () => {
    owensBrowser.complex.createChatChannelViaWatchbar({
        name: chatTopicTitle, purpose: chatTopicPurpose, public_: false });
    topicUrl = owensBrowser.getUrl();
  });

  it("... and adds Michael", () => {
    owensBrowser.watchbar.clickViewPeople();
    owensBrowser.complex.addPeopleToPageViaContextbar([michael.username]);
  });

  it("Michael logs in", () => {
    michaelsBrowser.go(idAddress.origin);
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    michaelsBrowser.disableRateLimits();
  });

  it("... finds the chat topic in the watchbar, opens it", () => {
    michaelsBrowser.watchbar.goToTopic(chatTopicTitle);
  });

  it("Owen and Michael exchange a few messages", () => {
    owensBrowser.chat.addChatMessage(owensFirstMessage);
    michaelsBrowser.chat.addChatMessage(michaelsFirstMessage);
    owensBrowser.chat.addChatMessage(owensSecondMessage);
    michaelsBrowser.chat.addChatMessage(michaelsSecondMessage);
  });

  it("... they see each other's messages", () => {
    //everyone.chat.waitForNumMessages(4);
    owensBrowser.chat.waitForNumMessages(4);
    michaelsBrowser.chat.waitForNumMessages(4);
  });

  it("Michael can find the topic by searching", () => {
    // Might not be found instantly, perhaps hasn't yet been indexed.
    michaelsBrowser.topbar.searchFor(wontBeFoundWord);
    michaelsBrowser.searchResultsPage.assertPhraseNotFound(wontBeFoundWord);
    michaelsBrowser.searchResultsPage.searchForUntilNumPagesFound(coolWord, 1);
  });


  // Strangers get no access
  // -------------------------------------

  it("Owen leaves, a stranger arrives", () => {
    owensBrowser.topbar.clickLogout({ waitForLoginButton: false });
    assert(strangersBrowser === owensBrowser);
  });

  it("The stranger won't see the topic in the topic list", () => {
    strangersBrowser.go(idAddress.origin);
    strangersBrowser.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... won't find the topic via search", () => {
    strangersBrowser.topbar.searchFor(coolWord);
    strangersBrowser.searchResultsPage.assertPhraseNotFound(coolWord);
  });

  it("... cannot access via direct link", () => {
    strangersBrowser.go(topicUrl);
    strangersBrowser.assertNotFoundError();
  });


  // Guests get no access
  // -------------------------------------

  it("A guest logs in", () => {
    assert(guestsBrowser === strangersBrowser);
    guestsBrowser.go(idAddress.origin);
    guestsBrowser.complex.signUpAsGuestViaTopbar(guest);
  });

  it("... and won't see the topic in the topic list", () => {
    guestsBrowser.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... won't find the topic via search", () => {
    guestsBrowser.topbar.searchFor(coolWord);
    guestsBrowser.searchResultsPage.assertPhraseNotFound(coolWord);
  });

  it("... cannot access via direct link", () => {
    guestsBrowser.go(topicUrl);
    guestsBrowser.assertNotFoundError();
  });

  it("The guest leaves", () => {
    guestsBrowser.go(idAddress.origin);
    guestsBrowser.topbar.clickLogout({ waitForLoginButton: false });
  });


  // Admins see everything
  // -------------------------------------

  it("Admin Alice logs in", () => {
    assert(alicesBrowser === guestsBrowser);
    alicesBrowser.go(idAddress.origin);
    alicesBrowser.complex.loginWithPasswordViaTopbar(alice);
  });

  it("... she can search and find the topic", () => {
    alicesBrowser.topbar.searchFor(coolWord);
    alicesBrowser.searchResultsPage.waitForAssertNumPagesFound(coolWord, 1);
  });

  it("... and she can access the page", () => {
    alicesBrowser.go(topicUrl);
    alicesBrowser.pageTitle.assertMatches(chatTopicTitle);
    alicesBrowser.chat.waitForNumMessages(4);
  });

  it("Alice leaves", () => {
    alicesBrowser.topbar.clickLogout({ waitForLoginButton: false });
  });


  // Mallory gets no access
  // -------------------------------------

  it("Mallory logs in", () => {
    assert(mallorysBrowser === alicesBrowser);
    mallorysBrowser.go(idAddress.origin);
    mallorysBrowser.complex.loginWithPasswordViaTopbar(mallory);
  });

  it("... he won't see the topic in the topic list", () => {
    mallorysBrowser.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... and cannot search and find the topic", () => {
    mallorysBrowser.topbar.searchFor(coolWord);
    mallorysBrowser.searchResultsPage.assertPhraseNotFound(coolWord);
  });

  it("... and cannot access it via direct link", () => {
    mallorysBrowser.go(topicUrl);
    mallorysBrowser.assertNotFoundError();
  });

});

