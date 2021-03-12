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
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: CatABTestForum;
let fcats: {
  catA: CategoryJustAdded;
  catB: CategoryJustAdded;
};

const searchWord = 'searchWord';

let topicCatAUrl: St;
const topicCatATitle = 'topicCatATitle ' + searchWord;
const topicCatABody = 'topicCatABody';

let topicCatBUrl: St;
const topicCatBTitle = 'topicCatBTitle ' + searchWord;
const topicCatBBody= 'topicCatBBody';



describe(`category-permissions.2br   TyTE2ECATPREMS01`, () => {

  it(`construct site`, () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "Some E2E Test",
      members: ['owen', 'maria', 'memah', 'michael'],
    });
    fcats = forum.categories;

    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owen_brA = richBrowserA;

    maria = forum.members.maria;
    maria_brB = richBrowserB;
    memah = forum.members.memah;
    memah_brB = richBrowserB;
    stranger_brB = richBrowserB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });



  // ----- Create topics   (dupl code [03RGM234])


  it(`Maria goes to Cat A`, () => {
    maria_brB.forumTopicList.goHere({
          origin: site.origin, categorySlug: fcats.catA.slug });
    maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });

  it(`... posts a topic`, () => {
    maria_brB.complex.createAndSaveTopic({ title: topicCatATitle, body: topicCatABody });
    topicCatAUrl = maria_brB.getUrl();
  });

  it(`Maria goes to Cat B`, () => {
    maria_brB.forumTopicList.goHere({ categorySlug: fcats.catB.slug });
  });

  it(`... posts another topic`, () => {
    maria_brB.complex.createAndSaveTopic({
          title: topicCatBTitle, body: topicCatBBody });
    topicCatBUrl = maria_brB.getUrl();
  });

  it(`Maria leaves, Memah arrives`, () => {
    maria_brB.topbar.clickLogout();
    memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });



  // ----- Create sub cat


  it(`Owen goes to Cat B`, () => {
    owen_brA.forumTopicList.goHere({
          origin: site.origin, categorySlug: fcats.catB.slug });
    owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  it(`... makes it a sub category of cat A`, () => {
    owen_brA.forumButtons.clickEditCategory();
    owen_brA.categoryDialog.setParentCategory(fcats.catA.name);
    owen_brA.categoryDialog.submit();
  });

  it(`Now Owen sees:  Cat A —> Cat B`, () => {
    owen_brA.forumTopicList.waitForCategoryName(fcats.catA.name);
    owen_brA.forumTopicList.waitForCategoryName(fcats.catB.name, { isSubCat: true });
  });



  // ----- Can access topics


  addCanAccessTestSteps({
        canAccessCatA: true, canAccessCatB: true, catBIsSubCat: true  });


  function addCanAccessTestSteps(ps: { canAccessCatA: Bo, canAccessCatB: Bo,
        catBIsSubCat?: Bo }) {
    const numTopicsVisible: Nr =
            (ps.canAccessCatA ? 1 : 0) + (ps.canAccessCatB ? 1 : 0);
    const numBaseCatsVisible =
            (ps.canAccessCatA ? 1 : 0) +
            (ps.canAccessCatB && !ps.catBIsSubCat ? 1 : 0);
    const numSubCatsVisible =
            (ps.canAccessCatB && ps.catBIsSubCat ? 1 : 0);
    const numCatsVisible = numBaseCatsVisible + numSubCatsVisible;

    if (numTopicsVisible >= 1) {
      it(`Memah can see ${numTopicsVisible} topic(s) in the topic list`, () => {
        memah_brB.go2('/')
        memah_brB.forumTopicList.waitForTopics();
        memah_brB.forumTopicList.assertNumVisible(numTopicsVisible);
        !ps.canAccessCatA || memah_brB.forumTopicList.waitForTopicVisible(topicCatATitle);
        !ps.canAccessCatB || memah_brB.forumTopicList.waitForTopicVisible(topicCatBTitle);
      });
    }
    else {
      it(`Memah sees no topics in the topic list`, () => {
        memah_brB.go2('/')
        memah_brB.forumTopicList.waitUntilKnowsIsEmpty();
      });
    }

    if (numCatsVisible >= 1) {
      it(`Memah can see ${numCatsVisible} categories(s) on the categories page`, () => {
        memah_brB.forumCategoryList.goHere();
        const catl = memah_brB.forumCategoryList;
        catl.waitForNumCategoriesVisible(numBaseCatsVisible);
        assert.eq(catl.numSubCategoriesVisible(), numSubCatsVisible);

        assert.eq(ps.canAccessCatA, catl.isCategoryVisible(fcats.catA.name));

        assert.eq(ps.canAccessCatB && !ps.catBIsSubCat,
              catl.isCategoryVisible(fcats.catB.name));

        assert.eq(ps.canAccessCatB && ps.catBIsSubCat,
              catl.isSubCategoryVisible(fcats.catB.name));
      });
    }
    else {
      it(`Memah sees no categories on the categories page`, () => {
        memah_brB.forumCategoryList.goHere('', { shouldSeeAnyCats: false });
      });
    }

    if (ps.canAccessCatA) {
      it(`Memah can access topics in cat A`, () => {
        memah_brB.go2(topicCatAUrl);
        memah_brB.topic.waitUntilPostTextIs(c.TitleNr, topicCatATitle);
      });
    }
    else {
      it(`Memah can  not  access topics in cat A`, () => {
        memah_brB.go2(topicCatAUrl);
        memah_brB.assertNotFoundError({ whyNot: 'MayNotSeeCat' });
      });
    }

    if (ps.canAccessCatB) {
      it(`Memah can access topics in cat B`, () => {
        memah_brB.go2(topicCatBUrl);
        memah_brB.topic.waitUntilPostTextIs(c.TitleNr, topicCatBTitle);
      });
    }
    else {
      it(`Memah can  not  access topics in cat B`, () => {
        memah_brB.go2(topicCatBUrl);
        memah_brB.assertNotFoundError({ whyNot: 'MayNotSeeCat' });
      });
    }


    it(`Memah searches for the search word`, () => {
      memah_brB.goToSearchPage(searchWord);
    });

    if (numTopicsVisible >= 1) {
      it(`... finds ${numTopicsVisible} topics`, () => {
        memah_brB.searchResultsPage.waitForAssertNumPagesFound(searchWord, numTopicsVisible);
        !ps.canAccessCatA ||
              memah_brB.searchResultsPage.assertResultPageTitlePresent(topicCatATitle);
        !ps.canAccessCatB ||
              memah_brB.searchResultsPage.assertResultPageTitlePresent(topicCatBTitle);
      });
    }
    else {
      it(`... finds no topics`, () => {
        memah_brB.searchResultsPage.assertPhraseNotFound(searchWord);
        memah_brB.searchResultsPage.waitForAssertNumPagesFound(searchWord, 0);  // ttt [5FK02FP]
      });
    }
  }


  it(`Memah goes to Cat B — which will be access restricted, soon`, () => {
    memah_brB.forumTopicList.goHere({
          origin: site.origin, categorySlug: fcats.catB.slug });
  });



  // ----- Access restrict base category


  it(`Owen goes to Cat A`, () => {
    owen_brA.forumTopicList.goHere({ categorySlug: fcats.catA.slug });
  });

  it(`... opens the category security tab`, () => {
    owen_brA.forumButtons.clickEditCategory();
    owen_brA.categoryDialog.openSecurityTab();
  });

  it(`... makes Cat A access restricted: Staff only`, () => {
    owen_brA.categoryDialog.securityTab.removeGroup(c.EveryoneId);
    //owen_brA.categoryDialog.securityTab.removeGroup(c.FullMembersId);
    owen_brA.categoryDialog.submit();
  });



  // ----- Cannot post topics in sub cat, when base cat access restricted


  it(`Memah attempts to post a new topic in sub cat B`, () => {
    memah_brB.complex.createAndSaveTopic({
          title: "Won't Work", body: "Some text.", resultInError: true });
  });

  it(`... won't work — base cat now access restricted`, () => {
    memah_brB.assertNotFoundError({ whyNot: 'MayNotCreateTopicsOrSeeCat' });
  });



  // ----- Cannot access any topics


  addCanAccessTestSteps({ canAccessCatA: false, canAccessCatB: false,
        catBIsSubCat: true });



  // TESTS_MISSING, extra cat perms tests — or maybe better in a 2nd spec?:
  // ?? move B away from A, can access B not A ??
  // ?? move B back to A, can not access


  // ----- Allow access again


  it(`Owen allows access again`, () => {
    owen_brA.forumButtons.clickEditCategory();
    owen_brA.categoryDialog.openSecurityTab();
    owen_brA.categoryDialog.securityTab.addGroup(c.EveryoneFullName);
    owen_brA.categoryDialog.submit();
  });

  // Now, can access
  addCanAccessTestSteps({ canAccessCatA: true, canAccessCatB: true,
        catBIsSubCat: true });



  // ----- Access restrict sub category


  it(`Owen goes to Cat B`, () => {
    owen_brA.forumTopicList.goHere({ categorySlug: fcats.catB.slug });
  });

  it(`... edits security settings`, () => {
    owen_brA.forumButtons.clickEditCategory();
    owen_brA.categoryDialog.openSecurityTab();
  });

  it(`... makes Cat B — a sub category — access restricted`, () => {
    owen_brA.categoryDialog.securityTab.removeGroup(c.EveryoneId);
    //owen_brA.categoryDialog.securityTab.removeGroup(c.FullMembersId);
    owen_brA.categoryDialog.submit();
  });

  // Now, can access base cat,  but not sub cat
  addCanAccessTestSteps({
        canAccessCatA: true, canAccessCatB: false, catBIsSubCat: true });



  // Move staff cat to sub cat of A?

});

