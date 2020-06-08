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
let owensBrowser: TyE2eTestBrowser;
let mons: Member;
let monsBrowser: TyE2eTestBrowser;
let modya: Member;
let modyasBrowser: TyE2eTestBrowser;
let corax: Member;
let coraxBrowser: TyE2eTestBrowser;
let regina: Member;
let reginasBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;
let mallory: Member;
let mallorysBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let site: IdAddress;

let forum: TwoPagesTestForum;  // or: LargeTestForum

let discussionPageUrl: string;

const apiSecret: TestApiSecret = {
  nr: 1,
  userId: c.SysbotUserId,
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSecretKeyAbc123',
};



describe("some-e2e-test  TyT1234ABC", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({  // or: builder.addLargeForum
      title: "Some E2E Test",
      members: undefined, // default = everyone
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

    // Disable notifications, or notf email counts will be off (since Owen would get emails).
    builder.settings({ numFirstPostsToReview: 0, numFirstPostsToApprove: 0 });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    // Enable API.
    builder.settings({ enableApi: true });
    builder.getSite().apiSecrets = [apiSecret];

    // Add an ext id to a category.
    // forum.categories.specificCategory.extId = 'specific cat ext id';

    assert.refEq(builder.getSite(), forum.siteData);
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
    discussionPageUrl = site.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    mons = forum.members.mons;
    monsBrowser = richBrowserA;
    modya = forum.members.modya;
    modyasBrowser = richBrowserA;
    corax = forum.members.corax;
    coraxBrowser = richBrowserA;

    regina = forum.members.regina;
    reginasBrowser = richBrowserB;
    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    michael = forum.members.michael;
    michaelsBrowser = richBrowserB;
    mallory = forum.members.mallory;
    mallorysBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });

  it("Owen logs in to admin area, ... ", () => {
    owensBrowser.adminArea.goToUsersEnabled(site.origin);
    owensBrowser.loginDialog.loginWithPassword(owen);
  });

  it("Maria logs in", () => {
    mariasBrowser.go2(site.origin + '/' + forum.topics.byMichaelCategoryA.slug);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  // For embedded comments:  EMBCMTS
  it("Creates an embedding page", () => {
    /*
    const dir = 'target';
    fs.writeFileSync(`${dir}/page-a-slug`, makeHtml('b3c-aaa', '#500'));
    fs.writeFileSync(`${dir}/page-b-slug}`, makeHtml('b3c-bbb', '#040'));
    function makeHtml(pageName: string, bgColor: string): string {
      return utils.makeEmbeddedCommentsHtml({ pageName, discussionId: '', localHostname, bgColor});
    }
    */
  });

  // ...

});

