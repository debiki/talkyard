/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

let everyonesBrowsers;
let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser;
let maja: Member;
let majasBrowser;
let strangersBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;  // or: LargeTestForum

const CustPkgsCatName = "Custom Pkgs Cat Name"
const CustPkgsExtId = 'cust_pkgs_cat_ext_id'

const UpsCatOnePosition = 55;
const UpsCatOneName = 'Ups Category One position ' + UpsCatOnePosition;
const UpsCatOneSlug = 'ups-category-one';
const UpsCatOneExtId = 'ups_cat_one_ext_id';
const UpsCatOneDescr = 'Upserted Cat One description.';

const UpsCatTwoPosition = 54;
const UpsCatTwoName = 'Ups Category Two pos ' + UpsCatTwoPosition;
const UpsCatTwoSlug = 'ups-category-two';
const UpsCatTwoExtId = 'ups_cat_two_ext_id';
const UpsCatTwoDescr = 'Upserted Cat Two description text text text longer a bit longer.';

const UpsCatTwoEditedPos = 57;
const UpsCatTwoEditedName = `Ups Cat 2 Edited pos ${UpsCatTwoEditedPos} was ${UpsCatTwoPosition}`;
const UpsCatTwoEditedSlug = 'ups-category-ed-two';
const UpsCatTwoEditedExtId = 'ups_cat_two_ext_id';
const UpsCatTwoEditedDescr = 'Upserted Cat Two EDITED descr.';

const UpsCatThreePosition = 56;
const UpsCatThreeName = 'Ups Category Three pos ' + UpsCatThreePosition;
const UpsCatThreeSlug = 'ups-category-three';
const UpsCatThreeExtId = 'ups_cat_hree_ext_id';
const UpsCatThreeDescr = 'Upserted Cat Three description.';



