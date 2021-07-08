/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let brC: TyE2eTestBrowser;
let brD: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let owen_brB: TyE2eTestBrowser;
let owen_brC: TyE2eTestBrowser;
let maja: Member;
let maja_brD: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;



describe(`d.sessions-logout-elsewhere.4br  TyTESESLGOSELF`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some E2E Test",
      members: ['owen', 'maja'],
    });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    brC = new TyE2eTestBrowser(wdioBrowserC, 'brC');
    brD = new TyE2eTestBrowser(wdioBrowserD, 'brD');

    owen = forum.members.owen;
    owen_brA = brA;
    owen_brB = brB;
    owen_brC = brC;

    maja = forum.members.maja;
    maja_brD = brD;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Owen logs in to the admin area, in browser A ...`, async () => {
    await owen_brA.adminArea.settings.login.goHere(site.origin, { loginAs: owen });
  });
  it(`... and to the forum, in browser B`, async () => {
    await owen_brB.go2(site.origin);
    await owen_brB.complex.loginWithPasswordViaTopbar(owen);
  });
  it(`... and to the forum, in browser C`, async () => {
    await owen_brC.go2(site.origin);
    await owen_brC.complex.loginWithPasswordViaTopbar(owen);
  });


  it(`Maja logs in, in browser D`, async () => {
    await maja_brD.go2(site.origin);
    await maja_brD.complex.loginWithPasswordViaTopbar(maja);
  });


  it(`Owen starts editing admin settings in browser A, without saving`, async () => {
    await owen_brA.adminArea.settings.login.setApproveUsers(true);
  });
  it(`... and starts composing a new topic in browser B`, async () => {
    await owen_brB.forumButtons.clickCreateTopic();
    await owen_brB.editor.editTitle("Title");
    await owen_brB.editor.editText("Text");
  });


  // ----- List active sessions

  it(`In browser C, Owen navigates to his profile page`, async () => {
    await owen_brC.topbar.clickGoToProfile();
  });
  it(`... the active sessions list`, async () => {
    await owen_brC.userProfilePage.tabs.switchToPreferences();
    await owen_brC.userProfilePage.preferences.tabs.switchToSecurity();
  });

  it(`Owen sees 3 active sessions`, async () => {
    const counts = await owen_brC.userProfilePage.preferences.security.countSessions();
    assert.deepEq(counts, { numActive: 3, numEnded: 0 });
  });


  // ----- Terminate all one's other sessions

  it(`Owen treminates all sessions except for browser C`, async () => {
    await owen_brC.userProfilePage.preferences.security.terminateAllSessions();
  });

  it(`... now he sees one active session, and 2 terminated sessions`, async () => {
    // It takes a while for the server to reply, and the UI to update.
    await owen_brC.userProfilePage.preferences.security.waitForSessions({
            numActive: 1, numEnded: 2 });
  });
  it(`... after page reload ...`, async () => {
    await owen_brC.refresh2();
    await owen_brC.userProfilePage.preferences.security.waitForLoaded();
  });
  it(`... the terminated sessions are gone — ended sessions normally not listed`, async () => {
    const counts = await owen_brC.userProfilePage.preferences.security.countSessions();
    assert.deepEq(counts, { numActive: 1, numEnded: 0 });
  });


  // ----- Cannot use terminated sessions

  it(`In browser A, Owen tries to save the admin settings`, async () => {
    await owen_brA.adminArea.settings.clickSaveAll({ willFail: true });
  });
  it(`... there's an error: Owen isn't logged in as admin (in brA)`, async () => {
    await owen_brA.serverErrorDialog.waitForNotLoggedInAsAdminError();
  });
  it(`... after page refresh, he sees the login dialog (in brA)`, async () => {
    await owen_brA.refresh2();
    await owen_brA.loginDialog.waitAssertFullScreen();
  });

  it(`In browser B, Owen tries to save the topic`, async () => {
    await owen_brB.editor.save();
  });
  it(`... there's a not-logged-in error in brB`, async () => {
    await owen_brB.serverErrorDialog.waitForNotLoggedInError();
  });
  it(`... after page refresh, he sees he's logged out in brB`, async () => {
    await owen_brB.refresh2();
    await owen_brB.topbar.waitUntilLoginButtonVisible();
  });


  // ----- Login again

  it(`Owen logs in again, in browser B`, async () => {
    await owen_brB.complex.loginWithPasswordViaTopbar(owen);
  });
  it(`... and logs in to his sessions list page, in browser A ...`, async () => {
    await owen_brA.userProfilePage.preferences.security.goHere(owen.username, { loginAs: owen });
  });

  it(`There are again 3 active sessions`, async () => {
    const counts = await owen_brA.userProfilePage.preferences.security.countSessions();
    assert.deepEq(counts, { numActive: 3, numEnded: 0 });   // before: fok
  });


  // ----- Session sort order

  it(`... Owen's brA session is in the middle   TESTS_MISSING
              because sessions are sorted by created-at currently`, async () => {
  });


  // ----- Terminate a specific session

  it(`Owen terminates the oldest session, the one in brC`, async () => {
    await owen_brA.userProfilePage.preferences.security.terminateOldestSession();
  });
  it(`... thereafter, 2 active and 1 teminated sessions listed`, async () => {
    await owen_brA.userProfilePage.preferences.security.waitForSessions({
            numActive: 2, numEnded: 1 });
  });
  it(`ttt: There're 2 terminate-session buttons: One to terminate "all", and one
              to terminate the one and only other session`, async () => {
    const n = await owen_brA.userProfilePage.preferences.security.numEndSessionButtonsVisible();
    assert.eq(n, 2);
  });

  it(`Now, in brC, Owen tries to switch to the Drafts Etc tab`, async () => {
    await owen_brC.userProfilePage.tabs.switchToDraftsEtc({ willFail: true });
  });
  it(`... there's an error: He's no longer logged in, in that browser`, async () => {
    await owen_brC.serverErrorDialog.waitForNotLoggedInError();
  });
  it(`... after reload ...`, async () => {
    await owen_brC.refresh2();
  });
  it(`... the login button appears`, async () => {
    await owen_brC.topbar.waitUntilLoginButtonVisible();
  });


  // ----- One's other sessions still work

  it(`But in brB, Owen is still logged in: He can submit a topic`, async () => {
    await owen_brB.complex.createAndSaveTopic({ title: "Owen's Topic", body: "Text." });
  });
  it(`... and after reload ...`, async () => {
    await owen_brB.refresh2();
  });
  it(`... he's still logged in — sees his username menu`, async () => {
    assert.eq(await owen_brB.topbar.getMyUsername(), owen.username);
  });


  // ----- Other users not affected

  it(`Maja is still logged in — she can post a topic`, async () => {
    await maja_brD.complex.createAndSaveTopic({ title: "Maja's Topic", body: "Text." });
  });
  it(`... and reload the page`, async () => {
    await maja_brD.refresh2();
  });
  it(`... she still sees her username — she's still logged in`, async () => {
    await maja_brD.topbar.assertMyUsernameMatches(maja.username);
  });


  // ----- Session disappears from list, after logging out in other browser

  it(`Owen logs out in browser B`, async () => {
    await owen_brB.topbar.clickLogout();
  });

  it(`... and reloads the session list in browser A`, async () => {
    await owen_brA.refresh2();
  });
  it(`... now there's just one active session — his current session, brA`, async () => {
    const counts = await owen_brA.userProfilePage.preferences.security.countSessions();
    assert.deepEq(counts, { numActive: 1, numEnded: 0 });
  });

  it(`There's no end-session button — cannot end one's current session here`, async () => {
    const n = await owen_brA.userProfilePage.preferences.security.numEndSessionButtonsVisible();
    assert.eq(n, 0);
  });

});
