/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let regina: Member;
let reginasBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;

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

describe(`notfs-mark-seen-as-seen.d.2br  TyT2AKBR0T`, () => {

  it("import a site", async () => {
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

    assert.eq(builder.getSite(), forum.siteData);
    siteIdAddress = await server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    discussionPageUrl = siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    maria = forum.members.maria;
    mariasBrowser = brA;

    regina = forum.members.regina;
    reginasBrowser = brB;
    michael = forum.members.michael;
    michaelsBrowser = brB;
  });

  it("Maria logs in", async () => {
    await mariasBrowser.go2(discussionPageUrl);
    await mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... starts watching Michael's page", async () => {
    await mariasBrowser.metabar.setPageNotfLevel(c.TestPageNotfLevel.EveryPost);
  });

  it("... returns to the topic list, so won't see any replies", async () => {
    await mariasBrowser.go2('/');
  });

  it("Regina logs in", async () => {
    await reginasBrowser.go2(discussionPageUrl);
    await reginasBrowser.complex.loginWithPasswordViaTopbar(regina);
  });

  it("... replies to Michael's orig post", async () => {
    // This reply will appear in the Dicussion section, above Mallory's progress posts, ...
    await reginasBrowser.complex.replyToPostNr(c.BodyNr, reginasReplyOne);
  });

  it("... replies and mentions Maria", async () => {
    // ... and this reply too. So Maria sees them directly, later when she opens the page.
    await reginasBrowser.complex.replyToPostNr(c.BodyNr, reginasReplyTwoMentionsMaria);
  });

  it("... and replies to the progr post at the comment", async () => {
    // ... However this reply appears at the bottom — Maria needs to scroll down to see it.
    await reginasBrowser.complex.replyToPostNr(lastProgrPostNr, reginasReplyThreeAtTheBottom);
  });

  it("Maria has three unread notifications: two replies-to-others, and a mention", async () => {
    await mariasBrowser.refresh2();
    await mariasBrowser.topbar.waitForNumOtherNotfs(2);   // Regina's replies to Michael
    await mariasBrowser.topbar.waitForNumDirectNotfs(1);  // Regina @mentioned Maria
  });

  it("Maria opens the page", async () => {
    await mariasBrowser.go2(discussionPageUrl + '#debug=true');
  });

  it("After a while, the notifications for the two posts at the top, get marked as read", async () => {
    await mariasBrowser.topbar.refreshUntilNumOtherNotfs(1);
    //mariasBrowser.topbar.refreshUntilPostsReadSoFewerOtherNotfs(
        //[reginasReplyOneNr, reginasReplyTwoNr], 1);
    await mariasBrowser.topbar.waitForNoDirectNotfs();
  });

  it("There is one more notification: The mark-all-as-read button is still visible", async () => {
    assert.that(await mariasBrowser.topbar.myMenu.isMarkAllNotfsReadVisibleOpenClose());
  });

  it("Maria scrolls to the bottom", async () => {
    await mariasBrowser.scrollToBottom();
  });

  it("After a while, the notf for the reply at the bottom, also gets marked as seen", async () => {
    await mariasBrowser.topbar.refreshUntilNumOtherNotfs(0);
    //mariasBrowser.topbar.refreshUntilPostsReadSoFewerOtherNotfs(
        //[reginasReplyThreeNr], 0);
  });

  it("The mark-all-as-read button is no longer visible", async () => {
    assert.not(await mariasBrowser.topbar.myMenu.isMarkAllNotfsReadVisibleOpenClose());
  });

});

