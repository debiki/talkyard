
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

const mariasDraftTopicTitleOrig = 'mariasDraftTopicTitleOrig';
const mariasDraftTopicTitleEditedOnce = 'mariasDraftTopicTitleEditedOnce';
const mariasDraftTopicTextOrig = 'mariasDraftTopicTextOrig';
const mariasDraftTopicTextEditedOnce = 'mariasDraftTopicTextEditedOnce';

const mariasDraftReplyOrig = 'mariasDraftReplyOrig';
const mariasDraftReplyEditedWhenLoggedIn = 'mariasDraftReplyEditedWhenLoggedIn';

const michaelsDraftReplyOrig = 'michaelsDraftReplyOrig';


describe("drafts-not-logged-in  TyT2ABSD73", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addLargeForum({
      title: "Drafts E2E Test",
      members: ['maria', 'michael'],
    });
    assert(builder.getSite() === forum.siteData);
    builder.getSite().settings.requireVerifiedEmail = false;
    builder.getSite().settings.mayComposeBeforeSignup = true;
    builder.getSite().settings.mayPostBeforeEmailVerified = true;
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;

    discussionPageUrl = siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    richBrowserA = _.assign(browserA, pagesFor(browserA));
    richBrowserB = _.assign(browserB, pagesFor(browserB));

    maria = forum.members.maria;
    mariasBrowser = richBrowserA;
    michael = forum.members.michael;
    michaelsBrowser = richBrowserB;
  });

  it("Maria arrives", () => {
    mariasBrowser.go(siteIdAddress.origin);
  });


  // ----- Beacon save, new topic

  it("... starts typing a topic, without logging in", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
    mariasBrowser.editor.editTitle(mariasDraftTopicTitleOrig);
    mariasBrowser.editor.editText(mariasDraftTopicTextOrig);
  });

  it("She refreshes the page; this saves a draft, in the temp sessionStorage", () => {
    mariasBrowser.refresh();
  });

  it("... starts typing a topic again", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
  });

  it("... the saved text reappears", () => {
    mariasBrowser.editor.waitForDraftTitleToLoad(mariasDraftTopicTitleOrig);
    mariasBrowser.editor.waitForDraftTextToLoad(mariasDraftTopicTextOrig);
  });


  // ----- Reactjs unmount save, new topic

  it("Maria edits the topic", () => {
    mariasBrowser.editor.editTitle(mariasDraftTopicTitleEditedOnce);
    mariasBrowser.editor.editText(mariasDraftTopicTextEditedOnce);
  });

  it("... closes the editor — this saves a draft, although she isn't logged in", () => {
    mariasBrowser.editor.cancelNoHelp();
  });

  it("... refreshes the page", () => {
    mariasBrowser.refresh();
  });

  it("She starts typing again", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
  });

  it("... the saved edits then appear", () => {
    mariasBrowser.editor.waitForDraftTitleToLoad(mariasDraftTopicTitleEditedOnce);
    mariasBrowser.editor.waitForDraftTextToLoad(mariasDraftTopicTextEditedOnce);
  });


  // ----- Beacon save, a reply

  it("Maria and Michael goes to a forum topic", () => {
    everyonesBrowsers.go(discussionPageUrl);
  });

  it("Maria starts typing a reply", () => {
    mariasBrowser.topic.clickReplyToOrigPost();
    mariasBrowser.editor.waitForDraftTextToLoad('');  // no draft text yet
    mariasBrowser.editor.editText(mariasDraftReplyOrig);
  });

  it("... reloads the page, the reply draft gets beacon-saved", () => {
    mariasBrowser.refresh();
  });

  it("... so she sees it, when she clicks Reply again", () => {
    mariasBrowser.topic.clickReplyToOrigPost();
    mariasBrowser.editor.waitForDraftTextToLoad(mariasDraftReplyOrig);
  });


  // ----- Not-logged-in drafts are private, per browser

  it("Michael doesn't see Maria's draft, when he too starts typing a reply", () => {
    michaelsBrowser.topic.clickReplyToOrigPost();
    michaelsBrowser.editor.waitForDraftTextToLoad('');  // no draft text yet
  });


  // ----- Unmount save, a reply

  it("... he types a draft reply", () => {
    michaelsBrowser.editor.editText(michaelsDraftReplyOrig);
  });

  it("... closes the editor, reloads, reopens", () => {
    michaelsBrowser.editor.cancelNoHelp();
    michaelsBrowser.refresh();
    michaelsBrowser.topic.clickReplyToOrigPost();
  });

  it("... he sees his reply draft", () => {
    michaelsBrowser.editor.waitForDraftTextToLoad(michaelsDraftReplyOrig);
    michaelsBrowser.editor.cancelNoHelp();
  });


  // ----- Draft still there, when logging in

  it("Maria logs in", () => {
    mariasBrowser.refresh();
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... resumes typing the reply — she sees the draft, from when she wasn't logged in", () => {
    mariasBrowser.topic.clickReplyToOrigPost();
    mariasBrowser.editor.waitForDraftTextToLoad(mariasDraftReplyOrig);
    mariasBrowser.editor.editText(mariasDraftReplyEditedWhenLoggedIn);   // (2BS493)
  });

  it("... An *edited* draft got saved, now when she's logged in", () => {
    mariasBrowser.refresh();
    mariasBrowser.topic.clickReplyToOrigPost();
    mariasBrowser.editor.waitForDraftTextToLoad(mariasDraftReplyEditedWhenLoggedIn);
  });

  it("Maria returns to the forum", () => {
    mariasBrowser.go('/');
  });

  it("... starts typing a topic again", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
  });

  it("... her old saved text reappears — from before she logged in", () => {
    mariasBrowser.editor.waitForDraftTitleToLoad(mariasDraftTopicTitleEditedOnce);
    mariasBrowser.editor.waitForDraftTextToLoad(mariasDraftTopicTextEditedOnce);
  });

  it("... she saves the topic", () => {
    mariasBrowser.complex.saveTopic({
      title: mariasDraftTopicTitleEditedOnce,
      body: mariasDraftTopicTextEditedOnce });
  });


  // ----- Draft deleted, when posting new topic (or reply)

  it("Maria returns to the forum one last time", () => {
    mariasBrowser.go('/');
  });

  it("She starts typing again", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
  });

  it("Now the new-topic-draft-text is gone (it was posted, and the draft then deleted)", () => {
    mariasBrowser.editor.waitForDraftTitleToLoad('');
    mariasBrowser.editor.waitForDraftTextToLoad('');
  });

  it("She logs out", () => {
    mariasBrowser.topbar.clickLogout();
  });

  it("The draft is gone, also now when she is logged out", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
    mariasBrowser.editor.waitForDraftTitleToLoad('');
    mariasBrowser.editor.waitForDraftTextToLoad('');
  });


  // ----- But not-logged-in drafts that weren't posted, are still there

  it("Maria goes to the forum topic again", () => {
    mariasBrowser.go(discussionPageUrl);
  });

  it("... starts typing a reply, now as logged out", () => {
    mariasBrowser.topic.clickReplyToOrigPost();
  });

  it("... the draft text, from when logged out, appears — without edits made when logged in", () => {
    // These edits: (2BS493) aren't included  — because when one is logged in, the draft gets
    // saved server side, not in the session storage.
    mariasBrowser.editor.waitForDraftTextToLoad(mariasDraftReplyOrig);
  });

});

