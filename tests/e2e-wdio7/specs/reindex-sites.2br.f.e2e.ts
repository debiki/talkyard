/// <reference path="../test-types.ts"/>

import server from '../utils/server';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { addTestsForConstructingLoadTestSiteAndLoggingIn } from './load-test-site-builder';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;

let owen: Member;
let owen_brA: TyE2eTestBrowser;

let stranger_brA: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

const _10001 = '10001';
const _10031 = '10031';
const _10061 = '10061';

describe(`reindex-sites.2br.f  TyTREINDEX3`, () => {

  const forum2 = addTestsForConstructingLoadTestSiteAndLoggingIn({
    siteName: "Forum-2 Reindex Test",
    hostnameSuffix: '-f2',
    numPages: 2,
    numUsers: 6,
    halfPagesTrustedOnly: false,
    logInAsTrillianAndMaja: false,
  });

  const forum32 = addTestsForConstructingLoadTestSiteAndLoggingIn({
    siteName: "Forum-32 Reindex Test",
    hostnameSuffix: '-f32',
    numPages: 32,
    numUsers: 6,
    halfPagesTrustedOnly: false,
    logInAsTrillianAndMaja: false,
    everythingCreatedAtSameMs: 1234,
  });

  const forum62 = addTestsForConstructingLoadTestSiteAndLoggingIn({
    siteName: "Forum-62 Reindex Test",
    hostnameSuffix: '-f62',
    numPages: 62,
    numUsers: 6,
    halfPagesTrustedOnly: false,
    logInAsTrillianAndMaja: false,
  });

  it(`Init browsers`, async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum62.forum.members.owen;
    owen_brA = brA;
    stranger_brA = brA;
    stranger_brB = brB;
  });


  it(`Someone searches for page 10001 in Forum-2`, async () => {
    await stranger_brA.go2(forum2.site.origin);
    await stranger_brA.topbar.searchFor(_10001);
  });
  it(`... finds nothing`, async () => {
    await stranger_brA.searchResultsPage.assertResultLinksAre([]);
  });


  it(`Someone searches for page 10001 in Forum-32 too`, async () => {
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

  it(`... Page 31 also hasn't, in Forum-62  (because pages 32...61 are first)`, async () => {
    await owen_brA.searchResultsPage.searchForWaitForResults(_10031);
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



  it(`Forum-2 hasn't been indexed at all — page 10001 still not found`, async () => {
    await stranger_brB.go2(forum2.site.origin);
    await stranger_brB.topbar.searchFor(_10001);
    await stranger_brB.searchResultsPage.assertResultLinksAre([]);
  });
  it(`Indexing Forum-2...`, async () => {
    await server.reindexSites([forum2.site.id]);
  });
  it(`... Soon page 10001 is searchable in Forum-2 too`, async () => {
    await stranger_brB.searchResultsPage.searchForUntilNumPagesFound(_10001, 1);
  });


  it(`Owen finds his comment, when searching
              — so, normal indexing of new posts didn't get messed up`, async () => {
    await owen_brA.topbar.searchFor('keep_my_name');
    const url = commentPagePath + '#post-' + c.FirstReplyNr;
    await owen_brA.searchResultsPage.assertResultLinksAre([url]);
  });

});

