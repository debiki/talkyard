/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let brC: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let mons: Member;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let mei: Member;
let mei_brC: TyE2eTestBrowser;
let memah: Member;
let michael: Member;
let stranger_brC: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoPagesTestForum;

let michaelsTopicUrl: St;



describe(`privacy-may-see.3br.f.e2e.ts  TyTPRIV_MAYSEE`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Privacy May See E2e Test",
      members: ['mons', 'mei', 'memah', 'maria', 'michael']
    });

    // Oh, they can't mention people anyway.
    // // Let strangers start writing, so can test @mentions without being logged in.
    // builder.getSite().settings.requireVerifiedEmail = false;
    // builder.getSite().settings.mayComposeBeforeSignup = true;
    // builder.getSite().settings.mayPostBeforeEmailVerified = true;

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    brC = new TyE2eTestBrowser(wdioBrowserC, 'brC');

    owen = forum.members.owen;
    owen_brA = brA;
    mons = forum.members.mons;

    maria = forum.members.maria;
    maria_brB = brB;

    mei = forum.members.mei;
    mei_brC = brC;
    memah = forum.members.memah;
    michael = forum.members.michael;
    stranger_brC = brC;

    // Changing trust & threat levels: (longer name = more trusted)
    mei.trustLevel = c.TestTrustLevel.New;
    memah.trustLevel = c.TestTrustLevel.Basic;
    michael.trustLevel = c.TestTrustLevel.FullMember;

    maria.trustLevel = c.TestTrustLevel.Trusted;
    maria.threatLevel = c.TestThreatLevel.HopefullySafe;

    // Good with _always_one_member listed when starting to @mentioning someone, typing '@m',
    // also if group preferences hide user profiles, disable mentions.
    memah.maySeeMyProfileTrLv = c.TestTrustLevel.Stranger;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
    michaelsTopicUrl = site.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });


  it(`Owen goes to All Members privacy settings, logs in`, async () => {
    await owen_brA.userProfilePage.preferences.privacy.goHere(
            'all_members', { isGroup: true, origin: site.origin });
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });
  it(`.. all settings are the default`, async () => {
    const assertLevelIs = owen_brA.userProfilePage.preferences.privacy.assertLevelIs;
    await assertLevelIs('MaySeeProfile', c.TestTrustLevel.Stranger, 'IsDefault');
    await assertLevelIs('MaySeeActivity', c.TestTrustLevel.Stranger, 'IsDefault');
    await assertLevelIs('MayMention', c.TestTrustLevel.New, 'IsDefault');
    await assertLevelIs('MayDirectMessage', c.TestTrustLevel.New, 'IsDefault');
  });


  // ----- ttt: See everything

  it(`A stranger looks at Maria's profile`, async () => {
    await stranger_brC.userProfilePage.openActivityFor(maria.username, site.origin);
  });

  addSeeMariaStep(`... sees Maria's name and recent activity  11`, () => stranger_brC, {
        seeProfile: true, seeActivity: true, skipRefresh: true });


  // ----- Inherit from All Members: Block strangers

  it(`Owen sets All Members' maySeeMyActivity trust level to New Member`, async () => {
    const privacy = owen_brA.userProfilePage.preferences.privacy;
    await privacy.setMaySeeMyActivityTrustLevel(c.TestTrustLevel.New);
    await privacy.savePrivacySettings();
  });

  addSeeMariaStep(`... the stranger now can't see Maria's recent activity  22`,
        () => stranger_brC, { seeProfile: true, seeActivity: false });


  it(`Owen sets maySeeMyProfilePage trust level to New Member`, async () => {
    const privacy = owen_brA.userProfilePage.preferences.privacy;
    await privacy.setMaySeeMyProfileTrustLevel(c.TestTrustLevel.New);
    await privacy.savePrivacySettings();
  });
  addSeeMariaStep(`... now the stranger can't see Maria's profile page at all  33`,
        () => stranger_brC, { seeProfile: false, seeActivity: false });


  it(`Mei, a new member, logs in`, async () => {
    await mei_brC.complex.loginWithPasswordViaTopbar(mei);
  });
  addSeeMariaStep(`... sees Maria's name and recent activity  44`,
        () => mei_brC, { seeProfile: true, seeActivity: true, skipRefresh: true,
                          canMention: true });


  // ----- Inherit from All Members: Block Basic Members

  it(`Owen sets maySeeMyActivity trust level to Full Member`, async () => {
    const privacy = owen_brA.userProfilePage.preferences.privacy;
    await privacy.setMaySeeMyActivityTrustLevel(c.TestTrustLevel.FullMember);
    await privacy.savePrivacySettings();
  });

  addSeeMariaStep(`... now Mei sees Maria's profile, but not recent activity  55`,
        () => mei_brC, { seeProfile: true, seeActivity: false });


  it(`Owen sets maySeeMyProfile trust level to Full Member`, async () => {
    const privacy = owen_brA.userProfilePage.preferences.privacy;
    await privacy.setMaySeeMyProfileTrustLevel(c.TestTrustLevel.FullMember);
    await privacy.savePrivacySettings();
  });
  addSeeMariaStep(`... now also Mei can't see Maria's profile  66`,
        () => mei_brC, { seeProfile: false, seeActivity: false,
                          canMention: false });


  // ----- Basic Members config overrides

  it(`Owen goes to the Basic Members group`, async () => {
    await owen_brA.userProfilePage.preferences.privacy.goHere('basic_members', { isGroup: true });
  });
  it(`... sets maySeeMyProfile trust level to New Member.
              Since Maria is a Full Member, she's in the Basic Members group too, and
              this new config has precedence over the All Members config.`, async () => {
    const privacy = owen_brA.userProfilePage.preferences.privacy;
    await privacy.setMaySeeMyProfileTrustLevel(c.TestTrustLevel.New);
    await privacy.savePrivacySettings();
  });

  addSeeMariaStep(`... now Mei sees Maria's profile again, but still not recent activity  77`,
        () => mei_brC, { seeProfile: true, seeActivity: false,
                          canMention: true });

  it(`Owen sets setMaySeeMyActivity trust level to New, too`, async () => {
    const privacy = owen_brA.userProfilePage.preferences.privacy;
    await privacy.setMaySeeMyActivityTrustLevel(c.TestTrustLevel.New);
    await privacy.savePrivacySettings();
  });
  addSeeMariaStep(`... now Mei sees Maria's recent activity again  88`,
        () => mei_brC, { seeProfile: true, seeActivity: true });



  // ----- Own trust level group config overrides

  it(`Owen goes to the Trusted Members group — that's Maria's trust level`, async () => {
    await owen_brA.userProfilePage.preferences.privacy.goHere('trusted_members', { isGroup: true });
  });
  it(`... sets maySeeMyProfile trust level to Trusted Member.
              This new config has precedence over the All and Basic configs.`, async () => {
    const privacy = owen_brA.userProfilePage.preferences.privacy;
    await privacy.setMaySeeMyProfileTrustLevel(c.TestTrustLevel.Trusted);
    await privacy.savePrivacySettings();
  });

  addSeeMariaStep(`... now Mei can't see Maria's profile, or recent activity  99`,
        () => mei_brC, { seeProfile: false,
                          seeActivity: true, // but still can't see, since profile hidden
                                             // Hmm what's best?  [see_activity_0_profile]
                          canMention: false });

  it(`Owen sets maySeeMyActivity trust level to Core Member`, async () => {
    const privacy = owen_brA.userProfilePage.preferences.privacy;
    await privacy.setMaySeeMyActivityTrustLevel(c.TestTrustLevel.CoreMember);
    await privacy.savePrivacySettings();
  });
  addSeeMariaStep(`... Mei still can't see anything  AA`,
        () => mei_brC, { seeProfile: false, seeActivity: false,
                          canMention: false,
                          // Try once _without_a_page_id, when cannot mention.
                          mentionFromNoPageId: true });


  // ----- Own config overrides groups

  it(`Maria logs in`, async () => {
    await maria_brB.userProfilePage.preferences.privacy.goHere(
            maria.username, { origin: site.origin });
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });
  it(`... sees default levels inherited from the Trusted Members group`, async () => {
    const assertLevelIs = maria_brB.userProfilePage.preferences.privacy.assertLevelIs;
    await assertLevelIs('MaySeeProfile', c.TestTrustLevel.Trusted, 'IsDefault');
    await assertLevelIs('MaySeeActivity', c.TestTrustLevel.CoreMember, 'IsDefault');
    await assertLevelIs('MayMention', c.TestTrustLevel.New, 'IsDefault');
    await assertLevelIs('MayDirectMessage', c.TestTrustLevel.New, 'IsDefault');
  });
  it(`... sets her maySeeMyProfile trust level to New Member.
              This has precedence over trust level group configs.`, async () => {
    const privacy = maria_brB.userProfilePage.preferences.privacy;
    await privacy.setMaySeeMyProfileTrustLevel(c.TestTrustLevel.New);
    await privacy.savePrivacySettings();
  });
  addSeeMariaStep(`... now Mei can see Maria's profile. But still not recent activity  BB`,
        () => mei_brC, { seeProfile: true,
                          seeActivity: false,
                          canMention: true,
                          // But Mons is in the Trusted Members group, so, his profile
                          // is still hidden — can't mention him.
                          canSeeMons: false,
                          // Try once _without_a_page_id, when *can* mention.
                          mentionFromNoPageId: true });

  it(`Maria sets maySeeMyActivity trust level to New, too`, async () => {
    const privacy = maria_brB.userProfilePage.preferences.privacy;
    await privacy.setMaySeeMyActivityTrustLevel(c.TestTrustLevel.New);
    await privacy.savePrivacySettings();
  });
  it(`... "default" text gone`, async () => {
    const assertLevelIs = maria_brB.userProfilePage.preferences.privacy.assertLevelIs;
    await assertLevelIs('MaySeeProfile', c.TestTrustLevel.New);
    await assertLevelIs('MaySeeActivity', c.TestTrustLevel.New);
  });
  addSeeMariaStep(`... Mei can see everything now  CC`,
        () => mei_brC, { seeProfile: true, seeActivity: true });



  // ----- User can change back to default

  it(`Maria sets her maySeeMyActivity trust level back to the default`, async () => {
    await maria_brB.userProfilePage.preferences.privacy.setMaySeeMyActivityTrustLevel(null);
    await maria_brB.userProfilePage.preferences.privacy.savePrivacySettings();
  });
  addSeeMariaStep(`... now Mei can see Maria's profile, but not any recent activity  DD`,
        () => mei_brC, { seeProfile: true, seeActivity: false });

  it(`Maria sets maySeeMyProfile back to the default`, async () => {
    await maria_brB.userProfilePage.preferences.privacy.setMaySeeMyProfileTrustLevel(null);
    await maria_brB.userProfilePage.preferences.privacy.savePrivacySettings();
  });
  addSeeMariaStep(`... now Mei can't see Maria's profile at all  EE`,
        () => mei_brC, { seeProfile: false, seeActivity: false,
                          canMention: false });

  it(`... "default" texts is back`, async () => {
    const assertLevelIs = maria_brB.userProfilePage.preferences.privacy.assertLevelIs;
    await assertLevelIs('MaySeeProfile', c.TestTrustLevel.Trusted, 'IsDefault');
    await assertLevelIs('MaySeeActivity', c.TestTrustLevel.CoreMember, 'IsDefault');
    await assertLevelIs('MayMention', c.TestTrustLevel.New, 'IsDefault');
    await assertLevelIs('MayDirectMessage', c.TestTrustLevel.New, 'IsDefault');
  });



  // ----- Group can change back to default

  it(`Owen sets all Trusted Members preferences back to the defaults
          — which are inherited from the Basic Members group`, async () => {
    await owen_brA.userProfilePage.preferences.privacy.setMaySeeMyProfileTrustLevel(null);
    await owen_brA.userProfilePage.preferences.privacy.setMaySeeMyActivityTrustLevel(null);
    await owen_brA.userProfilePage.preferences.privacy.savePrivacySettings();
  });
  addSeeMariaStep(`... now Mei can see everything again  FF`,
        () => mei_brC, { seeProfile: true, seeActivity: true });

  it(`Owen sees default from the Basic Members group`, async () => {
    const assertLevelIs = owen_brA.userProfilePage.preferences.privacy.assertLevelIs;
    await assertLevelIs('MaySeeProfile', c.TestTrustLevel.New, 'IsDefault');
    await assertLevelIs('MaySeeActivity', c.TestTrustLevel.New, 'IsDefault');
    await assertLevelIs('MayMention', c.TestTrustLevel.New, 'IsDefault');
    await assertLevelIs('MayDirectMessage', c.TestTrustLevel.New, 'IsDefault');
  });


  let mentionNr = 0;

  function addSeeMariaStep(descr: St, brX: () => TyE2eTestBrowser, ps: {
          seeProfile?: Bo, seeActivity?: Bo, skipRefresh?: true,
          canMention?: Bo, canSeeMons?: false,
          // For trying from somewhere with no page id too. Triggers different code paths
          // on the server: looking up by username prefix only, or page id and prefix.
          mentionFromNoPageId?: true }) {

    it(descr, async () => {
      if (!ps.skipRefresh)
        await brX().refresh2();

      if (ps.seeProfile) {
        await brX().userProfilePage.waitUntilUsernameIs(maria.username);
      }
      else {
        await brX().waitForVisible('.c_UP_404');
      }

      if (!ps.seeProfile) {
        // TESTS_MISSING: TyTPRIV_ACT0PROF
        // if (ps.seeActivity)
        //    send http request to server to see activity, verify replies 404,
        //    although can't be done via the UI (since profile hidden, buttons gone).
        // Or, should it be ok to configure see-activity w/o see-profile? [see_activity_0_profile]
      }
      else if (ps.seeActivity) {
        await brX().userProfilePage.activity.posts.waitForPostTextsVisible(/By Maria in CategoryA/);
      }
      else {
        await brX().userProfilePage.activity.posts.waitForNothingToShow();
      }
    });


    if (_.isBoolean(ps.canMention)) {  // TyTPRIV_MENTION02
      if (ps.mentionFromNoPageId) {
        it(`... goes to Memah's profile page, starts writing a direct message`, async () => {
          await brX().userProfilePage.preferences.privacy.goHere(memah.username);
          await brX().userProfilePage.clickSendMessage();
        });
      }
      else  {
        it(`... goes to Michael's page, starts writing a reply`, async () => {
          // Maria hasn't participated on this page.
          await brX().go2(michaelsTopicUrl);
          await brX().topic.clickReplyToOrigPost();
        });
      }

      it(`... types "@m", to mention Maria`, async () => {
        // Need to type different texts, otherwise @m won't get retyped, the mentions
        // list won't get refetched.
        mentionNr += 1;
        await brX().editor.editText(`Hi ${mentionNr} @m`);
      });

      if (ps.canMention) {
        it(`... and yes, can @mention Maria`, async () => {
          await brX().waitUntilAnyTextMatches('.rta__entity', maria.username);
        });

        // Members starting_with_m:  maria  mei  memah  michael  mod_modya,  that's 5.
        // But if can't see Trusted members, then, can't see Moderator Mons.
        const canSeeMons = ps.canSeeMons !== false;  // default true
        const numExpected = canSeeMons ? 5 : 4;

        it(`... can${ canSeeMons ? '' : " not"} see Mons`, async () => {
          if (canSeeMons) await brX().assertTextMatches('.rta__entity', mons.username);
          else await brX().assertNoTextMatches('.rta__entity', mons.username);
        });

        it(`... there's ${numExpected} @mention suggestions`, async () => {
          await brX().waitForExactly(numExpected, '.rta__entity');
          await brX().back();
        });
      }
      else {
        it(`... but cannot @mention Maria or Mons, names not in suggestions list`, async () => {
          // There's _always_one_member, at least, namely Memah.
          await brX().waitUntilAnyTextMatches('.rta__entity', memah.username);
          await brX().assertNoTextMatches('.rta__entity', maria.username);
          await brX().assertNoTextMatches('.rta__entity', mons.username);
          await brX().back();
        });
      }
    }
  }

});

