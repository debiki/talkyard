/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
// import fs = require('fs');  EMBCMTS
import server = require('../utils/server');
import utils = require('../utils/utils');
import settings = require('../utils/settings');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;

let margaret: Member;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;

const specificCatExtId = 'specificCatExtId';
const staffCatExtId = 'staffCatExtId';

const pageAaaTitle = 'pageAaaTitle';
const pageAaaBody = 'pageAaaBody';
let pageAaaJustAdded: PageJustAdded | U;

const margaretsPageTitle = "What happened";
const margaretsPageBody =
    `Software eventually and necessarily gained the same respect as any other discipline`;
let margaretsPageJustAdded: PageJustAdded | U;

let staffOnlyPageTitle = 'staffOnlyPageTitle';
let staffOnlyPageBody = 'staffOnlyPageBody';
let staffOnlyPageJustAdded: PageJustAdded | U;

const pageZzzTitle = 'pageZzzTitle';
const pageZzzBody = 'pageZzzBody';
let pageZzzJustAdded: PageJustAdded | U;


describe("api-list-query-for-topics.test.ts  TyT603AKSL25", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
      members: ['michael', 'maria', 'owen'],
    });

    margaret = builder.addMember('margaret');
    pageAaaJustAdded = builder.addPage({
      id: 'pageAaaId',
      createdAtMs: c.JanOne2020HalfPastFive + 10*1000,
      folder: '/',
      showId: false,
      slug: 'page-aaa',
      role: c.TestPageRole.Discussion,
      title: pageAaaTitle,
      body: pageAaaBody,
      categoryId: forum.categories.specificCategory.id,
      authorId: forum.members.maria.id,
    });

    margaretsPageJustAdded = builder.addPage({
      id: 'margaretsPageId',
      createdAtMs: c.JanOne2020HalfPastFive + 20*1000,
      folder: '/',
      showId: false,
      slug: 'page-mmm',
      role: c.TestPageRole.Discussion,
      title: margaretsPageTitle,
      body: margaretsPageBody,
      categoryId: forum.categories.specificCategory.id,
      authorId: margaret.id,
    });

    // We add page Zzz last; this makes it the most recently active page.
    pageZzzJustAdded = builder.addPage({
      id: 'pageZzzId',
      createdAtMs: c.JanOne2020HalfPastFive + 30*1000,
      folder: '/',
      showId: false,
      slug: 'page-zzz',
      role: c.TestPageRole.Discussion,
      title: pageZzzTitle,
      body: pageZzzBody,
      categoryId: forum.categories.specificCategory.id,
      authorId: forum.members.michael.id,
    });

    staffOnlyPageJustAdded = builder.addPage({
      id: 'staffPageId',
      createdAtMs: c.JanOne2020HalfPastFive + 40*1000,
      folder: '/',
      showId: false,
      slug: 'staff-page',
      role: c.TestPageRole.Discussion,
      title: staffOnlyPageTitle,
      body: staffOnlyPageBody,
      categoryId: forum.categories.staffOnlyCategory.id,
      authorId: forum.members.owen.id,
    });

    forum.categories.specificCategory.extId = specificCatExtId;
    forum.categories.staffOnlyCategory.extId = staffCatExtId;

    assert.refEq(builder.getSite(), forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
  });

  it("initialize people", () => {
    const richBrowserA = new TyE2eTestBrowser(oneWdioBrowser);
    owen = forum.members.owen;
    maria = forum.members.maria;
    mariasBrowser = richBrowserA;
    owensBrowser = richBrowserA;
  });


  it("Maria goes to the forum, logs in", () => {
    mariasBrowser.go2(siteIdAddress.origin);
    // Log in, so can Like vote, later below.
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });


  // ----- List Query: Active topics first

  // Since no Like votes, the most recently active topics should be listed first.

  let response: ListQueryResults<PageListed>;

  it("Maria lists pages in the Specific category", () => {
    response = server.apiV0.listQuery<PageListed>({
      origin: siteIdAddress.origin,
      listQuery: {
        listWhat: 'Pages',
        lookWhere: { inCategories: [`extid:${specificCatExtId}`] },
      },
    }) as ListQueryResults<PageListed>;
  });

  it("She finds three pages", () => {
    assert.eq(response.thingsFound.length, 3);
  });


  let pageOneFound: PageListed;
  let pageTwoFound: PageListed;
  let pageThreeFound: PageListed;

  it("The first page is the most recently added page: Zzz  [TyT025WKRGJ]", () => {
    pageOneFound = response.thingsFound[0];
    assert.eq(pageOneFound.title, pageZzzTitle);
  });

  it("The second is Margaret's page", () => {
    pageTwoFound = response.thingsFound[1];
    assert.eq(pageTwoFound.title, margaretsPageTitle);
  });

  it("The third page, is the page added first: Aaa", () => {
    pageThreeFound = response.thingsFound[2];
    assert.eq(pageThreeFound.title, pageAaaTitle);
  });

  it("All of them are in the Specific category", () => {
    const specCatName = forum.categories.specificCategory.name;
    assert.eq(pageOneFound.categoriesMainFirst?.[0]?.name,   specCatName);
    assert.eq(pageTwoFound.categoriesMainFirst?.[0]?.name,   specCatName);
    assert.eq(pageThreeFound.categoriesMainFirst?.[0]?.name, specCatName);
  });

  it("The author names are correct", () => {
    assert.eq(pageOneFound.author?.username,   forum.members.michael.username);
    assert.eq(pageTwoFound.author?.username,   margaret.username);
    assert.eq(pageThreeFound.author?.username, maria.username);
  });

  it("Maria opens Margaret's page", () => {
    mariasBrowser.go2(pageTwoFound.urlPath);
  });

  it("The title, body and reply are all there", () => {
    mariasBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, margaretsPageTitle);
    mariasBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, margaretsPageBody);
  });


  // ----- Popular First


  it("Maria clicks Like", () => {
    mariasBrowser.topic.clickLikeVote(c.BodyNr);
  });

  it("... goes to the last page found", () => {
    mariasBrowser.go2(pageThreeFound.urlPath);
  });

  it("... posts a comment — so the page gets bumped (new activity on the page)", () => {
    mariasBrowser.complex.replyToOrigPost(`Hello hi there`);
  });

  it("Maria again lists pages in the Specific category", () => {
    response = server.apiV0.listQuery<PageListed>({
      origin: siteIdAddress.origin,
      listQuery: {
        listWhat: 'Pages',
        lookWhere: { inCategories: [`extid:${specificCatExtId}`] },
      },
    }) as ListQueryResults<PageListed>;
  });

  it("She again finds three pages", () => {
    assert.eq(response.thingsFound.length, 3);
  });

  it("But now Margaret's page is first — it got a Like vote", () => {
    pageOneFound = response.thingsFound[0];
    assert.eq(pageOneFound.title, margaretsPageTitle);
  });

  it("The activity bumped page, Aaa, comes thereafter", () => {
    pageTwoFound = response.thingsFound[1];
    assert.eq(pageTwoFound.title, pageAaaTitle);
  });

  it("The previously topmost page — now it's last", () => {
    pageThreeFound = response.thingsFound[2];
    assert.eq(pageThreeFound.title, pageZzzTitle);
  });


  // ----- Private topics stay private   TyT502RKDJ46


  function listStaffPages() {
    return server.apiV0.listQuery<PageListed>({
      origin: siteIdAddress.origin,
      listQuery: {
        listWhat: 'Pages',
        lookWhere: { inCategories: [`extid:${staffCatExtId}`] },
      },
    }) as ListQueryResults<PageListed>;
  }

  it("Maria tries to list pages in the Staff category", () => {
    response = listStaffPages();
  });

  it("... but she cannot see those pages", () => {
    if (response.thingsFound.length >= 1) {
      assert.fail(`Found staff pages, response:\n${JSON.stringify(response)}`);
    }
  });

  it("Owen logs in", () => {
    mariasBrowser.topbar.clickLogout();
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  // A bit dupl test code, fine. [60KADJF602]
  it("... goes to the Staff category", () => {
    owensBrowser.topbar.clickHome();
    owensBrowser.forumTopicList.switchToCategory(forum.categories.staffOnlyCategory.name);
  });
  it("... eits security settings", () => {
    owensBrowser.forumButtons.clickEditCategory();
    owensBrowser.categoryDialog.openSecurityTab();
  });
  it("... makes it public: adds the Everyone group  TyT69WKTEJG4", () => {
    owensBrowser.categoryDialog.securityTab.addGroup(c.EveryoneFullName);
  });
  it("... saves", () => {
    owensBrowser.categoryDialog.submit();
  });
  // ---

  it("Maria tries to list the Staff pages again", () => {
    response = listStaffPages();
  });

  it("... now she sees one page", () => {
    assert.eq(response.thingsFound.length, 1);
  });

  it("... it's the staff only page", () => {
    assert.eq(response.thingsFound[0].title, staffOnlyPageTitle);
  });

  it("... in the Staff category", () => {
    assert.eq(response.thingsFound[0].categoriesMainFirst?.[0]?.name,
        forum.categories.staffOnlyCategory.name);
  });


});

