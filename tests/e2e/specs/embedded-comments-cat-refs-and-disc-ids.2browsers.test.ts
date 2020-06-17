/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId: SiteId;

let forum: TwoPagesTestForum;
const localHostname = 'comments-for-e2e-test-catdiid-localhost-8080';
const embeddingOrigin = 'http://e2e-test-catdiid.localhost:8080';


let catB: CategoryJustAdded;
const catBId = 5;
const catBExtId = 'cat_b_ext_id-with-dashes';

let catC: CategoryJustAdded;
const catCId = 6;
const catCExtId = 'cat_c_ext_id';

const pagePppDiscId = 'ppp_disc_id';
const pagePppSlugCatB = 'ppp-cat-b.html';
const pagePppSlugCatC = 'ppp-cat-c.html';


describe("emb-disc-cats  TyT603WDL46", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Cust Emb Cat Id E2E Test",
      members: ['maria', 'memah', 'michael'],
    });

    forum.siteData.meta.localHostname = localHostname;
    forum.siteData.settings.allowEmbeddingFrom = embeddingOrigin;

    catB = builder.addCategoryWithAboutPage(forum.forumPage, {
      id: catBId,
      extId: catBExtId,
      parentCategoryId: forum.categories.rootCategory.id,
      name: "Category B",
      slug: 'cat-b-slug',
      aboutPageText: "About Cat B",
    });
    builder.addDefaultCatPerms(forum.siteData, catBId, catBId * 100);

    catC = builder.addCategoryWithAboutPage(forum.forumPage, {
      id: catCId,
      extId: catCExtId,
      parentCategoryId: forum.categories.rootCategory.id,
      name: "Category C",
      slug: 'cat-c-slug',
      aboutPageText: "About Cat C",
    });
    builder.addDefaultCatPerms(forum.siteData, catCId, catCId * 100);

    assert.refEq(builder.getSite(), forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
  });


  it("Create embedding pages", () => {
    const dir = 'target';

    // Both discussion id and category — but the category changes from B to C!
    fs.writeFileSync(`${dir}/${pagePppSlugCatB}`,
            makeHtml('b2-cat-b', `extid:${catBExtId}`, '#840', pagePppDiscId));
    fs.writeFileSync(`${dir}/${pagePppSlugCatC}`,
            makeHtml('b2-cat-c', `extid:${catCExtId}`, '#048', pagePppDiscId));

    function makeHtml(pageName: string, categoryRef: string, bgColor: string, discussionId: string = ''): string {
      return utils.makeEmbeddedCommentsHtml({
              pageName, discussionId, categoryRef, localHostname, bgColor});
    }
  });

  it("initialize people", () => {
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
  });


  it("Owen logs in to the categories page, ... ", () => {
    owensBrowser.go2(siteIdAddress.origin + '/categories');
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });


  // ----- Lazy-reply create page in one category

  it(`Maria opens embedding page Ppp in cat B:  ${pagePppSlugCatB}`, () => {
    mariasBrowser.go2(embeddingOrigin + '/' + pagePppSlugCatB);
  });

  it("... clicks Reply and logs in", () => {
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
    mariasBrowser.loginDialog.loginWithPasswordInPopup(maria);
  });

  it("... writes and submits a comment", () => {
    mariasBrowser.editor.editText(`By Maria, page path: ${pagePppSlugCatB}`);
    mariasBrowser.editor.save();
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, pagePppSlugCatB);
  });


  // ----- Visit the same page, but via a different category

  it(`Maria goes to:  ${pagePppSlugCatC} — the same page, but category=C`, () => {
    mariasBrowser.go2(embeddingOrigin + '/' + pagePppSlugCatC);
  });

  it("She sees her old reply", () => {
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, pagePppSlugCatB);
  });

  it("... posts a 2nd reply", () => {
    mariasBrowser.complex.replyToEmbeddingBlogPost(`By Maria, path: ${pagePppSlugCatC}`);
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr + 1, pagePppSlugCatC);
  });


  // ----- Back to the first URL path

  it(`Maria goes back to:  ${pagePppSlugCatB}`, () => {
    mariasBrowser.go2(embeddingOrigin + '/' + pagePppSlugCatB);
  });

  it("... and sees both replies", () => {
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr + 0, pagePppSlugCatB);
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr + 1, pagePppSlugCatC);
  });


  // Todo: Have a look the pages are now in the correct categories  !

});

