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


let maria: Member;
let mariasBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;  // or: LargeTestForum

const curiosityPageTitle = "What does curiosity have?";
const curiosityPageBody = "Curiosity has its own reason for existing";
const mariasReply = `
    Actually it was curiosity.
    Let me tell you some things about cats.
    Cats cannot fly — but still they like to climb to the top of the roof and trees.
    Cats like chimneys and electrical things.
    Cats like high wattage power cables.
    For cats, curiosity is dangerous`;


describe("some-e2e-test  TyT1234ABC", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({  // or: builder.addLargeForum
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });

    builder.addPost({
      page: forum.topics.byMichaelCategoryA,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "One two three many.",
    });

    const curiosityPage: PageJustAdded = builder.addPage({
      id: 'extraPageId',
      folder: '/',
      showId: false,
      slug: 'extra-page',
      role: c.TestPageRole.Discussion,
      title: curiosityPageTitle,
      body: curiosityPageBody,
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.maria.id,
    });

    builder.addPost({
      page: curiosityPage,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.michael.id,
      approvedSource: "But what killed my neighbor's cat?",
    });

    builder.addPost({
      page: curiosityPage,
      nr: c.FirstReplyNr + 1,
      parentNr: c.FirstReplyNr,
      authorId: forum.members.owen.id,
      approvedSource: "A wild wolf, very hungry, lives in your garden, and likes cats?",
    });

    builder.addPost({
      page: curiosityPage,
      nr: c.FirstReplyNr + 2,
      parentNr: c.FirstReplyNr + 1,
      authorId: forum.members.maria.id,
      approvedSource: mariasReply,
    });

    // Disable notifications, or notf email counts will be off (since Owen would get emails).
    builder.settings({ numFirstPostsToReview: 0, numFirstPostsToApprove: 0 });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    assert.refEq(builder.getSite(), forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
  });

  it("initialize people", () => {
    const richBrowserA = new TyE2eTestBrowser(oneWdioBrowser);
    maria = forum.members.maria;
    mariasBrowser = richBrowserA;
  });


  // Show the site, this spec becomes simpler to troubleshoot.
  it("Maria goes to the forum", () => {
    mariasBrowser.go2(siteIdAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  let response: SearchResultsApiResponse;

  it("Maria searches for curiosity, until she finds the page and 3 posts", () => {
    // Wait for the server to be done indexing these new pages.
    utils.tryUntilTrue(`searching for 'curiosity'`, 'ExpBackoff', () => {
      response = server.apiV0.fullTextSearch({
          origin: siteIdAddress.origin, queryText: "curiosity" });
      return (
          response.searchResults.length >= 1  &&
          response.searchResults[0].postHits.length >= 3);
    });
  });

  it("She found exactly one page", () => {
    assert.eq(response.searchResults.length, 1);
  });


  let pageAndHits:PageAndHits;

  it("... it's the Curiosity page", () => {
    pageAndHits = response.searchResults[0];
    assert.eq(pageAndHits.pageTitle, curiosityPageTitle);
  });


  let titleHit: PostHit;
  let bodyHit: PostHit;
  let replyHit: PostHit;

  it("The title, body and a reply was found", () => {
    assert.eq(pageAndHits.postHits.length, 3);

    titleHit = pageAndHits.postHits.find((ph: PostHit) => ph.isPageTitle);
    bodyHit = pageAndHits.postHits.find((ph: PostHit) => ph.isPageBody);
    replyHit = pageAndHits.postHits.find((ph: PostHit) => !ph.isPageTitle && !ph.isPageBody);

    assert.ok(titleHit.isPageTitle);
    assert.not(titleHit.isPageBody);

    assert.ok(bodyHit.isPageBody);
    assert.not(bodyHit.isPageTitle);

    assert.not(replyHit.isPageTitle);
    assert.not(replyHit.isPageBody);
  });


  it("... and the word 'curiosity' was found in the title", () => {
    assert.eq(titleHit.htmlWithMarks.length, 1);
    assert.includes(titleHit.htmlWithMarks[0], 'curiosity');
  });

  it("... in the body", () => {
    assert.eq(bodyHit.htmlWithMarks.length, 1);
    assert.includes(bodyHit.htmlWithMarks[0], 'Curiosity');  // uppercase 'C'
  });

  it("... and twice in Maria's reply", () => {
    assert.eq(replyHit.htmlWithMarks.length, 2);
    assert.includes(replyHit.htmlWithMarks[0], 'curiosity');
    assert.includes(replyHit.htmlWithMarks[1], 'curiosity');
  });

  it("... highlighted with a '<mark>' tag everywhere", () => {
    const curiosityMarked = '<mark>curiosity</mark>';
    assert.includes(titleHit.htmlWithMarks[0], curiosityMarked);
    assert.includes(bodyHit.htmlWithMarks[0], curiosityMarked.replace('c', 'C'));
    assert.includes(replyHit.htmlWithMarks[0], curiosityMarked);
    assert.includes(replyHit.htmlWithMarks[1], curiosityMarked);
  });


  it("Maria opens the page", () => {
    mariasBrowser.go2(pageAndHits.pageUrl);
  });

  it("The title, body and reply are all there", () => {
    mariasBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, curiosityPageTitle);
    mariasBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, curiosityPageBody);
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 2, "it was curiosity")
  });

});

