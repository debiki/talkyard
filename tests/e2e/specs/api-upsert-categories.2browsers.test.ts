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

const PackagesCatName = "Packages Category";
const PackagesCatExtId = 'pkgs_cat_ext_id';

const UpsCatOnePosition = 55;
const UpsCatOneName = 'Ups Category One position ' + UpsCatOnePosition;
const UpsCatOneSlug = 'ups-category-one';
const UpsCatOneExtId = 'ups_cat_one_ext_id';
const UpsCatOneDescr = 'Upserted Cat One description.';
const UpsCatOneHandEditedName = 'UpsCatOneHandEditedName';
const UpsCatOneHandEditedSlug = 'UpsCatOneHandEditedSlug';

const UpsCatTwoPosition = 54;
const UpsCatTwoName = 'Ups Category Two pos ' + UpsCatTwoPosition;
const UpsCatTwoSlug = 'ups-category-two';
const UpsCatTwoExtIdLoong =  // [TyT602RHK42JF]
  'ups_cat_two_ext_id__100_chars_loooong__0123456789012345678901234567890123456789012345678901234567890';
const UpsCatTwoDescr = 'Upserted Cat Two description text text text longer a bit longer.';

const UpsCatTwoEditedPos = 57;
const UpsCatTwoEditedName = `Ups Cat 2 Edited pos ${UpsCatTwoEditedPos} was ${UpsCatTwoPosition}`;
const UpsCatTwoEditedSlug = 'ups-category-ed-two';
const UpsCatTwoEditedDescr = 'Upserted Cat Two EDITED descr.';

const UpsCatThreePosition = 56;
const UpsCatThreeName = 'Ups Category Three pos ' + UpsCatThreePosition;
const UpsCatThreeSlug = 'ups-category-three';
const UpsCatThreeExtIdWeirdChars =  // [TyT602RHK42JF]
    'ups_cat_3_ext_id:un?us-ual_chars__--and--__/+#t![h]{i}"(n)\'g,%s\\.åäö.汉语';
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
    owensBrowser.complex.createCategory({ name: PackagesCatName, extId: PackagesCatExtId });
  });


  // ----- Upserting a category

  let upsertResponse;
  let upsertedCategory: TestCategory;

  it("Owen upserts a category", () => {
    const category = {  //: TestCategoryPatch
      // id: assigned by the server
      // sectionPageId: will get copied from the parent category
      extId: UpsCatOneExtId,
      parentRef: 'extid:' + PackagesCatExtId,
      name: UpsCatOneName,
      slug: UpsCatOneSlug,
      defaultTopicType: PageRole.Question,
      description: UpsCatOneDescr,
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

  it("... now the upserted category appears in the category list", () => {
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
    assert(isCategoryVisible(PackagesCatName));
    assert(isSubCategoryVisible(UpsCatOneName));
  });


  // ----- Upserting many categories

  it("Owen upserts two more", () => {
    const upsCatTwo = {  //: TestCategoryPatch
      extId: UpsCatTwoExtIdLoong,
      parentRef: 'extid:' + PackagesCatExtId,
      name: UpsCatTwoName,
      slug: UpsCatTwoSlug,
      defaultTopicType: PageRole.Question,
      description: UpsCatTwoDescr,
      position: 54,
    };
    const upsCatThree = {  //: TestCategoryPatch
      extId: UpsCatThreeExtIdWeirdChars,
      parentRef: 'extid:' + PackagesCatExtId,
      name: UpsCatThreeName,
      slug: UpsCatThreeSlug,
      defaultTopicType: PageRole.Problem,
      description: UpsCatThreeDescr,
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
    assert.equal(upsertedCategory.extId, UpsCatTwoExtIdLoong);
    assert.equal(upsertedCategory.description, UpsCatTwoDescr);
    assert.equal(upsertedCategory.position, UpsCatTwoPosition);
  });

  it("... the 2nd, likewise", () => {
    upsertedCategory = upsertResponse.categories[1];
    assert.equal(upsertedCategory.name, UpsCatThreeName);
    assert.equal(upsertedCategory.slug, UpsCatThreeSlug);
    assert.equal(upsertedCategory.extId, UpsCatThreeExtIdWeirdChars);
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
    assert(isCategoryVisible(PackagesCatName));
    assert(isSubCategoryVisible(UpsCatOneName));
    assert(isSubCategoryVisible(UpsCatTwoName));
    assert(isSubCategoryVisible(UpsCatThreeName));
  });


  // ----- Edit upserted category, via API upsert

  it("Owen upserts a new name, slug and description for the 2nd category", () => {
    const category = {  //: TestCategoryPatch
      extId: UpsCatTwoExtIdLoong,
      parentRef: 'extid:' + PackagesCatExtId,
      name: UpsCatTwoEditedName,
      slug: UpsCatTwoEditedSlug,
      defaultTopicType: PageRole.Idea,  // was: Question
      description: UpsCatTwoEditedDescr,
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
    assert.equal(upsertedCategory.extId, UpsCatTwoExtIdLoong);
    assert.equal(upsertedCategory.description, UpsCatTwoEditedDescr);
    assert.equal(upsertedCategory.position, UpsCatTwoEditedPos);
  });


  // ----- Edit upserted category, via UI edit dialog  [TyT703LTKQ38]

  it("Owen goes to sub category one", () => {
    owensBrowser.forumCategoryList.openSubCategory(UpsCatOneName);
  });

  it("... opens the Edit Category dialog", () => {
    owensBrowser.forumButtons.clickEditCategory();
  });

  it("... changes the name and slug", () => {
    owensBrowser.categoryDialog.fillInFields({
      name: UpsCatOneHandEditedName,
      slug: UpsCatOneHandEditedSlug,
    });
  });

  it("... saves", () => {
    owensBrowser.categoryDialog.submit();
  });

  it("The category name changes", () => {
    owensBrowser.forumTopicList.waitForCategoryName(UpsCatOneHandEditedName);
  });

  it("... and the browser url path changes, to the new category slug", () => {
    const urlPath = owensBrowser.urlPath();
    assert.equal(urlPath, '/latest/' + UpsCatOneHandEditedSlug.toLowerCase());
  });

  it("Owen reloads the page", () => {
    owensBrowser.refresh();
  });

  it("... all fine, after reload", () => {
    owensBrowser.forumTopicList.waitForCategoryName(UpsCatOneHandEditedName);
  });

  it("The category list page got updated, too", () => {
    owensBrowser.forumCategoryList.goHere();
    owensBrowser.forumCategoryList.waitForCategories();
    assert(owensBrowser.forumCategoryList.isSubCategoryVisible(UpsCatOneHandEditedName));
  });


  // ----- Using an upserted category

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
    assert(isCategoryVisible(PackagesCatName));
    assert(isSubCategoryVisible(UpsCatOneHandEditedName));
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

