/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';

let everyone: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let alice: Member;
let alicesBrowser: TyE2eTestBrowser;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;
let mallory: Member;
let mallorysBrowser: TyE2eTestBrowser;
let guest;
let guestsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
const forumTitle = "Priv Chat Forum";

const chatTopicTitle = "Chat Topic Title";
const chatTopicPurpose = "The purpose is to chat";
let topicUrl: St;

const coolWord = 'cool';
const wontBeFoundWord = "wont_be_found";

const owensFirstMessage = "Hi let's chat!";
const michaelsFirstMessage = `Ok ${coolWord} yes let's do that. Hello hello`;
const owensSecondMessage = "Hello hello. Hello!";
const michaelsSecondMessage = "Well yea. Bye for now then!";


describe("search-private-chat.2br  TyTSEARCHPRIVCHAT", () => {

  it("initialize people", async () => {
    everyone = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = make.memberOwenOwner();
    alice = make.memberAdminAlice();
    michael = make.memberMichael();
    mallory = make.memberMallory();
    guest = make.guestGunnar();
    michaelsBrowser = brA;
    owensBrowser = brB;
    // Reuse the same browser.
    mallorysBrowser = owensBrowser;
    alicesBrowser = owensBrowser;
    guestsBrowser = owensBrowser;
    strangersBrowser = owensBrowser;
  });

  it("import a site", async () => {
    let site: SiteData = make.forumOwnedByOwen('search-priv-chat', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;
    site.settings.mayPostBeforeEmailVerified = true;
    site.members.push(alice);
    site.members.push(mallory);
    site.members.push(michael);
    idAddress = await server.importSiteData(site);
  });


  // Owen and Michael chats
  // -------------------------------------

  it("Owen goes to the homepage and log in", async () => {
    await owensBrowser.go2(idAddress.origin);
    await owensBrowser.assertPageTitleMatches(forumTitle);
    await owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    owensBrowser.disableRateLimits();
  });

  it("Owen creates a private chat", async () => {
    await owensBrowser.complex.createChatChannelViaWatchbar({
        name: chatTopicTitle, purpose: chatTopicPurpose, public_: false });
    topicUrl = await owensBrowser.getUrl();
  });

  it("... and adds Michael", async () => {
    await owensBrowser.watchbar.clickViewPeople();
    await owensBrowser.complex.addPeopleToPageViaContextbar([michael.username]);
  });

  it("Michael logs in", async () => {
    await michaelsBrowser.go2(idAddress.origin);
    await michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    michaelsBrowser.disableRateLimits();
  });

  it("... finds the chat topic in the watchbar, opens it", async () => {
    await michaelsBrowser.watchbar.goToTopic(chatTopicTitle);
  });

  it("Owen and Michael exchange a few messages", async () => {
    await owensBrowser.chat.addChatMessage(owensFirstMessage);
    await michaelsBrowser.chat.addChatMessage(michaelsFirstMessage);
    await owensBrowser.chat.addChatMessage(owensSecondMessage);
    await michaelsBrowser.chat.addChatMessage(michaelsSecondMessage);
  });

  it("... they see each other's messages", async () => {
    //everyone.chat.waitForNumMessages(4);
    await owensBrowser.chat.waitForNumMessages(4);
    await michaelsBrowser.chat.waitForNumMessages(4);
  });

  it("Michael can find the topic by searching", async () => {
    // Might not be found instantly, perhaps hasn't yet been indexed.
    await michaelsBrowser.topbar.searchFor(wontBeFoundWord);
    await michaelsBrowser.searchResultsPage.assertPhraseNotFound(wontBeFoundWord);
    await michaelsBrowser.searchResultsPage.searchForUntilNumPagesFound(coolWord, 1);
  });


  // Strangers get no access
  // -------------------------------------

  it("Owen leaves, a stranger arrives", async () => {
    await owensBrowser.topbar.clickLogout({ waitForLoginButton: false });
    assert.eq(strangersBrowser, owensBrowser);
  });

  it("The stranger won't see the topic in the topic list", async () => {
    await strangersBrowser.go2(idAddress.origin);
    await strangersBrowser.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... won't find the topic via search", async () => {
    await strangersBrowser.topbar.searchFor(coolWord);
    await strangersBrowser.searchResultsPage.assertPhraseNotFound(coolWord);
  });

  it("... cannot access via direct link", async () => {
    await strangersBrowser.go2(topicUrl);
    await strangersBrowser.assertNotFoundError();
  });


  // Guests get no access
  // -------------------------------------

  it("A guest logs in", async () => {
    assert.eq(guestsBrowser, strangersBrowser);
    await guestsBrowser.go2(idAddress.origin);
    await guestsBrowser.complex.signUpAsGuestViaTopbar(guest);
  });

  it("... and won't see the topic in the topic list", async () => {
    await guestsBrowser.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... won't find the topic via search", async () => {
    await guestsBrowser.topbar.searchFor(coolWord);
    await guestsBrowser.searchResultsPage.assertPhraseNotFound(coolWord);
  });

  it("... cannot access via direct link", async () => {
    await guestsBrowser.go2(topicUrl);
    await guestsBrowser.assertNotFoundError();
  });

  it("The guest leaves", async () => {
    await guestsBrowser.go2(idAddress.origin);
    await guestsBrowser.topbar.clickLogout({ waitForLoginButton: false });
  });


  // Admins see everything
  // -------------------------------------

  it("Admin Alice logs in", async () => {
    assert.eq(alicesBrowser, guestsBrowser);
    await alicesBrowser.go2(idAddress.origin);
    await alicesBrowser.complex.loginWithPasswordViaTopbar(alice);
  });

  it("... she can search and find the topic", async () => {
    await alicesBrowser.topbar.searchFor(coolWord);
    await alicesBrowser.searchResultsPage.waitForAssertNumPagesFound(coolWord, 1);
  });

  it("... and she can access the page", async () => {
    await alicesBrowser.go2(topicUrl);
    await alicesBrowser.pageTitle.assertMatches(chatTopicTitle);
    await alicesBrowser.chat.waitForNumMessages(4);
  });

  it("Alice leaves", async () => {
    await alicesBrowser.topbar.clickLogout({ waitForLoginButton: false });
  });


  // Mallory gets no access
  // -------------------------------------

  it("Mallory logs in", async () => {
    assert.eq(mallorysBrowser, alicesBrowser);
    await mallorysBrowser.go2(idAddress.origin);
    await mallorysBrowser.complex.loginWithPasswordViaTopbar(mallory);
  });

  it("... he won't see the topic in the topic list", async () => {
    await mallorysBrowser.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... and cannot search and find the topic", async () => {
    await mallorysBrowser.topbar.searchFor(coolWord);
    await mallorysBrowser.searchResultsPage.assertPhraseNotFound(coolWord);
  });

  it("... and cannot access it via direct link", async () => {
    await mallorysBrowser.go2(topicUrl);
    await mallorysBrowser.assertNotFoundError();
  });

});

