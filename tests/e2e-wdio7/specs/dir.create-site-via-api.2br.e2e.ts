/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import * as make from '../utils/make';
import * as utils from '../utils/utils';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let mei: Member;
let mei_brB: TyE2eTestBrowser;

let newSite: { id: SiteId, origin: St } | U;



describe(`dir.create-site-via-api.2br  TyTE2ECREASITAPI`, () => {

  it(`Create browsers`, async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = make.memberOwenOwner();
    owen_brA = brA;
    
    mei = make.memberMei();
    mei_brB = brB;
  });


  it(`Create site via API`, async () => {
    newSite = server.apiV0.createSite({ data: {
      testSiteOkDelete: true,
      acceptTermsAndPrivacy: true,
      createForum: true,
      localHostname: 'e2e-test--site-via-api',
      //embeddingSiteAddress: '',
      organizationName: "E2E Test Create Site Via Api",
      ownerUsername: owen.username,
      ownerEmailAddr: owen.emailAddress,
      ownerEmailAddrVerified: true,
      // Maybe later — so won't need to use Forgot-password link?
      // ownerOneTimeLoginSecret: ___,
    }}).newSite;
  });


  it(`Skip rate limits`, async () => {
    server.skipRateLimits(newSite.id);
  });


  // TESTS_MISSING: Verify that others cannot login, yet? Before Owen has
  // activated his account.

  it(`Owen goes to the admin area, ... `, async () => {
    await owen_brA.adminArea.goToUsersEnabled(newSite.origin);
  });


  it(`... clicks the Forgot Password link`, async () => {
    // Dupl code. [e2e_reset_pwd]
    await owen_brA.loginDialog.clickResetPasswordCloseDialogSwitchTab({
            loginDialogWillClose: false });
  });


  it(`... types the wrong email address  TyTERSTWRONGEML`, async () => {
    await owen_brA.resetPasswordPage.submitAccountOwnerEmailAddress('wrong-addr@some.co');
  });

  it(`... goes back to try again`, async () => {
    await owen_brA.back();
  });

  it(`... types his real address (which was specified in the create-site request)`, async () => {
    await owen_brA.resetPasswordPage.submitAccountOwnerEmailAddress(owen.emailAddress);
  });

  let resetPwdPageLink;

  it("Owen gets an email with a password reset link", async () => {
    // (Could have used: server.waitAndGetResetPasswordLinkEmailedTo(..).)
    const email = await server.getLastEmailSenTo(newSite.id, owen.emailAddress);
    resetPwdPageLink = utils.findFirstLinkToUrlIn(
          newSite.origin + '/-/reset-password/choose-password/', email.bodyHtmlText);
  });


  it("But no email got sent to the wrong addr", async () => {
    const emailsSent = await server.getEmailsSentToAddrs(newSite.id);
    assert.eq(emailsSent.num, 1);
    assert.deepEq(emailsSent.addrsByTimeAsc, [owen.emailAddress]);
  });


  it("Owen follows the reset-password link", async () => {
    await owen_brA.rememberCurrentUrl();
    await owen_brA.go2(resetPwdPageLink);
    await owen_brA.waitForNewUrl();
  });

  it("... types a new password", async () => {
    await owen_brA.chooseNewPasswordPage.typeAndSaveNewPassword(owen.password);
  });

  it("... he can login with the new password", async () => {
    await owen_brA.goAndWaitForNewUrl(newSite.origin);
    await owen_brA.topbar.clickLogout();
    await owen_brA.complex.loginWithPasswordViaTopbar(owen.username, owen.password);
  });


  it(`New members can sign up`, async () => {
    await mei_brB.go2(newSite.origin);
    await mei_brB.complex.signUpAsMemberViaTopbar(mei);
  });


  it(`Owen logs out ...`, async () => {
    await owen_brA.topbar.clickLogout();
  });

  it(`... he can log in directly to the admin area`, async () => {
    await owen_brA.adminArea.goToUsersEnabled();
    await owen_brA.loginDialog.loginWithPassword(owen);
  });



  it(`Owen sees just one user in the active users tab`, async () => {
    await owen_brA.adminArea.users.asserExactlyNumUsers(1);
  });

  it(`... namely himself — Mei hasn't yet verified her email`, async () => {
    await owen_brA.adminArea.users.assertUserListed(owen);
  });



  it(`Mei verifies her email address`, async () => {
    const link = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(
        newSite.id, mei.emailAddress);
    await mei_brB.go2(link);
  });
  it(`... gets logged in`, async () => {
    await mei_brB.hasVerifiedSignupEmailPage.clickContinue();
  });
  it(`... sees her username menu`, async () => {
    await mei_brB.topbar.assertMyUsernameMatches(mei.username);
  });



  it(`Now Owen sees two users`, async () => {
    await owen_brA.refresh2();
    await owen_brA.adminArea.users.asserExactlyNumUsers(2);
  });

  it(`... namely himself and Mei`, async () => {
    await owen_brA.adminArea.users.assertUserListed(owen);
    await owen_brA.adminArea.users.assertUserListed(mei);
  });


  // ----- Verify that the new site can actually be used

  let newTopicUrlPath: St | U;

  it(`Mei can create a topic`, async () => {
    await mei_brB.complex.createAndSaveTopic({ title: "New_topic_title", body: "Body." });
    newTopicUrlPath = await mei_brB.urlPath();
  });

  it(`... Owen gets an email notification`, async () => {
    await server.waitUntilLastEmailMatches(newSite.id, owen.emailAddress, "New_topic_title");
  });

  it(`... Owen sees it`, async () => {
    await owen_brA.go2(newTopicUrlPath);
    await owen_brA.assertPageTitleMatches("New_topic_title");
  });

  it(`... can reply`, async () => {
    // Why do the guidelines modal appear here, although the win width supposedly is 1150?
    // — with that width, the guidelines modal *won't* appear.  [invisible_br_width]
    await owen_brA.complex.replyToOrigPost("New_topic_reply", null, { closeGuidelines: true });
  });

  it(`Mei sees the reply`, async () => {
    await mei_brB.topic.waitForNumReplies({ numNormal: 1 });
  });

});

