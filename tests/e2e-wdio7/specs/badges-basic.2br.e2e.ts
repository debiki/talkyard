/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import { j2s } from '../utils/log-and-die';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let michael: Member;

let site: IdAddress;
let forum: TwoPagesTestForum;

let michaelsTopicUrl: St;
let mariasTopicUrl: St;

const badgeOneDash = 'badgeOneDash-da-sh';
const badgeTwoSpace = 'badgeTwoSpace space s';
const badgeThreeColonSlash = 'badgeThreeColonSlash:/ab/c';

const mariasPostNrs = [c.BodyNr, c.FirstReplyNr + 1];
const mariasUsername = 'maria';
const michaelsReplyNrs = [c.FirstReplyNr];
const michaelsUsername = 'michael';


describe(`badges-basic.2br  TyTE2EBADGESBSC`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
      members: ['owen', 'memah', 'maria', 'michael']
    });

    builder.settings({ enableTags: true });

    builder.addPost({
      page: forum.topics.byMariaCategoryA,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.michael.id,
      approvedSource: "Badges are medals! Many I want.",
    });

    builder.addPost({
      page: forum.topics.byMariaCategoryA,
      nr: c.FirstReplyNr + 1,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Badges are heavy to carry, I not need any.",
    });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    memah = forum.members.memah;
    memah_brB = brB;
    michael = forum.members.michael;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
    michaelsTopicUrl = site.origin + '/' + forum.topics.byMichaelCategoryA.slug;
    mariasTopicUrl = site.origin + '/' + forum.topics.byMariaCategoryA.slug;
  });


  it(`Memah goes to Maria's page. Maria has no badges`, async () => {
    await memah_brB.go2(mariasTopicUrl);
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });

  // ttt
  addBadgeTests(() => memah_brB, 'Memah', { postNrs: mariasPostNrs, username: mariasUsername,
        badgeTitles: [] });



  // ----- One badge

  it(`Owen goes to Mara's profile page ... `, async () => {
    await owen_brA.userProfilePage.preferences.goHere(
            maria.username, { origin: site.origin });
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  it(`Owen gives Maria a title badge`, async () => {
    await owen_brA.userProfilePage.aboutPanel.openBadgesDialog();
    await owen_brA.tagsDialog.createAndAddTag(badgeOneDash, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`Owen sees the badge without page reload`, async () => {
    await owen_brA.waitForExactly(1, '.c_Tag-Pat');
    await owen_brA.assertAnyTextMatches('.c_Tag-Pat', badgeOneDash);
  });

  it(`Memah reloads the page`, async () => {
    await memah_brB.refresh2();
  });

  addBadgeTests(() => memah_brB, 'Memah', { postNrs: mariasPostNrs, username: mariasUsername,
        badgeTitles: [badgeOneDash] });



  // ----- Many badges

  it(`Owen gives Maria two more title badges`, async () => {
    await owen_brA.userProfilePage.aboutPanel.openBadgesDialog();
    await owen_brA.tagsDialog.createAndAddTag(badgeTwoSpace, { numAfterwards: 2 });
    await owen_brA.tagsDialog.createAndAddTag(badgeThreeColonSlash, { numAfterwards: 3 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`Memah reloads the page — Maria should have 3 badges, Michael still 0`, async () => {
    await memah_brB.refresh2();
  });

  addBadgeTests(() => memah_brB, 'Memah',{ postNrs: mariasPostNrs, username: mariasUsername,
        badgeTitles: [badgeOneDash, badgeTwoSpace, badgeThreeColonSlash] });

  addBadgeTests(() => memah_brB, 'Memah', { postNrs: michaelsReplyNrs,
        username: michaelsUsername, badgeTitles: [] });



  // ----- Two users with badges

  it(`Owen gives Michael the first badge type`, async () => {
    await owen_brA.userProfilePage.preferences.goHere(michael.username);
    await owen_brA.userProfilePage.aboutPanel.openBadgesDialog();
    await owen_brA.tagsDialog.addExistingTag(badgeOneDash, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });



  // ----- Removing a badge

  it(`Owen removes Maria's 2nd badge`, async () => {
    await owen_brA.userProfilePage.preferences.goHere(maria.username);
    await owen_brA.userProfilePage.aboutPanel.openBadgesDialog();
    // This should remove badgeTwoSpace, which is the last one, index 3 (1 based)
    // — badges sorted by name [sort_tags]: ['badgeOne..', '..Three...', '...Two..'].
    await owen_brA.tagsDialog.removeNthTag(3, { numAfterwards: 2 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`Mema reloads the page: Michael should have one badge, Maria two`, async () => {
    await memah_brB.refresh2();
  });

  addBadgeTests(() => memah_brB, 'Memah', { postNrs: mariasPostNrs,
        username: mariasUsername, badgeTitles: [badgeOneDash, badgeThreeColonSlash] });


  addBadgeTests(() => memah_brB, 'Memah', { postNrs: michaelsReplyNrs,
        username: michaelsUsername, badgeTitles: [badgeOneDash] });



  function addBadgeTests(br: () => TyE2eTestBrowser, who: St, ps: { postNrs: Nr[],
            username: St, badgeTitles: St[] }) {
    const numBadges = ps.badgeTitles.length;

    it(`${who} sees that @${ps.username} has these title badge next to posts ${
            ps.postNrs.join(', ')}: ${j2s(ps.badgeTitles)}`, async () => {
      // Dupl code [.author_badges]
      // Might need to wait for the server to re-render the page — but only in this
      // first `it(..)`.
      let badgeTitles: St[] = [];
      await br().waitUntil(async () => {
        for (const postNr of ps.postNrs) {
          badgeTitles = await br().topic.getPostAuthorBadgeTitles(
                postNr, undefined /*numBadges*/);
          if (badgeTitles.length !== numBadges)
            return false;
          assert.containsAll(badgeTitles, ps.badgeTitles);
          return true;
        }
      }, {
        refreshBetween: true,
        message: () => `Waiting for ${numBadges} badges, currently: ${j2s(badgeTitles)}`,
      });
    });

    it(`... and in about dialog`, async () => {
      await br().topic.openAboutUserDialogForUsername(ps.username);
      const badgeTitles = await br().aboutUserDialog.getBadgeTitles(numBadges);
      assert.eq(badgeTitles.length, numBadges);
      assert.containsAll(badgeTitles, ps.badgeTitles);
    });

    it(`... and on profile page`, async () => {
      await br().aboutUserDialog.clickViewProfile();
      const badgeTitles = await br().userProfilePage.aboutPanel.getBadgeTitles(numBadges);
      assert.eq(badgeTitles.length, numBadges);
      assert.containsAll(badgeTitles, ps.badgeTitles);
    });

    it(`... also after reload`, async () => {
      await br().refresh2();
      const badgeTitles = await br().userProfilePage.aboutPanel.getBadgeTitles(numBadges);
      assert.eq(badgeTitles.length, numBadges);
      assert.containsAll(badgeTitles, ps.badgeTitles);
    });

    it(`... back on the discussion page too`, async () => {
      await br().userProfilePage.activity.posts.navToPost({   // TyTNAVUSR2PO
            anyOnPageId: forum.topics.byMariaCatA.id });
      for (const postNr of ps.postNrs) {
        const badgeTitles = await br().topic.getPostAuthorBadgeTitles(postNr, numBadges);
        assert.eq(badgeTitles.length, numBadges);
        assert.containsAll(badgeTitles, ps.badgeTitles);
      }
    });
  }

});

