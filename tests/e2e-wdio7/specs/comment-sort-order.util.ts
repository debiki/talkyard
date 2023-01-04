/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

const firstNestedReplyNr = 6;
const firstNestedNestedReplyNr = 10;
const parentOfNestedNr = c.ThirdReplyNr;   // = 4
const parentOfNestedNestedNr = firstNestedReplyNr + 2;  // = 8

export interface PageMaybeSort { catId: CatId, suffix: St };


export function addCommentsToSort(ps: {
        builder,
        forum: TwoCatsTestForum,
        sortedPage: PageMaybeSort,
        sortedPage2?: PageMaybeSort,
        sortedPage3?: PageMaybeSort,
        sortedPage4?: PageMaybeSort,
        defaultPage: PageMaybeSort,
        defaultPage2?: PageMaybeSort,
      }): {
        sortedPage: PageJustAdded,
        sortedPage2?: PageJustAdded,
        sortedPage3?: PageJustAdded,
        sortedPage4?: PageJustAdded,
        defaultPage: PageJustAdded,
        defaultPage2?: PageJustAdded,
      } {

  const builder = ps.builder;
  const forum = ps.forum;

  const defaultPage = addDefaultPage(ps.defaultPage);
  const defaultPage2 = ps.defaultPage2 && addDefaultPage(ps.defaultPage2);

  const sortedPage = addPageToSort(ps.sortedPage);
  const sortedPage2 = ps.sortedPage2 && addPageToSort(ps.sortedPage2);
  const sortedPage3 = ps.sortedPage3 && addPageToSort(ps.sortedPage3);
  const sortedPage4 = ps.sortedPage4 && addPageToSort(ps.sortedPage4);


  function addDefaultPage(page) {
    const defaultPage = builder.addPage({
      id: `page_${page.suffix}`,
      folder: '/',
      showId: false,
      slug: `page-${page.suffix}`, /// 'default-order',
      role: c.TestPageRole.Discussion,
      title: `Default Order in Cat ${page.suffix.toUpperCase()}`,
      body: "Default comments sort order.",
      categoryId: page.catId,
      authorId: forum.members.maria.id,
    });
    builder.addPost({
      page: defaultPage,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post nr 2 — the first reply, won't move.",
    });
    builder.addPost({
      page: defaultPage,
      nr: c.SecondReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post 3 — the 2nd reply, won't move. One Like vote.",
    });
    builder.addVote({
      onPageId: defaultPage.id,
      onPostNr: c.SecondReplyNr,
      votedAtMs: c.JanOne2020HalfPastFive,
      voterId: forum.members.michael.id,
      voteType: c.TestVoteType.Like,
    });
    builder.addPost({
      page: defaultPage,
      nr: c.ThirdReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post 4 — the 3rd reply, won't move.",
    });

    return defaultPage;
  }


  function addPageToSort(page) {
    const sortedPage = builder.addPage({
      id: `page_${page.suffix}`,
      folder: '/',
      showId: false,
      slug: `page-${page.suffix}`, /// 'default-order',
      role: c.TestPageRole.Discussion,
      title: `To Sort in Cat ${page.suffix.toUpperCase()}`,
      body: "Let's sort of sort out the sort order.",
      categoryId: page.catId,
      authorId: forum.members.maria.id,
    });

    // Direct replies:
    builder.addPost({
      page: sortedPage,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post nr 2 — the first reply.",
    });
    builder.addPost({
      page: sortedPage,
      nr: c.SecondReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post 3 — the 2nd reply. One Like vote.",
    });
    builder.addPost({
      page: sortedPage,
      nr: c.ThirdReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post 4 — the 3rd reply. Two Like votes.",
    });
    builder.addPost({
      page: sortedPage,
      nr: c.ThirdReplyNr + 1,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post nr 5 — the 4th reply and last OP reply.",
    });

    // Nested replies:
    builder.addPost({
      page: sortedPage,
      nr: firstNestedReplyNr,
      parentNr: parentOfNestedNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post nr 6 — the first a nested reply.",
    });
    builder.addPost({
      page: sortedPage,
      nr: firstNestedReplyNr + 1,
      parentNr: parentOfNestedNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post 7. One Like vote.",
    });
    builder.addPost({
      page: sortedPage,
      nr: firstNestedReplyNr + 2,
      parentNr: parentOfNestedNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post 8. Two Like votes.",
    });
    builder.addPost({
      page: sortedPage,
      nr: firstNestedReplyNr + 3,
      parentNr: parentOfNestedNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post nr 9, last nested.",
    });

    // Nested nested:
    builder.addPost({
      page: sortedPage,
      nr: firstNestedNestedReplyNr,
      parentNr: parentOfNestedNestedNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post nr 10 — first nested nested.",
    });
    builder.addPost({
      page: sortedPage,
      nr: firstNestedNestedReplyNr + 1,
      parentNr: parentOfNestedNestedNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post 11. One Like vote.",
    });
    builder.addPost({
      page: sortedPage,
      nr: firstNestedNestedReplyNr + 2,
      parentNr: parentOfNestedNestedNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post 12. Two Like votes.",
    });
    builder.addPost({
      page: sortedPage,
      nr: firstNestedNestedReplyNr + 3,
      parentNr: parentOfNestedNestedNr,
      authorId: forum.members.maria.id,
      approvedSource: "Post nr 13, last nested nested.",
    });

    // post_4_has_2_votes:
    builder.addVote({
      onPageId: sortedPage.id,
      onPostNr: 4,
      votedAtMs: c.JanOne2020HalfPastFive,
      voterId: forum.members.memah.id,
      voteType: c.TestVoteType.Like,
    });
    builder.addVote({
      onPageId: sortedPage.id,
      onPostNr: 4,
      votedAtMs: c.JanOne2020HalfPastFive,
      voterId: forum.members.michael.id,
      voteType: c.TestVoteType.Like,
    });

    // post_8_has_2_votes:
    builder.addVote({
      onPageId: sortedPage.id,
      onPostNr: 8,
      votedAtMs: c.JanOne2020HalfPastFive,
      voterId: forum.members.memah.id,
      voteType: c.TestVoteType.Like,
    });
    builder.addVote({
      onPageId: sortedPage.id,
      onPostNr: 8,
      votedAtMs: c.JanOne2020HalfPastFive,
      voterId: forum.members.michael.id,
      voteType: c.TestVoteType.Like,
    });

    // post_12_has_2_votes:
    builder.addVote({
      onPageId: sortedPage.id,
      onPostNr: 12,
      votedAtMs: c.JanOne2020HalfPastFive,
      voterId: forum.members.memah.id,
      voteType: c.TestVoteType.Like,
    });
    builder.addVote({
      onPageId: sortedPage.id,
      onPostNr: 12,
      votedAtMs: c.JanOne2020HalfPastFive,
      voterId: forum.members.michael.id,
      voteType: c.TestVoteType.Like,
    });

    // post_11_has_1_vote:
    builder.addVote({
      onPageId: sortedPage.id,
      onPostNr: 11,
      votedAtMs: c.JanOne2020HalfPastFive,
      voterId: forum.members.memah.id,
      voteType: c.TestVoteType.Like,
    });

    // post_7_has_1_vote:
    builder.addVote({
      onPageId: sortedPage.id,
      onPostNr: 7,
      votedAtMs: c.JanOne2020HalfPastFive,
      voterId: forum.members.michael.id,
      voteType: c.TestVoteType.Like,
    });

    // post_3_has_1_vote:
    builder.addVote({
      onPageId: sortedPage.id,
      onPostNr: 3,
      votedAtMs: c.JanOne2020HalfPastFive,
      voterId: forum.members.michael.id,
      voteType: c.TestVoteType.Like,
    });

    return sortedPage;
  }


  return {
    forum,
    sortedPage,
    sortedPage2,
    sortedPage3,
    sortedPage4,
    defaultPage,
    defaultPage2,
   };
}



