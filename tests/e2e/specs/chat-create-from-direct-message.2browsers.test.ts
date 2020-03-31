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

let forum: LargeTestForum;

let maria: Member;
let mariasBrowser;
let michael: Member;
let michaelsBrowser;


let siteIdAddress: IdAddress;
let forumTitle = "Admin Review Invalidate Tasks about a reply";

let discussionPageUrl: string;
let directMessageUrl: string;

const angryReplyOne = 'angryReplyOne';
const angryReplyOneNr = c.FirstReplyNr;
const angryReplyTwo = 'angryReplyTwo';
const angryReplyTwoNr = c.FirstReplyNr + 1;

const mariasMessageTitle = "Hi Michael, I want to chat";
const mariasMessageText = "I want to chat";

const chatName = 'chatName';
const chatPurpose = 'chatPurpose';
const michaelsChatMessage = "Hello @maria who do you want to chat with, and which year";


describe("chat-create-from-direct-message  TyT5FKB2A", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addLargeForum({ title: forumTitle, members: null /* default = everyone */ });
    siteIdAddress = server.importSiteData(forum.siteData);
    discussionPageUrl = siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", () => {
    michaelsBrowser = _.assign(browserA, pagesFor(browserA));
    mariasBrowser = _.assign(browserB, pagesFor(browserB));
    maria = forum.members.maria;
    michael = forum.members.michael;
  });

  it("Michael logs in", () => {
    michaelsBrowser.go(discussionPageUrl);
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
  });

  it("Maria sends a message to Michael", () => {
    mariasBrowser.go(discussionPageUrl);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.complex.sendMessageToPageAuthor(mariasMessageTitle, mariasMessageText);
    directMessageUrl = mariasBrowser.getUrl();
  });

  it("Michael gets a notf  [TyTPAGENOTF]", () => {
    michaelsBrowser.topbar.waitForMyMenuVisible();
    michaelsBrowser.topbar.openNotfToMe();
    michaelsBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, mariasMessageText);
  });

  it("He creates a chat — works, although he isn't currently in any site section [4GWRQA28]", () => {
    michaelsBrowser.refresh();
    michaelsBrowser.complex.createChatChannelViaWatchbar({ name: chatName, purpose: chatPurpose });
  });

  it("He mentions Maria", () => {
    michaelsBrowser.chat.joinChat();
    michaelsBrowser.chat.addChatMessage(michaelsChatMessage);
  });

  it("Maria gets a notf, clicks it", () => {
    mariasBrowser.topbar.openNotfToMe()
  });

  it("... and sees the chat message", () => {
    mariasBrowser.chat.waitForNumMessages(1);
    mariasBrowser.topic.assertPostTextMatches(c.FirstReplyNr, michaelsChatMessage);
  });

});

