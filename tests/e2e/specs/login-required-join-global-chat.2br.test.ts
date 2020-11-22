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
let maria: Member;
let merche: Member;
let merche_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: EmptyTestForum;

const mentionMerche = '@merche';

const supportChatTitle = 'Helpful Help Chat';
const supportChatAbout = 'Get help or not';



describe(`login-required-join-global-chat.2br  TyTE2E603MAT53`, () => {

  it(`construct site`, () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "Some E2E Test",
      members: ['owen', 'maria'],
    });

    builder.settings({
      userMustBeAuthenticated: true,
    });

    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owen_brA = richBrowserA;

    maria = forum.members.maria;

    merche = make.memberMerche();
    merche_brB = richBrowserB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Owen logs in`, () => {
    owen_brA.go2(site.origin);
    owen_brA.loginDialog.loginWithPassword(owen);
  });


  it(`Owen creates a support chat channel`, () => {
    owen_brA.complex.createAndSaveTopic({
          title: supportChatTitle, body: supportChatAbout,
          type: c.TestPageRole.OpenChat });
  });
  it(`... joins it`, () => {
    owen_brA.chat.joinChat();
  });
  it(`... pins it globally`, () => {
    owen_brA.topbar.pageTools.pinPage('Globally', { willBeTipsAfter: true });
  });


  it(`Merche arrives`, () => {
    merche_brB.go2(site.origin);
  });
  it(`... signs up`, () => {
    merche_brB.loginDialog.createPasswordAccount(merche);
  });
  it("... verifies her email", function() {
    const url = server.getLastVerifyEmailAddressLinkEmailedTo(
            site.id, merche.emailAddress);
    merche_brB.go2(url);
    merche_brB.hasVerifiedSignupEmailPage.clickContinue();
  });


  it(`... goes to the support chat — since it's pinned, it's in the watchbar`, () => {
    merche_brB.watchbar.goToTopic(supportChatTitle);
  });

  it(`... joins it`, () => {
    merche_brB.chat.joinChat();
  });


  it(`Merche posts a chat message`, () => {
    merche_brB.chat.addChatMessage(`I found a homeless rabbit, where does it live?`);
  });
  it(`Owen sees it and replies`, () => {
    owen_brA.chat.waitForNumMessages(1);
    owen_brA.chat.addChatMessage(`In the trees in the forrest, ${mentionMerche}`);
  });
  it(`Merche gets an email notf`, () => {  // ttt
    server.waitUntilLastEmailMatches(site.id, merche.emailAddress, mentionMerche);
  });
  it(`... and sees the reply`, () => {
    merche_brB.chat.waitForNumMessages(2);
  });



  // ----- Cannot access chat if suspended


  it(`Owen suddenly suspends Merche`, () => {
    owen_brA.adminArea.user.viewUser(merche);
    owen_brA.adminArea.user.suspendUser({ days: 1, reason: "Wait a second" });
  });


  it(`Owen returns to the chat`, () => {
    owen_brA.watchbar.openIfNeeded();
    owen_brA.watchbar.goToTopic(supportChatTitle);
  });

  // Merche got one verify-email-addr email,
  // Owen got one chat message notf email,
  // and Merche got one @mention notf.
  let numEmailsSent = 1 + 1 + 1;

  it(`Three emails sent this far`, () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(site.id);
    assert.equal(num, numEmailsSent, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it(`Owen posts another message: mentions @merche`, () => {
    owen_brA.chat.addChatMessage(`Wait wait ${mentionMerche}`);
    numEmailsSent += 0; // no email sent
  });

  it(`... another to @maria`, () => {
    owen_brA.chat.addChatMessage(`Can rabbits climb trees, @${maria.username
          }? Or jump up into trees?`);
    numEmailsSent += 1;
  });


  it(`Maria gets a @mention email notf`, () => {
    server.waitUntilLastEmailMatches(
          site.id, forum.members.maria.emailAddress, `rabbits climb`);
  });
  it(`... but not Merche, she is suspended`, () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(site.id);
    assert.equal(num, numEmailsSent, `Emails sent to: ${addrsByTimeAsc}`);
  });


  it(`Merche did *not* get a live notf chat message — she's suspended`, () => {
    merche_brB.chat.waitForNumMessages(2, 'Exactly');
  });


  it(`Merche tires to send a helpful message`, () => {
    merche_brB.chat.addChatMessage(
          `Can you help me throw the rabbit back up into a tree?`);
  });

  it(`... but there's an Account Suspended error`, () => {
    merche_brB.serverErrorDialog.waitAndAssertTextMatches(
          // One of these — there's a race: (maybe fix? try make deterministic?)
          c.serverErrorCodes.accountSuspended + '|' +
          c.serverErrorCodes.notAuthenticated);
  });


  it(`Merche reloads the page — sees the login dialog, tries to log in`, () => {
    merche_brB.refresh2();
    merche_brB.loginDialog.loginWithPassword(merche, { resultInError: true });
  });

  it(`... but account suspended`, () => {
    merche_brB.serverErrorDialog.waitAndAssertTextMatches(
          'suspended until.*' + c.serverErrorCodes.accountSuspended2);
  });


});

