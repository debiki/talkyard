/// <reference path="../test-types.ts"/>

import server from '../utils/server';
import assert from '../utils/ty-assert';
import * as utils from '../utils/utils';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { NewSiteOwnerType } from '../test-constants';

let owen_brA: TyE2eTestBrowser;
let jane_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

const janesEmailAddress = 'e2e-test--jane@example.com';
const janesUsername = 'e2e_test_jane';

let siteId: SiteId;


describe(`create-private-site-gmail-invite-only.2br.f  TyTCRSITPRIVGMAIL`, () => {

  it(`initialize`, async () => {
    owen_brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    jane_brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    stranger_brB = jane_brB;
  });

  let newSiteParams: NewSiteData | U;
  let newSiteResult: NewSiteResult | U;

  it(`Create site`, async () => {
    newSiteParams = utils.generateNewSiteData({
      newSiteOwner: NewSiteOwnerType.GmailAccount,
    });
    newSiteResult = await owen_brA.newSite.createNewSite({ ...newSiteParams, makePrivate: true });
    siteId = newSiteResult.siteId;
  });

  it(`Owen signs up as owner, via Gmail`, async () => {
    await owen_brA.newSite.signUpAsOwner(newSiteResult);
  });

  it(`... Creates a forum`, async () => {
    await owen_brA.createSomething.createForum("Private Gmail Forum");
  });

  it(`Owen is logged in — can click the My-menu and jump to the admin area`, async () => {
    await owen_brA.topbar.clickGoToAdmin();
  });


  // ----- Is it private?

  it(`The forum is private: Strangers see a login dialog`, async () => {
    await stranger_brB.go2(newSiteParams.origin);
    await stranger_brB.loginDialog.waitAssertFullScreen();
  });

  it(`There's a sign-up dialog with Name, Email etc fields`, async () => {
    await stranger_brB.loginDialog.switchToSignupIfIsLogin();
    assert.ok(await stranger_brB.loginDialog.isSignUpDialog({ withNameEmailInputs: true }));
  });


  // ----- Invite only  TyTINVONLY

  it("Owen makes the forum invite-only", async () => {
    await owen_brA.adminArea.settings.clickLoginNavLink();
    await owen_brA.adminArea.settings.login.setAllowLocalSignup(false);
  });
  it(`... saves`, async () => {
    await owen_brA.adminArea.settings.clickSaveAll();
  });

  it(`The stranger reloads the login page`, async () => {
    await stranger_brB.refresh2();
    await stranger_brB.loginDialog.waitAssertFullScreen();
  });

  it(`... now the sign-up email & name inputs are gone`, async () => {
    assert.ok(await stranger_brB.loginDialog.isSignUpDialog({ withNameEmailInputs: false })); // fok
  });


  // ----- Invite someone

  it("Owen goes to the Invites tab", async () => {
    await owen_brA.adminArea.goToUsersInvited(newSiteParams.origin);
  });

  it("He sends an invite to Jane", async () => {
    await owen_brA.adminArea.users.invites.clickSendInvite();
    await owen_brA.inviteDialog.typeAndSubmitInvite(janesEmailAddress, { numWillBeSent: 1 });
  });

  let inviteLinkJane;

  it("Jane gets an invite email", async () => {
    inviteLinkJane = await server.waitAndGetInviteLinkEmailedTo(siteId, janesEmailAddress);
  });

  it("... clicks the link", async () => {
    await jane_brB.go2(inviteLinkJane);
  });

  it("... and gets logged in", async () => {
    await jane_brB.topbar.waitForMyMenuVisible();
    await jane_brB.topbar.assertMyUsernameMatches(janesUsername);
    await jane_brB.disableRateLimits();
  });

});