describe("api-upsert-categories  TyT94DFKHQC24", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Ups Cats E2E Test",
      members: ['owen', 'maja', 'maria', 'michael'],
    });
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
  });

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    richBrowserA = _.assign(browserA, pagesFor(browserA));
    richBrowserB = _.assign(browserB, pagesFor(browserB));

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    maja = forum.members.maja;
    majasBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });


  // ----- Owen enables API

  it("Owen goes to the admin area, the Features settings", () => {
    owensBrowser.adminArea.goToLoginSettings(siteIdAddress.origin, { loginAs: owen });
    owensBrowser.waitAndClick('#e_A_Ss_Features');
  });

  it("... and enables the API", () => {
    owensBrowser.waitAndClick('#te_EnblApi');
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("Owen goes to the API Secrets", () => {
    owensBrowser.adminArea.goToApi();
  });

  it("... generates an API secret", () => {
    owensBrowser.adminArea.apiTab.generateSecret();
  });

  let apiSecret: string;

  it("... copies the secret key", () => {
    apiSecret = owensBrowser.adminArea.apiTab.showAndCopyMostRecentSecret();
  });


  // ----- Creating a custom category

  it("Owen creates a Customers' Packages category", () => {
    owensBrowser.go('/categories');
    owensBrowser.complex.createCategory({ name: CustPkgsCatName, extId: CustPkgsExtId });
  });


  // ----- Upserting a category

  let upsertResponse;
  let upsertedCategory: TestCategory;

  it("Owen upserts a category", () => {
    const category = {  //: TestCategoryPatch
      //id: c.LowestExtImpId + 1,
      //sectionPageId: '???',
      extId: UpsCatOneExtId,
      parentRef: 'extid:' + CustPkgsExtId,
      name: UpsCatOneName,
      slug: UpsCatOneSlug,
      defaultTopicType: PageRole.Question,
      description: UpsCatOneDescr,  // wasn't upserted   BUG
      position: 55,
    };
    upsertResponse = server.apiV0.upsertSimple({
        origin: siteIdAddress.origin, requesterId: c.SysbotUserId, apiSecret,
        data: {
          categories: [category],
        }});
  });

  it("... gets back the upserted category in the server's response", () => {
    assert.equal(upsertResponse.categories.length, 1);
    upsertedCategory = upsertResponse.categories[0];
    assert.equal(upsertedCategory.name, UpsCatOneName);
    assert.equal(upsertedCategory.slug, UpsCatOneSlug);
    assert.equal(upsertedCategory.extId, UpsCatOneExtId);
    assert.equal(upsertedCategory.description, UpsCatOneDescr);
  });

  it("The upserted category is not yet visible", () => {
    owensBrowser.forumCategoryList.waitForCategories();
    assert.equal(owensBrowser.forumCategoryList.numCategoriesVisible(), 4);
  });

  it("... but Owen refreshes the page", () => {
    owensBrowser.refresh();
  });

  it("... now the upserted category appears in the catedory list", () => {
    owensBrowser.forumCategoryList.waitForCategories();
    assert.equal(owensBrowser.forumCategoryList.numCategoriesVisible(), 4);
    assert.equal(owensBrowser.forumCategoryList.numSubCategoriesVisible(), 1);
  });

  it("... all categories have the epected titles", () => {
    const isCategoryVisible = owensBrowser.forumCategoryList.isCategoryVisible;
    const isSubCategoryVisible = owensBrowser.forumCategoryList.isSubCategoryVisible;
    assert(isCategoryVisible(forum.categories.categoryA.name));
    assert(isCategoryVisible(forum.categories.staffOnlyCategory.name));
    assert(isCategoryVisible(forum.categories.specificCategory.name));
    assert(isCategoryVisible(CustPkgsCatName));
    assert(isSubCategoryVisible(UpsCatOneName));
  });


  // ----- Upserting many categories

  it("Owen upserts two more", () => {
    const upsCatTwo = {  //: TestCategoryPatch
      extId: UpsCatTwoExtId,
      parentRef: 'extid:' + CustPkgsExtId,
      name: UpsCatTwoName,
      slug: UpsCatTwoSlug,
      defaultTopicType: PageRole.Question,
      description: UpsCatTwoDescr,  // wasn't upserted   BUG
      position: 54,
    };
    const upsCatThree = {  //: TestCategoryPatch
      extId: UpsCatThreeExtId,
      parentRef: 'extid:' + CustPkgsExtId,
      name: UpsCatThreeName,
      slug: UpsCatThreeSlug,
      defaultTopicType: PageRole.Question,
      description: UpsCatThreeDescr,  // wasn't upserted   BUG
      position: 56,
    };
    upsertResponse = server.apiV0.upsertSimple({
        origin: siteIdAddress.origin, requesterId: c.SysbotUserId, apiSecret,
        data: {
          categories: [upsCatTwo, upsCatThree],
        }});
  });

  it("... gets back two upserted categories in the response", () => {
    assert.equal(upsertResponse.categories.length, 2);
  });

  it("... the first one, UpsCatTwo, looks correct", () => {
    upsertedCategory = upsertResponse.categories[0];
    assert.equal(upsertedCategory.name, UpsCatTwoName);
    assert.equal(upsertedCategory.slug, UpsCatTwoSlug);
    assert.equal(upsertedCategory.extId, UpsCatTwoExtId);
    assert.equal(upsertedCategory.description, UpsCatTwoDescr);
    assert.equal(upsertedCategory.position, UpsCatTwoPosition);
  });

  it("... the 2nd, likewise", () => {
    upsertedCategory = upsertResponse.categories[1];
    assert.equal(upsertedCategory.name, UpsCatThreeName);
    assert.equal(upsertedCategory.slug, UpsCatThreeSlug);
    assert.equal(upsertedCategory.extId, UpsCatThreeExtId);
    assert.equal(upsertedCategory.description, UpsCatThreeDescr);
    assert.equal(upsertedCategory.position, UpsCatThreePosition);
  });

  it("Now there're 2 more categories", () => {
    owensBrowser.refresh();
    owensBrowser.forumCategoryList.waitForCategories();
    assert.equal(owensBrowser.forumCategoryList.numCategoriesVisible(), 4);
    assert.equal(owensBrowser.forumCategoryList.numSubCategoriesVisible(), 3);
  });

  it("... all 7 categories have the epected titles", () => {
    const isCategoryVisible = owensBrowser.forumCategoryList.isCategoryVisible;
    const isSubCategoryVisible = owensBrowser.forumCategoryList.isSubCategoryVisible;
    assert(isCategoryVisible(forum.categories.categoryA.name));
    assert(isCategoryVisible(forum.categories.staffOnlyCategory.name));
    assert(isCategoryVisible(forum.categories.specificCategory.name));
    assert(isCategoryVisible(CustPkgsCatName));
    assert(isSubCategoryVisible(UpsCatOneName));
    assert(isSubCategoryVisible(UpsCatTwoName));
    assert(isSubCategoryVisible(UpsCatThreeName));
  });


  // ----- Edit category, by upserting

  it("Owen upserts a new name, slug and description for the 2nd category", () => {
    const category = {  //: TestCategoryPatch
      extId: UpsCatTwoEditedExtId,
      parentRef: 'extid:' + CustPkgsExtId,
      name: UpsCatTwoEditedName,
      slug: UpsCatTwoEditedSlug,
      defaultTopicType: PageRole.Question,
      description: UpsCatTwoEditedDescr,  // wasn't upserted   BUG
      position: UpsCatTwoEditedPos,
    };
    upsertResponse = server.apiV0.upsertSimple({
        origin: siteIdAddress.origin, requesterId: c.SysbotUserId, apiSecret,
        data: {
          categories: [category],
        }});
  });

  it("... the server replies; the category has now the new name, slug and descr", () => {
    assert.equal(upsertResponse.categories.length, 1);
    upsertedCategory = upsertResponse.categories[0];
    assert.equal(upsertedCategory.name, UpsCatTwoEditedName);
    assert.equal(upsertedCategory.slug, UpsCatTwoEditedSlug);
    assert.equal(upsertedCategory.extId, UpsCatTwoEditedExtId);
    assert.equal(upsertedCategory.description, UpsCatTwoEditedDescr);
    assert.equal(upsertedCategory.position, UpsCatTwoEditedPos);
  });


  it("Maja goes to the categories list page", () => {
    majasBrowser.go(siteIdAddress.origin + '/categories');
  });


  it("... sees all 7 categories", () => {
    majasBrowser.forumCategoryList.waitForCategories();
    assert.equal(owensBrowser.forumCategoryList.numCategoriesVisible(), 4);
    assert.equal(owensBrowser.forumCategoryList.numSubCategoriesVisible(), 3);
  });

  it("... with the epected titles, incl cat two, edited", () => {
    const isCategoryVisible = owensBrowser.forumCategoryList.isCategoryVisible;
    const isSubCategoryVisible = owensBrowser.forumCategoryList.isSubCategoryVisible;
    assert(isCategoryVisible(forum.categories.categoryA.name));
    assert(isCategoryVisible(forum.categories.staffOnlyCategory.name));
    assert(isCategoryVisible(forum.categories.specificCategory.name));
    assert(isCategoryVisible(CustPkgsCatName));
    assert(isSubCategoryVisible(UpsCatOneName));
    assert(isSubCategoryVisible(UpsCatTwoEditedName));
    assert(isSubCategoryVisible(UpsCatThreeName));
  });


  it("Maja logs in", () => {
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
  });


  it("... opens the upserted and edited category 'two'", () => {
    majasBrowser.forumCategoryList.openSubCategory(UpsCatTwoEditedName);
  });


  it("Maja posts a topic in this ups & edited category", () => {
    majasBrowser.complex.createAndSaveTopic({ title: "Maja's topic title", body: "Majas text text" });
  });

});

