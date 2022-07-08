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
let maria: Member;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let modya: Member;
let modya_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

const mariasBadge = 'mariasBadge';
const modyasBadge = 'modyasBadge';
const memahsBadge = 'memahsBadge';
const owensBadge = 'owensBadge';

const taglessPageId = 'taglessPageId';
const taglessPageSlug = 'tagless-page';
const taglessPagePath = '/' + taglessPageSlug;

let modyasPubPageUrl: St | U;
const modyasPubPageTitle = "Badges or Badgers";
const modyasPubPageId = 'modyasPubPageId';
const modyasPubPageSlug = 'modyas-pub-page';
const modyasPubPagePath = '/' + modyasPubPageSlug;
const modyasPubPageTag = 'modyasPubPageTag';
const modyasPubReplyTag = 'modyasPubReplyTag';

const mariasReplyTag = 'mariasReplyTag';

const memahsReplyTag = 'memahsReplyTag';

let modyasStaffPageUrl: St | U;
const modyasStaffPageId = 'modyasStaffPageId';
const modyasStaffPageSlug = 'modyas-staff-page';
const modyasStaffPagePath = '/' + modyasStaffPageSlug;
const modyasStaffPageTag = 'modyasStaffPageTag';
const modyasStaffReplyTag = 'modyasStaffReplyTag';

const owensReplyNr = c.ThirdReplyNr;  // Maria, Modya, Owen; see newPage2 below.
const memahsReplyNr = owensReplyNr + 1;


