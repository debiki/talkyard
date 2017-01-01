/// <reference path="../test-types.ts"/>
/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/node/node.d.ts"/>
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
      rootCategoryId?: number,
      authorId?: number,
      title?: string,
      introText?: string,
    }): Page {
      var forumPage = make.page({
        id: opts.id,
        role: c.TestPageRole.Forum,
        categoryId: opts.rootCategoryId || 1,
        authorId: opts.authorId || 1,    // [commonjs] SystemUserId
      });

      site.pages.push(forumPage);
      site.pagePaths.push({
          folder: opts.folder || '/', pageId: forumPage.id, showId: false, slug: '' });

      // Forum title.
      site.posts.push(make.post({
        page: forumPage,
        nr: 0,
        approvedSource: opts.title || "Forum Title",
        approvedHtmlSanitized: opts.title || "Forum Title",
      }));

      // Forum intro text.
      site.posts.push(make.post({
        page: forumPage,
        nr: 1,
        approvedSource: opts.introText || "Forum intro text.",
        approvedHtmlSanitized: `<p>${opts.introText || "Intro text."}</p>`,
      }));

      let rootCategory = make.rootCategoryWithIdFor(opts.rootCategoryId, forumPage);
      site.categories.push(rootCategory);

      return forumPage;
    },


    addCategoryNoAboutPage: function(forumPage: Page, opts: {
      id: number,
      parentCategoryId?: number,
      name: string,
      slug: string,
      description: string,
      isDeleted: boolean,
    }) {
      var category = make.categoryWithIdFor(opts.id, forumPage);
      category.parentId = opts.parentCategoryId;
      category.name = opts.name;
      category.slug = opts.slug;
      category.description = opts.description;
      site.categories.push(category);
      return category;
    },


    addCategoryWithAboutPage: function(forumPage: Page, opts: {
      id: number,
      parentCategoryId: number,
      name: string,
      slug: string,
      isDefault?: boolean,
      isDeleted?: boolean,
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
        title: `About category ${name}`,
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
      return opts;
    },


    addLargeForum: function(opts: { title: string, introText?: string }) {
      let owen = make.memberOwenOwner();
      let mons = make.memberModeratorMons();
      let modya = make.memberModeratorModya();
      let maria = make.memberMaria();
      let michael = make.memberMichael();
      let mallory = make.memberMallory();
      let guest = make.guestGunnar();
      site.members.push(owen);
      site.members.push(mons);
      site.members.push(modya);
      site.members.push(maria);
      site.members.push(michael);
      site.members.push(mallory);
      site.guests.push(guest);

      let rootCategoryId = 1;

      let forumPage = api.addForumPageAndRootCategory({
        id: 'fmp',
        rootCategoryId: rootCategoryId,
        title: opts.title,
        introText: opts.introText,
      });

      let categoryA = api.addCategoryWithAboutPage(forumPage, {
        id: 3,
        parentCategoryId: rootCategoryId,
        name: "CategoryA",
        slug: 'category-a',
        aboutPageText: "Category A description.",
        isDefault: true,
      });

      let topicInCategoryAByMaria = api.addPage({
        id: 'topicInCategoryAByMaria',
        folder: '/',
        showId: false,
        slug: 'topicInCategoryAByMaria',
        role: c.TestPageRole.Discussion,
        title: 'TopicInCategoryA-by-Maria',
        body: 'Text text text.',
        categoryId: categoryA.id,
        authorId: maria.id,
      });
    }
  };

  return api;
};


export = buildSite;
