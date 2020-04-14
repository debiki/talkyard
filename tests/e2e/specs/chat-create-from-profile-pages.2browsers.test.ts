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





let forum: LargeTestForum;

let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;


let siteId: SiteId;
let siteIdAddress: IdAddress;
let forumTitle = "Admin Review Invalidate Tasks about a reply";

let discussionPageUrl: string;

const chatName = 'chatName';
const chatPurpose = 'chatPurpose';
const michaelsChatMessage = "@maria what time is it, tomorrow, at this time?";


describe("chat-create-from-profile-pages.2browsers.test.ts  TyT306RAKN2", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addLargeForum({ title: forumTitle, members: null /* default = everyone */ });
    siteIdAddress = server.importSiteData(forum.siteData);
    discussionPageUrl = siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", () => {
    michaelsBrowser = new TyE2eTestBrowser(browserA);
    mariasBrowser = new TyE2eTestBrowser(browserB);
    maria = forum.members.maria;
    michael = forum.members.michael;
  });

  it("Michael goes to Maria's profile page", () => {
    michaelsBrowser.userProfilePage.openActivityFor(maria.username, siteIdAddress.origin);
    siteId = michaelsBrowser.getSiteId();
  });

  it("... logs in, opens the watchbar", () => {
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    michaelsBrowser.watchbar.openIfNeeded();
  });

  it("Michael creates a chat — works, although isn't in any site section [4GWRQA28]", () => {
    michaelsBrowser.complex.createChatChannelViaWatchbar({ name: chatName, purpose: chatPurpose });
  });

  it("He mentions Maria", () => {
    michaelsBrowser.chat.joinChat();
    michaelsBrowser.chat.addChatMessage(michaelsChatMessage);
  });

  it("Maria gets a notf email, clicks link", () => {
    const email = server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, `@${maria.username}`,
        mariasBrowser).matchedEmail;

    const replyNotfLink = utils.findFirstLinkToUrlIn(
        // Currently the link uses the page id, not url slug.
        // So, not:  + firstUpsertedPage.urlPaths.canonical
        // Instead,  /-1:
        `https?://.*/-[0-9]+`, email.bodyHtmlText);
    mariasBrowser.go2(replyNotfLink);
  });

  it("... she logs in", () => {
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... and sees the chat message", () => {
    mariasBrowser.chat.waitForNumMessages(1);
    mariasBrowser.topic.assertPostTextMatches(c.FirstReplyNr, michaelsChatMessage);
  });

});

