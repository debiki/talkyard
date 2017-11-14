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
let mariasBrowser;
let monsBrowser;

let data;
let idAddress: IdAddress;
let siteId: any;

const mariasCommentOne = 'mariasCommentOne';
const mariasCommentTwo = 'mariasCommentTwo';
const monsCommentOne = 'monsCommentOne';

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
    const theSharedSecret = 'public';

    const maria = { externalId: 'maria_ext_id', emailAddress: 'maria@x.co', username: 'maria',
        fullName: undefined, avatarUrl: undefined, aboutUser: undefined };
    const mariaJson = JSON.stringify(maria);
    const mariasHmacBase64 = utils.calcHmacSha256Base64(mariaJson, theSharedSecret);

    console.log("Calculated HMAC for:  " + mariaJson);
    console.log("        With secret:  " + theSharedSecret);
    console.log("        The HMAC is:  " + mariasHmacBase64);

    const mons = { externalId: 'mons_ext_id_123', emailAddress: 'mons@x.co', username: 'mons' };
    const monsJson = JSON.stringify(mons);
    const monsHmacBase64 = utils.calcHmacSha256Base64(monsJson, theSharedSecret);

    fs.writeFileSync(`${dir}/${pageASlug}`, makeHtml('sso-a', 'ugh-iiick', mariaJson, '#500'));
    fs.writeFileSync(`${dir}/${pageBSlug}`, makeHtml('sso-b', '', mariaJson, '#050'));
    fs.writeFileSync(`${dir}/${pageCSlug}`, makeHtml('sso-c', '', mariaJson, '#005', { skipHmac: true }));
    fs.writeFileSync(`${dir}/${pageDSlug}`, makeHtml('sso-d', mariasHmacBase64, mariaJson, '#558'));

    // Wrong user:
    fs.writeFileSync(`${dir}/${pageESlug}`, makeHtml('sso-e', mariasHmacBase64, monsJson, '#404'));
    // Ok user:
    fs.writeFileSync(`${dir}/${pageFSlug}`, makeHtml('sso-f', monsHmacBase64, monsJson, '#558'));
  });


  function makeHtml(pageName: string, hmacSha256Base64: string, userJson: string, bgColor: string,
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
user: <code>${userJson}</code><br>
The comments:
</p>

<script>
edCommentsServerUrl='http://${localHostname}.localhost';
${hmacLine}
// In real life, safer to use '\${ jsStringEscape(userJson) }'?
// https://www.npmjs.com/package/js-string-escape
edCurrentUser = ${userJson};
</script>
<script async defer src="http://${localHostname}.localhost/-/ed-comments.v0.js"></script>
<!-- You can specify a per page discussion id on the next line, if your URLs might change. -->
<div class="ed-comments" data-discussion-id="" style="margin-top: 45px;">

<p>/End of page.</p>
</body>
</html>`;
  }

  // Page A, bad HMAC
  it("Maria opens embedding page sso-a", () => {
    mariasBrowser.go(embeddingOrigin + '/' + pageASlug);
  });
  it("... there's a bad-HMAC error", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.waitForCurrentUserBadHmacErrorDialog();
  });


  // Page B, empty HMAC
  it("Maria opens embedding page sso-b", () => {
    mariasBrowser.go(embeddingOrigin + '/' + pageBSlug);
  });
  it("... there's a no-HMAC error (it's blank)", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.waitForCurrentUserNoHmacErrorDialog();
  });


  // Page C, no HMAC
  it("Maria opens embedding page sso-c", () => {
    mariasBrowser.go(embeddingOrigin + '/' + pageCSlug);
  });
  it("... there's another no-HMAC error (it's undefined)", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.waitForCurrentUserNoHmacErrorDialog();
  });


  // Page D, ok HMAC
  it("Maria opens embedding page sso-d", () => {
    mariasBrowser.go(embeddingOrigin + '/' + pageDSlug);
  });
  it("She gets logged in", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.waitForVisible('.s_MB_Name');
    mariasBrowser.assertTextMatches('.s_MB_Name', '@maria');
  });
  it("... and posts a comment", () => {
    mariasBrowser.complex.replyToOrigPostInEmbeddedComments(mariasCommentOne);
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
  });


  // Page E, wrong-user HMAC
  it("Mons opens embedding page sso-e", () => {
    monsBrowser.go(embeddingOrigin + '/' + pageESlug);
  });
  it("... there's a bad-HMAC error", () => {
    monsBrowser.switchToEmbeddedCommentsIrame();
    monsBrowser.waitForCurrentUserBadHmacErrorDialog();
  });


  // Page F, ok HMAC, for Mons
  it("Mons opens embedding page sso-f", () => {
    monsBrowser.go(embeddingOrigin + '/' + pageFSlug);
  });
  it("He gets logged in", () => {
    monsBrowser.switchToEmbeddedCommentsIrame();
    monsBrowser.waitForVisible('.s_MB_Name');
    monsBrowser.assertTextMatches('.s_MB_Name', '@mons');
  });
  it("... and posts a comment in this different topic", () => {
    monsBrowser.complex.replyToOrigPostInEmbeddedComments(monsCommentOne);
    monsBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
  });


  // Page D, ok HMAC, for Maria again
  it("Maria opens embedding page sso-d, in the same browser", () => {
    assert(mariasBrowser === monsBrowser);
    mariasBrowser.go(embeddingOrigin + '/' + pageDSlug);
  });
  it("... she gets logged in", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.waitForVisible('.s_MB_Name');
    // For a short while, the text might be '@mons', before new session cookie received.
    mariasBrowser.waitUntilTextMatches('.s_MB_Name', '@maria');
  });
  it("... and replies to herself", () => {
    mariasBrowser.complex.replyToPostNrInEmbeddedComments(c.FirstReplyNr, mariasCommentTwo);
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 1);
  });


  it("Done", () => {
    everyonesBrowsers.perhapsDebug();
  });

});

