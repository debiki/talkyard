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

const UpsCatOneName = 'Ups Category One';
const UpsCatOneSlug = 'ups-category-one';
const UpsCatOneExtId = 'ups_cat_one_ext_id';
const UpsCatOneDescr = 'Upserted Cat One description text text text longer a bit longer.';



describe("api-upsert-categories  TyT94DFKHQC24", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Ups Cats E2E Test",
      //members: ['owen', 'maja', 'maria'],
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


  // ----- Creates a custom category

  it("Owen creates a Customers' Packages category", () => {
    owensBrowser.go('/categories');
    owensBrowser.complex.createCategory({ name: CustPkgsCatName, extId: CustPkgsExtId });
  });


  // ----- Upserts category

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

  it("The category appears in the catedory list", () => {
    owensBrowser.refresh();
    // It doesn't — why not? It's in the database ,looks fine.
  });

  it("Owen upserts a 2nd", () => {
  });

  it("... gets it back in the response", () => {
  });

  it("Owen changes the name, slug and description of the 1st category", () => {
  });

  it("... the server replies; the category has now the new name, slug and descr", () => {
  });


  it("Maja goes to the categories list page", () => {
    majasBrowser.go(siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug);
  });


  it("... she sees the upserted categories", () => {
  });


  it("Maja logs in", () => {
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);

    // And if needed:
    //someone's-Browser.disableRateLimits();
  });


  it("... opens the 1st upserted category", () => {
  });


  it("... she can post a topic", () => {
  });

  // ...

});

