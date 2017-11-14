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
import jsStringEscape = require('js-string-escape');

declare let browser: any;

let everyonesBrowsers;
let mariasBrowser;
let monsBrowser;

let data;
let idAddress: IdAddress;
let siteId: any;

const mariasCommentOne = 'mariasCommentOne';
const mariasCommentTwo = 'mariasCommentTwo';

const localHostname = 'comments-for-e2e-test-embsso2-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embsso2.localhost:8080';
const pageASlug = 'emb-cmts-sso-a2.html';
const pageBSlug = 'emb-cmts-sso-b2.html';
const pageCSlug = 'emb-cmts-sso-c2.html';
const pageDSlug = 'emb-cmts-sso-d2.html';


/**
 * The same tests as in embedded-comments-sso-hmac-js-obj.test.ts, but with
 * the user as a string, instead of a js object.
 */
describe("emb cmts sso via js, user as json string", () => {

  it("initialize people", () => {
    browser.perhapsDebugBefore();
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    mariasBrowser = everyonesBrowsers;
    monsBrowser = everyonesBrowsers;
  });

  it("import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('embsso2', { title: "Emb Cmts SSO Test, user = str" });
    site.meta.localHostname = localHostname;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("create embedding pages that attempts to sso-login an external user", () => {
    const dir = 'target';
    const badHmac = 'zzzugh';
    const theSharedSecret = 'public';

    const maria = { externalId: 'maria_ext_id', emailAddress: 'maria@x.co', username: 'maria',
        fullName: undefined, avatarUrl: undefined, aboutUser: undefined };
    const mariaJson = JSON.stringify(maria);
    const mariasHmacBase64 = utils.calcHmacSha256Base64(mariaJson, theSharedSecret);

    console.log("Calculated HMAC for:  " + JSON.stringify(maria));
    console.log("        With secret:  " + theSharedSecret);
    console.log("        The HMAC is:  " + mariasHmacBase64);

    fs.writeFileSync(`${dir}/${pageASlug}`, makeHtml('sso-a2', badHmac, mariaJson, '#500'));
    fs.writeFileSync(`${dir}/${pageBSlug}`, makeHtml('sso-b2', '', mariaJson, '#050'));
    fs.writeFileSync(`${dir}/${pageCSlug}`, makeHtml('sso-c2', '', mariaJson, '#005', { skipHmac: true}));
    fs.writeFileSync(`${dir}/${pageDSlug}`, makeHtml('sso-d2', mariasHmacBase64, mariaJson, '#558'));
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
edCurrentUser = '${ jsStringEscape(userJson) }';
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
    mariasBrowser.debug();
  });


  // Page B, empty HMAC
  it("Maria opens embedding page sso-b", () => {
    mariasBrowser.go(embeddingOrigin + '/' + pageBSlug);
  });
  it("... there's a no-HMAC error (it's blank)", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.waitForCurrentUserNoHmacErrorDialog();
    mariasBrowser.debug();
  });


  // Page C, no HMAC
  it("Maria opens embedding page sso-c", () => {
    mariasBrowser.go(embeddingOrigin + '/' + pageCSlug);
  });
  it("... there's another no-HMAC error (it's undefined)", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.waitForCurrentUserNoHmacErrorDialog();
    mariasBrowser.debug();
  });


  // Page D, ok HMAC
  it("Maria opens embedding page sso-d", () => {
    mariasBrowser.go(embeddingOrigin + '/' + pageDSlug);
    monsBrowser.debug();
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


  it("Done", () => {
    everyonesBrowsers.perhapsDebug();
  });

});

