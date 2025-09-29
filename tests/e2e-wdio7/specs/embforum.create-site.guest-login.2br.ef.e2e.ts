/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { IsWhere } from '../test-types';
import c from '../test-constants';

let owen;
let owen_brA: TyE2eTestBrowser;
let maria;
let maria_brB: TyE2eTestBrowser;

let data;
let siteId: any;
let forumLocalHostname: St;
let forumOrigin: St;
let embeddingHostPort: St;
let embeddingOrigin: St;
let embeddingUrl: St;
const forumPath = '/forum.html';

const mariasTopicTitle = 'mariasTopicTitle';
const mariasTopicText = 'mariasTopicText';


// dupl code! [5GKWXT20]
// This test embedded comments site creation, with the default settings.
// Then, people who post comments are not required to verify their email.

describe(`embforum.create-site.guest-login.2br.ef  TyTEF_CRSITE_GSTLGI`, () => {

  it("initialize people", async () => {
    const brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    const brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen_brA = brA;
    maria_brB = brB;

    owen = make.memberOwenOwner();
    maria = make.memberMaria();
  });


  function createPasswordTestData() {
    // Dupl code [502KGAWH0]
    // Need to generate new local hostname, since we're going to create a new site.
    const testId = utils.generateTestId();
    embeddingHostPort = `www-${testId}.localhost:8080`;
    embeddingOrigin = settings.scheme + '://' + embeddingHostPort;
    embeddingUrl = embeddingOrigin + forumPath;
    forumLocalHostname = `e2e-test--ef-${testId}`;
    forumOrigin = utils.makeSiteOrigin(forumLocalHostname);

    return {
      testId: testId,
      // 'embeddingUrl' is for blog comments.
      localHostname: forumLocalHostname,
      origin: forumOrigin,
      orgName: "E2E Org Name",
      fullName: 'Owen ' + testId,
      email: settings.testEmailAddressPrefix + testId + '@example.com',
      username: 'owen_owner',
      password: 'pub-owe020',
    }
  }

  it('Owen creates a forum to embed', async () => {
    // Dupl code [502SKHFSKN53]
    data = createPasswordTestData();
    await owen_brA.go2(utils.makeCreateSiteWithFakeIpUrl());
    await owen_brA.disableRateLimits();
  });

  it(`... He fills in fields`, async () => {
    await owen_brA.createSite.fillInFieldsAndSubmit(data);
    // New site; disable rate limits here too.
    await owen_brA.disableRateLimits();

    // If running some future embedded forum admin tours:
    // await owen_brA.tour.runToursAlthoughE2eTest();
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
    await owen_brA.createSomething.createForum("Emb Forum Test");
  });


  it("Owen goes to the embedded comments / forum page", async () => {
    await owen_brA.go2('/-/admin/settings/embedded-comments');
  });


  it(`There's an embedding page`, () => {
    const dir = 'target';
    fs.writeFileSync(dir + forumPath, makeHtml('ll-undef', '#205'));
    function makeHtml(pageName: St, bgColor: St, talkyardLogLevel?: St | Nr): St {
      return utils.makeEmbeddedCommentsHtml({
              embedAsForum: true,
              pageName, localHostname: forumLocalHostname, bgColor, talkyardLogLevel,
              appendExtraHtml: `
                  <script>
                  // TyTSCRIPTCLBK
                  onTalkyardScriptLoaded = function() { scriptLoaded = true; }
                  // TyTCOMTSCLBK
                  onTalkyardCommentsLoaded = function() { commentsLoaded = true; }
                  </script>`
              });
    }
  });


  it("Maria opens the embedding page, not logged in", async () => {
    await maria_brB.go2(embeddingUrl, { isExternalPage: true });
  });
  it(`... there's a _CSP error — Owen hasn't configured  Allow Embedding From  TyTSEC_FRAMEANC`,
          async () => {
    await assert.contentSecurityPolicyViolation(maria_brB,
            `frame-ancestors 'none'`);
  });

  it("Owen configures Allow Embedding From, but the wrong domain", async () => {
    await owen_brA.adminArea.settings.embedded.setAllowEmbeddingFrom(
            'https://typo-domain.example.com');
    await owen_brA.adminArea.settings.clickSaveAll();
  });
  it(`... Maria reloads`, async () => {
    await maria_brB.refresh2({ isWhere: IsWhere.External });
  });
  it(`... sees another _CSP error about the new domain — it's not  typo-domain  TyTSEC_FRAMEANC`,
          async () => {
    await maria_brB.pause(1000); // [E2EBUG] need to wait until message appears
    await assert.contentSecurityPolicyViolation(maria_brB,
            `frame-ancestors https://typo-domain.example.com`);
  });

  it(`Owen concentrates deeply. He types the correct Allow Embedding From origin`, async () => {
    await owen_brA.adminArea.settings.embedded.setAllowEmbeddingFrom(embeddingOrigin);
    await owen_brA.adminArea.settings.clickSaveAll();
  });

  it(`... Maria reloads`, async () => {
    await maria_brB.refresh2();  // skip this time: { isWhere: IsWhere.External }
  });
  it(`... the embedded forum appears, CSP error gone`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
  });

  it(`Maria signs up`, async () => {
    await maria_brB.complex.signUpAsMemberViaTopbar(maria, { inPopup: true });
  });
  it(`... verifies her email`, async () => {
    const url = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(
            siteId, maria.emailAddress);
    await maria_brB.go2(url);
  });
  it(`... gets logged in`, async () => {
    await maria_brB.hasVerifiedSignupEmailPage.clickContinue();
  });
  it(`... gets redirected to the page that embeds the forum`, async () => {
    await maria_brB.updateIsWhere();
    assert.eq(maria_brB.isWhere(), IsWhere.EmbeddingPage);  // 0await
  });

  it(`Maria posts a new topic`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.complex.createAndSaveTopic({ title: mariasTopicTitle, body: mariasTopicText });
  });

  //let mariasTopicTyUrl: St;
  //let mariasTopicTyPath: St;
  let mariasTopicEmbgUrl: St;

  //it(`Links to embedded page and embedding page are different`, async () => {
  it(`Copy URL to new embedded page ...`, async () => {
    //mariasTopicTyUrl = await maria_brB.getUrl();
    //mariasTopicTyPath = await maria_brB.urlPathQueryHash();
    await maria_brB.switchToTheParentFrame();
    mariasTopicEmbgUrl = await maria_brB.getUrl();
    //assert.notEq(mariasTopicTyPath, mariasTopicEmbgUrl)
  });
  /*
  it(`... the Talkyard path has no '#' and a /-<id>/<slug> path`, async () => {
    assert.eq(mariasTopicTyPath.indexOf('#'), -1);
    assert.matches(mariasTopicTyUrl, /\.localhost\/-11\/mariastopictitle$/);
    assert.eq(mariasTopicTyPath, `/-11/mariastopictitle`);
  }); */
  it(`... the embedd*ing* path ends with the Ty path, after the #`, async () => {
    assert.matches(mariasTopicEmbgUrl, /\.localhost:8080\/forum.html#\/-11\/mariastopictitle$/)
    //assert.includes(mariasTopicEmbgUrl, mariasTopicTyPath);
  });

  it(`Owen goes to Maria's page, the embedd*ing* url`, async () => {
    await owen_brA.go2(mariasTopicEmbgUrl);
  });
  it(`... logs in`, async () => {
    await owen_brA.switchToEmbeddedCommentsIrame();
    await owen_brA.complex.loginWithPasswordViaTopbar(owen, { inPopup: true });
  });

  it(`Owen replies to Maria's topic`, async () => {
    await owen_brA.switchToEmbeddedCommentsIrame();
    await owen_brA.complex.replyToOrigPost('Owens_reply');
  });

  it(`Maria reloads the page`, async () => {
    await maria_brB.refresh2();
  });
  it(`... she's still logged in`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.topbar.waitForMyMenuVisible();
  });
  it(`... as Maria`, async () => {
    assert.eq(await maria_brB.topbar.getMyUsername(), maria.username);
  });

  it(`Maria sees Owen's reply`, async () => {
    await maria_brB.topic.waitForPostAssertTextMatches(c.FirstReplyNr, 'Owens_reply');
  });
  it(`Maria replies to Owen`, async () => {
    await maria_brB.complex.replyToPostNr(c.FirstReplyNr, 'Marias_reply_2_Owen', { isEmbedded: true });
  });

  it(`Owen reloads ...`, async () => {
    await owen_brA.refresh2();
  });
  it(`... sees Maria's reply`, async () => {
    await owen_brA.switchToEmbeddedCommentsIrame();
    await owen_brA.topic.waitForPostAssertTextMatches(c.SecondReplyNr, 'Marias_reply_2_Owen');
  });


  /*  _CSP tested above, maybe need not do again here.
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
  */

});

