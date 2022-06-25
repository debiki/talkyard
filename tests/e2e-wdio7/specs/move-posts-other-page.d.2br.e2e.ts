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

describe("move posts  TyT7038286BR3", () => {

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

    assert.equal(c.FirstReplyNr + 3, theReplyToMoveNr);
    addOnePost(theReplyToMoveNr, c.FirstReplyNr + 2, discPostOneReplyReplyReply);

    addOnePost(c.FirstReplyNr + 4, c.FirstReplyNr + 3, discPostOneReplyReplyReplyReply);
    addOnePost(c.FirstReplyNr + 5, c.FirstReplyNr + 4, discPostOneReplyReplyReplyReplyReply);

    assert.equal(c.FirstReplyNr + 6, otherOpDiscReplyNr);
    addOnePost(otherOpDiscReplyNr, c.BodyNr, discPostTwo);

    addOnePost(c.FirstReplyNr + 7, c.BodyNr, progrPostOne, c.TestPostType.BottomComment);

    assert.eq(builder.getSite(), forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    discussionPageUrl = siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;
  });

  it("Owen logs in, views Maria's page", async () => {
    await owen_brA.go2(siteIdAddress.origin + '/' + forum.topics.byMariaCategoryA.slug);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
    await owen_brA.disableRateLimits();
  });

  it("The page is empty", async () => {
    await owen_brA.topic.assertNumRepliesVisible(0);
  });

  it("Copies the link to the OP", async () => {
    await owen_brA.topic.openShareDialogForPostNr(c.BodyNr);
    await owen_brA.shareDialog.copyLinkToPost();
    await owen_brA.shareDialog.close();
  });

  it("Goes to the other topic, Michael's, with lots of posts", async () => {
    await owen_brA.go2('/' + forum.topics.byMichaelCategoryA.slug);
  });

  it("There are 7 discussion replies", async () => {
    await owen_brA.topic.assertNumRepliesVisible(8  - 1);   // -1 progr note
  });

  it("Sees the posts in the initial order", async () => {
    await owen_brA.topic.forAllPostIndexNrElem(async (index, nr) => {
      // Originally, all post got so that their post nr is also their position from the top.
      assert.eq(nr, index);
    })
  });

  it("Moves three replies to the first page, Maria's", async () => {
    await owen_brA.topic.openMoveDialogForPostNr(c.FirstReplyNr + 3);
    await owen_brA.movePostDialog.pastePostLinkMoveToThere();
    await owen_brA.waitAndClick('.esStupidDlg a');
  });

  it("Now he's back on the first page", async () => {
    await owen_brA.assertPageTitleMatches(forum.topics.byMariaCategoryA.title);
  });

  it("... and the posts are here", async () => {
    await owen_brA.topic.assertNumRepliesVisible(3);
  });

  it("... in the correct order", async () => {
    await owen_brA.topic.forAllPostIndexNrElem(async (index, nr) => {
      // Originally, all post got so that their post nr is also their position from the top.
      assert.eq(nr, index);
    });
  });

  it("He goes to the other topic, Michael's, again", async () => {
    await owen_brA.go2('/' + forum.topics.byMichaelCategoryA.slug);
  });

  it("The 3 posts that were moved, are now missing", async () => {
    await owen_brA.topic.assertNumRepliesVisible(8 - 3   -1);   // -1 progr note
  });

  it("... the remaining posts, didn't get renumbered", async () => {
    await owen_brA.topic.forAllPostIndexNrElem(async (index, nr) => {
      switch (index) {
        case 2:  assert.eq(nr, c.FirstReplyNr + 0);  break;
        case 3:  assert.eq(nr, c.FirstReplyNr + 1);  break;
        case 4:  assert.eq(nr, c.FirstReplyNr + 2);  break;
        // +3,4,5 were moved to Michael's page
        case 5:  assert.eq(nr, c.FirstReplyNr + 6);  break;        // <—————––––—.  2nd OP reply
        case 6:  assert.eq(nr, c.FirstReplyNr + 7);  break;        //             |
      }                                                            //             |
    });                                                            //             |
  });                                                              //             |
                                                                   //             |
  it("He copies the link to the 2nd OP reply", async () => {                //    |
    await owen_brA.topic.openShareDialogForPostNr(c.FirstReplyNr + 6);  // ———`
    await owen_brA.shareDialog.copyLinkToPost();
    await owen_brA.shareDialog.close();
  });

  it("Returns to the first page, Maria's", async () => {
    await owen_brA.go2(siteIdAddress.origin + '/' + forum.topics.byMariaCategoryA.slug);
  });

  it("Moves the two last replies to that 2nd OP reply on the other page", async () => {
    // The posts got renumbered, when previously moved to here. So the first one, is reply nr 0.
    await owen_brA.topic.openMoveDialogForPostNr(c.FirstReplyNr + 1);
    await owen_brA.movePostDialog.pastePostLinkMoveToThere();
    await owen_brA.waitAndClick('.esStupidDlg a');
  });

  it("Now he's on the 2nd page again", async () => {
    await owen_brA.assertPageTitleMatches(forum.topics.byMichaelCategoryA.title);
  });

  it("Two posts are back", async () => {
    await owen_brA.topic.assertNumRepliesVisible(8 - 3 + 2  - 1);   // -1 progr note
  });

  it("Now the two replies that were moved back, are instead after the 2nd OP reply", async () => {
    // They got new post nrs, starting at the previous max post nr (c.FirstReplyNr + 7) + 1.
    await owen_brA.topic.forAllPostIndexNrElem(async (index, nr) => {
      switch (index) {
        case 2:  assert.eq(nr, c.FirstReplyNr + 0);  break; // <——————— the 1st OP reply
        case 3:  assert.eq(nr, c.FirstReplyNr + 1);  break;
        case 4:  assert.eq(nr, c.FirstReplyNr + 2);  break;
        case 5:  assert.eq(nr, c.FirstReplyNr + 6);  break; // <——————— the 2nd OP reply
        case 6:  assert.eq(nr, c.FirstReplyNr + 8);  break; // <———.
        case 7:  assert.eq(nr, c.FirstReplyNr + 9);  break; // <————\——— got new post nrs
        case 9:  assert.eq(nr, c.FirstReplyNr + 7);  break;
      }
    });
  });

});

