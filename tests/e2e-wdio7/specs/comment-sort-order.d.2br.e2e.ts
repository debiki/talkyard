/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';
import * as comtSortUtil from './comment-sort-order.util';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

let sortedPage: PageJustAdded;
let defaultPage: PageJustAdded;


describe(`comment-sort-order.d.2br  TyTECOMSORTORD`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();

    forum = builder.addTwoCatsForum({
      title: "Comt Order E2E Test",
      categoryAExtId: 'cat_a_ext_id',
      members: undefined, // default = everyone
        // ['mons', 'modya', 'regina', 'corax', 'memah', 'maria', 'michael', 'mallory']
    });

    const result = comtSortUtil.addCommentsToSort({
      builder, forum,
      // Same cat — we're testing per page settings only; not cat inheritance.
      sortedPage: { catId: forum.categories.catA.id, suffix: 'sorted' },
      defaultPage: { catId: forum.categories.catA.id, suffix: 'unchanged' },
    });

    //forum = result.forum;
    defaultPage = result.defaultPage;
    sortedPage = result.sortedPage;

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
    await owen_brA.go2(site.origin + '/' + sortedPage.slug);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });


  it(`Memah logs in`, async () => {
    await memah_brB.go2(site.origin + '/' + sortedPage.slug);
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });


  // ----- Oldest first


  it(`The comments are sorted oldest first, the built-in default`, async () => {
    await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.OldestFirst);
  });


  // ----- Newest first, for everyone


  it(`Owen changes the sort order to newest first, for everyone, this page only`, async () => {
    await owen_brA.topic.openDiscLayout();
    await owen_brA.discLayoutD.selectCommentsSortOrder(c.TestPostSortOrder.NewestFirst);
  });
  it(`... now they're sorted newest first`, async () => {
    await comtSortUtil.checkSortOrder(owen_brA, c.TestPostSortOrder.NewestFirst);
  });
  it(`... also after page reload`, async () => {
    await owen_brA.refresh2();
    await comtSortUtil.checkSortOrder(owen_brA, c.TestPostSortOrder.NewestFirst);
  });


  it(`Memah doesn't see the changes yet`, async () => {
    await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.OldestFirst);
  });
  it(`... but she reloads the page`, async () => {
    await memah_brB.refresh2();
  });
  it(`... and sees the new sort order: Newest First`, async () => {
    await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.NewestFirst);
  });


  // ----- Temp change, for oneself


  it(`Memah changes back, temporarily, for herself only`, async () => {
    await memah_brB.metabar.openDiscLayout();
    await memah_brB.discLayoutD.selectCommentsSortOrder(c.TestPostSortOrder.OldestFirst);
  });
  it(`Sort order is oldest-first again`, async () => {
    await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.OldestFirst);  // vf
  });
  it(`After reload, Memah sees the default order choosen by Owen: Newest-first`, async () => {
    await memah_brB.refresh2();
    await comtSortUtil.checkSortOrder(memah_brB, c.TestPostSortOrder.NewestFirst);
  });


  // ----- Test all

  // Newest first: Tested just above. But haven't switched to these:
  const remaining: [Nr, St][] = [
    [c.TestPostSortOrder.BestFirst, "Best first"],
    [c.TestPostSortOrder.NewestThenBest, "Newest then Best first"],
    [c.TestPostSortOrder.NewestThenOldest, "Newst then Oldest first"],
    // We've tested Oldest First, but not switching *back* to Oldest First. Let's do:
    [c.TestPostSortOrder.OldestFirst, "Oldest first"],
    ];

  for (let orderAndName of remaining) {
    const [orderId, orderName] = orderAndName;

    it(`Owen changes the sort order to ${orderName}, for everyone, this page only`, async () => {
      await owen_brA.topic.openDiscLayout();
      await owen_brA.discLayoutD.selectCommentsSortOrder(orderId);
    });

    it(`... now they're sorted ${orderName}`, async () => {
      await comtSortUtil.checkSortOrder(owen_brA, orderId);
    });

    it(`Memah sees comments sorted by ${orderName} too`, async () => {
      await memah_brB.refresh2();
      await comtSortUtil.checkSortOrder(memah_brB, orderId);
    });
  }

});
