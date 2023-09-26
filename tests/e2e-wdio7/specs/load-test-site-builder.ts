/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

export interface ForumSite {
  site: IdAddress;
  forum: CatABTrustedTestForum;
};


// More params later: ?
//
// - Num replies, and distribution — distributed linearly? exp?
//   from 0 up to max, e.g.  0 2 4 ... 16, 18 if 18 = max and 9 pages  (16/8 = step 2,
//   if linearly distr). Or 1, 2, 4, 8, 16, 32 if 32 max and distr exp?
//
// - Drafts ?
//   Or drafts per user = say 2  —> means each authn user will have 2 drafts
//   on a page with the same nr as hens id? ... hmm, only half of the pages,
//   so also some without any drafts?
//
// - Num users with how many unapproved posts?
//
export function addTestsForConstructingLoadTestSiteAndLoggingIn(ps: {
  siteName: St,
  hostnameSuffix?: St,
  numPages: Nr,
  numUsers: Nr,
  halfPagesTrustedOnly?: Bo,
  logInAsTrillianAndMaja?: Bo,
}): ForumSite {
  assert.that((ps.numUsers % 6) === 0, `numUsers should be divisible by 6,
      so can create numUsers / 6 users in each trust level`);
  const numUsersPerTl = ps.numUsers / 6;

  assert.that((ps.numPages % 2) === 0, `numPages should be divisible by 2,
      so can create numPages / 2 public + numPages / 2 access restricted pages.`);
  const halfNumPages = ps.numPages / 2;

  const forumSite: Partial<ForumSite> = {};

  let brA: TyE2eTestBrowser;
  let brB: TyE2eTestBrowser;
  let trillian: Member;
  let trillian_brA: TyE2eTestBrowser;
  let maja: Member;
  let maja_brB: TyE2eTestBrowser;

  let site: IdAddress;
  let forum: CatABTrustedTestForum;


  it(`Construct site`, async () => {
    const builder = buildSite();
    if (ps.hostnameSuffix) {
      const m: SiteMeta = builder.getSite().meta;
      m.localHostname = m.localHostname + ps.hostnameSuffix;
    }

    forum = builder.addCatABTrustedForum({
      title: ps.siteName,
      members: ['mons', 'modya', 'corax', 'regina', 'trillian',
          'memah', 'maria', 'maja', 'memah', 'michael', 'mallory']
    });

    const newUsers = builder.addLoadTestGooseUsers({
            nextNr: 1, howMany: numUsersPerTl, trustLevel: c.TestTrustLevel.New });
    const basicUsers = builder.addLoadTestGooseUsers({
            nextNr: 1, howMany: numUsersPerTl, trustLevel: c.TestTrustLevel.Basic });
    const fullUsers = builder.addLoadTestGooseUsers({
            nextNr: 1, howMany: numUsersPerTl, trustLevel: c.TestTrustLevel.FullMember });
    const trustedUsers = builder.addLoadTestGooseUsers({
            nextNr: 1, howMany: numUsersPerTl, trustLevel: c.TestTrustLevel.Trusted });
    const regularUsers = builder.addLoadTestGooseUsers({
            nextNr: 1, howMany: numUsersPerTl, trustLevel: c.TestTrustLevel.Regular });
    const coreUsers = builder.addLoadTestGooseUsers({
            nextNr: 1, howMany: numUsersPerTl, trustLevel: c.TestTrustLevel.CoreMember });

    const newToFullUsers = [...newUsers, ...basicUsers, ...fullUsers];
    const trustedToCoreUsers = [...trustedUsers, ...regularUsers, ...coreUsers];

    // Page 0..<halfNumPages are public.
    // Pages halfNumPages..<ps.numPages are for >= Trusted members only.
    //
    for (let pageNr = 0; pageNr < ps.numPages; pageNr +=1) {
      const trustedOnly = ps.halfPagesTrustedOnly !== false && pageNr >= halfNumPages;
      const trustedPrefix = trustedOnly ? "Trusted " : '';

      const categoryId = trustedOnly ?
              forum.categories.trustedCat.id : forum.categories.categoryA.id;

      // Add 10 000 so won't collide with about-category pages and the forum main page.
      const pageId = pageNr + 10*1000;

      // Let low trust level users be the authors of all public pages.
      // And higher trust level users be the authors of the access restricted pages.
      const authorsList = pageNr < halfNumPages ? newToFullUsers : trustedToCoreUsers;
      const author = authorsList[pageNr % authorsList.length];

      // When sorting by time, let every 2nd recent page be an access restricted page.
      // OLD: (By making its created-at time 1 year more recent — otherwise they'd all
      // be placed last. Or 1 year older.)
      const extraTimeMs = trustedOnly ? 1000 * 60 : 0; // !trustedOnly ? 0 : ((pageNr % 2) * 2 - 1) * 1000 * 3600 * 24 * 365;
      const createdAtMs =
              extraTimeMs + c.JanOne2020HalfPastFive + (
                  ps.halfPagesTrustedOnly !== false
                      ? 1000 * 3600 * (pageNr % halfNumPages)
                      // One minute between each page
                      : pageNr * 1000 * 60);

      const newPage: PageJustAdded = builder.addPage({
        id: '' + pageId,
        folder: '/',
        showId: true,
        slug: (trustedPrefix || 'pub').trim().toLowerCase(),
        role: c.TestPageRole.Discussion,
        title: `${trustedPrefix} Page ${pageId} Title`,
        body: `Page ${pageId} text.`,
        categoryId,
        authorId: author.id,
        createdAtMs,
      });

      // For now, 9 replies per page —> 10 posts (body + 9 replies).
      // Or, no, just 0, 2, 8 or 16 replies — otherwise out of disk quota.
      const mod10 = pageNr % 10;
      const numReplies = mod10 < 3 ? 0 : (mod10 < 6 ? 2 : (mod10 < 9 ? 8 : 16));
      for (let i = 0; i < numReplies; i += 1) {
        const replyNr = c.FirstReplyNr + i;
        // pNr + 0 is the author; add 1 at least.
        const replyer = authorsList[(pageNr + i + 1) % authorsList.length];
        builder.addPost({
          page: newPage,
          nr: replyNr,
          parentNr: c.BodyNr,
          authorId: replyer.id,
          approvedSource:  `Reply nr ${replyNr}`,
          createdAtMs: createdAtMs + i,
        });
      }
    }


    assert.refEq(builder.getSite(), forum.siteData);
  });


  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    forumSite.forum = forum;
    forumSite.site = site;
    // Could skip disk quota limits too?
    server.skipRateLimits(site.id);
  });


  if (ps.logInAsTrillianAndMaja !== false) {
    it(`Init browsers`, async () => {
      brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
      brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

      trillian = forum.members.trillian;
      trillian_brA = brA;

      maja = forum.members.maria;
      maja_brB = brB;
    });

    it(`Trillian logs in — she can see the access restricted pages`, async () => {
      await trillian_brA.go2(site.origin);
      await trillian_brA.complex.loginWithPasswordViaTopbar(trillian);
    });

    it(`Maja logs in — can see public pages only`, async () => {
      await maja_brB.go2(site.origin);
      await maja_brB.complex.loginWithPasswordViaTopbar(maja);
    });
  }

  return forumSite as ForumSite;
}
