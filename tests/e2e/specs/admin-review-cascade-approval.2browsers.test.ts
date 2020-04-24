/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let merche: Member;
let merchesBrowser: TyE2eTestBrowser;
let meilani: Member;
let meilanisBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;

const chatMessageOneStays = 'chatMessageOneStays';
const chatMessageTwoDeleted = 'chatMessageTwoDeleted';
const origPostReplyOneStays = 'origPostReplyOneStays';
const origPostReplyTwoDeleted = 'origPostReplyTwoDeleted';
const aReplyToApprove = 'aReplyToApprove';
const meilanianisReplyOne = 'meilanianisReplyOne';
const meilanianisReplyTwo = 'meilanianisReplyTwo';

let discussionPageUrl: string;
let chatPageUrl: string;


describe("admin-review-cascade-approval  TyT0SKDE24", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Cascade Approvals E2E Test",
      members: undefined, // default = everyone
    });
    const chatPage = builder.addPage({
      id: 'chat_page_id',
      folder: '/',
      showId: false,
      slug: 'chat-page',
      role: c.TestPageRole.OpenChat,
      title: "Chat Page",
      body: "Chat here, on this chat page.",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.mallory.id,
    });
    assert.refEq(builder.getSite(), forum.siteData);

    const siteData: SiteData2 = forum.siteData;
    siteData.settings.requireVerifiedEmail = false;
    siteData.settings.numFirstPostsToAllow = 9;
    siteData.settings.numFirstPostsToApprove = 1;

    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
    discussionPageUrl = siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug;
    chatPageUrl = siteIdAddress.origin + '/' + chatPage.slug;
  });

  it("initialize people", () => {
    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    merche = make.memberMerche();
    merchesBrowser = richBrowserB;
    meilani = make.memberMeilani();
    meilanisBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });

  it("Merche goes to the chat page", () => {
    merchesBrowser.go(chatPageUrl);
  });

  it("... clicks Join Chat", () => {
    merchesBrowser.chat.joinChat();
  });

  it("... signs up", () => {
    merchesBrowser.loginDialog.createPasswordAccount(merche);
  });

  it("... verifies her email", function() {
    const url = server.getLastVerifyEmailAddressLinkEmailedTo(
      siteIdAddress.id, merche.emailAddress, merchesBrowser);
    merchesBrowser.go(url);
    merchesBrowser.hasVerifiedSignupEmailPage.clickContinue();
  });

  it("... clicks Jon Chat again", () => {
    merchesBrowser.chat.joinChat();
  });

  it("... posts a chat message", () => {
    merchesBrowser.chat.addChatMessage(chatMessageOneStays);
    merchesBrowser.chat.waitForNumMessages(1);
  });

  it("... some time elapses, so next message won't get merged", () => {
    server.playTimeMinutes(30);
  });

  it("... she posts another message", () => {
    merchesBrowser.chat.addChatMessage(chatMessageTwoDeleted);
    merchesBrowser.chat.waitForNumMessages(2);
  });

  it("... but deletes this one  TyT052SKDGJ37", () => {
    merchesBrowser.chat.deleteChatMessageNr(c.FirstReplyNr + 1);
  });

  it("Merche goes to the discussion page", () => {
    merchesBrowser.go(discussionPageUrl);
  });

  it("... posts a reply", () => {
    merchesBrowser.complex.replyToOrigPost(origPostReplyOneStays);
  });

  it("... and another reply", () => {
    merchesBrowser.complex.replyToOrigPost(origPostReplyTwoDeleted);
  });

  it("... but deletes this one", () => {
    merchesBrowser.topic.deletePost(c.FirstReplyNr + 1);
  });

  it("... and one last reply, which Owen will approve", () => {
    merchesBrowser.complex.replyToOrigPost(aReplyToApprove);
  });

  it("Merche leaves, Meilani arrives and signs up", () => {
    merchesBrowser.topbar.clickLogout();
    meilanisBrowser.complex.signUpAsMemberViaTopbar(meilani);
  });

  it("... verifies her email address", () => {
    const url = server.getLastVerifyEmailAddressLinkEmailedTo(
      siteIdAddress.id, meilani.emailAddress, meilanisBrowser);
    meilanisBrowser.go(url);
    meilanisBrowser.hasVerifiedSignupEmailPage.clickContinue();
  });

  it("Meilani posts two replies", () => {
    meilanisBrowser.complex.replyToOrigPost(meilanianisReplyOne);
    meilanisBrowser.complex.replyToOrigPost(meilanianisReplyTwo);
    meilanisBrowser.topic.assertNumRepliesVisible(2 + 2);  // Merche's + Meilani's
  });

  it("... then leaves", () => {
    meilanisBrowser.topbar.clickLogout();
  });

  it("The replies appear as unapproved", () => {
    const counts = strangersBrowser.topic.countReplies();
    assert.deepEq(counts, { numNormal: 0, numUnapproved: 4, numDeleted: 0 });
  });


  // TESTS_MISSING:
  //   posts a new topic,
  //   and another topic but deletes that one.


  it("Owen logs in to the admin area, the review tab", () => {
    owensBrowser.adminArea.review.goHere(siteIdAddress.origin, { loginAs: owen });
  });

  it("There are 2 + 3 + 2 posts waiting for review", () => {
    assert.eq(owensBrowser.adminArea.review.countThingsToReview(), 7);
  });

  it("Owen approves Merche's most recent post", () => {
    owensBrowser.adminArea.review.approvePostForTaskIndex(3);
  });

  it("... the server carries out the review task", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions();
  });

  it("... this cascade-approves Merche's other posts", () => {
    let counts: NumReplies;
    strangersBrowser.refreshUntil(() => {
      counts = strangersBrowser.topic.countReplies();
      return counts.numNormal === 2;
    });
    assert.deepEq(counts, { numNormal: 2, numUnapproved: 2, numDeleted: 0 });
    // Apparently can take a short while before React has shown the .dw-p (post body),
    // this error happened:
    //     "Text match failure, selector:  #post-2 .dw-p-bd,  No elems match the selector."
    strangersBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
  });

  // Without running into any errors because some of those posts have:
  //  - Been auto approved already by the System user,
  //    namely a chat message.
  //  - Been deleted already, by Merche.
  //

  it("... Merche's posts, not Meilaniani's", () => {
    strangersBrowser.topic.assertPostTextMatches(c.FirstReplyNr, origPostReplyOneStays);
    strangersBrowser.topic.assertPostTextMatches(c.FirstReplyNr + 2, aReplyToApprove);
  });


  it("Owen approves Meilaniani's most recent post", () => {
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
  });

  it("... the server obeys", () => {
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions();
  });

  it("... namely cascade-approves Meilani's posts too", () => {
    let counts: NumReplies;
    strangersBrowser.refreshUntil(() => {
      counts = strangersBrowser.topic.countReplies();
      return counts.numNormal === 4;
    });
    assert.deepEq(counts, { numNormal: 4, numUnapproved: 0, numDeleted: 0 });
  });

  it("... with the correct text contents", () => {
    strangersBrowser.topic.assertPostTextMatches(c.FirstReplyNr, origPostReplyOneStays);
    strangersBrowser.topic.assertPostTextMatches(c.FirstReplyNr + 2, aReplyToApprove);
    strangersBrowser.topic.assertPostTextMatches(c.FirstReplyNr + 3, meilanianisReplyOne);
    strangersBrowser.topic.assertPostTextMatches(c.FirstReplyNr + 4, meilanianisReplyTwo);
  });

});

