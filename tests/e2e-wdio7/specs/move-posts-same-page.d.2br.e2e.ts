/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;

let siteIdAddress: IdAddress;

let forum: TwoPagesTestForum;

let discussionPageUrl: string;

const discPostOne = 'discPostOne';
const discPostOneReply = 'discPostOneReply';
const discPostOneReplyReply = 'discPostOneReplyReply';
const discPostOneReplyReplyReply = 'discPostOneReplyReplyReply';
const discPostOneReplyReplyReplyReply = 'discPostOneReplyReplyReplyReply';
const discPostOneReplyReplyReplyReplyReply = 'discPostOneReplyReplyReplyReplyReply';
const discPostTwo = 'discPostTwo';
const progrPostOne = 'progrPostOne';

const theReplyToMoveNr = c.FirstReplyNr + 3;
const otherOpDiscReplyNr = c.FirstReplyNr + 6;

describe("move posts  TyT03946HET3", () => {

  it("import a site", async () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });
    function addOnePost(nr: PostNr, parentNr: PostNr, text: string, postType?: PostType) {
      builder.addPost({
        page: forum.topics.byMichaelCategoryA,
        nr,
        parentNr,
        authorId: forum.members.michael.id,
        approvedSource: text,
        postType: postType,
      });
    }
    addOnePost(c.FirstReplyNr + 0, c.BodyNr, discPostOne);
    addOnePost(c.FirstReplyNr + 1, c.FirstReplyNr + 0, discPostOneReply);
    addOnePost(c.FirstReplyNr + 2, c.FirstReplyNr + 1, discPostOneReplyReply);

    assert.eq(c.FirstReplyNr + 3, theReplyToMoveNr);
    addOnePost(theReplyToMoveNr, c.FirstReplyNr + 2, discPostOneReplyReplyReply);

    addOnePost(c.FirstReplyNr + 4, c.FirstReplyNr + 3, discPostOneReplyReplyReplyReply);
    addOnePost(c.FirstReplyNr + 5, c.FirstReplyNr + 4, discPostOneReplyReplyReplyReplyReply);

    assert.eq(c.FirstReplyNr + 6, otherOpDiscReplyNr);
    addOnePost(otherOpDiscReplyNr, c.BodyNr, discPostTwo);

    addOnePost(c.FirstReplyNr + 7, c.BodyNr, progrPostOne, c.TestPostType.BottomComment);

    assert.refEq(builder.getSite(), forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    discussionPageUrl = siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;
    maria = forum.members.maria;
    maria_brB = brB;
  });

  it("Owen logs in", async () => {
    await owen_brA.go2(siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
    await owen_brA.disableRateLimits();
  });

  it("Sees the posts in the initial order", async () => {
    await owen_brA.topic.forAllPostIndexNrElem(async (index, nr) => {
      // Originally, all post got so that their post nr is also their position from the top.
      assert.eq(nr, index);
    })
  });

  it("Copies the link to the 2nd OP discussion reply (the one without any replies)", async () => {
    await owen_brA.topic.openShareDialogForPostNr(otherOpDiscReplyNr);
    await owen_brA.shareDialog.copyLinkToPost();
    await owen_brA.shareDialog.close();
  });

  it(`Post ${theReplyToMoveNr} is not below ${otherOpDiscReplyNr}`, async () => {
    // This tests the test.  (062TADH46)
    assert.not(
        await owen_brA.topic.isPostNrDescendantOf(
          theReplyToMoveNr, otherOpDiscReplyNr));
  });

  it("Moves three replies to the other discussion OP reply: 1) Opens Move dialog", async () => {
    await owen_brA.topic.openMoveDialogForPostNr(c.FirstReplyNr + 3);
  });

  it("... and 2) fills in destination, clicks Move", async () => {
    await owen_brA.movePostDialog.pastePostLinkMoveToThere();
  });

  it("Now the replies appear below OP reply 2 (instead of above)", async () => {
    // Wait until the post we moved, appears below the other Orig Post reply.
    // Might need to refresh a few times — otherwise, the page reloads
    // before the server is done moving the post.
    await owen_brA.refreshUntil(async () => {
      // Test tested above, (062TADH46).
      return await owen_brA.topic.isPostNrDescendantOf(theReplyToMoveNr, otherOpDiscReplyNr);
    });

    // Wait until all posts have appeared:
    await owen_brA.topic.waitForPostNrVisible(c.FirstReplyNr + 7);
    await verifyAfterFirstMoveOrder();
  });

  async function verifyAfterFirstMoveOrder() {
    await owen_brA.topic.forAllPostIndexNrElem(async (index, nr) => {
      switch (index) {
        case 2:  assert.eq(nr, c.FirstReplyNr + 0);  break;
        case 3:  assert.eq(nr, c.FirstReplyNr + 1);  break;
        case 4:  assert.eq(nr, c.FirstReplyNr + 2);  break;
        case 5:  assert.eq(nr, c.FirstReplyNr + 6);  break; //          <———————.  ...this one
        case 6:  assert.eq(nr, c.FirstReplyNr + 3);  break; // These were...     |  = otherOpDiscReplyNr
        case 7:  assert.eq(nr, c.FirstReplyNr + 4);  break; // ...moved to       |
        case 8:  assert.eq(nr, c.FirstReplyNr + 5);  break; // ...children of ---`
        case 9:  assert.eq(nr, c.FirstReplyNr + 7);  break;
      }
    })
  }

  it("Moves the three first replies to the Progress section: 1) Opens Move dialog", async () => {
    await owen_brA.topic.openMoveDialogForPostNr(c.FirstReplyNr + 0);
  });

  it("... and 2)  , clicks Move", async () => {
    await owen_brA.movePostDialog.moveToOtherSection();
  });

  it("Now the first 3 replies are instead first in the Progress section", async () => {
    await owen_brA.topic.forAllPostIndexNrElem(async (index, nr) => {
      switch (index) {
        case 2:  assert.eq(nr, c.FirstReplyNr + 6);  break;
        case 3:  assert.eq(nr, c.FirstReplyNr + 3);  break;
        case 4:  assert.eq(nr, c.FirstReplyNr + 4);  break;
        case 5:  assert.eq(nr, c.FirstReplyNr + 5);  break;
        case 6:  assert.eq(nr, c.FirstReplyNr + 0);  break; // <———.
        case 7:  assert.eq(nr, c.FirstReplyNr + 1);  break; // <————\——— were previously at the top
        case 8:  assert.eq(nr, c.FirstReplyNr + 2);  break; // <————/
        case 9:  assert.eq(nr, c.FirstReplyNr + 7);  break;
      }
    });
  });

  it("Owen moves them back: 1) Opens Move dialog", async () => {
    await owen_brA.topic.openMoveDialogForPostNr(c.FirstReplyNr + 0);
  });

  it("... and 2) clicks Move To Other Section", async () => {
    await owen_brA.movePostDialog.moveToOtherSection();
  });

  it("Now the firs replies appear first again", async () => {
    await verifyAfterFirstMoveOrder();
  });

});

