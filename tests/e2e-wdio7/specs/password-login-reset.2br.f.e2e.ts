/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import tyAssert from '../utils/ty-assert';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import * as make from '../utils/make';

let everyone_brAll;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let michael: Member;
let michael_brA: TyE2eTestBrowser;
let michael_brB: TyE2eTestBrowser;

let idAddress;
const forumTitle = "Reset Pwd Test Forum";


describe("password-login-reset.2br.f  TyT5KAES20W", function() {

  it("initialize people", async () => {
    everyone_brAll = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen_brA = brA;
    owen = make.memberOwenOwner();

    michael_brA = brA;  // he once logs in to two
    michael_brB = brB;  // browsers at the same time
    michael = make.memberMichael();
  });

  it("import a site", async () => {
    const site: SiteData = make.forumOwnedByOwen('reset-pwd', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;
    site.members.push(michael);
    idAddress = await server.importSiteData(site);
  });

  it("Owen and Michael go to the homepage", async () => {
    await everyone_brAll.go2(idAddress.origin);
    await owen_brA.assertPageTitleMatches(forumTitle);
    await michael_brB.assertPageTitleMatches(forumTitle);
    // There'll be lots of login attempts.
    await everyone_brAll.disableRateLimits();
  });


  // ----- Passwords work  ttt

  it("Owen logs in with password", async () => {
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... Michael too", async () => {
    await michael_brB.complex.loginWithPasswordViaTopbar(michael);
  });

  it("... and can logout", async () => {
    //everyone.topbar.clickLogout(); [EVRYBUG]
    await owen_brA.topbar.clickLogout();
    await michael_brB.topbar.clickLogout();
  });


  // ----- Passwords protect

  it("But they cannot login with the wrong password (they forgot the real ones)", async () => {
    //everyone.topbar.clickLogin(); [EVRYBUG]
    await owen_brA.topbar.clickLogin();
    await michael_brB.topbar.clickLogin();
  });

  it("... Owen cannot", async () => {
    await owen_brA.loginDialog.loginButBadPassword(owen.username, 'wrong-password');
  });

  it("... Michael cannot", async () => {
    await michael_brB.loginDialog.loginButBadPassword(michael.username, 'even-more-wrong');
  });

  it("... and cannot login with the wrong username", async () => {
    // Don't: everyone.loginDialog.reopenToClearAnyError();  because [4JBKF20]
    await owen_brA.loginDialog.reopenToClearAnyError();
    await owen_brA.loginDialog.loginButBadPassword('not_owen', owen.password);
    await michael_brB.loginDialog.reopenToClearAnyError();
    await michael_brB.loginDialog.loginButBadPassword('not_michael', michael.password);
  });

  it("... and cannot login with each other's passwords", async () => {
    await owen_brA.loginDialog.reopenToClearAnyError();
    await owen_brA.loginDialog.loginButBadPassword(owen.username, michael.password);
    await michael_brB.loginDialog.reopenToClearAnyError();
    await michael_brB.loginDialog.loginButBadPassword(michael.username, owen.password);
  });


  // ----- Log in elsewhere

  it(`Michael gones to the kitchen, where his parrot is — it tells him his password!
          So, now Michael logs in! On his *other* laptop, in the kitchen`, async () => {
    await michael_brA.loginDialog.reopenToClearAnyError();  // note: brA
    await michael_brA.loginDialog.loginWithPassword(michael);
  });

  it(`... he sees his username.  And says Thanks! to the clever parrot (who is, b.t.w.,
                green and likes worms, not as friends but as food).  The parrot
                tells him his password again.`, async () => {
    await michael_brA.topbar.assertMyUsernameMatches(michael.username);
  });


  // ----- Reset password

  it(`Back in the living room, Michael has forgotten the password. He clicks  Reset Password`,
          async () => {
    await michael_brB.loginDialog.clickResetPasswordCloseDialogSwitchTab(); // note: brB
  });

  it("... submits his email address", async () => {
    await michael_brB.resetPasswordPage.submitAccountOwnerEmailAddress(michael.emailAddress);
  });

  let resetPwdPageLink;

  it("... he gets a reset-pwd email with a choose-new-password page link", async () => {
    const email = await server.getLastEmailSenTo(idAddress.id, michael.emailAddress);
    resetPwdPageLink = utils.findFirstLinkToUrlIn(
      idAddress.origin + '/-/reset-password/choose-password/', email.bodyHtmlText);
  });

  it("... he goes to that page", async () => {
    await michael_brB.rememberCurrentUrl();
    await michael_brB.go(resetPwdPageLink);
    await michael_brB.waitForNewUrl();
  });

  const newPassword = "new_password";

  it("... types a new password", async () => {
    await michael_brB.chooseNewPasswordPage.typeAndSaveNewPassword(newPassword);
  });


  // ----- Logged out everywhere  TyT_PWDRST_LGOUT

  it(`He goes to the kitchen, to post a message to parrots in the world.
            But he is logged out!  He got logged out everywhere, when he reset his password`,
        async () => {
    await michael_brA.refresh2();
    await michael_brA.topbar.waitUntilLoginButtonVisible();
  });


  // ----- New password works

  it("... he can login with the new password", async () => {
    await michael_brB.goAndWaitForNewUrl(idAddress.origin);
    await michael_brB.topbar.clickLogout();
    await michael_brB.complex.loginWithPasswordViaTopbar(michael.username, newPassword);
  });

  it("... but not with the old password", async () => {
    await michael_brA.topbar.clickLogin();
    await michael_brA.loginDialog.loginButBadPassword(michael.username, michael.password);
  });



  it("Owen cannot login with Michael's new password", async () => {
    await owen_brA.loginDialog.reopenToClearAnyError();
    await owen_brA.loginDialog.loginButBadPassword(owen.username, newPassword);
  });

  it("... but with his own, when he remembers it", async () => {
    await owen_brA.loginDialog.loginWithPassword(owen.username, owen.password);
  });

});

