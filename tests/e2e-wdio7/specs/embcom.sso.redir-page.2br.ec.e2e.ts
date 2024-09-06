/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as u from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { die } from '../utils/log-and-die';
import c from '../test-constants';


// Dupl code  [embcom_sso_e2e_dupl]

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;

let selina_brB: TyE2eTestBrowser;
const selinaExtUser: ExternalUser = {
  ssoId: 'selina-soid',
  username: 'selina_un',
  fullName: 'Selina Full Name',
  primaryEmailAddress: 'e2e-test-selina@x.co',
  isEmailAddressVerified: true,
}

const selinaAutnhMsg = {
  //sub: 'ject',
  //exp: '2021-05-01T00:00:00Z',
  //iat: '2021-05-01T00:00:00Z',
  data: {
    //ifExists: 'DoNothing', // or 'Update'
    //lookupKey: 'soid:selina_sign_on_id',
    user: {
      ...selinaExtUser,
    },
  },
};

const localHostname = 'comments-for-e2e-test-embsth';
const embeddingOrigin = 'http://e2e-test-embsth.localhost:8080';

let site: IdAddress;
let forum: TwoCatsTestForum;

const ssoUrl =
    `http://localhost:8080/${u.ssoLoginPageSlug}` +
        '?redir2Origin=\${returnToOrigin}' +
        '&redir2RelUrl=\${returnToPathQueryHash}' +
        '&isTalkyard=true';

const ssoUrlVarsReplaced = (embeddingOrigin: St, relativeUrl: St): St =>
    `http://localhost:8080/${u.ssoLoginPageSlug}` +
        `?redir2Origin=${encodeURIComponent('check_if_legit!' + embeddingOrigin)}` +
        `&redir2RelUrl=${encodeURIComponent(relativeUrl)}` +
        '&isTalkyard=true';

const ssoLogoutUrl =
    `http://localhost:8080/${u.ssoLogoutRedirPageSlug}`;

let pasetoV2LocalSecret = '';



