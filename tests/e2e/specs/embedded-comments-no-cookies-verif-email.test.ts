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
let maria;
let mariasBrowser;

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

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
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
    mariasBrowser.go(pageAaaUrl);
  });

  it("... Signs up", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
    mariasBrowser.swithToOtherTabOrWindow();
    mariasBrowser.loginDialog.createPasswordAccount(maria);
    mariasBrowser.close();  // close the popup with a check-your-email message
  });

  it("... clicks an email verif link", () => {
    // This'll run this server side code: [TyT072FKHRPJ5]

    const email = server.getLastEmailSenTo(siteId, maria.emailAddress, mariasBrowser);
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

  it("Maria clicks Reply", () => {
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... NO:  and currently needs to log in again", () => {
    // COULD avoid this 2nd login, by incl a one-time login secret in URL to the embedding page.
    // In the #hash fragment then? Since shouldn't be sent to the server powering the blog,
    // but instead read by Talkyard's javascript and passed on to the iframe, which in turn
    // sends it to the server, just once, and gets back a login session — and the server
    // invalidates the secret.  [0439BAS2]  DONE
    //mariasBrowser.loginDialog.loginWithPasswordInPopup(maria);
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
    mariasBrowser.go(embeddingOrigin + '/' + pageBbbSlug);
    source = mariasBrowser.getSource();
    assert(source.indexOf('b3c-bbb') > 0);
  });

  it("Posts a 2nd comment", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... NO: needs to log in again, because cookies blocked", () => {
    //mariasBrowser.loginDialog.loginWithPasswordInPopup(maria);
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
    mariasBrowser.refresh();
    mariasBrowser.switchToEmbeddedCommentsIrame();
    assert.equal(mariasBrowser.metabar.getMyUsernameInclAt(), '@maria');
    //mariasBrowser.complex.waitForNotLoggedInInEmbeddedCommentsIframe();
  });

  it("She logs out", () => {
    mariasBrowser.metabar.clickLogout();
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

