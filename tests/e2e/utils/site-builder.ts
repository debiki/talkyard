/// <reference path="../test-types.ts"/>
/// <reference path="../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../modules/definitely-typed/node/node.d.ts"/>
import log = require('./log-and-die');
import make = require('./make');
declare function require(...whatever): any;

import _ = require('lodash');
import assert = require('assert');
import c = require('../test-constants');


let buildSite = function(site?: SiteData) {

  if (!site) {
    site = make.emptySiteOwnedByOwen();
  }

  let api = {
    getSite: function(): SiteData {
      return site;
    },


    addForumPageAndRootCategory: function(opts: {
      id: string,
      folder?: string,
      rootCategoryId: number,
      defaultCategoryId: number,
      authorId?: number,
      title?: string,
      introText?: string,
    }): Page {
      let forumPage = api.addPage({
        id: opts.id,
        folder: opts.folder || '/',
        showId: false,
        slug: '',
        role: c.TestPageRole.Forum,
        title: opts.title || "Forum Title",
        body: opts.introText || "Forum intro text.",
        categoryId: opts.rootCategoryId,
        authorId: opts.authorId || 1,    // [commonjs] SystemUserId
      });

      let rootCategory = make.rootCategoryWithIdFor(opts.rootCategoryId, forumPage);
      rootCategory.defaultCategoryId = opts.defaultCategoryId;
      site.categories.push(rootCategory);

      return forumPage;
    },


    addCategoryNoAboutPage: function(forumPage: Page, opts: {
      id: number,
      parentCategoryId?: number,
      name: string,
      slug: string,
      description: string,
      unlisted?: boolean,
      staffOnly?: boolean,
      deletedAtMs?: number,
    }) {
      assert(!opts.deletedAtMs || opts.deletedAtMs >= forumPage.createdAtMs);
      var category = make.categoryWithIdFor(opts.id, forumPage);
      category.parentId = opts.parentCategoryId;
      category.name = opts.name;
      category.slug = opts.slug;
      category.description = opts.description;
      category.unlisted = opts.unlisted;
      category.staffOnly = opts.staffOnly;
      category.deletedAtMs = opts.deletedAtMs;
      site.categories.push(category);
      return category;
    },


    addCategoryWithAboutPage: function(forumPage: Page, opts: {
      id: number,
      parentCategoryId: number,
      name: string,
      slug: string,
      unlisted?: boolean,
      staffOnly?: boolean,
      deletedAtMs?: number,
      aboutPageText: string,
    }) {
      let optsWithDescr: any = _.assign({ description: opts.aboutPageText }, opts);
      let category = api.addCategoryNoAboutPage(forumPage, optsWithDescr);
      api.addPage({
        id: `about_cat_${opts.slug}`,
        folder: '/',
        showId: false,
        slug: `about-cat-${opts.slug}`,
        role: c.TestPageRole.About,
        title: `About category ${opts.name}`,
        body: opts.aboutPageText,
        categoryId: category.id,
        authorId: 1,
      });
      return category;
    },


    addPage: function(opts: {
      id: string,
      folder: string,
      showId: boolean,
      slug: string,
      role: PageRole,
      title: string,
      body: string,
      categoryId?: CategoryId,
      authorId: UserId,
    }) {
      let page = make.page(opts);
      let path = make.pagePath(opts.id, opts.folder, opts.showId, opts.slug);
      site.pages.push(page);
      site.pagePaths.push(path);

      // Page title.
      site.posts.push(make.post({
        page: page,
        nr: 0,
        approvedSource: opts.title,
        approvedHtmlSanitized: opts.title,
      }));

      // Page body.
      site.posts.push(make.post({
        page: page,
        nr: 1,
        approvedSource: opts.body,
        approvedHtmlSanitized: `<p>${opts.body}</p>`,
      }));

      return _.assign({}, opts, page, path);
    },


    addLargeForum: function(opts: { title: string, introText?: string }): LargeTestForum {
      let forum = {
        siteData: site,
        forumPage: null,
        members: {
          owen: site.members[0],
          mons: make.memberModeratorMons(),
          modya: make.memberModeratorModya(),
          maria: make.memberMaria(),
          michael: make.memberMichael(),
          mallory: make.memberMallory(),
        },
        guests: {
          gunnar: make.guestGunnar(),
        },
        topics: <any> {},
        categories: <any> {},
      };

      site.members.push(forum.members.mons);
      site.members.push(forum.members.modya);
      site.members.push(forum.members.maria);
      site.members.push(forum.members.michael);
      site.members.push(forum.members.mallory);
      site.guests.push(forum.guests.gunnar);

      _.each(site.members, (m: Member) => m.trustLevel = c.TestTrustLevel.Basic);

      let rootCategoryId = 1;
      let defaultCategoryId = 2;
      let categoryBId = 3;
      let staffOnlyCategoryId = 4;
      let unlistedCategoryId = 5;
      let deletedCategoryId = 6;

      let forumPage = forum.forumPage = api.addForumPageAndRootCategory({
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

      forum.categories.categoryB = api.addCategoryWithAboutPage(forumPage, {
        id: categoryBId,
        parentCategoryId: rootCategoryId,
        name: "CategoryB",
        slug: 'category-b',
        aboutPageText: "Category B description.",
      });

      forum.categories.staffOnlyCategory = api.addCategoryWithAboutPage(forumPage, {
        id: staffOnlyCategoryId,
        parentCategoryId: rootCategoryId,
        name: "Staff Only",
        slug: 'staff-only',
        aboutPageText: "Staff only category description.",
        staffOnly: true,
      });

      forum.categories.unlistedCategory = api.addCategoryWithAboutPage(forumPage, {
        id: unlistedCategoryId,
        parentCategoryId: rootCategoryId,
        name: "Unlisted Cat",
        slug: 'unlisted-cat',
        aboutPageText: "Unlisted category description.",
        unlisted: true,
      });

      forum.categories.deletedCategory = api.addCategoryWithAboutPage(forumPage, {
        id: deletedCategoryId,
        parentCategoryId: rootCategoryId,
        name: "Deleted Category",
        slug: 'deleted-category',
        aboutPageText: "Deleted category description.",
        deletedAtMs: forumPage.createdAtMs + 1000 * 3600 * 24,
      });

      // ---- Pages

      forum.topics.aboutCategoryA = { title: 'About category CategoryA' };
      forum.topics.aboutCategoryB = { title: 'About category CategoryB' };
      forum.topics.aboutUnlistedCategory = { title: 'About category Unlisted Cat' };
      forum.topics.aboutStaffOnlyCategory = { title: 'About category Staff Only' };
      forum.topics.aboutDeletedCategory = { title: 'About category Deleted Category' };

      forum.topics.byMariaCategoryA = api.addPage({
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
      forum.topics.byMariaCategoryB = api.addPage({
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
    }
  };

  return api;
};


export = buildSite;
