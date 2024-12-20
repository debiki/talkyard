/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let modya: Member;
let maria: Member;
let memah: Member;
let memah_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

let numEmailsTotal = 0;


describe(`block-mentions.2br.d  TyTMAYMENTION`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some E2E Test",
      categoryAExtId: 'cat_a_ext_id',
      members: ['modya', 'corax', 'memah', 'maria']
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

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    modya = forum.members.modya;
    maria = forum.members.maria;

    memah = forum.members.memah;
    memah_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });


  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });


  it(`Owen logs in to his privacy settings, ... `, async () => {
    await owen_brA.userProfilePage.openPreferencesFor(owen.username, site.origin);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
    await owen_brA.userProfilePage.preferences.switchToPrivacy();
  });


  it(`... disables @mentions for everyone but >= core members`, async () => {
    await owen_brA.userProfilePage.preferences.privacy.setMayMentionMeTrustLevel(
            c.TestTrustLevel.CoreMember);
  });
  it(`... saves`, async () => {
    await owen_brA.userProfilePage.preferences.privacy.savePrivacySettings();
  });


  it(`Memah logs in`, async () => {
    await memah_brB.go2(site.origin);
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });



  // ----- Block @mentions in new topic


  it(`... creates a page, mentions Owen first, no notf sent ...`, async () => {
    numEmailsTotal += 0;
    await memah_brB.complex.createAndSaveTopic({ title: "Hi Owen and Maria", body:
          `Let me mention something, @${owen.username} — something important, so much, wow`});
  });


  it(`... and then Maria`, async () => {
    numEmailsTotal += 1;
    await memah_brB.complex.replyToOrigPost(
          `And @${maria.username} you too, it is rare and special also, ,,, Hello`);
  });


  it(`Maria gets notified`, async () => {
    await server.waitUntilLastEmailMatches(site.id, maria.emailAddress, "rare and special");
  });
  it(`... but not Owen — he has restricted @mentions`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });



  // ----- @mentions disabled


  it(`Memah starts mentioning Owen ...`, async () => {
    await memah_brB.topic.clickReplyToOrigPost();
    await memah_brB.editor.editText(`Hmm @o`);
  });
  it(`... Owen appears in a usernames pop up list, but disabled`, async () => {
    await memah_brB.waitUntilAnyTextMatches(
            '.rta__entity > div.c_Disabled', owen.username + '.* mentions disabled');
  });

  it(`Memah starts mentioning Maria instead ...`, async () => {
    await memah_brB.keys('Escape');
    await memah_brB.editor.editText(`Hi @m`);
  });
  it(`... a usernames list pops up, Maria's name isn't disabled`, async () => {
    await memah_brB.waitUntilAnyTextMatches(
            '.rta__entity > div:not(.c_Disabled)', maria.username);
  });



  // ----- Block @mentions in comments


  it(`Memah again mentions first Owen ...`, async () => {
    numEmailsTotal += 0;
    await memah_brB.keys('Escape');
    await memah_brB.editor.editText(
          `Actually @${owen.username}`);
    await memah_brB.editor.save();
  });


  it(`... then then Maria`, async () => {
    numEmailsTotal += 1;
    await memah_brB.complex.replyToOrigPost(
          `And @${maria.username} — I'm upset, I will not tell you,`);
  });


  it(`Maria gets notified`, async () => {
    await server.waitUntilLastEmailMatches(site.id, maria.emailAddress, "not tell you");
  });
  it(`... but not Owen — he has restricted @mentions`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });



  // ----- Clear settings


  it(`Owen enables mentions again, but disables direct messages (DM:s)`, async () => {
    await owen_brA.userProfilePage.preferences.privacy.setMayMentionMeTrustLevel(
            c.TestTrustLevel.New);
    await owen_brA.userProfilePage.preferences.privacy.setMayDirMsgMeTrustLevel(
            c.TestTrustLevel.CoreMember);
  });
  it(`... saves`, async () => {
    await owen_brA.userProfilePage.preferences.privacy.savePrivacySettings();
  });


  it(`Memah mentions both Owen and Maria`, async () => {
    numEmailsTotal += 2;
    await memah_brB.complex.replyToOrigPost(
          `That's what happens when you don't reply!
          @${owen.username} and @${maria.username} — it is important, much, very`);     // FOK
  });


  it(`Now both Owen and Maria get notified`, async () => {
    await server.waitUntilLastEmailMatches(site.id, maria.emailAddress, "what happens");
    await server.waitUntilLastEmailMatches(site.id, owen.emailAddress, "what happens");
  });
  it(`Total emails is correct`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });



  // ----- Group mentions: Built-in groups


  it(`Owen disables mentions again`, async () => {
    await owen_brA.userProfilePage.preferences.privacy.setMayMentionMeTrustLevel(
            c.TestTrustLevel.CoreMember);
  });
  it(`... saves`, async () => {
    await owen_brA.userProfilePage.preferences.privacy.savePrivacySettings();
  });

  // Own settings override group settings:

  it(`Maria mentions @staff`, async () => {
    numEmailsTotal += 1;
    await memah_brB.complex.replyToOrigPost(
          `Any other @staff member who wants to listen`);
  });

  it(`Moderator Modya gets notified — she has no personal @mentions settings`, async () => {
    await server.waitUntilLastEmailMatches(site.id, modya.emailAddress, "wants to listen");
  });
  it(`Owen doesn't get notified — he has restricted mentioins of him,
          and that also affects group mentions`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  // Groups can block mentions:

  it(`Owen goes to Staff's privacy preferences`, async () => {
    await owen_brA.userProfilePage.openPreferencesFor('staff');
    await owen_brA.userProfilePage.preferences.switchToPrivacy();
  });
  it(`... disables mentions for @staff`, async () => {
    await owen_brA.userProfilePage.preferences.privacy.setMayMentionMeTrustLevel(
            c.TestTrustLevel.CoreMember);
  });
  it(`... saves`, async () => {
    await owen_brA.userProfilePage.preferences.privacy.savePrivacySettings();
  });

  it(`Memah mentions @staff again`, async () => {
    numEmailsTotal += 0;
    await memah_brB.complex.replyToOrigPost(
          `Ok, @staff — some important to say I have`);
  });
  it(`... and mentions Maria`, async () => {
    numEmailsTotal += 1;
    await memah_brB.complex.replyToOrigPost(
          `And @${maria.username} — hello lets try again`);
  });

  it(`Maria gets @mention-notified`, async () => {
    await server.waitUntilLastEmailMatches(site.id, maria.emailAddress, "try again");
  });
  it(`... but no staff member`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });



  // ----- Group mentions: Custom groups

  // TESTS_MISSING. the above, but with a custom @group, too? Construct a group &
  // memberships when creating the site? So this test won't take so long to run.


});

