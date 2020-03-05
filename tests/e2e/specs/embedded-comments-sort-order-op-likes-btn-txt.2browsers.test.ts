/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');

declare const $$: any; // webdriver.io global utility

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

let everyonesBrowsers;
let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser;
let maria: Member;
let mariasBrowser;
let michael: Member;
let michaelsBrowser;
let strangersBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;

const localHostname = 'comments-for-e2e-test-scrlld-localhost-8080';
const embeddingOrigin = 'http://e2e-test-scrlld.localhost:8080';

const newAddCommentBtnTitle = 'newAddCommentBtnTitle';

let veryLastPostNr;


describe("emb-cmts-scroll-load-post  TyT603MRKH592S", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Emb Cmts Scroll Load Posts E2E Test",
      members: undefined, // default = everyone
    });

    let nextNr = c.FirstReplyNr;

    for (let i = 1; i <= 30; ++i) {
      builder.addPost({
        page: forum.topics.byMichaelCategoryA,
        nr: nextNr,
        parentNr: c.BodyNr,  // or 'undefined'?  blog comments has no parent post?
        authorId: forum.members.michael.id,
        approvedSource: `This is #comment-${nextNr -1} = post ${nextNr}, depth 0`,
      });

      const parentNr = nextNr;
      nextNr += 1;

      for (let j = 1; j <= 3; ++j) {
        builder.addPost({
          page: forum.topics.byMichaelCategoryA,
          nr: nextNr,
          parentNr,
          authorId: forum.members.michael.id,
          approvedSource: `This is #comment-${nextNr -1} = #post-${nextNr}, depth 1`,
        });
        nextNr += 1;
      }
    }

    veryLastPostNr = nextNr - 1;

    assert.refEq(builder.getSite(), forum.siteData);

    const michaelsPage = _.find(
        forum.siteData.pages, p => p.id === forum.topics.byMichaelCategoryA.id);
    michaelsPage.role = c.TestPageRole.EmbeddedComments;

    forum.siteData.meta.localHostname = localHostname;
    forum.siteData.settings.allowEmbeddingFrom = embeddingOrigin;
    forum.siteData.settings.enableForum = false;

    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
  });

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    richBrowserA = _.assign(browserA, pagesFor(browserA));
    richBrowserB = _.assign(browserB, pagesFor(browserB));

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    michael = forum.members.michael;
    michaelsBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });

  const pageSlug = 'load-and-scroll.html';
  const blankSlug = 'blank.html';

  it("There's an embedding page", () => {
    const dir = 'target';

    fs.writeFileSync(
        `${dir}/${pageSlug}`,
        makeHtml(pageSlug, '#554', forum.topics.byMichaelCategoryA.id));

    fs.writeFileSync(
        `${dir}/${blankSlug}`,
        makeHtml(blankSlug, '#455'));

    function makeHtml(pageName, bgColor, talkyardPageId?): string {
      return utils.makeEmbeddedCommentsHtml({
          pageName, talkyardPageId, localHostname, bgColor});
    }
  });

  it("A stranger arrives", () => {
    strangersBrowser.go2(embeddingOrigin + '/' + pageSlug);
  });

  it("Comments are sorted best-first", () => {
    strangersBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
  });

  it("Maria arrives, and Like-upvotes #comment-9 = #post-10", () => {
    mariasBrowser.topic.toggleLikeVote(10, { logInAs: maria });

  });

  it("... and its 2rd = middle reply,  #comment-11 = #post-12", () => {
    mariasBrowser.topic.toggleLikeVote(12);
  });

  it("After reload, those are first, since Best Fist is default sort order", () => {
    mariasBrowser.refresh2();
    mariasBrowser.topic.assertPostOrderIs([
        10,  // Like voted OP reply
        12,  // Like voted reply-reply
        11,  // Reply-reply sorted by time
        13,  //     – "" –
        // Then, no votes — sorted by time:
         2, 3, 4, 5, 6, 7, 8, 9,
        // 10..13 got Like-votes, and are at the top.
        // Then by time again:
        14, 15, 16, 17, 18]);
  });


  it("Owen logs in to admin area, ... ", () => {
    owensBrowser.adminArea.interface.goHere(siteIdAddress.origin, { loginAs: owen });
  });

  it("Owen changes the comments sort order to Newest First", () => {
    owensBrowser.adminArea.interface.setSortOrder(2);
  });

  it("... and the 'Add Comment' button title", () => {
    owensBrowser.adminArea.interface.setAddCommentBtnTitle(newAddCommentBtnTitle);
  });

  it("... and the disables like votes", () => {
    owensBrowser.adminArea.interface.setBlogPostLikeVotes(1);
  });

  it("... saves", () => {
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("For Maria, the reply button title is still 'Add Comment'", () => {
    mariasBrowser.switchToEmbCommentsIframeIfNeeded();
    mariasBrowser.waitAndAssertVisibleTextMatches(
        '.dw-ar-t > .dw-p-as > .dw-a-reply', "Add Comment");
  });

  it("... and she can Like-upvote the blog post", () => {
    mariasBrowser.switchToEmbCommentsIframeIfNeeded();
    assert.ok(mariasBrowser.isVisible('.dw-ar-t > .dw-p-as .dw-a-like'));
  });

  it("Maria reloads the page", () => {
    mariasBrowser.refresh2();
  });

  it("... the reply button got renamed ", () => {
    mariasBrowser.switchToEmbCommentsIframeIfNeeded();
    mariasBrowser.waitAndAssertVisibleTextMatches(
        '.dw-ar-t > .dw-p-as > .dw-a-reply', newAddCommentBtnTitle);
  });

  it("... and blog post Like votes disabled", () => {
    mariasBrowser.switchToEmbCommentsIframeIfNeeded();
    assert.not(mariasBrowser.isVisible('.dw-ar-t > .dw-p-as .dw-a-like'));
  });


  it("Maria goes to another page", () => {
    mariasBrowser.go2(embeddingOrigin + '/' + blankSlug);
  });

  /*
  it("... the reply button is renamed here too  NO because BUG  [04MDKG356]", () => {
    mariasBrowser.switchToEmbCommentsIframeIfNeeded();
    mariasBrowser.waitAndAssertVisibleTextMatches(
        '.dw-ar-t > .dw-p-as > .dw-a-reply', newAddCommentBtnTitle);
  });

  it("... and blog post Like votes are disabled here too  NO, BUG  [04MDKG356]", () => {
    mariasBrowser.switchToEmbCommentsIframeIfNeeded();
    assert.not(mariasBrowser.isVisible('.dw-ar-t > .dw-p-as .dw-a-like'));
  }); */


  it("Marria returns to the page with comments", () => {
    mariasBrowser.go2(embeddingOrigin + '/' + pageSlug);
  });

  it("the sort order is now newest first", () => {
    mariasBrowser.refresh2();
    mariasBrowser.topic.assertPostOrderIs([
        // The last Orig Post reply:
        veryLastPostNr - 3,
        // Its children were posted later, so they have higher post nrs,
        // but are placed below, since in a sub thread:
        veryLastPostNr - 0, veryLastPostNr - 1, veryLastPostNr - 2,

        // The 2nd last orig post, and child replies:
        veryLastPostNr - 3 - 4,
        veryLastPostNr - 0 - 4, veryLastPostNr - 1 - 4, veryLastPostNr - 2 - 4,

        // The 3rd last:
        veryLastPostNr - 3 - 8,
        veryLastPostNr - 0 - 8, veryLastPostNr - 1 - 8, veryLastPostNr - 2 - 8,
      ]);
  });


  it("Maria adds a comment", () => {
    mariasBrowser.complex.replyToEmbeddingBlogPost("Hi I am here");
  });

  it("... it appears", () => {
    mariasBrowser.topic.waitForPostAssertTextMatches(veryLastPostNr + 1, "Hi I am here");
  });

  it("... and it's first, since Newest First sort order", () => {
    mariasBrowser.topic.assertPostOrderIs([
        // Maria's new comment:
        veryLastPostNr + 1,
        // The last Orig Post reply, and its children;
        veryLastPostNr - 3,
        veryLastPostNr - 0, veryLastPostNr - 1, veryLastPostNr - 2]);
  });

  it("... also alfter reload", () => {
    mariasBrowser.refresh2();
    mariasBrowser.topic.assertPostOrderIs([
        veryLastPostNr + 1,
        veryLastPostNr - 3,
        veryLastPostNr - 0, veryLastPostNr - 1, veryLastPostNr - 2]);
  });

  it("Owen changes sort order back to Best First", () => {
    owensBrowser.adminArea.interface.setSortOrder(1);
  });

  it("... saves", () => {
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("Now the upvoted comments are instead first", () => {
    mariasBrowser.refresh2();
    mariasBrowser.topic.assertPostOrderIs([
        10,  // Like voted OP reply
        12,  // Like voted reply-reply
        11,  // Reply-reply sorted by time
        13,  //     – "" –
        // Then, no votes — sorted by time:
         2, 3, 4, 5, 6, 7, 8, 9,
        // 10..13 got Like-votes, are at the top.
        14, 15, 16, 17, 18]);
  });

});

