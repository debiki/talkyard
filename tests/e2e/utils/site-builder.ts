/// <reference path="../test-types2.ts"/>
/// <reference path="../../../to-talkyard/src/to-talkyard.d.ts" />

import assert = require('assert');
import log = require('./log-and-die');
import make = require('./make');
declare function require(...whatever: any[]): any;

import _ = require('lodash');
import c = require('../test-constants');


function makeSiteOwnedByOwenBuilder() {
  return buildSite();
}


function buildSite(site?: SiteData) {

  if (!site) {
    site = make.emptySiteOwnedByOwen();
  }

  const api = {
    theSite: site,

    getSite: function(): SiteData {
      return site;
    },

    defaultCreatedAtMs: make.defaultCreatedAtMs,

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
      parentCategoryId?: number,
      name: string,
      slug: string,
      description: string,
      unlisted?: boolean,
      deletedAtMs?: number,
    }): CategoryJustAdded {
      assert(!opts.deletedAtMs || opts.deletedAtMs >= forumPage.createdAtMs);
      const category = make.categoryWithIdFor(opts.id, forumPage);
      category.parentId = opts.parentCategoryId;
      category.name = opts.name;
      category.slug = opts.slug;
      category.description = opts.description;
      category.unlisted = opts.unlisted;
      category.deletedAtMs = opts.deletedAtMs;
      site.categories.push(category);
      return <CategoryJustAdded> category;
    },


    addCategoryWithAboutPage: function(forumPage: PageJustAdded, opts: {
      id: number,
      parentCategoryId: number,
      name: string,
      slug: string,
      unlisted?: boolean,
      deletedAtMs?: number,
      aboutPageText: string,
    }): CategoryJustAdded {
      const optsWithDescr: any = _.assign({ description: opts.aboutPageText }, opts);
      const category = api.addCategoryNoAboutPage(forumPage, optsWithDescr);
      const page = api.addPage({
        dbgSrc: 'StBldrCatWAbt',
        id: `about_cat_${opts.slug}`.substr(0, 32),
        folder: '/',
        showId: false,
        slug: `about-cat-${opts.slug}`,
        role: c.TestPageRole.About,
        title: `About category ${opts.name}`,
        body: opts.aboutPageText,
        categoryId: category.id,
        authorId: c.SystemUserId,
      });
      category.aboutPage = page;
      return <CategoryJustAdded> category;
    },


    addPage: function(opts: PageToAdd): PageJustAdded {
      const page = make.page(opts);
      const path = make.pagePath(opts.id, opts.folder, opts.showId, opts.slug);
      site.pages.push(page);
      site.pagePaths.push(path);

      // Page title.
      site.posts.push(make.post({
        page: page,
        nr: c.TitleNr,
        approvedSource: opts.title,
        approvedHtmlSanitized: opts.title,
      }));

      // Page body.
      site.posts.push(make.post({
        page: page,
        nr: c.BodyNr,
        approvedSource: opts.body,
        approvedHtmlSanitized: `<p>${opts.body}</p>`,
      }));

      return <PageJustAdded> _.assign({}, opts, page, path);
    },


    addPost: function(testPostData: NewTestPost) {
      site.posts.push(make.post(testPostData));
    },


    addEmptyForum: function(opts: { title: string, introText?: string, members?: string[] })
          : EmptyTestForum {
      const members = opts.members || ['mons', 'modya', 'regina', 'corax', 'maria', 'michael', 'mallory'];
      const forum = {
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
          maria: _.includes(members, 'maria') ? make.memberMaria() : undefined,
          michael: _.includes(members, 'michael') ? make.memberMichael() : undefined,
          mallory: _.includes(members, 'mallory') ? make.memberMallory() : undefined,
        },
        guests: {
          gunnar: make.guestGunnar(),
        },
        topics: <any> {},
        categories: <any> {},
      };

      if (forum.members.adam) site.members.push(forum.members.adam);
      if (forum.members.alice) site.members.push(forum.members.alice);
      if (forum.members.mons) site.members.push(forum.members.mons);
      if (forum.members.modya) site.members.push(forum.members.modya);
      if (forum.members.corax) site.members.push(forum.members.corax);
      if (forum.members.regina) site.members.push(forum.members.regina);
      if (forum.members.trillian) site.members.push(forum.members.trillian);
      if (forum.members.maria) site.members.push(forum.members.maria);
      if (forum.members.michael) site.members.push(forum.members.michael);
      if (forum.members.mallory) site.members.push(forum.members.mallory);
      site.guests.push(forum.guests.gunnar);

      _.each(site.members, (m: Member) => m.trustLevel = c.TestTrustLevel.Basic);
      if (forum.members.corax) forum.members.corax.trustLevel = c.TestTrustLevel.CoreMember;
      if (forum.members.regina) forum.members.regina.trustLevel = c.TestTrustLevel.Regular;

      const rootCategoryId = 1;
      const defaultCategoryId = 2;

      const forumPage = forum.forumPage = api.addForumPageAndRootCategory({
        id: 'fmp',
        rootCategoryId: rootCategoryId,
        defaultCategoryId: defaultCategoryId,
        title: opts.title,
        introText: opts.introText,
      });

      // ---- Categories

      forum.categories.categoryA = api.addCategoryWithAboutPage(forumPage, {
        id: defaultCategoryId,
        parentCategoryId: rootCategoryId,
        name: "CategoryA",
        slug: 'category-a',
        aboutPageText: "Category A description.",
      });
      api.addDefaultCatPerms(site, forum.categories.categoryA.id, 1);

      return forum;
    },


    addLargeForum: function(opts: { title: string, introText?: string, members?: string[] })
          : LargeTestForum {
      const forum: LargeTestForum = <LargeTestForum> api.addEmptyForum(opts);
      const forumPage: PageJustAdded = forum.forumPage;
      const categoryBId = 3;
      const staffOnlyCategoryId = 4;
      const unlistedCategoryId = 5;
      const deletedCategoryId = 6;

      forum.categories.categoryB = api.addCategoryWithAboutPage(forumPage, {
        id: categoryBId,
        parentCategoryId: forumPage.categoryId,
        name: "CategoryB",
        slug: 'category-b',
        aboutPageText: "Category B description.",
      });

      forum.categories.staffOnlyCategory = api.addCategoryWithAboutPage(forumPage, {
        id: staffOnlyCategoryId,
        parentCategoryId: forumPage.categoryId,
        name: "Staff Only",
        slug: 'staff-only',
        aboutPageText: "Staff only category description.",
      });

      forum.categories.unlistedCategory = api.addCategoryWithAboutPage(forumPage, {
        id: unlistedCategoryId,
        parentCategoryId: forumPage.categoryId,
        name: "Unlisted Cat",
        slug: 'unlisted-cat',
        aboutPageText: "Unlisted category description.",
        unlisted: true,
      });

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

      forum.topics.aboutCategoryA = { title: 'About category CategoryA' };
      forum.topics.aboutCategoryB = { title: 'About category CategoryB' };
      forum.topics.aboutUnlistedCategory = { title: 'About category Unlisted Cat' };
      forum.topics.aboutStaffOnlyCategory = { title: 'About category Staff Only' };
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

    addDefaultCatPerms: (site: SiteData, categoryId: CategoryId, startPermissionId: PermissionId) => {
      site.permsOnPages.push({
        id: startPermissionId,
        forPeopleId: c.EveryoneId,
        onCategoryId: categoryId,
        mayEditOwn: true,
        mayCreatePage: true,
        mayPostComment: true,
        maySee: true,
        maySeeOwn: true,
      });

      site.permsOnPages.push({
        id: startPermissionId + 1,
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
    },

  };

  return api;
}

const fns = { buildSite, makeSiteOwnedByOwenBuilder };

export = fns;

