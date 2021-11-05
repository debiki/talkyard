/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import c from '../test-constants';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let trillian: Member;
let trillian_brA: TyE2eTestBrowser;
let maja: Member;
let maja_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: CatABTrustedTestForum;



describe(`some-e2e-test  TyTE2E1234ABC`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABTrustedForum({
      title: "Some E2E Test",
      members: ['mons', 'modya', 'corax', 'regina', 'trillian',
          'memah', 'maria', 'maja', 'memah', 'michael', 'mallory']
    });

    const newGs = builder.addLoadTestGooseUsers({
            nextNr:  0, howMany: 10, trustLevel: c.TestTrustLevel.New });
    const basicGs = builder.addLoadTestGooseUsers({
            nextNr: 10, howMany: 10, trustLevel: c.TestTrustLevel.Basic });
    const fullGs = builder.addLoadTestGooseUsers({
            nextNr: 20, howMany: 10, trustLevel: c.TestTrustLevel.FullMember });
    const trustedGs = builder.addLoadTestGooseUsers({
            nextNr: 30, howMany: 10, trustLevel: c.TestTrustLevel.Trusted });
    const regularGs = builder.addLoadTestGooseUsers({
            nextNr: 40, howMany: 10, trustLevel: c.TestTrustLevel.Regular });
    const coreGs = builder.addLoadTestGooseUsers({
            nextNr: 50, howMany: 10, trustLevel: c.TestTrustLevel.CoreMember });

    const newToFullGs = [...newGs, ...basicGs, ...fullGs];
    const trustedToCoreGs = [...trustedGs, ...regularGs, ...coreGs];
    const numPages = 60;

    // Page 100...100+N-1 are public, 100+N... are for Trusted members only.

    for (let pNr = 0; pNr <= numPages; pNr +=1) {
      const trustedPrefix = pNr >= 30 ? "Trusted " : '';
      const categoryId = trustedPrefix ?
              forum.categories.trustedCat.id : forum.categories.categoryA.id;
      const pageId = pNr + 100;
      
      const gsList = pNr <= numPages / 2 ? newToFullGs : trustedToCoreGs;
      const author = gsList[pNr % gsList.length];
      const newPage: PageJustAdded = builder.addPage({
        id: '' + pageId,
        folder: '/',
        showId: true, //false,
        slug: (trustedPrefix || 'pub').toLowerCase(), //  pageTitle.toLowerCase().replace(/ /g, '-'),
        role: c.TestPageRole.Discussion,
        title: `${trustedPrefix} Page ${pageId} Title`,
        body: `Page ${pageId} text.`,
        categoryId,
        authorId: author.id,
      });

      const replyer1 = gsList[(pNr + 1) % gsList.length];
      builder.addPost({
        page: newPage,
        nr: c.FirstReplyNr,
        parentNr: c.BodyNr,
        authorId: replyer1.id,
        approvedSource:  `Reply nr ${c.FirstReplyNr}`,
      });

      const replyer2 = gsList[(pNr + 1) % gsList.length];
      builder.addPost({
        page: newPage,
        nr: c.SecondReplyNr,
        parentNr: c.FirstReplyNr,
        authorId: replyer2.id,
        approvedSource: `Reply nr ${c.SecondReplyNr}`,
      });
    }

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    trillian = forum.members.trillian;
    trillian_brA = brA;

    maja = forum.members.maria;
    maja_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  /*
  it(`Owen logs in to admin area, ... `, async () => {
    await owen_brA.adminArea.goToUsersEnabled(site.origin);
    await owen_brA.loginDialog.loginWithPassword(owen);
  }); */


  it(`Trillian logs in`, async () => {
    await trillian_brA.go2(site.origin);
    await trillian_brA.complex.loginWithPasswordViaTopbar(trillian);
  });


  it(`Maja logs in`, async () => {
    await maja_brB.go2(site.origin);
    await maja_brB.complex.loginWithPasswordViaTopbar(maja);
  });

});

