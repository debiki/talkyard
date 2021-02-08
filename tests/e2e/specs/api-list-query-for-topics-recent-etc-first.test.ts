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
let owen_brA: TyE2eTestBrowser;
let memah: Member;
let memah_brA: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;

const specificCatExtId = 'specificCatExtId';
const staffCatExtId = 'staffCatExtId';

const pageAaaTitle_disc = 'pageAaaTitle_disc';
const pageAaaBody = 'pageAaaBody';
let pageAaa_disc: PageJustAdded | U;

const pageBbbTitle_q_no_ans = 'pageBbbTitle_q_no_ans';
const pageBbbBody = 'pageBbbBody';
let pageBbb_q_no_ans: PageJustAdded | U;

const pageCccTitle_q_w_ans = 'pageCccTitle_q_w_ans';
const pageCccBody = 'pageCccBody';
let pageCcc_q_w_ans: PageJustAdded | U;

const pageDddTitle_prob_no_sol = 'pageDddTitle_prob_no_sol';
const pageDddBody = 'pageDddBody';
let pageDdd_prob_no_sol: PageJustAdded | U;

const pageEeeTitle_prob_w_sol = 'pageEeeTitle_prob_w_sol';
const pageEeeBody = 'pageEeeBody';
let pageEee_prob_w_sol: PageJustAdded | U;

const pageFffTitle_idea = 'pageFffTitle_idea';
const pageFffBody = 'pageFffBody';
let pageFff_idea: PageJustAdded | U;


const listQueryWaitingTopicsSpecCat: ListPagesQuery = {
  listWhat: 'Pages',
  lookWhere: { inCategories: [`extid:${specificCatExtId}`] },
  filter: {
    isAuthorWaiting: true,
    isOpen: true,
  } as PageFilter,
} as ListPagesQuery;



