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


let everyonesBrowsers: TyAllE2eTestBrowsers;
let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;
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

  it(`construct site`, () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({ // or addTwoPagesForum, addEmptyForum, addLargeForum
      title: "Some E2E Test",
      members: undefined, // default = everyone
        // ['mons', 'modya', 'regina', 'corax', 'memah', 'maria', 'michael', 'mallory']
    });

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
      approvedSource: "The secret of getting ahead is getting started",
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
    forum.categories.specificCategory.extId = 'specific cat ext id';

    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owen_brA = richBrowserA;
    mons = forum.members.mons;
    mons_brA = richBrowserA;
    modya = forum.members.modya;
    modya_brA = richBrowserA;
    corax = forum.members.corax;
    corax_brA = richBrowserA;

    regina = forum.members.regina;
    regina_brB = richBrowserB;
    maria = forum.members.maria;
    maria_brB = richBrowserB;
    memah = forum.members.memah;
    memah_brB = richBrowserB;
    michael = forum.members.michael;
    michael_brB = richBrowserB;
    mallory = forum.members.mallory;
    mallory_brB = richBrowserB;
    stranger_brB = richBrowserB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
    michaelsTopicUrl = site.origin + '/' + forum.topics.byMichaelCategoryA.slug;
    mariasTopicUrl = site.origin + '/' + forum.topics.byMariaCategoryA.slug;
  });


  it(`Owen logs in to admin area, ... `, () => {
    owen_brA.adminArea.goToUsersEnabled(site.origin);
    owen_brA.loginDialog.loginWithPassword(owen);
  });


  it(`Maria logs in`, () => {
    maria_brB.go2(michaelsTopicUrl);
    maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });


  // For embedded comments:  EMBCMTS
  it(`Creates an embedding page`, () => {
    /*
    const dir = 'target';
    fs.writeFileSync(`${dir}/page-a-slug.html`, makeHtml('aaa', '#500'));
    fs.writeFileSync(`${dir}/page-b-slug.html`, makeHtml('bbb', '#040'));
    function makeHtml(pageName: string, bgColor: string): string {
      return utils.makeEmbeddedCommentsHtml({ pageName, discussionId: '', localHostname, bgColor});
    }
  });
  it("Maria opens embedding page aaa", () => {
    maria_brB.go(embeddingOrigin + '/page-a-slug.html');
  });
  it("... logs in", () => {
    maria_brB.complex.loginIfNeededViaMetabar(maria);
    */
  });

  // ...

});

