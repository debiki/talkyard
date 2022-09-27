/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';
import settings from '../utils/settings';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let alice: Member;
let mons: Member;
let corax: Member;
let corax_brB: TyE2eTestBrowser;
let maria: Member;
let memah: Member;
let memah_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;  // or TwoPagesTestForum or EmptyTestForum or LargeTestForum

let numEmailsTotal = 0;


describe(`block-dir-msgs.2br.d  TyTBLOCKDIRMSGS`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some E2E Test",
      categoryAExtId: 'cat_a_ext_id',
      members: ['alice', 'mons', 'corax', 'memah', 'maria']
    });

    // Disable review notifications, or notf email counts will be off.
    // (since Owen would get emails).
    builder.settings({
      numFirstPostsToApprove: 0,
      //maxPostsPendApprBefore: 0,
      numFirstPostsToReview: 0,
    });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Normal,
      wholeSite: true,
    }];

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    alice = forum.members.alice;
    mons = forum.members.mons;
    maria = forum.members.maria;

    memah = forum.members.memah;
    memah_brB = brB;

    corax = forum.members.corax;
    corax_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });


  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });


  it(`Owen logs in to his privacy settings`, async () => {
    await owen_brA.userProfilePage.openPreferencesFor(owen.username, site.origin);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
    await owen_brA.userProfilePage.preferences.switchToPrivacy();
  });



  // ----- DM:s work


  it(`Memah logs in`, async () => {
    await memah_brB.userProfilePage.openActivityFor(owen.username, site.origin);
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });

  it(`Memah DM:s (direct-messages) Owen`, async () => {
    numEmailsTotal += 1;
    await memah_brB.userProfilePage.clickSendMessage();
    await memah_brB.editor.editTitle("What is it");
    await memah_brB.editor.editText("What time is it Owen");
    await memah_brB.editor.saveWaitForNewPage();
  });
  it(`Owen gets notified`, async () => {
    await server.waitUntilLastEmailMatches(site.id, owen.emailAddress, "What time is it");
  });



  // ----- Block DM:s

  // Server side:  [server_blocks_dms]

  it(`Memah starts typing another message`, async () => {
    await memah_brB.userProfilePage.openActivityFor(owen.username);
    await memah_brB.userProfilePage.clickSendMessage();
    await memah_brB.editor.editTitle("Where");
    await memah_brB.editor.editText("Where did I say the meeting should be, Owen");
  });


  it(`Owen disables DM:s for everyone but >= core members`, async () => {
    await owen_brA.userProfilePage.preferences.privacy.setMayDirMsgMeTrustLevel(
            c.TestTrustLevel.CoreMember);
  });
  it(`... saves`, async () => {
    await owen_brA.userProfilePage.preferences.privacy.savePrivacySettings();
  });

  it(`Memah tries to send her new DM`, async () => {
    await memah_brB.editor.clickSave();
  });
  it(`... but it's rejected by the server`, async () => {
    await memah_brB.serverErrorDialog.waitAndAssertTextMatches('EsEMAY0MSG');  // edt code
  });

  // Client side:

  it(`Memah reloads the page`, async () => {
    await memah_brB.refresh2();
  });

  it(`... sees that Owen has disabled DM:s`, async () => {
    assert.not(await memah_brB.userProfilePage.canSendDirectMessageTo());
  });



  // ----- Group members can block group DM:s

  it(`Memah goes to the Staff group`, async () => {
    await memah_brB.userProfilePage.openActivityFor('staff');
  });

  it(`Memah sends a message to Staff`, async () => {
    numEmailsTotal += 2;
    await memah_brB.userProfilePage.clickSendMessage();
    await memah_brB.editor.editTitle("Where");
    await memah_brB.editor.editText("Owen where did I say the meeting should be tomorrow");
    await memah_brB.editor.saveWaitForNewPage();
  });

  it(`Admin Alice gets notified`, async () => {
    await server.waitUntilLastEmailMatches(site.id, alice.emailAddress, "where did I say");
  });
  it(`... and Moderator Mons`, async () => {
    await server.waitUntilLastEmailMatches(site.id, mons.emailAddress, "where did I say");
  });
  it(`... but not Owen — he blocks DM:s from new members,
            also when sent via a group he is in`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });



  // ----- Groups can block DM:s

  // Server side:  [server_blocks_dms]

  it(`Memah goes to Staff again`, async () => {
    await memah_brB.userProfilePage.openActivityFor('staff');
  });
  it(`... starts typing another message to Staff`, async () => {
    await memah_brB.userProfilePage.clickSendMessage();
    await memah_brB.editor.editTitle("Rain");
    await memah_brB.editor.editText(
            "Everyone, I want an umbrella. Or does my cat like water");
  });

  it(`Owen goes to the Staff group's preferences`, async () => {
    await owen_brA.userProfilePage.openPreferencesFor('staff', site.origin);
    await owen_brA.userProfilePage.preferences.switchToPrivacy();
  });
  it(`... disables DM:s, and saves`, async () => {
    await owen_brA.userProfilePage.preferences.privacy.setMayDirMsgMeTrustLevel(
            c.TestTrustLevel.CoreMember);
    await owen_brA.userProfilePage.preferences.privacy.savePrivacySettings();
  });

  it(`Memah tries to send the new DM`, async () => {
    await memah_brB.editor.clickSave();
  });
  it(`... but it's rejected by the server`, async () => {
    await memah_brB.serverErrorDialog.waitAndAssertTextMatches('EsEMAY0MSG');  // edt code
  });

  // Client side:

  it(`Memah reloads the page`, async () => {
    await memah_brB.refresh2();
  });

  it(`... sees that DM:s to Staff are now disabled`, async () => {
    assert.not(await memah_brB.userProfilePage.canSendDirectMessageTo());
  });



  // ----- Higher trust levels can still DM others


  it(`Memah leaves`, async () => {
    await memah_brB.go2(site.origin);
    await memah_brB.topbar.clickLogout();
  });

  it(`Corax core arrives, goes to Staff`, async () => {
    await corax_brB.complex.loginWithPasswordViaTopbar(corax);
    await corax_brB.userProfilePage.openActivityFor('staff');
  });


  it(`Corax messages Staff`, async () => {
    numEmailsTotal += 3;
    await memah_brB.userProfilePage.clickSendMessage();
    await corax_brB.editor.editTitle("All questions");
    await corax_brB.editor.editText("All questions are good questions, lets reenable DMs");
    await corax_brB.editor.saveWaitForNewPage();
  });

  it(`Admin Alice gets notified`, async () => {
    await server.waitUntilLastEmailMatches(site.id, alice.emailAddress, "All questions");
  });
  it(`... and Moderator Mons`, async () => {
    await server.waitUntilLastEmailMatches(site.id, mons.emailAddress, "All questions");
  });
  it(`... and Owen, because he hasn't blocked Core Members`, async () => {
    await server.waitUntilLastEmailMatches(site.id, owen.emailAddress, "All questions");
  });
  it(`... no one else`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });



  // ----- Re-enabling DM:s


  it(`Owen enables DM:s for Staff again, and saves`, async () => {
    await owen_brA.userProfilePage.preferences.privacy.setMayDirMsgMeTrustLevel(
            c.TestTrustLevel.New);
    await owen_brA.userProfilePage.preferences.privacy.savePrivacySettings();
  });


  it(`Corax leaves`, async () => {
    await corax_brB.topbar.clickLogout();
  });
  it(`Memah returns, goes to Staff`, async () => {
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
    await memah_brB.userProfilePage.openActivityFor('staff');
  });

  it(`Now Memah can message Staff again`, async () => {
    assert.that(await memah_brB.userProfilePage.canSendDirectMessageTo());
  });

  it(`Memah messages Staff`, async () => {
    numEmailsTotal += 2;
    await memah_brB.userProfilePage.clickSendMessage();
    await memah_brB.editor.editTitle("If I was a cat");
    await memah_brB.editor.editText("and kept my current weight, would that be a lot");
    await memah_brB.editor.saveWaitForNewPage();
  });

  it(`Admin Alice gets notified`, async () => {
    await server.waitUntilLastEmailMatches(site.id, alice.emailAddress, "current weight");
  });
  it(`... and Moderator Mons`, async () => {
    await server.waitUntilLastEmailMatches(site.id, mons.emailAddress, "current weight");
  });
  it(`... but not Owen, he still blocks DM:s from new members`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });



  // TESTS_MISSING — DM a custom group too, not just built-in groups,
  // and verify works. And blocking DMs too.


});

