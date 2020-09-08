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
declare let browserA: any;
declare let browserB: any;

let everyonesBrowsers;
let owen;
let owensBrowser: TyE2eTestBrowser;
let maria;
let mariasBrowser: TyE2eTestBrowser;

let data;
let siteId: any;

const mariasCommentText = 'mariasCommentText';
const owensCommentText = 'owensCommentText';


// dupl code! [5GKWXT20]
// This test embedded comments site creation, with the default settings.
// Then, people who post comments are not required to verify their email.

describe("embedded comments, new site, admin tour  TyT6KRKV20", () => {

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);

    owensBrowser = new TyE2eTestBrowser(browserA);

    mariasBrowser = new TyE2eTestBrowser(browserB);

    owen = make.memberOwenOwner();
    maria = make.memberMaria();
  });


  function createPasswordTestData() {
    // Dupl code [502KGAWH0]
    // Need to generate new local hostname, since we're going to create a new site.
    const testId = utils.generateTestId();
    const embeddingHostPort = `e2e-test--ec-${testId}.localhost:8080`;
    const localHostname     = `e2e-test--ec-${testId}-localhost-8080`;
    //const localHostname = settings.localHostname ||
    //  settings.testLocalHostnamePrefix + 'create-site-' + testId;

    return {
      testId: testId,
      embeddingUrl: `http://${embeddingHostPort}/`,
      origin: `${settings.scheme}://comments-for-${localHostname}.localhost`,
      //originRegexEscaped: utils.makeSiteOriginRegexEscaped(localHostname),
      orgName: "E2E Org Name",
      fullName: 'E2E Test ' + testId,
      email: settings.testEmailAddressPrefix + testId + '@example.com',
      username: 'owen_owner',
      password: 'publ-ow020',
    }
  }

  it('Owen creates an embedded comments site as a Password user  @login @password:', () => {
    // Dupl code [502SKHFSKN53]
    data = createPasswordTestData();
    owensBrowser.go(utils.makeCreateEmbeddedSiteWithFakeIpUrl());
    owensBrowser.disableRateLimits();
  });

  it(`... He fills in fields`, () => {
    owensBrowser.createSite.fillInFieldsAndSubmit(data);
    // New site; disable rate limits here too.
    owensBrowser.disableRateLimits();

    owensBrowser.tour.runToursAlthoughE2eTest();
  });

  it(`... Sings up as owner, at the new site`, () => {
    owensBrowser.createSite.clickOwnerSignupButton();
    owensBrowser.loginDialog.createPasswordAccount({ ...data, shallBecomeOwner: true });
  });

  it(`... Clicks an email verification link`, () => {
    siteId = owensBrowser.getSiteId();
    const email = server.getLastEmailSenTo(siteId, data.email, wdioBrowserA);
    const link = utils.findFirstLinkToUrlIn(
        data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    owensBrowser.go(link);
    owensBrowser.waitAndClick('#e2eContinue');
  });


  it("An intro guide appears", () => {
    owensBrowser.waitForVisible('.e_SthElseB');
    owensBrowser.tour.assertTourStarts(true);
    console.log('Step 1');
    owensBrowser.tour.clickNextForStepNr(1);
    console.log('Step 2');
    owensBrowser.waitAndClick('#e2eAA_Ss_LoginL', { mayScroll: false });
    console.log('Step 3');
    // wait for a tour scroll animation to complete, which otherwise makes the next
    // tour scroll fail.
    owensBrowser.tour.clickNextForStepNr(3);
    console.log('Step 4');
    owensBrowser.waitAndClick('.e_RvwB', { mayScroll: false });
    console.log('Step 5');
    owensBrowser.tour.clickNextForStepNr(5);
    console.log('Step 6');
    owensBrowser.waitAndClick('.e_StngsB', { mayScroll: false });
    console.log('Step 7');
    owensBrowser.tour.clickNextForStepNr(7);
  });


  it("Owen is back on the embedded comments page", () => {
    assert.equal(owensBrowser.urlPath(), '/-/admin/settings/embedded-comments');
  });


  it("The tour is done, won't restart", () => {
    owensBrowser.refresh(); // this reloads new tourTipsSeen
    owensBrowser.waitForVisible('.e_SthElseB');
    owensBrowser.tour.assertTourStarts(false);
  });


  it("Clicks Blog = Something Else, to show the instructions", () => {
    owensBrowser.waitAndClick('.e_SthElseB');
  });


  it("He creates an embedding page", () => {
    // Dupl code [046KWESJJLI3].
    owensBrowser.waitForVisible('#e_EmbCmtsHtml');
    const htmlToPaste = owensBrowser.getText('#e_EmbCmtsHtml');
    //console.log('htmlToPaste: ' + htmlToPaste);
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


  it("Maria opens the embedding page, not logged in", () => {
    mariasBrowser.go(data.embeddingUrl);
    mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... and clicks Reply", () => {
    mariasBrowser.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... writes a comment (not yet logged in)", () => {
    mariasBrowser.switchToEmbeddedEditorIrame();
    mariasBrowser.editor.editText(mariasCommentText);
  });

  it("... posts it", () => {
    mariasBrowser.editor.save();
  });

  it("... password-signs-up in a popup", () => {
    console.log("switching to login popup window...");
    mariasBrowser.swithToOtherTabOrWindow();
    mariasBrowser.disableRateLimits();
    console.log("signs up...");
    mariasBrowser.loginDialog.createPasswordAccount(maria, false, 'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG');
    mariasBrowser.switchBackToFirstTabOrWindow();
  });

  it("... the comment it appears", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostAssertTextMatches(2, mariasCommentText); // the first reply nr, = comment 1
  });

  it("Owen sees it too", () => {
    owensBrowser.go(data.embeddingUrl);
    owensBrowser.switchToEmbeddedCommentsIrame();
    owensBrowser.topic.waitForPostAssertTextMatches(2, mariasCommentText);
  });

  it("Owen needs to log in? The browsers keep changing how they work", () => {
    owensBrowser.complex.loginIfNeededViaMetabar(owen);
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

  it("When embedding via the wrong domain, the comments refuse to load", () => {
    logAndDie.logMessage(`First, comments are visible ...`);
    assert(isCommentsVisible(owensBrowser));
    assert(isReplyButtonVisible(owensBrowser));

    owensBrowser.go('http://wrong-embedding-domain.localhost:8080');

    logAndDie.logMessage(`But not at the wrong domain...`);
    const source = owensBrowser.getSource();
    assert(source.indexOf('27KT5QAX29') >= 0);

    // There is an iframe but it's empty, because the Content-Security-Policy frame-ancestors
    // policy forbids embedding from this domain.
    // But with WebdriverIO v6, this: browser.switchToFrame(iframe);
    // now blocks, for iframes that couldn't be loaded?
    // So skip this for now:
    return;  // [E2EBUG]  TyT3059J267P
    owensBrowser.switchToEmbeddedCommentsIrame({ waitForContent: false });
    // Give any stuff that appears although it shouldn't, some time to load.
    owensBrowser.pause(500);
    assert(!isCommentsVisible(owensBrowser));
    assert(!isReplyButtonVisible(owensBrowser));
  });

  function isCommentsVisible(browser) {
    return browser.isVisible('.dw-p');
  }

  function isReplyButtonVisible(browser) {
    return browser.isVisible('.dw-a-reply');
  }

});

