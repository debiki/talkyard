/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

let browser: TyE2eTestBrowser;
declare let browserA: any;
declare let browserB: any;

let everyone;
let owen;
let owensBrowser: TyE2eTestBrowser;
let maja;
let majasBrowser: TyE2eTestBrowser;
let michael;
let michaelsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let forumTitle = "Flag Block Agree Forum";

let topics = {
  majasTopicTitle: "Icecream?",
  majasTopicTitleEdited: "Must yez zecream I",
  majasTopicText: "I can haz icecream?",
  majasTopicTextEdited: "I can zumust haz eezecream",
  majasTopicUrl: '',
  oldTopicTitle: "Old Topic",
  oldTopicUrl: 'old_topic',
};

const threeIsOkay = "Three is okay";


const majasReplyOne = "Zeee fiiirst zecream, ze post nr 2";
const majasReplyTwo = "Meee zecondzz zecreamiii";
const majasReplyThree = "Zhree zecreamizz, ze looooki niimbir";


describe("new member, allow, approve posts:  TyT4AKBJ20", () => {  // RENAME ths file to 'new-member-posts...'

  it("initialize people", () => {
    everyone = new TyE2eTestBrowser(wdioBrowser);
    owensBrowser = new TyE2eTestBrowser(browserA);
    majasBrowser = new TyE2eTestBrowser(browserB);
    michaelsBrowser = majasBrowser;
    strangersBrowser = majasBrowser;

    owen = make.memberOwenOwner();
    //mons = make.memberModeratorMons();
    maja = make.memberMaja();
    michael = make.memberMichael();
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('basicflags', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;
    // This means a new member can post 5 posts, but after that, hen needs to wait until
    // some of those posts have been approved. And when two of them have been approved,
    // the last approval "cascades" and auto-approves all 5 posts. Thereafter the new memeber
    // can post how many posts hen wants to (subjected to new user rate limits).
    site.settings.numFirstPostsToApprove = 2;
    site.settings.maxPostsPendApprBefore = 4;
    site.members.push(maja);
    site.members.push(michael);

    let page = make.page({
      id: topics.oldTopicUrl,
      role: c.TestPageRole.Discussion,
      authorId: maja.id,
      categoryId: 2,
    });
    site.pages.push(page);
    site.pagePaths.push(make.pagePath(page.id, '/', false, 'old-topic'));
    site.posts.push(make.post({ page: page, nr: c.TitleNr, approvedSource: topics.oldTopicTitle }));
    site.posts.push(make.post({ page: page, nr: c.BodyNr, approvedSource: 'Text text text.' }));

    idAddress = server.importSiteData(site);
  });


  // Maja posts stuff
  // -------------------------------------

  it("Maja logs in", () => {
    majasBrowser.go(idAddress.origin);
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
    majasBrowser.disableRateLimits();
  });

  it("... posts a topic", () => {
    majasBrowser.complex.createAndSaveTopic(
      { title: topics.majasTopicTitle, body: topics.majasTopicText, matchAfter: false });
    topics.majasTopicUrl = majasBrowser.getUrl();
  });

  it("... it needs to be approved by staff", () => {
    majasBrowser.topic.assertPagePendingApprovalBodyVisible();
  });

  it("Owen got a new-post-to-review notification", () => {
    server.waitUntilLastEmailMatches(
        idAddress.id, owen.emailAddress, topics.majasTopicText, owensBrowser);
  });

  it("Maja can edit the text, although not yet approved  TyTE2E306RKP", () => {
    majasBrowser.complex.editPageBody(topics.majasTopicTextEdited);
  });

  it("... and the title", () => {
    majasBrowser.complex.editPageTitle(topics.majasTopicTitleEdited);
});

  it("... changes visible after reload  TyTE2E042RT", () => {
    majasBrowser.refresh();
    majasBrowser.assertPageTitleMatches(topics.majasTopicTitleEdited);
    majasBrowser.assertPageBodyMatches(topics.majasTopicTextEdited);
  });

  it("Maja posts three replies, about ice cream, to an old topic ...", () => {
    majasBrowser.go('/');
    majasBrowser.forumTopicList.goToTopic(topics.oldTopicTitle);
  });

  it("... reply nr 1", () => {
    majasBrowser.complex.replyToOrigPost(majasReplyOne);
  });

  it("... Owen gets a review task notification", () => {
    server.waitUntilLastEmailMatches(
        idAddress.id, owen.emailAddress, majasReplyOne, owensBrowser);
  });

  it("... reply nr 2", () => {
    majasBrowser.complex.replyToOrigPost(majasReplyTwo);
  });

  it("... Owen gets a review task notification", () => {
    server.waitUntilLastEmailMatches(
        idAddress.id, owen.emailAddress, majasReplyTwo, owensBrowser);
  });

  it("... reply nr 3", () => {
    majasBrowser.complex.replyToOrigPost(majasReplyThree);
    topics.oldTopicUrl = majasBrowser.getUrl();
  });

  it("... Owen gets a review task notification", () => {
    server.waitUntilLastEmailMatches(
        idAddress.id, owen.emailAddress, majasReplyThree, owensBrowser);
  });

  it("All Maja's replies need to be approved by staff", () => {
    majasBrowser.topic.assertPostNeedsApprovalBodyVisible(2);
    majasBrowser.topic.assertPostNeedsApprovalBodyVisible(3);
    majasBrowser.topic.assertPostNeedsApprovalBodyVisible(4);
  });

  it("... she can edit them: try the last one, nr 4", () => {
    majasBrowser.complex.editPostNr(4, threeIsOkay);
  });

  it("... changes visible after reload", () => {
    majasBrowser.refresh();
    majasBrowser.topic.waitUntilPostTextMatches(4, threeIsOkay);
  });

  it("But now she may not post more replies, until the ones posted already gets reviewed: " +
      "She clicks Reply", () => {
    majasBrowser.topic.clickReplyToOrigPost();
  });

  it("... writes something", () => {
    majasBrowser.editor.editText("won't be accepted");
  });

  it("... attempts to save", () => {
    majasBrowser.editor.clickSave();
  });

  it("... but the server pops up an error dialog that says she needs to wait for review", () => {
    majasBrowser.serverErrorDialog.waitAndAssertTextMatches(/approve.*EsE6YKF2_/);
  });

  it("... she closes the dialog", () => {
    majasBrowser.serverErrorDialog.close();
    majasBrowser.waitUntilModalGone(); // is this needed ?
  });

  it("... and closes the editor", () => {
    majasBrowser.editor.cancelNoHelp();
  });


  // A stranger doesn't see Maja's posts
  // -------------------------------------

  it("Maja leaves, a stranger arrives", () => {
    majasBrowser.go('/');
    majasBrowser.topbar.clickLogout();
    assert(majasBrowser === strangersBrowser);
  });

  it("The stranger doesn't see Maja's not-yet-approved topic in the topic list", () => {
    strangersBrowser.refresh();
    strangersBrowser.forumTopicList.waitForTopics();
    strangersBrowser.forumTopicList.assertNumVisible(1);
    strangersBrowser.forumTopicList.assertTopicVisible(topics.oldTopicTitle);
  });

  it("... and sees that Maja's replies need approval", () => {
    strangersBrowser.go(topics.oldTopicUrl);
    strangersBrowser.topic.assertPostNeedsApprovalBodyHidden(2);
    strangersBrowser.topic.assertPostNeedsApprovalBodyHidden(3);
    strangersBrowser.topic.assertPostNeedsApprovalBodyHidden(4);
  });

  it("... and, when accessed directly, Maja' pending-approval page is hidden", () => {
    strangersBrowser.go(topics.majasTopicUrl);
    // strangersBrowser.topic.assertPagePendingApprovalBodyHidden();
    strangersBrowser.assertWholePageHidden();
  });


  // Michael also doesn't see Maja's posts
  // -------------------------------------

  it("Michael logs in", () => {
    assert(strangersBrowser === michaelsBrowser);
    michaelsBrowser.go('/');
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
  });

  it("... he doesn't see Maja's not-yet-approved topic in the topic list", () => {
    michaelsBrowser.forumTopicList.waitForTopics();
    michaelsBrowser.forumTopicList.assertNumVisible(1);
    michaelsBrowser.forumTopicList.assertTopicVisible(topics.oldTopicTitle);
  });

  it("... and when accessed directly, Maja' pending-approval page is hidden", () => {
    michaelsBrowser.go(topics.majasTopicUrl);
    // michaelsBrowser.topic.assertPagePendingApprovalBodyHidden();
    michaelsBrowser.assertWholePageHidden();
  });

  it("... and he doesn't see Maja's not-yet-approved replies", () => {
    michaelsBrowser.go(topics.oldTopicUrl);
    michaelsBrowser.topic.assertPostNeedsApprovalBodyHidden(2);
    michaelsBrowser.topic.assertPostNeedsApprovalBodyHidden(3);
    michaelsBrowser.topic.assertPostNeedsApprovalBodyHidden(4);
  });


  // Owen approves
  // -------------------------------------

  it("Owen logs in", () => {
    owensBrowser.go(idAddress.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... goes to the admin area", () => {
    owensBrowser.topbar.myMenu.goToAdminReview();
  });

  it("... sees Maja's edits", () => {
    owensBrowser.adminArea.review.waitForTextToReview(threeIsOkay);
  });

  it("... approves Maja's first reply", () => {
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions();
  });

  // Should Maria get a notf email that her reply now is approved?  TyTE2E062KR

  it("Then Michael sees that reply, but not any others", () => {
    michaelsBrowser.topic.refreshUntilPostNotPendingApproval(4);
  });

  /* Currently she cannot post any more replies, although one was approved, hmm.

  it("Maja can post one more reply (because 4 pending replies are allowed)", () => {
    assert(michaelsBrowser === majasBrowser);
    michaelsBrowser.topbar.clickLogout();
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
    majasBrowser.complex.replyToOrigPost("My yet-another-reply");
  });

  it("... but not more than one", () => {
    majasBrowser.complex.replyToOrigPost("Won't be accepted");
    majasBrowser.serverErrorDialog.waitAndAssertTextMatches(/approve.*EsE6YKF2_/);
    majasBrowser.serverErrorDialog.close();
    majasBrowser.editor.cancel();
  });
  */


  // Owen's next approval cascades
  // -------------------------------------

  it("Owen approves another reply, the approval cascades...", () => {
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions();
  });

  it("So now Michael sees all Maja's replies", () => {
    // This often fails:
    // michaelsBrowser.refresh();
    // michaelsBrowser.topic.assertPostNotPendingApproval(2); then 3 then 4
    // Instead: (and need to do like this for all of 2,3,4)
    michaelsBrowser.topic.refreshUntilPostNotPendingApproval(2);
    michaelsBrowser.topic.refreshUntilPostNotPendingApproval(3);
    michaelsBrowser.topic.refreshUntilPostNotPendingApproval(4);
  });

  it("... and Maja's edits are there", () => {
    michaelsBrowser.topic.assertPostTextMatches(4, threeIsOkay);
  });

  it("... and sees Maja's topic in the topic list", () => {
    michaelsBrowser.go('/');
    michaelsBrowser.forumTopicList.waitForTopics();
    michaelsBrowser.forumTopicList.assertNumVisible(2);
    michaelsBrowser.forumTopicList.assertTopicVisible(topics.oldTopicTitle);
    michaelsBrowser.forumTopicList.assertTopicVisible(topics.majasTopicTitleEdited);
  });

  it("... and can access it", () => {
    michaelsBrowser.forumTopicList.goToTopic(topics.majasTopicTitleEdited);
    michaelsBrowser.topic.assertPageNotPendingApproval();
    michaelsBrowser.assertPageBodyMatches(topics.majasTopicTextEdited);
  });



  // Should Maria get notfified via email that Owen approved her post?  TyTE2E062KR
  // Or is that too chatty?

  // Maja allowed
  // -------------------------------------

  it("Maja can now post more replies, without them being queued for approval", () => {
    michaelsBrowser.topbar.clickLogout();
    assert(michaelsBrowser === majasBrowser);
    majasBrowser.go(topics.oldTopicUrl);
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
    majasBrowser.complex.replyToOrigPost("My more replies");
    majasBrowser.complex.addProgressReply("My even more replies");
    majasBrowser.topic.assertPostNotPendingApproval(5);
    majasBrowser.topic.assertPostNotPendingApproval(6, { wait: false });
  });


  // The stranger sees all Maja's stuff
  // -------------------------------------

  it("The stranger sees all Maja's replies", () => {
    majasBrowser.topbar.clickLogout();
    assert(majasBrowser === strangersBrowser);
    strangersBrowser.topic.assertPostNotPendingApproval(2);
    strangersBrowser.topic.assertPostNotPendingApproval(3, { wait: false });
    strangersBrowser.topic.assertPostNotPendingApproval(4, { wait: false });
    strangersBrowser.topic.assertPostNotPendingApproval(5, { wait: false });
    strangersBrowser.topic.assertPostNotPendingApproval(6, { wait: false });
  });

  it("... incl Maja's edits to reply three", () => {
    strangersBrowser.topic.assertPostTextMatches(4, threeIsOkay);
  });

  it("... and her topic in the topc list", () => {
    strangersBrowser.go('/');
    strangersBrowser.forumTopicList.waitForTopics();
    strangersBrowser.forumTopicList.assertNumVisible(2);
    strangersBrowser.forumTopicList.assertTopicVisible(topics.oldTopicTitle);
    strangersBrowser.forumTopicList.assertTopicVisible(topics.majasTopicTitleEdited);
  });


  // No more review task notfs
  // -------------------------------------

  it("Owen doesn't get more review task notfs, for Maja's posts", () => {
    server.assertLastEmailMatches(
        idAddress.id, owen.emailAddress, majasReplyThree, owensBrowser);
  });

});

