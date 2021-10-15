/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import * as make from '../utils/make';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import c from '../test-constants';

declare let browserA: any;
declare let browserB: any;

let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;

let data: U | NewSiteDataForEmbeddedComments;

const mariasCommentText = 'mariasCommentText';
const owensCommentText = 'owensCommentText';


// dupl code! [5GKWXT20]
// This test embedded comments site creation, with *edited* settings.
// People who post comments *are* required to verify their email, before writing and posting a comment.

describe(`embcom.create-site-req-verif-email-exit-tours.2br  TyTE2ECREMBCOM1`, () => {

  it("initialize people", () => {
    owen_brA = new TyE2eTestBrowser(browserA, 'brA');
    maria_brB = new TyE2eTestBrowser(browserB, 'brB');
    owen = make.memberOwenOwner();
    maria = make.memberMaria();
  });


  function createPasswordTestData(): NewSiteDataForEmbeddedComments {
    // Dupl code [502KGAWH0]
    // Need to generate new local hostname, since we're going to create a new site.
    const testId = utils.generateTestId();
    const embeddingHostPort = `e2e-test--ec-${testId}.localhost:8080`;
    const localHostname     = `e2e-test--ec-${testId}-localhost-8080`;
    //const localHostname = settings.localHostname ||
    //  settings.testLocalHostnamePrefix + 'create-site-' + testId;

    return {
      siteType: 2, // SiteType.EmbeddedCommments,
      newSiteOwner: 1, // NewSiteOwnerType.OwenOwner,
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

  it('Owen creates an embedded comments site as a Password user  @login @password', async () => {
      // Dupl code [502SKHFSKN53]
    data = createPasswordTestData();
    await owen_brA.go2(utils.makeCreateEmbeddedSiteWithFakeIpUrl());
    await owen_brA.disableRateLimits();
    await owen_brA.createSite.fillInFieldsAndSubmit(data);
    // New site; disable rate limits here too.
    await owen_brA.disableRateLimits();
    await owen_brA.createSite.clickOwnerSignupButton();
    await owen_brA.loginDialog.createPasswordAccount(data, true);
    const siteId = await owen_brA.getSiteId();
    const email = await server.getLastEmailSenTo(siteId, data.email);
    const link = utils.findFirstLinkToUrlIn(
        data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    await owen_brA.go2(link);
    await owen_brA.waitAndClick('#e2eContinue');

    await owen_brA.tour.runToursAlthoughE2eTest();
  });


  it("Owen exits the intro tour  Ty7ABKR024", async () => {
    await owen_brA.tour.exitTour();
  });


  it("... clicks Blog = Something Else", async () => {
    await owen_brA.waitAndClick('.e_SthElseB');
  });


  it("... and creates an embedding page", async () => {
    // Dupl code [046KWESJJLI3].
    await owen_brA.waitForVisible('#e_EmbCmtsHtml');
    const htmlToPaste = await owen_brA.getText('#e_EmbCmtsHtml');
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


  it("... and enables the require-verified-email setting", async () => {
    await owen_brA.adminArea.goToLoginSettings('');
    await owen_brA.adminArea.settings.login.setRequireVerifiedEmail(true);
    await owen_brA.adminArea.settings.clickSaveAll();
  });


  it("Maria opens the embedding page, not logged in", async () => {
    await maria_brB.go(data.embeddingUrl);
    await maria_brB.switchToEmbeddedCommentsIrame();
  });

  it("... and clicks Reply", async () => {
    await maria_brB.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... password-signs-up in a popup", async () => {
    console.log("switching to login popup window...");
    await maria_brB.swithToOtherTabOrWindow();
    await maria_brB.disableRateLimits();
    console.log("signs up...");
    await maria_brB.loginDialog.createPasswordAccount(maria, false);
    console.log("close login popup...");
    await maria_brB.closeWindowSwitchToOther();
  });

  it("... verifies her email", async () => {
    const ids = await owen_brA.getSiteIds();
    const email = await server.getLastEmailSenTo(ids.siteId, maria.emailAddress);
    // `data.origin` is to the "comments-for-..."" address which is no longer
    // used here, since the broser can think it's too similar to the embedding
    // website's address.  [emb_coms_origin]
    const emailLinkOrigin = `${settings.scheme}://site-${ids.pubSiteId}.localhost`;
    const link = utils.findFirstLinkToUrlIn(
        emailLinkOrigin + '/-/login-password-confirm-email', email.bodyHtmlText);
    await maria_brB.go2(link);
    await maria_brB.hasVerifiedSignupEmailPage.clickContinue();
  });

  it("... gets redirected to the embedding page", async () => {
    const url = await maria_brB.urlNoHash();
    assert.eq(url, data.embeddingUrl);
    const source = await maria_brB.getPageSource();
    assert.includes(source, '27KT5QAX29');
  });

  it("... clicks Reply", async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.topic.clickReplyToEmbeddingBlogPost();
  });

  it("... writes a comment", async () => {
    await maria_brB.switchToEmbeddedEditorIrame();
    await maria_brB.editor.editText(mariasCommentText);
  });

  it("... posts it", async () => {
    await maria_brB.editor.save();
  });

  it("... the comment it appears", async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.topic.waitForPostAssertTextMatches(c.FirstReplyNr, mariasCommentText);
  });

  it("Owen sees it too", async () => {
    await owen_brA.go2(data.embeddingUrl);
    await owen_brA.switchToEmbeddedCommentsIrame();
    await owen_brA.topic.waitForPostAssertTextMatches(c.FirstReplyNr, mariasCommentText);
  });

  it("Owen needs to log in? The browsers keep changing how they work", async () => {
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

});

