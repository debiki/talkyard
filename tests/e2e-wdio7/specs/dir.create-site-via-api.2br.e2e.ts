// CR_MISSING
/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { dieIf } from '../utils/log-and-die';
import c from '../test-constants';
import * as make from '../utils/make';
import * as utils from '../utils/utils';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let mei: Member;
let mei_brB: TyE2eTestBrowser;

let newSite: { id: SiteId, origin: St } | U;



describe(`dir.create-site-via-api.2br  TyTE2ECREASITAPI`, () => {

  it(`Create browsers`, async () => {
    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = make.memberOwenOwner();
    owen_brA = brA;
    
    mei = make.memberMei();
    mei_brB = brB;
  });


  it(`Create browsers`, async () => {
    newSite = server.apiV0.createSite({ data: {
      testSiteOkDelete: true,
      acceptTermsAndPrivacy: true,
      createForum: true,
      localHostname: 'e2e-test--site-via-api',
      //embeddingSiteAddress: '',
      organizationName: "E2E Test Create Site Via Api",
      ownerUsername: owen.username,
      ownerEmailAddress: owen.emailAddress,
      // Maybe later — so won't need to use Forgot-password link?
      // ownerOneTimeLoginSecret: ___,
    }}).newSite;
  });


  it(`Skip rate limits`, async () => {
    server.skipRateLimits(newSite.id);
  });


  it(`Owen goes to the admin area, ... `, async () => {
    await owen_brA.adminArea.goToUsersEnabled(newSite.origin);
  });


  it(`... clicks the Forgot Password link`, async () => {
    await owen_brA.loginDialog.clickResetPasswordCloseDialogSwitchTab({
            loginDialogWillClose: false });
  });


  it(`... types new password`, async () => {
    await owen_brA.resetPasswordPage.submitAccountOwnerEmailAddress(owen.emailAddress);
  });

  let resetPwdPageLink;

  it("Owen gets an email with a password reset link", async () => {
    const email = await server.getLastEmailSenTo(newSite.id, owen.emailAddress);
    resetPwdPageLink = utils.findFirstLinkToUrlIn(
          newSite.origin + '/-/reset-password/choose-password/', email.bodyHtmlText);
  });


  it("... he goes to that page", async () => {
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
    await owen_brA.topbar.clickLogout();
    await owen_brA.adminArea.goToUsersEnabled();
    await owen_brA.loginDialog.loginWithPassword(owen);
  });


  it(`Owen sees two users, in the active users tab`, async () => {
    await owen_brA.adminArea.users.asserExactlyNumUsers(2);
  });

  it(`... namely he and Mei`, async () => {
    await owen_brA.adminArea.users.assertUserListed(owen);
    await owen_brA.adminArea.users.assertUserListed(mei);
  });

});

