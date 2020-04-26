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
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;

const curiosityPageTitle = "What does curiosity have?";
const curiosityPageBody = "Curiosity has its own reason for existing";
const mariasReply = `
    Actually it was curiosity.
    Let me tell you some things about cats.
    Cats cannot fly — but still they like to climb to the top of the roof and trees.
    Cats like chimneys and warm electrical things.
    Cats like high wattage power cables.
    For cats, curiosity is dangerous`;


const wolfStaffPageTitle = "A wolf";
const wolfStaffPageBody = "I think there is a wild wolf in Michael's garden";

const wolfMessageTitle = "What shall we do";
const wolfMessageBody = "Michael, go and find the wolf? Look under the trees " +
    "and in the garage, the dark corners. Also, bring an extra much meat hamburger.";

const wolfChatTitle = "Wolf Chat";
const wolfChatBody = "Lets's talk about what the wolf should eat instead of cats";


describe("api-search-full-text.test.ts  TyT70ADNEFTD36", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
      members: ['alice', 'michael', 'maria', 'owen'],
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
      categoryId: forum.categories.specificCategory.id,
      authorId: forum.members.alice.id,
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

    builder.addPage({
      id: 'wolfStaffPageId',
      folder: '/',
      showId: false,
      slug: 'wolf-staff-page',
      role: c.TestPageRole.Discussion,
      title: wolfStaffPageTitle,
      body: wolfStaffPageBody,
      categoryId: forum.categories.staffOnlyCategory.id,
      authorId: forum.members.owen.id,
    });

    builder.getSite().isTestSiteIndexAnyway = true;

    assert.refEq(builder.getSite(), forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
  });

  it("initialize people", () => {
    const richBrowserA = new TyE2eTestBrowser(oneWdioBrowser);
    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    maria = forum.members.maria;
    mariasBrowser = richBrowserA;
  });


  // Show the site, so this spec becomes simpler to troubleshoot.
  it("Maria goes to the forum", () => {
    mariasBrowser.go2(siteIdAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  let response: SearchQueryResults<PageFound>;

  it("Maria searches for curiosity, until she finds the page and 3 posts", () => {
    // Wait for the server to be done indexing these new pages.
    utils.tryUntilTrue(`searching for 'curiosity'`, 'ExpBackoff', () => {
      response = server.apiV0.fullTextSearch<PageFound>({
          origin: siteIdAddress.origin, queryText: "curiosity" });
      return (
          response.thingsFound.length >= 1  &&
          response.thingsFound[0].postsFound.length >= 3);
    });
  });

  it("She found exactly one page", () => {
    assert.eq(response.thingsFound.length, 1);
  });


  let pageFound: PageFound;

  it("... it's the Curiosity page", () => {
    pageFound = response.thingsFound[0];
    assert.eq(pageFound.title, curiosityPageTitle);
  });

  let categoryFound: CategoryFound;

  it("... in the Specific category", () => {
    categoryFound = pageFound.categoriesMainFirst?.[0];
    assert.ok(categoryFound,
        `categoriesMainFirst missing or empty, page found: ${JSON.stringify(pageFound)}`);
    assert.eq(categoryFound.name, forum.categories.specificCategory.name);
  });

  it("... and Alice is the author", () => {
    assert.eq(pageFound.author?.fullName, forum.members.alice.fullName);
    assert.eq(pageFound.author?.username, forum.members.alice.username);
  });

  it("Maria follows the category link", () => {
    mariasBrowser.go2(categoryFound.urlPath);
  });

  it("... the link works: she sees the category name", () => {
    mariasBrowser.forumTopicList.waitForCategoryName(categoryFound.name);
  });

  it("... and the Curiosity topic", () => {
    mariasBrowser.forumTopicList.waitForTopicVisible(curiosityPageTitle);
  });

  it("... no other topics", () => {
    mariasBrowser.forumTopicList.assertNumVisible(1);
  });


  let titleFound: PostFound;
  let bodyFound: PostFound;
  let replyFound: PostFound;

  it("Alice's title, body and Maria's reply was found", () => {
    assert.eq(pageFound.postsFound.length, 3);

    titleFound = pageFound.postsFound.find((p: PostFound) => p.isPageTitle);
    bodyFound = pageFound.postsFound.find((p: PostFound) => p.isPageBody);
    replyFound = pageFound.postsFound.find((p: PostFound) => !p.isPageTitle && !p.isPageBody);

    assert.ok(titleFound);
    assert.not(titleFound.isPageBody);
    assert.ok(bodyFound);
    assert.not(bodyFound.isPageTitle);
    assert.ok(replyFound);
  });


  it("... and the word 'curiosity' was found in the title", () => {
    assert.eq(titleFound.htmlWithMarks.length, 1);
    assert.includes(titleFound.htmlWithMarks[0], 'curiosity');
  });

  it("... in the body", () => {
    assert.eq(bodyFound.htmlWithMarks.length, 1);
    assert.includes(bodyFound.htmlWithMarks[0], 'Curiosity');  // uppercase 'C'
  });

  it("... and twice in Maria's reply", () => {
    assert.eq(replyFound.htmlWithMarks.length, 2);
    assert.includes(replyFound.htmlWithMarks[0], 'curiosity');
    assert.includes(replyFound.htmlWithMarks[1], 'curiosity');
  });

  it("... highlighted with a '<mark>' tags", () => {
    const curiosityMarked = '<mark>curiosity</mark>';
    assert.includes(titleFound.htmlWithMarks[0], curiosityMarked);
    assert.includes(bodyFound.htmlWithMarks[0], curiosityMarked.replace('c', 'C'));
    assert.includes(replyFound.htmlWithMarks[0], curiosityMarked);
    assert.includes(replyFound.htmlWithMarks[1], curiosityMarked);
  });

  // What? Seems the title didn't get any author. Whatever — the page body is enough?
  //it("The authors are correct: Alice wrote the title", () => {
  //  assert.eq(titleFound.author?.fullName, forum.members.alice.fullName);
  //  assert.eq(titleFound.author?.username, forum.members.alice.username);
  //});

  it("The authors are correct: Alice wrote the page", () => {
    assert.eq(bodyFound.author?.fullName, forum.members.alice.fullName);
    assert.eq(bodyFound.author?.username, forum.members.alice.username);
  });

  it("... and Maria wrote the reply  TyT5086XJW2", () => {
    assert.eq(replyFound.author?.fullName, maria.fullName);
    assert.eq(replyFound.author?.username, maria.username);
  });

  it("Maria opens the page", () => {
    mariasBrowser.go2(pageFound.urlPath);
  });

  it("The title, body and reply are all there", () => {
    mariasBrowser.topic.waitForPostAssertTextMatches(c.TitleNr, curiosityPageTitle);
    mariasBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, curiosityPageBody);
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 2, "it was curiosity")
  });


  // ----- Private topics stay private   TyT60KTSJ35J

  it("Owen logs in", () => {
    mariasBrowser.topbar.clickLogout();
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("Owen sends a direct message to Michael   TyT5027KRUTP", () => {
    // Michael's reply is the first reply.
    owensBrowser.complex.sendMessageToPostNrAuthor(
        c.FirstReplyNr, wolfMessageTitle, wolfMessageBody);
  });

  it("Owen also creates a private chat  TyT602SKDL52", () => {
    owensBrowser.watchbar.openIfNeeded();
    owensBrowser.watchbar.clickCreateChat();
  });

  it("... about the wolf", () => {
    owensBrowser.editor.editTitle(wolfChatTitle);
    owensBrowser.editor.editText(wolfChatBody);
  });

  it("... makes it private", () => {
    owensBrowser.editor.setTopicType(c.TestPageRole.PrivateChat);
  });

  it("... submits", () => {
    owensBrowser.editor.saveWaitForNewPage();
  });

  it("Now owen searches for 'wolf'", () => {
    owensBrowser.topbar.searchFor('wolf');
  });

  it("... repeatedly until the server is done indexing", () => {
    // The Curiosity page,
    // the staff-only topic, id: 'wolfStaffPageId',
    // the direct message, title: wolfMessageTitle,
    // an the wolf chat, title: wolfChatTitle  — that's 4 topics.
    owensBrowser.searchResultsPage.searchForUntilNumPagesFound('wolf', 4);
  });

  function apiSearchForWolf(): SearchQueryResults<PageFound> {
    return server.apiV0.fullTextSearch<PageFound>({
        origin: siteIdAddress.origin, queryText: "wolf" });
  }

  it("But when Maria searches for 'wolf'", () => {
    // The server is done indexing already — Owen finds the topics when searching, see above.
    response = apiSearchForWolf();
  });

  it("... she finds only one page — the others are private / staff-only", () => {
    assert.eq(response.thingsFound.length, 1);
  });

  it(".. it's the Curiosity page", () => {
    assert.eq(response.thingsFound[0].title, curiosityPageTitle);
  });

  it(".. namely Owen's reply about the wolf", () => {
    const htmlWithMarks = response.thingsFound[0].postsFound[0].htmlWithMarks[0];
    // These should be in the same text-block-with-highlights:
    assert.includes(htmlWithMarks, '<mark>wolf</mark>');
    assert.includes(htmlWithMarks, 'very hungry');
  });


  // --- A bit dupl test code, fine. [60KADJF602]
  it("Owen makes the Staff category visible for Everyone: Goes to the Staff category", () => {
    owensBrowser.topbar.clickHome();
    owensBrowser.forumTopicList.switchToCategory(forum.categories.staffOnlyCategory.name);
  });
  it("... edits security settings", () => {
    owensBrowser.forumButtons.clickEditCategory();
    owensBrowser.categoryDialog.openSecurityTab();
  });
  it("... makes it public: adds the Everyone group  TyT69WKTEJG4", () => {
    owensBrowser.categoryDialog.securityTab.addGroup(c.EveryoneFullName);
  });
  it("... saves", () => {
    owensBrowser.categoryDialog.submit();
  });
  // ---

  it("Maria again searches for 'wolf'", () => {
    response = apiSearchForWolf();
  });

  it("... now she finds two pages", () => {
    assert.eq(response.thingsFound.length, 2);
  });

  it("... first, the previously staff-only topic — it's a better search match", () => {
    assert.eq(response.thingsFound[0].title, wolfStaffPageTitle);
  });

  it("... then, the Curiosity page", () => {
    assert.eq(response.thingsFound[1].title, curiosityPageTitle);
  });

});

