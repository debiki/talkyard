/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let brC: TyE2eTestBrowser;

let owen;
let michael;
let maria;
let memberAlice;
let alicesBrowser: TyE2eTestBrowser;
let stranger;

let idAddress;
let forumTitle = "Forum with Private Chat";
let messageUrl;
let messageTitle = "Message title";
let messageText = "Hi I have a question";
let owensAnswer = "Yes what is it?";
let mariasQuestion = "Can I ask questions?";
let owensQuestionAnswer = "Yes if the number of questions is a prime number. 2, 3, 5, 7, 11 you know.";
let mariasOwnOpReply = "Hmm, myself, let me think";

const mariasQuestionSearchQuery = "ask questions";

let siteId;


/// Tests private chat direct message notifications.
///
describe(`direct-messages-notfs.3br.d  TyT602RKDL42`, () => {

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    brC = new TyE2eTestBrowser(wdioBrowserC, 'brC');

    owen = _.assign(brA, make.memberOwenOwner());
    michael = _.assign(brB, make.memberMichael());
    maria = _.assign(brC, make.memberMaria());
    // Let's reuse the same browser.
    alicesBrowser = maria;
    stranger = michael;
  });

  it("import a site", async () => {
    let site: SiteData = make.forumOwnedByOwen('formal-priv-msg', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;

    const owen = site.members[0];
    assert.eq(owen.username, 'owen_owner');
    owen.emailNotfPrefs = c.TestEmailNotfPrefs.ReceiveAlways;  // [6029WKHU4]

    memberAlice = make.memberAdminAlice();
    site.members.push(memberAlice);
    site.members.push(make.memberMichael());
    site.members.push(make.memberMaria({
      emailNotfPrefs: c.TestEmailNotfPrefs.ReceiveAlways, // [6029WKHU4]
    }));
    idAddress = await server.importSiteData(site);
    siteId = idAddress.id;
  });


  // Generate private message discussion
  // ------------------------------------------------------

  it("Maria opens Owen's user page", async () => {
    await maria.userProfilePage.openActivityFor(owen.username, idAddress.origin);
    //await maria.assertPageTitleMatches(forumTitle);
    await maria.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... sends a formal private message", async () => {
    await maria.userProfilePage.clickSendMessage();
    await maria.editor.editTitle(messageTitle);
    await maria.editor.editText(messageText);
    await maria.editor.saveWaitForNewPage();
    await maria.assertPageTitleMatches(messageTitle);
    await maria.assertPageBodyMatches(messageText);
    messageUrl = await maria.getUrl();
  });

  it("Owen logs in", async () => {
    await owen.go2(idAddress.origin);
    await owen.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... he doesn't see the message in the topic list", async () => {
    await owen.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... but sees a notification", async () => {
    await owen.topbar.assertNotfToMe();
  });

  it("... opens the message via the notf icon", async () => {
    await owen.topbar.openNotfToMe();
  });

  it("... and replies", async () => {
    await owen.complex.replyToOrigPost(owensAnswer);
    await owen.topic.waitForPostNrVisible(c.FirstReplyNr);
  });

  it("... he also got an email notf about this new topic", async () => {
    // This tests notfs when one clicks the append-bottom-comment button.
    await server.waitUntilLastEmailMatches(
        siteId, owen.emailAddress, [messageTitle, messageText], browser);
  });

  it("Maria sees the reply", async () => {
    await maria.topic.waitForPostAssertTextMatches(c.FirstReplyNr, owensAnswer);
  });

  it("... and replies", async () => {
    await maria.complex.replyToPostNr(2, mariasQuestion);
    await maria.topic.waitForPostAssertTextMatches(3, mariasQuestion);
  });

  it("... she got a notification, dismisses it", async () => {
    await maria.topbar.openNotfToMe();
  });

  it("... she got a notf email too", async () => {
    await server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, [messageTitle, owensAnswer], browser);
  });

  it("... goes to another page", async () => {
    await maria.go2('/');
  });

  it("Owen sees Maria reply", async () => {
    await owen.topic.waitForPostAssertTextMatches(3, mariasQuestion);
  });

  it("... and replies", async () => {
    await owen.complex.addProgressReply(owensQuestionAnswer);
    await owen.topic.waitForPostNrVisible(4);
  });

  it("... he also got an email about Maria's reply", async () => {
    // This tests notfs when one replies to a particular post.

    // This can break, unless Owen always gets notified via email,
    // also about replies he has seen already.
    // That's configured for this test, here: [6029WKHU4].
    //
    // (He's looking at the page where Maria's reply appears, so normally
    // he wouldn't get notified via email since the browser notices
    // that he has read it already.)

    await server.waitUntilLastEmailMatches(
        siteId, owen.emailAddress, [messageTitle, mariasQuestion], browser);
  });

  it("Maria gets an email with Owen's reply", async () => {
    // This tests notfs when one clicks the append-bottom-comment button.
    // TESTS_MISSING No? Instead, should  be Maria that clicks append-bottom to Owen because
    // Maria is the orig-poster, she'll always get a notf, everything is a reply to her.
    await server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, [messageTitle, owensQuestionAnswer], browser);
  });

  it("... and she gets an in-browser notifiction too, opens it", async () => {
    await maria.topbar.openNotfToMe();
  });

  it("... she sees the question answer", async () => {
    await maria.topic.waitForPostAssertTextMatches(4, owensQuestionAnswer);
  });


  // All page members get notified about replies
  // ------------------------------------------------------

  // Also if they aren't replied to or mentioned explicitly.

  it("Maria replies to the Orig Post — that's *not* Owen's post", async () => {
    await maria.complex.replyToOrigPost(mariasOwnOpReply);
    await maria.topic.waitForPostAssertTextMatches(5, mariasOwnOpReply);
  });

  it("... Owen gets notified, because he's a page member", async () => {
    await server.waitUntilLastEmailMatches(
        siteId, owen.emailAddress, [messageTitle, mariasOwnOpReply], browser);
  });


  // Strangers have no access
  // ------------------------------------------------------

  it("A stranger doesn't see the topic in the forum topic list", async () => {
    await stranger.go2(idAddress.origin);
    await stranger.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... and the stranger won't find it when searching", async () => {
    await stranger.topbar.searchFor(mariasQuestionSearchQuery);
    await stranger.searchResultsPage.assertPhraseNotFound(mariasQuestionSearchQuery);
  });

  it("... and cannot accesss it via a direct link", async () => {
    await stranger.go2(messageUrl);
    await stranger.assertNotFoundError();
  });


  // Other members have no access
  // ------------------------------------------------------

  it("Michael logs in", async () => {
    assert.refEq(michael, stranger);
    await michael.go2(idAddress.origin);
    await michael.complex.loginWithPasswordViaTopbar(michael);
  });


  it("Michael cannot access the topic, doesn't see the topic in the forum topic list", async () => {
    await michael.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... not even after a refresh", async () => {
    await michael.refresh2();
    await michael.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... and cannot access via direct link", async () => {
    await michael.go2(messageUrl);
    await michael.assertNotFoundError();
  });

  it("... and does not see it in his profile page, the messages section", async () => {
    await michael.userProfilePage.openNotfsFor(michael.username, idAddress.origin);
    await michael.userProfilePage.notfs.waitUntilKnowsIsEmpty();
  });

  it("... and does not see it in the watchbar", async () => {
    await michael.watchbar.openIfNeeded();
    await michael.watchbar.asserExactlyNumTopics(1); // the forum, but no priv-message
  });

  it("... and won't find it when searching", async () => {
    await michael.topbar.searchFor(mariasQuestionSearchQuery);
    await michael.searchResultsPage.assertPhraseNotFound(mariasQuestionSearchQuery);
  });


  // The participants have access
  // ------------------------------------------------------

  it("Maria also doesn't see it listed in the forum", async () => {
    await maria.go2(idAddress.origin);
    await maria.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... but she can access it via a direct link", async () => {
    await maria.go2(messageUrl);
    await maria.waitForMyDataAdded();
    await maria.assertPageTitleMatches(messageTitle);
    await maria.assertPageBodyMatches(messageText);
  });

  it("... and via her profile page, the messages section", async () => {
    await maria.userProfilePage.openNotfsFor(maria.username, idAddress.origin);
    await maria.userProfilePage.notfs.waitUntilSeesNotfs();
    await maria.userProfilePage.notfs.openPageNotfWithText(messageTitle);
    await maria.waitForMyDataAdded();
    await maria.assertPageTitleMatches(messageTitle);
    await maria.assertPageBodyMatches(messageText);
  });

  it("... and via the watchbar", async () => {
    await maria.go2(idAddress.origin);
    await maria.watchbar.openIfNeeded();
    await maria.watchbar.asserExactlyNumTopics(2); // forum + priv-message
    await maria.watchbar.assertTopicVisible(messageTitle);
    await maria.watchbar.goToTopic(messageTitle);
    await maria.assertPageTitleMatches(messageTitle);
    await maria.assertPageBodyMatches(messageText);
  });

  it("... and search for it and find it", async () => {
    await maria.topbar.searchFor(mariasQuestionSearchQuery);
    await maria.searchResultsPage.waitForAssertNumPagesFound(mariasQuestionSearchQuery, 1);
  });


  // Cannot access after logged out
  // ------------------------------------------------------

  it("Maria logs out", async () => {
    await maria.topbar.clickLogout(
        // Needed because of a bug in Chrome? Chromedriver? Selenium? Webdriver.io? [E2EBUG]
        // Without, there's a stale-elem-exception for a totally unrelated elem:
        { waitForLoginButton: false });
  });

  it("... and can access the priv message no more, not in the topic list", async () => {
    await maria.go2(idAddress.origin);
    await maria.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("not in the watchbar", async () => {
    await maria.watchbar.openIfNeeded();
    // [E2EBUG] failed:
    // FAIL: AssertionError: Selector '.esWB_T_Title' matches 2 elems, but there should be exactly 1
    // ... but this didn't break the test suite :-/  could look into this later... seems harmless.
    await maria.watchbar.asserExactlyNumTopics(1); // the forum, but no priv-message
  });

  it("not via direct link", async () => {
    await maria.go2(messageUrl);
    await maria.assertNotFoundError();
  });

  it("not via profile page", async () => {
    await maria.userProfilePage.openNotfsFor(maria.username, idAddress.origin);
    await maria.userProfilePage.waitForBadRoute();
  });

  it("not when searching", async () => {
    await maria.topbar.searchFor(mariasQuestionSearchQuery);
    await maria.searchResultsPage.assertPhraseNotFound(mariasQuestionSearchQuery);
  });


  // Admins can access the topic
  // ------------------------------------------------------

  it("Alice logs in", async () => {
    assert.refEq(alicesBrowser, maria); // same browser
    await alicesBrowser.complex.loginWithPasswordViaTopbar(memberAlice);
  });

  it("... finds the topic when searching", async () => {
    await alicesBrowser.topbar.searchFor(mariasQuestionSearchQuery);
    await alicesBrowser.searchResultsPage.waitForAssertNumPagesFound(mariasQuestionSearchQuery, 1);
  });

  it("... can click link and see it", async () => {
    await alicesBrowser.searchResultsPage.goToSearchResult();
    await alicesBrowser.assertPageTitleMatches(messageTitle);
    await alicesBrowser.assertPageBodyMatches(messageText);
  });

  it("... sees it in Maria's notf section", async () => {
    await alicesBrowser.userProfilePage.openNotfsFor(maria.username, idAddress.origin);
    await alicesBrowser.userProfilePage.notfs.waitUntilSeesNotfs();
    await alicesBrowser.userProfilePage.notfs.openPageNotfWithText(messageTitle);
    await alicesBrowser.waitForMyDataAdded();
    await alicesBrowser.assertPageTitleMatches(messageTitle);
    await alicesBrowser.assertPageBodyMatches(messageText);
  });


  /*
  it("Owen also doesn't see it listed in the forum", async () => {
    owen.debug();
    await owen.go2(idAddress.origin);
    await owen.forumTopicList.waitUntilKnowsIsEmpty();
  });

  it("... but he too can access it via a direct link", async () => {
  });

  it("... and via his profile page, the messages section", async () => {
  });

  it("Michael leaves, a guest logs in", async () => {
  });

  it("The guest doesn't see the topic in the topic list", async () => {
  });

  it("... and cannot access it via a direct link", async () => {
  });
  */

});

