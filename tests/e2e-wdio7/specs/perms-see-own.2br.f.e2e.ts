/// <reference path="../test-types.ts"/>
// CR_MISSING

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

// CatA seeOwn: true, seeOthers: false
// CatAC inherits:  If can't see base cat, then, can't see sub cat. [see_sub_cat]
//
// CatB seeOthers: true
// CatBC seeOwn: true  (but seeOthers: false)
// CatBC2 seethers: true

const catA   = { slug: 'category-a', name: "CatA" };
const catAC  = { slug: 'cat-ac', name: "CatAC", id: 6 }; // Owen alters

const catB   = { slug: 'cat-b', name: "CatB" };
const catBC  = { slug: "catbc", name: "CatBC" }; // Owen creates
const catBC2 = {  slug: 'cat-bc2', name: "CatBC2", id: 7 };

// We'll post here last —> last email from here.
const lastCat = catBC2;

// Owen won't make these cats only-see-own. (CatAC will be see-own because CatA will be.)
const pubCats = [catB, lastCat];

// Owen makes CatA and CatBC only-see-own. CatAC becomes only-see-own too,
// since is a child of CatA. HMM
const privCats = [catA, catAC, catBC];

// Let's use this category order, when posting topics and checking for notf emails.
const allCats = [catA, catAC, catB, catBC, lastCat];


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
    await server.skipRateLimits(site.id);
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

  it(`... Full Members inherit Everyone's perms, and can edit wikis  TyTDEFCATPERMS`, async () => {
    const assertMay = owen_brA.categoryDialog.securityTab.assertMay;
    await assertMay('EditOthersTopics',       c.FullMembersId, false);
    await assertMay('EditOthersReplies',      c.FullMembersId, false);
    await assertMay('EditWikis',              c.FullMembersId, true);   // <——  wikis
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
    await owen_brA.categoryDialog.securityTab.assertMay('SeeOthers', c.FullMembersId, false);
  });
  it(`... but Staff still can — their group has all perms granted to it,
            rather than just inheriting from Everyone  TyTSTAFDEFPERMS`, async () => {
    await owen_brA.categoryDialog.securityTab.assertMay('SeeOthers', c.StaffId, true);
  });

  addAddSupportGroupSteps("CatBC");

  it(`Owen saves this new category CatBC`, async () => {
    await owen_brA.categoryDialog.submit();
  });



  postTopicInEachCat(() => maria_brB, "Maria", mariasPagesByCatSlug);


  it(`Memah gets notified of each of Maria's new topics`, async () => {
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


  it(`Memah gets notified of each of Michael's new topics`, async () => {
    const allEmails = await server.waitGetLastEmailsSentTo(
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
                        site.id, mallory.emailAddress, pubCats.length);
    // Skip the one's about Maria's topics.
    const emails = allEmails.slice(pubCats.length);
    logMessage(j2s(emails));
    checkNewTopicEmails(emails, pubCats, michael, "Michael");
  });

  it(`No other emails get sent`, async () => {
    // At most 15 per address hmm,  [R2AB067]
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, (allCats.length + pubCats.length * 2) * 2, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // [_dir_access_test]
  it(`Maria can't access Michael's private topics`, async () => {
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

  // Memah replies to Maria [_dir_access_test]
  //
  const memahToMariaCats = [catAC, catBC, catBC2]; // only catBC2 is public, others are see-own
  addReplyInEachCatStep(() => memah_brB, "Memah", "Maria", memahToMariaCats,
        mariasPagesByCatSlug);

  it(`Maria gets notified`, async () => {
    const allEmails = await server.waitGetLastEmailsSentTo(
                              site.id, maria.emailAddress, pubCats.length + memahToMariaCats.length);
    assert.eq(allEmails.length,
          pubCats.length + // Michael's publ posts
                memahToMariaCats.length, // Memah's replies to Maria
          `allEmails to Maria: ${j2s(allEmails)}`);

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
                1 + 1; // Memah's publ reply —> notf to Michael & Mallory
    assert.eq(num, numTotalEmailsExpected,
           `Emails sent to: ${addrsByTimeAsc}`);
  });



  // Memah replies to Michael [_dir_access_test]
  const memahToMichaelCats = [catA, catBC, catB]; // only CatB is public
  addReplyInEachCatStep(() => memah_brB, "Memah", "Michael", memahToMichaelCats,
        michaelsPagesByCatSlug);

  it(`Michael gets notified`, async () => {
    numTotalEmailsExpected += memahToMariaCats.length;
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

  const itIsImportant = `It is important to help Michael`;

  it(`Michael replies to Memah's reply to him in private CatBC  [_dir_access_test]`, async () => {
    await michael_brA.go2(michaelsPagesByCatSlug[catBC.slug].url);
    await michael_brA.complex.replyToOrigPost(itIsImportant);
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
  it(`... sees his own topics, and Memah's public topics`, async () => {
    await michael_brA.forumTopicList.assertTopicTitlesAreAndOrder([
            'Michael_in_CatBC',   // bumped by Michael's reply to Memah
            'Michael_in_CatB',    // bumped by Memah's reply to Michael
            'Michael_in_CatA',    //          – '' –
            'Maria_in_CatBC2',    // bumped by Memah's reply to Maria
            'Michael_in_CatBC2',  // Michael's last not-bumped topic
            'Michael_in_CatAC',   // FOK w Category AC
            'Maria_in_CatB',      // Maria's first publ topic
            'Ask the Kittens',
            ]);
  });

  // Break out fn: _see_public ?
  it(`Michael goes to Maria's posts page`, async () => {
    await michael_brA.userProfilePage.activity.posts.goHere(maria.username);
    await michael_brA.userProfilePage.activity.posts.waitForPostTextsVisible();
  });
  it(`... sees only Maria's two public posts`, async () => {
    await michael_brA.userProfilePage.activity.posts.assertExactly(pubCats.length);
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
    //Maria_in_CatBC2
    //Maria_in_CatB
  });
  it(`... sees only Maria's two public topics`, async () => {
    await michael_brA.userProfilePage.activity.topics.assertExactly(pubCats.length);
  });

  // Break out fn: _see_all ?
  it(`Michael goes to his own posts page`, async () => {
    await michael_brA.userProfilePage.activity.posts.goHere(michael.username);
    await michael_brA.userProfilePage.activity.posts.waitForPostTextsVisible();
  });
  it(`... sees all his posts, incl Michael's reply to Memah`, async () => {
    await michael_brA.userProfilePage.activity.posts.assertExactly(allCats.length + 1);
    // Michael_in_CatBC
    // Michael @michael11 hours ago
    // It is important to help Michael
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
    // Michael_in_CatBC2
    // Michael_in_CatBC
    // Michael_in_CatB
    // Michael_in_CatAC
    // Michael_in_CatA
  });

  it(`Michael goes to Memah's posts page`, async () => {
    await michael_brA.userProfilePage.activity.posts.goHere(memah.username);
    await michael_brA.userProfilePage.activity.posts.waitForPostTextsVisible();
  });
  it(`... sees Memah's "shall_help_" replies: 3 to Michael, 1 publ to Maria`, async () => {
    // And the Kittens page too.
    await michael_brA.userProfilePage.activity.posts.assertExactly(3 + 1 + 1);
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
    // Maria_in_CatBC2
    // Maria_in_CatBC
    // Maria_in_CatB
    // Maria_in_CatAC
    // Maria_in_CatA
  });
  it(`... sees all Maria's topics`, async () => {
    await memah_brB.userProfilePage.activity.topics.assertExactly(allCats.length);
  });

  // Break out fn: _see_all ?
  it(`Memah goes to Michael's posts page`, async () => {
    await memah_brB.userProfilePage.activity.posts.goHere(michael.username);
    await memah_brB.userProfilePage.activity.posts.waitForPostTextsVisible();
  });
  it(`... sees all Michal's posts, incl Michael's reply to Memah`, async () => {
    await memah_brB.userProfilePage.activity.posts.assertExactly(allCats.length + 1);
    // Michael_in_CatBC
    // Michael @michael11 hours ago
    // It is important to help Michael
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
    // Michael_in_CatBC2
    // Michael_in_CatBC
    // Michael_in_CatB
    // Michael_in_CatAC
    // Michael_in_CatA
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
  it(`... sees 10 backlinks: Maria's 5, Michael's 5  (incl both publ and priv)`, async () => {
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

    await memah_brB.complex.editPageBody(`\n\n` +
            `${privPageUrl}\n\n` +
            `${pubPageUrl}\n\n` +  // _Memah_2_Michael_link
            `${privSubCatPageUrl}\n\n`,
            { append: true, textAfterMatches: /https?:\/\/e2e-test-.*\/michaelincata/ });
  });

  addCheckLinkPreviewsToMichaelSteps(() => memah_brB, "Memah");
  
  function addCheckLinkPreviewsToMichaelSteps(brX: () => TyE2eTestBrowser, who: St) {
    it(`${who} looks at preview links:  There're 2 broken link previews ...  TEST MAP`, async () => {
      const sel = utils.makePreviewBrokenSelector('InternalLink');
      await brX().topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 2 });
    });
    it(`... the one to Michael's CatA page — it's access restricted`, async () => {
      const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: privPageUrl,
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-EdMMSEEADDCATPERM-ABX94WN_',
            });
      await brX().topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });
    });
    it(`... the one to CatAC, also access restricted`, async () => {
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
  it(`... sees 7 backlinks: Maria's 5, Michael's 2 public  TyTLNSEEOWN`, async () => {
    // [_links_from_see_own]
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

    await maria_brB.complex.replyToOrigPost(
            `${mariasPrivPageUrl}\n\n` +
            `${mariasPubPageUrl}\n\n`);
  });

  addCheckLinkPreviewsToMariaSteps(() => maria_brB, "Maria");
  
  function addCheckLinkPreviewsToMariaSteps(brX: () => TyE2eTestBrowser, who: St) {
    it(`${who} looks at preview links to Maria's pages:
            There're 1 broken link preview  TyTLNSEEOWN`, async () => {
      // [_links_to_see_own]
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
  it(`... sees 7 backlinks: Michael's 5, Maria's 2 public`, async () => {
    const backlinks = await michael_brA.topic.backlinks.getBacklinkUrlsAndTitles();
    checkBacklinks(backlinks, { ...michaelsPrivBacklinkPagesById, ...publBacklinkPagesById });
  });

  addCheckLinkPreviewsToMichaelSteps(() => michael_brA, "Michael");

  addCheckLinkPreviewsToMariaSteps(() => michael_brA, "Michael");


  function postTopicInEachCat(brX: () => TyE2eTestBrowser, who: St,
          pagesByCatSlug: PagesByCatSlug) {
    it(`${who} posts a topic in each category`, async () => {
      for (let cat of allCats) {
        logBoring(`${who} posts in ${cat.name} ...`)
        const title = `${who}_in_${cat.name}`;
        const bodyTxt = `Hi ${who}_wants_help`;
        await brX().go2('/latest/' + cat.slug);
        await brX().complex.createAndSaveTopic({
                title,
                bodyMatchAfter: bodyTxt,
                body: bodyTxt +
                    // So we can check if links from only-see-own pages are left out,
                    // when showing incoming links. [_links_from_see_own] [_links_to_see_own]
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
      logBoring(`Checking new topic email at ix ${i}`)
      const email = emails[i];
      const cat = cats[i];
      const bodyHtml: St = email.bodyHtmlText;
      assert.includes(bodyHtml, `${aboutWhoName}_in_${cat.name}`);
      assert.includes(bodyHtml, `${aboutWhoName}_wants_help`);
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
      logBoring(`Checking reply email at ix ${i}`)
      const email = emails[i];
      const cat = cats[i];
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

    it(`${who} searches & finds Michael's private topic: ${ps.seeMichaelsPriv}`, async () => {
      await brX().topbar.searchFor(michaelPrivTopicTitle);
      if (ps.seeMichaelsPriv) {
        await brX().searchResultsPage.waitForAssertNumPagesFound(michaelPrivTopicTitle, 1);
      }
      else {
        await brX().searchResultsPage.assertPhraseNotFound(michaelPrivTopicTitle);
      }
    });

    it(`... finds Michael's public topic`, async () => {
      await brX().searchResultsPage.searchForUntilNumPagesFound(michaelPublTopicTitle,
            1 + (ps.linkFromKittensToMichaelsPage ? 1 : 0));
    });

    it(`... finds Maria's private topic: ${ps.seeMariasPriv}`, async () => {
      if (ps.seeMariasPriv) {
        await brX().searchResultsPage.searchForUntilNumPagesFound(mariaPrivTopicTitle, 1);
      }
      else {
        await brX().searchResultsPage.searchForWaitForResults(mariaPrivTopicTitle);
        await brX().searchResultsPage.assertPhraseNotFound(mariaPrivTopicTitle);
      }
    });

    it(`... finds Maria's public topic`, async () => {
      await brX().searchResultsPage.searchForUntilNumPagesFound(mariaPublTopicTitle, 1);
    });

    /*
    it(`... finds Memah's reply to Maria: ${ps.seeMariasPriv} `, async () => {
      await michael_brA.searchResultsPage.searchForUntilNumPagesFound(__, 1);
    });

    it(`... finds Memah's reply to Michael: ${ps.seeMichaelsPriv}`, async () => {
      await michael_brA.searchResultsPage.searchForUntilNumPagesFound(__, 1);
    }); */
  }

  function checkBacklinks(backlinks: { url: St, title: St }[],
          pagesById: { [pageId: PageId]: Page }) {

    // `backlinks` looks like:
    // [{"url":"/-12","title":"Michael_in_CatBC2"}, {"url":"/-5","title":"Maria_in_CatB"}, ...]
    //
    // `pagesById` looks like:   {
    //   "3": { "id": "3", "url": "http://e2e-test-cid-0-0-now-7487.localhost/-3/mariaincata",
    //         "title":"Maria_in_CatA" },
    //   "4": { "id": "4", "url": "http://e2e-test-cid-0-0-now-7487.localhost/-4/mariaincatac",
    //         "title": "Maria_in_CatAC" },
    //   ...
    //  }

    const tooManyLinks = [];
    const linksLeft = { ...pagesById };

    for (let link of backlinks) {
      // Extract page id from url. All urls are like:  "/-pageId" right now (Sept 2024)
      // but let's use a regex that works with complete urls.  [ty_url_fmt]
      // 'https://ex.com/-4/ab/cd?q=p'.replace(/(https?:\/\/[^/]+)?\/-([^/]+).*/, '$2')
      const pageId = link.url.replace(/(https?:\/\/[^/]+)?\/-([^/]+).*/, '$2');
      const page = pagesById[pageId];
      if (!page) {
        tooManyLinks.push(link);
      }
      delete linksLeft[pageId];
    }

    assert.that(!tooManyLinks.length && _.isEmpty(linksLeft),
        `Backlinks error — too many links, and/or links missing:\n`+
        `    tooManyLinks: ${j2s(tooManyLinks)}\n` +
        `    linksLeft: ${j2s(linksLeft)}\n` +
        `    backlinks: ${j2s(backlinks)}\n` +
        `    pagesById: ${j2s(pagesById)}`);
  }

});

