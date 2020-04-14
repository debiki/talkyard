/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');





let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

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

  it("import a site", () => {
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

    addOnePost(c.FirstReplyNr + 7, c.BodyNr, progrPostOne, PostType.BottomComment);

    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    discussionPageUrl = siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", () => {
    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
  });

  it("Owen logs in, views Maria's page", () => {
    owensBrowser.go(siteIdAddress.origin + '/' + forum.topics.byMariaCategoryA.slug);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    owensBrowser.disableRateLimits();
  });

  it("The page is empty", () => {
    owensBrowser.topic.assertNumRepliesVisible(0);
  });

  it("Copies the link to the OP", () => {
    owensBrowser.topic.openShareDialogForPostNr(c.BodyNr);
    owensBrowser.shareDialog.copyLinkToPost();
    owensBrowser.shareDialog.close();
  });

  it("Goes to the other topic, Michael's, with lots of posts", () => {
    owensBrowser.go('/' + forum.topics.byMichaelCategoryA.slug);
  });

  it("There are 7 discussion replies", () => {
    owensBrowser.topic.assertNumRepliesVisible(8  - 1);   // -1 progr note
  });

  it("Sees the posts in the initial order", () => {
    owensBrowser.topic.forAllPostIndexNrElem((index, nr) => {
      // Originally, all post got so that their post nr is also their position from the top.
      assert.equal(nr, index);
    })
  });

  it("Moves three replies to the first page, Maria's", () => {
    owensBrowser.topic.openMoveDialogForPostNr(c.FirstReplyNr + 3);
    owensBrowser.movePostDialog.pastePostLinkMoveToThere();
    owensBrowser.waitAndClick('.esStupidDlg a');
  });

  it("Now he's back on the first page", () => {
    owensBrowser.assertPageTitleMatches(forum.topics.byMariaCategoryA.title);
  });

  it("... and the posts are here", () => {
    owensBrowser.topic.assertNumRepliesVisible(3);
  });

  it("... in the correct order", () => {
    owensBrowser.topic.forAllPostIndexNrElem((index, nr) => {
      // Originally, all post got so that their post nr is also their position from the top.
      assert.equal(nr, index);
    });
  });

  it("He goes to the other topic, Michael's, again", () => {
    owensBrowser.go('/' + forum.topics.byMichaelCategoryA.slug);
  });

  it("The 3 posts that were moved, are now missing", () => {
    owensBrowser.topic.assertNumRepliesVisible(8 - 3   -1);   // -1 progr note
  });

  it("... the remaining posts, didn't get renumbered", () => {
    owensBrowser.topic.forAllPostIndexNrElem((index, nr) => {
      switch (index) {
        case 2:  assert.equal(nr, c.FirstReplyNr + 0);  break;
        case 3:  assert.equal(nr, c.FirstReplyNr + 1);  break;
        case 4:  assert.equal(nr, c.FirstReplyNr + 2);  break;
        // +3,4,5 were moved to Michael's page
        case 5:  assert.equal(nr, c.FirstReplyNr + 6);  break;   // <——————.   2nd OP reply
        case 6:  assert.equal(nr, c.FirstReplyNr + 7);  break;        //    |
      }                                                               //    |
    });                                                               //    |
  });                                                                 //    |
                                                                      //    |
  it("He copies the link to the 2nd OP reply", () => {                //    |
    owensBrowser.topic.openShareDialogForPostNr(c.FirstReplyNr + 6);  // ———`
    owensBrowser.shareDialog.copyLinkToPost();
    owensBrowser.shareDialog.close();
  });

  it("Returns to the first page, Maria's", () => {
    owensBrowser.go(siteIdAddress.origin + '/' + forum.topics.byMariaCategoryA.slug);
  });

  it("Moves the two last replies to that 2nd OP reply on the other page", () => {
    // The posts got renumbered, when previously moved to here. So the first one, is reply nr 0.
    owensBrowser.topic.openMoveDialogForPostNr(c.FirstReplyNr + 1);
    owensBrowser.movePostDialog.pastePostLinkMoveToThere();
    owensBrowser.waitAndClick('.esStupidDlg a');
  });

  it("Now he's on the 2nd page again", () => {
    owensBrowser.assertPageTitleMatches(forum.topics.byMichaelCategoryA.title);
  });

  it("Two posts are back", () => {
    owensBrowser.topic.assertNumRepliesVisible(8 - 3 + 2  - 1);   // -1 progr note
  });

  it("Now the two replies that were moved back, are instead after the 2nd OP reply", () => {
    // They got new post nrs, starting at the previous max post nr (c.FirstReplyNr + 7) + 1.
    owensBrowser.topic.forAllPostIndexNrElem((index, nr) => {
      switch (index) {
        case 2:  assert.equal(nr, c.FirstReplyNr + 0);  break; // <——————— the 1st OP reply
        case 3:  assert.equal(nr, c.FirstReplyNr + 1);  break;
        case 4:  assert.equal(nr, c.FirstReplyNr + 2);  break;
        case 5:  assert.equal(nr, c.FirstReplyNr + 6);  break; // <——————— the 2nd OP reply
        case 6:  assert.equal(nr, c.FirstReplyNr + 8);  break; // <———.
        case 7:  assert.equal(nr, c.FirstReplyNr + 9);  break; // <————\——— got new post nrs
        case 9:  assert.equal(nr, c.FirstReplyNr + 7);  break;
      }
    });
  });

});

