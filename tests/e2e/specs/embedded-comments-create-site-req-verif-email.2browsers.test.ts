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
let michael;
let michaelsBrowser;
let strangersBrowser;

let data;
let idAddress: IdAddress;
let siteId: any;

const mariasCommentText = 'mariasCommentText';
const owensCommentText = 'owensCommentText';


// dupl code! [5GKWXT20]
// This test embedded comments site creation, with *edited* settings.
// People who post comments *are* required to verify their email, before writing and posting a comment.

describe("embedded comments, new site", () => {

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));

    owensBrowser = _.assign(browserA, pagesFor(browserA));

    mariasBrowser = _.assign(browserB, pagesFor(browserB));
    michaelsBrowser = mariasBrowser;
    strangersBrowser = mariasBrowser;

    owen = make.memberOwenOwner();
    maria = make.memberMaria();
    michael = make.memberMichael();
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
      //originRegexEscaped: utils.makeSiteOriginRegexEscaped(localHostname),
      orgName: "E2E Org Name",
      fullName: 'E2E Test ' + testId,
      email: settings.testEmailAddressPrefix + testId + '@example.com',
      // Prefix the number with 'z' because '..._<number>' is reserved. [7FLA3G0L]
      username: 'e2e_test_z' + testId,
      password: 'pub5KFV2FY8C',
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


  it("Owen exits the intro tour  [Ty7ABKR024]", () => {
    owensBrowser.tour.exitTour();
  });


  it("... clicks Blog = Something Else", () => {
    owensBrowser.waitAndClick('.e_SthElseB');
  });


  it("... and creates an embedding page", () => {
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
<title>Embedded comments E2E test</title>
</head>
<body style="background: black; color: #ccc; font-family: monospace">
<p>This is an embedded comments E2E test page. Ok to delete. 27KT5QAX29. The comments:</p>
${htmlToPaste}
<p>/End of page.</p>
</body>
</html>`);
  });


  it("... and enables the require-verified-email setting", () => {
    owensBrowser.adminArea.goToLoginSettings('');
    owensBrowser.adminArea.settings.login.setRequireVerifiedEmail(true);
    owensBrowser.adminArea.settings.clickSaveAll();
  });


  it("Maria opens the embedding page, not logged in", () => {
    mariasBrowser.go(data.embeddingUrl);
    mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... and clicks Reply", () => {
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... password-signs-up in a popup", () => {
    console.log("switching to login popup window...");
    mariasBrowser.swithToOtherTabOrWindow();
    mariasBrowser.disableRateLimits();
    console.log("signs up...");
    mariasBrowser.loginDialog.createPasswordAccount(maria, false);
    console.log("close login popup...");
    mariasBrowser.close();
  });

  it("... verifies her email", () => {
    const siteId = owensBrowser.getSiteId();
    const email = server.getLastEmailSenTo(siteId, maria.emailAddress, owensBrowser);
    const link = utils.findFirstLinkToUrlIn(
        data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    mariasBrowser.go(link);
    mariasBrowser.waitAndClick('#e2eContinue');
  });

  it("... gets redirected to the embedding page", () => {
    const url = mariasBrowser.url().value;
    assert(url === data.embeddingUrl);
    const source = mariasBrowser.getSource();
    assert(source.indexOf('27KT5QAX29') >= 0);
  });

  it("... clicks Reply", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... writes a comment", () => {
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText(mariasCommentText);
  });

  it("... posts it", () => {
    mariasBrowser.editor.save();
  });

  it("... the comment it appears", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, mariasCommentText);
  });

  it("Owen sees it too", () => {
    owensBrowser.go(data.embeddingUrl);
    owensBrowser.switchToEmbeddedCommentsIrame();
    owensBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, mariasCommentText);
  });

  it("Owen replies to Maria (he's already logged in)", () => {
    owensBrowser.topic.clickReplyToPostNr(2);
    owensBrowser.switchToEmbeddedEditorIrame();
    owensBrowser.editor.editText(owensCommentText);
    owensBrowser.editor.save();
  });

  it("... his comment appears", () => {
    owensBrowser.switchToEmbeddedCommentsIrame();
    owensBrowser.topic.waitForPostAssertTextMatches(3, owensCommentText);
  });

  it("Maria sees Owen's comment and her own too", () => {
    mariasBrowser.refresh();
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostAssertTextMatches(2, mariasCommentText);
    mariasBrowser.topic.waitForPostAssertTextMatches(3, owensCommentText);
  });

});

