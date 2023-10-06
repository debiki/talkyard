/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import server from '../utils/server';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { addTestsForConstructingLoadTestSiteAndLoggingIn } from './load-test-site-builder';
import { j2s } from '../utils/log-and-die';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;

let owen: Member;
let owen_brA: TyE2eTestBrowser;

let stranger_brA: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

const _10001 = '10001';
const _10021 = '10021';
const _10031 = '10031';
const _10061 = '10061';


/// This test breaks if the indexer is "too fast", because this test tries to
/// verify that the posts are indexed in the expected order — but if they're all
/// done instantly, then, some tests herein fails. [dont_index_too_fast_if_testing]
///
describe(`reindex-sites.2br.f  TyTREINDEX3`, () => {

  const forum24 = addTestsForConstructingLoadTestSiteAndLoggingIn({
    siteName: "Forum-24 Reindex Test",
    hostnameSuffix: '-f24',
    numPages: 24,
    numUsers: 6,
    halfPagesTrustedOnly: false,
    logInAsTrillianAndMaja: false,
    // This'll test the reindex time range post id offset, since many posts
    // will have the same created-at time.
    everythingCreatedAtSameMs: c.JanOne2020HalfPastFive,
    // Simpler to verify that all posts get indexed & searchable, if we don't
    // need to think about comments (instead, only the 24 pages).
    skipComments: true,
  });

  const forum32 = addTestsForConstructingLoadTestSiteAndLoggingIn({
    siteName: "Forum-32 Reindex Test",
    hostnameSuffix: '-f32',
    numPages: 32,
    numUsers: 6,
    halfPagesTrustedOnly: false,
    logInAsTrillianAndMaja: false,
    // Makes the test a little bit quicker ...
    skipComments: true,
  });

  const forum62 = addTestsForConstructingLoadTestSiteAndLoggingIn({
    siteName: "Forum-62 Reindex Test",
    hostnameSuffix: '-f62',
    numPages: 62,
    numUsers: 6,
    halfPagesTrustedOnly: false,
    logInAsTrillianAndMaja: false,
    // ... But good with some comments somewhere.
    skipComments: false,
  });

  it(`Init browsers`, async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum62.forum.members.owen;
    owen_brA = brA;
    stranger_brA = brA;
    stranger_brB = brB;
  });


  it(`Someone searches for page 10001 in Forum-32`, async () => {
    await stranger_brB.go2(forum32.site.origin);
    await stranger_brB.topbar.searchFor(_10001);
  });
  it(`... finds nothing`, async () => {
    await stranger_brB.searchResultsPage.assertResultLinksAre([]);
  });
  it(`... and for 10031, the most recently created page`, async () => {
    await stranger_brB.searchResultsPage.searchForWaitForResults(_10031);
  });
  it(`... finds nothing`, async () => {
    await stranger_brB.searchResultsPage.assertResultLinksAre([]);
  });


  it(`Owen goes to Forum-62`, async () => {
    await owen_brA.go2(forum62.site.origin);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });
  it(`Owen searches for page 10001 in Forum-62`, async () => {
    await owen_brA.go2(forum62.site.origin);
    await owen_brA.topbar.searchFor(_10001);
  });
  it(`... finds nothing`, async () => {
    await owen_brA.searchResultsPage.assertResultLinksAre([]);
  });
  it(`... and for 10061, the most recently created page in Forum-62`, async () => {
    await owen_brA.searchResultsPage.searchForWaitForResults(_10061);
  });
  it(`... finds nothing`, async () => {
    await owen_brA.searchResultsPage.assertResultLinksAre([]);
  });


  it(`The server starts indexing Forum-62 and -32 ...`, async () => {
    await server.reindexSites([forum62.site.id, forum32.site.id]);
  });

  it(`Pages 10031 get indexed first in Forum-32 — the most recent posts first`, async () => {
    await stranger_brB.searchResultsPage.searchForUntilNumPagesFound(_10031, 1);
  });
  it(`... and page 10061 in Forum-62`, async () => {
    await owen_brA.searchResultsPage.searchForUntilNumPagesFound(_10061, 1);
  });

  it(`But page 10001 hasn't yet been indexed, not in Forum-32 ...`, async () => {
    await stranger_brB.searchResultsPage.searchForWaitForResults(_10001);
    await stranger_brB.searchResultsPage.assertResultLinksAre([]);
  });
  it(`... and not in Forum-62`, async () => {
    await owen_brA.searchResultsPage.searchForWaitForResults(_10001);
    await owen_brA.searchResultsPage.assertResultLinksAre([]);
  });

  it(`... Page 21 also hasn't, in Forum-62  (because pages 22...61 are first)`, async () => {
    await owen_brA.searchResultsPage.searchForWaitForResults(_10021);
    await owen_brA.searchResultsPage.assertResultLinksAre([]);
  });
  it(`... until after a while`, async () => {
    await owen_brA.searchResultsPage.searchForUntilNumPagesFound(_10031, 1);
  });
  it(`But page 10001 still not done, in Forum-62 — it's oldest, indexed last`, async () => {
    await owen_brA.searchResultsPage.searchForWaitForResults(_10001);
    await owen_brA.searchResultsPage.assertResultLinksAre([]);
  });

  it(`Page 10001 gets indexed in Forum-32`, async () => {
    await stranger_brB.searchResultsPage.searchForUntilNumPagesFound(_10001, 1);
  });
  it(`... and in Forum-62, eventually`, async () => {
    await owen_brA.searchResultsPage.searchForUntilNumPagesFound(_10001, 1);
  });


  it(`Owen goes to that page, 10001`, async () => {
    await owen_brA.searchResultsPage.goToSearchResult(_10001);
  });
  let commentPagePath: St;
  it(`... posts a comment`, async () => {
    commentPagePath = await owen_brA.urlPath();
    await owen_brA.complex.replyToOrigPost(
        ((Date.now() / 1000) % 2) === 1
            ? `If I was an owl, I could keep_my_name, Owen`
            : `If my name was Robin and if I was an owl, I could not keep_my_name`);
  });



  it(`Forum-24 hasn't been indexed at all — page 10001 not found`, async () => {
    await stranger_brB.go2(forum24.site.origin);
    await stranger_brB.topbar.searchFor(_10001);
    await stranger_brB.searchResultsPage.assertResultLinksAre([]);
  });



  // ----- Indexing posts with the same timestamp

  // (This could have been a separate e2e test, oh well.)

  it(`Indexing Forum-24, works fine, although everything has the same timestamp`, async () => {
    await server.reindexSites([forum24.site.id]);
  });

  // The [indexer_batch_size_is_20] in dev-test. This'll test that adding posts
  // from time ranges, will make use of the post id offset (when many posts have
  // the same timestamp), without skipping any post.
  //
  // If there's an [off_by_one_bug_in_the_indexer], then a title or orig post
  // won't get indexed (or gets indexed twice), and one of the tests here fails (or not).
  // (Note that there are no comments.)
  // This query failed when I tested:  /-/search?q=10013  (found the tite, not the page body).
  //
  for (let nr = 24 - 1; nr >= 0 ; nr -= 1) {
    const pageNameNr = 10000 + nr;
    it(`... Soon page ${pageNameNr} is searchable in Forum-24`, async () => {
      const expected = [  // already sorted
            `/-${pageNameNr}/pub#post-0`,  // page title
            `/-${pageNameNr}/pub#post-1`]; // page body
      let actual: St[] | U;
      await stranger_brB.searchResultsPage.searchForUntilNumPagesFound('' + pageNameNr, 1);
      await stranger_brB.waitUntil(async () => {
        actual = await stranger_brB.searchResultsPage.getHitLinks();
        actual.sort();
        return _.isEqual(actual, expected)
      }, {
        message: () => `Waiting for serch hits: ${j2s(expected)}, getting: ${j2s(actual)}`,
      })
    });
  }

  it(`... Page 10001 found, indeed,  ttt`, async () => {
    await stranger_brB.searchResultsPage.searchForUntilNumPagesFound(_10001, 1);
  });


  it(`Owen finds his comment, when searching
              — so, normal indexing of new posts didn't get messed up`, async () => {
    await owen_brA.topbar.searchFor('keep_my_name');
    const url = commentPagePath + '#post-' + c.FirstReplyNr;
    await owen_brA.searchResultsPage.assertResultLinksAre([url]);
  });

});

