/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let brC: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let mons: Member;
let mons_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let michael: Member;
let michael_brC: TyE2eTestBrowser;
let mallory: Member;
let mallory_brB: TyE2eTestBrowser;
let stranger_brC: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

const startPagePath = '/start-page';
let michaelsTopicUrl: St;
let mariasTopicUrl: St;



describe(`modn-review-specific-user.3br.f  TyTMOD_REVW_USR`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "Some E2E Test",
      categoryAExtId: 'cat_a_ext_id',
      members: ['memah', 'maria', 'michael', 'mallory']
    });

    builder.settings({
      maxPostsPendApprBefore: 9,
      requireApprovalIfTrustLte: c.TestTrustLevel.Basic,
      reviewAfterIfTrustLte: c.TestTrustLevel.FullMember,
    });

    builder.addPage({
      id: 'startPageId',
      folder: '/',
      showId: false,
      slug: startPagePath.substring(1),
      role: c.TestPageRole.Discussion,
      title: "Start_Page",
      body: "Start page text.",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.memah.id,
    });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    brC = new TyE2eTestBrowser(wdioBrowserC, 'brC');

    owen = forum.members.owen;
    owen_brA = brA;
    mons = forum.members.mons;
    mons_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;
    michael = forum.members.michael;
    michael_brC = brC;
    mallory = forum.members.mallory;
    mallory_brB = brB;
    stranger_brC = brC;

    // Changing trust & threat levels:
    maria.trustLevel = c.TestTrustLevel.Basic;
    maria.threatLevel = c.TestThreatLevel.HopefullySafe;

    michael.trustLevel = c.TestTrustLevel.FullMember;
    michael.threatLevel = c.TestThreatLevel.HopefullySafe;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Owen logs in to admin area`, async () => {
    await owen_brA.adminArea.goToUsersEnabled(site.origin);
    await owen_brA.loginDialog.loginWithPassword(owen);
  });
  it(`Maria logs in`, async () => {
    await maria_brB.go2(site.origin + startPagePath);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });
  it(`Michael logs in`, async () => {
    await michael_brC.go2(site.origin + startPagePath);
    await michael_brC.complex.loginWithPasswordViaTopbar(michael);
  });


  // ----- Maria and Michael post comments and pages

  it(`Maria posts three comments, they'll be pending approval`, async () => {
    await maria_brB.complex.replyToOrigPost(`marias_comment_others_page_1`);
    await maria_brB.complex.replyToOrigPost(`marias_comment_others_page_2`);
    await maria_brB.complex.replyToOrigPost(`marias_comment_others_page_3`);
  });
  it(`... and a new page (without comments — page pending approval)`, async () => {
    await maria_brB.topic.clickHomeNavLink();
    await maria_brB.complex.createAndSaveTopic({
            title: `Marias_Page`, body: `marias_page_body`, willBePendingApproval: true });
    mariasTopicUrl = await maria_brB.urlPath();
  });

  it(`Michael posts two comments, get auto approved but pending review`, async () => {
    await michael_brC.complex.replyToOrigPost(`michaels_comment_others_page_1`);
    await michael_brC.complex.replyToOrigPost(`michaels_comment_others_page_2`);
  });
  it(`... a new page (auto approved, but pending review)`, async () => {
    await michael_brC.topic.clickHomeNavLink();
    await michael_brC.complex.createAndSaveTopic({
            title: `Michaels_Page`, body: `michaels_page_body` });
    michaelsTopicUrl = await michael_brC.urlPath();
  });
  it(`... with a comment`, async () => {
    await michael_brC.complex.replyToOrigPost(`michaels_comment_own_page_1`);
  });


  // ----- List mod tasks, specific person

  it(`Owen views Maria's profile in the Admin Area`, async () => {
    await owen_brA.adminArea.users.goToUser(maria);
  });
  it(`... clicks View Moderation Tasks`, async () => {
    await owen_brA.adminArea.user.viewModTasks();
  });
  it(`... sees only mod tasks about Maria`, async () => {
    const expected = {};
    expected[maria.username] = 4;  // 3 comments, 1 page
    assert.deepEq(await owen_brA.adminArea.review.countTasksByUsername(), expected);
  });


  // ----- Approve one

  it(`Owen approves Maria's 2nd comment, and the page`, async () => {
    const r = owen_brA.adminArea.review;
    await r.approvePostForTaskIndex(3);  // task nr 3 = comment 2. (Nr 4 = oldest = comment 1)
    await r.approvePostForTaskIndex(1);  // the page — most recent, task nr 1
    await r.playTimePastUndo();
  });

  it(`Now Maria can reply to her own page (since it's been approved))`, async () => {
    await maria_brB.refresh2();
    await maria_brB.topic.refreshUntilPostNotPendingApproval(c.BodyNr);
    await maria_brB.complex.replyToOrigPost(`marias_comment_own_page_1`);
    await maria_brB.complex.replyToOrigPost(`marias_comment_own_page_2`);
    await maria_brB.topic.waitUntilPostTextIs(c.SecondReplyNr, `marias_comment_own_page_2`);
  });
  it(`Owen reloads the mod task list`, async () => {
    await owen_brA.refresh2();
    await owen_brA.adminArea.review.waitUntilLoaded();

  });
  it(`... sees Maria's two new comments`, async () => {
    const expected = {};
    expected[maria.username] = 6;  // 3 comments, 1 page + 2 new comments
    assert.deepEq(await owen_brA.adminArea.review.countTasksByUsername(), expected);
  });
  it(`Owen hides completed tasks`, async () => {
    await owen_brA.adminArea.review.hideCompletedTasks();
    //// Why needed?  hideCompletedTasks() does wait untill all .e_TskDoneGone gone! [E2EBUG]
    //await owen_brA.pause(1000);
  });
  it(`... now sees only 4 of Maria's 6 tasks`, async () => {
    const expected = {};
    expected[maria.username] = 4;  // 3 -1 comments, 1 - 1 page + 2 comments = 2 + 0 + 2 = 4
    assert.deepEq(await owen_brA.adminArea.review.countTasksByUsername(), expected);
  });
  it(`Owen approves Maria's first comment on her page`, async () => {
    const r = owen_brA.adminArea.review;
    await r.approvePostForTaskIndex(2);  // task nr 2 = oldest comment on page = first on page
    await r.playTimePastUndo();
  });

  it(`Maria sees that the comment has been approved`, async () => {
    await maria_brB.topic.refreshUntilPostNotPendingApproval(c.FirstReplyNr);
  });
  it(`... her other comment still not approved`, async () => {
    await maria_brB.topic.assertPostNeedsApprovalBodyVisible(c.SecondReplyNr);
  });

  // (Now _only_3 of Maria's mod tasks left.)


  // ----- List tasks, showComplicated = true

  it(`Owen views Micheal's profile in the Admin Area`, async () => {
    await owen_brA.adminArea.user.viewUser(michael);
  });
  it(`... clicks View Moderation Tasks`, async () => {
    await owen_brA.adminArea.user.viewModTasks();
  });
  it(`... sees only mod tasks about Michael`, async () => {
    const expected = {};
    expected[michael.username] = 4;  // 2 comments, 1 page, 1 comment
    assert.deepEq(await owen_brA.adminArea.review.countTasksByUsername(), expected);
  });
  it(`Owen adds  showComplicated=true  to the url`, async () => {
    const pathQuery = await owen_brA.urlPathQueryHash(); // no hash frag,
    assert.includes(pathQuery, '?patId=');  // followed by Michael's id
    // Add showComplicated:
    owen_brA.go2(pathQuery + '&showComplicated=true');
  });


  // ----- Delete page & child comment

  it(`Owen approves Micheal's 2nd comment, but deletes Micheal's page`, async () => {
    const r = owen_brA.adminArea.review;
    await r.approvePostForTaskIndex(3);  // task nr 3 = comment 2. (Nr 4 = oldest = comment 1)
    await r.rejectDeleteTaskIndex(2);  // the page  (nr 1 = a comment on the page)
    await r.playTimePastUndo();
  });

  it(`... Michel now can't see his page`, async () => {
    await michael_brC.refresh2();
    await michael_brC.assertNotFoundError({ whyNot: 'PageDeleted' });
  });


  // ----- Bulk approve all

  it(`Owen bulk accepts all Michael's pending tasks  TyTMODACPTUNREV`, async () => {
    await owen_brA.adminArea.review.bulkAcceptAll();
  });

  it(`Michel's page is still deleted though`, async () => {
    await michael_brC.refresh2();
    await michael_brC.assertNotFoundError({ whyNot: 'PageDeleted' });
  });

  it(`Owen undeletes Michael's page`, async () => {
    await owen_brA.go2(michaelsTopicUrl);
    await owen_brA.topic.undeletePage()
  });

  it(`Michel can now see the page`, async () => {
    await michael_brC.refresh2();
    await michael_brC.assertPageTitleMatches('Michaels_Page');
  });

  it(`... his comment got approved (bulk approved)`, async () => {
    await michael_brC.topic.assertPostNotPendingApproval(c.FirstReplyNr);
  });


  // ----- Task list about everyone is ok

  it(`Owen looks at *everyone*'s mod tasks ()`, async () => {
    await owen_brA.adminArea.review.goHere();
  });
  it(`... sees everyones tasks, both done and pending`, async () => {
    const expected = {};
    expected[maria.username] = 6;
    expected[michael.username] = 4;
    // guest?
    assert.deepEq(await owen_brA.adminArea.review.countTasksByUsername(), expected);
  });
  it(`... Owen hides completed tasks`, async () => {
    await owen_brA.adminArea.review.hideCompletedTasks();
    //// Why needed?  hideCompletedTasks() does wait untill all .e_TskDoneGone gone! [E2EBUG]
    //await owen_brA.pause(1000);
  });
  it(`... now sees only Maria's pending tasks`, async () => {
    const expected = {};
    expected[maria.username] = 3;  // see _only_3 above
    assert.deepEq(await owen_brA.adminArea.review.countTasksByUsername(), expected);
  });

});

