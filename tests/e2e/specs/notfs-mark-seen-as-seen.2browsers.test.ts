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
let regina: Member;
let reginasBrowser;
let maria: Member;
let mariasBrowser;
let michael: Member;
let michaelsBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: LargeTestForum;

let discussionPageUrl: string;

const numProgrPosts = 10;
const lastProgrPostNr = c.FirstReplyNr + numProgrPosts - 1;

const reginasReplyOne = 'reginasReplyOne';
const reginasReplyOneNr = lastProgrPostNr + 1;
const reginasReplyTwoMentionsMaria = 'reginasReplyTwoMentionsMaria @maria';
const reginasReplyTwoNr = lastProgrPostNr + 2;
const reginasReplyThreeAtTheBottom = 'reginasReplyThreeAtTheBottom';
const reginasReplyThreeNr = lastProgrPostNr + 3;

describe("notfs-mark-seen-as-seen  TyT2AKBR0T", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addLargeForum({
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });

    // Add 20 bottom comments, so can later on add a post & notf that cannot be seen on page load.
    for (let nr = c.FirstReplyNr; nr < c.FirstReplyNr + numProgrPosts; ++nr) {
      builder.addPost({
        page: forum.topics.byMichaelCategoryA,
        nr,
        parentNr: c.BodyNr,
        postType: c.TestPostType.BottomComment,
        authorId: forum.members.mallory.id,
        approvedSource: "I give you goldy golden gold coins, five per second",
      });
    }

    assert(builder.getSite() === forum.siteData);
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

    regina = forum.members.regina;
    reginasBrowser = richBrowserB;
    michael = forum.members.michael;
    michaelsBrowser = richBrowserB;
  });

  it("Maria logs in", () => {
    mariasBrowser.go(discussionPageUrl);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... starts watching Michael's page", () => {
    mariasBrowser.metabar.openMetabar();
    mariasBrowser.metabar.chooseNotfLevelWatchAll();
  });

  it("... returns to the topic list, so won't see any replies", () => {
    mariasBrowser.go('/');
  });

  it("Regina logs in", () => {
    reginasBrowser.go(discussionPageUrl);
    reginasBrowser.complex.loginWithPasswordViaTopbar(regina);
  });

  it("... replies to Michael's orig post", () => {
    // This reply will appear in the Dicussion section, above Mallory's progress posts, ...
    reginasBrowser.complex.replyToPostNr(c.BodyNr, reginasReplyOne);
  });

  it("... replies and mentions Maria", () => {
    // ... and this reply too. So Maria sees them directly, later when she opens the page.
    reginasBrowser.complex.replyToPostNr(c.BodyNr, reginasReplyTwoMentionsMaria);
  });

  it("... and replies to the progr post at the comment", () => {
    // ... However this reply appears at the bottom — Maria needs to scroll down to see it.
    reginasBrowser.complex.replyToPostNr(lastProgrPostNr, reginasReplyThreeAtTheBottom);
  });

  it("Maria has three unread notifications: two replies-to-others, and a mention", () => {
    mariasBrowser.refresh();
    mariasBrowser.topbar.waitForNumOtherNotfs(2);   // Regina's replies to Michael
    mariasBrowser.topbar.waitForNumDirectNotfs(1);  // Regina @mentioned Maria
  });

  it("Maria opens the page", () => {
    mariasBrowser.go(discussionPageUrl + '#debug=true');
  });

  it("After a while, the notifications for the two posts at the top, get marked as read", () => {
    mariasBrowser.topbar.refreshUntilNumOtherNotfs(1);
    //mariasBrowser.topbar.refreshUntilPostsReadSoFewerOtherNotfs(
        //[reginasReplyOneNr, reginasReplyTwoNr], 1);
    mariasBrowser.topbar.waitForNoDirectNotfs();
  });

  it("There is one more notification: The mark-all-as-read button is still visible", () => {
    assert(mariasBrowser.topbar.myMenu.isMarkAllNotfsReadVisibleOpenClose());
  });

  it("Maria scrolls to the bottom", () => {
    mariasBrowser.scrollToBottom();
  });

  it("After a while, the notf for the reply at the bottom, also gets marked as seen", () => {
    mariasBrowser.topbar.refreshUntilNumOtherNotfs(0);
    //mariasBrowser.topbar.refreshUntilPostsReadSoFewerOtherNotfs(
        //[reginasReplyThreeNr], 0);
  });

  it("The mark-all-as-read button is no longer visible", () => {
    assert(!mariasBrowser.topbar.myMenu.isMarkAllNotfsReadVisibleOpenClose());
  });

});

