/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';
import * as comtSortUtil from './comment-sort-order.util';
import settings from '../utils/settings';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

let sortedPageA: PageJustAdded;
let sortedPageAA: PageJustAdded;
let sortedPageAB: PageJustAdded;
let sortedPageBA: PageJustAdded;
let defaultPageB: PageJustAdded;
let defaultPageBB: PageJustAdded;


describe(`comment-sort-order-inherited.d.2br  TyTECOMSORTORDINH`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();

    forum = builder.addSubCatsForum({
      title: "Comt Order Inherited E2E Test",
      members: undefined, // default = everyone
        // ['mons', 'modya', 'regina', 'corax', 'memah', 'maria', 'michael', 'mallory']
    });

    const result = comtSortUtil.addCommentsToSort({
      builder, forum,
      // Different cats — we want cat inheritance to affect the correct cats only.
      sortedPage: { catId: forum.categories.catA.id, suffix: 'a' },
      sortedPage2: { catId: forum.categories.subCatAA.id, suffix: 'aa' },
      sortedPage3: { catId: forum.categories.subCatAB.id, suffix: 'ab' },
      sortedPage4: { catId: forum.categories.subCatBA.id, suffix: 'ba' },
      defaultPage: { catId: forum.categories.catB.id, suffix: 'b' },
      defaultPage2: { catId: forum.categories.subCatBB.id, suffix: 'bb' },
    });

    sortedPageA = result.sortedPage;
    sortedPageAA = result.sortedPage2;
    sortedPageAB = result.sortedPage3
    sortedPageBA = result.sortedPage4;
    defaultPageB = result.defaultPage;
    defaultPageBB = result.defaultPage2;

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    memah = forum.members.memah;
    memah_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Owen logs in`, async () => {
    await owen_brA.go2(site.origin + '/latest/sub-cat-aa');
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });


  it(`Memah logs in, looks at a page in sub cat AA`, async () => {
    await memah_brB.go2(site.origin + '/' + sortedPageAA.slug);
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });


  it(`... sees comments sorted oldest first, the default`, async () => {
    await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.OldestFirst);
  });


  // ===== Sub category sort order


  it(`Owen opens cat edit dialog, in sub cat AA where Memah is`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
  });
  it(`... changes sort order to newest first`, async () => {
    await owen_brA.categoryDialog.openDiscLayout();
    await owen_brA.discLayoutD.selectCommentsSortOrder(c.TestPostSortOrder.NewestFirst);
  });
  it(`... saves`, async () => {
    await owen_brA.categoryDialog.submit();
  });

  it(`Memah doesn't see the changes yet`, async () => {
    await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.OldestFirst);
  });
  it(`... but she reloads the page`, async () => {
    await memah_brB.refresh2();
  });
  it(`... and sees the new sort order: Newest First, on the sort button`, async () => {
    assert.eq(await memah_brB.metabar.getDiscLayoutAsPerBtn(), c.TestPostSortOrder.NewestFirst);
  });
  it(`... comments are sorted correctly  LATER`, async () => {
    // await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.NewestFirst);
  });


  // ----- Other cats not affected


  it(`Memah looks at the page in cat AB`, async () => {
    await memah_brB.go2('/' + sortedPageAB.slug);
  });
  it(`... still uses Oldest First — it's in a different cat`, async () => {
    assert.eq(await memah_brB.metabar.getDiscLayoutAsPerBtn(), c.TestPostSortOrder.OldestFirst);
  });
  it(`... comments sorted Oldest First`, async () => {
    await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.OldestFirst);
  });

  it(`Pages in the parent category, A ...`, async () => {
    await memah_brB.go2('/' + sortedPageA.slug);
  });
  it(`... also wasn't affected, still Oldest First`, async () => {
    assert.eq(await memah_brB.metabar.getDiscLayoutAsPerBtn(), c.TestPostSortOrder.OldestFirst);
  });
  it(`... comments sorted Oldest First`, async () => {
    await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.OldestFirst);
  });


  // ===== Base cat inherited


  it(`Owen goes to cat A`, async () => {
    await owen_brA.go2(site.origin + '/latest/category-a');
  });
  it(`... opens cat edit dialog`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
  });
  it(`... changes sort order to Best First`, async () => {
    await owen_brA.categoryDialog.openDiscLayout();
    await owen_brA.discLayoutD.selectCommentsSortOrder(c.TestPostSortOrder.BestFirst);
    await owen_brA.categoryDialog.submit();
  });

  // ----- Base cat itself

  it(`Memah reloads page A`, async () => {
    await memah_brB.refresh2();
  });
  it(`... it now uses sort order Best First`, async () => {
    assert.eq(await memah_brB.metabar.getDiscLayoutAsPerBtn(), c.TestPostSortOrder.BestFirst);
  });
  it(`... comments actually sorted Best First`, async () => {
    await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.BestFirst);
  });

  // ----- Sub cat inherits sort order

  it(`Memah goes to the cat AB page`, async () => {
    await memah_brB.go2('/' + sortedPageAB.slug);
  });
  it(`... it's uses Best First too — inherited from cat A`, async () => {
    assert.eq(await memah_brB.metabar.getDiscLayoutAsPerBtn(), c.TestPostSortOrder.BestFirst);
  });
  it(`... comments sorted Best Frist `, async () => {
    await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.BestFirst);
  });

  // ----- Sub cat overrides

  it(`Memah goes to the cat AA page`, async () => {
    await memah_brB.go2('/' + sortedPageAA.slug);
  });
  it(`... but it still uses Newest First — a sub cat ovrrides parent cats`, async () => {
    assert.eq(await memah_brB.metabar.getDiscLayoutAsPerBtn(), c.TestPostSortOrder.NewestFirst);
  });
  it(`... comments actually sorted Newest First  LATER`, async () => {
    //await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.NewestFirst);
  });


  // ===== Page overrides cat

  it(`Owen goes to the AA page`, async () => {
    await owen_brA.go2('/' + sortedPageAA.slug);
  });

  it(`Owen sets the page sort order to Newest then Best First`, async () => {
    await owen_brA.topic.openDiscLayout();
    await owen_brA.discLayoutD.selectCommentsSortOrder(c.TestPostSortOrder.NewestThenBest);
  });

  it(`Memah reloads`, async () => {
    await memah_brB.refresh2();
  });
  it(`... now sees Newest then Best — the page ovrerrides ancestor cats`, async () => {
    await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.NewestThenBest);
  });

  // ----- One's own temp changes also override cat

  it(`Memah changes to Newest then Oldest for herself only`, async () => {
    await memah_brB.metabar.openDiscLayout();
    await memah_brB.discLayoutD.selectCommentsSortOrder(c.TestPostSortOrder.NewestThenOldest);
  });
  it(`... sees that sort order`, async () => {
    assert.eq(await memah_brB.metabar.getDiscLayoutAsPerBtn(), c.TestPostSortOrder.NewestThenOldest);
  });
  it(`... comments correctly sorted`, async () => {
    await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.NewestThenOldest);
settings.debugEachStep=true;
  });
  it(`After reload`, async () => {
    await memah_brB.refresh2();
  });
  it(`... Best First is back`, async () => {
    assert.eq(await memah_brB.metabar.getDiscLayoutAsPerBtn(), c.TestPostSortOrder.NewestThenBest);
  });
  it(`... comments correctly sorted`, async () => {
    await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.NewestThenBest);
  });


  // ===== Unset sort order

  // Unset page:

  it(`Owen clears the page's own sort order`, async () => {
    await owen_brA.topic.openDiscLayout();
    await owen_brA.discLayoutD.selectCommentsSortOrder(c.TestPostSortOrder.Default);
  });

  it(`Memah reloads`, async () => {
    await memah_brB.refresh2();
  });
  it(`... now category AA's sort order is back: Newest Fisrt`, async () => {
    assert.eq(await memah_brB.metabar.getDiscLayoutAsPerBtn(), c.TestPostSortOrder.NewestFirst);
  });
  it(`... comments correctly sorted`, async () => {
    await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.NewestFirst);
  });

  // Unset cat:

  it(`Owen goes to cat AA, opens the settings`, async () => {
    await owen_brA.go2('/latest/sub-cat-aa')
    await owen_brA.forumButtons.clickEditCategory();
  });
  it(`... clears AA's own sort order`, async () => {
    await owen_brA.categoryDialog.openDiscLayout();
    await owen_brA.discLayoutD.selectCommentsSortOrder(c.TestPostSortOrder.Default);
  });
  it(`... the sort order button now shows Best First, inherited from parent cat A`, async () => {
    assert.eq(await memah_brB.categoryDialog.getDiscLayoutAsPerBtn(),
            c.TestPostSortOrder.BestFirst);
  });
  it(`.. Owen saves`, async () => {
    /* Ops, bug!
    org.postgresql.util.PSQLException: ERROR: value for domain comt_order_d violates check constraint "i16gz_c_nz"
    */
    await owen_brA.categoryDialog.submit();
  });

  it(`Memah reloads`, async () => {
    await memah_brB.refresh2();
  });
  it(`... now base category A's sort order is in use: Best Fisrt`, async () => {
    assert.eq(await memah_brB.metabar.getDiscLayoutAsPerBtn(), c.TestPostSortOrder.BestFirst);
  });
  it(`... comments correctly sorted`, async () => {
    await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.BestFirst);
  });



  // Clear page
  // Clear cat


  // Move page to other cat

  // Move other page to this cat

  // ?

});
