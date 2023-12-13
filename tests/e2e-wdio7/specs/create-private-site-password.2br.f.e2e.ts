/// <reference path="../test-types.ts"/>

import server from '../utils/server';
import * as utils from '../utils/utils';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';

let owen_brA: TyE2eTestBrowser;
let browser: TyE2eTestBrowser;
let maria;
let maria_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

const mariasTopicTitle = 'mariasTopicTitle';
const mariasTopicBody = 'mariasTopicBody';
let mariasTopicUrl: St | U;

let siteId: SiteId;


describe(`create-private-site-password.2br.f  TyTCRSITPRIVPW`, () => {

  it(`initialize`, async () => {
    owen_brA = browser = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    maria_brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    stranger_brB = maria_brB;
    maria = make.memberMaria();
  });

  let newSiteParams: NewSiteData | U;

  it(`Create site`, async () => {
    newSiteParams = utils.generateNewSiteData();
    await browser.go2(utils.makeCreateSiteWithFakeIpUrl());
    await browser.disableRateLimits();
    await browser.createSite.fillInFieldsAndSubmit({ ...newSiteParams, makePrivate: true });
    // New site; disable rate limits here too.
    await browser.disableRateLimits();
  });

  it(`Owen signs up as owner, creates a password account`, async () => {
    await browser.createSite.clickOwnerSignupButton();
    await browser.loginDialog.createPasswordAccount(newSiteParams, true);
    siteId = await browser.getSiteId();
  });

  it(`... Clicks a link in an email addr verification email`, async () => {
    const email = await server.getLastEmailSenTo(siteId, newSiteParams.email);
    const link = utils.findFirstLinkToUrlIn(
        newSiteParams.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    await browser.go2(link);
    await browser.waitAndClick('#e2eContinue');

    await browser.tour.runToursAlthoughE2eTest();
  });

  it(`... Creates a forum`, async () => {
    await browser.createSomething.createForum("Private Password Forum");
  });

  it(`Owen is logged in — he sees the intro tour, exits it soon   TyTTOUREXIT`, async () => {
    await browser.tour.assertTourStarts(true);
    console.log('Step 1');
    await browser.waitAndClick('.s_Tour-Step-1 .s_Tour_D_Bs_NextB');
    console.log('Step 2');
    await browser.waitForDisplayed('.s_Tour-Step-2');
    await browser.waitAndClick('.s_Tour_D_Bs_ExitB');
  });

  it(`Owen goes to the admin area`, async () => {
    await browser.topbar.clickGoToAdmin();
  });

  it(`... works fine. Another intro tour starts; he exits it soon   TyTTOUREXIT`, async () => {
    console.log('Step 1');
    await browser.waitAndClick('.s_Tour-Step-1 .s_Tour_D_Bs_NextB');
    console.log('Step 2');
    await browser.waitAndClick('#e2eAA_Ss_LoginL');
    console.log('Step 3');
    await browser.waitForDisplayed('.s_Tour-Step-3');
    await browser.waitAndClick('.s_Tour_D_Bs_ExitB');
  });

  // ----- Is it private?

  it(`The forum is private: Strangers see a login dialog`, async () => {
    await stranger_brB.go2(newSiteParams.origin);
    await stranger_brB.loginDialog.waitAssertFullScreen();
  });


  // ----- Approval required

  it(`Maria arrives, creates an account`, async () => {
    await maria_brB.loginDialog.createPasswordAccount(maria);
  });

  it(`... verifies her email addr`, async () => {
    const link = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(
            siteId, maria.emailAddress);
    await maria_brB.go2(link);
  });

  it(`... gets to the Email-verified page, clicks Continue`, async () => {
    await maria_brB.hasVerifiedSignupEmailPage.clickContinue();
  });

  it(`There's a Forbidden messsage — Maria's account hasn't been approved`, async () => {
    await maria_brB.assertMayNotLoginBecauseNotYetApproved();
  });

  it(`Reloading the page doesn't help: The login dialog is back`, async () => {
    await maria_brB.refresh2();
    await maria_brB.loginDialog.waitAssertFullScreen();
  });

  it(`... Maria logs in`, async () => {
    await maria_brB.loginDialog.loginWithPassword(maria)
  });
  it(`... sees the same Forbidden messsage — account still not approved`, async () => {
    await maria_brB.assertMayNotLoginBecauseNotYetApproved();
  });


  it(`Owen goes to the users-waiting page`, async () => {
    await owen_brA.adminArea.users.goHere();
    await owen_brA.adminArea.users.switchToWaiting();
  });

  it(`... approves Maria`, async () => {
    await owen_brA.adminArea.users.waiting.approveFirstListedUser();
  });

  it(`Now Maria can reload & login`, async () => {
    await maria_brB.refresh2();
    await maria_brB.loginDialog.loginWithPassword(maria)
  });

  it(`... and post a topic`, async () => {
    await maria_brB.complex.createAndSaveTopic({
            title: mariasTopicTitle, body: mariasTopicBody });
    mariasTopicUrl = await maria_brB.urlPath();
  });

  it(`... Owen can access it`, async () => {
    await owen_brA.go2(mariasTopicUrl);
    await owen_brA.assertPageTitleMatches(mariasTopicTitle);
  });

  it(`Maria logs out`, async () => {
    await maria_brB.topbar.clickLogout({ waitForLoginDialog: true });
  });

  it(`... the login page appears`, async () => {
    await maria_brB.loginDialog.waitAssertFullScreen();
  });

  it(`... also after reload`, async () => {
    await maria_brB.refresh2();
    await maria_brB.loginDialog.waitAssertFullScreen();
  });

});

