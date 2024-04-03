/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { logBitHappy, j2s, logError, die, logBoring } from '../utils/log-and-die';
import c from '../test-constants';
import settings from '../utils/settings';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

// For embedded comments:  EMBCMTS
// const localHostname = 'comments-for-e2e-test-embsth';
// const embeddingOrigin = 'http://e2e-test-embsth.localhost:8080';

let site: IdAddress;
let forum: CatABTestForum;

let tooManyQueriesWrites = false;


describe(`cats-perf-many.2br.d  TyTECATPREFMNY`, () => {

  if (settings.prod) {
    console.log("Skipping this spec — the server needs to have upsert conf vals enabled."); // E2EBUG
    return;
  }

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "Many Cats E2E Test",
      members: ['memah', 'maja'],
    });

    // Add 7 base categories, then there's 7 + 3 base cats: these 7 + Cat A, B, Staff.
    for (let catId = 101; catId <= 107; ++catId) {
      builder.addCategoryWithAboutPageAndPerms(forum.forumPage, {
        id: catId,
        parentCategoryId: forum.categories.rootCat.id,
        name: `Base Cat ${catId}`,
        slug: `base-cat-${catId}`,
        aboutPageText: `About cat ${catId}`,
        position: catId - 80,
      });
    }

    // Add 100 sub categories.
    // A Talkyard forum really has a base category with 500 sub categories — they
    // auto generate one category per software package their users have created
    // for the company's software.
    for (let subCatNr = 1001; subCatNr <= 1100; ++subCatNr) {
      builder.addCategoryWithAboutPageAndPerms(forum.forumPage, {
        id: subCatNr,
        parentCategoryId: 107,  // the last base category, see above
        name: `Sub Cat ${subCatNr}`,
        slug: `sub-cat-${subCatNr}`,
        aboutPageText: `About cat ${subCatNr}`,
      });
    }

    // Add 10 pages in every third base cat (namely cat ids 101, 104, 107)
    for (let nr = 0; nr < 30; ++nr) {
      const pageId = 101 + nr;
      const catId = 101 + (nr % 3) * 3;
      builder.addPage({
        id: '' + pageId,
        folder: '/',
        showId: false,
        slug: `page-${pageId}`,
        role: c.TestPageRole.Discussion,
        title: `Page ${pageId} in Base Cat ${catId}`,
        body: `Page_${pageId}_body, text text.`,
        categoryId: catId,
        authorId: forum.members.maja.id,
        createdAtMs: c.JanOne2020HalfPastFive + pageId * 1000,
      });
    }

    // Add 30 pages in every third sub cat. They should appear on the category list page.
    for (let nr = 0; nr <= 29; ++nr) {
      const pageId = 1001 + nr;
      const catId = 1001 + (nr % 10) * 3;  // last ids will be 1028 (1001 + 3*9), 25, 22, ...
      builder.addPage({
        id: '' + pageId,
        folder: '/',
        showId: false,
        slug: `page-${pageId}`,
        role: c.TestPageRole.Discussion,
        title: `Page ${pageId} in Sub Cat ${catId}`,
        body: `Page_${pageId}_body, text text.`,
        categoryId: catId,
        authorId: forum.members.maja.id,
        createdAtMs: c.JanOne2020HalfPastFive + pageId * 1000,
      });
    }

    // Add some pages in staff cat.
    for (let pageId = 2001; pageId <= 2010; ++pageId) {
      const catId = forum.categories.staffCat.id;
      builder.addPage({
        id: '' + pageId,
        folder: '/',
        showId: false,
        slug: `page-${pageId}`,
        role: c.TestPageRole.Discussion,
        title: `Page ${pageId} in Staff Cat`,
        body: `Page_${pageId}_body, text text.`,
        categoryId: catId,
        authorId: forum.members.owen.id,
        createdAtMs: c.JanOne2020HalfPastFive + pageId * 1000,
      });
    }

    // Disable notifications, or notf email counts will be off
    // (since Owen would get emails).
    builder.settings({
      numFirstPostsToApprove: 0,
      //maxPostsPendApprBefore: 0,
      numFirstPostsToReview: 0,
    });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Pause background jobs`, async () => {
    await server.pauseJobs({ howManySeconds: 15 });
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipLimits(site.id, { rateLimits: true, diskQuotaLimits: true });
  });


  // ----- Not too many DB queries, for stranger

  interface ServerStats { numQueriesDone: Nr, numWritesDone: Nr };;
  let statsBef: ServerStats;
  let statsAft: ServerStats;

  it(`Remember num db reqs before`, async () => {
    await server.pauseJobs({ howManySeconds: 10 });
    statsBef = await server.getTestCounters();
  });
  it(`A stranger goes to the categories page`, async () => {
    await stranger_brB.go2(site.origin + '/categories');
  });
  it(`Remember db reqs after`, async () => {
    statsAft = await server.getTestCounters();
  });


  it(`The server needed just ? database requests to render the page`, async () => {
    logBoring(`Stats before: ${j2s(statsBef)}, after: ${j2s(statsAft)}`);
    // Currently: 599 queries,  260 writes, why so many? Hmm, maybe rendering about-
    // category pages, and caching the results, in different resolutions?
    // COuld investigate.
    // Over time:
    // 2022-08-08:  599 queries,  260 writes.
    // [E2EBUG] RACE: Theoretically, this can fail, if some background job keeps
    // running for a short while after pauseJobs() above (if it had started, before that).
    checkServerStats({ statsBef, statsAft, maxQueries: 599, maxWrites: 260 });
  });

  it(`The stranger reloads the page`, async () => {
    await server.pauseJobs({ howManySeconds: 10 });
    statsBef = await server.getTestCounters();
    await stranger_brB.refresh2();
    statsAft = await server.getTestCounters();
  });

  it(`Now the server didn't access the database — everything cached in mem`, async () => {
    logBoring(`Stats before: ${j2s(statsBef)}, after: ${j2s(statsAft)}`);
    checkServerStats({ statsBef, statsAft, maxQueries: 0, maxWrites: 0 });
  });

  function checkServerStats(ps: { statsBef: ServerStats, statsAft: ServerStats,
          maxQueries: Nr, maxWrites: Nr,
          // or instead?: (not impl)
          maxDiff?: Partial<ServerStats> }) {
    const numQueries = statsAft.numQueriesDone - statsBef.numQueriesDone;
    const numWrites = statsAft.numWritesDone - statsBef.numWritesDone;
    const maxSt = ` max allowed: ${ps.maxQueries} and ${ps.maxWrites}`;
    if (numQueries <= ps.maxQueries && numWrites <= ps.maxWrites) {
      logBitHappy(`The server did:  ${numQueries} queries,  ${numWrites} writes, ${maxSt}.`);
    }
    else {
      logError(`The server did:  ${numQueries} queries,  ${numWrites} writes, ${maxSt
            } — too_many.`);
      tooManyQueriesWrites = true;
    }
  }

  // ----- Not too many DB queries, logged in

  it(`Owen goes to the categories page, logs in`, async () => {
    await owen_brA.go2(site.origin + '/categories');
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  it(`... reloads the page`, async () => {
    // The last stats test — need not pause for so long. now.
    await server.pauseJobs({ howManySeconds: 5 });
    statsBef = await server.getTestCounters();
    await owen_brA.refresh2();
    statsAft = await server.getTestCounters();
  });

  it(`The server needed ? database requests to render the page, with Owen's data`, async () => {
    logBoring(`Stats before: ${j2s(statsBef)}, after: ${j2s(statsAft)}`);
    // Over time:
    // 2022-08-08:  36 queries,  24 writes.
    checkServerStats({ statsBef, statsAft, maxQueries: 36, maxWrites: 24 });
  });


  // ----- Correct num cats, & private hidden   TyTPRIVCATS

  it(`The stranger sees 9 base cats, 100 sub cats`, async () => {
      const catl = stranger_brB.forumCategoryList;
      assert.eq(await catl.numCategoriesVisible(), 9);
      assert.eq(await catl.numSubCategoriesVisible(), 100);
  });

  it(`... cannot see the staff cat`, async () => {
      const catl = stranger_brB.forumCategoryList;
      assert.not(await catl.isCategoryVisible(forum.categories.staffCat.name));
  });

  it(`Owen sees 10 base cats (9 + the staf cat), and 100 sub cats`, async () => {
      const catl = owen_brA.forumCategoryList;
      assert.eq(await catl.numCategoriesVisible(), 10);      // ff
      assert.eq(await catl.numSubCategoriesVisible(), 100);  // ff
  });

  it(`... sees the staff cat`, async () => {
      const catl = owen_brA.forumCategoryList;
      assert.that(await catl.isCategoryVisible(forum.categories.staffCat.name));
  });


  // ----- Cat sort order    TyTCATORDR

  addTopicsOrderTests(() => stranger_brB, { inclStaffOnly: false });
  addTopicsOrderTests(() => owen_brA, { inclStaffOnly: true });


  function addTopicsOrderTests(br: () => TyE2eTestBrowser, ps: { inclStaffOnly: Bo }) {
    it(`Categories and topics-per-cat are sorted: Cat 101`, async () => {
      assert.deepEq(await br().forumCategoryList.getTopicTitles(1), [
            "Page 128 in Base Cat 101",
            "Page 125 in Base Cat 101",
            "Page 122 in Base Cat 101",
            "Page 119 in Base Cat 101",
            "Page 116 in Base Cat 101",
            "Page 113 in Base Cat 101",
            // Only the most recent 6 pages are included, although there are 4 more.
            ]);
    });

    it(`... cat 102 and 103 empty`, async () => {
      assert.deepEq(await br().forumCategoryList.getTopicTitles(2), []);
      assert.deepEq(await br().forumCategoryList.getTopicTitles(3), []);
    });

    it(`... cat 104 shows 6 topics`, async () => {
      assert.deepEq(await br().forumCategoryList.getTopicTitles(4), [
            "Page 129 in Base Cat 104",
            "Page 126 in Base Cat 104",
            "Page 123 in Base Cat 104",
            "Page 120 in Base Cat 104",
            "Page 117 in Base Cat 104",
            "Page 114 in Base Cat 104",
            ]);
    });

    it(`... cat 105 and 106 empty`, async () => {
      assert.deepEq(await br().forumCategoryList.getTopicTitles(5), []);
      assert.deepEq(await br().forumCategoryList.getTopicTitles(6), []);
    });

    it(`... cat 107 shows 6 *sub* category topics`, async () => {
      assert.deepEq(await br().forumCategoryList.getTopicTitles(7), [
            "Page 1030 in Sub Cat 1028",
            "Page 1029 in Sub Cat 1025",
            "Page 1028 in Sub Cat 1022",
            "Page 1027 in Sub Cat 1019",
            "Page 1026 in Sub Cat 1016",
            "Page 1025 in Sub Cat 1013",
            ]);
    });

    it(`... cat 108 and 109 empty (that is, Cat A and B)`, async () => {
      assert.deepEq(await br().forumCategoryList.getTopicTitles(8), []);
      assert.deepEq(await br().forumCategoryList.getTopicTitles(9), []);
    });

    if (ps.inclStaffOnly) {
      it(`... cat 110 shows 6 staff-only topics   TyTSEECATTOPS`, async () => {
        assert.deepEq(await br().forumCategoryList.getTopicTitles(10), [
              "Page 2010 in Staff Cat",
              "Page 2009 in Staff Cat",
              "Page 2008 in Staff Cat",
              "Page 2007 in Staff Cat",
              "Page 2006 in Staff Cat",
              "Page 2005 in Staff Cat",
              ]);
      });
    }
  }


  // ----- Stats failure?

  it(`Did the server talk too much with the database?`, async () => {
    if (tooManyQueriesWrites) {
      die("Yes it did, error, search for 'too_many' above.");
    }
    else {
      logBoring("No, all fine.");
    }
  });

});

