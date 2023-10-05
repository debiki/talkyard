/// <reference path="../test-types2.ts"/>
/// <reference path="../../../to-talkyard/src/to-talkyard.d.ts" />

import assert from './ty-assert';
import * as log from './log-and-die';
import * as make from './make';

import * as _ from 'lodash';
import c from '../test-constants';
import { dieIf } from './log-and-die';

import { NewTestVote as VoteToInsert } from '../test-types2';

export function makeSiteOwnedByOwenBuilder() {
  return buildSite();
}


// Also in make.ts, for posts.  [_next_sth_id]

let nextTagId = 1001;
export function getAndBumpNextTagId() {
  nextTagId += 1;
  return nextTagId - 1;
}

let nextTypeId = 1001;
export function getAndBumpNextTypeId() {
  nextTypeId += 1;
  return nextTypeId - 1;
}

export function buildSite(site: SiteData | U = undefined, ps: { okInitEarly?: boolean } = {}) {
  // Wdio seems to retry, if we just throw an exception here. So exit the process instead
  // (because the test is buggy, better fix the bug).
  log.dieAndExitIf(!(global as any).wdioBeforeHookHasRun && !ps.okInitEarly,
      "Calling buildSite(site?) before the wdio.conf.ts before() hook has run — " +
      "that means this spec hasn't been inited properly yet; variables might be " +
      "`undefined` [TyE603AKRTDH24]");

  if (!site) {
    site = make.emptySiteOwnedByOwen(ps);
  }

  const api = {
    theSite: site,

    getSite: function(): SiteData2 {
      return site;
    },

    settings: (settings: Partial<TestSiteSettings>) => {
      site.settings = { ...site.settings, ...settings };
    },

    defaultCreatedAtMs: make.DefaultCreatedAtMs,  // oops, was small d —> undef


    addForumPageAndRootCategory: function(opts: {
      id: string,
      folder?: string,
      rootCategoryId: number,
      defaultCategoryId: number,
      authorId?: number,
      title?: string,
      introText?: string,
    }): PageJustAdded {
      const forumPage = api.addPage({
        dbgSrc: 'StBldrFrm',
        id: opts.id,
        folder: opts.folder || '/',
        showId: false,
        slug: '',
        role: c.TestPageRole.Forum,
        title: opts.title || "Forum Title",
        body: opts.introText || "Forum intro text.",
        categoryId: opts.rootCategoryId,
        authorId: opts.authorId || c.SystemUserId,
      });

      const rootCategory = make.rootCategoryWithIdFor(opts.rootCategoryId, forumPage);
      rootCategory.defaultCategoryId = opts.defaultCategoryId;
      site.categories.push(rootCategory);

      return forumPage;
    },


    addCategoryNoAboutPage: function(forumPage: PageJustAdded, opts: {
      id: number,
      extId?: ExtId,
      parentCategoryId?: number,
      name: string,
      slug: string,
      description: string,
      unlistCategory?: boolean,
      unlistTopics?: boolean,
      position?: Nr,
      deletedAtMs?: number,
    }): CategoryJustAdded {
      assert.ok(!opts.deletedAtMs || opts.deletedAtMs >= forumPage.createdAtMs);
      const category = make.categoryWithIdFor(opts.id, forumPage);
      category.extId = opts.extId;
      category.parentId = opts.parentCategoryId;  // note: different name
      category.name = opts.name;
      category.slug = opts.slug;
      category.position = opts.position;
      category.description = opts.description;
      category.unlistCategory = opts.unlistCategory;
      category.unlistTopics = opts.unlistTopics;
      category.deletedAtMs = opts.deletedAtMs;
      site.categories.push(category);
      return <CategoryJustAdded> category;
    },


    addCategoryWithAboutPage: function(forumPage: PageJustAdded, opts: CatToAdd)
            : CatJustAdded {
      // REMOVE optsWithDescr, instead, will load category description via PageStuff. [502RKDJWF5]
      const optsWithDescr: any = _.assign({ description: opts.aboutPageText }, opts);
      const category = api.addCategoryNoAboutPage(forumPage, optsWithDescr);

      const page = api.addPage({
        dbgSrc: 'StBldrCatWAbt',
        // There's a small risk this id will collide with another page in the site,
        // duing import, if the tests includes many other pages.
        id: '' + (opts.id + 19000),
        folder: '/',
        showId: false,
        slug: `about-cat-${opts.slug}`,
        role: c.TestPageRole.About,
        title: `About category ${opts.name}`,
        body: opts.aboutPageText,
        categoryId: category.id,
        authorId: c.SystemUserId,
        createdAtMs: opts.createdAtMs,
      });

      category.aboutPage = page;
      return <CategoryJustAdded> category;
    },


    addCategoryWithAboutPageAndPerms: function(forumPage: PageJustAdded, catToAdd: CatToAdd,
            permsOpts?: 'FullMembersMayEditWiki'): CatJustAdded {
      const cat = api.addCategoryWithAboutPage(forumPage, catToAdd);
      api.addDefaultCatPerms(site, cat.id, -1, permsOpts);
      return <CatJustAdded> cat;
    },


    addPage: function(opts: PageToAdd): PageJustAdded {
      const page = make.page(opts);
      site.pages.push(page);

      // Page path.
      let path: PagePathWithId;
      if (opts.folder || opts.slug) {
        path = make.pagePath(opts.id, opts.folder || '/', opts.showId, opts.slug);
        site.pagePaths.push(path);
      }

      // Page title.
      site.posts.push(make.post({
        page: page,
        nr: c.TitleNr,
        approvedSource: opts.title,
        approvedHtmlSanitized: opts.title,
      }));

      // Page body.
      const bodyPost = make.post({
        page: page,
        nr: c.BodyNr,
        approvedSource: opts.body,
        approvedHtmlSanitized: `<p>${opts.body}</p>`,
      });
      site.posts.push(bodyPost);

      for (let tag of (opts.tags || [])) {
        api.addTag({ ...tag, onPostId: bodyPost.id });
      }

      return <PageJustAdded> _.assign({}, opts, page, path || {});
    },


    updatePage: function(pageId: PageId, updFn: (p: PageJustAdded) => Vo) {
      const page: PageJustAdded | U = site.pages.find(p => p.id === pageId);
      dieIf(!page, `No such page to update: ${pageId}, e2e test code broken? TyE2RMF3SP`);
      updFn(page);
    },


    addPost: function(testPostData: NewTestPost) {
      site.posts.push(make.post(testPostData));
    },


    addVote: function(testVoteData: VoteToInsert) {
      site.postVotes_forTests.push({ ...testVoteData });
    },


    addTag: function(tag: TagV0) {
      const id = getAndBumpNextTagId();
      site.tags.push({ id, ...tag });
    },


    addType: function(type: TypeV0): TypeV0 {
      const id = getAndBumpNextTypeId();
      const withId = { id, ...type };
      site.types.push(withId);
      return withId;
    },


    addGuest: function(guest: any) {
      site.guests.push(guest);
    },


    addMmember: function(username: string): Member {
      const member = make.member(username, {});
      (site as SiteData2).members.push(member);
      return member;
    },


    addMinions: function(ps: { oneWordName: string, howMany: number,
          mixedCaseUsernameStartWithUpper: boolean }): Member[] {
      const newMinions = [];
      for (let i = 0; i < ps.howMany; ++i) {
        const minion = make.minion({
          oneWordNameAndNumber: ps.oneWordName + (ps.howMany >= 2 ? i + 1 : ''),
          mixedCaseUsernameStartWithUpper: ps.mixedCaseUsernameStartWithUpper,
        });
        site.members.push(minion);
        newMinions.push(minion);
      }
      return newMinions;
    },


    addLoadTestGooseUsers: function(ps: { howMany: number, nextNr: Nr, trustLevel: Nr }): Member[] {
      const newUsers = [];
      for (let nr = ps.nextNr; nr < ps.nextNr + ps.howMany; ++nr) {
        const user = make.loadTestGoose({ nr, trustLevel: ps.trustLevel });
        site.members.push(user);
        newUsers.push(user);
      }
      return newUsers;
    },


    addEmptyForum: function(opts: { title: string, introText?: string,
          members?: WellKnownMemberUsername[], categoryAExtId?: St,
          categoryPerms?: 'FullMembersMayEditWiki' })
          : EmptyTestForum {
      const members = opts.members ||
              ['mons', 'modya', 'regina', 'corax', 'memah', 'maria', 'michael', 'mallory'];
      const forum: Partial<EmptyTestForum> = {
        siteData: site,
        forumPage: <PageToMake> undefined,
        members: {
          owen: site.members[0],
          adam: _.includes(members, 'adam') ? make.memberAdminAdam() : undefined,
          alice: _.includes(members, 'alice') ? make.memberAdminAlice() : undefined,
          mons: _.includes(members, 'mons') ? make.memberModeratorMons() : undefined,
          modya: _.includes(members, 'modya') ? make.memberModeratorModya() : undefined,
          corax: _.includes(members, 'corax') ? make.memberCorax() : undefined,
          regina: _.includes(members, 'regina') ? make.memberRegina() : undefined,
          trillian: _.includes(members, 'trillian') ? make.memberTrillian() : undefined,
          mei: _.includes(members, 'mei') ? make.memberMei() : undefined,
          memah: _.includes(members, 'memah') ? make.memberMemah() : undefined,
          maria: _.includes(members, 'maria') ? make.memberMaria() : undefined,
          maja: _.includes(members, 'maja') ? make.memberMaja() : undefined,
          michael: _.includes(members, 'michael') ? make.memberMichael() : undefined,
          mallory: _.includes(members, 'mallory') ? make.memberMallory() : undefined,
        },
        guests: {
        },
        topics: {},
        categories: <any> {},
      };

      if (forum.members.adam) site.members.push(forum.members.adam);
      if (forum.members.alice) site.members.push(forum.members.alice);
      if (forum.members.mons) site.members.push(forum.members.mons);
      if (forum.members.modya) site.members.push(forum.members.modya);
      if (forum.members.corax) site.members.push(forum.members.corax);
      if (forum.members.regina) site.members.push(forum.members.regina);
      if (forum.members.trillian) site.members.push(forum.members.trillian);
      if (forum.members.mei) site.members.push(forum.members.mei);
      if (forum.members.memah) site.members.push(forum.members.memah);
      if (forum.members.maria) site.members.push(forum.members.maria);
      if (forum.members.maja) site.members.push(forum.members.maja);
      if (forum.members.michael) site.members.push(forum.members.michael);
      if (forum.members.mallory) site.members.push(forum.members.mallory);

      // What? Only do if unspecified! Fix some other time ...
      _.each(site.members, (m: Member) => m.trustLevel = c.TestTrustLevel.Basic);
      // ... then can remove these 3 lines:
      if (forum.members.corax) forum.members.corax.trustLevel = c.TestTrustLevel.CoreMember;
      if (forum.members.regina) forum.members.regina.trustLevel = c.TestTrustLevel.Regular;
      if (forum.members.trillian) forum.members.trillian.trustLevel = c.TestTrustLevel.Trusted;

      const rootCategoryId = 1;
      const defaultCategoryId = 2;

      const forumPage = forum.forumPage = api.addForumPageAndRootCategory({
        id: c.FirstPageId,
        rootCategoryId: rootCategoryId,
        defaultCategoryId: defaultCategoryId,
        title: opts.title,
        introText: opts.introText,
      });

      forum.categories.rootCat = forum.categories.rootCategory = { id: rootCategoryId };

      // ---- Categories

      forum.categories.catA =
            forum.categories.categoryA = api.addCategoryWithAboutPage(forumPage, {
        id: defaultCategoryId,
        parentCategoryId: rootCategoryId,
        name: "CategoryA",
        slug: 'category-a',
        aboutPageText: "Category A description.",
        extId: opts.categoryAExtId,
      });
      api.addDefaultCatPerms(site, forum.categories.categoryA.id, 1, opts.categoryPerms);

      return forum as EmptyTestForum;
    },


    addTwoCatsForum: function(opts: { title: string, introText?: string,
          members?: WellKnownMemberUsername[], categoryAExtId?: St, categoryExtId?: string,
          categoryPerms?: 'FullMembersMayEditWiki' }): TwoCatsTestForum {

      const forum: TwoCatsTestForum = <TwoCatsTestForum> api.addEmptyForum(opts);
      const forumPage: PageJustAdded = forum.forumPage;

      forum.categories.staffCat =
            forum.categories.staffOnlyCategory = api.addCategoryWithAboutPage(forumPage, {
        id: 3,  // 1 = root, 2 = default category A, 3 = this, staff
        parentCategoryId: forumPage.categoryId,
        name: "Staff Only",
        slug: 'staff-only',
        aboutPageText: "Staff only category description.",
      });

      const morePerms = !!opts.categoryPerms;

      // Staff only:
      // If 'FullMembersMayEditWiki', Category A has 3 perms:
      // 1) for Everyone, 2) for Full-members-to-edit-wiki, and 3) for Staff.
      // Then, the next availabe perm id is 3 + 1 = 4  (+ 1 is the root cat).
      // REFACTOR use fn findNextPermId() instead? [refctr_nxt_prmid]
      const staffPermsId = morePerms ? 4 : 3;
      site.permsOnPages.push({
        id: staffPermsId,
        forPeopleId: c.StaffId,
        onCategoryId: forum.categories.staffOnlyCategory.id,
        mayEditPage: true,
        mayEditComment: true,
        mayEditWiki: true,
        mayEditOwn: true,
        mayDeletePage: true,
        mayDeleteComment: true,
        mayCreatePage: true,
        mayPostComment: true,
        maySee: true,
        maySeeOwn: true,
      });

      return forum;
    },


    addCatABForum: function(opts: { title: St, introText?: St,
          everythingCreatedAtSameMs?: WhenMs,
          members?: WellKnownMemberUsername[], categoryAExtId?: St,
          categoryPerms?: 'FullMembersMayEditWiki' }): CatABTestForum {

      const forum: CatABTestForum = api.addTwoCatsForum(opts) as CatABTestForum;
      const forumPage: PageJustAdded = forum.forumPage;

      // If 'FullMembersMayEditWiki', Category A has 3 perms:
      // 1) for Everyone, 2) for Full-members-to-edit-wiki, and 3) for Staff.
      // Then, the next availabe perm id is 3 + 1 = 4  (+ 1 is the root cat).
      // REFACTOR use fn findNextPermId() instead? [refctr_nxt_prmid]
      const morePerms = !!opts.categoryPerms;
      const startPermsId = (morePerms ? 4 : 3) + 1;   // +1  is for the staff cat

      forum.categories.catB = api.addCategoryWithAboutPage(forumPage, {
        id: 4,  // 1 = root, 2 = category A, 3 = staff, 4 = this
        parentCategoryId: forumPage.categoryId,
        name: "CatB",
        slug: 'cat-b',
        aboutPageText: "Category B description.",
        createdAtMs: opts.everythingCreatedAtSameMs,
      });
      api.addDefaultCatPerms(site, forum.categories.catB.id,
            startPermsId, opts.categoryPerms);

      return forum;
    },


    // Later, add an option to make cat B members-only?  [cat_B_members_only]
    addCatABTrustedForum: function(opts: { title: St, introText?: St,
          everythingCreatedAtSameMs?: WhenMs,
          members?: WellKnownMemberUsername[], categoryAExtId?: St,
           }):CatABTrustedTestForum {

      const forum: CatABTrustedTestForum = api.addCatABForum({
        ...opts, categoryPerms: 'FullMembersMayEditWiki' }) as CatABTrustedTestForum;

      const forumPage: PageJustAdded = forum.forumPage;

      // Category A and B has 3 perms:
      // 1) for Everyone, 2) for Full-members-to-edit-wiki, and 3) for Staff.
      // Then, the next availabe perm id is 1 + 3*2 + 1 = 7  (+ 1 is the root cat).
      // REFACTOR use fn findNextPermId() instead? [refctr_nxt_prmid]
      //const startPermsId = 1 + 3 + 3 + 1;   // root cat, A, B, staff

      forum.categories.trustedCat = api.addCategoryWithAboutPage(forumPage, {
        id: 5,  // 1 = root, 2 = category A, 3 = staff, 4 = B, 5 = this
        parentCategoryId: forumPage.categoryId,
        name: "TrustedCat",
        slug: 'trusted-cat',
        aboutPageText: "Trusted Category description.",
        createdAtMs: opts.everythingCreatedAtSameMs, // USE
      });

      const nextPermsId = 3 + 3 + 1 + 1;  // A + B + staff + 1?
      site.permsOnPages.push({
        id: nextPermsId,
        forPeopleId: c.TrustedMembersId,
        onCategoryId: forum.categories.trustedCat.id,
        mayEditWiki: true,
        mayEditOwn: true,
        mayCreatePage: true,
        mayPostComment: true,
        maySee: true,
        maySeeOwn: true,
      });
      site.permsOnPages.push({
        id: nextPermsId + 1,
        forPeopleId: c.StaffId,
        onCategoryId: forum.categories.trustedCat.id,
        mayEditPage: true,
        mayEditComment: true,
        mayEditWiki: true,
        mayEditOwn: true,
        mayDeletePage: true,
        mayDeleteComment: true,
        mayCreatePage: true,
        mayPostComment: true,
        maySee: true,
        maySeeOwn: true,
      });

      return forum;
    },


    addSubCatsForum: function(opts: { title: St, introText?: St,
          members?: WellKnownMemberUsername[], categoryAExtId?: St,
          categoryPerms?: 'FullMembersMayEditWiki' }): SubCatsTestForum {

      const forum: SubCatsTestForum = api.addCatABForum({
        ...opts, categoryPerms: 'FullMembersMayEditWiki' }) as SubCatsTestForum;

      const forumPage: PageJustAdded = forum.forumPage;

      // Cat A —> { Sub Cat AA, Sub Cat AB }

      forum.categories.subCatAA = api.addCategoryWithAboutPage(forumPage, {
        id: api.nextPermId(),
        parentCategoryId: forum.categories.catA.id,
        name: "SubCatAA",
        slug: 'sub-cat-aa',
        aboutPageText: "Sub Cat AA descr.",
      });
      api.addDefaultCatPerms(site, forum.categories.subCatAA.id,
            api.nextPermId(), opts.categoryPerms);

      forum.categories.subCatAB = api.addCategoryWithAboutPage(forumPage, {
        id: api.nextPermId(),
        parentCategoryId: forum.categories.catA.id,
        name: "SubCatAB",
        slug: 'sub-cat-ab',
        aboutPageText: "Sub Cat AB descr.",
      });
      api.addDefaultCatPerms(site, forum.categories.subCatAB.id,
            api.nextPermId(), opts.categoryPerms);

      // Cat B —> { Sub Cat BA, Sub Cat BB }

      forum.categories.subCatBA = api.addCategoryWithAboutPage(forumPage, {
        id: api.nextPermId(),
        parentCategoryId: forum.categories.catB.id,
        name: "SubCatBA",
        slug: 'sub-cat-ba',
        aboutPageText: "Sub Cat BA descr.",
      });
      api.addDefaultCatPerms(site, forum.categories.subCatBA.id,
            api.nextPermId(), opts.categoryPerms);

      forum.categories.subCatBB = api.addCategoryWithAboutPage(forumPage, {
        id: api.nextPermId(),
        parentCategoryId: forum.categories.catB.id,
        name: "SubCatBB",
        slug: 'sub-cat-bb',
        aboutPageText: "Sub Cat BB descr.",
      });
      api.addDefaultCatPerms(site, forum.categories.subCatBB.id,
            api.nextPermId(), opts.categoryPerms);

      return forum;
    },


    addTwoPagesForum: function(opts: { title: string, introText?: string,
          members?: WellKnownMemberUsername[], categoryExtId?: string,
          categoryPerms?: 'FullMembersMayEditWiki' })
          : TwoPagesTestForum {

      const forum: TwoPagesTestForum = <TwoPagesTestForum> api.addTwoCatsForum(opts);
      const forumPage: PageJustAdded = forum.forumPage;

      // ---- A "Specific Category"

      // id: 4, because 1 = root, 2 = default category A, 3 = staff cat.
      const specificCategoryId = 4;
      forum.categories.specificCat =
            forum.categories.specificCategory = api.addCategoryWithAboutPage(forumPage, {
        id: specificCategoryId,
        extId: opts.categoryExtId,
        parentCategoryId: forumPage.categoryId,
        name: "Specific Category",
        slug: 'specific-category',
        aboutPageText: "The Specific Category description.",
      });

      // REFACTOR use fn findNextPermId() instead? [refctr_nxt_prmid]
      const morePerms = !!opts.categoryPerms;
      const staffPermsId = morePerms ? 4 : 3; // 1 & 2 = for the default category

      api.addDefaultCatPerms(site, specificCategoryId, staffPermsId + 1,
              opts.categoryPerms);

      // ---- Two pages

      dieIf(!forum.members.michael, "Add member Michael, he's a page author [TyE503MQS]");
      dieIf(!forum.members.maria, "Add member Maria, she's a page author [TyE503MQ7]");

      forum.topics.byMariaCatA = forum.topics.byMariaCategoryA = api.addPage({
        dbgSrc: 'LgFrmTstTpcs',
        id: 'byMariaCategoryA',
        folder: '/',
        showId: false,
        slug: 'by-maria-category-a',
        role: c.TestPageRole.Discussion,
        title: 'By Maria in CategoryA title',
        body: 'By Maria in CategoryA, text text text.',
        categoryId: forum.categories.categoryA.id,
        authorId: forum.members.maria.id,
      });

      forum.topics.byMichaelCatA = forum.topics.byMichaelCategoryA = api.addPage({
        dbgSrc: 'LgFrmTstTpcs',
        id: 'byMichaelCategoryA',
        folder: '/',
        showId: false,
        slug: 'by-michael-category-a',
        role: c.TestPageRole.Question,
        title: 'By Michael in CategoryA title',
        body: 'By Michael in CategoryA, text text text.',
        categoryId: forum.categories.categoryA.id,
        authorId: forum.members.michael.id,
      });

      return forum;
    },


    addLargeForum: function(opts: { title: string, introText?: string,
          members?: WellKnownMemberUsername[] })
          : LargeTestForum {
      const forum: LargeTestForum = <LargeTestForum> api.addEmptyForum(opts);
      const forumPage: PageJustAdded = forum.forumPage;
      const categoryBId = 3;
      const staffOnlyCategoryId = 4;
      const unlistedCategoryId = 5;
      const deletedCategoryId = 6;

      forum.categories.catB =
            forum.categories.categoryB = api.addCategoryWithAboutPage(forumPage, {
        id: categoryBId,
        parentCategoryId: forumPage.categoryId,
        name: "CategoryB",
        slug: 'category-b',
        aboutPageText: "Category B description.",
      });

      forum.categories.staffCat =
            forum.categories.staffOnlyCategory = api.addCategoryWithAboutPage(forumPage, {
        id: staffOnlyCategoryId,
        parentCategoryId: forumPage.categoryId,
        name: "Staff Only",
        slug: 'staff-only',
        aboutPageText: "Staff only category description.",
      });

      forum.categories.unlistedCat =
            forum.categories.unlistedCategory = api.addCategoryWithAboutPage(forumPage, {
        id: unlistedCategoryId,
        parentCategoryId: forumPage.categoryId,
        name: "Unlisted Cat",
        slug: 'unlisted-cat',
        aboutPageText: "Unlisted category description.",
        unlistCategory: true,
      });

      forum.categories.deletedCat =
            forum.categories.deletedCategory = api.addCategoryWithAboutPage(forumPage, {
        id: deletedCategoryId,
        parentCategoryId: forumPage.categoryId,
        name: "Deleted Category",
        slug: 'deleted-category',
        aboutPageText: "Deleted category description.",
        deletedAtMs: forumPage.createdAtMs + 1000 * 3600 * 24,
      });

      // ---- Permissions on categories

      api.addDefaultCatPerms(site, forum.categories.categoryB.id, 3);
      api.addDefaultCatPerms(site, forum.categories.unlistedCategory.id, 5);
      api.addDefaultCatPerms(site, forum.categories.deletedCategory.id, 7);

      // Staff only:
      site.permsOnPages.push({
        id: 9,
        forPeopleId: c.StaffId,
        onCategoryId: forum.categories.staffOnlyCategory.id,
        mayEditPage: true,
        mayEditComment: true,
        mayEditWiki: true,
        mayEditOwn: true,
        mayDeletePage: true,
        mayDeleteComment: true,
        mayCreatePage: true,
        mayPostComment: true,
        maySee: true,
        maySeeOwn: true,
      });

      // ---- Pages

      forum.topics.aboutCatA =
      forum.topics.aboutCategoryA = { title: 'About category CategoryA' };
      forum.topics.aboutCatB =
      forum.topics.aboutCategoryB = { title: 'About category CategoryB' };
      forum.topics.aboutUnlistedCat =
      forum.topics.aboutUnlistedCategory = { title: 'About category Unlisted Cat' };
      forum.topics.aboutStaffCat = { title: 'About category Staff Only' };
      forum.topics.aboutStaffOnlyCategory = forum.topics.aboutStaffCat;
      forum.topics.aboutDeletedCat =
      forum.topics.aboutDeletedCategory = { title: 'About category Deleted Category' };

      forum.topics.byMariaCategoryA = api.addPage({
        dbgSrc: 'LgFrmTstTpcs',
        id: 'byMariaCategoryA',
        folder: '/',
        showId: false,
        slug: 'by-maria-category-a',
        role: c.TestPageRole.Discussion,
        title: 'By Maria in CategoryA title',
        body: 'By Maria in CategoryA, text text text.',
        categoryId: forum.categories.categoryA.id,
        authorId: forum.members.maria.id,
      });
      forum.topics.byMariaCategoryANr2 = api.addPage({
        dbgSrc: 'LgFrmTstTpcs',
        id: 'byMariaCategoryA_2',
        folder: '/',
        showId: false,
        slug: 'by-maria-category-a-2',
        role: c.TestPageRole.Discussion,
        title: 'By Maria in CategoryA nr 2 title',
        body: 'By Maria in CategoryA nr 2, text text text, 2.',
        categoryId: forum.categories.categoryA.id,
        authorId: forum.members.maria.id,
      });
      forum.topics.byMariaCategoryANr3 = api.addPage({
        dbgSrc: 'LgFrmTstTpcs',
        id: 'byMariaCategoryA_3',
        folder: '/',
        showId: false,
        slug: 'by-maria-category-a-3',
        role: c.TestPageRole.Discussion,
        title: 'By Maria in CategoryA nr 3 title',
        body: 'By Maria in CategoryA nr 3, text text text, 3.',
        categoryId: forum.categories.categoryA.id,
        authorId: forum.members.maria.id,
      });

      forum.topics.byMariaCategoryB = api.addPage({
        dbgSrc: 'LgFrmTstTpcs',
        id: 'byMariaCategoryB',
        folder: '/',
        showId: false,
        slug: 'by-maria-category-b',
        role: c.TestPageRole.Discussion,
        title: 'By Maria in CategoryB title',
        body: 'By Maria in CategoryB, text text text.',
        categoryId: forum.categories.categoryB.id,
        authorId: forum.members.maria.id,
      });

      forum.topics.byMariaStaffOnlyCat = api.addPage({
        dbgSrc: 'LgFrmTstTpcs',
        id: 'byMariaStaffOnlyCat',
        folder: '/',
        showId: false,
        slug: 'by-maria-staff-only-cat',
        role: c.TestPageRole.Discussion,
        title: 'By Maria in Staff-Only cat title',
        body: 'By Maria in Staff-Only cat, text text text.',
        categoryId: forum.categories.staffOnlyCategory.id,
        authorId: forum.members.maria.id,
      });

      forum.topics.byMariaUnlistedCat = api.addPage({
        dbgSrc: 'LgFrmTstTpcs',
        id: 'byMariaUnlistedCat',
        folder: '/',
        showId: false,
        slug: 'by-maria-unlisted-cat',
        role: c.TestPageRole.Discussion,
        title: 'By Maria in Unlisted cat title',
        body: 'By Maria in Unlisted cat, text text text.',
        categoryId: forum.categories.unlistedCategory.id,
        authorId: forum.members.maria.id,
      });

      forum.topics.byMariaDeletedCat = api.addPage({
        dbgSrc: 'LgFrmTstTpcs',
        id: 'byMariaDeletedCat',
        folder: '/',
        showId: false,
        slug: 'by-maria-deleted-cat',
        role: c.TestPageRole.Discussion,
        title: 'By Maria in Deleted cat title',
        body: 'By Maria in Deleted cat, text text text.',
        categoryId: forum.categories.deletedCategory.id,
        authorId: forum.members.maria.id,
      });

      forum.topics.byMichaelCategoryA = api.addPage({
        dbgSrc: 'LgFrmTstTpcs',
        id: 'byMichaelCategoryA',
        folder: '/',
        showId: false,
        slug: 'by-michael-category-a',
        role: c.TestPageRole.Question,
        title: 'By Michael in CategoryA title',
        body: 'By Michael in CategoryA, text text text.',
        categoryId: forum.categories.categoryA.id,
        authorId: forum.members.michael.id,
      });

      return forum;
    },

    addDefaultCatPerms: (site: SiteData, categoryId: CatId, startPermissionId: PermissionId,
            categoryPerms?: 'FullMembersMayEditWiki') => {

      let nextPermId = startPermissionId === -1 ? site.lastPermId + 1 : startPermissionId;

      const everyonesPerms = {
        id: nextPermId,
        forPeopleId: c.EveryoneId,
        onCategoryId: categoryId,
        mayEditOwn: true,
        mayCreatePage: true,
        mayPostComment: true,
        maySee: true,
        maySeeOwn: true,
      };
      site.permsOnPages.push(everyonesPerms);

      nextPermId += 1;

      if (categoryPerms === 'FullMembersMayEditWiki') {
        site.permsOnPages.push({
          ...everyonesPerms,
          id: nextPermId,
          forPeopleId: c.FullMembersId,
          mayEditWiki: true,
        });
        nextPermId += 1;
      }

      site.permsOnPages.push({
        id: nextPermId,
        forPeopleId: c.StaffId,
        onCategoryId: categoryId,
        mayEditPage: true,
        mayEditComment: true,
        mayEditWiki: true,
        mayEditOwn: true,
        mayDeletePage: true,
        mayDeleteComment: true,
        mayCreatePage: true,
        mayPostComment: true,
        maySee: true,
        maySeeOwn: true,
      });

      site.lastPermId = nextPermId;
    },

    nextPermId: (): Nr => {
      let nextId = 1;
      for (let perms of api.getSite().permsOnPages) {
        if (perms.id >= nextId) {
          nextId = perms.id + 1;
        }
      }
      return nextId;
    },

  };

  return api;
}
