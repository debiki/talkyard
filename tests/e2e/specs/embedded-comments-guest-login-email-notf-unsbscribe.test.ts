/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pages = require('../utils/pages');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;

let everyonesBrowsers;
let owen: Member;
let owensBrowser;
let fidosBrowser;
let guestsBrowser;

let idAddress: IdAddress;
let siteId: any;

const gundesName = 'Gunde Guest';
const gundesEmailAddr = 'e2e-test--gunde@example.com';
const gundesCommentOne = 'gundesCommentOne';
const gundesCommentTwo = 'gundesCommentTwo';
const gillansCommentOne = 'gillansCommentOne';
const gillansCommentTwo = 'gillansCommentTwo';
const fidosAnswer = "Woff! Woff! Bark-bark-baba-wo-ba-ff-rkrk-ff-ffow-w-ow! Woff! Woff.";
const theCleverAndFunnyJoke = "Yaffle yaffle yawp yawp - yaffapw, bark, ba-woff woff. ...   .... Wiff!";

const localHostname = 'comments-for-e2e-test-embguest-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embguest.localhost:8080';
const pageSlug = 'emb-cmts-guest.html';
const pageUrl = embeddingOrigin + '/' + pageSlug;


describe("emb cmts guest login", () => {

  it("initialize people", () => {
    browser.perhapsDebugBefore();
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    guestsBrowser = everyonesBrowsers;
    fidosBrowser = everyonesBrowsers;
    owensBrowser = everyonesBrowsers;
    owen = make.memberOwenOwner();
  });

  it("import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('embguest', { title: "Emb Cmts Disc Id Test" });
    site.meta.localHostname = localHostname;
    site.settings.numFirstPostsToApprove = 0;
    site.settings.numFirstPostsToReview = 1;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;
    site.settings.mayComposeBeforeSignup = true;
    site.settings.mayPostBeforeEmailVerified = true;
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("create embedding page", () => {
    const dirPath = 'target';
    fs.writeFileSync(`${dirPath}/${pageSlug}`, `
<html>
<head>
<title>Embedded comments E2E test</title>
</head>
<body style="background: black; color: #ccc; font-family: monospace">
<p>This is an embedded comments E2E test page. Ok to delete. 6UKK2QZ03F. The comments:</p>

<script>talkyardCommentsServerUrl='http://${localHostname}.localhost';</script>
<script async defer src="http://${localHostname}.localhost/-/talkyard-comments.js"></script>
<div class="talkyard-comments" style="margin-top: 45px;">
<p>/End of page.</p>
</body>
</html>`);
  });

  it("Gunde Guest opens the embedding page", () => {
    guestsBrowser.go(pageUrl);
    guestsBrowser.switchToEmbeddedCommentsIrame();
    guestsBrowser.disableRateLimits();
  });

  it("... clicks Reply, types a comment, clicks submit", () => {
    guestsBrowser.topic.clickReplyToEmbeddingBlogPost();
    guestsBrowser.switchToEmbeddedEditorIrame();
    guestsBrowser.editor.editText(gundesCommentOne);
    guestsBrowser.editor.save();
  });

  it("... logs in as guest, with email", () => {
    guestsBrowser.swithToOtherTabOrWindow();
    guestsBrowser.disableRateLimits();
    guestsBrowser.loginDialog.signUpLogInAs_Real_Guest(gundesName, gundesEmailAddr);
    guestsBrowser.switchBackToFirstTabOrWindow();
  });

  it("... the comment appears", () => {
    guestsBrowser.switchToEmbeddedCommentsIrame();
    guestsBrowser.topic.waitForPostNrVisible(2);  // that's the first reply nr, = comment 1
    guestsBrowser.topic.assertPostTextMatches(2, gundesCommentOne);
  });

  it("He logs out", () => {
    guestsBrowser.metabar.clickLogout();
  });

  it("Gillan Guest types a reply", () => {
    guestsBrowser.topic.clickReplyToPostNr(2);  // Gunde's comment
    guestsBrowser.switchToEmbeddedEditorIrame();
    guestsBrowser.editor.editText(gillansCommentOne);
    guestsBrowser.editor.save();
  });

  it("... logs in as guest, with no email", () => {
    guestsBrowser.swithToOtherTabOrWindow();
    guestsBrowser.disableRateLimits();
    guestsBrowser.loginDialog.signUpLogInAs_Real_Guest("Gillan Guest");
    guestsBrowser.switchBackToFirstTabOrWindow();
  });

  it("... her comment appears", () => {
    guestsBrowser.switchToEmbeddedCommentsIrame();
    guestsBrowser.topic.waitForPostNrVisible(3);
    guestsBrowser.topic.assertPostTextMatches(3, gillansCommentOne);
  });

  it("Gunde gets a reply notf email", () => {
    server.waitUntilLastEmailMatches(siteId, gundesEmailAddr, [gillansCommentOne], browser);
  });

  it("... he clicks the Unsubscribe link", () => {
    const unsubLink = server.getLastUnsubscriptionLinkEmailedTo(
        idAddress.id, gundesEmailAddr, guestsBrowser);
    guestsBrowser.go(unsubLink);
  });

  it("... and unsubscribes", () => {
    guestsBrowser.waitAndClick('input[type=submit]');
  });

  it("Gillan posts another reply to Gunde", () => {
    guestsBrowser.go(pageUrl);
    guestsBrowser.switchToEmbeddedCommentsIrame();
    guestsBrowser.topic.clickReplyToPostNr(2);  // Gunde's comment, again
    guestsBrowser.switchToEmbeddedEditorIrame();
    guestsBrowser.editor.editText(gillansCommentTwo);
    guestsBrowser.editor.save();
    // (now no login dialog appears — Gillan is already logged in)
  });

  it("... her 2nd comment appears", () => {
    guestsBrowser.switchToEmbeddedCommentsIrame();
    guestsBrowser.topic.waitForPostNrVisible(4);
    guestsBrowser.topic.assertPostTextMatches(4, gillansCommentTwo);
  });

  it("Gunde replies, mentions @owen_owner", () => {
    guestsBrowser.metabar.clickLogout();
    guestsBrowser.topic.clickReplyToPostNr(4);  // Gillan's comment
    guestsBrowser.switchToEmbeddedEditorIrame();
    guestsBrowser.editor.editText(gundesCommentTwo +
        " — and, @owen_owner, what's your name? And do you know who is the owner?");
    guestsBrowser.editor.save();
    guestsBrowser.swithToOtherTabOrWindow();
    guestsBrowser.loginDialog.signUpLogInAs_Real_Guest(gundesName, gundesEmailAddr);
    guestsBrowser.switchBackToFirstTabOrWindow();
  });

  it("Now Owen gets a notf", () => {
    server.waitUntilLastEmailMatches(siteId, owen.emailAddress, [gundesCommentTwo], browser);
  });

  it("But Gunde ditn't get a notf (about Gillan's comment) because he unsubscribed", () => {
    // A reply notf email about Gillan's 2nd comment would have been sent before the notf email to Owen.
    // Above, we verified that Owen did get an email. And if Gunde hasn't gotten any email yet, here
    // — then he has indeed unsubscried successfully.
    // Gunde's last notf email should still be Gillan's comment nr One, not Two:
    server.waitUntilLastEmailMatches(siteId, gundesEmailAddr, [gillansCommentOne], browser);
  });

  it("A dog, named Fido, takes Gunde's laptop, logs out Gunde", () => {
    fidosBrowser.switchToEmbeddedCommentsIrame();
    fidosBrowser.metabar.clickLogout();
  });

  it("... then logs in and types a comment", () => {
    fidosBrowser.topic.clickReplyToPostNr(5);  // Gunde's question — Fido has an answer
    fidosBrowser.switchToEmbeddedEditorIrame();
    fidosBrowser.editor.editText(fidosAnswer);
    fidosBrowser.editor.save();
    fidosBrowser.swithToOtherTabOrWindow();
    fidosBrowser.loginDialog.createPasswordAccount({
        username: 'woff', password: 'public-woff-woff-woff', email: 'e2e-test--woff@example.com' },
        false,
        'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG');
    fidosBrowser.switchBackToFirstTabOrWindow();
  });

  it("... and posts one more comment: a clever and funny joke, this time", () => {
    fidosBrowser.complex.replyToEmbeddingBlogPost(theCleverAndFunnyJoke);
  });

  it("Owen goes to the admin area and logs in", () => {
    owensBrowser.go(idAddress.origin + '/-/admin/review/all');
    owensBrowser.loginDialog.loginWithPassword(owen);
  });

  it("The guests' comments are in the review queue, although num-to-approve & -reveiw both are 0", () => {
    owensBrowser.adminArea.review.waitUntilLoaded();
    owensBrowser.adminArea.review.waitForTextToReview(gundesCommentOne);   // 1
    owensBrowser.adminArea.review.waitForTextToReview(gundesCommentTwo);   // 2
    owensBrowser.adminArea.review.waitForTextToReview(gillansCommentOne);  // 3
    owensBrowser.adminArea.review.waitForTextToReview(gillansCommentTwo);  // 4
  });

  it("Only Fido's first comment is there, because he created a real account", () => {
    // ... and then site.settings.numFirstPostsToReview = 1 has effect
    owensBrowser.adminArea.review.waitForTextToReview(fidosAnswer);        // 5
    const num = owensBrowser.adminArea.review.countThingsToReview();
    logAndDie.dieIf(num !== 5, 'TyEJKUF6', `There are ${num} things to review, !== 5`);
  });

});

