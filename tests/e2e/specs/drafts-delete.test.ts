/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare var browser: any;
//declare var browserA: any;
//declare var browserB: any;

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

let forum: LargeTestForum;

const chatPageTitle = "Chat Test Draft Test Test, for Test Test Testing Tests";
let chatPageUrl: string;
let discussionPageUrl: string;

const chatDraftToDelete = 'chatDraftToDelete';
const replyDraftToDelete = 'replyDraftToDelete';
const replyDraftToBeaconSaveDelete = 'replyDraftToBeaconSaveDelete';
const draftTopicTitleToDelete = 'draftTopicTitleToDelete';
const draftTopicTextToDelete = 'draftTopicTextToDelete';
const chatDraftToBeaconSaveDelete = 'chatDraftToBeaconSaveDelete';

describe("drafts-delete  TyT5BKRQ0", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addLargeForum({
      title: "Drafts E2E Test",
      members: ['maria', 'michael'],
    });
    const chatPage = builder.addPage({
      id: 'openChat',
      folder: '/',
      showId: false,
      slug: 'open-chat',
      role: c.TestPageRole.OpenChat,
      title: chatPageTitle,
      body: "I will test test the tests that the test tests needs to test so they get test tested " +
          "during the test test test testing test phase.",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.maria.id,
    });
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    chatPageUrl = siteIdAddress.origin + '/' + chatPage.slug;
    discussionPageUrl = siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    richBrowserA = everyonesBrowsers; //_.assign(browserA, pagesFor(browserA));
    //richBrowserB = _.assign(browserB, pagesFor(browserB));

    //owen = forum.members.owen;
    //owensBrowser = richBrowserA;
    maria = forum.members.maria;
    mariasBrowser = richBrowserA;

    //michael = forum.members.michael;
    //michaelsBrowser = richBrowserB;
    //strangersBrowser = richBrowserB;
  });

  it("Maria goes to the chat page", () => {
    mariasBrowser.go(chatPageUrl);
  });

  it("Maria logs in, joins the chat", () => {
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.chat.joinChat();
  });


  // ----- Create drafts to delete

  it("Maria starts typing a chat message", () => {
    mariasBrowser.chat.editChatMessage(chatDraftToDelete);
  });

  it("Then goes to Michael's topic", () => {
    mariasBrowser.go(discussionPageUrl);
  });

  it("Starsts writing a reply", () => {
    mariasBrowser.topic.clickReplyToOrigPost();
    mariasBrowser.editor.editText(replyDraftToDelete);
  });

  it("Goes to the topic list", () => {
    mariasBrowser.go('/');
  });

  it("Starts writing a new topic", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
    mariasBrowser.editor.editTitle(draftTopicTitleToDelete);
    mariasBrowser.editor.editText(draftTopicTextToDelete);
    mariasBrowser.editor.cancelNoHelp();
  });


  // ----- Check they exists

  it("Maria sees the drafts in her drafts list", () => {
    mariasBrowser.topbar.myMenu.goToDraftsEtc();
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(3);
  });


  // ----- Delete new topic draft: Wait for auto-delete after X seconds

  it("She opens the new topic draft", () => {
    mariasBrowser.userProfilePage.draftsEtc.openDraftIndex(1);
    mariasBrowser.editor.waitForDraftTitleToLoad(draftTopicTitleToDelete);
    mariasBrowser.editor.waitForDraftTextToLoad(draftTopicTextToDelete);
  });

  it("... and deletes all text, but not the title", () => {
    mariasBrowser.editor.editText('  ');
  });

  it("... cancels", () => {
    mariasBrowser.editor.cancelNoHelp();
  });

  it("Starts writing a new topic again", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
  });

  it("... the *title* is still there; the draft didn't get deleted", () => {
    mariasBrowser.editor.waitForDraftTitleToLoad(draftTopicTitleToDelete);
    mariasBrowser.editor.waitForDraftTextToLoad('');
  });

  it("... she deletes the title", () => {
    mariasBrowser.editor.editTitle('  ');
  });

  it("... so now the draft gets deleted", () => {
    mariasBrowser.editor.waitForDraftDeleted();
    mariasBrowser.editor.cancelNoHelp();
  });

  it("In the drafts list,", () => {
    mariasBrowser.topbar.myMenu.goToDraftsEtc();
  });

  it("... it's now gone", () => {
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(3 - 1);
  });


  // ----- Delete reply draft: Quick cancel click = Reactjs unmount

  it("She opens the reply draft", () => {
    mariasBrowser.userProfilePage.draftsEtc.openDraftIndex(1);
    mariasBrowser.editor.waitForDraftTextToLoad(replyDraftToDelete);
  });

  it("... and deletes all text", () => {
    mariasBrowser.editor.editText(' ');
  });

  it("... closes the editor — this deletes the draft, since it's now empty", () => {
    mariasBrowser.editor.cancelNoHelp();
  });

  it("When she starts replying again, the text is empty (draft gone)", () => {
    mariasBrowser.topic.clickReplyToOrigPost();
    mariasBrowser.editor.waitForDraftTextToLoad('');
  });

  it("She closes the editor", () => {
    mariasBrowser.editor.cancelNoHelp();
  });

  it("In the drafts list,", () => {
    mariasBrowser.topbar.myMenu.goToDraftsEtc();
  });

  it("... the draft is gone", () => {
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(3 - 2);
  });


  // ----- Delete reply draft: Refresh, beacon-deleted

  it("Starsts writing a reply, agin", () => {
    mariasBrowser.go(discussionPageUrl);
    mariasBrowser.topic.clickReplyToOrigPost();
    mariasBrowser.editor.editText(replyDraftToBeaconSaveDelete);
  });

  it("Jumps to her profile page drafts list — the draft gets beacon-saved", () => {
    mariasBrowser.userProfilePage.openDraftsEtcFor(maria.username);
  });

  it("The new 2nd reply-draft is there", () => {
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(3 - 2 + 1);
  });

  it("She opens it", () => {
    mariasBrowser.userProfilePage.draftsEtc.openDraftIndex(1);
    mariasBrowser.editor.waitForDraftTextToLoad(replyDraftToBeaconSaveDelete);
  });

  it("... and deletes all text, for this reply message too", () => {
    mariasBrowser.editor.editText(' ');
  });

  it("Jumps to her profile page drafts list — the reply draft gets beacon-deleted", () => {
    mariasBrowser.userProfilePage.openDraftsEtcFor(maria.username);
  });

  it("The new reply draft really is gone", () => {
    mariasBrowser.userProfilePage.draftsEtc.refreshUntilNumDraftsListed(3 - 2 + 1 - 1);
  });


  // ----- Delete chat draft: Wait for auto-delete after X seconds

  it("She opens the chat draft", () => {
    mariasBrowser.userProfilePage.draftsEtc.openDraftIndex(1);
    mariasBrowser.chat.waitForDraftChatMessageToLoad(chatDraftToDelete);
  });

  it("... and happily deletes all text", () => {
    mariasBrowser.chat.editChatMessage(' ');
  });

  it("... the draft gets auto deleted", () => {
    mariasBrowser.chat.waitForDraftDeleted();
  });

  it("When she refreshes", () => {
    mariasBrowser.refresh();
  });

  it("... the text is empty", () => {
    mariasBrowser.pause(500); // wait for any draft text to async load (should load nothing)
    mariasBrowser.chat.waitForDraftChatMessageToLoad('');
  });

  it("In the drafts list,", () => {
    mariasBrowser.topbar.myMenu.goToDraftsEtc();
  });

  it("... it's now gone", () => {
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(3 - 3);
  });


  // ----- Delete chat draft: Quickly leave page, deleted via beacon

  it("Maria returns to the chat page", () => {
    mariasBrowser.go(chatPageUrl);
  });

  it("... types a new chat draft", () => {
    mariasBrowser.chat.editChatMessage(chatDraftToBeaconSaveDelete);
  });

  it("Jumps to her profile page drafts list — the draft gets beacon-saved", () => {
    mariasBrowser.userProfilePage.openDraftsEtcFor(maria.username);
  });

  it("The new chat message is there", () => {
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(1);
  });

  it("She opens it", () => {
    mariasBrowser.userProfilePage.draftsEtc.openDraftIndex(1);
    mariasBrowser.chat.waitForDraftChatMessageToLoad(chatDraftToBeaconSaveDelete);
  });

  it("... and deletes all text, for this chat message too", () => {
    mariasBrowser.chat.editChatMessage(' ');
  });

  it("Jumps to her profile page drafts list — the draft gets beacon-deleted", () => {
    mariasBrowser.userProfilePage.openDraftsEtcFor(maria.username);
  });

  it("The new chat message is gone", () => {
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(0);
  });

  it("... it really is gone, also back on the chat page", () => {
    mariasBrowser.go(chatPageUrl);
    mariasBrowser.pause(500); // wait for any draft text to async load (should load nothing)
    mariasBrowser.chat.waitForDraftChatMessageToLoad('');
  });

});

