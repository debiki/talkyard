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
declare let browserA: any;
declare let browserB: any;

let everyonesBrowsers;
let owen;
let owensBrowser;
let maria;
let mariasBrowser;
let strangersBrowser;

let data;
let idAddress: IdAddress;
let siteId: any;

const mariasCommentText = 'mariasCommentText';
const owensCommentText = 'owensCommentText';


// dupl code! [5GKWXT20]

describe("embedded comments, new site, import Disqus comments  TyT5KFG0P75", () => {

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    owensBrowser = _.assign(browserA, pagesFor(browserA));
    mariasBrowser = _.assign(browserB, pagesFor(browserB));
    strangersBrowser = mariasBrowser;
    owen = make.memberOwenOwner();
    maria = make.memberMaria();
  });


  function createPasswordTestData() {
    const testId = utils.generateTestId();
    const embeddingHostPort = `test--ec-${testId}.localhost:8080`;
    const localHostname     = `test--ec-${testId}-localhost-8080`;
    //const localHostname = settings.localHostname ||
    //  settings.testLocalHostnamePrefix + 'create-site-' + testId;
    return {
      testId: testId,
      embeddingUrl: `http://${embeddingHostPort}/`,
      origin: `http://comments-for-${localHostname}.localhost`,
      orgName: "E2E Org Name",
      fullName: 'E2E Test ' + testId,
      email: settings.testEmailAddressPrefix + testId + '@example.com',
      username: 'owen_owner',
      password: 'publ-ow020',
    }
  }

  it('Owen creates an embedded comments site as a Password user  @login @password', () => {
    data = createPasswordTestData();
    owensBrowser.go(utils.makeCreateEmbeddedSiteWithFakeIpUrl());
    owensBrowser.disableRateLimits();
    owensBrowser.createSite.fillInFieldsAndSubmit(data);
    // New site; disable rate limits here too.
    owensBrowser.disableRateLimits();

    owensBrowser.createSite.clickOwnerSignupButton();
    owensBrowser.loginDialog.createPasswordAccount(data, true);
    const siteId = owensBrowser.getSiteId();
    const email = server.getLastEmailSenTo(siteId, data.email, owensBrowser);
    const link = utils.findFirstLinkToUrlIn(
        data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    owensBrowser.go(link);
    owensBrowser.waitAndClick('#e2eContinue');
  });


  it("Owen clicks Blog = Something Else, to show the instructions", () => {
    owensBrowser.waitAndClick('.e_SthElseB');
  });


  it("He creates an embedding page", () => {
    owensBrowser.waitForVisible('#e_EmbCmtsHtml');
    const htmlToPaste = owensBrowser.getText('#e_EmbCmtsHtml');
    console.log('htmlToPaste: ' + htmlToPaste);
    const dirPath = 'target'; //  doesn't work:   target/e2e-emb' — why not.
    if (!fs.existsSync(dirPath)) {  // —>  "FAIL: Error \n unknown error line"
      fs.mkdirSync(dirPath, '0777');
    }
    fs.writeFileSync(`${dirPath}/index.html`, `
<html>
<head>
<title>Embedded comments E2E test: Importing Disqus comments</title>
</head>
<!-- #59a3fc is supposedly Diqus' standard color. -->
<body style="background: #59a3fc; color: #000; font-family: monospace; font-weight: bold">
<p>This is an embedded comments E2E test page, for testing Disqus comments import.
  Ok to delete. 6039hKSPJ3. The comments:</p>
${htmlToPaste}
<p>/End of page.</p>
</body>
</html>`);
  });


  it("Maria opens the embedding page, not logged in", () => {
    mariasBrowser.go(data.embeddingUrl);
    mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... it's empty", () => {
  });

  it("Owen exports Disqus comments to a file: ./target/disqus-export.xml", () => {
  });

  it("... and converts to Talkyard format: ./target/talkyard-disqus.typatch.json", () => {
  });

  it("... and posts to the Talkyard server", () => {
  });

  it("Maria refreshes the page", () => {
  });

  it("... and sees a comment", () => {
  });

  it("Maria goes to another page", () => {
  });

  it("... and sees three comments", () => {
  });

  it("Maria replies to a comment", () => {
  });

  it("... the comment author (a guest user) gets a reply notf email", () => {
  });

  it("owen replies to Maria", () => {
  });

  it("... Maria gets a nof email", () => {
  });

  it("Maria goes to a 3rd page", () => {
  });

  it("... it's empt (it should be)", () => {
  });

  it("Maria returns to the previous page, with new comments", () => {
  });

  it("... and sees 5 comments (3 old, from Disqus, and 2 new)", () => {
  });


  function isCommentsVisible(browser) {
    return browser.isVisible('.dw-p');
  }

  function isReplyButtonVisible(browser) {
    return browser.isVisible('.dw-a-reply');
  }

});

