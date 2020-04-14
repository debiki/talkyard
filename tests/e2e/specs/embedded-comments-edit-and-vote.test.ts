/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import c = require('../test-constants');

let browser: TyE2eTestBrowser;

let everyonesBrowsers;
let maja;
let majasBrowser: TyE2eTestBrowser;
let michael;
let michaelsBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

const majasFirstComment = 'majasFirstComment';
const majasFirstCommentEdited = 'majasFirstCommentEdited';
const majasFirstCommentEditedTwice = 'majasFirstCommentEditedTwice';
const michaelsComment = 'michaelsComment';
const michaelsCommentEdited = 'michaelsCommentEdited';

const localHostname = 'comments-for-e2e-test-embedvo-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embedvo.localhost:8080';
const pageSlug = 'emb-cmts-edit-and-vote.html';
const pageUrl = embeddingOrigin + '/' + pageSlug;


describe("emb cmts edit and vote", () => {

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    majasBrowser = everyonesBrowsers;
    michaelsBrowser = everyonesBrowsers;
    maja = make.memberMaja();
    michael = make.memberMichael();
  });

  it("import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('embedvo', { title: "Emb Cmts Edit and Vote Test" });
    site.meta.localHostname = localHostname;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
    site.settings.requireVerifiedEmail = false;
    site.settings.mayPostBeforeEmailVerified = true;
    site.members.push(maja);
    site.members.push(michael);
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
<body style="background: #620; color: #ccc; font-family: monospace">
<p>This is an embedded comments E2E test page. Ok to delete. 4BKQ2C8J9R. The comments:</p>

<script>talkyardCommentsServerUrl='${settings.scheme}://${localHostname}.localhost';</script>
<script async defer src="${settings.scheme}://${localHostname}.localhost/-/talkyard-comments.js"></script>
<div class="talkyard-comments" style="margin-top: 45px;">

<p>/End of page.</p>
</body>
</html>`);
  });

  it("Maja opens the embedding page", () => {
    majasBrowser.go(pageUrl);
    majasBrowser.switchToEmbeddedCommentsIrame();
    majasBrowser.disableRateLimits();
  });

  it("... clicks Reply, logs in", () => {
    majasBrowser.topic.clickReplyToEmbeddingBlogPost();
    majasBrowser.loginDialog.loginWithPasswordInPopup(maja);
  });

  it("... posts a comment", () => {
    majasBrowser.switchToEmbeddedEditorIrame();
    majasBrowser.editor.editText(majasFirstComment);
    majasBrowser.editor.save();
  });

  it("... it appears", () => {
    majasBrowser.switchToEmbeddedCommentsIrame();
    majasBrowser.topic.waitForPostNrVisible(2);  // that's the first reply nr, = comment 1
    majasBrowser.topic.assertPostTextMatches(2, majasFirstComment);
  });

  it("She edits her comment (new comment, new page)", () => {
    majasBrowser.topic.clickEditoPostNr(2);
    majasBrowser.switchToEmbeddedEditorIrame();
    majasBrowser.editor.editText(majasFirstCommentEdited);
    majasBrowser.editor.save();
    majasBrowser.switchToEmbeddedCommentsIrame();
    majasBrowser.topic.waitUntilPostTextMatches(2, majasFirstCommentEdited);
  });

  it("She can edit it, also after reloading the page (old comment, old page)", () => {
    majasBrowser.refresh();
    majasBrowser.switchToEmbeddedCommentsIrame();
    majasBrowser.topic.clickEditoPostNr(c.FirstReplyNr);
    majasBrowser.switchToEmbeddedEditorIrame();
    majasBrowser.editor.editText(majasFirstCommentEditedTwice);
    majasBrowser.editor.save();
    majasBrowser.switchToEmbeddedCommentsIrame();
    majasBrowser.topic.waitUntilPostTextMatches(2, majasFirstCommentEditedTwice);
  });

  it("She cannot upvote", () => {
    assert(!majasBrowser.topic.canVoteLike(2), "Maja can Like her own comment");
  });

  it("Maja leaves", () => {
    majasBrowser.waitAndClick('.dw-a-logout');
  });

  it("Michael clicks Reply, logs in", () => {
    michaelsBrowser.switchToEmbeddedCommentsIrame();
    michaelsBrowser.topic.waitForReplyButtonAssertCommentsVisible();
    michaelsBrowser.topic.clickReplyToPostNr(2);
    michaelsBrowser.loginDialog.loginWithPasswordInPopup(michael);
  });

  it("... and replies to Maja", () => {
    michaelsBrowser.switchToEmbeddedEditorIrame();
    michaelsBrowser.editor.editText(michaelsComment);
    michaelsBrowser.editor.save();
  });

  it("... his comment it appears", () => {
    michaelsBrowser.switchToEmbeddedCommentsIrame();
    michaelsBrowser.topic.waitForPostNrVisible(2);
    michaelsBrowser.topic.waitForPostNrVisible(3);
    michaelsBrowser.topic.assertPostTextMatches(2, majasFirstCommentEditedTwice);
    michaelsBrowser.topic.assertPostTextMatches(3, michaelsComment);
  });

  it("... he can edit it (new comment, old page)", () => {
    michaelsBrowser.topic.clickEditoPostNr(3);
    michaelsBrowser.switchToEmbeddedEditorIrame();
    michaelsBrowser.editor.editText(michaelsCommentEdited);
    michaelsBrowser.editor.save();
    michaelsBrowser.switchToEmbeddedCommentsIrame();
    michaelsBrowser.topic.waitUntilPostTextMatches(3, michaelsCommentEdited);
  });

  it("He upvotes Maria's comment", () => {
    michaelsBrowser.topic.toggleLikeVote(2);
  });

  it("... and disagrees with it", () => {
    michaelsBrowser.topic.toggleDisagreeVote(2);
  });

  it("After page reload, his and Maria's edits are still there", () => {
    michaelsBrowser.refresh();
    michaelsBrowser.switchToEmbeddedCommentsIrame();
    michaelsBrowser.topic.waitForPostNrVisible(2);
    michaelsBrowser.topic.waitForPostNrVisible(3);
    michaelsBrowser.topic.assertPostTextMatches(2, majasFirstCommentEditedTwice);
    michaelsBrowser.topic.assertPostTextMatches(3, michaelsCommentEdited);
  });

});

