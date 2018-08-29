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

let forum: LargeTestForum;

let discussionPageUrl: string;

const mariasReplyOrig = 'mariasReplyOrig';
const mariasReplyEditedOnce = 'mariasReplyEditedOnce';
const mariasReplyEditedTwice = 'mariasReplyEditedTwice';

const marias2ndReplyOrig = 'marias2ndReplyOrig';

const mariasDirectMessageTitle = 'mariasDirectMessageTitle';
const mariasDirectMessageText = 'mariasDirectMessageText';


describe("drafts-chat-adv-ed  TyT7JKMW24", () => {

  it("import a site", () => {
    settings.debugEachStep = false;
    const builder = buildSite();
    forum = builder.addLargeForum({
      title: "Drafts E2E Test",
      members: ['maria', 'michael'],
    });
    builder.addPost({
      page: forum.topics.byMichaelCategoryA,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: mariasReplyOrig,
    });
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    discussionPageUrl = siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    richBrowserA = _.assign(browserA, pagesFor(browserA));
    richBrowserB = _.assign(browserB, pagesFor(browserB));

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    maria = forum.members.maria;
    mariasBrowser = richBrowserA;

    michael = forum.members.michael;
    michaelsBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });

  it("Maria and Michael goes to a forum topic", () => {
    everyonesBrowsers.go(discussionPageUrl);
  });

  it("Maria logs in", () => {
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });


  // ----- Drafts for edits: auto save X seconds, and Reactjs unmount-save

  it("Maria starts editing her reply to Michael  TyT5A2HSL8", () => {
    mariasBrowser.topic.clickEditoPostNr(c.FirstReplyNr);
    mariasBrowser.editor.waitForDraftTextToLoad(mariasReplyOrig); // well not a draft text
    mariasBrowser.editor.editText(mariasReplyEditedOnce);
  });

  it("... a draft gets auto saved", () => {
    mariasBrowser.editor.waitForDraftSaved();
  });

  it("She refreshes the page", () => {
    mariasBrowser.refresh();
  });

  it("... the edits are there, when she reopens the editor", () => {
    mariasBrowser.topic.clickEditoPostNr(c.FirstReplyNr);
    mariasBrowser.editor.waitForDraftTextToLoad(mariasReplyEditedOnce);
  });

  it("... she edits the text again", () => {
    mariasBrowser.editor.editText(mariasReplyEditedTwice);
  });

  it("... and closes the editor, this Reactjs unmount-saves", () => {
    mariasBrowser.editor.cancelNoHelp();
  });


  // ----- Drafts for replies, saved via beacon

  it("Maria starts typing another reply", () => {
    mariasBrowser.topic.clickReplyToOrigPost();
    mariasBrowser.editor.waitForDraftTextToLoad('');  // no draft text yet
    mariasBrowser.editor.editText(marias2ndReplyOrig);
  });

  it("... quickly reloads the page, the reply draft gets beacon-saved  TyT5ABKR20", () => {
    mariasBrowser.refresh();
  });

  it("... so she sees them, when she clicks reply again", () => {
    mariasBrowser.topic.clickReplyToOrigPost();
    mariasBrowser.editor.waitForDraftTextToLoad(marias2ndReplyOrig);
    mariasBrowser.editor.cancelNoHelp();
  });

  it("When she resumes editing her 1st reply", () => {
    mariasBrowser.topic.clickEditoPostNr(c.FirstReplyNr);
  });

  it("... she sees those edits, not the new 2nd reply", () => {
    mariasBrowser.editor.waitForDraftTextToLoad(mariasReplyEditedTwice);
    mariasBrowser.editor.cancelNoHelp();
  });


  // ----- Drafts for direct messages

  it("Maria starts typing a direct message to Michael", () => {
    mariasBrowser.pageTitle.openAboutAuthorDialog();
    mariasBrowser.aboutUserDialog.clickSendMessage();
    mariasBrowser.editor.editTitle(mariasDirectMessageTitle);
    mariasBrowser.editor.editText(mariasDirectMessageText);
  });


  // ----- Open drafts via drafts list ...

  it("Maria closes the editor", () => {
    mariasBrowser.editor.cancelNoHelp();
  });

  it("... and goes to her drafts list", () => {
    mariasBrowser.topbar.myMenu.goToDraftsEtc();
  });

  it("... sees three drafts: the edits, the new reply, and the direct message", () => {
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(3);
  });


  // ----- Open drafts via drafts list: Maria's direct message to Michael

  it("Internal: Reset hasAutoOpenedEditorFor, by refreshing page, so editor will auto-open", () => {
    mariasBrowser.refresh();
  });

  it("Maria clicks the most recent draft: the direct message to Michael", () => {
    mariasBrowser.userProfilePage.waitForName(maria.username);
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(3);
    mariasBrowser.userProfilePage.draftsEtc.openDraftIndex(1);
  });

  it("... the browser goes to Michael's profile page", () => {
    mariasBrowser.userProfilePage.waitForName(michael.username);
  });

  it("... and the draft text for the message to him, loads", () => {
    mariasBrowser.editor.waitForDraftTitleToLoad(mariasDirectMessageTitle);
    mariasBrowser.editor.waitForDraftTextToLoad(mariasDirectMessageText);
  });

  it("She posts the message", () => {
    mariasBrowser.editor.saveWaitForNewPage();
  });

  it("... goes back to the drafts list", () => {
    mariasBrowser.topbar.myMenu.goToDraftsEtc();
  });


  // ----- Open drafts via drafts list: Maria's 2nd reply

  it("Maria clicks the next most recent draft, for the new reply", () => {
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(2);
    mariasBrowser.userProfilePage.draftsEtc.openDraftIndex(1);
  });

  it("... the browser goes to Michaels topic", () => {
    mariasBrowser.assertPageTitleMatches(forum.topics.byMichaelCategoryA.title);
  });

  it("... the editor opens, with the draft reply text", () => {
    mariasBrowser.editor.waitForDraftTextToLoad(marias2ndReplyOrig);
  });

  it("... no title field", () => {
    assert(!mariasBrowser.editor.isTitleVisible());
  });

  it("She posts the reply", () => {
    mariasBrowser.editor.save();
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr + 1, marias2ndReplyOrig);
  });

  it("... goes back again to the drafts list", () => {
    mariasBrowser.topbar.myMenu.goToDraftsEtc();
  });


  // ----- Open drafts via drafts list: Maria's edits of her already submitted 1st reply

  it("Maria clicks the last draft, for the edits", () => {
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(1);
    mariasBrowser.userProfilePage.draftsEtc.openDraftIndex(1);
  });

  it("... the browser goes to Michaels topic", () => {
    mariasBrowser.assertPageTitleMatches(forum.topics.byMichaelCategoryA.title);
  });

  it("... the editor opens, with the edits she started typing", () => {
    mariasBrowser.editor.waitForDraftTextToLoad(mariasReplyEditedTwice);
  });

  it("... no title field", () => {
    assert(!mariasBrowser.editor.isTitleVisible());
  });

  it("She submits the edits", () => {
    mariasBrowser.editor.save();
  });

  it("The post text gets updated correctly", () => {
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, mariasReplyEditedTwice);
  });

  it("The posts have the correct contents, also after page refresh ()", () => {
    mariasBrowser.refresh();
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, mariasReplyEditedTwice);
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr + 1, marias2ndReplyOrig);
  });


  // ----- All drafts gone

  it("... goes back again to the drafts list", () => {
    mariasBrowser.topbar.myMenu.goToDraftsEtc();
  });

  it("... it is empty", () => {
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(0);
  });

});

