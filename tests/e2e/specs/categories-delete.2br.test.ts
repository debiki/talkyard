/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
// import fs = require('fs');  EMBCMTS
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let michael: Member;
let michael_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: CatABTestForum;

const searchWord = 'searchWord';

let topicCatAUrl: St;
const topicCatATitle = 'topicCatATitle ' + searchWord;
const topicCatABody = 'topicCatABody';

let topicCatBUrl: St;
const topicCatBTitle = 'topicCatBTitle ' + searchWord;
const topicCatBBody= 'topicCatBBody';



describe(`categories-delete.2br   TyTE2ECATDEL01`, () => {

  it(`construct site`, () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "Some E2E Test",
      members: undefined,
    });

    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owen_brA = richBrowserA;

    maria = forum.members.maria;
    maria_brB = richBrowserB;
    michael = forum.members.michael;
    michael_brB = richBrowserB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });



  // ----- Create topics   (dupl code [03RGM234])


  it(`Maria goes to Cat A`, () => {
    maria_brB.forumTopicList.goHere({
          origin: site.origin, categorySlug: forum.categories.catA.slug });
    maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });

  it(`... posts a topic`, () => {
    maria_brB.complex.createAndSaveTopic({ title: topicCatATitle, body: topicCatABody });
    topicCatAUrl = maria_brB.getUrl();
  });

  it(`Maria goes to Cat B`, () => {
    maria_brB.forumTopicList.goHere({ categorySlug: forum.categories.catB.slug });
  });

  it(`... posts another topic`, () => {
    maria_brB.complex.createAndSaveTopic({
          title: topicCatBTitle, body: topicCatBBody });
    topicCatBUrl = maria_brB.getUrl();
  });

  it(`Maria leaves, Michael arrives`, () => {
    maria_brB.topbar.clickLogout();
    michael_brB.complex.loginWithPasswordViaTopbar(michael);
  });



  // ----- Can access everything before


  it(`Michael sees the page   ttt`, () => {
    michael_brB.refresh2();
    michael_brB.assertPageTitleMatches(topicCatBTitle);
  });

  it(`... he sees the category too, in the category tree  ttt`, () => {
    michael_brB.forumCategoryList.goHere();
    // We won't delete cat A.
    assert.ok(michael_brB.forumCategoryList.isCategoryVisible(
          forum.categories.catA.name));
    // But we'll delete cat B (later).
    assert.ok(michael_brB.forumCategoryList.isCategoryVisible(  // [.111VIS]
          forum.categories.catB.name));
    assert.eq(michael_brB.forumCategoryList.numCategoriesVisible(), 2);
  });

  it(`... he searches for the page ...`, () => {
    michael_brB.goToSearchPage(searchWord);
  });

  it(`... finds it, and the other page too   ttt`, () => {
    michael_brB.searchResultsPage.waitForAssertNumPagesFound(searchWord, 2)
    michael_brB.searchResultsPage.assertResultPageTitlePresent(topicCatATitle);
    michael_brB.searchResultsPage.assertResultPageTitlePresent(topicCatBTitle);
  });

  it(`... sees the topic in the Cat B topics list   ttt`, () => {
    michael_brB.forumTopicList.goHere({ categorySlug: forum.categories.catB.slug });
    michael_brB.forumTopicList.waitForTopicVisible(topicCatBTitle);
  });



  // ----- Delete category


  it(`Owen goes to Cat A`, () => {
    owen_brA.forumTopicList.goHere({
          origin: site.origin, categorySlug: forum.categories.catA.slug });
    owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  it(`Owen wants to delete Cat A`, () => {
    owen_brA.forumButtons.clickEditCategory();
  });

  it(`... won't work — it's the default category`, () => {
    owen_brA.waitForVisible('.e_0Del');
  });

  it(`Oh well. Owen goes to Cat B instead`, () => {
    owen_brA.categoryDialog.cancel();
    owen_brA.forumTopicList.goHere({ categorySlug: forum.categories.catB.slug });
  });

  it(`... deletes Cat B`, () => {
    owen_brA.forumButtons.clickEditCategory();
    owen_brA.categoryDialog.deleteCategory();
  });



  // ----- Cannot access topics


  it(`Michael attempts to post a new topic in Cat B`, () => {
    michael_brB.complex.createAndSaveTopic({
          title: "Won't Work", body: "Some text.", resultInError: true });
  });

  it(`... won't work — category deleted`, () => {
    michael_brB.assertNotFoundError({ whyNot: 'CategroyDeleted', shouldBeErrorDialog: true });
  });

  it(`He can no longer list topics in the category`, () => {
    michael_brB.refresh2();
  });

  it(`... there's a "Category not found" error`, () => {
    michael_brB.forumCategoryList.assertCategoryNotFoundOrMayNotAccess();
  });

  it(`... he doesn't see the category in the category tree`, () => {
    michael_brB.forumCategoryList.goHere();
    assert.ok(michael_brB.forumCategoryList.isCategoryVisible(
          forum.categories.catA.name));
    // Deleted:
    assert.not(michael_brB.forumCategoryList.isCategoryVisible(  // [.111VIS]
          forum.categories.catB.name));
    assert.eq(michael_brB.forumCategoryList.numCategoriesVisible(), 1);
  });

  it(`He jumps directly to Maria's topic`, () => {
    michael_brB.go2(topicCatBUrl);
  });

  it(`... but cannot access it`, () => {
    michael_brB.assertNotFoundError({ whyNot: 'CategroyDeleted' });
  });

  it(`He cannot search-and-find the page in the deleted category`, () => {
    michael_brB.goToSearchPage(searchWord);
  });

  it(`... he finds only Maria's page in Cat A`, () => {
    michael_brB.searchResultsPage.waitForAssertNumPagesFound(searchWord, 1)
    michael_brB.searchResultsPage.assertResultPageTitlePresent(topicCatATitle);
  });

  it(`He can access Maria's topic in Cat A though`, () => {
    michael_brB.go2(topicCatAUrl);
    michael_brB.assertPageTitleMatches(topicCatATitle);
  });

  it(`... and see topics in Cat A  (none from Cat B)`, () => {
    michael_brB.topbar.clickHome();
    michael_brB.forumTopicList.waitForTopicVisible(topicCatATitle);
    michael_brB.forumTopicList.assertNumVisible(1);  // not topicCatBTitle
  });

  it(`... and he can post a topic in Cat A  (it's the default cat)`, () => {
    michael_brB.complex.createAndSaveTopic({ title: "Will Work", body: "Some text." });
  });



  // ----- Admin access deleted category?


  /* Hmm currently the deleted cat isn't listed here:
  it(`Owen can see the deleted category?`, () => {
    owen_brA.forumCategoryList.goHere();
    assert.ok(michael_brB.forumCategoryList.isCategoryVisible(
          forum.categories.catA.name));
    // Deleted, but Owen is admin:
    assert.ok(michael_brB.forumCategoryList.isCategoryVisible(  // [.111VIS]
          forum.categories.catB.name));
  });

  it(`... he opens it`, () => {
    owen_brA.forumCategoryList.openCategory(forum.categories.catB.name);
  }); */



  // ----- Undelete category


  it(`Owen undeletes the deleted category`, () => {
    owen_brA.forumButtons.clickEditCategory();
    owen_brA.categoryDialog.undeleteCategory();
  });



  // ----- Can access topics again


  it(`Now Michael sees the category in the categories list, again`, () => {
    michael_brB.topbar.clickHome();
    michael_brB.forumButtons.clickViewCategories();
    michael_brB.forumCategoryList.waitForCategories();
    assert.eq(michael_brB.forumCategoryList.isCategoryVisible(
          forum.categories.catA.name), true);
    // It's back:
    assert.eq(michael_brB.forumCategoryList.isCategoryVisible(  // [.111VIS]
          forum.categories.catB.name), true);
    assert.eq(michael_brB.forumCategoryList.numCategoriesVisible(), 2);
  });

  it(`... and can open the category`, () => {
    michael_brB.forumCategoryList.openCategory(forum.categories.catB.name);
  });

  it(`... see the topics inside`, () => {
    michael_brB.forumTopicList.waitForTopicVisible(topicCatBTitle);
  });

  it(`... access the topics`, () => {
    michael_brB.forumTopicList.navToTopic(topicCatBTitle);
    michael_brB.assertPageTitleMatches(topicCatBTitle);
  });

  it(`... and can search-and-find it, again`, () => {
    michael_brB.goToSearchPage(searchWord);
  });

  it(`... finds it, and the other page too`, () => {
    michael_brB.searchResultsPage.waitForAssertNumPagesFound(searchWord, 2)
    michael_brB.searchResultsPage.assertResultPageTitlePresent(topicCatATitle);
    michael_brB.searchResultsPage.assertResultPageTitlePresent(topicCatBTitle); // here
  });

});

