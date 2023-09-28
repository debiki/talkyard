/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';
import { buildSite } from '../utils/site-builder';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import settings from '../utils/settings';
import { makeCreatePageAction, makeCreateCommentAction, makeVoteAction
      } from '../utils/do-api-actions';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let mons: Member;
let modya: Member;
let corax: Member;
let trillian: member;
let maja: Member;
let maria: Member;
let mei: Member;
let michael: Member;

let site: IdAddress;
let forum: TwoCatsTestForum;

const apiSecret: TestApiSecret = {
  nr: 1,
  userId: c.SysbotUserId,
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSecret4SortIdeas',
};

const catARefId = 'catARefId';

/* Page order, votes and comments:

  p77  7 upvotes
  p55  5 upvotes
  p44  4 upvotes, a comment 'p44cmt'
  p33  3 upvotes
  p22a 2 upvotes
  p22b 2 upvotes
  p22c 2 upvotes
  p22d 2 upvotes
  p11  1 upvotes, a comment 'p11cmt' with  2 upvotes
  p00  0 upvotes, a comment 'p00cmt'
*/

const pageRefId77  = 'p77';
const pageRefId55  = 'p55';
const pageRefId44  = 'p44'; const comtRefId44cmt  = 'p44cmt';
const pageRefId33  = 'p33';
const pageRefId22d = 'p22d';
const pageRefId22c = 'p22c';
const pageRefId22b = 'p22b';
const pageRefId22a = 'p22a';
const pageRefId11  = 'p11'; const comtRefId11cmt  = 'p11cmt';
const pageRefId00  = 'p00'; const comtRefId00cmt  = 'p00cmt';

function mkPageParams(ps: { refId: St }): CreatePageParams {
  return {
    // id: assigned by the server
    refId: ps.refId,
    pageType: 'Idea' as PageTypeSt,
    inCategory: 'rid:' + catARefId,
    title: `Page_w_RefID ${ps.refId}`,
    bodySrc: `page_body_refid_${ps.refId}`,
    bodyFmt: 'CommonMark',
  };
}

const comment00cmt: CreateCommentParams = {
  refId: comtRefId00cmt,
  // postType: c.TestPostType.Normal,
  parentNr: c.BodyNr,
  whatPage: `rid:${pageRefId00}`,
  bodySrc: `Comment_refid_${comtRefId00cmt}`,
  bodyFmt: 'CommonMark',
};

const comment11cmt: CreateCommentParams = {
  refId: comtRefId11cmt,
  // postType: c.TestPostType.Normal,
  parentNr: c.BodyNr,
  whatPage: `rid:${pageRefId11}`,
  bodySrc: `Comment_refid_${comtRefId11cmt}`,
  bodyFmt: 'CommonMark',
};

const comment44cmt: CreateCommentParams = {
  refId: comtRefId44cmt,
  // postType: c.TestPostType.Normal,
  parentNr: c.BodyNr,
  whatPage: `rid:${pageRefId44}`,
  bodySrc: `Comment_refid_${comtRefId44cmt}`,
  bodyFmt: 'CommonMark',
};

const upvoters: Member[] = [];