describe("api-list-query-for-topics-recent-etc-first  TyT5MRA8RJ7", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
      members: ['michael', 'maria', 'memah', 'owen'],
    });

    pageAaa_disc = builder.addPage({
      id: 'pageAaaId',
      createdAtMs: c.JanOne2020HalfPastFive + 10*1000,
      folder: '/',
      showId: false,
      slug: 'aaa-disc',
      role: c.TestPageRole.Discussion,
      title: pageAaaTitle_disc,
      body: pageAaaBody,
      categoryId: forum.categories.specificCategory.id,
      authorId: forum.members.maria.id,
    });

    pageBbb_q_no_ans = builder.addPage({
      id: 'pageBbbId',
      createdAtMs: c.JanOne2020HalfPastFive + 20*1000,
      folder: '/',
      showId: false,
      slug: 'question-no-ans',
      role: c.TestPageRole.Question,
      title: pageBbbTitle_q_no_ans,
      body: pageBbbBody,
      categoryId: forum.categories.specificCategory.id,
      authorId: forum.members.memah.id,
    });

    pageCcc_q_w_ans = builder.addPage({
      id: 'pageCccId',
      createdAtMs: c.JanOne2020HalfPastFive + 30*1000,
      folder: '/',
      showId: false,
      slug: 'question-w-ans',
      role: c.TestPageRole.Question,
      title: pageCccTitle_q_w_ans,
      body: pageCccBody,
      categoryId: forum.categories.specificCategory.id,
      authorId: forum.members.memah.id,
    });
    builder.addPost({
      page: pageCcc_q_w_ans,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "This is the answer",
    });

    pageDdd_prob_no_sol = builder.addPage({
      id: 'pageDddId',
      createdAtMs: c.JanOne2020HalfPastFive + 40*1000,
      folder: '/',
      showId: false,
      slug: 'prob-no-solution',
      role: c.TestPageRole.Problem,
      title: pageDddTitle_prob_no_sol,
      body: pageDddBody,
      categoryId: forum.categories.specificCategory.id,
      authorId: forum.members.memah.id,
    });

    pageEee_prob_w_sol = builder.addPage({
      id: 'pageEeeId',
      createdAtMs: c.JanOne2020HalfPastFive + 50*1000,
      folder: '/',
      showId: false,
      slug: 'prob-w-solution',
      role: c.TestPageRole.Problem,
      title: pageEeeTitle_prob_w_sol,
      body: pageEeeBody,
      categoryId: forum.categories.specificCategory.id,
      authorId: forum.members.memah.id,
    });
    builder.addPost({
      page: pageEee_prob_w_sol,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "This is the solution",
    });

    pageFff_idea = builder.addPage({
      id: 'pageFffId',
      createdAtMs: c.JanOne2020HalfPastFive + 60*1000,
      folder: '/',
      showId: false,
      slug: 'idea',
      role: c.TestPageRole.Idea,
      title: pageFffTitle_idea,
      body: pageFffBody,
      categoryId: forum.categories.specificCategory.id,
      authorId: forum.members.memah.id,
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
    owen_brA = richBrowserA;
    memah = forum.members.memah;
    memah_brA = richBrowserA;
  });


  it("Memah goes to the forum, logs in", () => {
    memah_brA.go2(siteIdAddress.origin);
    // Log in, so can accept answers, later below.
    memah_brA.complex.loginWithPasswordViaTopbar(memah);
  });



  // ----- List Query: All topics, recent first

  let response: ListQueryResults<PageListed>;

  it("Memah lists waiting pages in the Specific category", () => {
    response = server.apiV0.listQuery<PageListed>({
      origin: siteIdAddress.origin,
      listQuery: listQueryWaitingTopicsSpecCat,
    }) as ListQueryResults<PageListed>;
  });

  it("She finds six pages", () => {
    assert.eq(response.thingsFound.length, 6);
  });



  it("The first page is the most recently added page: Fff  [TyT025WKRGJ]", () => {
    const pageOneFound: PageListed = response.thingsFound[0];
    assert.eq(pageOneFound.title, pageFffTitle_idea);
  });

  it("The second, third, fourth are sorted by time, desc", () => {
    const titles = response.thingsFound.map(ts => ts.title);
    assert.deepEq(titles, [pageFffTitle_idea, pageEeeTitle_prob_w_sol,
          pageDddTitle_prob_no_sol, pageCccTitle_q_w_ans,
          pageBbbTitle_q_no_ans, pageAaaTitle_disc]);
  });

  it("All of them are in the Specific category", () => {
    const specCatName = forum.categories.specificCategory.name;
    const topicCatNames =
            response.thingsFound.map(ts => ts.categoriesMainFirst?.[0]?.name);
    for (const n of topicCatNames) {
      assert.eq(n, specCatName);
    }
  });



  // ----- Excludes answered questions and solved problems


  it("Memah opens the question with an answer", () => {
    memah_brA.go2('/' + pageCcc_q_w_ans.slug);
  });

  it("The title, body and reply are all there  (ttt)", () => {
    memah_brA.topic.waitForPostAssertTextMatches(c.TitleNr, pageCccTitle_q_w_ans);
    memah_brA.topic.waitForPostAssertTextMatches(c.BodyNr, pageCccBody);
    memah_brA.topic.waitForPostAssertTextMatches(c.FirstReplyNr, "the answer");
  });

  it("Memah accepts the answer", () => {
    memah_brA.topic.selectPostNrAsAnswer(c.FirstReplyNr);
  });

  it("... goes to the problem page", () => {
    memah_brA.go2('/' + pageEee_prob_w_sol.slug);
  });

  it("... accepts the solution", () => {
    memah_brA.topic.selectPostNrAsAnswer(c.FirstReplyNr);
  });

  it("Memah again lists waiting pages in the Specific category", () => {
    response = server.apiV0.listQuery<PageListed>({
      origin: siteIdAddress.origin,
      listQuery: listQueryWaitingTopicsSpecCat,
    }) as ListQueryResults<PageListed>;
  });

  it("She finds two fewer pages", () => {
    assert.eq(response.thingsFound.length, 6 - 2);
  });

  it("... namely all pages except for the answered and solved question & problem", () => {
    const titles = response.thingsFound.map(ts => ts.title);
    assert.deepEq(titles, [
          pageFffTitle_idea,
          // solved: pageEeeTitle_prob_w_sol,
          pageDddTitle_prob_no_sol,
          // answered: pageCccTitle_q_w_ans,
          pageBbbTitle_q_no_ans,
          pageAaaTitle_disc]);
  });



  // ----- Specific topic types, a specific category


  it("Maria lists pages ...", () => {
    const listQuery: ListPagesQuery = {
      ...listQueryWaitingTopicsSpecCat,
      filter: {
        ...listQueryWaitingTopicsSpecCat.filter,
        pageType: { _in: ['Problem', 'Question'] },
      },
    };
    response = server.apiV0.listQuery<PageListed>({
      origin: siteIdAddress.origin,
      listQuery,
    }) as ListQueryResults<PageListed>;
  });

  it("She finds only two topics", () => {
    assert.eq(response.thingsFound.length, 2);
  });

  it("... namely the unsolved question and problem", () => {
    const titles = response.thingsFound.map(ts => ts.title);
    assert.deepEq(titles, [
          // pageFffTitle_idea  — wrong type
          // pageEeeTitle_prob_w_sol  — already solved
          pageDddTitle_prob_no_sol,
          // pageCccTitle_q_w_ans  — already answered
          pageBbbTitle_q_no_ans,
          // pageAaaTitle_disc,  — wrong type
          ]);
  });

  // ----- Specific topic types, any category

  it("Maria lists pages ...", () => {
    const listQueryOnlyDiscussionsAllCats: ListPagesQuery = {
      listWhat: 'Pages',
      filter: {
        pageType: { _in: ['Discussion'] },
      },
    } as ListPagesQuery;

    response = server.apiV0.listQuery<PageListed>({
      origin: siteIdAddress.origin,
      listQuery: listQueryOnlyDiscussionsAllCats,
    }) as ListQueryResults<PageListed>;
  });

  it("She finds two pages", () => {
    assert.eq(response.thingsFound.length, 2);
  });

  it("... namely the discussions in cat A and the Specific Cat", () => {
    const titles = response.thingsFound.map(ts => ts.title);
    assert.deepEq(titles, [
          pageAaaTitle_disc,
          forum.topics.byMariaCategoryA.title]);
  });



  // ----- Excludes closed (cancelled) topics


  it("Memah goes to the question page with no answer", () => {
    memah_brA.go2('/' + pageBbb_q_no_ans.slug);
  });

  it("... closes it", () => {
    memah_brA.topic.closeTopic();
  });

  it("Memah lists pages ...", () => {
    response = server.apiV0.listQuery<PageListed>({
      origin: siteIdAddress.origin,
      listQuery: listQueryWaitingTopicsSpecCat,
    }) as ListQueryResults<PageListed>;
  });

  it("She finds one less page", () => {
    assert.eq(response.thingsFound.length, 6 - 2 - 1);
  });

  it("... namely all pages except for the answered, solved and closed ones", () => {
    const titles = response.thingsFound.map(t => t.title);
    assert.deepEq(titles, [
          pageFffTitle_idea,
          // no: pageEeeTitle_prob_w_sol — solved
          pageDddTitle_prob_no_sol,
          // no: pageCccTitle_q_w_ans  — answered
          // no: pageBbbTitle_q_no_ans — got closed
          pageAaaTitle_disc]);
  });



  // ----- Excludes done ideas


  it("Memah goes to the idea topic", () => {
    memah_brA.go2('/' + pageFff_idea.slug);
  });

  it("... sets its done status to Done", () => {
    memah_brA.topic.setDoingStatus('Done');
  });

  it("Maria lists pages ...", () => {
    response = server.apiV0.listQuery<PageListed>({
      origin: siteIdAddress.origin,
      listQuery: listQueryWaitingTopicsSpecCat,
    }) as ListQueryResults<PageListed>;
  });

  it("She finds one less pages", () => {
    assert.eq(response.thingsFound.length, 6 - 2 - 1 - 1);
  });

  it("... namely all pages except for the unsolved problem and the discussion", () => {
    const titles = response.thingsFound.map(ts => ts.title);
    assert.deepEq(titles, [
          // pageFffTitle_idea — no, done
          // no: pageEeeTitle_prob_w_sol,
          pageDddTitle_prob_no_sol,
          // no: pageCccTitle_q_w_ans,
          // no: pageBbbTitle_q_no_ans, closed
          pageAaaTitle_disc]);
  });

});