export async function checkSortOrder(br: TyE2eTestBrowser, sortOrder) {
  const els = await br.$$('.dw-depth-1 .dw-p');
  const postNrTexts = await Promise.all(els.map(async el => await el.getAttribute('id')));
  const expectedOrder = expectedPostNrOrder(sortOrder);
  assert.deepEq(postNrTexts, expectedOrder.map(nr => `post-${nr}`));
};



function expectedPostNrOrder(sortOrder): Nr[] {
  assert.eq(parentOfNestedNr, 4); // ttt
  assert.eq(parentOfNestedNestedNr, 8); // ttt

  switch (sortOrder) {
    case c.TestPostSortOrder.OldestFirst:
      return [
        2,
        3,
        4,
            6,
            7,
            8,
                10,
                11,
                12,
                13,
            9,
        5]

    case c.TestPostSortOrder.NewestFirst:
      return [
        5,
        4,
            9,
            8,
                13,
                12,
                11,
                10,
            7,
            6,
        3,
        2];

    case c.TestPostSortOrder.BestFirst:
      return [
        4,            // post_4_has_2_votes
            8,        // post_8_has_2_votes
                12,   // post_12_has_2_votes
                11,   // post_11_has_1_vote
                10,   // no votes — oldest first
                13,   //
            7,        // post_7_has_1_vote
            6,        // no votes — oldest first
            9,        //
        3,            // post_3_has_1_vote
        2,
        5]

    case c.TestPostSortOrder.NewestThenBest:
      return [
        5,
        4,
            8,        // post_8_has_2_votes
                12,   // post_12_has_2_votes
                11,   // post_11_has_1_vote
                10,   // no votes — oldest first
                13,   //
            7,        // post_7_has_1_vote
            6,        // no votes — oldest first
            9,        //
        3,
        2];

    case c.TestPostSortOrder.NewestThenOldest:
      return [
        5,
        4,
            6,
            7,
            8,
                10,
                11,
                12,
                13,
            9,
        3,
        2];
  }
}