describe(`tags-badges-not-missing.2br  TyTETAGS0MISNG`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Badges, Badgers and Tags E2E Pest",
      members: ['owen', 'modya', 'maria', 'memah']
    });

    builder.settings({ enableTags: true, numFirstPostsToApprove: 9 });

    // Currently tags won't appear, in the default e2e test layout — TitleExcerptSameLine.
    // Maybe stop supporting TitleExcerptSameLine?
    // For now, pick a different layout:
    builder.updatePage(forum.forumPage.id, (p: PageJustAdded) => {
      p.layout = c.TestTopicListLayout.ExcerptBelowTitle;   // TyTFRMLAYOUT
    });

    const newPage: PageJustAdded = builder.addPage({
      id: taglessPageId,
      folder: '/',
      showId: false,
      slug: taglessPageSlug,
      role: c.TestPageRole.Discussion,
      title: "Tagless Page",
      body: "I want no tags, badges or badgers here.",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.maria.id,
    });

    const newPage2: PageJustAdded = builder.addPage({
      id: modyasPubPageId,
      folder: '/',
      showId: false,
      slug: modyasPubPageSlug,
      role: c.TestPageRole.Discussion,
      title: modyasPubPageTitle,
      body: "Let's talk about badges vs badgers.",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.modya.id,
    });
    builder.addPost({
      page: newPage2,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Can I have a badger instead of a badge, in the office? " +
            "It can sleep on my shoulders",
    });
    builder.addPost({
      page: newPage2,
      nr: c.SecondReplyNr,
      parentNr: c.FirstReplyNr,
      authorId: forum.members.modya.id,
      approvedSource: "Yes, I have a badger in the forest nearby. " +
            "I'll bring it tomorrow. The badger.",
    });
    builder.addPost({
      page: newPage2,
      nr: c.ThirdReplyNr,
      parentNr: c.SecondReplyNr,
      authorId: forum.members.owen.id,
      approvedSource: "It is MY badger. I am Owen Owner. But it's ok, you can borrow it, " +
            "as long as it won't eat my bread and honey. ... Hmm... Is it a honey badger?",
    });

    const newPage3: PageJustAdded = builder.addPage({
      id: modyasStaffPageId,
      folder: '/',
      showId: false,
      slug: modyasStaffPageSlug,
      role: c.TestPageRole.Discussion,
      title: "Do we need a squirrel wheel for the badgers?",
      body: "Do badgers like running? Maybe it's better if they do this, " +
            "in a squirrel wheel, rather than around the office and on the tables?",
      categoryId: forum.categories.staffCat.id,
      authorId: forum.members.modya.id,
    });
    builder.addPost({
      page: newPage3,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.modya.id,
      approvedSource: "Or maybe they can just run around my chair",
    });


    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;

    memah = forum.members.memah;
    memah_brB = brB;

    modya = forum.members.modya;
    modya_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
    modyasPubPageUrl = site.origin + '/' + modyasPubPageSlug;
    modyasStaffPageUrl = site.origin + '/' + modyasStaffPageSlug;
  });



  // ----- Add badges

  it(`Owen goes to Mara's profile page ... `, async () => {
    await owen_brA.userProfilePage.preferences.goHere(
            maria.username, { origin: site.origin });
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  it(`... gives Maria a title badge`, async () => {
    await owen_brA.userProfilePage.aboutPanel.openBadgesDialog();
    await owen_brA.tagsDialog.createAndAddTag(mariasBadge, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`... goes to Modya's profile page`, async () => {
    await owen_brA.userProfilePage.preferences.goHere(modya.username);
  });

  it(`... gives Modya a badge too`, async () => {
    await owen_brA.userProfilePage.aboutPanel.openBadgesDialog();
    await owen_brA.tagsDialog.createAndAddTag(modyasBadge, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`... and Memah`, async () => {
    await owen_brA.userProfilePage.preferences.goHere(memah.username);
    await owen_brA.userProfilePage.aboutPanel.openBadgesDialog();
    await owen_brA.tagsDialog.createAndAddTag(memahsBadge, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`... and himself`, async () => {
    await owen_brA.userProfilePage.preferences.goHere(owen.username);
    await owen_brA.userProfilePage.aboutPanel.openBadgesDialog();
    await owen_brA.tagsDialog.createAndAddTag(owensBadge, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });


  // ----- Tag a page

  it(`Owen goes to Modya's public page ... `, async () => {
    await owen_brA.go2(modyasPubPageUrl);
  });

  it(`... sees his own badge`, async () => {
    // Dupl code [author_badges]
    // Wait for the server to re-rendre the page and incl Owen's badge (plus the others).
    await owen_brA.waitUntil(async () => {
      const badgeTitles = await owen_brA.topic.getPostAuthorBadgeTitles(
            owensReplyNr, undefined /*numBadges*/);
      if (badgeTitles.length !== 1)
        return false;
      assert.containsAll(badgeTitles, [owensBadge]);
      return true;
    }, {
      refreshBetween: true,
      message: () => `Waiting for Owen's badge to appear`,
    });
  });

  it(`Owen tags the page`, async () => {
    await owen_brA.topic.openTagsDialog();
    await owen_brA.tagsDialog.createAndAddTag(modyasPubPageTag, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`... and Maria's reply`, async () => {
    await owen_brA.topic.openTagsDialog({ forPostNr: c.FirstReplyNr });
    await owen_brA.tagsDialog.createAndAddTag(mariasReplyTag, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`... and Modya's reply`, async () => {
    await owen_brA.topic.openTagsDialog({ forPostNr: c.SecondReplyNr });
    await owen_brA.tagsDialog.createAndAddTag(modyasPubReplyTag, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`Owen sees his own badge, Modya's badge and the post tags, ttt:`, async () => {});

  addPubPageTests();

  it(`... also alfter reload:`, async () => {
    await owen_brA.refresh2();
  });

  addPubPageTests();


  // ----- Badges visible, after pat gone online

  // When someone goes online, hens json gets updated, and this shouldn't overwrite
  // hens badges with nothing.

  it(`Owen opens the sidebar`, async () => {
    await owen_brA.contextbar.openIfNeeded();
  });

  it(`... views users-online`, async () => {
    await owen_brA.contextbar.usersHere.switchToThisTab();
  });

  it(`Owen sees that Modya is offline (away)  TyTPRESENCE01`, async () => {
    await owen_brA.contextbar.usersHere.waitFor(modya.username, { online: false });
  });

  it(`Modya goes online`, async () => {
    await modya_brB.go2(modyasPubPageUrl);
    await modya_brB.complex.loginWithPasswordViaTopbar(modya);
  });

  it(`... appears in Owen's sidebar as online  TyTPRESENCE01`, async () => {
    await owen_brA.contextbar.usersHere.waitFor(modya.username, { online: true });
  });


  it(`Owen still sees Modya's badge — it didn't disappear because of
            a WebSocket presence message about Modya now being online`, async () => {});

  addPubPageTests();

  it(`Owen closes the contextbar again`, async () => {
    // Otherwise, e2e tests confused — they expect wide page layout, when finding topics.
    await owen_brA.contextbar.close();
  });

  it(`Owen navigates to the topic list`, async () => {
    await owen_brA.topbar.clickHome();
  });

  it(`... (E2E bug workaround)`, async () => {
    // Trigger relayout:  [E2EBUG] [topc_list_tags_not_found]
    await owen_brA.watchbar.openIfNeeded();
    await owen_brA.watchbar.close();
  });

  it(`... sees Modya's public page tag '${modyasPubPageTag}'  ttt`, async () => {
    const actualTagTitles: St[] = await owen_brA.forumTopicList.getTopicTags({
            topicUrlPath: modyasPubPagePath, howManyTags: 1 });
    assert.deepEq(actualTagTitles, [modyasPubPageTag]);
  });

  it(`The staff page has no tags`, async () => {
    const staffPageTagTitles: St[] = await owen_brA.forumTopicList.getTopicTags({
            topicUrlPath: modyasStaffPagePath, howManyTags: 0 });
    assert.deepEq(staffPageTagTitles, []);
  });

  it(`Owen navigates back to Modya's page`, async () => {
    await owen_brA.forumTopicList.goToTopic(modyasPubPageTitle);
  });


  it(`... again, still sees Modya's badge: ...`, async () => {});

  addPubPageTests();


  it(`After page reload, Owen also sees Modya's badge: ...`, async () => {
    await owen_brA.refresh2();
  });

  addPubPageTests();


  // ----- Tags in access restricted pages

  it(`Owen goes to Moda's staff-only page`, async () => {
    await owen_brA.go2(modyasStaffPagePath);
  });

  it(`Owen tags the staff-only page`, async () => {
    await owen_brA.topic.openTagsDialog();
    await owen_brA.tagsDialog.createAndAddTag(modyasStaffPageTag, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`... and the reply`, async () => {
    await owen_brA.topic.openTagsDialog({ forPostNr: c.FirstReplyNr });
    await owen_brA.tagsDialog.createAndAddTag(modyasStaffReplyTag, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });

  it(`Owen sees the tags directly, and Modya's badge as well: ...`, async () => {});

  addStaffPageTests();

  it(`Owen sees the tags after reload too: ...`, async () => {
    await owen_brA.refresh2();
  });

  addStaffPageTests();



  // ----- Listing access restricted pages, via All Cats

  // Single-page navigating:

  it(`Owen jumps to a tag-less page, so the browser forgets all tag types`, async () => {
    await owen_brA.go2(taglessPagePath);
  });

  it(`Owen navigates to the All Topics list`, async () => {
    await owen_brA.topbar.clickHome();
  });

  it(`... sees the public page's tag`, async () => {
    const actualTagTitles: St[] = await owen_brA.forumTopicList.getTopicTags({
            topicUrlPath: modyasPubPagePath, howManyTags: 1 });
    assert.deepEq(actualTagTitles, [modyasPubPageTag]);
  });

  it(`... and the staff page's tag`, async () => {
    const actualTagTitles: St[] = await owen_brA.forumTopicList.getTopicTags({
            topicUrlPath: modyasStaffPagePath, howManyTags: 1 });
    assert.deepEq(actualTagTitles, [modyasStaffPageTag]);
  });

  // After reload:

  it(`Owen reloads the topic list`, async () => {
    await owen_brA.refresh2();
  });

  it(`... still sees the public page's tag`, async () => {
    const actualTagTitles: St[] = await owen_brA.forumTopicList.getTopicTags({
            topicUrlPath: modyasPubPagePath, howManyTags: 1 });
    assert.deepEq(actualTagTitles, [modyasPubPageTag]);
  });

  it(`... and the staff page's tag`, async () => {
    const actualTagTitles: St[] = await owen_brA.forumTopicList.getTopicTags({
            topicUrlPath: modyasStaffPagePath, howManyTags: 1 });
    assert.deepEq(actualTagTitles, [modyasStaffPageTag]);
  });



  // ----- Listing access restricted pages, via own cats

  // Single-page navigating:

  it(`Owen jumps to the categories page`, async () => {
    await owen_brA.forumCategoryList.goHere();
  });

  it(`... opens the Staff category`, async () => {
    await owen_brA.forumCategoryList.openCategory(forum.categories.staffCat.name);
  });

  it(`... sees Modya's staff-only page tag '${modyasStaffPageId}'`, async () => {
    const actualTagTitles: St[] = await owen_brA.forumTopicList.getTopicTags({
            topicUrlPath: modyasStaffPagePath, howManyTags: 1 });
    assert.deepEq(actualTagTitles, [modyasStaffPageTag]);
  });

  // After reload:

  it(`Owen reloads the topic list`, async () => {
    await owen_brA.refresh2();
  });

  it(`... sees Modya's staff-only page tag, also after reload`, async () => {
    const actualTagTitles: St[] = await owen_brA.forumTopicList.getTopicTags({
            topicUrlPath: modyasStaffPagePath, howManyTags: 1 });
    assert.deepEq(actualTagTitles, [modyasStaffPageTag]);
  });

  it(`... but not the pub page or tag; they're in a different category`, async () => {
    await owen_brA.forumTopicList.assertNumVisible(1);  // Modya's staff page, that's 1 page
    assert.eq(await owen_brA.count('.c_TagL_Tag '), 1); // it has one tag
  });



  // ----- Unapproved posts

  // One's own

  it(`Modya leaves; Memah goes to Modya's public page`, async () => {
    await modya_brB.topbar.clickLogout();
    await memah_brB.go2(modyasPubPagePath);
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);

  });

  it(`... replies`, async () => {
    // This'll require approval — numFirstPostsToApprove is >= 1.
    await memah_brB.complex.replyToOrigPost(`Let's rebadge_the_badgers as badges?`);
  });

  it(`... the reply is pending approval,  ttt`, async () => {
    await memah_brB.topic.assertPostNeedsApprovalBodyVisible(memahsReplyNr);
  });

  it(`Memah sees her personal badge: ${memahsBadge}`, async () => {
    const badgeTitles = await memah_brB.topic.getPostAuthorBadgeTitles(memahsReplyNr, 1);
    assert.deepEq(badgeTitles, [memahsBadge]);
  });

  // Someone else's (if one is mod)

  it(`Owen arrives, via single-page-navigation`, async () => {
    await owen_brA.go2('/');
    await owen_brA.forumTopicList.navToTopic(modyasPubPageTitle);
  });

  it(`Owen sees Memah's reply; it's pending approval`, async () => {
    await owen_brA.topic.assertPostNeedsApprovalBodyVisible(memahsReplyNr);
  });
  it(`... and he sees Memah's badge  TyTUNAPRPATBADGE`, async () => {
    const badgeTitles = await owen_brA.topic.getPostAuthorBadgeTitles(memahsReplyNr, 1);
    assert.deepEq(badgeTitles, [memahsBadge]);
  });

  it(`Owen tags Memah's post`, async () => {
    await owen_brA.topic.openTagsDialog({ forPostNr: memahsReplyNr });
    await owen_brA.tagsDialog.createAndAddTag(memahsReplyTag, { numAfterwards: 1 });
    await owen_brA.tagsDialog.saveAndClose();
  });
  it(`... still sees Memah's unapproved post text, after tagging  TyTTAGUNAPRPO`, async () => {
    // There was a bug where, when the post got updated to show the tag, the
    // textual content got hidden, as if Owen wasn't a mod (an admin).
    // The field Post.sanitizedHtml was missing, when patching the store with the
    // tagged post.
    await owen_brA.topic.assertPostNeedsApprovalBodyVisible(memahsReplyNr);
  });

  it(`Owen reloads the page`, async () => {
    await owen_brA.refresh2();
  });
  it(`... still sees Memah's unapproved post text`, async () => {
    await owen_brA.topic.assertPostNeedsApprovalBodyVisible(memahsReplyNr);
  });
  it(`... and Memah's badge`, async () => {
    const badgeTitles = await owen_brA.topic.getPostAuthorBadgeTitles(memahsReplyNr, 1);
    assert.deepEq(badgeTitles, [memahsBadge]);
  });
  it(`... and the new tag, although the post is unapproved  TyTTAGUNAPRPO`, async () => {
    const tags = await owen_brA.topic.getTags({ forPostNr: memahsReplyNr, howManyTags: 1 });
    assert.deepEq(tags, [memahsReplyTag]);
  });

  it(`Owen approves Memah's post  TyTAPRTGDPO`, async () => {
    await owen_brA.topic.approvePostNr(memahsReplyNr);
  });
  it(`... still sees Memah's badge`, async () => {
    const badgeTitles = await owen_brA.topic.getPostAuthorBadgeTitles(memahsReplyNr, 1);
    assert.deepEq(badgeTitles, [memahsBadge]);
  });
  it(`... and tag, '${memahsReplyTag}`, async () => {
    const tags = await owen_brA.topic.getTags({ forPostNr: memahsReplyNr, howManyTags: 1 });
    assert.deepEq(tags, [memahsReplyTag]);
  });

  it(`... also after reload: the badge`, async () => {
    await owen_brA.refresh2();
    const badgeTitles = await owen_brA.topic.getPostAuthorBadgeTitles(memahsReplyNr, 1);
    assert.deepEq(badgeTitles, [memahsBadge]);
  });
  it(`... and post tag`, async () => {
    const tags = await owen_brA.topic.getTags({ forPostNr: memahsReplyNr, howManyTags: 1 });
    assert.deepEq(tags, [memahsReplyTag]);
  });

  it(`Memah also sees her badge`, async () => {
    await memah_brB.refresh2();
    const badgeTitles = await memah_brB.topic.getPostAuthorBadgeTitles(memahsReplyNr, 1);
    assert.deepEq(badgeTitles, [memahsBadge]);
  });
  it(`... and her post tag`, async () => {
    const tags = await memah_brB.topic.getTags({ forPostNr: memahsReplyNr, howManyTags: 1 });
    assert.deepEq(tags, [memahsReplyTag]);
  });


  // The end.


  function addPubPageTests() {
    it(`Owen sees Modya's page's tag`, async () => {
      const tags = await owen_brA.topic.getTags({ forPostNr: c.BodyNr, howManyTags: 1 });
      assert.deepEq(tags, [modyasPubPageTag]);
    });

    it(`... and Maria's reply's tag  ttt`, async () => {
      const tags = await owen_brA.topic.getTags({ forPostNr: c.FirstReplyNr, howManyTags: 1 });
      assert.deepEq(tags, [mariasReplyTag]);
    });

    it(`... and Modya's reply's tag`, async () => {
      const tags = await owen_brA.topic.getTags({ forPostNr: c.SecondReplyNr, howManyTags: 1 });
      assert.deepEq(tags, [modyasPubReplyTag]);
    });

    it(`Owen sees Modya's badge`, async () => {
      for (const postNr of [c.BodyNr, c.SecondReplyNr]) {
        const badgeTitles = await owen_brA.topic.getPostAuthorBadgeTitles(postNr, 1);
        assert.deepEq(badgeTitles, [modyasBadge]);
      }
    });

    it(`... and his own badge`, async () => {
      const badgeTitles = await owen_brA.topic.getPostAuthorBadgeTitles(c.ThirdReplyNr, 1);
      assert.deepEq(badgeTitles, [owensBadge]);
    });
  }


  function addStaffPageTests() {
    it(`Owen sees the staff page's tag`, async () => {
      const tags = await owen_brA.topic.getTags({ forPostNr: c.BodyNr, howManyTags: 1 });
      assert.deepEq(tags, [modyasStaffPageTag]);
    });

    it(`... and the reply tag`, async () => {
      const tags = await owen_brA.topic.getTags({ forPostNr: c.FirstReplyNr, howManyTags: 1 });
      assert.deepEq(tags, [modyasStaffReplyTag]);
    });

    it(`... and Modya's badge`, async () => {
      for (const postNr of [c.BodyNr, c.FirstReplyNr]) {
        const badgeTitles = await owen_brA.topic.getPostAuthorBadgeTitles(postNr, 1);
        assert.deepEq(badgeTitles, [modyasBadge]);
      }
    });
  }

});

