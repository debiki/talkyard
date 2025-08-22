/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';


let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;

const localHostname = 'comments-for-e2e-test-scrlld';
const embeddingOrigin = 'http://e2e-test-scrlld.localhost:8080';

const newAddCommentBtnTitle = 'newAddCommentBtnTitle';

let veryLastPostNr: PostNr | U;


describe("embcom.sort-order-op-likes-btn-txt.2br.ec  TyTEMBSORTLIKETXT", () => {

  it("import a site", async () => {
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

    siteIdAddress = await server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
  });

  it("initialize people", async () => {
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

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

  it("There's an embedding page", async () => {
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

  it("A stranger arrives", async () => {
    await strangersBrowser.go2(embeddingOrigin + '/' + pageSlug);
  });

  it("Comments are sorted best-first", async () => {
    await strangersBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
  });

  it("Maria arrives, and Like-upvotes #comment-9 = #post-10", async () => {
    await mariasBrowser.topic.toggleLikeVote(10, { logInAs: maria });
  });

  it("... and its 2rd = middle reply,  #comment-11 = #post-12", async () => {
    // This click can fail, maybe because scrolls then clicks? So toggleLikeVote()
    // tries more than once. [E2ECLICK03962]
    await mariasBrowser.topic.toggleLikeVote(12);
  });

  it("After reload, those are first, since Best Fist is default sort order", async () => {
    await mariasBrowser.refresh2();
    await mariasBrowser.topic.assertPostOrderIs([
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


  it("Owen logs in to admin area, ... ", async () => {
    await owensBrowser.adminArea.interface.goHere(siteIdAddress.origin, { loginAs: owen });
  });

  it("Owen changes the comments sort order to Newest First  TyTEMBNEWEST1ST", async () => {
    await owensBrowser.adminArea.interface.setSortOrder(2);
  });

  it("... and the 'Add Comment' button title  TyTCOMTBTNTTL", async () => {
    await owensBrowser.adminArea.interface.setAddCommentBtnTitle(newAddCommentBtnTitle);
  });

  it("... and the disables like votes", async () => {
    await owensBrowser.adminArea.interface.setBlogPostLikeVotes(1);
  });

  it("... saves", async () => {
    await owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("For Maria, the reply button title is still 'Add Comment'", async () => {
    await mariasBrowser.switchToEmbCommentsIframeIfNeeded();
    await mariasBrowser.waitAndAssertVisibleTextMatches(
        '.dw-ar-t > .dw-p-as > .dw-a-reply', "Add Comment");
  });

  it("... and she can Like-upvote the blog post", async () => {
    await mariasBrowser.switchToEmbCommentsIframeIfNeeded();
    assert.ok(await mariasBrowser.isVisible('.dw-ar-t > .dw-p-as .dw-a-like'));
  });

  it("Maria reloads the page", async () => {
    await mariasBrowser.refresh2();
  });

  it("... the reply button got renamed ", async () => {
    await mariasBrowser.switchToEmbCommentsIframeIfNeeded();
    await mariasBrowser.waitAndAssertVisibleTextMatches(
        '.dw-ar-t > .dw-p-as > .dw-a-reply', newAddCommentBtnTitle);
  });

  it("... and blog post Like votes disabled", async () => {
    await mariasBrowser.switchToEmbCommentsIframeIfNeeded();
    assert.not(await mariasBrowser.isVisible('.dw-ar-t > .dw-p-as .dw-a-like'));
  });


  it("Maria goes to another page", async () => {
    await mariasBrowser.go2(embeddingOrigin + '/' + blankSlug);
  });

  /*
  it("... the reply button is renamed here too  NO because BUG  [04MDKG356]", async () => {
    await mariasBrowser.switchToEmbCommentsIframeIfNeeded();
    await mariasBrowser.waitAndAssertVisibleTextMatches(
        '.dw-ar-t > .dw-p-as > .dw-a-reply', newAddCommentBtnTitle);
  });

  it("... and blog post Like votes are disabled here too  NO, BUG  [04MDKG356]", async () => {
    await mariasBrowser.switchToEmbCommentsIframeIfNeeded();
    assert.not(await mariasBrowser.isVisible('.dw-ar-t > .dw-p-as .dw-a-like'));
  }); */


  it("Marria returns to the page with comments", async () => {
    await mariasBrowser.go2(embeddingOrigin + '/' + pageSlug);
  });

  it("the sort order is now newest first", async () => {
    await mariasBrowser.topic.assertPostOrderIs([
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


  it("Maria adds a comment", async () => {
    // Wait until Maria's data added, so we're logged in when clicking Reply.
    await mariasBrowser.switchToEmbeddedCommentsIrame(); // (already done, but nice if debugging)
    await mariasBrowser.metabar.waitUntilLoggedIn();
    await mariasBrowser.complex.replyToEmbeddingBlogPost("Hi I am here");
  });

  it("... it appears", async () => {
    await mariasBrowser.topic.waitForPostAssertTextMatches(veryLastPostNr + 1, "Hi I am here");
  });

  it("... and it's first, since Newest First sort order", async () => {
    await mariasBrowser.topic.assertPostOrderIs([
        // Maria's new comment:
        veryLastPostNr + 1,
        // The last Orig Post reply, and its children;
        veryLastPostNr - 3,
        veryLastPostNr - 0, veryLastPostNr - 1, veryLastPostNr - 2]);
  });

  it("... also alfter reload", async () => {
    await mariasBrowser.refresh2();
    await mariasBrowser.topic.assertPostOrderIs([
        veryLastPostNr + 1,
        veryLastPostNr - 3,
        veryLastPostNr - 0, veryLastPostNr - 1, veryLastPostNr - 2]);
  });

  it("Owen changes sort order back to Best First", async () => {
    await owensBrowser.adminArea.interface.setSortOrder(1);
  });

  it("... saves", async () => {
    await owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("Now the upvoted comments are instead first", async () => {
    await mariasBrowser.refresh2();
    await mariasBrowser.topic.assertPostOrderIs([
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

