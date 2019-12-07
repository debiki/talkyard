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
let gmannesBrowser;

let idAddress: IdAddress;
let siteId: any;

const gmailCommentOne = 'gmailCommentOne';
const gmailCommentTwo = 'gmailCommentTwo';

const localHostname = 'comments-for-e2e-test-embdb3cvgm-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embdb3cvgm.localhost:8080';
const pageGggSlug = 'emb-cmts-b3c-ggg.html';


/**
 * This test requires the user to log in, with a verified email addr
 * (which in this case will be Gmail), before starting typing a comment.
 */
describe("emb cmts no cookies verif gmail   TyT795KB61368", () => {

  if (!settings.include3rdPartyDependentTests)
    return;

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    gmannesBrowser = everyonesBrowsers;
  });

  it("import a site", () => {
    const site: SiteData = make.forumOwnedByOwen(
        'embdb3cvgm', { title: "Emb Cmts No Cookeis Verif Gmail" });
    site.meta.localHostname = localHostname;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
    server.skipRateLimits(siteId);
  });

  it("create an embedding page b3c-ggg", () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/${pageGggSlug}`, makeHtml('b3c-ggg', '#022'));
    function makeHtml(pageName: string, bgColor: string): string {
      return utils.makeEmbeddedCommentsHtml({ pageName, discussionId: '', localHostname, bgColor});
    }
  });


  // ----- Sign up and post

  it("Gmanne, a Gmail user, opens embedding page ggg", () => {
    gmannesBrowser.go(embeddingOrigin + '/' + pageGggSlug);
  });

  it("He clicks Reply", () => {
    gmannesBrowser.switchToEmbeddedCommentsIrame();
    gmannesBrowser.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... signs up with Gmail", () => {
    gmannesBrowser.swithToOtherTabOrWindow();
    gmannesBrowser.loginDialog.createGmailAccount({
            email: settings.gmailEmail, password: settings.gmailPassword, username: 'gmanne' },
            { isInPopupAlready: true, anyWelcomeDialog: 'THERE_WILL_BE_NO_WELCOME_DIALOG' });
    gmannesBrowser.switchBackToFirstTabOrWindow();
  });

  it("... writes and submits a comment, won't need to login again", () => {
    gmannesBrowser.switchToEmbeddedEditorIrame();
    gmannesBrowser.editor.editText(gmailCommentOne);
    gmannesBrowser.editor.save();
  });

  it("... it appears", () => {
    gmannesBrowser.switchToEmbeddedCommentsIrame();
    gmannesBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    gmannesBrowser.topic.assertPostTextMatches(c.FirstReplyNr, gmailCommentOne);
  });

  it("After page refresh, Gmanne remains logged in — session saved in storage", () => {
    gmannesBrowser.refresh();
    gmannesBrowser.switchToEmbeddedCommentsIrame();
    assert.equal(gmannesBrowser.metabar.getMyUsernameInclAt(), '@gmanne');
  });

  it("He logs out", () => {
    gmannesBrowser.metabar.clickLogout();
  });

  it("After page refresh, he's still logged out", () => {
    gmannesBrowser.refresh();
    gmannesBrowser.complex.waitForNotLoggedInInEmbeddedCommentsIframe();
  });


  // ----- Log in and post

  it("He clicks Reply to post a 2rd comment", () => {
    gmannesBrowser.switchToEmbeddedCommentsIrame();
    gmannesBrowser.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... needs to log in", () => {
    gmannesBrowser.swithToOtherTabOrWindow();
    gmannesBrowser.loginDialog.loginWithGmail({
            email: settings.gmailEmail, password: settings.gmailPassword }, true);
    gmannesBrowser.switchBackToFirstTabOrWindow();
  });

  it("... types and submits the 2nd comment", () => {
    gmannesBrowser.switchToEmbeddedEditorIrame();
    gmannesBrowser.editor.editText(gmailCommentTwo);
    gmannesBrowser.editor.save();
  });

  it("... comment two appears", () => {
    gmannesBrowser.switchToEmbeddedCommentsIrame();
    gmannesBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 1);
    gmannesBrowser.topic.assertPostTextMatches(c.FirstReplyNr + 1, gmailCommentTwo);
  });


});

