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
const localHostname = 'comments-for-e2e-test-custcat';
const embeddingOrigin = 'http://e2e-test-custcat.localhost:8080';


let catB: CategoryJustAdded;
const catBId = 5;
const catBExtId = 'cat_b_ext_id-with-dashes';

let catC: CategoryJustAdded;
const catCId = 6;
const catCExtId = 'cat_c_ext_id';

let catD: CategoryJustAdded;
const catDId = 7;
const catDExtId = 'cat_d_ext_id';

// Cat wit notfs.
let catN: CategoryJustAdded;
const catNId = 8;
const catNExtId = 'cat NN ext id w spaces';

const staffCatExtId = 'staff cat ext id';;


const pageNoCatSlug = 'cats-nocat.html';
const pageBbbSlug = 'cats-bbb.html';
const pageCccSlug = 'cats-ccc.html';
const pageDddSlug = 'cats-ddd.html';
const pageNnnSlug = 'cats-nnn.html';
const pageSssSlug = 'cats-sss.html';

const mariasReplyToNnn = 'mariasReplyToNnn';
const mariasReplyToNoCatPage_mentionsOwen = 'mariasReplyToNoCatPage Hi @owen_owner';


describe("emb-disc-cats  TyT03RKHJF59", () => {

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

    catD = builder.addCategoryWithAboutPage(forum.forumPage, {
      id: catDId,
      extId: catDExtId,
      parentCategoryId: forum.categories.rootCategory.id,
      name: "Category D ",
      slug: 'cat-d-slug',
      aboutPageText: "About Cat D",
    });
    builder.addDefaultCatPerms(forum.siteData, catDId, catDId * 100);

    catN = builder.addCategoryWithAboutPage(forum.forumPage, {
      id: catNId,
      extId: catNExtId,
      parentCategoryId: forum.categories.rootCategory.id,
      name: "Category N",
      slug: 'cat-n-slug',
      aboutPageText: "About Cat N",
    });
    builder.addDefaultCatPerms(forum.siteData, catNId, catNId * 100);

    // If a non-staff member posts a comment on a data-category= staf cat,
    // then that shouldn't be allowed.
    // (Likely that'd be a config error by the forum admins — but shouldn't
    // be a security hole.)  e2emap
    forum.categories.staffOnlyCategory.extId = staffCatExtId;

    // Disable notifications, or notf email counts will be off (since Owen would get emails).
    builder.settings({ numFirstPostsToReview: 0, numFirstPostsToApprove: 0 });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    // But enable notifications, for cat N, for Memah.
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.memah.id,
      notfLevel: c.TestPageNotfLevel.NewTopics,
      pagesInCategoryId: catNId,
    }];

    assert.refEq(builder.getSite(), forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
  });


  it("Create embedding pages", () => {
    const dir = 'target';
    // No custom category — cat A is the default.
    fs.writeFileSync(`${dir}/${pageNoCatSlug}`, makeHtml('nocat', '', '#500'));
    // Custom category id.
    fs.writeFileSync(`${dir}/${pageBbbSlug}`, makeHtml('bbb', `extid:${catBExtId}`, '#040'));
    fs.writeFileSync(`${dir}/${pageCccSlug}`, makeHtml('ccc', `extid:${catCExtId}`, '#005'));
    fs.writeFileSync(`${dir}/${pageDddSlug}`, makeHtml('ddd', `extid:${catDExtId}`, '#005'));
    // Custom category, and Memah gets notified.
    fs.writeFileSync(`${dir}/${pageNnnSlug}`, makeHtml('nnn', `extid:${catNExtId}`, '#405'));
    // Staff, restricted.
    fs.writeFileSync(`${dir}/${pageSssSlug}`, makeHtml('sss', `extid:${staffCatExtId}`, '#022'));

    function makeHtml(pageName: string, categoryRef: string, bgColor: string): string {
      return utils.makeEmbeddedCommentsHtml({
              pageName, discussionId: '', categoryRef, localHostname, bgColor});
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


  // ----- Lazy-reply create page in custom category

  it("Maria opens embedding page B", () => {
    mariasBrowser.go2(embeddingOrigin + '/' + pageBbbSlug);
  });

  it("... clicks Reply and logs in", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
    mariasBrowser.loginDialog.loginWithPasswordInPopup(maria);
  });

  it("... writes and submits a comment", () => {
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText('B comment');
    mariasBrowser.editor.save();
  });


  // ----- Lazy-vote create page in custom category

  it("Maria opens embedding page C", () => {
    mariasBrowser.go2(embeddingOrigin + '/' + pageCccSlug);
  });

  it("... Like votes page C", () => {
    mariasBrowser.topic.toggleLikeVote(c.BodyNr);
  });


  // ----- Lazy-notf-prefs create page in custom category

  it("Maria opens embedding page D", () => {
    mariasBrowser.go2(embeddingOrigin + '/' + pageDddSlug);
  });

  it("... Like votes page D", () => {
    mariasBrowser.topic.toggleLikeVote(c.BodyNr);
  });


  // ----- New topic notifications work with category=...  TyT063AKDGW60

  it("Maria opens embedding page N", () => {
    mariasBrowser.go2(embeddingOrigin + '/' + pageNnnSlug);
  });

  it("... Replies to N", () => {
    mariasBrowser.complex.replyToEmbeddingBlogPost(mariasReplyToNnn);
  });

  it("Memah gets a notf email — she's subscribed to Cateory N", () => {
    server.waitUntilLastEmailMatches(
          siteId, forum.members.memah.emailAddress, mariasReplyToNnn, oneWdioBrowser);
  });

  it("... no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.eq(num, 1, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- Default category still works

  it("Maria opens embedding page No-Cat", () => {
    mariasBrowser.go2(embeddingOrigin + '/' + pageNoCatSlug);
  });

  it("... Replies to No-Cat page", () => {
    mariasBrowser.complex.replyToEmbeddingBlogPost(mariasReplyToNoCatPage_mentionsOwen);
  });

  it("Owen gets a notf email", () => {
    server.waitUntilLastEmailMatches(
            siteId, forum.members.owen.emailAddress,
            mariasReplyToNoCatPage_mentionsOwen, oneWdioBrowser);
  });

  it("... no one else", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.eq(num, 2, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // Todo: Have a look the pages are now in the correct categories  !

});

