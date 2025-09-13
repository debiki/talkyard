/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { logMessage, logUnusual, j2s } from '../utils/log-and-die';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;

let owen;
let owen_brA: TyE2eTestBrowser;
let maria;
let maria_brB: TyE2eTestBrowser;

let data;
let siteId: any;
let embeddingHostPort: St;

const mariasCommentText = 'mariasCommentText';
const owensCommentText = 'owensCommentText';


// dupl code! [5GKWXT20]
// This test embedded comments site creation, with the default settings.
// Then, people who post comments are not required to verify their email.

describe(`embcom.create-site-admin-intro-tour-no-verif-email.2br.ec  TyT6KRKV20`, () => {

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen_brA = brA;
    maria_brB = brB;

    owen = make.memberOwenOwner();
    maria = make.memberMaria();
  });


  function createPasswordTestData() {
    // Dupl code [502KGAWH0]
    // Need to generate new local hostname, since we're going to create a new site.
    const testId = utils.generateTestId();
    embeddingHostPort = `e2e-test--ec-${testId}.localhost:8080`;
    const localHostname     = `e2e-test--ec-${testId}`;
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
      password: 'pub-owe020',
    }
  }

  it('Owen creates an embedded comments site as a Password user  @login @password:', async () => {
    // Dupl code [502SKHFSKN53]
    data = createPasswordTestData();
    await owen_brA.go2(utils.makeCreateEmbeddedSiteWithFakeIpUrl());
    await owen_brA.disableRateLimits();
  });

  it(`... He fills in fields`, async () => {
    await owen_brA.createSite.fillInFieldsAndSubmit(data);
    // New site; disable rate limits here too.
    await owen_brA.disableRateLimits();

    await owen_brA.tour.runToursAlthoughE2eTest();
  });

  it(`... Sings up as owner, at the new site`, async () => {
    await owen_brA.createSite.clickOwnerSignupButton();
    await owen_brA.loginDialog.createPasswordAccount({ ...data, shallBecomeOwner: true });
  });

  it(`... Clicks an email verification link`, async () => {
    siteId = await owen_brA.getSiteId();
    const email = await server.getLastEmailSenTo(siteId, data.email);
    const link = utils.findFirstLinkToUrlIn(
        data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    await owen_brA.go2(link);
    await owen_brA.waitAndClick('#e2eContinue');
  });


  it("An intro guide appears", async () => {
    await owen_brA.waitForVisible('.e_SthElseB');
    await owen_brA.tour.assertTourStarts(true);
    console.log('Step 1');
    await owen_brA.tour.clickNextForStepNr(1);
    console.log('Step 2');
    await owen_brA.waitAndClick('#e2eAA_Ss_LoginL', { mayScroll: false });
    console.log('Step 3');
    // wait for a tour scroll animation to complete, which otherwise makes the next
    // tour scroll fail.
    await owen_brA.tour.clickNextForStepNr(3);
    console.log('Step 4');
    await owen_brA.waitAndClick('.e_RvwB', { mayScroll: false });
    console.log('Step 5');
    await owen_brA.tour.clickNextForStepNr(5);
    console.log('Step 6');
    await owen_brA.waitAndClick('.e_StngsB', { mayScroll: false });
    console.log('Step 7');
    await owen_brA.tour.clickNextForStepNr(7);
  });


  it("Owen is back on the embedded comments page", async () => {
    assert.eq(await owen_brA.urlPath(), '/-/admin/settings/embedded-comments');
  });


  it("The tour is done, won't restart", async () => {
    await owen_brA.refresh2(); // this reloads new tourTipsSeen
    await owen_brA.waitForVisible('.e_SthElseB');
    await owen_brA.tour.assertTourStarts(false);
  });


  it("Clicks Blog = Something Else, to show the instructions", async () => {
    await owen_brA.waitAndClick('.e_SthElseB');
  });


  it("He creates an embedding page", async () => {
    // Dupl code [046KWESJJLI3].
    await owen_brA.waitForVisible('#e_EmbCmtsHtml');
    const htmlToPaste = await owen_brA.getText('#e_EmbCmtsHtml');
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


  it("Maria opens the embedding page, not logged in", async () => {
    await maria_brB.go2(data.embeddingUrl);
    await maria_brB.switchToEmbeddedCommentsIrame();
  });

  it("... and clicks Reply", async () => {
    await maria_brB.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... writes a comment (not yet logged in)", async () => {
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.editText(mariasCommentText);
  });

  it("... posts it", async () => {
    await maria_brB.editor.save();
  });

  it("... password-signs-up in a popup", async () => {
    console.log("switching to login popup window...");
    await maria_brB.swithToOtherTabOrWindow();
    await maria_brB.disableRateLimits();
    console.log("signs up...");
    await maria_brB.loginDialog.createPasswordAccount(maria, false, 'THERE_WILL_BE_NO_VERIFY_EMAIL_DIALOG');
    await maria_brB.switchBackToFirstTabOrWindow();
  });

  it("... the comment it appears", async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.topic.waitForPostAssertTextMatches(2, mariasCommentText); // the first reply nr, = comment 1
  });

  it("Owen sees it too", async () => {
    await owen_brA.go2(data.embeddingUrl);
    await owen_brA.switchToEmbeddedCommentsIrame();
    await owen_brA.topic.waitForPostAssertTextMatches(2, mariasCommentText);
  });

  it(`Owen needs to log in? Browsers tend to block <iframe> cookies`, async () => {
    await owen_brA.complex.loginIfNeededViaMetabar(owen);
  });

  it("Owen replies to Maria (he's already logged in)", async () => {
    await owen_brA.topic.clickReplyToPostNr(2);
    await owen_brA.switchToEmbeddedEditorIrame();
    await owen_brA.editor.editText(owensCommentText);
    await owen_brA.editor.save();
  });

  it("... his comment appears", async () => {
    await owen_brA.switchToEmbeddedCommentsIrame();
    await owen_brA.topic.waitForPostAssertTextMatches(3, owensCommentText);
  });

  it("Maria sees Owen's comment and her own too", async () => {
    await maria_brB.refresh2();
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.topic.waitForPostAssertTextMatches(2, mariasCommentText);
    await maria_brB.topic.waitForPostAssertTextMatches(3, owensCommentText);
  });

  it("When embedding via the wrong domain, comments won't load  TyTSEC_FRAMEANC", async () => {
    logMessage(`First, comments are visible ...`);
    assert.that(await isCommentsVisible(owen_brA));
    assert.that(await isReplyButtonVisible(owen_brA));

    await owen_brA.go2('http://wrong-embedding-domain.localhost:8080');

    logMessage(`But not at the wrong domain...`);
    const source = await owen_brA.getSource();
    assert.that(source.indexOf('27KT5QAX29') >= 0);

    await assert.contentSecurityPolicyViolation(owen_brA,
          `frame-ancestors http://${embeddingHostPort} https://${embeddingHostPort}`);
  });

  async function isCommentsVisible(browser: TyE2eTestBrowser): Pr<Bo> {
    return await browser.isVisible('.dw-p');
  }

  async function isReplyButtonVisible(browser: TyE2eTestBrowser): Pr<Bo> {
    return await browser.isVisible('.dw-a-reply');
  }

});

