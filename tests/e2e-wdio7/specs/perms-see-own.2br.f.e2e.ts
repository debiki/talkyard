/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { j2s, logBoring, logMessage } from '../utils/log-and-die';
import c from '../test-constants';

interface Page { id: St, url: St, title: St };
type PagesByCatSlug = { [slug: St]: Page };

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;

let owen: Member;
let owen_brA: TyE2eTestBrowser;

let maria: Member;
let maria_brB: TyE2eTestBrowser;
const mariasPagesByCatSlug: { [slug: St]: Page } = {};

let michael: Member;
let michael_brA: TyE2eTestBrowser;
const michaelsPagesByCatSlug: { [slug: St]: Page } = {};

let kittensUrl = '/help-from-kittens'; // origin added below

let memah: Member;
let memah_brB: TyE2eTestBrowser;

let mallory: Member;

let supportGroup: GroupInclDetails;


let site: IdAddress;
let forum: TwoCatsTestForum;  // or TwoPagesTestForum or EmptyTestForum or LargeTestForum

// We'll use these categories:
// (seeOthers isn't a real permission. Just means that maySee hasn't been set,
// so you can't see other people's pages.)
//
// CatA seeOwn: true, seeOthers: false
// CatAC inherits:  If can't see base cat, then, can't see sub cat. [see_sub_cat]
//
// CatB seeOthers: true
// CatBC seeOwn: true  (but seeOthers: false)
// CatBC2 seethers: true

const catA   = { slug: 'category-a', name: "CatA" }; // oh, the name is actually "CategoryA"
const catARealName = "CategoryA";
const catAC  = { slug: 'cat-ac', name: "CatAC", id: 6 }; // Owen alters

const catB   = { slug: 'cat-b', name: "CatB" };
const catBC  = { slug: "catbc", name: "CatBC" }; // Owen creates
const catBC2 = {  slug: 'cat-bc2', name: "CatBC2", id: 7 };

// We'll post here last —> last email from here.
const catBC2_lastCat = catBC2;

// Owen won't make these cats only-see-own. (CatAC will be see-own because CatA will be.)
const pubCats = [catB, catBC2_lastCat];

// Owen makes CatA and CatBC only-see-own. CatAC becomes only-see-own too,
// since is a child of CatA. HMM
const privCats = [catA, catAC, catBC];

// Let's use this category order, when posting topics and checking for notf emails.
const allCats = [catA, catAC, catB, catBC, catBC2_lastCat];

const allMariasTopicTitles = [
          'Maria_in_CatBC2',
          'Maria_in_CatBC',
          'Maria_in_CatB',
          'Maria_in_CatAC',
          'Maria_in_CatA',
          ];

const allMichaelsTopicTitles = [
          'Michael_in_CatBC2',
          'Michael_in_CatBC',
          'Michael_in_CatB',
          'Michael_in_CatAC',
          'Michael_in_CatA',
          ];

const itIsImportant = `It is important_to_help_Michael`;
const allMichaelsPostTexts = [
          itIsImportant,
          'Hi Michael_wants_help',
          'Hi Michael_wants_help',
          'Hi Michael_wants_help',
          'Hi Michael_wants_help',
          'Hi Michael_wants_help',
          ];

