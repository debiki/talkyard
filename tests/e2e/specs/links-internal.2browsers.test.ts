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
import { logBoring } from '../utils/log-and-die';


let everyonesBrowsers: TyAllE2eTestBrowsers;
let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let memah: Member;
let memahsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let site: IdAddress;

let forum: TwoPagesTestForum;

const apiSecret: TestApiSecret = {
  nr: 1,
  userId: c.SysbotUserId,
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSecretKeyAbc123',
};



describe("internal links, backlinks   TyTINTLNS54824", () => {   // RENAME this file to  backlinks-basic.2browsers.test.ts

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
      members: ['maria', 'memah', 'michael'],
    });

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
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    memah = forum.members.memah;
    memahsBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });

  it("Memah logs in", () => {
    memahsBrowser.go2(site.origin);
    memahsBrowser.complex.loginWithPasswordViaTopbar(memah);
  });



  // ------ Simple backlinks

  const michelsTopicUrl = () => `${site.origin}/${forum.topics.byMichaelCategoryA.slug}`;
  const mariasTopicUrl = () => `${site.origin}/${forum.topics.byMariaCategoryA.slug}`;

  // We'll edit and then delete topic A.
  let topicAUrl: string;
  let topicAId: string;
  const topicA_title = 'topicA_title';
  const topicA_body_link2MiTpc_link2MaTpc = () =>
      `topicA_body_link2MiTpc_link2MaTpc ${michelsTopicUrl()} ${mariasTopicUrl()}`;
  const topicA_body_link2MiTpc = () =>
      `topicA_body_link2MiTpc ${michelsTopicUrl()}`;
  const topicA_body_noLinks = `topicA_body_noLinks`;

  const topicAReply_link2MaTpc = () => `topicAReply_link2MaTpc ${mariasTopicUrl()}`;

  // Topic B will disappear when we delete its whole category.
  let topicBUrl: string;
  let topicBId: string;
  const topicB_title = 'topicB_title';
  const topicB_body_link2MiTpc = () => `topicB_body_link2MiTpc ${michelsTopicUrl()}`;
  const topicB_body_noLink = `topicB_body_noLink`;


  it("Memah posts a topic A that links to Michael's and Maria's pages", () => {
    memahsBrowser.complex.createAndSaveTopic({
          title: topicA_title,
          body: topicA_body_link2MiTpc_link2MaTpc(),
          bodyMatchAfter: 'topicA_body_link2MiTpc_link2MaTpc' });
    topicAUrl = memahsBrowser.getUrl();
    topicAId = '2';  // how know?
  });

  it("Owen goes to Memah's new topic", () => {
    owensBrowser.go2(topicAUrl);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("No backlinks to this page", () => {
    assert.eq(owensBrowser.topic.backlinks.countBacklinks(), 0); // ttt
  });

  it("Owen follows the link to Michael's page", () => {
    owensBrowser.waitAndClickFirst('#post-1 a');
    owensBrowser.topic.waitUntilPostTextMatches(c.BodyNr, forum.topics.byMichaelCategoryA.body);
    assert.eq(owensBrowser.getUrl(), michelsTopicUrl());
  });

  it("There's a backlink", () => {
    owensBrowser.topic.backlinks.refreshUntilNum(1);
  });

  it("... from Memah's page", () => {
    assert.ok(owensBrowser.topic.backlinks.isLinkedFromPageId(topicAId));
  });

  it("... with Memah's page's title", () => {
    assert.eq(owensBrowser.topic.backlinks.getLinkTitle(topicAId), topicA_title);
  });

  it("Owen clicks the backlink", () => {
    assert.eq(owensBrowser.topic.backlinks.clickBacklinkFrom(topicAId));  // ttt — there's a real link?
  });

  it("... gets to Memah's page again", () => {
    owensBrowser.topic.waitUntilPostTextMatches(c.BodyNr, 'topicA_body_link2MiTpc_link2MaTpc');
  });

  it("Owen now follows the link to Maria's page", () => {
    owensBrowser.waitAndClickNth('#post-1 a', 2);
    owensBrowser.topic.waitUntilPostTextMatches(c.BodyNr, forum.topics.byMariaCategoryA.body);
    assert.eq(owensBrowser.getUrl(), mariasTopicUrl());
  });

  it("There's a backlink here too", () => {
    assert.eq(owensBrowser.topic.backlinks.countBacklinks(), 1);
  });

  it("... from Memah's page", () => {
    assert.ok(owensBrowser.topic.backlinks.isLinkedFromPageId(topicAId));
  });

  it("... with Memah's page's title", () => {
    assert.eq(owensBrowser.topic.backlinks.getLinkTitle(topicAId), topicA_title);
  });



  // ------ Deleting a backlink, by editing it out


  it("Memah deletes the link to Maria's topic", () => {
    // But keeps the link to Michael's topic.
    memahsBrowser.complex.editPageBody(topicA_body_link2MiTpc());
  });

  it("Owen refreshes Maria's page until the backlink is gone", () => {
    owensBrowser.topic.backlinks.refreshUntilNum(0);
  });

  it("Owen goes to Michael's page", () => {
    owensBrowser.go2(michelsTopicUrl());
    owensBrowser.topic.waitUntilPostTextMatches(c.BodyNr, forum.topics.byMichaelCategoryA.body);
  });

  it("... still a backlink here", () => {
    assert.eq(owensBrowser.topic.backlinks.countBacklinks(), 1);
  });

  it("... from Memah's page", () => {
    assert.ok(owensBrowser.topic.backlinks.isLinkedFromPageId(topicAId));
  });



  // ------ Deleting backlinks, by deleting the whole page


  it("Memah links to Maria's page again, via a reply", () => {
    memahsBrowser.complex.replyToOrigPost(topicAReply_link2MaTpc());
  });

  it("Owen goes there", () => {
    owensBrowser.go2(mariasTopicUrl());
    owensBrowser.topic.waitUntilPostTextMatches(c.BodyNr, forum.topics.byMariaCategoryA.body);
  });

  it("... there's a backlink here, again", () => {
    owensBrowser.topic.backlinks.refreshUntilNum(1);
  });

  it("... from Memah's page", () => {
    assert.ok(owensBrowser.topic.backlinks.isLinkedFromPageId(topicAId));
  });

  it("Owen deletes Memah's whole page!", () => {
    owensBrowser.go2(topicAUrl);
    owensBrowser.topbar.pageTools.deletePage();
  });

  it("... returns to Maria's page", () => {
    owensBrowser.go2(mariasTopicUrl());
    owensBrowser.topic.waitUntilPostTextMatches(c.BodyNr, forum.topics.byMariaCategoryA.body);
  });

  it("Backlink gone", () => {
    owensBrowser.topic.backlinks.refreshUntilNum(0);
  });

  it("Owen goes to Michael's page", () => {
    owensBrowser.go2(michelsTopicUrl());
    owensBrowser.topic.waitUntilPostTextMatches(c.BodyNr, forum.topics.byMichaelCategoryA.body);
  });

  it("... backlink gone here too", () => {
    assert.eq(owensBrowser.topic.backlinks.countBacklinks(), 0);
  });



  // ------ Deleting backlinks, by deleting category


  it("Memah goes to the Specifc Category", () => {
    memahsBrowser.forumTopicList.goHere({
          categorySlug: forum.categories.specificCategory.slug });
  });

  it("... posts a topic B that links to Michael's page", () => {
    memahsBrowser.complex.createAndSaveTopic({
          title: topicB_title, body: topicB_body_link2MiTpc() });
    topicBUrl = memahsBrowser.getUrl();
    topicBId = '3';  // how know?
  });

  it("Owen refreshes Micheal's page", () => {
    assert.eq(owensBrowser.getUrl(), michelsTopicUrl());
    owensBrowser.refresh2();
  });

  it("... there's a backlink", () => {
    owensBrowser.topic.backlinks.refreshUntilNum(1);
  });

  it("... from Memah's new topic", () => {
    assert.ok(owensBrowser.topic.backlinks.isLinkedFromPageId(topicBId));
  });

  it("Owen follows the backlink", () => {
    owensBrowser.topic.backlinks.clickBacklinkFrom(topicBId);
    logBoring("... gets to Memah's 2nd page")
    owensBrowser.topic.waitUntilPostTextMatches(c.BodyNr, 'topicB_body_link2MiTpc');
  });

  it("... goes to the category", () => {
    owensBrowser.topbar.clickAncestor(forum.categories.specificCategory.name);
  });

  it("Owen deletes the whole category!  TyTDELCATBLNS", () => {
    owensBrowser.forumButtons.clickEditCategory();
    owensBrowser.categoryDialog.deleteCategory();
  });

  it("Memah now cannot see her topic — gone, category deleted  TyTDELCATTPC054", () => {
    memahsBrowser.refresh2();
    memahsBrowser.assertNotFoundError({ whyNot: 'CategroyDeleted' });
  });

  it("Memah and Owen go to the linked topic, i.e. Michael's page", () => {
    memahsBrowser.go2(michelsTopicUrl());
    owensBrowser.go2(michelsTopicUrl());
  });

  it("... the backlink is gone: Memah cannot see it", () => {
    memahsBrowser.topic.backlinks.refreshUntilNum(0);
  });

  it("... neither can Owen", () => {
    assert.eq(owensBrowser.topic.backlinks.countBacklinks(), 0);
  });


  // ------ Deleting backlinks, by deleting a reply  TESTS_MISSING
  // ------ Restoring, by un-deleting the reply      TESTS_MISSING


  // ------ Deleting backlinks, by flagging and hiding a reply   TESTS_MISSING
  // ------ Restoring backlinks, by disagreeing with the flags    TESTS_MISSING


  // ------ Backlinks won't appear, until reply approved   TESTS_MISSING


  // ------ Backlinks won't appear, until linking topic approved   TESTS_MISSING


  // ------ Deleting backlinks, by moving to a deleted category      TESTS_MISSING   TyTBACKLNSCAT
  // ------ Restoring backlinks, by moving to a Not deleted category TESTS_MISSING   TyTBACKLNSCAT

  // ------ "Deleting" backlinks, by moving to a staff-only category  TESTS_MISSING  TyTBACKLNSCAT
  // ------ "Restoring" backlinks, by moving to a public category     TESTS_MISSING  TyTBACKLNSCAT



  // ------ Staff-only backlinks: Creating, viewing

  // Hmm this could be a separate e2e test.
  const owensTopicId = '4'; // how know?
  const owensTopicTitle = 'owensTopicTitle';
  const owensTopic_link2MiTpc = () => `owensTopic_link2MiTpc ${michelsTopicUrl()}`;
  const owensReply_link2MaTpc = () => `owensReply_link2MaTpc ${mariasTopicUrl()}`;

  it("Owen wants his own backlinks!  He goes to the staff cateory", () => {
    owensBrowser.forumTopicList.goHere({
          categorySlug: forum.categories.staffOnlyCategory.slug });
  });

  it("... posts a staff-only topic with a link to Michael's page", () => {
    owensBrowser.complex.createAndSaveTopic({
          title: owensTopicTitle, body: owensTopic_link2MiTpc() })
  });

  it("... and a reply linking to Maria's page", () => {
    owensBrowser.complex.replyToOrigPost(owensReply_link2MaTpc());
  });

  it("Owen follows his link to Michael's page", () => {
    owensBrowser.waitAndClick(`#post-${c.BodyNr} a`);
    logBoring(`The url is correct`);
    assert.eq(owensBrowser.getUrl(), michelsTopicUrl());
  });

  it("Owen sees a backlink", () => {
    owensBrowser.topic.backlinks.refreshUntilNum(1);
  });

  it("... from his satff-only topic", () => {
    owensBrowser.topic.backlinks.isLinkedFromPageId(owensTopicId);
  });

  it("... but Memah doesn't; she's an ordinary member, not staff", () => {
    assert.eq(memahsBrowser.getUrl(), michelsTopicUrl());
    memahsBrowser.refresh2();
    memahsBrowser.waitForMyDataAdded();
    assert.eq(memahsBrowser.topic.backlinks.countBacklinks(), 0);
  });

  it("Owen sees a backlink also on Maria's page", () => {
    owensBrowser.go2(mariasTopicUrl());
    owensBrowser.waitForMyDataAdded();
    assert.eq(owensBrowser.topic.backlinks.countBacklinks(), 1);
  });

  it("... but Memah doesn't", () => {
    memahsBrowser.go2(mariasTopicUrl());
    memahsBrowser.waitForMyDataAdded();
    assert.eq(memahsBrowser.topic.backlinks.countBacklinks(), 0);
  });


  // ------ Staff-only backlinks: Deleting

  /*

  it("Owen starts thinking that backlinks are Bad", () => {
    // Noop
  });

  it("... since the words 'Backlinks' and 'Bad' both start with 'Ba'", () => {
    // Noop
  });

  it("Owen clicks the reply backlink", () => {
  });

  it("... gets back to the staff-only page with links", () => {
  });

  it("Owen deletes the reply with the backlink", () => {
  });

  it("... goes to Maria's topic again", () => {
    owensBrowser.go2(mariasTopicUrl());
  });

  it("... the backlink is gone", () => {
    assert.eq(owensBrowser.topic.backlinks.countBacklinks(), 0);
  });

  it("On Memah's topic though", () => {
    owensBrowser.go2(topicAUrl);
  });

  it("... there's still a backlink", () => {
    assert.eq(owensBrowser.topic.backlinks.countBacklinks(), 1);
  });

  it("Owen returns to his page", () => {
    owensBrowser.back();
    owensBrowser.back();
  });

  it("Owen deletes the whole page", () => {
  });

  it("... goes to Memah's topi", () => {
    owensBrowser.go2(topicAUrl);
  });

  it("... the backlink is gone", () => {
    assert.eq(owensBrowser.topic.backlinks.countBacklinks(), 0);
  });
  */

});

