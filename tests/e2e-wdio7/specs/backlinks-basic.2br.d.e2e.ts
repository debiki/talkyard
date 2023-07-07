/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { logBoring } from '../utils/log-and-die';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let memah: Member;
let memahsBrowser: TyE2eTestBrowser;

let site: IdAddress;

let forum: TwoPagesTestForum;


describe("backlinks-basic.2br.d  TyTINTLNS54824", () => {

  it("import a site", async () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
      members: ['maria', 'memah', 'michael'],
    });

    // Disable notifications, or notf email counts will be off (since Owen would get emails).
    builder.settings({ numFirstPostsToReview: 0, numFirstPostsToApprove: 0 });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    assert.refEq(builder.getSite(), forum.siteData);
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owensBrowser = brA;

    memah = forum.members.memah;
    memahsBrowser = brB;
  });

  it("Memah logs in", async () => {
    await memahsBrowser.go2(site.origin);
    await memahsBrowser.complex.loginWithPasswordViaTopbar(memah);
  });



  // ------ Simple backlinks

  const michelsTopicUrl = () => `${site.origin}/${forum.topics.byMichaelCategoryA.slug}`;
  const michelsTopicTitle = () => forum.topics.byMichaelCategoryA.title;
  const mariasTopicUrl = () => `${site.origin}/${forum.topics.byMariaCategoryA.slug}`;
  const mariasTopicTitle = () => forum.topics.byMariaCategoryA.title;

  // We'll edit and then delete topic A.
  let topicAUrl: string;
  let topicAId: string;

  const topicA_title = 'topicA_title';

  const topicA_body_link2MiTpc_link2MaTpc = () =>
      `topicA_body_link2MiTpc_link2MaTpc ${michelsTopicUrl()} ${mariasTopicUrl()}`;
  const topicA_body_link2MiTpc_link2MaTpc_withPreviews = (): St =>
      `topicA_body_link2MiTpc_link2MaTpc ${michelsTopicTitle()} ${mariasTopicTitle()}`;

  const topicA_body_link2MiTpc = (): St =>
      `topicA_body_link2MiTpc ${michelsTopicUrl()}`;
  const topicA_body_link2MiTpc_withPreviews = (): St =>
      `topicA_body_link2MiTpc ${michelsTopicTitle()}`;

  const topicA_body_noLinks = `topicA_body_noLinks`;

  const topicAReply_link2MaTpc = () =>
        `topicAReply_link2MaTpc ${mariasTopicUrl()}`;
  const topicAReply_link2MaTpc_withPreviews = () =>
        `topicAReply_link2MaTpc ${mariasTopicTitle()}`;


  // Topic B will disappear when we delete its whole category.
  let topicBUrl: string;
  let topicBId: string;
  const topicB_title = 'topicB_title';
  const topicB_body_link2MiTpc = () => `topicB_body_link2MiTpc ${michelsTopicUrl()}`;
  const topicB_body_link2MiTpc_withPreviews = () =>
          `topicB_body_link2MiTpc ${michelsTopicTitle()}`;


  it("Memah posts a topic A that links to Michael's and Maria's pages", async () => {
    await memahsBrowser.complex.createAndSaveTopic({
          title: topicA_title,
          body: topicA_body_link2MiTpc_link2MaTpc(),
          bodyMatchAfter: 'topicA_body_link2MiTpc_link2MaTpc' });
    topicAUrl = await memahsBrowser.getUrl();
    topicAId = '2';  // how know?
  });

  it("... inline link previews appear", async () => {
    await memahsBrowser.topic.waitUntilPostTextIs(c.BodyNr,
          topicA_body_link2MiTpc_link2MaTpc_withPreviews());
  });

  it("Owen goes to Memah's new topic", async () => {
    await owensBrowser.go2(topicAUrl);
    await owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("No backlinks to this page", async () => {
    assert.eq(await owensBrowser.topic.backlinks.countBacklinks(), 0); // ttt
  });

  it("Owen follows the link to Michael's page", async () => {
    await owensBrowser.waitAndClickFirst('#post-1 a');
    await owensBrowser.topic.waitUntilPostTextMatches(
          c.BodyNr, forum.topics.byMichaelCategoryA.body);
    assert.eq(await owensBrowser.getUrl(), michelsTopicUrl());
  });

  it("There's a backlink", async () => {
    await owensBrowser.topic.backlinks.refreshUntilNum(1);
  });

  it("... from Memah's page", async () => {
    assert.ok(await owensBrowser.topic.backlinks.isLinkedFromPageId(topicAId));
  });

  it("... with Memah's page's title", async () => {
    assert.eq(await owensBrowser.topic.backlinks.getLinkTitle(topicAId), topicA_title);
  });

  it("Owen clicks the backlink", async () => {
    assert.eq(await owensBrowser.topic.backlinks.clickBacklinkFrom(topicAId));  // ttt — there's a real link?
  });

  it("... gets to Memah's page again", async () => {
    await owensBrowser.topic.waitUntilPostTextMatches(
            c.BodyNr, 'topicA_body_link2MiTpc_link2MaTpc');
  });

  it("Owen now follows the link to Maria's page", async () => {
    await owensBrowser.waitAndClickNth('#post-1 a', 2);
    await owensBrowser.topic.waitUntilPostTextMatches(
            c.BodyNr, forum.topics.byMariaCategoryA.body);
    assert.eq(await owensBrowser.getUrl(), mariasTopicUrl());
  });

  it("There's a backlink here too", async () => {
    assert.eq(await owensBrowser.topic.backlinks.countBacklinks(), 1);
  });

  it("... from Memah's page", async () => {
    assert.ok(await owensBrowser.topic.backlinks.isLinkedFromPageId(topicAId));
  });

  it("... with Memah's page's title", async () => {
    assert.eq(await owensBrowser.topic.backlinks.getLinkTitle(topicAId), topicA_title);
  });



  // ------ Deleting a backlink, by editing it out


  it("Memah deletes the link to Maria's topic", async () => {
    // But keeps the link to Michael's topic.
    await memahsBrowser.complex.editPageBody(topicA_body_link2MiTpc(),
          { textAfterMatches: 'topicA_body_link2MiTpc' });
  });

  it("... now there's only one inline link preview — to Michael's topic", async () => {
    await memahsBrowser.topic.waitUntilPostTextIs(c.BodyNr,
          topicA_body_link2MiTpc_withPreviews());
  });

  it("Owen refreshes Maria's page until the backlink is gone", async () => {
    await owensBrowser.topic.backlinks.refreshUntilNum(0);
  });

  it("Owen goes to Michael's page", async () => {
    await owensBrowser.go2(michelsTopicUrl());
    await owensBrowser.topic.waitUntilPostTextMatches(
            c.BodyNr, forum.topics.byMichaelCategoryA.body);
  });

  it("... still a backlink here", async () => {
    assert.eq(await owensBrowser.topic.backlinks.countBacklinks(), 1);
  });

  it("... from Memah's page", async () => {
    assert.ok(await owensBrowser.topic.backlinks.isLinkedFromPageId(topicAId));
  });



  // ------ Deleting backlinks, by deleting the whole page


  it("Memah links to Maria's page again, via a reply", async () => {
    await memahsBrowser.complex.replyToOrigPost(topicAReply_link2MaTpc());
  });

  it("... a block link preview appears", async () => {
    const text = await memahsBrowser.topic.getPostText(c.FirstReplyNr);
    assert.includes(text, topicAReply_link2MaTpc_withPreviews());
  });

  it("Owen goes there", async () => {
    await owensBrowser.go2(mariasTopicUrl());
    await owensBrowser.topic.waitUntilPostTextMatches(c.BodyNr, forum.topics.byMariaCategoryA.body);
  });

  it("... there's a backlink here, again", async () => {
    await owensBrowser.topic.backlinks.refreshUntilNum(1);
  });

  it("... from Memah's page", async () => {
    assert.ok(await owensBrowser.topic.backlinks.isLinkedFromPageId(topicAId));
  });

  it("Owen deletes Memah's whole page!", async () => {
    await owensBrowser.go2(topicAUrl);
    await owensBrowser.topbar.pageTools.deletePage();
  });

  it("... returns to Maria's page", async () => {
    await owensBrowser.go2(mariasTopicUrl());
    await owensBrowser.topic.waitUntilPostTextMatches(
            c.BodyNr, forum.topics.byMariaCategoryA.body);
  });

  it("Backlink gone", async () => {
    await owensBrowser.topic.backlinks.refreshUntilNum(0);
  });

  it("Owen goes to Michael's page", async () => {
    await owensBrowser.go2(michelsTopicUrl());
    await owensBrowser.topic.waitUntilPostTextMatches(
            c.BodyNr, forum.topics.byMichaelCategoryA.body);
  });

  it("... backlink gone here too", async () => {
    assert.eq(await owensBrowser.topic.backlinks.countBacklinks(), 0);
  });



  // ------ Deleting backlinks, by deleting category


  it("Memah goes to the Specifc Category", async () => {
    await memahsBrowser.forumTopicList.goHere({
          categorySlug: forum.categories.specificCategory.slug });
  });

  it("... posts a topic B that links to Michael's page", async () => {
    await memahsBrowser.complex.createAndSaveTopic({
          title: topicB_title, body: topicB_body_link2MiTpc(),
          bodyMatchAfter: 'topicB_body_link2MiTpc' });
    topicBUrl = await memahsBrowser.getUrl();
    topicBId = await memahsBrowser.getPageId();
    assert.eq(topicBId, '3');
  });

  it("... a link preview appears", async () => {
    const text = await memahsBrowser.topic.getPostText(c.BodyNr);
    assert.eq(text, topicB_body_link2MiTpc_withPreviews())
  });

  it("Owen refreshes Micheal's page", async () => {
    assert.eq(await owensBrowser.getUrl(), michelsTopicUrl());
    await owensBrowser.refresh2();
  });

  it("... there's a backlink", async () => {
    await owensBrowser.topic.backlinks.refreshUntilNum(1);
  });

  it("... from Memah's new topic", async () => {
    assert.ok(await owensBrowser.topic.backlinks.isLinkedFromPageId(topicBId));
  });

  it("Owen follows the backlink", async () => {
    await owensBrowser.topic.backlinks.clickBacklinkFrom(topicBId);
    logBoring("... gets to Memah's 2nd page")
    await owensBrowser.topic.waitUntilPostTextMatches(c.BodyNr, 'topicB_body_link2MiTpc');
  });

  it("... goes to the category", async () => {
    await owensBrowser.topbar.clickAncestor(forum.categories.specificCategory.name);
  });

  it("Owen deletes the whole category!  TyTDELCATBLNS", async () => {
    await owensBrowser.forumButtons.clickEditCategory();
    await owensBrowser.categoryDialog.deleteCategory();
  });

  it("Memah now cannot see her topic — gone, category deleted  TyTDELCATTPC054", async () => {
    await memahsBrowser.refresh2();
    await memahsBrowser.assertNotFoundError({ whyNot: 'CategroyDeleted' });
  });

  it("Memah and Owen go to the linked topic, i.e. Michael's page", async () => {
    await memahsBrowser.go2(michelsTopicUrl());
    await owensBrowser.go2(michelsTopicUrl());
  });

  it("... the backlink is gone: Memah cannot see it", async () => {
    await memahsBrowser.topic.backlinks.refreshUntilNum(0);
  });

  it("... neither can Owen", async () => {
    assert.eq(await owensBrowser.topic.backlinks.countBacklinks(), 0);
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
  const owensTopic_link2MiTpc_previews = () =>
          `owensTopic_link2MiTpc ${michelsTopicTitle()}`;
  const owensReply_link2MaTpc = () => `owensReply_link2MaTpc ${mariasTopicUrl()}`;
  const owensReply_link2MaTpc_previews = () =>
          `owensReply_link2MaTpc ${mariasTopicTitle()}`;

  it("Owen wants his own backlinks!  He goes to the staff cateory", async () => {
    await owensBrowser.forumTopicList.goHere({
          categorySlug: forum.categories.staffOnlyCategory.slug });
  });

  it("... posts a staff-only topic with a link to Michael's page", async () => {
    await owensBrowser.complex.createAndSaveTopic({
          title: owensTopicTitle, body: owensTopic_link2MiTpc(),
          bodyMatchAfter: 'owensTopic_link2MiTpc' });
  });

  it("... and a reply linking to Maria's page", async () => {
    await owensBrowser.complex.replyToOrigPost(owensReply_link2MaTpc());
  });

  it("Owen follows his link to Michael's page", async () => {
    await owensBrowser.waitAndClick(`#post-${c.BodyNr} a`);
    logBoring(`The url is correct`);
    assert.eq(await owensBrowser.getUrl(), michelsTopicUrl());
  });

  it("Owen sees a backlink", async () => {
    await owensBrowser.topic.backlinks.refreshUntilNum(1);
  });

  it("... from his satff-only topic", async () => {
    await owensBrowser.topic.backlinks.isLinkedFromPageId(owensTopicId);
  });

  it("... but Memah doesn't; she's an ordinary member, not staff", async () => {
    assert.eq(await memahsBrowser.getUrl(), michelsTopicUrl());
    await memahsBrowser.refresh2();
    await memahsBrowser.waitForMyDataAdded();
    assert.eq(await memahsBrowser.topic.backlinks.countBacklinks(), 0);
  });

  it("Owen sees a backlink also on Maria's page", async () => {
    await owensBrowser.go2(mariasTopicUrl());
    await owensBrowser.waitForMyDataAdded();
    assert.eq(await owensBrowser.topic.backlinks.countBacklinks(), 1);
  });

  it("... but Memah doesn't", async () => {
    await memahsBrowser.go2(mariasTopicUrl());
    await memahsBrowser.waitForMyDataAdded();
    assert.eq(await memahsBrowser.topic.backlinks.countBacklinks(), 0);
  });


  // ------ Staff-only backlinks: Deleting

  /*

  it("Owen starts thinking that backlinks are Bad", async () => {
    // Noop
  });

  it("... since the words 'Backlinks' and 'Bad' both start with 'Ba'", async () => {
    // Noop
  });

  it("Owen clicks the reply backlink", async () => {
  });

  it("... gets back to the staff-only page with links", async () => {
  });

  it("Owen deletes the reply with the backlink", async () => {
  });

  it("... goes to Maria's topic again", async () => {
    await owensBrowser.go2(mariasTopicUrl());
  });

  it("... the backlink is gone", async () => {
    assert.eq(await owensBrowser.topic.backlinks.countBacklinks(), 0);
  });

  it("On Memah's topic though", async () => {
    await owensBrowser.go2(topicAUrl);
  });

  it("... there's still a backlink", async () => {
    assert.eq(await owensBrowser.topic.backlinks.countBacklinks(), 1);
  });

  it("Owen returns to his page", async () => {
    await owensBrowser.back();
    await owensBrowser.back();
  });

  it("Owen deletes the whole page", async () => {
  });

  it("... goes to Memah's topi", async () => {
    await owensBrowser.go2(topicAUrl);
  });

  it("... the backlink is gone", async () => {
    assert.eq(await owensBrowser.topic.backlinks.countBacklinks(), 0);
  });
  */

});

