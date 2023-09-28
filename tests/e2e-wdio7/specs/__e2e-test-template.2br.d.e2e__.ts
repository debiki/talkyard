/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import * as make from '../utils/make';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { dieIf } from '../utils/log-and-die';
import c from '../test-constants';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let mons: Member;
let mons_brA: TyE2eTestBrowser;
let modya: Member;
let modya_brA: TyE2eTestBrowser;
let corax: Member;
let corax_brA: TyE2eTestBrowser;
let regina: Member;
let regina_brB: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let michael: Member;
let michael_brB: TyE2eTestBrowser;
let mallory: Member;
let mallory_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

// For embedded comments:  EMBCMTS
// const localHostname = 'comments-for-e2e-test-embsth-localhost-8080';
// const embeddingOrigin = 'http://e2e-test-embsth.localhost:8080';

let site: IdAddress;
let forum: TwoCatsTestForum;  // or TwoPagesTestForum or EmptyTestForum or LargeTestForum

let michaelsTopicUrl: St;
let mariasTopicUrl: St;

const apiSecret: TestApiSecret = {
  nr: 1,
  userId: c.SysbotUserId,
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSecretKeyAbc123',
};



describe(`some-e2e-test  TyTE2E1234ABC`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({ // or addTwoPagesForum, addEmptyForum, addLargeForum
      title: "Some E2E Test",
      categoryAExtId: 'cat_a_ext_id',
      members: undefined, // default = everyone
        // ['mons', 'modya', 'regina', 'corax', 'memah', 'maria', 'michael', 'mallory']
    });

    // Search engine
    // To have the search engine index the imported site: (by default, test sites
    // aren't indexed)
    //builder.getSite().isTestSiteIndexAnyway = true;

    // Change hostname
    //builder.getSite().meta.localHostname = 'e2e-test-something';  // at .localhost
    // Or for embedded comments:  EMBCMTS
    //builder.getSite().meta.localHostname = localHostname;
    //builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;

    // Adding a new member:
    const newMember: Member = builder.addMmember('hens_username');

    const newPage: PageJustAdded = builder.addPage({
      id: 'extraPageId',
      folder: '/',
      showId: false,
      slug: 'extra-page',
      role: c.TestPageRole.Discussion,
      title: "In the middle",
      body: "In the middle of difficulty lies opportunity",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.maria.id,
    });

    builder.addPost({
      page: newPage,  // or e.g.: forum.topics.byMichaelCategoryA,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "It's not always good to procrastinate",
    });

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

    // Enable API.
    builder.settings({ enableApi: true });
    builder.getSite().apiSecrets = [apiSecret];

    // Add an ext id to a category.
    //forum.categories.specificCategory.extId = 'some-id'; // only in TwoPagesTestForum

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;
    mons = forum.members.mons;
    mons_brA = brA;
    modya = forum.members.modya;
    modya_brA = brA;
    corax = forum.members.corax;
    corax_brA = brA;

    regina = forum.members.regina;
    regina_brB = brB;
    maria = forum.members.maria;
    maria_brB = brB;
    memah = forum.members.memah;
    memah_brB = brB;
    michael = forum.members.michael;
    michael_brB = brB;
    mallory = forum.members.mallory;
    mallory_brB = brB;
    stranger_brB = brB;

    // Changing trust & threat levels:
    maria.trustLevel = c.TestTrustLevel.Basic;
    maria.threatLevel = c.TestThreatLevel.HopefullySafe;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
    michaelsTopicUrl = site.origin + '/' + forum.topics.byMichaelCategoryA.slug;
    mariasTopicUrl = site.origin + '/' + forum.topics.byMariaCategoryA.slug;
  });


  it(`Owen logs in to admin area, ... `, async () => {
    await owen_brA.adminArea.goToUsersEnabled(site.origin);
    await owen_brA.loginDialog.loginWithPassword(owen);
  });


  it(`Maria logs in`, async () => {
    await maria_brB.go2(michaelsTopicUrl);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });


  // For embedded comments:  EMBCMTS
  it(`Create embedding pages`, async () => {
    /*
    const dir = 'target';
    fs.writeFileSync(`${dir}/page-a-slug.html`, makeHtml('aaa', '#500'));
    fs.writeFileSync(`${dir}/page-b-slug.html`, makeHtml('bbb', '#040'));
    function makeHtml(pageName: string, bgColor: string): string {
      return utils.makeEmbeddedCommentsHtml({ pageName, discussionId: '', localHostname, bgColor});
    }
  });

  it(`Maria opens embedding page aaa`, async () => {
    await maria_brB.go(embeddingOrigin + '/page-a-slug.html');
  });

  it(`... logs in`, async () => {
    await maria_brB.complex.loginIfNeededViaMetabar(maria);
    */
  });

  // ...

});

