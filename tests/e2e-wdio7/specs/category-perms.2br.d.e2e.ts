/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { j2s } from '../utils/log-and-die';
import * as utils from '../utils/utils';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
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



describe(`category-perms.2br.d  TyTE2ECATPREMS01`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "Cat Perms E2E Test",
      members: ['owen', 'maria', 'memah', 'michael'],
    });
    fcats = forum.categories;

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;
    memah = forum.members.memah;
    memah_brB = brB;
    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });



  // ----- Create topics   (dupl code [03RGM234])


  it(`Maria goes to Cat A`, async () => {
    await maria_brB.forumTopicList.goHere({
          origin: site.origin, categorySlug: fcats.catA.slug });
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });

  it(`... posts a topic`, async () => {
    await maria_brB.complex.createAndSaveTopic({ title: topicCatATitle, body: topicCatABody });
    topicCatAUrl = await maria_brB.getUrl();
  });

  it(`Maria goes to Cat B`, async () => {
    await maria_brB.forumTopicList.goHere({ categorySlug: fcats.catB.slug });
  });

  it(`... posts another topic`, async () => {
    await maria_brB.complex.createAndSaveTopic({
          title: topicCatBTitle, body: topicCatBBody });
    topicCatBUrl = await maria_brB.getUrl();
  });

  it(`Maria leaves, Memah arrives`, async () => {
    await maria_brB.topbar.clickLogout();
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });


  // ----- Two public base cats


  addCanAccessTestSteps({ stepsTitle: "Memah can access base cats A and B",
        canAccessCatA: true, canAccessCatB: true, catBIsSubCat: false });


  // ----- Create sub cat


  it(`Owen goes to Cat B`, async () => {
    await owen_brA.forumTopicList.goHere({
          origin: site.origin, categorySlug: fcats.catB.slug });
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  it(`... makes it a sub category of cat A   TyTMOBACAT`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
    await owen_brA.categoryDialog.setParentCategory(fcats.catA.name);
    await owen_brA.categoryDialog.submit();
  });

  it(`Now Owen sees:  Cat A —> Cat B`, async () => {
    await owen_brA.forumTopicList.waitForCategoryName(fcats.catA.name);
    await owen_brA.forumTopicList.waitForCategoryName(fcats.catB.name, { isSubCat: true });
  });



  // ----- Access test function


  function addCanAccessTestSteps(ps: { stepsTitle?: St, canAccessCatA: Bo, canAccessCatB: Bo,
        catBIsSubCat?: Bo, retryFirstStep?: true }) {
    const numTopicsVisible: Nr =
            (ps.canAccessCatA ? 1 : 0) + (ps.canAccessCatB ? 1 : 0);
    const numBaseCatsVisible =
            (ps.canAccessCatA ? 1 : 0) +
            (ps.canAccessCatB && !ps.catBIsSubCat ? 1 : 0);
    const numSubCatsVisible =
            (ps.canAccessCatB && ps.catBIsSubCat ? 1 : 0);
    const numCatsVisible = numBaseCatsVisible + numSubCatsVisible;

    if (ps.stepsTitle) {
      it(ps.stepsTitle, async () => {});
    }

    if (numTopicsVisible >= 1) {
      it(`Memah can see ${numTopicsVisible} topic(s) in the topic list`, async () => {
        await memah_brB.go2('/')
        const topicList = memah_brB.forumTopicList;
        // Trying many times — might take a little while for the server to re-render the page.
        await topicList.waitForTopics({ refreshBetween: true, timeoutMs: 500,
                timeoutIsFine: true });
        await topicList.assertNumVisible(numTopicsVisible);
        !ps.canAccessCatA || await topicList.waitForTopicVisible(topicCatATitle);
        !ps.canAccessCatB || await topicList.waitForTopicVisible(topicCatBTitle);
      });
    }
    else {
      it(`Memah sees no topics in the topic list`, async () => {
        await memah_brB.go2('/')
        // Hmm, double wait?
        await memah_brB.waitUntil(async () => {
          await memah_brB.forumTopicList.waitUntilKnowsIsEmpty();
          return true;
        }, { refreshBetween: true });
      });
    }

    if (numCatsVisible >= 1) {
      it(`Memah can see ${numCatsVisible} categories(s) on the categories page`, async () => {
        await memah_brB.forumCategoryList.goHere();
        const catl = memah_brB.forumCategoryList;
        await catl.waitForNumCategoriesVisible(numBaseCatsVisible);
        assert.eq(await catl.numSubCategoriesVisible(), numSubCatsVisible);

        assert.eq(ps.canAccessCatA, await catl.isCategoryVisible(fcats.catA.name));

        assert.eq(ps.canAccessCatB && !ps.catBIsSubCat,
              await catl.isCategoryVisible(fcats.catB.name));

        assert.eq(ps.canAccessCatB && ps.catBIsSubCat,
              await catl.isSubCategoryVisible(fcats.catB.name));
      });

      let perCatTopicTitles: St[][];
      if (ps.canAccessCatA) {
        if (ps.canAccessCatB) {
          if (ps.catBIsSubCat) {
            // Cat B's topics are shown together with A's, since B is a sub cat of A.
            perCatTopicTitles = [[topicCatBTitle, topicCatATitle]];
          }
          else {
            // Cat B's topics shown in their own list, since B is a base cat itself.
            perCatTopicTitles = [[topicCatATitle], [topicCatBTitle]];
          }
        }
        else {
          // Can access A not B.
          perCatTopicTitles = [[topicCatATitle]];
        }
      }
      else {
        // Can access B only.
        perCatTopicTitles = [[topicCatBTitle]];
      }

      it(`... and topics: ${j2s(perCatTopicTitles)}   TyTSEECATTOPS`, async () => {
        const catl = memah_brB.forumCategoryList;
        assert.deepEq(await catl.getTopicTitles(1), perCatTopicTitles[0]);

        if (perCatTopicTitles[1]) {
          assert.deepEq(await catl.getTopicTitles(2), perCatTopicTitles[1]);
        }
      });
    }
    else {
      it(`Memah sees no categories on the categories page`, async () => {
        await memah_brB.forumCategoryList.goHere('', { shouldSeeAnyCats: false });
      });
      it(`... and no topics   TyTSEECATTOPS`, async () => {
        assert.deepEq(await memah_brB.forumCategoryList.getTopicTitles(), []);
      });
    }

    if (ps.canAccessCatA) {
      it(`Memah can access topics in cat A`, async () => {
        await memah_brB.go2(topicCatAUrl);
        await memah_brB.topic.waitUntilPostTextIs(c.TitleNr, topicCatATitle);
      });
    }
    else {
      it(`Memah can  not  access topics in cat A`, async () => {
        await memah_brB.go2(topicCatAUrl);
        await memah_brB.assertNotFoundError({ whyNot: 'MayNotSeeCat' });
      });
    }

    if (ps.canAccessCatB) {
      it(`Memah can access topics in cat B`, async () => {
        await memah_brB.go2(topicCatBUrl);
        await memah_brB.topic.waitUntilPostTextIs(c.TitleNr, topicCatBTitle);
      });
    }
    else {
      it(`Memah can  not  access topics in cat B`, async () => {
        await memah_brB.go2(topicCatBUrl);
        await memah_brB.assertNotFoundError({ whyNot: 'MayNotSeeCat' });
      });
    }


    it(`Memah searches for the search word`, async () => {
      await memah_brB.goToSearchPage(searchWord);
    });

    if (numTopicsVisible >= 1) {
      it(`... finds ${numTopicsVisible} topics   TyTSEARCHPRIVCAT`, async () => {
        await memah_brB.searchResultsPage.waitForAssertNumPagesFound(searchWord, numTopicsVisible);
        !ps.canAccessCatA ||
              await memah_brB.searchResultsPage.assertResultPageTitlePresent(topicCatATitle);
        !ps.canAccessCatB ||
              await memah_brB.searchResultsPage.assertResultPageTitlePresent(topicCatBTitle);
      });
    }
    else {
      it(`... finds no topics`, async () => {
        await memah_brB.searchResultsPage.assertPhraseNotFound(searchWord);
        await memah_brB.searchResultsPage.waitForAssertNumPagesFound(searchWord, 0);  // ttt [5FK02FP]
      });
    }
  }


  it(`Memah goes to Cat B — which will be access restricted, soon`, async () => {
    await memah_brB.forumTopicList.goHere({
          origin: site.origin, categorySlug: fcats.catB.slug });
  });



  // ----- Access restrict base category


  it(`Owen goes to Cat A`, async () => {
    await owen_brA.forumTopicList.goHere({ categorySlug: fcats.catA.slug });
  });

  it(`... opens the category security tab`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
    await owen_brA.categoryDialog.openSecurityTab();
  });

  it(`... makes Cat A access restricted: Staff only`, async () => {
    await owen_brA.categoryDialog.securityTab.removeGroup(c.EveryoneId);
    await owen_brA.categoryDialog.submit();
  });

  // Padlock symbol appears?
  it(`... now an access-restricted padlock appears before Cat A  TyTCATLOCK`, async () => {
    await owen_brA.forumTopicList.waitForCategoryName(fcats.catA.name, {
          shallBeAccessRestricted: true });
  });
  it(`... and Cat B, since it's a sub cat of A  TyTCATLOCK`, async () => {
    await owen_brA.forumTopicList.goHere({ categorySlug: fcats.catB.slug });
    await owen_brA.forumTopicList.waitForCategoryName(fcats.catB.name, {
          shallBeAccessRestricted: true, isSubCat: true });
  });



  // ----- Cannot post topics in sub cat, when base cat access restricted


  it(`Memah attempts to post a new topic in sub cat B`, async () => {
    await memah_brB.complex.createAndSaveTopic({
          title: "Won't Work", body: "Some text.", resultInError: true });
  });

  it(`... won't work — base cat now access restricted`, async () => {
    await memah_brB.assertNotFoundError({
            whyNot: 'MayNotCreateTopicsOrSeeCat', shouldBeErrorDialog: true });
  });



  // ----- Cannot access any topics    [.2220ACS]


  addCanAccessTestSteps({ canAccessCatA: false, canAccessCatB: false,
        catBIsSubCat: true });



  // ----- Change cat B back to a base cat   [TyTE2ECLRSUBCAT]

  // Then, can access B, since it's only the previous parent cat, A, that we
  // may not see. But now B got moved away from A.

  // The *base* cat is access restricted, whilst here: [.sub_2_base] the sub cat
  // is access restricted instead.

  it(`Owen edits Cat B`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
  });

  it(`... makes Cat B a base cat again   TyTMOBACAT`, async () => {
    await owen_brA.categoryDialog.clearParentCategory();
    await owen_brA.categoryDialog.submit();
  });

  it(`The access-restricted padlock disappeared (since no longer sub cat of
            access restricted A)`, async () => {
    await owen_brA.forumTopicList.waitForCategoryName(fcats.catB.name, {
          shallBeAccessRestricted: false });
  });


  addCanAccessTestSteps({ canAccessCatA: false, canAccessCatB: true,
        catBIsSubCat: false, retryFirstStep: true });



  // ----- Makes B a sub cat again


  it(`Owen changes B back to a sub cat of A   TyTMOBACAT`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
    await owen_brA.categoryDialog.setParentCategory(fcats.catA.name);
    await owen_brA.categoryDialog.submit();
  });

  it(`Now Owen sees:  Cat A —> Cat B`, async () => {
    await owen_brA.forumTopicList.waitForCategoryName(fcats.catA.name);
    await owen_brA.forumTopicList.waitForCategoryName(fcats.catB.name, { isSubCat: true });
  });


  // (This is doing [.2220ACS] again — maybe speed this test up by just doing
  // one quick access test instead.)
  //
  addCanAccessTestSteps({ canAccessCatA: false, canAccessCatB: false,
        catBIsSubCat: true });



  // ----- Allow access again


  // Padlock symbols?
  it(`Owen sees that cat A is access protected   TyTCATLOCK`, async () => {
    await owen_brA.forumTopicList.waitForCategoryName(fcats.catA.name, {
          shallBeAccessRestricted: true });
  });
  it(`... cat B is too, since it's a sub cat of A`, async () => {
    await owen_brA.forumTopicList.waitForCategoryName(fcats.catB.name, {
          shallBeAccessRestricted: true, isSubCat: true });
  });

  it(`Owen allows access again,  to cat A,  incl sub cat B`, async () => {
    await owen_brA.forumTopicList.goHere({ categorySlug: fcats.catA.slug });
    await owen_brA.forumButtons.clickEditCategory();
    await owen_brA.categoryDialog.openSecurityTab();
    await owen_brA.categoryDialog.securityTab.addGroup(c.EveryoneFullName);
    await owen_brA.categoryDialog.submit();
  });

  // Padlock symbols gone?
  it(`Now Owen sees that cat A is no longer access protected   TyTCATLOCK`, async () => {
    await owen_brA.forumTopicList.waitForCategoryName(fcats.catA.name, {
          shallBeAccessRestricted: false });
  });
  it(`Owen goes to Cat B, a sub cat of A ...`, async () => {
    await owen_brA.forumTopicList.goHere({ categorySlug: fcats.catB.slug });
  });
  it(`... cat B also is no longer access protected — it's a sub cat of A, so when
            A was made public, B was, too (B hasn't been explicitly access restricted)`,
            async () => {
    await owen_brA.forumTopicList.waitForCategoryName(fcats.catB.name, {
          shallBeAccessRestricted: false, isSubCat: true });
  });

  // Now, can access
  addCanAccessTestSteps({ canAccessCatA: true, canAccessCatB: true,
        catBIsSubCat: true });



  // ----- Access restrict sub category   TyTPRIVSUBCA

  it(`Owen edits security settings for cat B`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
    await owen_brA.categoryDialog.openSecurityTab();
  });

  it(`... makes sub cat B access restricted`, async () => {
    await owen_brA.categoryDialog.securityTab.removeGroup(c.EveryoneId);
    await owen_brA.categoryDialog.submit();
  });

  // Only sub cat has padlock symbol:
  it(`Owen sees that sub cat B is access protected   TyTCATLOCK`, async () => {
    await owen_brA.forumTopicList.waitForCategoryName(fcats.catB.name, {
          shallBeAccessRestricted: true, isSubCat: true });
  });
  it(`... but base cat A is not`, async () => {
    await owen_brA.forumTopicList.waitForCategoryName(fcats.catA.name, {
          shallBeAccessRestricted: false });
  });

  // Now, can access base cat,  but not sub cat
  addCanAccessTestSteps({
        canAccessCatA: true, canAccessCatB: false, catBIsSubCat: true });



  // ----- Make access restrict sub cat a base cat

  // Here, the sub cat is access restricted, whilst here: [.sub_2_base] it's
  // instead the base cat that's access restricted.

  it(`Owen edits Cat B`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
  });

  it(`... makes Cat B a base cat again   TyTMOBACAT`, async () => {
    await owen_brA.categoryDialog.clearParentCategory();
    await owen_brA.categoryDialog.submit();
  });

  it(`The access-restricted padlock is still there (since cat B itself was made
            access restricted, rather than its former parent, A)   TyTCATLOCK`, async () => {
    await owen_brA.forumTopicList.waitForCategoryName(fcats.catB.name, {
          shallBeAccessRestricted: true });
  });

  // Still cannot access B
  addCanAccessTestSteps({
        canAccessCatA: true, canAccessCatB: false, catBIsSubCat: false });



  // ----- Make access restrict base cat B a sub cat of A

  it(`Owen changes B back to a sub cat of A   TyTMOBACAT`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
    await owen_brA.categoryDialog.setParentCategory(fcats.catA.name);
    await owen_brA.categoryDialog.submit();
  });

  it(`... sub cat B is still access protected   TyTCATLOCK`, async () => {
    await owen_brA.forumTopicList.waitForCategoryName(fcats.catB.name, {
          shallBeAccessRestricted: true, isSubCat: true });
  });
  it(`... but base cat A is not   TyTCATLOCK`, async () => {
    await owen_brA.forumTopicList.waitForCategoryName(fcats.catA.name, {
          shallBeAccessRestricted: false });
  });

  // Still cannot access B, nothing changed.
  addCanAccessTestSteps({
        canAccessCatA: true, canAccessCatB: false, catBIsSubCat: true });


});

