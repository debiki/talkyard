/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
// import fs = require('fs');  EMBCMTS
import server = require('../utils/server');
import utils = require('../utils/utils');
import make = require('../utils/make');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let everyonesBrowsers: TyAllE2eTestBrowsers;
let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let merche: Member;
let merche_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoPagesTestForum;

const pubSupportChatTitle = 'pubSupportChatTitle';
const pubSupportChatAbout = 'pubSupportChatAbout';
const fullMembersOnlyChatTitle = 'fullMembersOnlyChatTitle';
const fullMembersOnlyChatAbout = 'fullMembersOnlyChatAbout';
const fullMembersOnly2ndChatTitle = 'fullMembersOnly2ndChatTitle';
const fullMembersOnly2ndChatAbout = 'fullMembersOnly2ndChatAbout';
const merchesMessage = 'crickets not clever, bees be brighter';

const merchesMessageAboutOwls = 'owls uuuh ugly';
const wordsOfWisdom = 'cats crave cream';

const mentionMerche = '@merche';



describe(`promote-demote-by-staff-join-leave-chats.2br  TyTE2E5H3GFRVK`, () => {

  it(`construct site`, () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
      members: ['owen', 'maria', 'michael'],
    });

    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owen_brA = richBrowserA;

    merche = make.memberMerche();
    merche_brB = richBrowserB;

    // So Maria gets notified about Owen's message in the full-members-only chat.
    forum.members.maria.trustLevel = c.TestTrustLevel.FullMember;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  
  it(`Owen logs in`, () => {
    owen_brA.go2(site.origin);
    owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });


  it(`... creates a public support chat channel in Category A (the default)`, () => {
    owen_brA.complex.createAndSaveTopic({
          title: pubSupportChatTitle, body: pubSupportChatAbout,
          type: c.TestPageRole.OpenChat });
  });
  it(`... joins it`, () => {
    owen_brA.chat.joinChat();
  });
  it(`... pins it globally`, () => {
    owen_brA.topbar.pageTools.pinPage('Globally', { willBeTipsAfter: true });
  });
  

  
  it(`Owen goes to the Specific Category`, () => {
    owen_brA.go2('/latest/' + forum.categories.specificCategory.slug);
  });
  it(`... makes it accessible to Full Members only`, () => {
    owen_brA.forumButtons.clickEditCategory();
    owen_brA.categoryDialog.openSecurityTab();
    owen_brA.categoryDialog.securityTab.switchGroupFromTo(
          c.EveryoneFullName, c.FullMembersFullName);
    owen_brA.categoryDialog.submit();
  });


  it(`Owen creates a Full Members-only chat channel`, () => {
    owen_brA.complex.createAndSaveTopic({
          title: fullMembersOnlyChatTitle, body: fullMembersOnlyChatAbout,
          type: c.TestPageRole.OpenChat });
  });
  it(`... joins it`, () => {
    owen_brA.chat.joinChat();
  });
  it(`... pins it globally`, () => {
    owen_brA.topbar.pageTools.pinPage('Globally', { willBeTipsAfter: false });
  });

  let fullMembersChat2Url = '';

  it(`... creates another full-members-only chat channel`, () => {
    owen_brA.go2('/latest/' + forum.categories.specificCategory.slug);
    owen_brA.complex.createAndSaveTopic({
          title: fullMembersOnly2ndChatTitle, body: fullMembersOnly2ndChatAbout,
          type: c.TestPageRole.OpenChat });
    fullMembersChat2Url = owen_brA.urlPath();
  });


  it(`Merche arrives, she hasn't yet joined the site`, () => {
    merche_brB.go2(site.origin);
  });
  it(`... sees the public chat in the watchbar — it's public`, () => {
    merche_brB.watchbar.assertTopicVisible(pubSupportChatTitle);
  });
  it(`... but not the full members only chat`, () => {
    merche_brB.watchbar.assertTopicAbsent(fullMembersOnlyChatTitle);
    merche_brB.watchbar.asserExactlyNumTopics(2);  // home link + support chat
  });


  it(`Merche joins the site`, () => {
    merche_brB.complex.signUpAsMemberViaTopbar(merche);
  });
  it("... verifies her email", function() {
    const url = server.getLastVerifyEmailAddressLinkEmailedTo(
            site.id, merche.emailAddress);
    merche_brB.go2(url);
    merche_brB.hasVerifiedSignupEmailPage.clickContinue();
  });


  it(`Merche goes to the support chat — it's pinned, is in the watchbar`, () => {
    merche_brB.watchbar.goToTopic(pubSupportChatTitle);
  });

  it(`... joins it`, () => {
    merche_brB.chat.joinChat();
  });


  it(`Merche posts a chat message`, () => {
    merche_brB.chat.addChatMessage(merchesMessage);
  });
  it(`... the chat topic gets highlighted in Owen's watchbar`, () => {
    owen_brA.watchbar.waitUntilNumUnreadTopics(1);
  });
  it(`... so Owen opens that chat topic`, () => {
    owen_brA.watchbar.goToTopic(pubSupportChatTitle, { shouldBeUnread: true });
  });
  it(`Owen sees it`, () => {
    owen_brA.chat.waitForNumMessages(1);
  });

  it(`Owen replies, mentions Merche`, () => {
    owen_brA.chat.addChatMessage(`Wow I never thought about that ` + mentionMerche);
  });
  it(`Merche gets notified about Owen's mention`, () => {   // ttt
    server.waitUntilLastEmailMatches(
          site.id, merche.emailAddress, mentionMerche);
  });


  it(`It's such a good chat message, so Owen changes Merche's trust level to Full Member`,
        () => {
    owen_brA.adminArea.user.viewUser(merche.username);
    owen_brA.adminArea.user.setTrustLevel(c.TestTrustLevel.FullMember);
  });


  it(`... Merche now sees the full members chat — but only the pinned chat`, () => {
    merche_brB.refresh2();
    merche_brB.watchbar.assertTopicVisible(fullMembersOnlyChatTitle);
    // Home link + support chat + full members pinned chat = 3.
    merche_brB.watchbar.asserExactlyNumTopics(3);
  });

  // TESTS_MISSING verify Merche is now in the chat pats list (in the right sidebar).

  it(`Merche goes there`, () => {
    merche_brB.watchbar.goToTopic(fullMembersOnlyChatTitle);
  });
  it(`... joins`, () => {
    merche_brB.chat.joinChat();
  });
  it(`... posts a chat message`, () => {
    merche_brB.chat.addChatMessage(merchesMessageAboutOwls);
  });

  it(`Merche also opens the 2nd full-members-only chat in a 2nd tab`, () => {
    merche_brB.newWindow(fullMembersChat2Url, 'StayInCurWin');
  });


  let chatUrl: St | U;

  it(`Owen goes to that first chat topic, via the watchbar link`, () => {
    owen_brA.watchbar.openIfNeeded();
    owen_brA.watchbar.goToTopic(fullMembersOnlyChatTitle, { shouldBeUnread: true });
  });
  it(`Owen reads the message — and gets upset: he identifies with owls,
          his name starting with "Ow" just like in "Owl"`, () => {
    owen_brA.chat.waitForNumMessages(1);
    chatUrl = owen_brA.getUrl();
  });


  it(`Owen lowers Merche's trust level back to New Member, by unlocking  TyTE2ELWRTRU38`,
        () => {
    owen_brA.adminArea.user.viewUser(merche.username);
    owen_brA.adminArea.user.unlockTrustLevel();
  });

  // TESTS_MISSING verify Merche gone from the chat pats list.

  // Merche got 1 verify-email-addr email and one @mention notf.
  // Owen got two notf emails/ about Merche's chat messages.
  const numEmailsToMercheAndOwen = 2 + 2;

  it(`Owen has gotten two notf emails about Merche's chat messages`, () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(site.id);
    assert.equal(num, numEmailsToMercheAndOwen, `Emails sent to: ${addrsByTimeAsc}`);
  });



  it(`Owen posts a message, mentions Merche`, () => {
    owen_brA.go2(chatUrl);
    owen_brA.chat.addChatMessage("That's not an ok thing to write, " + mentionMerche);
  });
  it(` ... posts another message, mentions Maria`, () => {
    owen_brA.chat.addChatMessage("@maria owls are clever and good looking, right");
  });


  // Do inbetween, so the notf email to Maria has time to arrive:
  it(`Merche tries to post more words of wisdom`, () => {
    merche_brB.chat.addChatMessage(wordsOfWisdom);
  });
  it(`... but there's an error`, () => {
    merche_brB.serverErrorDialog.waitAndAssertTextMatches(
          c.serverErrorCodes.notFound,
          c.serverErrorCodes.mayNotReplyBecauseMayNotSee);
  });


  it(`Maria gets notified about Owen's message (she's a full member)`, () => {
    server.waitUntilLastEmailMatches(
          site.id, forum.members.maria.emailAddress, 'owls are clever');
  });

  it(`But not Merche — she no longer has access to the full members chat`, () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(site.id);
    assert.equal(num, numEmailsToMercheAndOwen + 1, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it(`Now Merche cannot access the full members chat`, () => {
    merche_brB.refresh2();
    merche_brB.notFoundDialog.waitAndAssertErrorMatches(
          c.serverErrorCodes.notFound,
          c.serverErrorCodes.mayNotSee);
  });

  it(`... she follows the "go to homepage" link`, () => {
    merche_brB.notFoundDialog.clickHomeLink();
  });


  it(`Merche sees the public support chat in the watchbar`, () => {
    merche_brB.watchbar.assertTopicVisible(pubSupportChatTitle);
  });
  it(`... but not the pinned full members chat`, () => {
    merche_brB.watchbar.assertTopicAbsent(fullMembersOnlyChatTitle);
  });
  it(`... however currently the other full members chat is still there`, () => {
    // UX COULD remove this other now may-not-see chat too from the watchbar
    // [demoted_rm_all_chats].
    merche_brB.watchbar.assertTopicVisible(fullMembersOnly2ndChatTitle);
    merche_brB.watchbar.asserExactlyNumTopics(3);
  });


  it(`But Merche switches to her 2nd window, still open, with the 2nd chat`, () => {
    merche_brB.swithToOtherTabOrWindow();
  });

  it(`... and tries to join — although may not see the chat  TyT502RKTJF4`, () => {
    merche_brB.chat.joinChat();
  });

  it(`... but there's an error`, () => {
    merche_brB.serverErrorDialog.waitAndAssertTextMatches(
          c.serverErrorCodes.notFound,
          c.serverErrorCodes.mayNotJoinChatBecauseMayNotSee);
  });

  it(`Merche cannot see the page at all, after reloading the page`, () => {
    merche_brB.refresh2();
    merche_brB.notFoundDialog.waitAndAssertErrorMatches(
          c.serverErrorCodes.notFound,
          c.serverErrorCodes.mayNotSee);
  });


});

