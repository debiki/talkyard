/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import * as fs from 'fs';
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

let siteIdAddr: IdAddress;
let siteId: SiteId;

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


const sharedTitle = 'CORS_search_test_page';
const publicPageTitle = sharedTitle + ' publicly_visible';
const staffOnlyPageTitle = sharedTitle + ' staff_only';

const extSitePageSlug = 'ext-cors-site.html';

describe("some-e2e-test  TyT1234ABC", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({  // or: builder.addLargeForum
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });

    const newPage: PageJustAdded = builder.addPage({
      id: 'publPageId',
      folder: '/',
      showId: false,
      slug: 'public-page',
      role: c.TestPageRole.Discussion,
      title: publicPageTitle,
      body: "Test test.",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.michael.id,
    });

    builder.addPage({
      id: 'staffPageId',
      folder: '/',
      showId: false,
      slug: 'staff-page',
      role: c.TestPageRole.Discussion,
      title: staffOnlyPageTitle,
      body: "Test test.",
      categoryId: forum.categories.staffOnlyCategory.id,
      authorId: forum.members.owen.id,
    });

    assert.refEq(builder.getSite(), forum.siteData);
    siteIdAddr = server.importSiteData(forum.siteData);
    siteId = siteIdAddr.id;
    server.skipRateLimits(siteId);
    discussionPageUrl = siteIdAddr.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("create an external 'website'", () => {
    fs.copyFileSync(__dirname + '/../utils/ext-cors-site.html',
          './target/' + extSitePageSlug);
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    maria = forum.members.maria;
    mariasBrowser = richBrowserB;

    strangersBrowser = richBrowserB;
  });

  it("Owen logs in to the Admin Area, Settings | Features", () => {
    owensBrowser.adminArea.settings.features.goHere(siteIdAddr.origin, { loginAs: owen });
  });

  it("Maria goes to the external website", () => {
    mariasBrowser.go2('http://localhost:8080/ext-cors-site.html');
  });

  it("Maria attempts to load data via CORS", () => {
  });

  it("... doesn't work", () => {
  });

  it("Owen enables CORS but from another site", () => {
    owensBrowser.adminArea.settings.features.goHere(siteIdAddr.origin, { loginAs: owen });
  });

  it("Maria again attempts to load data via CORS", () => {
  });

  it("... still doesn't work", () => {
  });

  it("Owen enables CORS from the right site (where Maria is)", () => {
  });

  it("Maria a 3rd time attempts to load data via CORS", () => {
  });

  it("... it works: she finds the pblic page", () => {
  });

  it("... but not the access restricted page", () => {
  });

  // ...

});

