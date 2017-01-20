/// <reference path="../test-types.ts"/>
/// <reference path="../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import * as _ from 'lodash';
import c = require('../test-constants');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import assert = require('assert');
import logAndDie = require('../utils/log-and-die');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

var everyone;
var owen;
var maria;

var idAddress;
let categoryToDeleteId = 3;
let categoryToDeleteName = "To-Delete";
let categoryToDeleteSlug = "to-delete";

describe("categories", () => {

  it("initialize people", () => {
    browser.perhapsDebugBefore();
    everyone = browser;
    owen = _.assign(browserA, pagesFor(browserA), make.memberOwenOwner());
    maria = _.assign(browserB, pagesFor(browserB), make.memberMaria());
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('categories');
    let category = make.categoryWithIdFor(categoryToDeleteId, make.findForumPage(site.pages));
    category.name = categoryToDeleteName;
    category.slug = categoryToDeleteSlug;
    site.categories.push(category);
    site.pages.push(make.page({
      id: 'page_one',
      role: c.TestPageRole.Discussion,
      authorId: owen.id,
    }));
    site.pagePaths.push(make.pagePath('page_one', '/', true));
    site.members.push(make.memberModeratorMons());
    site.members.push(make.memberMaria());
    idAddress = server.importSiteData(site);
  });

  it("A stranger sees page_one in the topic list", () => {

  });

  it("... and can access page_one", () => {

  });

  it("Maria logs in, sees the page in the topic list", () => {

  });

  it("... and she can access it too", () => {

  });

  it("... and search and find that page", () => {
  });

  it("Owen logs in, views categories", () => {
    owen.go(idAddress.origin);
    owen.topbar.clickLogin();
    owen.loginDialog.loginWithPassword(owen);
    owen.forumButtons.clickViewCategories();
    owen.waitForAtLeast(2, '.esForum_cats_cat .forum-title');
    owen.assertTextMatches('.esForum_cats_cat .forum-title', /Uncategorized/, /default/);
    owen.assertTextMatches('.esForum_cats_cat .forum-title', categoryToDeleteName);
  });

  it("Owen deletes the To-Delete category", () => {
  });

  it("Maria can no longer access the page in the deleted category", () => {
  });

  it("... and she no longer sees the category in the category tree", () => {
  });

  it("... and cannot access the category topic list", () => {
  });

  it("... and cannot search-and-find the page in the deleted category", () => {
  });

  it("Maria leaves, a stranger arrives", () => {
  });

  it("The stranger also cannot longer access the page in the deleted category", () => {
  });

  it("... and doesn't see the category in the category tree", () => {
  });

  it("... and cannot access the category topic list", () => {
  });

  it("... and cannot search-and-find the page in the deleted category", () => {
  });

  it("Owen undeletes the category", () => {
  });

  it("Now the stranger sees the page in the topic list, again", () => {
  });

  it("... and can search-and-find it, again", () => {
  });

  it("... and can access it, again", () => {
  });

  it("Maria returns", () => {
  });

  it("... and sees the category in the category tree, and the page too, again", () => {
  });

  it("... and can access the category topic list", () => {
  });

  it("... and she can search-and-find it, too", () => {

  });

  it("... and can access it, again, too", () => {
  });

  it("Done", function() {
    everyone.perhapsDebug();
  });

});

