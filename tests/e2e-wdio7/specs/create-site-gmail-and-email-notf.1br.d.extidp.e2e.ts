/// <reference path="../test-types.ts"/>

import server from '../utils/server';
import * as utils from '../utils/utils';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { NewSiteOwnerType } from '../test-constants';

let browser: TyE2eTestBrowser;

const newMembersEmail = 'e2e-test--mia@example.com';
const newMembersTopicTitle = 'newMembersTopicTitle';
const newMembersTopicText = 'newMembersTopicText';


describe('create-site-gmail-and-email-notf.1br.d.extidp  @createsite  @login @gmail TyT7KKTEHS24', () => {

  if (!settings.include3rdPartyDependentTests) {
    console.log("Skipping this spec; no 3rd party login credentials specified.");
    return;
  }

  it('initialize', async () => {
    browser = new TyE2eTestBrowser(wdioBrowserA, 'brA');
  });


  addCreateSiteWithGmailTestSteps({ alreadyLoggedIn: false });


  it('can actually use the Gmail admin account to create stuff', async () => {
    await browser.complex.createAndSaveTopic({ title: "Gmail topic title", body: "Body" });
    await browser.topbar.clickLogout(); // (6HRWJ3)
  });

  // This is for OpenAuth created users. [7LERTA1]
  //describe('owner gets notifications about new topics (because is owner)', () => {  'describe' —> ignored
    it('a new member signs up', async () => {
      await browser.disableRateLimits();
      await browser.complex.signUpAsMemberViaTopbar({
          emailAddress: newMembersEmail, username: 'Mia', password: 'public1122' });
    });
    it('verifies hens email address', async () => {
      const siteId = await browser.getSiteId();
      const link = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(siteId, newMembersEmail, browser);
      await browser.go2(link);
    });
    it('posts a topic', async () => {
      await browser.go2('/');
      await browser.complex.createAndSaveTopic({ title: newMembersTopicTitle, body: newMembersTopicText });
    });
    it('the owner gets an email notification', async () => {
      const siteId = await browser.getSiteId();
      await server.waitUntilLastEmailMatches(
          siteId, settings.gmailEmail, [newMembersTopicTitle, newMembersTopicText], browser);
    });
    it('Logout from Talkyard', async () => {
      await browser.topbar.clickLogout(); // (6HRWJ3)
    });
  //});


  // Now we're logged in already, so the Gmail login flow can be slightly different.
  addCreateSiteWithGmailTestSteps({ alreadyLoggedIn: true });

  it('Logout from Talkyard', async () => {
    await browser.topbar.clickLogout(); // (6HRWJ3)
  });


  function addCreateSiteWithGmailTestSteps(ps: { alreadyLoggedIn: boolean }) {
    const maybe = ps.alreadyLoggedIn ? "already" : "not";
    let newSiteResult: NewSiteResult;

    it(`can create site as Gmail user, when ${maybe} logged in to Gmail`, async () => {
      const data = utils.generateNewSiteData({
        newSiteOwner: NewSiteOwnerType.GmailAccount,
        alreadyLoggedInAtIdProvider: ps.alreadyLoggedIn,
      });
      newSiteResult = await browser.newSite.createNewSite(data);
    });

    it('Sign up as owner', async () => {
      await browser.newSite.signUpAsOwner(newSiteResult);
    });

    it('create forum', async () => {
      await browser.createSomething.createForum(`Gmail Forum, ${maybe} logged in`);
    });
  }

});

