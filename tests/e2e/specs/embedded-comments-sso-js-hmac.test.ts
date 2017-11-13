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
const crypto = require('crypto');

declare let browser: any;

let everyonesBrowsers;
let mariasBrowser;
let monsBrowser;

let data;
let idAddress: IdAddress;
let siteId: any;

const mariasCommentOne = 'mariasCommentOne';
const mariasCommentTwo = 'mariasCommentTwo';
const mariasCommentThree = 'mariasCommentThree';

const localHostname = 'comments-for-e2e-test-embsso-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embsso.localhost:8080';
const pageASlug = 'emb-cmts-sso-a.html';
const pageBSlug = 'emb-cmts-sso-b.html';
const pageCSlug = 'emb-cmts-sso-c.html';
const pageDSlug = 'emb-cmts-sso-d.html';
const pageESlug = 'emb-cmts-sso-e.html';
const pageFSlug = 'emb-cmts-sso-f.html';


describe("emb cmts sso via js", () => {

  it("initialize people", () => {
    browser.perhapsDebugBefore();
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    mariasBrowser = everyonesBrowsers;
    monsBrowser = everyonesBrowsers;
  });

  it("import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('embsso', { title: "Emb Cmts SSO Test" });
    site.meta.localHostname = localHostname;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("create embedding pages that attempts to sso-login an external user", () => {
    const dir = 'target';
    const badHmac = 'zzzugh';

    const mariasSecret = 'public';
    const maria = { externalId: 'maria_ext_id', emailAddress: 'maria@x.co', username: 'maria',
        fullName: undefined, avatarUrl: undefined, aboutUser: undefined };
    const mariasHmacBytes = crypto.createHmac('sha256', mariasSecret);
    mariasHmacBytes.update(JSON.stringify(maria));
    const mariasHmacBase64 = mariasHmacBytes.digest('base64');
    console.log("Calculated HMAC for:  " + JSON.stringify(maria));
    console.log("        With secret:  " + mariasSecret);
    console.log("        The HMAC is:  " + mariasHmacBase64);

    const monsSecret = 'publicMons';
    const mons = { externalId: 'mons_ext_id', emailAddress: 'mons@x.co', username: 'mons' };
    const monsHmacBytes = crypto.createHmac('sha256', monsSecret);
    const monsHmacBase64 = monsHmacBytes.digest('base64');
    fs.writeFileSync(`${dir}/${pageASlug}`, makeHtml('sso-a', badHmac, maria, '#500'));
    fs.writeFileSync(`${dir}/${pageBSlug}`, makeHtml('sso-b', '', maria, '#050'));
    fs.writeFileSync(`${dir}/${pageCSlug}`, makeHtml('sso-c', null, maria, '#005', { skipHmac: true }));
    fs.writeFileSync(`${dir}/${pageDSlug}`, makeHtml('sso-d', mariasHmacBase64, maria, '#558'));

    fs.writeFileSync(`${dir}/${pageESlug}`, makeHtml('sso-e', mariasHmacBase64, mons, '#404')); // wrong user
    fs.writeFileSync(`${dir}/${pageFSlug}`, makeHtml('sso-f', monsHmacBase64, mons, '#558'));
    // TODO test then again as maria, auto switches user?
  });


  function makeHtml(pageName: string, hmacSha256Base64: string, user: any, bgColor: string,
        opts: any = {}): string {
    const hmacLine = opts.skipHmac ? '' : `edCurrentUserHmacSha256Base64 = '${hmacSha256Base64}'`;
    return `
<html>
<head>
<title>Embedded comments E2E test; SSO login and HMAC</title>
</head>
<body style="background: ${bgColor}; color: #ccc; font-family: monospace">
<p>Embedded comments E2E test page ${pageName}, ok to delete.<br>
hmac: "${hmacSha256Base64}"<br>
user: <code>${JSON.stringify(user)}</code><br>
The comments:
</p>

<script>
edCommentsServerUrl='http://${localHostname}.localhost';
${hmacLine}
edCurrentUser = {
  externalId: '${user.externalId}',
  emailAddress: '${user.emailAddress}',
  username: '${user.username}',
  fullName: '${user.fullName}',  // BAD XSS !!! Usea  JSON string instead.
  avatarUrl: '${user.avatarUrl}',
  aboutUser: '${user.aboutUser}'
};
</script>
<script async defer src="http://${localHostname}.localhost/-/ed-comments.v0.js"></script>
<!-- You can specify a per page discussion id on the next line, if your URLs might change. -->
<div class="ed-comments" data-discussion-id="" style="margin-top: 45px;">

<p>/End of page.</p>
</body>
</html>`;
  }

  it("Maria opens embedding page sso-a", () => {
    mariasBrowser.go(embeddingOrigin + '/' + pageASlug);
  });

  it("... there's a bad-HMAC error", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.waitForVisible('.s_SED_Wrap');
    mariasBrowser.assertTextMatches('.s_SED_Wrap', '_EdE2WBKG053');
  });

  it("Maria opens embedding page sso-d", () => {
    mariasBrowser.debug();
    mariasBrowser.go(embeddingOrigin + '/' + pageDSlug);
  });

  it("She is already logged in", () => {
  });

  /*
  it("Clicks Reply", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
    //mariasBrowser.loginDialog.loginWithPasswordInPopup(maria);
  });

  it("... writes and submits a comment", () => {
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText(mariasCommentOne);
    mariasBrowser.editor.save();
  });

  it("... it appears", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostNrVisible(2);  // that's the first reply nr, = comment 1
    mariasBrowser.topic.assertPostTextMatches(2, mariasCommentOne);
  });

  it("she goes from page aaa to bbb", () => {
    let source = mariasBrowser.getSource();
    assert(source.indexOf('aaa') > 0);
    mariasBrowser.go(embeddingOrigin + '/' + pageBbbSlug);
    source = mariasBrowser.getSource();
    assert(source.indexOf('bbb') > 0);
  });

  it("... sees her comment, because same discussion id", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostNrVisible(2);
    mariasBrowser.topic.assertPostTextMatches(2, mariasCommentOne);
  });

  it("she posts a comment on page bbb (already logged in)", () => {
    mariasBrowser.topic.clickReplyToPostNr(2);
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText(mariasCommentTwo);
    mariasBrowser.editor.save();
  });

  it("... comment two appears too", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostNrVisible(3);
    mariasBrowser.topic.assertPostTextMatches(3, mariasCommentTwo);
  });

  it("page ccc is unchanged, because has no id, so url used instead", () => {
    mariasBrowser.topic.waitForReplyButtonAssertCommentsVisible();
    mariasBrowser.go(embeddingOrigin + '/' + pageCccSlug);
    let source = mariasBrowser.getSource();
    assert(source.indexOf('ccc') > 0);
    mariasBrowser.switchToEmbeddedCommentsIrame();
    // Give any stuff that appears although it shouldn't, some time to load.
    mariasBrowser.pause(500);
    mariasBrowser.topic.waitForReplyButtonAssertNoComments();
  });

  it("she posts a reply on page ccc", () => {
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText(mariasCommentThree);
    mariasBrowser.editor.save();
  });

  it("... the comment appears", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostNrVisible(2);
    mariasBrowser.topic.assertPostTextMatches(2, mariasCommentThree);
  });

  it("back on page aaa, only the page-aaa and -bbb comments are shown (not the -ccc comment)", () => {
    mariasBrowser.go(embeddingOrigin + '/' + pageAaaSlug);
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostNrVisible(2);
    mariasBrowser.topic.waitForPostNrVisible(3);
    mariasBrowser.topic.assertPostTextMatches(2, mariasCommentOne);
    mariasBrowser.topic.assertPostTextMatches(3, mariasCommentTwo);
  });

  it("... the same on page bbb", () => {
    mariasBrowser.go(embeddingOrigin + '/' + pageBbbSlug);
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostNrVisible(2);
    mariasBrowser.topic.waitForPostNrVisible(3);
    mariasBrowser.topic.assertPostTextMatches(2, mariasCommentOne);
    mariasBrowser.topic.assertPostTextMatches(3, mariasCommentTwo);
  }); */

  it("Done", () => {
    everyonesBrowsers.perhapsDebug();
  });

});

