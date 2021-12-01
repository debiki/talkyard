/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let brC: TyE2eTestBrowser;
let brD: TyE2eTestBrowser;
let owen: Member;
let owen_brB: TyE2eTestBrowser;
let mons: Member;
let mons_brA: TyE2eTestBrowser;
let maja: Member;
let maja_brB: TyE2eTestBrowser;
let mallory: Member;
let mallory_brC: TyE2eTestBrowser;
let mallory_brD: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;



describe(`d.sessions-staff-logout-others.4br  TyTESESLGOOTR`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some E2E Test",
      members: ['owen', 'maja', 'mons', 'mallory'],
    });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    brC = new TyE2eTestBrowser(wdioBrowserC, 'brC');
    brD = new TyE2eTestBrowser(wdioBrowserD, 'brD');

    owen = forum.members.owen;
    owen_brB = brB;

    mons = forum.members.mons;
    mons_brA = brA;

    maja = forum.members.maja;
    maja_brB = brB;

    mallory = forum.members.mallory;
    mallory_brC = brC;
    mallory_brD = brD;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  // ----- (Maja and Mallory log in)

  it(`Maja logs in, in browser B`, async () => {
    await maja_brB.go2(site.origin);
    await maja_brB.complex.loginWithPasswordViaTopbar(maja);
  });

  it(`Mallory too, in browser C ...`, async () => {
    await mallory_brC.go2(site.origin);
    await mallory_brC.complex.loginWithPasswordViaTopbar(mallory);
  });

  it(`Mallory logs in in browser D too`, async () => {
    await mallory_brD.userProfilePage.preferences.goHere(
            mallory.username, { origin: site.origin });
    await mallory_brD.complex.loginWithPasswordViaTopbar(mallory);
  });
  it(`... starts editing his name`, async () => {
    await mallory_brD.userProfilePage.preferences.setFullName('Admin of Admins');
  });


  // ----- Cannot view someone else's sessions (unless one is mod)

  it(`Mallory types the URL path to Maja's Security tab, in his other browser, C`, async () => {
    await mallory_brC.userProfilePage.preferences.security.goHere(maja);
  });

  it(`... there's nothing here to see — cannot view others' sessions`, async () => {
    await mallory_brC.userProfilePage.waitForTabsVisible();
    assert.not(await mallory_brC.userProfilePage.tabs.isPreferencesTabDisplayed());
    assert.not(await mallory_brC.userProfilePage.preferences.tabs.isSecurityTabDisplayed());
  });

  it(`Mallory returns to the forum topic list instead (in browser C)`, async () => {
    await mallory_brC.topbar.clickBack();
  });


  // ----- A mod terminates a specific session

  it(`Moderator Mons goes to Mallory's profile page`, async () => {
    await mons_brA.userProfilePage.preferences.goHere(mallory.username, { origin: site.origin });
    await mons_brA.complex.loginWithPasswordViaTopbar(mons);
  });
  it(`... sees the Preferences tab  ttt`, async () => {
    await mons_brA.userProfilePage.waitForTabsVisible();
    // ttt — see assert.not(..) above.
    assert.that(await mons_brA.userProfilePage.tabs.isPreferencesTabDisplayed());
  });
  it(`... and the About and Security tab`, async () => {
    await mons_brA.userProfilePage.preferences.tabs.waitForAboutTabDisplayed();
    // ttt — see assert.not(..) above.
    assert.that(await mons_brA.userProfilePage.preferences.tabs.isSecurityTabDisplayed());
  });
  it(`... switches to the Security tab`, async () => {
    await mons_brA.userProfilePage.preferences.tabs.switchToSecurity();
  });

  it(`Mons sees Mallory's 2 sessions`, async () => {
    const num = await mons_brA.userProfilePage.preferences.security.countSessions();
    assert.deepEq(num, { numActive: 2, numEnded: 0 });
  });

  it(`Mons terminates Mallory's newest session (that's browser D)`, async () => {
    await mons_brA.userProfilePage.preferences.security.terminateNewestSession();
  });

  it(`... afterwards, he sees one active and one terminated session`, async () => {
    await mons_brA.userProfilePage.preferences.security.waitForSessions({
            numActive: 1, numEnded: 1 });
  });


  // ----- Cannot use a terminated session

  it(`Mallory tries to save his username (in browser D)`, async () => {
    await mallory_brD.userProfilePage.preferences.clickSave();
  });
  it(`... there's an error: Mallory isn't logged in (now in brD)`, async () => {
    await mallory_brD.serverErrorDialog.waitForNotLoggedInError();
  });
  it(`... after page refresh ...`, async () => {
    await mallory_brD.refresh2();
  });
  it(`... he sees the login button (in brD)`, async () => {
    await mallory_brD.me.waitUntilKnowsNotLoggedIn();
    await mallory_brD.topbar.waitUntilLoginButtonVisible();  // ttt
  });

  it(`In browser C, Mallory is still logged in — he posts a new topic`, async () => {
    await mallory_brC.complex.createAndSaveTopic({
          title: "Mallory's Place", body: "This is my palace, I, the Admin of Admins" });
  });


  // ----- (Logging in again)

  it(`Mallory logs in again in browser D`, async () => {
    await mallory_brD.complex.loginWithPasswordViaTopbar(mallory);
  });


  // ----- A mod terminates all a user's sessions

  it(`Mons refreshes the sessions list`, async () => {
    await mons_brA.refresh2();
  });

  it(`... sees Mallory is back, two active sessions`, async () => {
    const num = await mons_brA.userProfilePage.preferences.security.countSessions();
    assert.deepEq(num, { numActive: 2, numEnded: 0 });
  });

  it(`... there're terminate buttons for all sessions, plus an all-in-one-click`, async () => {
    const n = await mons_brA.userProfilePage.preferences.security.numEndSessionButtonsVisible();
    assert.eq(n, 2 + 1);
  });

  it(`Mons terminates all Mallory's sessions`, async () => {
    await mons_brA.userProfilePage.preferences.security.terminateAllSessions();
  });

  it(`... afterwards, no more active sessions, 2 terminated`, async () => {
    await mons_brA.userProfilePage.preferences.security.waitForSessions({
            numActive: 0, numEnded: 2 });
  });

  it(`... no more terminate buttons`, async () => {
    const n = await mons_brA.userProfilePage.preferences.security.numEndSessionButtonsVisible();
    assert.eq(n, 0);
  });


  // ----- Cannot use the terminated sessions

  it(`Mallory tries to reply to and agree with himself (in brC)`, async () => {
    await mallory_brC.topic.clickReplyToOrigPost();
  });
  it(`... but there's a not-logged-in error`, async () => {
    await mallory_brC.serverErrorDialog.waitForNotLoggedInError();
  });
  it(`... after page refresh ...`, async () => {
    await mallory_brC.refresh2();
  });
  it(`... he sees he's logged out, sees the login button`, async () => {
    await mallory_brC.me.waitUntilKnowsNotLoggedIn();
    await mallory_brC.topbar.waitUntilLoginButtonVisible();  // ttt
  });

  it(`He's logged out in the other browser, brD, too`, async () => {
    await mallory_brD.refresh2();
    await mallory_brD.me.waitUntilKnowsNotLoggedIn();
  });


  // ----- Other users not affected

  it(`Maja is still logged in: She can submit a topic`, async () => {
    await maja_brB.complex.createAndSaveTopic({ title: "Important about cream",
            body: "Is milk cream the healthiest dinner, with or without sugar" });
  });

  it(`... and after reload ...`, async () => {
    await maja_brB.refresh2();
  });

  it(`... she's still logged in — sees her username menu`, async () => {
    assert.eq(await maja_brB.topbar.getMyUsername(), maja.username);
  });


  // ----- Mods cannot terminate admins' sessions

  it(`Owen logs in`, async () => {
    await maja_brB.topbar.clickLogout();
    await owen_brB.complex.loginWithPasswordViaTopbar(owen);
  });

  it(`Mons goes to Owen's profile page, the Preferences tab`, async () => {
    await mons_brA.userProfilePage.preferences.goHere(owen.username);
  });

  it(`... sees the About tab to the left ...`, async () => {
    await mons_brA.userProfilePage.preferences.tabs.waitForAboutTabDisplayed();
  });
  it(`... but there's no Security tab! Cannot view admin's sessions  UNIMPL TESTS_MISSING TyTESESTERMADM`, async () => {
    // hmm there is, but it won't work.
    //assert.not(await mons_brA.userProfilePage.preferences.tabs.isSecurityTabDisplayed());
  });

  it(`Mons instead types the URL path to Owen's Security tab`, async () => {
    await mons_brA.userProfilePage.preferences.security.goHere(owen);
  });
  it(`... there's an error: he's not allowed to view an admin's sessions`, async () => {
    await mons_brA.serverErrorDialog.waitAndAssertTextMatches('TyEADMINSESS_');
    await mons_brA.serverErrorDialog.close();
  });


  // ----- Admins can terminate mods' sessions

  it(`Owen jumps to Mon's Security tab`, async () => {
    await owen_brB.userProfilePage.preferences.security.goHere(mons);
  });

  it(`... logs Mons out`, async () => {
    await owen_brB.userProfilePage.preferences.security.terminateAllSessions();
  });

  it(`... now there's 1 terminated session`, async () => {
    await owen_brB.userProfilePage.preferences.security.waitForSessions({
            numActive: 0, numEnded: 1 });
  });


  // ----- Session won't work afterwards

  it(`Mons tries to view invites Owen has sent`, async () => {
    await mons_brA.userProfilePage.switchToInvites({ willFail: true });
  });
  it(`... but there's a not-logged-in error`, async () => {
    await mons_brA.serverErrorDialog.waitForNotLoggedInError();
  });
  it(`... Mons reloads the page ...`, async () => {
    await mons_brA.refresh2();
  });
  it(`... Mons sees he's logged out, sees the login button`, async () => {
    await mons_brA.me.waitUntilKnowsNotLoggedIn();
    await mons_brA.topbar.waitUntilLoginButtonVisible();  // ttt
  });
  

});