/// Maria and Michael post topics in See-own (only) categories, can't see
/// each others topics (in those categories, but can see, in others).
///
/// Memah, in the Customer Support group, sees all categories.
////
describe(`perms-see-own.2br.f  TyTPERMSEEOWN`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "See Own E2e Test",
      members: ['mons', 'maja', 'memah', 'maria', 'michael', 'mallory'],
    });

    builder.settings({
      // So no "Sth for you to review" emails sent.
      numFirstPostsToApprove: 0,
      numFirstPostsToReview: 0,
    });

    // Search engine
    // To have the search engine index the imported site: (by default, test sites
    // aren't indexed)
    builder.getSite().isTestSiteIndexAnyway = true;

    // (This also test imports a group and member. TyTIMPGROUP)
    supportGroup = builder.addGroup('support_group');
    builder.addGroupPat(supportGroup, forum.members.memah);

    builder.addCategoryWithAboutPage(forum.forumPage, {
      id: catAC.id,
      parentCategoryId: forum.categories.catA.id,
      name: catAC.name,
      slug: catAC.slug,
      aboutPageText: "About Cat AC",
    });
    builder.addDefaultCatPerms(forum.siteData, catAC.id, catAC.id * 100);

    // CatBC: Owen _creates_category_BC, below.

    builder.addCategoryWithAboutPage(forum.forumPage, {
      id: catBC2.id,
      parentCategoryId: forum.categories.catB.id,
      name: "CatBC2", slug: 'cat-bc2',
      aboutPageText: "About Cat BC2",
    });
    builder.addDefaultCatPerms(forum.siteData, catBC2.id, catBC2.id * 100);

    builder.addPage({
      id: 'kittensPageId',
      folder: '/',
      showId: false,
      slug: 'help-from-kittens',
      role: c.TestPageRole.Discussion,
      title: "Ask the Kittens",
      body: "Kittens are cute, kittens are clever. Kittens will help you, forever.",
      categoryId: forum.categories.catB.id, // that's a publ cat
      authorId: forum.members.memah.id,
    });

    { // ttt
      const cats = builder.getSite().categories.filter((c: TestCategory) =>
                  // Exclude staff and root cat
                  !!c.parentId && c.slug.indexOf("staff") === -1);
      // CatA, CatAC, CatB, CatBC2 — but CatBC not yet created.
      assert.eq(cats.length, 4);
    }

    // Subscribe Memah, Maria, Michael & Mallory to notifications about new topics, anywhere.
    // We'll verify that Maria and Michael won't get notified about each other's
    // only see-own topics.  But that Memah, in the @support_group, will get notified.
    // And Mallory only about public topics.
    const mbrs = forum.members;
    for (let memberId of [mbrs.maria.id, mbrs.michael.id, mbrs.memah.id, mbrs.mallory.id]) {
      builder.getSite().pageNotfPrefs.push({
        memberId,
        notfLevel: c.TestPageNotfLevel.EveryPost,
        wholeSite: true,
      });
    }

    // Let's mute Owen, so fewer emails to keep track of.
    builder.getSite().pageNotfPrefs.push({
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;
    michael = forum.members.michael;
    michael_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;
    memah = forum.members.memah;
    memah_brB = brB;
    mallory = forum.members.mallory;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    kittensUrl = site.origin + kittensUrl;
    server.skipLimits_sync(site.id, { rateLimits: true });
  });


  it(`Maria logs in`, async () => {
    await maria_brB.go2(site.origin);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });


  it(`Owen too, goes to cat A`, async () => {
    await owen_brA.go2(site.origin + '/latest/category-a');
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  it(`... edits cat A permissions`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
    await owen_brA.categoryDialog.openSecurityTab();
  });

  it(`... makes Everyone see only their own topics`, async () => {
    // This leaves 'SeeOwn' set to true:
    await owen_brA.categoryDialog.securityTab.setMay('SeeOthers', c.EveryoneId, false);
    // ... right?:
    await owen_brA.categoryDialog.securityTab.assertMay('SeeOwn', c.EveryoneId, true);
  });

  addAddSupportGroupSteps("CatA");

  function addAddSupportGroupSteps(toWhichCat: St) {
    it(`Owen adds the @support_group to ${toWhichCat}`, async () => {
      await owen_brA.categoryDialog.securityTab.addGroup(supportGroup);
    });

    it(`... it starts with zero additional permissions  TyTNEWPERMSEMPTY`, async () => {
      // A newly added group gets no new permissions — it just inherits Everyone's permissions.
      // So, permissions are either may-not, or inherited: granted, but input checbox disabled
      // (since one would edit the Everyone group to revoke the permission).
      const assertMay = owen_brA.categoryDialog.securityTab.assertMay;
      await assertMay('EditOthersTopics',       supportGroup.id, false);
      await assertMay('EditOthersReplies',      supportGroup.id, false);
      await assertMay('EditWikis',              supportGroup.id, false);
      // 'ShouldBeDisabled' means we also check that the checkbox is disabled (can't be
      // toggled to `false` — because `true` is inherited from an ancestor group).
      await assertMay('EditOwn',                supportGroup.id, true, 'ShouldBeDisabled');
      await assertMay('DeleteOthersTopics',     supportGroup.id, false);
      await assertMay('DeleteOthersReplies',    supportGroup.id, false);
      await assertMay('CreatePages',            supportGroup.id, true, 'ShouldBeDisabled');
      await assertMay('PostReplies',            supportGroup.id, true, 'ShouldBeDisabled');
      await assertMay('SeeOthers',              supportGroup.id, false);
      await assertMay('SeeOwn',                 supportGroup.id, true, 'ShouldBeDisabled');
    });

    it(`Owen lets the @support_group members see all posts  (in ${toWhichCat})`, async () => {
      await owen_brA.categoryDialog.securityTab.setMay('SeeOthers', supportGroup.id, true);
    });
  }

  it(`Staff may see everyone's posts (by default, unchanged)`, async () => {
    assert.that(await owen_brA.categoryDialog.securityTab.getMay('SeeOthers', c.StaffId));
  });

  it(`Owen saves the changes to CatA`, async () => {
    await owen_brA.categoryDialog.submit();
  });

  it(`Owen _creates_category_BC, child of B`, async () => {
    await owen_brA.forumCategoryList.goHere();
    await owen_brA.forumButtons.clickCreateCategory();
    await owen_brA.categoryDialog.fillInFields({ name: 'CatBC' });
    await owen_brA.categoryDialog.setParentCategory('CatB');
  });

  it(`... edits CatBC's permissions ...`, async () => {
    await owen_brA.categoryDialog.openSecurityTab();
  });

  it(`... the Everyone group can post and edit own  TyTDEFCATPERMS`, async () => {
    const assertMay = owen_brA.categoryDialog.securityTab.assertMay;
    await assertMay('EditOthersTopics',       c.EveryoneId, false);
    await assertMay('EditOthersReplies',      c.EveryoneId, false);
    await assertMay('EditWikis',              c.EveryoneId, false);
    await assertMay('EditOwn',                c.EveryoneId, true);
    await assertMay('DeleteOthersTopics',     c.EveryoneId, false);
    await assertMay('DeleteOthersReplies',    c.EveryoneId, false);
    await assertMay('CreatePages',            c.EveryoneId, true);
    await assertMay('PostReplies',            c.EveryoneId, true);
    await assertMay('SeeOthers',              c.EveryoneId, true);
    await assertMay('SeeOwn',                 c.EveryoneId, true);
  });

  it(`... Full Members inherit Everyone's perms, & can edit _wikis  TyTDEFCATPERMS`, async () => {
    const assertMay = owen_brA.categoryDialog.securityTab.assertMay;
    await assertMay('EditOthersTopics',       c.FullMembersId, false);
    await assertMay('EditOthersReplies',      c.FullMembersId, false);
    // By default, this is the only perm that's different for Full Members.
    await assertMay('EditWikis',              c.FullMembersId, true);   // <—— _wikis
    // Intherited from Everyone, so can't be set to false, therefore true & disabled.
    await assertMay('EditOwn',                c.FullMembersId, true, 'ShouldBeDisabled');
    await assertMay('DeleteOthersTopics',     c.FullMembersId, false);
    await assertMay('DeleteOthersReplies',    c.FullMembersId, false);
    await assertMay('CreatePages',            c.FullMembersId, true, 'ShouldBeDisabled');
    await assertMay('PostReplies',            c.FullMembersId, true, 'ShouldBeDisabled');
    await assertMay('SeeOthers',              c.FullMembersId, true, 'ShouldBeDisabled');
    await assertMay('SeeOwn',                 c.FullMembersId, true, 'ShouldBeDisabled');
  });

  it(`... Staff inherits, and can edit and delete others' posts  TyTSTAFDEFPERMS`, async () => {
    const assertMay = owen_brA.categoryDialog.securityTab.assertMay;
    await assertMay('EditOthersTopics',       c.StaffId, true);
    await assertMay('EditOthersReplies',      c.StaffId, true);
    // Later, when/if [mods_are_core_membs], EditWikis would be true & disabled — since
    // inherited from Full Members.
    await assertMay('EditWikis',              c.StaffId, true);
    await assertMay('EditOwn',                c.StaffId, true, 'ShouldBeDisabled');
    await assertMay('DeleteOthersTopics',     c.StaffId, true);
    await assertMay('DeleteOthersReplies',    c.StaffId, true);
    await assertMay('CreatePages',            c.StaffId, true, 'ShouldBeDisabled');
    await assertMay('PostReplies',            c.StaffId, true, 'ShouldBeDisabled');
    await assertMay('SeeOthers',              c.StaffId, true, 'ShouldBeDisabled');
    await assertMay('SeeOwn',                 c.StaffId, true, 'ShouldBeDisabled');
  });


  it(`... makes Everyone see only their own topics`, async () => {
    await owen_brA.categoryDialog.securityTab.setMay('SeeOthers', c.EveryoneId, false);
  });
  it(`... Full Members then also cannot`, async () => {
    // But no longer 'ShouldBeDisabled' — since can now be granted (toggled `true`).
    await owen_brA.categoryDialog.securityTab.assertMay('SeeOthers', c.FullMembersId, false);
  });
  it(`... but Staff still can — their group has all perms granted to it,
            in addition to inheriting from Everyone  TyTSTAFDEFPERMS`, async () => {
    // It's less confusing if mods can still see a category, after having
    // revoked `maySee` from the Everyone group.
    await owen_brA.categoryDialog.securityTab.assertMay('SeeOthers', c.StaffId, true);
  });

  addAddSupportGroupSteps("CatBC");

  it(`Owen saves this new category CatBC`, async () => {
    await owen_brA.categoryDialog.submit();
  });



  postTopicInEachCat(() => maria_brB, "Maria", mariasPagesByCatSlug);


  it(`Memah (support team) gets notified of each of Maria's new topics`, async () => {
    const emails: EmailSubjectBody[] = await server.waitGetLastEmailsSentTo(
                                site.id, memah.emailAddress, allCats.length);
    //logMessage(j2s(emails));
    checkNewTopicEmails(emails, allCats, maria, "Maria");
  });

  it(`Michael gets notified of only Maria's others-can-see topics`, async () => {
    const emails = await server.waitGetLastEmailsSentTo(
                        site.id, michael.emailAddress, pubCats.length);
    //logMessage(j2s(emails));
    checkNewTopicEmails(emails, pubCats, maria, "Maria");
  });

  it(`... Mallory too`, async () => {
    const emails = await server.waitGetLastEmailsSentTo(
                        site.id, mallory.emailAddress, pubCats.length);
    //logMessage(j2s(emails));
    checkNewTopicEmails(emails, pubCats, maria, "Maria");
  });

  it(`No other emails get sent`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, allCats.length + pubCats.length * 2, `Emails sent to: ${addrsByTimeAsc}`);
  });



  it(`Owen leaves, Michael arrives`, async () => {
    await owen_brA.topbar.clickLogout();
    await michael_brA.complex.loginWithPasswordViaTopbar(michael);
  });


  postTopicInEachCat(() => michael_brA, "Michael", michaelsPagesByCatSlug);


  it(`Memah (support team) gets notified of each of Michael's new topics`, async () => {
    const allEmails = await server.waitGetLastEmailsSentTo(
                                // `* 2` since first Maria's, now Michael's emails.
                                site.id, memah.emailAddress, allCats.length * 2);
    // Skip the one's about Maria's topics.
    const emails = allEmails.slice(allCats.length);
    logMessage(j2s(emails));
    checkNewTopicEmails(emails, allCats, michael, "Michael");
  });

  it(`Maria gets notified of Michael's others-can-see public topics`, async () => {
    const emails = await server.waitGetLastEmailsSentTo(
                              site.id, maria.emailAddress, pubCats.length);
    logMessage(j2s(emails));
    checkNewTopicEmails(emails, pubCats, michael, "Michael");
  });

  it(`... Mallory too`, async () => {
    const allEmails = await server.waitGetLastEmailsSentTo(
                        // `* 2` since first Maria's, now Michael's emails.
                        site.id, mallory.emailAddress, pubCats.length * 2);
    // Skip the one's about Maria's topics.
    const emails = allEmails.slice(pubCats.length);
    logMessage(j2s(emails));
    checkNewTopicEmails(emails, pubCats, michael, "Michael");
  });

  it(`No other emails get sent`, async () => {
    // At most 15 per address hmm,  [R2AB067]
    // `allCats.length` = 5, and * 2 —> 10, <= 15, so, fine.
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, (allCats.length + pubCats.length * 2) * 2, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // [_dir_access_test]
  it(`Maria can't access Michael's private topics  TyTSEEOWN_DIR_ACS`, async () => {
    for (let cat of privCats) {
      const page = michaelsPagesByCatSlug[cat.slug];
      await maria_brB.go2(page.url);
      await maria_brB.assertNotFoundError({ whyNot: 'MayNotSeeCat' });
    }
  });
  it(`... but can access Michael's public topics`, async () => {
    for (let cat of pubCats) {
      const page = michaelsPagesByCatSlug[cat.slug];
      await maria_brB.go2(page.url);
      await maria_brB.assertPageTitleMatches(`Michael_in_${cat.name}`);
    }
  });


  it(`Maria leaves, Memah arrives`, async () => {
    await maria_brB.topbar.clickLogout();
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });

  // Memah replies to Maria
  //
  // Also tests that you *can* access see-own topics, if granted permission. [_dir_access_test]
  //
  const memahToMariaCats = [catAC, catBC, catBC2]; // only catBC2 is public, others are see-own
  addReplyInEachCatStep(() => memah_brB, "Memah", "Maria", memahToMariaCats,
        mariasPagesByCatSlug);

  it(`Maria gets notified`, async () => {
    // Michael's publ posts + Memah's replies to Maria.
    const numEmailsExpected = pubCats.length + memahToMariaCats.length;
    const allEmails = await server.waitGetLastEmailsSentTo(
                                site.id, maria.emailAddress, numEmailsExpected);
    assert.eq(allEmails.length, numEmailsExpected, `allEmails to Maria: ${j2s(allEmails)}`);
    const emails = allEmails.slice(-memahToMariaCats.length);
    checkReplyEmails(emails, memahToMariaCats, memah, "Memah", "Maria");
  });

  it(`Michael too — but only about CatBC2, which is public`, async () => {
    const allEmails = await server.waitGetLastEmailsSentTo(
                              site.id, michael.emailAddress, pubCats.length + 1);
    assert.eq(allEmails.length,  pubCats.length + 1, // Maria's publ posts + Memah's publ reply
          `allEmails to Michael: ${j2s(allEmails)}`);
    const emails = allEmails.slice(-1);
    checkReplyEmails(emails, [catBC2], memah, "Memah", "Maria");
  });

  it(`... and Mallory — only about CatBC2`, async () => {
    const numExpected = pubCats.length * 2 + 1; // Maria's & Michel's publ + Memah's publ reply
    const allEmails = await server.waitGetLastEmailsSentTo(
            site.id, mallory.emailAddress, numExpected);
    assert.eq(allEmails.length, numExpected, `allEmails to Mallory: ${j2s(allEmails)}`);
    const emails = allEmails.slice(-1);
    checkReplyEmails(emails, [catBC2], memah, "Memah", "Maria");
  });

  let numTotalEmailsExpected: Nr;

  it(`No other emails get sent`, async () => {
    // At most 15 per address hmm,  [R2AB067]
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    numTotalEmailsExpected =
            // Initial posts: Notfs to Memah, and Maria/Michael & Mallory. By Michael & Memah.
            (allCats.length + pubCats.length * 2) * 2 +
                memahToMariaCats.length + // Memah's replies to Maria
                1 + 1; // Memah's publ reply to Maria —> notf to Michael & Mallory
    assert.eq(num, numTotalEmailsExpected,
           `Emails sent to: ${addrsByTimeAsc}`);
  });



  // Memah replies to Michael [_dir_access_test]
  const memahToMichaelCats = [catA, catBC, catB]; // only CatB is public
  addReplyInEachCatStep(() => memah_brB, "Memah", "Michael", memahToMichaelCats,
        michaelsPagesByCatSlug);

  it(`Michael gets notified`, async () => {
    numTotalEmailsExpected += memahToMichaelCats.length;
    const numEmailsExpected =
            pubCats.length +  // Maria's publ posts
            1 +  // Memah's publ reply to Maria
            memahToMichaelCats.length;  // Memah's replies to Michael
    const allEmails = await server.waitGetLastEmailsSentTo(
            site.id, michael.emailAddress, numEmailsExpected);
    assert.eq(allEmails.length,  numEmailsExpected, `allEmails to Michael: ${j2s(allEmails)}`);
    const emails = allEmails.slice(memahToMichaelCats.length);
    checkReplyEmails(emails, memahToMichaelCats, memah, "Memah", "Michael");
  });

  it(`... Maria too, about the CatB reply only (publ visible)`, async () => {
    numTotalEmailsExpected += 1;
    const numEmailsExpected =
          pubCats.length + // Michael's publ posts
          memahToMariaCats.length + // Memah's replies to Maria
          1; // Memah's publ reply to Michael
    const allEmails = await server.waitGetLastEmailsSentTo(
            site.id, maria.emailAddress, numEmailsExpected);
    assert.eq(allEmails.length, numEmailsExpected, `allEmails to Maria: ${j2s(allEmails)}`);
    const emails = allEmails.slice(-1);
    checkReplyEmails(emails, [catB], memah, "Memah", "Michael");
  });

  it(`... and Mallory, about CatB only`, async () => {
    numTotalEmailsExpected += 1;
    const numExpected = pubCats.length * 2 + 2; // Maria's & Michel's publ + Memah's 2 publ reply
    const allEmails = await server.waitGetLastEmailsSentTo(
            site.id, mallory.emailAddress, numExpected);
    assert.eq(allEmails.length, numExpected, `allEmails to Mallory: ${j2s(allEmails)}`);
    const emails = allEmails.slice(-1);
    checkReplyEmails(emails, [catB], memah, "Memah", "Michael");
  });

  it(`No other emails get sent`, async () => {
    // At most 15 per address hmm,  [R2AB067]
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numTotalEmailsExpected, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // Verify that one can reply on one's own `seeOwn` page,
  // and that one's replies stay private.

  it(`Michael replies to Memah's reply to him in private CatBC  [_dir_access_test]`, async () => {
    await michael_brA.go2(michaelsPagesByCatSlug[catBC.slug].url);
    await michael_brA.complex.replyToPostNr(c.FirstReplyNr, itIsImportant);
  });

  it(`Memah gets notified about Michael's reply to her`, async () => {
    numTotalEmailsExpected += 1;
    await server.waitUntilLastEmailMatches(site.id, memah.emailAddress, [itIsImportant]);
  });

  it(`No other emails get sent`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, numTotalEmailsExpected, `Emails sent to: ${addrsByTimeAsc}`);
  });


  it(`Michael goes to the topic list`, async () => {
    await michael_brA.forumTopicList.goHere();
  });
  it(`... sees his own topics, and Maria's public topics  TyTSEEOWN_LIST_PGS`, async () => {
    await michael_brA.forumTopicList.assertTopicTitlesAreAndOrder([
            'Michael_in_CatBC',   // bumped by Michael's reply to Memah
            'Michael_in_CatB',    // bumped by Memah's reply to Michael
            'Michael_in_CatA',    //          – '' –
            'Maria_in_CatBC2',    // bumped by Memah's reply to Maria
            'Michael_in_CatBC2',  // Michael's last not-bumped topic
            'Michael_in_CatAC',   //
            'Maria_in_CatB',      // Maria's first publ topic
            'Ask the Kittens',
            ]);
  });

  // Let's verify topics filtered properly from sub cats too.
  it(`Michael opens ${catA.name}, a see-own (only) category  TyTSEEOWN_LIST_PGS`, async () => {
    await michael_brA.forumTopicList.switchToCategory(catARealName);
  });
  it(`... sees his own topics only, from cat A and sub cat AC`, async () => {
    await michael_brA.forumTopicList.assertTopicTitlesAreAndOrder([
            'Michael_in_CatA',
            'Michael_in_CatAC',
            ]);
  });
  it(`Michael opens sub cat ${catAC.name}`, async () => {
    await michael_brA.forumTopicList.switchToCategory(catAC.name, { isSubCat: true });
  });
  it(`... sees his own ${catAC.name} topic only  TyTSEEOWN_LIST_PGS`, async () => {
    await michael_brA.forumTopicList.assertTopicTitlesAreAndOrder([
            'Michael_in_CatAC',
            ]);
  });


  // Break out fn: _see_public ?
  it(`Michael goes to Maria's posts page`, async () => {
    await michael_brA.userProfilePage.activity.posts.goHere(maria.username);
    await michael_brA.userProfilePage.activity.posts.waitForPostTextsVisible();
  });
  it(`... sees only Maria's two public posts`, async () => {
    await michael_brA.userProfilePage.activity.posts.assertExactly(pubCats.length); // ttt
  });
  it(`... the correct contents 001`, async () => {
    await michael_brA.userProfilePage.activity.posts.assertPostTextsIncludeAndOrder([
            'Hi Maria_wants_help',
            'Hi Maria_wants_help',
            ]);
    // Maria_in_CatBC2
    // By Maria @maria11 hours ago
    // Hi Maria_wants_help
    // 
    // Maria_in_CatB
    // By Maria @maria11 hours ago
    // Hi Maria_wants_help
  });
  it(`... goes to Maria's topics page`, async () => {
    await michael_brA.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
  });
  it(`... sees only Maria's two public topics`, async () => {
    await michael_brA.userProfilePage.activity.topics.assertExactly(pubCats.length); // ttt
    await michael_brA.userProfilePage.activity.topics.assertTopicTitlesAreAndOrder([
            'Maria_in_CatBC2',
            'Maria_in_CatB',  // Maria's first publ topic
            ]);
  });

  // Break out fn: _see_all ?
  it(`Michael goes to his own posts page`, async () => {
    await michael_brA.userProfilePage.activity.posts.goHere(michael.username);
    await michael_brA.userProfilePage.activity.posts.waitForPostTextsVisible();
  });
  it(`... sees all his posts, incl his reply to Memah`, async () => {
    await michael_brA.userProfilePage.activity.posts.assertExactly(allCats.length + 1); // ttt
  });
  it(`... the correct contents 003`, async () => {
    await michael_brA.userProfilePage.activity.posts.assertPostTextsIncludeAndOrder(
              allMichaelsPostTexts);
    // Michael_in_CatBC
    // Michael @michael11 hours ago
    // It is important_to_help_Michael
    // 
    // Michael_in_CatBC2
    // By Michael @michael11 hours ago
    // Hi Michael_wants_help
    // 
    // Michael_in_CatBC
    // By Michael @michael11 hours ago
    // Hi Michael_wants_help
    // 
    // Michael_in_CatB
    // By Michael @michael11 hours ago
    // Hi Michael_wants_help
    // 
    // Michael_in_CatAC
    // By Michael @michael11 hours ago
    // Hi Michael_wants_help
    // 
    // Michael_in_CatA
    // By Michael @michael11 hours ago
    // Hi Michael_wants_help
  });
  it(`... goes to his topics page`, async () => {
    await michael_brA.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
  });

  it(`... sees all his topics`, async () => {
    await michael_brA.userProfilePage.activity.topics.assertExactly(allCats.length);
    await michael_brA.userProfilePage.activity.topics.assertTopicTitlesAreAndOrder(
            allMichaelsTopicTitles);
  });

  it(`Michael goes to Memah's posts page`, async () => {
    await michael_brA.userProfilePage.activity.posts.goHere(memah.username);
    await michael_brA.userProfilePage.activity.posts.waitForPostTextsVisible();
  });
  it(`... sees Memah's "shall_help_" replies: 3 to Michael, only 1 publ to Maria`, async () => {
    // And the Kittens page too.
    await michael_brA.userProfilePage.activity.posts.assertExactly(3 + 1 + 1);  // ttt
  });
  it(`... the correct contents 005`, async () => {
    // But all replies to Maria are left out, except for the reply in CatBC2, which is public.
    await michael_brA.userProfilePage.activity.posts.assertPostTextsIncludeAndOrder([
            'I, Memah, shall_help_Michael_in_cat-b',
            'I, Memah, shall_help_Michael_in_catbc',
            'I, Memah, shall_help_Michael_in_category-a',
            'I, Memah, shall_help_Maria_in_cat-bc2',
            'Kittens are cute, kittens are clever. Kittens will help you, forever.',
            ]);
    // Michael_in_CatB
    // Memah @memah11 hours ago
    // I, Memah, shall_help_Michael_in_cat-b
    //
    // Michael_in_CatBC
    // Memah @memah11 hours ago
    // I, Memah, shall_help_Michael_in_catbc
    //
    // Michael_in_CatA
    // Memah @memah11 hours ago
    // I, Memah, shall_help_Michael_in_category-a
    //
    // Maria_in_CatBC2
    // Memah @memah11 hours ago
    // I, Memah, shall_help_Maria_in_cat-bc2
    //
    // Ask the Kittens
    // Kittens are cute, kittens are clever. Kittens will help you, forever.
  });
  it(`... goes to _Memahs_topics_page, only the Kittens topic there`, async () => {
    await michael_brA.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
    await michael_brA.userProfilePage.activity.topics.assertExactly(1);
    await michael_brA.userProfilePage.activity.topics.assertTopicTitlesAreAndOrder([
            'Ask the Kittens',
            ]);
  });

  addSearchTestSteps("Michael", () => michael_brA, {
        seeMichaelsPriv: true, seeMariasPriv: false });



  it(`Memah also goes to the topic list`, async () => {
    await memah_brB.forumTopicList.goHere();
  });
  it(`... sees both Michael's and Memah's`, async () => {
    await memah_brB.forumTopicList.assertTopicTitlesAreAndOrder([
            'Michael_in_CatBC',     // bumped by Michael's reply to Memah
            'Michael_in_CatB',      // bumped by Memah's reply to Michael
            'Michael_in_CatA',      //           – '' –
            'Maria_in_CatBC2',      // bumped by Memah's reply to Maria
            'Maria_in_CatBC',       //           – '' –
            'Maria_in_CatAC',       //           – '' –
            'Michael_in_CatBC2',    // Michael's last not-bumped topic
            'Michael_in_CatAC',
            'Maria_in_CatB',
            'Maria_in_CatA',        // Maria's first topic
            'Ask the Kittens',
            ]);
  });

  it(`Memah opens ${catA.name}, a see-own (only) category`, async () => {
    await memah_brB.forumTopicList.switchToCategory(catARealName);
  });
  it(`... sees both Michael's and Maria's topics in A and AC TyTSEEOWN_LIST_PGS`,
          async () => {
    await memah_brB.forumTopicList.assertTopicTitlesAreAndOrder([
            'Michael_in_CatA',
            'Maria_in_CatAC',
            'Michael_in_CatAC',
            'Maria_in_CatA',
            ]);
  });
  it(`... switches to sub cat AC`, async () => {
    await memah_brB.forumTopicList.switchToCategory(catAC.name, { isSubCat: true });
  });
  it(`... sees both Michael's and Maria's topics  TyTSEEOWN_LIST_PGS`, async () => {
    await memah_brB.forumTopicList.assertTopicTitlesAreAndOrder([
            'Maria_in_CatAC',
            'Michael_in_CatAC',
            ]);
  });


  // Break out fn: _see_all ?
  it(`Memah goes to Maria's posts page`, async () => {
    await memah_brB.userProfilePage.activity.posts.goHere(maria.username);
    await memah_brB.userProfilePage.activity.posts.waitForPostTextsVisible();
  });
  it(`... sees all Maria's posts`, async () => {
    await memah_brB.userProfilePage.activity.posts.assertExactly(allCats.length);
    // Maria_in_CatBC2
    // By Maria @maria11 hours ago
    // Hi Maria_wants_help
    // 
    // Maria_in_CatBC
    // By Maria @maria11 hours ago
    // Hi Maria_wants_help
    // 
    // Maria_in_CatB
    // By Maria @maria11 hours ago
    // Hi Maria_wants_help
    // 
    // Maria_in_CatAC
    // By Maria @maria11 hours ago
    // Hi Maria_wants_help
    // 
    // Maria_in_CatA
    // By Maria @maria11 hours ago
    // Hi Maria_wants_help
  });
  it(`... goes to Maria's topics page`, async () => {
    await memah_brB.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
  });
  it(`... sees all Maria's topics`, async () => {
    await memah_brB.userProfilePage.activity.topics.assertExactly(allCats.length);
    await memah_brB.userProfilePage.activity.topics.assertTopicTitlesAreAndOrder(
              allMariasTopicTitles);
  });

  // Break out fn: _see_all ?
  it(`Memah goes to Michael's posts page`, async () => {
    await memah_brB.userProfilePage.activity.posts.goHere(michael.username);
    await memah_brB.userProfilePage.activity.posts.waitForPostTextsVisible();
  });
  it(`... sees all Michal's posts, incl Michael's reply to Memah`, async () => {
    await memah_brB.userProfilePage.activity.posts.assertExactly(allCats.length + 1);  // ttt
  });
  it(`... the correct contents  007`, async () => {
    await memah_brB.userProfilePage.activity.posts.assertPostTextsIncludeAndOrder(
              allMichaelsPostTexts);
    // Michael_in_CatBC
    // Michael @michael11 hours ago
    // It is important_to_help_Michael
    // 
    // Michael_in_CatBC2
    // By Michael @michael11 hours ago
    // Hi Michael_wants_help
    // 
    // Michael_in_CatBC
    // By Michael @michael11 hours ago
    // Hi Michael_wants_help
    // 
    // Michael_in_CatB
    // By Michael @michael11 hours ago
    // Hi Michael_wants_help
    // 
    // Michael_in_CatAC
    // By Michael @michael11 hours ago
    // Hi Michael_wants_help
    // 
    // Michael_in_CatA
    // By Michael @michael11 hours ago
    // Hi Michael_wants_help
  });
  it(`... goes to Michal's topics page`, async () => {
    await memah_brB.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
  });
  it(`... sees all Michal's topics`, async () => {
    await memah_brB.userProfilePage.activity.topics.assertExactly(allCats.length);
    await memah_brB.userProfilePage.activity.topics.assertTopicTitlesAreAndOrder(
              allMichaelsTopicTitles);
  });

  it(`Memah goes to her own posts page`, async () => {
    await memah_brB.userProfilePage.activity.posts.goHere(memah.username);
    await memah_brB.userProfilePage.activity.posts.waitForPostTextsVisible();
  });
  it(`... sees all her replies to Maria and Michael + the Kittens page`, async () => {
    await memah_brB.userProfilePage.activity.posts.assertExactly(
            memahToMichaelCats.length + memahToMariaCats.length + 1);
    // Michael_in_CatB
    // Memah @memah11 hours ago
    // I, Memah, shall_help_Michael_in_cat-b
    // 
    // Michael_in_CatBC
    // Memah @memah11 hours ago
    // I, Memah, shall_help_Michael_in_catbc
    // 
    // Michael_in_CatA
    // Memah @memah11 hours ago
    // I, Memah, shall_help_Michael_in_category-a
    // 
    // Maria_in_CatBC2
    // Memah @memah11 hours ago
    // I, Memah, shall_help_Maria_in_cat-bc2
    // 
    // Maria_in_CatBC
    // Memah @memah11 hours ago
    // I, Memah, shall_help_Maria_in_catbc
    // 
    // Maria_in_CatAC
    // Memah @memah11 hours ago
    // I, Memah, shall_help_Maria_in_cat-ac
    // 
    // Ask the Kittens
  });
  it(`... _Memahs_topics_page shows her Kittens topic only`, async () => {
    await memah_brB.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
    await memah_brB.userProfilePage.activity.topics.assertExactly(1);
  });

  addSearchTestSteps("Memah", () => memah_brB, { seeMichaelsPriv: true, seeMariasPriv: true });


  const publBacklinkPagesById = {};
  const mariasPrivBacklinkPagesById = {};
  const michaelsPrivBacklinkPagesById = {};

  it(`Init expected backlinks`, async () => {
    for (let cat of pubCats) {
      const mariasTopic: Page = mariasPagesByCatSlug[cat.slug];
      publBacklinkPagesById[mariasTopic.id] = mariasTopic;

      const michaelsTopic: Page = michaelsPagesByCatSlug[cat.slug];
      publBacklinkPagesById[michaelsTopic.id] = michaelsTopic;
    }
    assert.eq(_.size(publBacklinkPagesById), 4); // ttt: CatB, CatBC2 for Maria + Michael

    for (let cat of privCats) {
      const mariasTopic: Page = mariasPagesByCatSlug[cat.slug];
      mariasPrivBacklinkPagesById[mariasTopic.id] = mariasTopic;

      const michaelsTopic: Page = michaelsPagesByCatSlug[cat.slug];
      michaelsPrivBacklinkPagesById[michaelsTopic.id] = michaelsTopic;
    }
    assert.eq(_.size(mariasPrivBacklinkPagesById), 3);   // ttt: CatA, CatAC, CatBC
    assert.eq(_.size(michaelsPrivBacklinkPagesById), 3); // ttt
  });


  it(`Memah goes to the Kittens page`, async () => {
    await memah_brB.go2(kittensUrl);
  });
  it(`... sees 10 backlinks: Maria's 5, Michael's 5  (incl both publ and priv)  TyTLNBK_SEEOWN`,
          async () => {
    const backlinks = await memah_brB.topic.backlinks.getBacklinkUrlsAndTitles();
    checkBacklinks(backlinks, {
          ...mariasPrivBacklinkPagesById,
          ...michaelsPrivBacklinkPagesById,
          ...publBacklinkPagesById,
        });
  });


  // Some _preview_links.
  let pubPageUrl: St;
  let privPageUrl: St;
  let privSubCatPageUrl: St;

  it(`Memah adds links to a public page, and two of Michael's only-see-own pages`, async () => {
    pubPageUrl = michaelsPagesByCatSlug[catB.slug].url;  // B is public
    privPageUrl = michaelsPagesByCatSlug[catA.slug].url;  // A is see-own
    privSubCatPageUrl = michaelsPagesByCatSlug[catAC.slug].url; // AC is see-own, since sub cat

    // (We're editing the Kittens page body.)
    await memah_brB.complex.editPageBody(`\n\n` +
            `${privPageUrl}\n\n` +
            `${pubPageUrl}\n\n` +  // _Memah_2_Michael_link
            `${privSubCatPageUrl}\n\n`,
            { append: true, textAfterMatches: /https?:\/\/e2e-test-.*\/michaelincata/ });
  });

  addCheckLinkPreviewsToMichaelSteps(() => memah_brB, "Memah");
  
  // These links are in the Kittens page body.
  //
  // The page looks the same, regardless of if you can see the linked posts or not.
  // It's 1) too complicated to generate different html for different people, and
  // maybe 2) just a bad idea, since could give [those who *can* see all linked pages]
  // the incorrect impression that *everyone* can see link previews of private
  // linked pages. [links_to_see_own]
  //
  function addCheckLinkPreviewsToMichaelSteps(brX: () => TyE2eTestBrowser, who: St) {
    // First, any broken previews at all?
    it(`${who} looks at preview links:  2 broken link previews...  TyTLNPV_SEEOWN`, async () => {
      const sel = utils.makePreviewBrokenSelector('InternalLink');
      await brX().topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 2 });
    });
    // Now, check the exact urls, and the reasons they're broken.
    it(`... the one to Michael's CatA page — it's see-own-only access restricted`, async () => {
      const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: privPageUrl,
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-EdMMSEEADDCATPERM-ABX94WN_',
            });
      await brX().topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });
    });
    it(`... the one to CatAC, also access restricted  (because in sub cat of CatA)`, async () => {
      const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: privSubCatPageUrl,
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-EdMMSEEADDCATPERM-ABX94WN_',
            });
      await brX().topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });
    });
    it(`... but the link preview to Michael's page in CatB works — CatB is public`, async () => {
      await brX().topic.waitForExistsInPost(c.BodyNr,
            utils.makePreviewOkSelector('InternalLink', { url: pubPageUrl }));
    });
  }


  it(`Memah leaves, Maria is back`, async () => {
    await memah_brB.topbar.clickLogout();
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });

  it(`Maria goes to the topic list`, async () => {
    await maria_brB.forumTopicList.goHere();
  });
  it(`... sees her own topics`, async () => {
    await maria_brB.forumTopicList.assertTopicTitlesAreAndOrder([
            'Ask the Kittens',      // bumped by Memah's orig post edits
            'Michael_in_CatB',      // bumped by Memah's reply to Michael
            'Maria_in_CatBC2',      // bumped by Memah's reply to Maria
            'Maria_in_CatBC',       //           – '' –
            'Maria_in_CatAC',       //           – '' –
            'Michael_in_CatBC2',    // Michael's last not-bumped topic
            'Maria_in_CatB',
            'Maria_in_CatA',        // Maria's first topic
            ]);
  });

  // Break out fn: _see_all ?
  it(`Maria goes to her own posts page`, async () => {
    await maria_brB.userProfilePage.activity.posts.goHere(maria.username);
    await maria_brB.userProfilePage.activity.posts.waitForPostTextsVisible();
  });
  it(`... sees all posts`, async () => {
    await maria_brB.userProfilePage.activity.posts.assertExactly(allCats.length);
  });
  it(`... goes to her topics page`, async () => {
    await maria_brB.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
  });
  it(`... sees all topics`, async () => {
    await maria_brB.userProfilePage.activity.topics.assertExactly(allCats.length);
  });

  // Break out fn: _see_public ?
  it(`Maria goes to Michael's posts page`, async () => {
    await maria_brB.userProfilePage.activity.posts.goHere(michael.username);
    await maria_brB.userProfilePage.activity.posts.waitForPostTextsVisible();
  });
  it(`... sees his public posts`, async () => {
    await maria_brB.userProfilePage.activity.posts.assertExactly(pubCats.length);
  });
  it(`... goes to his topics page`, async () => {
    await maria_brB.userProfilePage.activity.switchToTopics({ shallFindTopics: true });
  });
  it(`... sees Michael's public topics`, async () => {
    await maria_brB.userProfilePage.activity.topics.assertExactly(pubCats.length);
  });

  it(`Maria goes to Memah's posts page`, async () => {
    await maria_brB.userProfilePage.activity.posts.goHere(memah.username);
    await maria_brB.userProfilePage.activity.posts.waitForPostTextsVisible();
  });
  it(`... sees Memah's "shall_help_" replies: 3 to Maria, 1 publ to Michael, + Kittens page`,
          async () => {
    await maria_brB.userProfilePage.activity.posts.assertExactly(3 + 1 + 1);
  });
  // Skip — Michael did already.
  // it(`... goes to _Memahs_topics_page, sees the Kittens topic`, ...

  addSearchTestSteps("Maria", () => maria_brB, { seeMichaelsPriv: false, seeMariasPriv: true,
        // Memah added a link from the Kittens page. [_Memah_2_Michael_link]
        linkFromKittensToMichaelsPage: true});


  it(`Maria goes to the Kittens page`, async () => {
    await maria_brB.go2(kittensUrl);
  });
  it(`... sees 7 backlinks: Maria's 5, Michael's 2 public  TyTLNBK_SEEOWN`, async () => {
    // [links_from_see_own]
    const backlinks = await maria_brB.topic.backlinks.getBacklinkUrlsAndTitles();
    checkBacklinks(backlinks, { ...mariasPrivBacklinkPagesById, ...publBacklinkPagesById });
  });

  addCheckLinkPreviewsToMichaelSteps(() => maria_brB, "Maria");

  // More _preview_links.
  let mariasPubPageUrl: St;
  let mariasPrivPageUrl: St;

  it(`Maria adds a comment with a link to a public page, and a see-own page of hers`, async () => {
    mariasPubPageUrl = mariasPagesByCatSlug[catBC2.slug].url;  // BC2 is public
    mariasPrivPageUrl = mariasPagesByCatSlug[catBC.slug].url;  // BC is see-own

    // (We're on the Kittens page.)
    await maria_brB.complex.replyToOrigPost(
            `${mariasPrivPageUrl}\n\n` +
            `${mariasPubPageUrl}\n\n`);
  });

  addCheckLinkPreviewsToMariaSteps(() => maria_brB, "Maria");
  
  // These links are in a reply by Maria on the Kittens page.
  // (But the links to Michael's posts are in the orig post.)
  //
  // The generated html is the same for everyone, see: [links_to_see_own].
  //
  function addCheckLinkPreviewsToMariaSteps(brX: () => TyE2eTestBrowser, who: St) {
    it(`${who} looks at preview links to Maria's pages:
            There're 1 broken link preview...  TyTLNPV_SEEOWN`, async () => {
      const sel = utils.makePreviewBrokenSelector('InternalLink');
      await brX().topic.waitForExistsInPost(c.FirstReplyNr, sel, { howMany: 1 });
    });
    it(`... the one to Maria's CatBC page — it's access restricted`, async () => {
      const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: mariasPrivPageUrl,
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-EdMMSEEADDCATPERM-ABX94WN_',
            });
      await brX().topic.waitForExistsInPost(c.FirstReplyNr, sel, { howMany: 1 });
    });
    it(`... but the link preview to Maria's page in CatBC2 works — CatBC2 is public`, async () => {
      await brX().topic.waitForExistsInPost(c.FirstReplyNr,
            utils.makePreviewOkSelector('InternalLink', { url: mariasPubPageUrl }));
    });
  }

  it(`Michael goes to the Kittens page`, async () => {
    await michael_brA.go2(kittensUrl);
  });
  it(`... sees 7 backlinks: Michael's 5, Maria's 2 public  TyTLNBK_SEEOWN`, async () => {
    const backlinks = await michael_brA.topic.backlinks.getBacklinkUrlsAndTitles();
    checkBacklinks(backlinks, { ...michaelsPrivBacklinkPagesById, ...publBacklinkPagesById });
  });

  // (Checks link previews in the page body.)
  addCheckLinkPreviewsToMichaelSteps(() => michael_brA, "Michael");

  // (Checks link previews in Maria's reply.)
  addCheckLinkPreviewsToMariaSteps(() => michael_brA, "Michael");

  // The end.


  // ========================================================================
  // Helper fns
  // ========================================================================


  function postTopicInEachCat(brX: () => TyE2eTestBrowser, who: St,
          pagesByCatSlug: PagesByCatSlug) {
    it(`${who} posts a topic in each category`, async () => {
      for (let cat of allCats) {
        logBoring(`${who} posts in ${cat.name} ...`)
        const title = `${who}_in_${cat.name}`;
        // TESTS_MISSING: Could include cat name in body text, and compare w later. Oh well.
        const bodyTxt = `Hi ${who}_wants_help`;    // Could:  + `_in_${cat.name}`
        await brX().go2('/latest/' + cat.slug);
        await brX().complex.createAndSaveTopic({
                title,
                // (The generated regex wouldn't work if we tried to match too much.)
                bodyMatchAfter: bodyTxt,
                body: bodyTxt +
                    // So we can check if links from only-see-own pages are left out,
                    // when showing incoming links. [links_from_see_own] [links_to_see_own]
                    // (This expands to a link preview — everyone can see the kittens page.)
                    '\n\n' + kittensUrl,
                });
        const url = await brX().getUrl();
        const id = await brX().getPageId();
        pagesByCatSlug[cat.slug] = { id, url, title };
      }
    });
  }

  function checkNewTopicEmails(emails, cats, aboutWho: Member, aboutWhoName: St) {
    for (let i = 0; i < emails.length; ++i) {
      const cat = cats[i];
      logBoring(`Checking new topic email at ix ${i},  category ${cat.name}`);
      const email = emails[i];
      const bodyHtml: St = email.bodyHtmlText;
      assert.includes(bodyHtml, `${aboutWhoName}_in_${cat.name}`);
      assert.includes(bodyHtml, `${aboutWhoName}_wants_help`);
      // The author's username is in the email.
      assert.includes(bodyHtml, `>${aboutWho.username}</`); // between <i>..</i> tags
    }
  }

  function addReplyInEachCatStep(brX: () => TyE2eTestBrowser, who: St, toWho: St,
        cats, pagesByCatSlug: PagesByCatSlug) {
    it(`${who} replies to ${toWho} in cats ${j2s(cats)}`, async () => {
      for (let cat of cats) {
        const topic = pagesByCatSlug[cat.slug];
        logBoring(`${who} posts in ${cat.name}, page ${topic?.title} ...`)
        await brX().go2(topic.url);
        await brX().complex.replyToOrigPost(`I, ${who}, shall_help_${toWho}_in_${cat.slug}`);
      }
    });
  }

  function checkReplyEmails(emails, cats, who: Member, whoName: St, toWho: St) {
    for (let i = 0; i < emails.length; ++i) {
      const cat = cats[i];
      logBoring(`Checking reply email at ix ${i},  category ${cat.name}`)
      const email = emails[i];
      const bodyHtml: St = email.bodyHtmlText;
      assert.includes(bodyHtml, `I, ${whoName}, shall_help_${toWho}_in_${cat.slug}`);
      assert.includes(bodyHtml, `>${who.username}</`); // between <i>..</i> tags
    }
  }


  function addSearchTestSteps(who: St, brX: () => TyE2eTestBrowser,
          ps: { seeMichaelsPriv: Bo, seeMariasPriv: Bo, linkFromKittensToMichaelsPage?: Bo }) {
    const michaelPrivTopicTitle = 'Michael_in_CatBC';
    const michaelPrivComt = `"${itIsImportant}"`;
    const michaelPublTopicTitle = 'Michael_in_CatB';
    const mariaPrivTopicTitle = 'Maria_in_CatAC';
    const mariaPublTopicTitle = 'Maria_in_CatBC2';
    const shallHelpMariaSearchPhrase = 'shall_help_Maria_in_cat shall_help_Maria_in_catbc';
    const shallHelpMichaelSearchPhrase = (
        // Not  "shall_help_Michael_in_category-a", instead
        // just "shall_help_Michael_in_category", otherwise we'll find the word "a" (a/an).
        'shall_help_Michael_in_cat shall_help_Michael_in_category shall_help_Michael_in_catbc');

    it(`${who} searches & finds Michael's private topic: ${ps.seeMichaelsPriv}`, async () => {
      await brX().topbar.searchFor(michaelPrivTopicTitle);
      if (ps.seeMichaelsPriv) {
        await brX().searchResultsPage.waitForAssertNumPagesFound(michaelPrivTopicTitle, 1);
        logBoring(`Check link URL ...`)
        await brX().searchResultsPage.assertResultLinksAre(['/-11/michaelincatbc']);
      }
      else {
        await brX().searchResultsPage.assertPhraseNotFound(michaelPrivTopicTitle);
      }
    });

    it(`... finds Michael's public topic`, async () => {
      const expected = ['/-10/michaelincatb'];
      if (ps.linkFromKittensToMichaelsPage) {
        // The title of page `michaelPublTopicTitle` (which is 'Michael_in_CatB') has been
        // link-preview included in the HTML on the Kittens page,  TyTLNPV_SEEOWN
        // so we find it too.
        expected.push('/help-from-kittens');
      }
      await brX().searchResultsPage.searchForUntilNumPagesFound(michaelPublTopicTitle,
            expected.length);
      logBoring(`Check link URL ...`)
      await brX().searchResultsPage.assertResultLinksAre(expected);
    });

    it(`... finds Maria's private topic: ${ps.seeMariasPriv}`, async () => {
      if (ps.seeMariasPriv) {
        await brX().searchResultsPage.searchForUntilNumPagesFound(mariaPrivTopicTitle, 1);
        logBoring(`Check link URL ...`)
        await brX().searchResultsPage.assertResultLinksAre(['/-4/mariaincatac']);
      }
      else {
        await brX().searchResultsPage.searchForWaitForResults(mariaPrivTopicTitle);
        await brX().searchResultsPage.assertPhraseNotFound(mariaPrivTopicTitle);
      }
    });

    it(`... finds Maria's public topic`, async () => {
      await brX().searchResultsPage.searchForUntilNumPagesFound(mariaPublTopicTitle, 1);
      logBoring(`Check link URL ...`)
      await brX().searchResultsPage.assertResultLinksAre(['/-7/mariaincatbc2']);
    });

    it(`... finds Memah's private replies to Maria: ${ps.seeMariasPriv} `, async () => {
      if (ps.seeMariasPriv) {
        await brX().searchResultsPage.searchForUntilNumPagesFound(shallHelpMariaSearchPhrase, 3);
        logBoring(`Check link URLs ...`)
        await brX().searchResultsPage.assertResultLinksAre([
                      '/-4/mariaincatac#post-2',
                      '/-6/mariaincatbc#post-2',
                      '/-7/mariaincatbc2#post-2'], { anyOrder: true });
      }
      else {
        // Sees only Memah's public reply to Maria on page Maria_in_CatBC2.
        await brX().searchResultsPage.searchForUntilNumPagesFound(shallHelpMariaSearchPhrase, 1);
        logBoring(`Check link URLs ...`)
        await brX().searchResultsPage.assertResultLinksAre([
                      '/-7/mariaincatbc2#post-2']);
      }
    });

    it(`... finds Memah's private replies to Michael: ${ps.seeMichaelsPriv}`, async () => {
      if (ps.seeMichaelsPriv) {
        await brX().searchResultsPage.searchForUntilNumPagesFound(shallHelpMichaelSearchPhrase, 3);
        logBoring(`Check link URLs ...`)
        await brX().searchResultsPage.assertResultLinksAre([
                      '/-8/michaelincata#post-2',
                      '/-10/michaelincatb#post-2',
                      '/-11/michaelincatbc#post-2'], { anyOrder: true });
      }
      else {
        // Sees only Memah's public reply to Michael on page Michael_in_CatB.
        await brX().searchResultsPage.searchForUntilNumPagesFound(shallHelpMichaelSearchPhrase, 1);
        logBoring(`Check link URLs ...`)
        await brX().searchResultsPage.assertResultLinksAre([
                      '/-10/michaelincatb#post-2']);
      }
    });

    it(`... finds Michael's private reply to Memah: ${ps.seeMichaelsPriv}`, async () => {
      if (ps.seeMichaelsPriv) {
        await brX().searchResultsPage.searchForUntilNumPagesFound(itIsImportant, 1);
        logBoring(`Check link URLs ...`)
        await brX().searchResultsPage.assertResultLinksAre([
                      '/-11/michaelincatbc#post-3']);
      }
      else {
        await brX().searchResultsPage.searchForWaitForResults(itIsImportant);
        await brX().searchResultsPage.assertPhraseNotFound(itIsImportant);
      }
    });
  }

  /// Asserts that there are backlinks to the pages in `pagesById`.
  /// And that there are no more backlinks than those.
  ///
  /// Maybe [break_out_checkBacklinks_fn]?
  function checkBacklinks(
        actualBacklinks: { url: St, title: St }[],
        expectedPagesById: { [pageId: PageId]: Page }) {

    // The `actualBacklinks` param looks like:
    // [{ "url": "/-12", "title": "Michael_in_CatBC2" },
    //  { "url": "/-5",  "title": "Maria_in_CatB"     },
    //  ...]
    //
    // `expectedPagesById` looks like:   {
    //   "3": { "id": "3", "url": "http://e2e-test-cid-0-0-now-7487.localhost/-3/mariaincata",
    //         "title":"Maria_in_CatA" },
    //   "4": { "id": "4", "url": "http://e2e-test-cid-0-0-now-7487.localhost/-4/mariaincatac",
    //         "title": "Maria_in_CatAC" },
    //   ...
    //  }

    const tooManyLinks = [];
    const linksLeft = { ...expectedPagesById };

    for (let backlink of actualBacklinks) {
      // Extract page id from url. All urls are like:  "/-pageId" right now (Sept 2024)
      // but let's use a regex that works with complete urls.  [ty_url_fmt]
      // 'https://ex.com/-4/ab/cd?q=p'.replace(/(https?:\/\/[^/]+)?\/-([^/]+).*/, '$2')
      const fromPageId = backlink.url.replace(/(https?:\/\/[^/]+)?\/-([^/]+).*/, '$2');
      const page = expectedPagesById[fromPageId];
      if (!page) {
        tooManyLinks.push(backlink);
      }
      delete linksLeft[fromPageId];
    }

    assert.that(!tooManyLinks.length && _.isEmpty(linksLeft),
        `Backlinks error — too many links, and/or links missing:\n`+
        `    tooManyLinks: ${j2s(tooManyLinks)}\n` +
        `    linksLeft: ${j2s(linksLeft)}\n` +
        `    actualBacklinks: ${j2s(actualBacklinks)}\n` +
        `    expectedPagesById: ${j2s(expectedPagesById)}`);
  }

});

