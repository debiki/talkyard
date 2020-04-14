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

const chatPageTitle = "Chat Test Draft Test Test, for Test Test Testing Tests";
let chatPageUrl: string;

const mariasMessageOneOrig = 'mariasMessageOneOrig';
const mariasMessageOneEditedOnce = 'mariasMessageOneEditedOnce';

const mariasMessageTwoOrig = 'mariasMessageTwoOrig';

const mariasMessageThreeOrig = 'mariasMessageThreeOrig';
const mariasMessageThreeEditedOnce = 'mariasMessageThreeEditedOnce';

const michaelsMessageOneOrig = 'michaelsMessageOneOrig';

const michaelsMessageTwoOrig = 'michaelsMessageTwoOrig';
const michaelsMessageTwoEditedOnce = 'michaelsMessageTwoEditedOnce';

const michaelsMessageThreeOrig = 'michaelsMessageThreeOrig';
const michaelsMessageThreeEditedOnce = 'michaelsMessageThreeEditedOnce';

const mariasMessageFour = 'mariasMessageFour';


describe("drafts-chat-adv-ed  TyT7JKMW24", () => {

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
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    maria = forum.members.maria;
    mariasBrowser = richBrowserA;

    michael = forum.members.michael;
    michaelsBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });

  it("Maria and Michael goes to the chat page", () => {
    everyonesBrowsers.go(chatPageUrl);
  });

  it("Maria logs in, joins the chat", () => {
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.chat.joinChat();
  });


  // ----- Draft auto-saved after some seconds, survives refresh

  it("Maria starts typing a chat message", () => {
    mariasBrowser.chat.editChatMessage(mariasMessageOneOrig);
  });

  it("... a draft gets auto saved", () => {
    mariasBrowser.chat.waitForDraftSaved();
  });

  it("She refreshes the page", () => {
    mariasBrowser.refresh();
  });

  it("... the saved chat message draft reappears", () => {
    mariasBrowser.chat.waitForDraftChatMessageToLoad(mariasMessageOneOrig);
  });


  // ----- Draft auto-saved with beacon, if sudden refresh  TyT5ABKR20

  it("Maria edits the chat message", () => {
    mariasBrowser.chat.editChatMessage(mariasMessageOneEditedOnce);
  });

  it("... quickly reloads the page", () => {
    mariasBrowser.refresh();
  });

  it("... the saved edits reappear — because the browser saved them, with a beacon", () => {
    mariasBrowser.chat.waitForDraftChatMessageToLoad(mariasMessageOneEditedOnce);
  });

  it("She posts it", () => {
    mariasBrowser.chat.submitChatMessage();
    mariasBrowser.chat.waitForNumMessages(1);
  });

  it("She starts typing another", () => {
    mariasBrowser.chat.editChatMessage(mariasMessageTwoOrig);
  });


  // ----- Draft auto-saved on Reactjs unmount, when navigating to other page

  it("Now between, Michael joins the chat", () => {
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    michaelsBrowser.chat.joinChat();
  });

  it("... and starts typing a chat message", () => {
    michaelsBrowser.chat.editChatMessage(michaelsMessageOneOrig);
  });

  it("... goes to the topic list, so the chat text field unmounts", () => {
    michaelsBrowser.topbar.clickHome();
    michaelsBrowser.forumTopicList.waitForTopics();
  });

  it("... goes back to the chat", () => {
    michaelsBrowser.watchbar.goToTopic(chatPageTitle);
    michaelsBrowser.chat.waitForNumMessages(1);
  });

  it("... his draft text is still there", () => {
    michaelsBrowser.chat.waitForDraftChatMessageToLoad(michaelsMessageOneOrig);
  });

  it("... refreshes the page, the draft is still there", () => {
    michaelsBrowser.refresh();
    michaelsBrowser.chat.waitForNumMessages(1);
    michaelsBrowser.chat.waitForDraftChatMessageToLoad(michaelsMessageOneOrig);
  });


  // ----- Cruft ...

  it("... finally Michael posts his message", () => {
    michaelsBrowser.chat.submitChatMessage();
    michaelsBrowser.chat.waitForNumMessages(2);
  });

  it("Maria sees Michael's chat message", () => {
    mariasBrowser.chat.waitForNumMessages(2);
  });

  it("... submits her message", () => {
    mariasBrowser.chat.submitChatMessage();
    mariasBrowser.chat.waitForNumMessages(3);
  });


  // ----- Switch to advanced editor, draft auto saved, submit in adv editor

  it("Michael starts typing his 2nd message", () => {
    michaelsBrowser.chat.editChatMessage(michaelsMessageTwoOrig);
  });

  it("... opens the advanced editor", () => {
    michaelsBrowser.chat.openAdvancedEditor();
  });

  it("... sees his text, there", () => {
    michaelsBrowser.editor.waitForDraftTextToLoad(michaelsMessageTwoOrig);
  });

  it("... edits it, a draft gets auto-saved", () => {
    michaelsBrowser.editor.editText(michaelsMessageTwoEditedOnce);
    michaelsBrowser.editor.waitForDraftSaved();
  });

  it("... submits the message", () => {
    michaelsBrowser.editor.save();
    michaelsBrowser.chat.waitForNumMessages(4);
  });

  it("Views his list of drafts", () => {
    michaelsBrowser.topbar.myMenu.goToDraftsEtc();
  });

  it("... it's empty: the simple and advanced editors, didn't save dupl drafts  TyT270424", () => {
    michaelsBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(0);
  });

  it("... he returns to the chat", () => {
    michaelsBrowser.go(chatPageUrl);
  });


  // ----- Open in advanced editor, draft auto saved, refresh, submit draft in simple editor

  it("Maria opens the advanced editor", () => {
    mariasBrowser.chat.openAdvancedEditor();
  });

  it("... types her third message", () => {
    mariasBrowser.editor.editText(mariasMessageThreeOrig);
    mariasBrowser.editor.waitForDraftSaved();
  });

  it("... switches to the simple editor", () => {
    mariasBrowser.editor.switchToSimpleEditor();
  });

  it("... her text appears there", () => {
    mariasBrowser.chat.waitForDraftChatMessageToLoad(mariasMessageThreeOrig);
  });

  it("... she edits it", () => {
    mariasBrowser.chat.editChatMessage(mariasMessageThreeEditedOnce);
  });

  it("... and quickly refreshes", () => {
    mariasBrowser.refresh();
  });

  it("... the text reappears", () => {
    mariasBrowser.chat.waitForDraftChatMessageToLoad(mariasMessageThreeEditedOnce);
  });

  it("... she posts it", () => {
    mariasBrowser.chat.submitChatMessage();
    mariasBrowser.chat.waitForNumMessages(5);
  });


  // ----- Open in advanced editor, type, quickly switch to simple, edit, save draft, submit.

  // This previously resulted in a double-saved draft (two different drafts for the same post),
  // because the advanced editor saved the draft, on unmount [TyT270424],
  // and then the inline/simple editor saved it again, with a new draft-nr.

  it("Michael opens the advanced editor", () => {
    michaelsBrowser.chat.openAdvancedEditor();
  });

  it("... types his 3rd message", () => {
    michaelsBrowser.editor.editText(michaelsMessageThreeOrig);
  });

  it("... quickly switches to the simple editor, without waiting for draft to save", () => {
    michaelsBrowser.editor.switchToSimpleEditor();
  });

  it("... his text appears there", () => {
    michaelsBrowser.chat.waitForDraftChatMessageToLoad(michaelsMessageThreeOrig);
  });

  it("... he edits it", () => {
    michaelsBrowser.chat.editChatMessage(michaelsMessageThreeEditedOnce);
  });

  it("... and quickly refreshes", () => {
    michaelsBrowser.refresh();
  });

  it("... the text reappears", () => {
    michaelsBrowser.chat.waitForDraftChatMessageToLoad(michaelsMessageThreeEditedOnce);
  });

  it("... he posts it", () => {
    michaelsBrowser.chat.submitChatMessage();
    michaelsBrowser.chat.waitForNumMessages(6);
  });

  it("Views his list of drafts, again", () => {
    michaelsBrowser.topbar.myMenu.goToDraftsEtc();
  });

  it("... it's empty: no dupl drafts saved  TyT270424", () => {
    michaelsBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(0);
  });

  it("... he returns to the chat", () => {
    michaelsBrowser.go(chatPageUrl);
  });


  // ----- Open draft via drafts list, in advanced editor, submit

  it("Maria starts typing her 4th message", () => {
    mariasBrowser.chat.editChatMessage(mariasMessageFour);
  });

  it("Goes to her drafts list", () => {
    mariasBrowser.topbar.myMenu.goToDraftsEtc();
  });

  it("... sees the chat message draft", () => {
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(1);
  });

  it("... refreshes the browser", () => {
    mariasBrowser.refresh();
  });

  it("... clicks it", () => {
    mariasBrowser.userProfilePage.draftsEtc.openDraftIndex(1);
  });

  it("... the saved edits appear in the simple chat", () => {
    mariasBrowser.chat.waitForDraftChatMessageToLoad(mariasMessageFour);
  });

  it("... she posts it", () => {
    mariasBrowser.chat.submitChatMessage();
    mariasBrowser.chat.waitForNumMessages(7);
  });

  it("Now, when refreshing the chat page, there's no draft text", () => {
    mariasBrowser.pause(500); // so any draft gets the chance to load
    assert.equal(mariasBrowser.chat.getChatInputText(), '');
  });

  it("And the list-of-drafts is empty", () => {
    mariasBrowser.topbar.myMenu.goToDraftsEtc();
    mariasBrowser.userProfilePage.draftsEtc.waitUntilNumDraftsListed(0);
  });

});

