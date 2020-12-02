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
let gmannesBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

const gmailCommentOne = 'gmailCommentOne';
const gmailCommentTwo = 'gmailCommentTwo';

const localHostname = 'comments-for-e2e-test-embdb3cugm-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embdb3cugm.localhost:8080';
const pageGggSlug = 'emb-cmts-b3c-ggg.html';


/**
 * This test lets the user starts typing before logging in; hen won't need to login,
 * until when submitting hens comment, and won't need to verify hens email
 * (however, since gmail is in use here, the addr has been verified anyway actually).
 */
describe("emb cmts no cookies unverif gmail   TyT6224BKA253", () => {

  if (!settings.include3rdPartyDependentTests)
    return;

  it("ensure cookies disabled?", () => {
    assert(settings.block3rdPartyCookies);
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    gmannesBrowser = everyonesBrowsers;
  });

  it("import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('embdb3cugm',
        { title: "Emb Cmts No Cookeis Unver Gmail" });
    site.meta.localHostname = localHostname;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
    site.settings.requireVerifiedEmail = false;
    site.settings.mayComposeBeforeSignup = true;
    site.settings.mayPostBeforeEmailVerified = true;
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
    server.skipRateLimits(siteId);
  });

  it("create an embedding page b3c-ggg", () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/${pageGggSlug}`, makeHtml('b3c-ggg', '#202'));
    function makeHtml(pageName: string, bgColor: string): string {
      return utils.makeEmbeddedCommentsHtml({ pageName, discussionId: '', localHostname, bgColor});
    }
  });

  it("Gmanne, a Gmail user, opens embedding page ggg", () => {
    gmannesBrowser.go2(embeddingOrigin + '/' + pageGggSlug);
  });

  it("He clicks Reply", () => {
    gmannesBrowser.switchToEmbeddedCommentsIrame();
    gmannesBrowser.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... writes and submits a comment", () => {
    gmannesBrowser.switchToEmbeddedEditorIrame();
    gmannesBrowser.editor.editText(gmailCommentOne);
    gmannesBrowser.editor.save();
  });

  it("... when submitting, signs up with Gmail", () => {
    gmannesBrowser.swithToOtherTabOrWindow();
    gmannesBrowser.loginDialog.createGmailAccount({
            email: settings.gmailEmail, password: settings.gmailPassword, username: 'gmanne' },
            { isInPopupAlready: true, anyWelcomeDialog: 'THERE_WILL_BE_NO_WELCOME_DIALOG' });
  });

  it("... the comment appears", () => {
    gmannesBrowser.switchBackToFirstTabOrWindow();
    gmannesBrowser.switchToEmbeddedCommentsIrame();
    gmannesBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    gmannesBrowser.topic.assertPostTextMatches(c.FirstReplyNr, gmailCommentOne);
  });

  it("After page refresh, Gmanne remains logged in — session saved in storage", () => {
    gmannesBrowser.refresh2();
    gmannesBrowser.switchToEmbeddedCommentsIrame();
    assert.equal(gmannesBrowser.metabar.getMyUsernameInclAt(), '@gmanne');
  });

  it("... the comment is still there", () => {
    gmannesBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, gmailCommentOne);
  });

  it("Gmanne logs out", () => {
    gmannesBrowser.metabar.clickLogout();
  });

  it("... after page refresh, Gmanne is still logged out", () => {
    gmannesBrowser.refresh2();
    gmannesBrowser.complex.waitForNotLoggedInInEmbeddedCommentsIframe();
  });

  it("Gmanne clicks Reply to post a 2rd comment", () => {
    gmannesBrowser.switchToEmbeddedCommentsIrame();
    gmannesBrowser.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... types and submits the 2nd comment", () => {
    gmannesBrowser.switchToEmbeddedEditorIrame();
    gmannesBrowser.editor.editText(gmailCommentTwo);
    gmannesBrowser.editor.save();
  });

  it("... needs to log in again", () => {
    gmannesBrowser.swithToOtherTabOrWindow();
    gmannesBrowser.loginDialog.loginWithGmail({
            email: settings.gmailEmail, password: settings.gmailPassword }, true);
    gmannesBrowser.switchBackToFirstTabOrWindow();
  });

  it("... comment two appears", () => {
    gmannesBrowser.switchToEmbeddedCommentsIrame();
    gmannesBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 1);
    gmannesBrowser.topic.assertPostTextMatches(c.FirstReplyNr + 1, gmailCommentTwo);
  });


});