describe(`embcom.sso.redir-page.2br.ec.e2e.ts  TyTE2EEMBSSO3`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some E2E Test",
      members: ['memah', 'maria', 'michael']
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;

    builder.settings({
      numFirstPostsToApprove: 0,
      numFirstPostsToReview: 0,
      enableApi: true,
    });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    selina_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });


  it(`Owen logs in to admin area, ... `, async () => {
    await owen_brA.adminArea.settings.login.goHere(site.origin, { loginAs: owen });
  });

  it(`... and types an SSO login URL`, async () => {
    await owen_brA.scrollToBottom(); // just speeds the test up slightly
    await owen_brA.adminArea.settings.login.typeSsoUrl(ssoUrl);
  });

  it(`... and enables SSO`, async () => {
    await owen_brA.adminArea.settings.login.setEnableSso(true);
  });

  it(`... types a Logout Redir URL`, async () => {
    await owen_brA.adminArea.settings.login.setSsoLogoutUrl(ssoLogoutUrl);
  });

  it(`... generates a PASETO v2.local shared secret`, async () => {
    await owen_brA.adminArea.settings.login.generatePasetoV2LocalSecret();
  });

  it(`... copies the secret`, async () => {
    pasetoV2LocalSecret = await owen_brA.adminArea.settings.login.copyPasetoV2LocalSecret();
  });

  it(`... and saves the new settings`, async () => {
    await owen_brA.adminArea.settings.clickSaveAll();
  });

  it(`There are external SSO login pages`, async () => {
    u.createSingleSignOnPagesInHtmlDir();
  });


  // ----- Encrypt tokens

  // E.g. "v2.local.kBENRnu2p2.....JKJZB9Lw"
  let selinasToken: St | U;

  it(`The external server generates a login token for Selina`, async () => {
    selinasToken = u.encryptLocalPasetoV2Token(pasetoV2LocalSecret, selinaAutnhMsg);
  });


  // ----- Create test website

  it(`There's a website with embedding pages`, async () => {
    const dir = 'target';
    const twoComtsPageId = 'twoComtsPageId';
    fs.writeFileSync(`${dir}/so-as-selina.html`, makeHtml('aaa', '#050', twoComtsPageId,
                                                                              selinasToken));
    fs.writeFileSync(`${dir}/so-no-token.html`, makeHtml('bbb', '#520', twoComtsPageId));
    function makeHtml(pageName: St, bgColor: St, discussionId: St, authnToken?: St): St {
      return u.makeEmbeddedCommentsHtml({
              pageName, discussionId, authnToken, localHostname, bgColor,
              ssoHow: 'RedirPage' });
    }
  });


  // ----- SSO, good token

  it(`Selina opens embedding page aaa`, async () => {
    await selina_brB.go2(embeddingOrigin + '/so-as-selina.html');
  });

  it(`... can reply directly, auto logged in via PASETO token`, async () => {
    await selina_brB.complex.replyToEmbeddingBlogPost("I got logged_in_via_a_PASETO_token");
    await selina_brB.complex.replyToPostNr(c.FirstReplyNr,
        "I'm writing that I wrote that I write that I'm writing that I'm writing", {
        isEmbedded: true });
  });

  /* But there is one, since there's a logout url, `ssoLogoutUrl`.
  it(`There's no logout button — not included, when auto logged in via token,
          then, the embedd*ing* page manages login/out
          by including/excluding a PASETO token   UNIMPL   [hide_authn_btns]`, async () => {
    assert.not(await selina_brB.metabar.isLogoutBtnDisplayed());
  }); */
  it(`There's no login button  (already logged in)`, async () => {
    assert.not(await selina_brB.metabar.isLoginButtonDisplayed());
  });


  // ----- No token

  it(`Selina goes to a page without any token`, async () => {
    await selina_brB.go2(embeddingOrigin + '/so-no-token.html');
    await selina_brB.switchToEmbeddedCommentsIrame();
    await selina_brB.metabar.waitForDisplayed();
  });

  it(`... she's NOT logged in, because auto token sessions are NOT remembered
        across page reloads`, async () => {
    await selina_brB.complex.waitForNotLoggedInInEmbeddedCommentsIframe({
          willBeLoginBtn: false });
    await selina_brB.switchToEmbeddedCommentsIrame();
    assert.not(await selina_brB.metabar.isMyUsernameVisible());
  });

  it(`... there's a Login button`, async () => {
    assert.ok(await selina_brB.metabar.isLoginButtonDisplayed());
  });
  it(`... no logout button`, async () => {
    assert.not(await selina_brB.metabar.isLogoutBtnDisplayed());
  });


  // ----- Combining emb SSO with SSO redirect   TyTEMBSSOREDIR

  // Clicking any action button, will redirect the whole embedding page to the SSO
  // server.

  let embeddingNoTokenRelUrl = '';

  it(`Selina clicks Log In`, async () => {
    await selina_brB.switchToAnyParentFrame();
    embeddingNoTokenRelUrl = await selina_brB.urlPathQueryHash();
    const actualEmbOrigin = await selina_brB.origin();
    assert.eq(actualEmbOrigin, embeddingOrigin); // ttt

    await selina_brB.rememberCurrentUrl();
    await selina_brB.switchToEmbeddedCommentsIrame();

    // We're in the comments iframe.  When we click Log In, it sends a 'ssoRedir'
    // message to Talkyard's script in the embedd*ing* page, which does
    // `location.assign(..)` to the SSO page.
    await selina_brB.metabar.clickLogin();
  });

  it(`... gets to the dummy external login page, at localhost:8080`, async () => {
    await selina_brB.waitForNewUrl();
  });

  it(`... with the correct url parameters`, async () => {
    const urlNow = await selina_brB.getUrl();
    assert.eq(urlNow, ssoUrlVarsReplaced(embeddingOrigin, embeddingNoTokenRelUrl));

    // The url is now: (plus line breaks)
    //  http://localhost:8080/sso-dummy-login.html
    //    ?redir2Origin=check_if_legit!http%3A%2F%2Fe2e-test-embsth.localhost%3A8080
    //    &redir2RelUrl=%2Fso-no-token.html
    //    &isTalkyard=true
  });

  for (let doWhat of ['Reply', 'Like', 'Disagree', 'Flag']) {

    it(`Selina goes back to the blog`, async () => {
      await selina_brB.go2(embeddingOrigin + '/so-no-token.html');
      await selina_brB.waitForExist('iframe#ed-embedded-editor');
      await selina_brB.rememberCurrentUrl();
      await selina_brB.switchToEmbeddedCommentsIrame();
    });

    switch (doWhat) {
      case 'Reply':
        it(`... clicks Reply to comment nr 2`, async () => {
          // This'll redirect to the SSO page, like above, but with '#comment-2' in
          // the return-to relative url (since we're trying to reply to that comment).
          await selina_brB.topic.clickReplyToPostNr(c.SecondReplyNr); // (#comment-2 == #post-3)
        });
        break;
      case 'Like':
        it(`... like-votes comment nr 2`, async () => {
          // This also redirects to the SSO page, with '...#comment-2' in the return-to url.
          await selina_brB.topic.clickLikeVote(c.SecondReplyNr);
        });
        break;
      case 'Disagree':
        it(`... disagrees with comment nr 2`, async () => {
          await selina_brB.topic.toggleDisagreeVote(c.SecondReplyNr, {
                  waitForModalGone: false }); // we'll get redirected instead
        });
        break;
      case 'Flag':
        it(`... flags comment nr 2`, async () => {
          await selina_brB.topic.clickFlagPost(c.SecondReplyNr, { needToClickMore: false });
        });
        break;
      default:
        die('TyE407SMJT24');
    }

    it(`... gets to the external login page, now with return-to '...#comment-2'`, async () => {
      await selina_brB.waitForNewUrl();
      const urlNow = await selina_brB.getUrl();
      assert.eq(urlNow, ssoUrlVarsReplaced(
            embeddingOrigin, embeddingNoTokenRelUrl + '#comment-2'));

      // The url is now: (plus line breaks)
      //  http://localhost:8080/sso-dummy-login.html
      //    ?redir2Origin=check_if_legit!http%3A%2F%2Fe2e-test-embsth.localhost%3A8080
      //    &redir2RelUrl=%2Fso-no-token.html%23comment-2
      //    &isTalkyard=true
    });
  }

});

