/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
// import fs = require('fs');  EMBCMTS
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let richBrowserA: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId: SiteId;

let forum: TwoPagesTestForum;

const mariasTopicTitleOneOrig   = 'mariasTopicTitleOneOrig';
const mariasTopicTitleOneEdited = 'mariasTopicTitleOneEdited';
const mariasTopicBodyOneOrig   = 'mariasTopicBodyOneOrig';
const mariasTopicBodyOneOEdited   = 'mariasTopicBodyOneOEdited';


describe("drafts-new-topic-from-cats-page.test.ts  TyT502RKD472", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });

    // The create-topic button showld read "Ask a Question",
    // because of this topic type.
    forum.categories.categoryA.defaultTopicType = PageRole.Question;

    assert.refEq(builder.getSite(), forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
  });

  it("initialize people", () => {
    richBrowserA = new TyE2eTestBrowser(oneWdioBrowser);

    maria = forum.members.maria;
    mariasBrowser = richBrowserA;
  });

  it("Maria logs in", () => {
    mariasBrowser.forumCategoryList.goHere(siteIdAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("She's on the category list page (not in any specific category)", () => {
    mariasBrowser.forumCategoryList.waitForCategories();
  });

  it("The create-topic button title is 'Ask a Question'", () => {
    assert.eq(mariasBrowser.forumButtons.getCreateTopicButtonText(), "Ask a Question");
  });

  it("Maria starts typing a question", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
    mariasBrowser.editor.editTitle(mariasTopicTitleOneOrig);
    mariasBrowser.editor.editText(mariasTopicBodyOneOrig);
  });

  it("She refreshes the page — this beacon-saves a draft", () => {
    mariasBrowser.refresh();
  });

  it("... starts typing a topic again", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
  });

  it("... the saved text reappears", () => {
    mariasBrowser.editor.waitForDraftTitleToLoad(mariasTopicTitleOneOrig);
    mariasBrowser.editor.waitForDraftTextToLoad(mariasTopicBodyOneOrig);
  });

  // This is tested from  drafts-new-topic.2browsers.test.ts:
  //   - Cancel-unmount save.
  //   - Auto-save after some seconds.

  it("Maria edits the new topic a bit more", () => {
    mariasBrowser.editor.editTitle(mariasTopicTitleOneEdited);
    mariasBrowser.editor.editText(mariasTopicBodyOneOEdited);
  });

  it("... she posts the new topic", () => {
    mariasBrowser.editor.saveWaitForNewPage();
  });

  it("... and a new topic gets created", () => {
    mariasBrowser.assertPageTitleMatches(mariasTopicTitleOneEdited);
  });

  it("She goes to her list-of-drafts", () => {
    mariasBrowser.topbar.myMenu.goToDraftsEtc();
  });

  it("... it's empty, the draft was submittted", () => {
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(0);
  });

});

