/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');





let everyonesBrowsers;
let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: LargeTestForum;

const mariasDraftTopicTitleOrig = 'mariasDraftTopicTitleOrig';
const mariasDraftTopicTitleEditedOnce = 'mariasDraftTopicTitleEditedOnce';
const mariasDraftTopicTitleEditedTwice = 'mariasDraftTopicTitleEditedTwice';
const mariasDraftTopicTextOrig = 'mariasDraftTopicTextOrig';
const mariasDraftTopicTextEditedOnce = 'mariasDraftTopicTextEditedOnce';
const mariasDraftTopicTextEditedTwice = 'mariasDraftTopicTextEditedTwice';



describe("drafts-new-topic  TyT5BR20P4", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addLargeForum({
      title: "Drafts E2E Test",
      members: ['maria', 'michael'],
    });
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    michael = forum.members.michael;
    michaelsBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });

  it("Maria logs in", () => {
    mariasBrowser.go(siteIdAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });


  // ----- Auto save after X seconds

  it("... starts typing a new topic", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
    mariasBrowser.editor.editTitle(mariasDraftTopicTitleOrig);
    mariasBrowser.editor.editText(mariasDraftTopicTextOrig);
  });

  it("... a draft gets auto saved", () => {
    mariasBrowser.editor.waitForDraftSaved();
  });

  /*
  it("... waits for a while", () => {
    // Otherwise the server might think the edits happenend before the draft
    // had been created. [DRAFTWAIT]
    server.playTimeMinutes(10);
  }); */

  it("She refreshes the page", () => {
    mariasBrowser.refresh();
  });

  it("... starts typing a topic again", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
  });

  it("... the saved text reappears", () => {
    mariasBrowser.editor.waitForDraftTitleToLoad(mariasDraftTopicTitleOrig);
    mariasBrowser.editor.waitForDraftTextToLoad(mariasDraftTopicTextOrig);
  });


  // ----- Reactjs unmount save

  it("Maria edits the topic", () => {
    mariasBrowser.editor.editTitle(mariasDraftTopicTitleEditedOnce);
    mariasBrowser.editor.editText(mariasDraftTopicTextEditedOnce);
  });

  it("... closes the editor — this saves a draft", () => {
    mariasBrowser.editor.cancelNoHelp();
  });

  /*
  it("... waits for a while", () => {
    // Otherwise the server might think the edits happenend before the draft
    // had been created. [DRAFTWAIT]
    server.playTimeMinutes(10);
  }); */

  it("... refreshes the page", () => {
    mariasBrowser.refresh();
  });

  it("... the saved edits appear, when she starts typing again", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
    mariasBrowser.editor.waitForDraftTitleToLoad(mariasDraftTopicTitleEditedOnce);
    mariasBrowser.editor.waitForDraftTextToLoad(mariasDraftTopicTextEditedOnce);
  });


  // ----- Beacon save

  it("She edits again", () => {
    mariasBrowser.editor.editTitle(mariasDraftTopicTitleEditedTwice);
    mariasBrowser.editor.editText(mariasDraftTopicTextEditedTwice);
  });

  it("... immediately refreshes the page — this saves a draft, with a beacon  TyT5ABKR20", () => {
    mariasBrowser.refresh();
  });

  /*
  it("... waits for a while", () => {
    // Otherwise the server might think the edits happenend before the draft
    // had been created. [DRAFTWAIT]
    server.playTimeMinutes(10);
    mariasBrowser.refresh();
  }); */

  it("... the saved edits appear, when she starts typing again, again", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
    mariasBrowser.editor.waitForDraftTitleToLoad(mariasDraftTopicTitleEditedTwice);
    mariasBrowser.editor.waitForDraftTextToLoad(mariasDraftTopicTextEditedTwice);
  });


  // ----- Reopen via drafts list

  it("She goes to her list-of-drafts user profile page", () => {
    mariasBrowser.editor.cancelNoHelp();
    mariasBrowser.topbar.myMenu.goToDraftsEtc();
  });

  it("... and sees the draft, there", () => {
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(1);
  });

  it("She clicks it  TyTFRAGACT", () => {
    mariasBrowser.userProfilePage.draftsEtc.openDraftIndex(1);
  });

  it("... the editor with the saved edits reappear", () => {
    mariasBrowser.editor.waitForDraftTitleToLoad(mariasDraftTopicTitleEditedTwice);
    mariasBrowser.editor.waitForDraftTextToLoad(mariasDraftTopicTextEditedTwice);
  });

  it("... she posts the new topic", () => {
    mariasBrowser.editor.saveWaitForNewPage();
  });

  it("... and a new topic gets created", () => {
    mariasBrowser.assertPageTitleMatches(mariasDraftTopicTitleEditedTwice);
  });

  it("She goes to the topic list", () => {
    mariasBrowser.go('/');
  });

  it("... and now, when starting a topic, there's no draft text", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
    mariasBrowser.pause(500); // wait for any draft to load
    assert.equal(mariasBrowser.editor.getTitle(), '');
    assert.equal(mariasBrowser.editor.getText(), '');
  });

  it("She goes to her list-of-drafts again", () => {
    mariasBrowser.topbar.myMenu.goToDraftsEtc();
  });

  it("... it's empty, the draft was submittted", () => {
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(0);
  });

});

