/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

let browser: TyE2eTestBrowser;

let everyonesBrowsers;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let fidosBrowser: TyE2eTestBrowser;
let guestsBrowser: TyE2eTestBrowser;

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
const fidoCannotStopTyping = "fidoCannotStopTyping";
const owenCanReplyAlreadyLoggedIn = "owenCanReplyAlreadyLoggedIn";

const localHostname = 'comments-for-e2e-test-embguest-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embguest.localhost:8080';
const pageSlug = 'emb-cmts-guest.html';
const pageUrl = embeddingOrigin + '/' + pageSlug;


describe("emb cmts guest login  TyT8FUKB2T4", () => {

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
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
    // Need to disable Akismet, otherwise it sometimes thinks Fido's comments are spam.
    site.settings.enableAkismet = false;
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

<script>talkyardCommentsServerUrl='${settings.scheme}://${localHostname}.localhost';</script>
<script async defer src="${settings.scheme}://${localHostname}.localhost/-/talkyard-comments.js"></script>
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
    // Dupl code 0. [60290KWFUDTT]
    guestsBrowser.topic.clickReplyToEmbeddingBlogPost();
    guestsBrowser.switchToEmbeddedEditorIrame();
    guestsBrowser.editor.editText(gundesCommentOne);
    guestsBrowser.editor.save();
  });

  it("... logs in as guest, with email", () => {
    // Dupl code 1. [60290KWFUDTT]
    guestsBrowser.swithToOtherTabOrWindow();
    guestsBrowser.disableRateLimits();
    guestsBrowser.loginDialog.signUpLogInAs_Real_Guest(gundesName, gundesEmailAddr);
    guestsBrowser.switchBackToFirstTabOrWindow();
  });

  it("... the comment appears", () => {
    // Dupl code 2. [60290KWFUDTT]
    guestsBrowser.switchToEmbeddedCommentsIrame();
    guestsBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    guestsBrowser.topic.assertPostTextMatches(c.FirstReplyNr, gundesCommentOne);
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
    guestsBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 1);
    guestsBrowser.topic.assertPostTextMatches(c.FirstReplyNr + 1, gillansCommentOne);
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
    guestsBrowser.unsubscribePage.confirmUnsubscription();
  });

  it("Gillan posts another reply to Gunde", () => {
    guestsBrowser.go(pageUrl);
    guestsBrowser.switchToEmbeddedCommentsIrame();
    guestsBrowser.topic.clickReplyToPostNr(2);  // Gunde's comment, again
    guestsBrowser.switchToEmbeddedEditorIrame();
    guestsBrowser.editor.editText(gillansCommentTwo);
    guestsBrowser.editor.save();
    // (now no login dialog appears — Gillan is already logged in)
    /*
    //   YES login dialog appears, see below...
    //  NO, I chaned back again, [YESCOOKIES]
    //  and now use cookies also for guests. Safari's ITP only blocks cookies, it
    //  doesn't block the whole iframe? at least not if there're no cookies initially;
    //  no cookies until the user has interacted with the iframe?
    //  What about Privacy Badger, it won't block an
    //  iframe when the user has interacted with it? (intentionally logged in)
  });

  it("Gillan needs to login again: guest sessions are forgotten on page reload, so tracker blockers " +
    "(PrivacyBadger, iOS built-in, etc) won't think is a tracker  TyT5WBK0267 [NOCOOKIES]", () => {
    guestsBrowser.swithToOtherTabOrWindow();
    guestsBrowser.disableRateLimits();
    guestsBrowser.loginDialog.signUpLogInAs_Real_Guest("Gillan Again");
    guestsBrowser.switchBackToFirstTabOrWindow();
    */
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
    fidosBrowser.switchToEmbeddedCommentsIrame()
    fidosBrowser.metabar.clickLogout();
  });

  it("... then logs in and types a comment", () => {
    fidosBrowser.topic.clickReplyToPostNr(5);  // Gunde's question — Fido has an answer
    fidosBrowser.switchToEmbeddedEditorIrame();
    fidosBrowser.editor.editText(fidosAnswer);
    fidosBrowser.editor.save();
    fidosBrowser.swithToOtherTabOrWindow();
    fidosBrowser.loginDialog.createPasswordAccount({
        username: 'woff', password: 'public-waff-waff-waff', email: 'e2e-test--woff@example.com' },
        false,
        'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG');
    fidosBrowser.switchBackToFirstTabOrWindow();
  });

  it("... then posts one more comment: a clever and funny joke, this time", () => {
    // Wait until both iframes have noticed we've logged in. Otherwise, without this,
    // they sometimes got out of sync: ? One iframe ran a login callback before the other,
    // and the post-reply click happened in between ?
    fidosBrowser.complex.waitForLoggedInInEmbeddedCommentsIrames();
    // Without this, in FF, the click just never happens, because the Reply button isn't in
    // the viewport. And there's no error message — the test just silently hangs until timeout.
    // Also, sometimes won't work the first time, in FF. [4RDEDA0]
    utils.tryManyTimes('FidoScrollTopReply', 3, () => {
      fidosBrowser.scrollToTop();
      fidosBrowser.complex.replyToEmbeddingBlogPost(theCleverAndFunnyJoke);
    });
  });

  it("Fido refreshes the page", () => {
    fidosBrowser.refresh();
  });

  it("... and he cannot stop typing. He doesn't need to login, since now cookies in use, " +
      "because per-page-load login is for guests only", () => {
    fidosBrowser.complex.replyToEmbeddingBlogPost(fidoCannotStopTyping);
  });

  it("Owen goes to the admin area and logs in", () => {
    owensBrowser.go(idAddress.origin + '/-/admin/review/all');
    owensBrowser.loginDialog.loginWithPassword(owen);
  });

  it("The guests' comments are in the review queue, although num-to-approve & -reveiw both are 0", () => {
    // Here's the code that ensures the guests' comments get reviewed: [4JKFWP4]
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

  it("When Owen goes back to the dicussion, he is logged in", () => {
    owensBrowser.go(pageUrl);
  });

  it("... and can post a comment", () => {
    owensBrowser.complex.replyToEmbeddingBlogPost(owenCanReplyAlreadyLoggedIn);
  });

});

