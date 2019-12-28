/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

let everyonesBrowsers;
let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser;
let mons: Member;
let monsBrowser;
let modya: Member;
let modyasBrowser;
let corax: Member;
let coraxBrowser;
let regina: Member;
let reginasBrowser;
let maria: Member;
let mariasBrowser;
let michael: Member;
let michaelsBrowser;
let mallory: Member;
let mallorysBrowser;
let strangersBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: LargeTestForum;

let discussionPageUrl: string;


describe("imp-exp-imp-exp-site [TyT5BKW2ZY]", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addLargeForum({
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });
    builder.addPost({
      page: forum.topics.byMichaelCategoryA,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.mallory.id,
      approvedSource: "approvedSource",
    });
    const newPage = builder.addPage({
      id: 'extraPageId',
      folder: '/',
      showId: false,
      slug: 'extra-page',
      role: c.TestPageRole.Discussion,
      title: "Page title",
      body: "Page body text",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.mallory.id,
    });
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    discussionPageUrl = siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    richBrowserA = everyonesBrowsers;//_.assign(browserA, pagesFor(browserA));
    richBrowserB = everyonesBrowsers;//_.assign(browserB, pagesFor(browserB));

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

  it("Owen logs in to admin area", () => {
    owensBrowser.adminArea.goToUsersEnabled(siteIdAddress.origin); owensBrowser.loginDialog.loginWithPassword(owen);
  });

  it("Exports the site as json", () => {
    owensBrowser.go('/-/export-site-json');
  });

  let jsonDump: any;

  it("Can parse the exported json into a js obj", () => {
    const [jsonStr, jsonDump] = owensBrowser.getWholePageJsonStrAndObj();
    console.log("JSON: " + JSON.stringify(jsonDump, null, 2));
  });

  let response: IdAddress;

  it("Re-imports the site", () => {
    response = server.importRealSiteData(jsonDump);
    console.log("Import site response: " + JSON.stringify(response));
  });

  it("Goes to the re-imported site", () => {
    owensBrowser.go(response.origin || response.siteIdOrigin);
  });

});

