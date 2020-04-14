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
let maria;
let mariasBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

const mariasCommentOnePageAaa = 'mariasCommentOnePageAaa';
const mariasCommentTwoPageBbb = 'mariasCommentTwoPageBbb';
const mariasCommentThreePageBbb = 'mariasCommentThreePageBbb';

const localHostname = 'comments-for-e2e-test-embdb3cve-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embdb3cve.localhost:8080';
const pageAaaSlug = 'emb-cmts-b3c-aaa.html';
const pageBbbSlug = 'emb-cmts-b3c-bbb.html';

const pageAaaUrl = embeddingOrigin + '/' + pageAaaSlug;

describe("emb cmts no cookies verif email   TyT795KB69285", () => {

  it("ensure cookies disabled?", () => {
    assert(settings.block3rdPartyCookies);
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    mariasBrowser = everyonesBrowsers;
    maria = make.memberMaria();
  });

  it("import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('embdb3cve', { title: "Emb Cmts No Cookeis Verf Eml" });
    site.meta.localHostname = localHostname;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
    server.skipRateLimits(siteId);
  });

  it("create two embedding pages b3c-aaa & b3c-bbb", () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/${pageAaaSlug}`, makeHtml('b3c-aaa', '#500'));
    fs.writeFileSync(`${dir}/${pageBbbSlug}`, makeHtml('b3c-bbb', '#040'));
    function makeHtml(pageName: string, bgColor: string): string {
      return utils.makeEmbeddedCommentsHtml({ pageName, discussionId: '', localHostname, bgColor});
    }
  });

  it("Maria opens embedding page aaa", () => {
    mariasBrowser.go2(pageAaaUrl);
  });

  it("... Signs up", () => {
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
    mariasBrowser.swithToOtherTabOrWindow();
    mariasBrowser.loginDialog.createPasswordAccount(maria);
    mariasBrowser.closeWindowSwitchToOther();  // close the popup with a check-your-email message
  });

  it("... clicks an email verif link", () => {
    // This'll run this server side code: [TyT072FKHRPJ5]
    //
    // The server redirects the browser back to the blog post, pageAaaUrl, and
    // includes a one-time login secret in the url hash, which our javascript
    // on that embedding page then find, and sends to the iframe, which in turn
    // sends it to the server, and gets back a login session id.

    const email = server.getLastEmailSenTo(siteId, maria.emailAddress, wdioBrowserA);
    const link = utils.findFirstLinkToUrlIn(
        idAddress.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    mariasBrowser.go(link);
    mariasBrowser.repeatUntilAtNewUrl(() => {
      mariasBrowser.waitAndClick('#e2eContinue');
    });
  });

  it("... gets redirected back to the blog", () => {
    assert.equal(mariasBrowser.urlNoHash(), pageAaaUrl);
  });

  it("... now logged in", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.metabar.waitUntilLoggedIn()
  });

  it("... as Maria", () => {
    assert.equal(mariasBrowser.metabar.getMyUsernameInclAt(), '@maria');
  });

  it("Maria clicks Reply — no need to log in again", () => {
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... writes and submits a comment", () => {
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText(mariasCommentOnePageAaa);
    mariasBrowser.editor.save();
  });

  it("... it appears", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    mariasBrowser.topic.assertPostTextMatches(c.FirstReplyNr, mariasCommentOnePageAaa);
  });

  it("she goes to page bbb", () => {
    let source = mariasBrowser.getSource();
    assert(source.indexOf('b3c-aaa') > 0);
    mariasBrowser.go2(embeddingOrigin + '/' + pageBbbSlug);
    source = mariasBrowser.getSource();
    assert(source.indexOf('b3c-bbb') > 0);
  });

  it("Posts a 2nd comment, no need to login — session remembered in storage", () => {
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... types and submits the 2nd comment", () => {
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText(mariasCommentTwoPageBbb);
    mariasBrowser.editor.save();
  });

  it("... comment two appears too", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    mariasBrowser.topic.assertPostTextMatches(c.FirstReplyNr, mariasCommentTwoPageBbb);
  });

  it("After page refresh, she's still logged in", () => {
    mariasBrowser.refresh2();
    mariasBrowser.switchToEmbeddedCommentsIrame();
    assert.equal(mariasBrowser.metabar.getMyUsernameInclAt(), '@maria');
  });

  it("She logs out", () => {
    mariasBrowser.metabar.clickLogout();
    mariasBrowser.complex.waitForNotLoggedInInEmbeddedCommentsIframe();
  });

  it("... after refresh, she is still logged out", () => {
    mariasBrowser.refresh2();
    mariasBrowser.complex.waitForNotLoggedInInEmbeddedCommentsIframe();
  });

  it("She clicks Reply to post a 3rd comment", () => {
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... needs to log in", () => {
    mariasBrowser.loginDialog.loginWithPasswordInPopup(maria);
  });

  it("... types and submits the 3rd comment", () => {
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText(mariasCommentThreePageBbb);
    mariasBrowser.editor.save();
  });

  it("... comment three appears", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 1);
    mariasBrowser.topic.assertPostTextMatches(c.FirstReplyNr + 1, mariasCommentThreePageBbb);
  });


});