describe(`do-api-upvote-ideas-sort-by-votes.2br.d  TyTDOAPI_UPVOTE_IDEAS`, () => {

  if (settings.prod) {
    console.log("Skipping this spec — the server needs to have upsert conf vals enabled."); // E2EBUG
    return;
  }

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "Upvote Ideas E2E Test",
      categoryAExtId: catARefId,
      members: ['mons', 'modya', 'corax', 'trillian', 'memah', 'maja', 'maria', 'mei', 'michael']
    });

    builder.settings({ enableApi: true });
    builder.getSite().apiSecrets = [apiSecret];

    // This changes topic sort order, for cat A, to orig-post Like votes.
    // And makes a vote count icon appear, next to the topic, in the topic list.
    const catA = builder.getSite().categories.find(c => c.extId === catARefId);
    catA.doItVotesPopFirst = true;

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;
    memah = forum.members.memah;
    memah_brB = brB;

    mons = forum.members.mons;
    modya = forum.members.modya;
    corax = forum.members.corax;
    trillian = forum.members.trillian;
    maja = forum.members.maja;
    maria = forum.members.maria;
    mei = forum.members.mei;
    michael = forum.members.michael;

    // Not Maja, she created the pages. Not Memah and Owen, they'll log in and upvote later.
    upvoters.push(mons, modya, corax, trillian, maria, mei, michael);

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });


  // ----- Create page via the Do API

  it(`Create 9 pages`, async () => {
    for (const refIds of [
            // Max 7 at a time.
            [pageRefId11, pageRefId00],  // 11_created_before_00
            [pageRefId22a, pageRefId22b, pageRefId22c, pageRefId22d],
            [pageRefId33,  pageRefId44,  pageRefId55,  pageRefId77],
          ]) {
      await server.apiV0.do_({
        origin: site.origin,
        apiRequesterId: c.SysbotUserId,
        apiSecret: apiSecret.secretKey,
        data: {
          doActions:
              refIds.map(refId => makeCreatePageAction(
                  'username:maja',
                  mkPageParams({ refId })))
        },
      });
    }
  });

  it(`Create comments on page 11, 33 and 44`, async () => {
    await server.apiV0.do_({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        doActions: [
            makeCreateCommentAction(`username:maja`, comment00cmt),
            makeCreateCommentAction(`username:maja`, comment11cmt),
            makeCreateCommentAction(`username:maja`, comment44cmt)],
      },
    });
  });

  async function upvoteComment(postRef: PostRef, numVotes: Nr) {
    await upvoteImpl(undefined, 'rid:' + postRef, numVotes);
  }

  async function upvotePage(pageRef: PostRef, numVotes: Nr) {
    await upvoteImpl('rid:' + pageRef, undefined, numVotes);
  }

  async function upvoteImpl(pageRef: PageRef, postRef: PostRef, numVotes: Nr) {
    const voters = _.take(upvoters, numVotes);
    await server.apiV0.do_({
      origin: site.origin,
      apiRequesterId: c.SysbotUserId,
      apiSecret: apiSecret.secretKey,
      data: {
        doActions:
            voters.map(v => makeVoteAction(`username:${v.username}`,
                  { voteType: 'Like', whatPage: pageRef, whatPost: postRef, howMany: 1 })),
      },
    });
  }

  it(`Upvote page ${pageRefId11}: 1 vote`, async () => {
    await upvotePage(pageRefId11, 1)
  });

  it(`Upvote comment 11cmt: 3 votes, that's more than all pages 22a, b, c, d`, async () => {
    await upvoteComment(comment11cmt.refId, 3);
  });

  it(`Upvote pages ${pageRefId22a}, b, c, d:  2 votes each`, async () => {
    await upvotePage(pageRefId22a, 2);
    await upvotePage(pageRefId22b, 2);
    await upvotePage(pageRefId22c, 2);
    await upvotePage(pageRefId22d, 2);
  });

  it(`Upvote page ${pageRefId33}: 3 votes`, async () => {
    await upvotePage(pageRefId33, 3);
  });

  it(`Upvote page ${pageRefId44}: 4 votes`, async () => {
    await upvotePage(pageRefId44, 4);
  });

  it(`Upvote page ${pageRefId55}: 5 votes`, async () => {
    await upvotePage(pageRefId55, 5);
  });

  it(`Upvote page ${pageRefId77}: 7 votes`, async () => {
    await upvotePage(pageRefId77, 7);
  });

  it(`Owen goes to the forum, category A, logs in`, async () => {
    await owen_brA.go2(site.origin + '/latest/' + forum.categories.catA.slug);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  it(`... opens Category A`, async () => {
    await owen_brA.forumTopicList.switchToCategory(forum.categories.catA.name);
  });


  it(`Pages are sorted by Orig Post votes`, async () => {
    assert.eq(await owen_brA.forumTopicList.getTopicSortOrder(), 'Top');
  });

  it(`... topics are indeed sorted by OP upvotes,  comment votes ignored`, async () => {
    await owen_brA.forumTopicList.assertTopicTitlesAreAndOrder([
          `Page_w_RefID ${pageRefId77}`,  // has 7 orig post upvotes
          `Page_w_RefID ${pageRefId55}`,  // has 5
          `Page_w_RefID ${pageRefId44}`,  // has 4
          `Page_w_RefID ${pageRefId33}`,
          `Page_w_RefID ${pageRefId22d}`, // these have 2 — then, recently active, first
          `Page_w_RefID ${pageRefId22c}`, //
          `Page_w_RefID ${pageRefId22b}`, // (maybe add a comment, to verify active first?)
          `Page_w_RefID ${pageRefId22a}`, //
          `Page_w_RefID ${pageRefId11}`,
          `Page_w_RefID ${pageRefId00}`,  // has 0
    ]);
  });

  it(`Owen edits the category ...`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
  });
  it(`... disables Do-It votes`, async () => {
    await owen_brA.categoryDialog.setDoItVotes(false);
  });
  it(`... saves`, async () => {
    await owen_brA.categoryDialog.submit();
  });


  it(`The sort order remains Popular First`, async () => {
    // ------ UX BUG: The pages order doesn't get updated, therefore we click New then Top:
    await owen_brA.forumTopicList.viewNewest();
    // Break out fn & test for this, later?:
    await owen_brA.forumTopicList.clickViewTop(); // locks on Top order  TyTLOCK_TPC_ORD
    await owen_brA.waitForDisplayed('.esForum_catsNav_btn.n_ExplSel.active');
    await owen_brA.forumTopicList.clickViewTop(); // unlocks, stays on Top order
    await owen_brA.waitForGone('.esForum_catsNav_btn.n_ExplSel.active');
    // ------
    assert.eq(await owen_brA.forumTopicList.getTopicSortOrder(), 'Top');
  });

  it(`... topics are sorted by votes, taking into account votes on *comments*`, async () => {
    await owen_brA.forumTopicList.assertTopicTitlesAreAndOrder([
          `Page_w_RefID ${pageRefId77}`,  // 7 votes
          `Page_w_RefID ${pageRefId55}`,  // 5 votes
          `Page_w_RefID ${pageRefId44}`,  // 4 votes
          `Page_w_RefID ${pageRefId11}`,  // 1 + 3 comment votes
          `Page_w_RefID ${pageRefId33}`,  // 3 votes
          `Page_w_RefID ${pageRefId22d}`, // 2
          `Page_w_RefID ${pageRefId22c}`,
          `Page_w_RefID ${pageRefId22b}`,
          `Page_w_RefID ${pageRefId22a}`,
          `Page_w_RefID ${pageRefId00}`,  // 0 votes
    ]);
  });
  it(`But the default order has changed: Owen navigates away ...`, async () => {
    await owen_brA.forumTopicList.switchToCategory("All categories");
  });
  it(`... and back to Cat A`, async () => {
    await owen_brA.forumTopicList.switchToCategory(forum.categories.catA.name);
  });
  it(`... the sort order is now Recently Active first`, async () => {
    assert.eq(await owen_brA.forumTopicList.getTopicSortOrder(), 'Active');
  });

  it(`... topics are indeed sorted recently-active-first`, async () => {
    await owen_brA.forumTopicList.assertTopicTitlesAreAndOrder([
          `Page_w_RefID ${pageRefId44}`, // has the most recent comment
          `Page_w_RefID ${pageRefId11}`, // has the 2nd most recent comment
          `Page_w_RefID ${pageRefId00}`, // the 3rd most recent
          `Page_w_RefID ${pageRefId77}`, // newest page
          `Page_w_RefID ${pageRefId55}`, // newest but one
          `Page_w_RefID ${pageRefId33}`,
          `Page_w_RefID ${pageRefId22d}`,
          `Page_w_RefID ${pageRefId22c}`,
          `Page_w_RefID ${pageRefId22b}`,
          `Page_w_RefID ${pageRefId22a}`, // oldest, excl 00 and 11
    ]);
  });

  it(`Owen opens the edit-category dialog`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
  });
  it(`... enables Do-It votes again`, async () => {
    await owen_brA.categoryDialog.setDoItVotes(true);
  });
  it(`... saves`, async () => {
    await owen_brA.categoryDialog.submit();
  });

  it(`Memah logs in ...`, async () => {
    await memah_brB.go2(site.origin);
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });
  it(`... opens Category A`, async () => {
    await memah_brB.forumTopicList.switchToCategory(forum.categories.catA.name);
  });

  it(`Pages sort order is Orig Post votes`, async () => {
    assert.eq(await memah_brB.forumTopicList.getTopicSortOrder(), 'Top');
  });

  it(`... topics are indeed sorted by OP upvotes, and comment votes are ignored`, async () => {
    await memah_brB.forumTopicList.assertTopicTitlesAreAndOrder([
          `Page_w_RefID ${pageRefId77}`, // has 7 orig post upvotes
          `Page_w_RefID ${pageRefId55}`, // has 5
          `Page_w_RefID ${pageRefId44}`, // has 4
          `Page_w_RefID ${pageRefId33}`,
          `Page_w_RefID ${pageRefId22d}`, // these have 2 — then, recently active, first
          `Page_w_RefID ${pageRefId22c}`, //
          `Page_w_RefID ${pageRefId22b}`, // (maybe add a comment, to verify active first?)
          `Page_w_RefID ${pageRefId22a}`, //
          `Page_w_RefID ${pageRefId11}`,
          `Page_w_RefID ${pageRefId00}`]);
  });

  it(`Memah opens page 44`, async () => {
    await memah_brB.forumTopicList.goToTopic(`Page_w_RefID ${pageRefId44}`, { mayScroll: true });
  });
  it(`... upvotes`, async () => {
    await memah_brB.topic.clickLikeVote(c.BodyNr);
  });

  it(`Owen also opens page 44`, async () => {
    await owen_brA.forumTopicList.goToTopic(`Page_w_RefID ${pageRefId44}`, { mayScroll: true });
  });
  it(`... upvotes, he too`, async () => {
    await owen_brA.topic.clickLikeVote(c.BodyNr);
  });

  it(`... goes to the homepage, then opens Cat A again`, async () => {
    await owen_brA.go('/');
    await owen_brA.forumTopicList.switchToCategory(forum.categories.catA.name);
  });

  it(`... the sort order is now Top, not Recently Active, for Owen too`, async () => {
    assert.eq(await owen_brA.forumTopicList.getTopicSortOrder(), 'Top');
  });

  it(`... now topic 44 has 6 votes, and is sorted before 55`, async () => {
    await owen_brA.forumTopicList.assertTopicTitlesAreAndOrder([
          `Page_w_RefID ${pageRefId77}`, // has 7 orig post upvotes
          `Page_w_RefID ${pageRefId44}`, // has 4+2 upvotes
          `Page_w_RefID ${pageRefId55}`, // has 5
          `Page_w_RefID ${pageRefId33}`,
          `Page_w_RefID ${pageRefId22d}`,
          `Page_w_RefID ${pageRefId22c}`,
          `Page_w_RefID ${pageRefId22b}`,
          `Page_w_RefID ${pageRefId22a}`,
          `Page_w_RefID ${pageRefId11}`,
          `Page_w_RefID ${pageRefId00}`,
    ]);
  });

  it(`Memah opens page 00`, async () => {
    await memah_brB.back();
    await memah_brB.forumTopicList.goToTopic(`Page_w_RefID ${pageRefId00}`, { mayScroll: true });
  });
  it(`... upvotes the *comment*`, async () => {
    await memah_brB.topic.clickLikeVote(c.FirstReplyNr);
  });

  it(`Owen also opens page 00`, async () => {
    await owen_brA.forumTopicList.goToTopic(`Page_w_RefID ${pageRefId00}`, { mayScroll: true });
  });
  it(`... upvotes, he too`, async () => {
    await owen_brA.topic.clickLikeVote(c.FirstReplyNr);
  });

  it(`... goes back to the topic list, refreshes`, async () => {
    await owen_brA.back();
    await owen_brA.refresh2();
  });

  it(`... but the sort order is the same — the Like votes on the comment are ignored
            when sorting by Do-It votes`, async () => {
    await owen_brA.forumTopicList.assertTopicTitlesAreAndOrder([
          `Page_w_RefID ${pageRefId77}`,  // has 7 orig post upvotes
          `Page_w_RefID ${pageRefId44}`,  // has 4+2 upvotes
          `Page_w_RefID ${pageRefId55}`,  // has 5
          `Page_w_RefID ${pageRefId33}`,
          `Page_w_RefID ${pageRefId22d}`,
          `Page_w_RefID ${pageRefId22c}`,
          `Page_w_RefID ${pageRefId22b}`,
          `Page_w_RefID ${pageRefId22a}`, // has 2 votes
          `Page_w_RefID ${pageRefId11}`,  // has 1 vote
          `Page_w_RefID ${pageRefId00}`,  // has a *comment* with 2 votes
    ]);
  });

  it(`Owen sorts newest-first  (why not quickly extra-test this)`, async () => {
    await owen_brA.forumTopicList.viewNewest();
  });
  it(`... sort order becomes new-first`, async () => {
    assert.eq(await owen_brA.forumTopicList.getTopicSortOrder(), 'New');
  });
  it(`... topics sorted in the order they got created`, async () => {
    await owen_brA.forumTopicList.assertTopicTitlesAreAndOrder([
          `Page_w_RefID ${pageRefId77}`,
          `Page_w_RefID ${pageRefId55}`,
          `Page_w_RefID ${pageRefId44}`,
          `Page_w_RefID ${pageRefId33}`,
          `Page_w_RefID ${pageRefId22d}`,
          `Page_w_RefID ${pageRefId22c}`,
          `Page_w_RefID ${pageRefId22b}`,
          `Page_w_RefID ${pageRefId22a}`,
          `Page_w_RefID ${pageRefId00}`,  // 11_created_before_00
          `Page_w_RefID ${pageRefId11}`,  //
    ]);
  });

});