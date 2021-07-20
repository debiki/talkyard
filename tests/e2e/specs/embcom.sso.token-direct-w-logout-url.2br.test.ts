/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import fs = require('fs');
import server = require('../utils/server');
import u = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');

import * as Paseto from 'paseto.js';


let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;

let maria: Member;
let maria_brB: TyE2eTestBrowser;
let mariaExtUser: ExternalUser | U;

let selina_brB: TyE2eTestBrowser;
let selinasProfilePageUrl = '';
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

let selinaWithMariasEmailAuthnMsg = _.cloneDeep(selinaAutnhMsg);


const localHostname = 'comments-for-e2e-test-embsth-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embsth.localhost:8080';

let site: IdAddress;
let forum: TwoCatsTestForum;


const ssoUrl =
    `http://localhost:8080/${u.ssoLoginPageSlug}?returnPath=\${talkyardPathQueryEscHash}`;

const ssoUrlVarsReplaced = (path: string): string =>
    `http://localhost:8080/${u.ssoLoginPageSlug}?returnPath=${path}`;

const ssoLogoutUrl =
    `http://localhost:8080/${u.ssoLogoutRedirPageSlug}`;


const apiSecret: TestApiSecret = {
  nr: 1,
  userId: c.SysbotUserId,
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSecretKeyAbc123',
};

let pasetoV2LocalSecret = '';



describe(`embcom.sso.token-direct-w-logout-url.2br.test.ts  TyTE2EEMBSSO1`, () => {

  it(`Construct site`, () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some E2E Test",
      members: ['memah', 'maria', 'michael']
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;

    // Disable notifications, or notf email counts will be off
    // (since Owen would get emails).
    builder.settings({
      numFirstPostsToApprove: 0,
      numFirstPostsToReview: 0,
      enableApi: true,
    });

    builder.getSite().apiSecrets = [apiSecret];

    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.EveryPost,
      wholeSite: true,
    }];

    brA = new TyE2eTestBrowser(wdioBrowserA);
    brB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owen_brA = brA;

    maria_brB = brB;
    maria = forum.members.maria;
    maria.ssoId = 'maria_ssoid';   // TyTIMPWSSOID
    mariaExtUser = {
      // Exclude Maria's name, so we'll know that 'maria_ssoid' really gets used
      // to look up the correct user, and we'll se username "Maria" although
      // not specified here.  [.lookup_by_ssoid]
      ssoId: 'maria_ssoid',
      isEmailAddressVerified: true,
      primaryEmailAddress: maria.emailAddress,
    };

    selina_brB = brB;
    selinaWithMariasEmailAuthnMsg.data.user = {
      ...mariaExtUser,
      ssoId: selinaExtUser.ssoId,
    };
    assert.eq(selinaWithMariasEmailAuthnMsg.data.user.primaryEmailAddress,  // ttt
          maria.emailAddress);

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Owen logs in to admin area, ... `, () => {
    owen_brA.adminArea.settings.login.goHere(site.origin, { loginAs: owen });
  });

  it(`... and types an SSO login URL`, () => {
    owen_brA.scrollToBottom(); // just speeds the test up slightly
    owen_brA.adminArea.settings.login.typeSsoUrl(ssoUrl);
  });

  it(`... and enables SSO`, () => {
    owen_brA.adminArea.settings.login.setEnableSso(true);
  });

  it(`... types a Logout Redir URL`, () => {
    owen_brA.adminArea.settings.login.setSsoLogoutUrl(ssoLogoutUrl);
  });

  it(`... generates a PASETO v2.local shared secret`, () => {
    owen_brA.adminArea.settings.login.generatePasetoV2LocalSecret();
  });

  it(`... copies the secret`, () => {
    pasetoV2LocalSecret = owen_brA.adminArea.settings.login.copyPasetoV2LocalSecret();
  });

  it(`... and saves the new settings`, () => {
    owen_brA.adminArea.settings.clickSaveAll();
  });

  it(`There are external SSO login pages`, () => {
    u.createSingleSignOnPagesInHtmlDir();
  });


  let sharedSecretKeyBytes;


  let selinasToken: St | U;

  it(`An external server converts the symmetric secret to bytes`, () => {
    const pasetoV2LocalSecretNoHexPrefix = pasetoV2LocalSecret.replace(/^hex:/, '');
    sharedSecretKeyBytes = Buffer.from(
            pasetoV2LocalSecretNoHexPrefix, 'hex');
            // 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', 'hex');
  });

  it(`The external server generates a login token for Selina`, async () => {
    // Dupl code [.e2e_encr_paseto]
    const messageAsSt = JSON.stringify(selinaAutnhMsg);
    const sharedSecretKey  = new Paseto.SymmetricKey(new Paseto.V2());
    selinasToken = await sharedSecretKey.inject(sharedSecretKeyBytes).then(() => {
      const encoder = sharedSecretKey.protocol();
      return encoder.encrypt(messageAsSt, sharedSecretKey);
    }).then(token => {
      console.log(`Generated PASETO token for Selina:  ${token}`);
      // E.g. "v2.local.kBENRnu2p2.....JKJZB9Lw"
      return 'paseto:' + token;
    });;
  });


  let mariasToken: St | U;

  it(`... plus a token for Maria`, async () => {
    const mariaAutnhMsg = {
      data: {
        user: mariaExtUser,
      },
    };

    // ttt: The name will come from the database, not the token:
    assert.not(mariaAutnhMsg.data.user.username);
    assert.not(mariaAutnhMsg.data.user.fullName);
    assert.ok(maria.username && maria.fullName);

    // Dupl code [.e2e_encr_paseto]
    const messageAsSt = JSON.stringify(mariaAutnhMsg);
    const sharedSecretKey  = new Paseto.SymmetricKey(new Paseto.V2());
    mariasToken = await sharedSecretKey.inject(sharedSecretKeyBytes).then(() => {
      const encoder = sharedSecretKey.protocol();
      return encoder.encrypt(messageAsSt, sharedSecretKey);
    }).then(token => {
      console.log(`Generated PASETO token for Maria:  ${token}`);
      return 'paseto:' + token;
    });;
  });


  let badAuthnToken: St | U;

  it(`... a bad login token appears from nowhere (!)`, async () => {
    // Dupl code [.e2e_encr_paseto]
    const messageAsSt = JSON.stringify(selinaAutnhMsg);
    const badKeyBytes = Buffer.from(
            'bad00bad00bad00bad00beefdeadbeefdeadbeefdeadbeefdeadbeefbaadbeef', 'hex');
    const wrongKey  = new Paseto.SymmetricKey(new Paseto.V2());
    badAuthnToken = await wrongKey.inject(badKeyBytes).then(() => {
      const encoder = wrongKey.protocol();
      return encoder.encrypt(messageAsSt, wrongKey);
    }).then(token => {
      console.log(`Generated bad PASETO token:  ${token}`);
      return 'paseto:' + token;
    });;
  });

  let tokenNoUser: St | U;

  it(`... another one with a missing 'user' field  (hmm!)`, async () => {
    // Dupl code [.e2e_encr_paseto]
    const messageAsSt = JSON.stringify({ data: { user: null }});
    const sharedSecretKey  = new Paseto.SymmetricKey(new Paseto.V2());
    tokenNoUser = await sharedSecretKey.inject(sharedSecretKeyBytes).then(() => {
      const encoder = sharedSecretKey.protocol();
      return encoder.encrypt(messageAsSt, sharedSecretKey);
    }).then(token => {
      console.log(`Generated a PASETO token with no 'user' field:  ${token}`);
      return 'paseto:' + token;
    });;
  });

  let tokenNoSsoId: St | U;

  it(`... another one with no 'ssoId' field  (gah!)`, async () => {
    // Dupl code [.e2e_encr_paseto]
    const messageAsSt = JSON.stringify(
            { data: { user: { username: 'Brynolf' } }});  // 'ssoId' missing
    const sharedSecretKey  = new Paseto.SymmetricKey(new Paseto.V2());
    tokenNoSsoId = await sharedSecretKey.inject(sharedSecretKeyBytes).then(() => {
      const encoder = sharedSecretKey.protocol();
      return encoder.encrypt(messageAsSt, sharedSecretKey);
    }).then(token => {
      console.log(`Generated a PASETO token with no 'ssoId' field:  ${token}`);
      return 'paseto:' + token;
    });;
  });

  let tokenWrongEmail: St | U;

  it(`... another one with Selena's 'ssoId' but Maria's email  (oops!)`, async () => {
    // Dupl code [.e2e_encr_paseto]
    const messageAsSt = JSON.stringify(selinaWithMariasEmailAuthnMsg);
    const sharedSecretKey  = new Paseto.SymmetricKey(new Paseto.V2());
    tokenWrongEmail = await sharedSecretKey.inject(sharedSecretKeyBytes).then(() => {
      const encoder = sharedSecretKey.protocol();
      return encoder.encrypt(messageAsSt, sharedSecretKey);
    }).then(token => {
      console.log(`Generated PASETO token with Selena's id but Maria's email:  ${token}`);
      return 'paseto:' + token;
    });;
  });




  it(`There's a website with embedding pages`, () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/so-as-selina.html`, makeHtml('aaa', '#050', selinasToken));
    fs.writeFileSync(`${dir}/so-as-maria.html`, makeHtml('aaa', '#005', mariasToken));
    //fs.writeFileSync(`${dir}/so-as-samuel.html`, makeHtml('bbb', '#040'));
    fs.writeFileSync(`${dir}/so-bad-token.html`, makeHtml('bbb', '#500', badAuthnToken));
    fs.writeFileSync(`${dir}/so-no-token.html`, makeHtml('bbb', '#520'));
    fs.writeFileSync(`${dir}/so-no-user.html`, makeHtml('bbb', '#502', tokenNoUser));
    fs.writeFileSync(`${dir}/so-no-ssoid.html`, makeHtml('bbb', '#511', tokenNoSsoId));
    fs.writeFileSync(`${dir}/so-wrong-email.html`, makeHtml('bbb', '#404', tokenWrongEmail));
    function makeHtml(pageName: string, bgColor: string, authnToken?: St): string {
      return u.makeEmbeddedCommentsHtml({
              pageName, discussionId: '', authnToken, localHostname, bgColor});
    }
  });


  it(`Selina opens embedding page aaa`, () => {
    selina_brB.go2(embeddingOrigin + '/so-as-selina.html');
  });

  it(`... can reply directly, auto logged in via PASETO token`, () => {
    selina_brB.complex.replyToEmbeddingBlogPost("I got logged_in_via_a_PASETO_token");
  });

  it(`There's no logout button — not included, when auto logged in via token,
          then, the embedd*ing* page manages login/out
          by including/excluding a PASETO token   UNIMPL   [hide_authn_btns]`, () => {
    // assert.not(selina_brB.metabar.isLogoutBtnDisplayed());
  });
  it(`... and no login button  (already logged in)`, () => {
    assert.not(selina_brB.metabar.isLoginButtonDisplayed());
  });


  it(`Selina goes to a page without any token`, () => {
    selina_brB.go2('/so-no-token.html');
    selina_brB.switchToEmbeddedCommentsIrame();
    selina_brB.metabar.waitForDisplayed();
  });

  it(`... she's NOT logged in, because auto token sessions are NOT remembered
        across page reloads`, () => {
    // ttt  [.648927]
    selina_brB.complex.waitForNotLoggedInInEmbeddedCommentsIframe({
          willBeLogoutBtn: false });
    selina_brB.switchToEmbeddedCommentsIrame();
    assert.not(selina_brB.metabar.isMyUsernameVisible());
  });

  it(`... there's a Login button`, () => {
    assert.ok(selina_brB.metabar.isLoginButtonDisplayed());
  });
  it(`... no logout button  UNIMPL   [hide_authn_btns]`, () => {
    //assert.not(selina_brB.metabar.isLogoutBtnDisplayed());
  });


  /*  [hide_authn_btns]
  it(`Owen hides emb comments authn buttons — using PASETO tokens instead`, () => {
    owen_brA.adminArea.settings.login.setShowEmbAuthnBtns(false);
  });
  it(`... saves`, () => {
    owen_brA.adminArea.settings.clickSaveAll();
  });
  */


  it(`Selina reloads the page`, () => {
    selina_brB.refresh2();
    selina_brB.switchToEmbeddedCommentsIrame();
    selina_brB.metabar.waitForDisplayed();
  });
  it(`... still not logged in ...`, () => {
    // test code tested above  [.648927]
    selina_brB.complex.waitForNotLoggedInInEmbeddedCommentsIframe({
          willBeLogoutBtn: false });
    selina_brB.switchToEmbeddedCommentsIrame();
    assert.not(selina_brB.metabar.isMyUsernameVisible());
  });
  it(`... and now, no login or logout buttons  UNIMPL  [hide_authn_btns]`, () => {
    //assert.not(selina_brB.metabar.isLoginButtonDisplayed());
    assert.not(selina_brB.metabar.isLogoutBtnDisplayed());
  });


  it(`Now a reply notf email has arrived to Owen`, () => {
    server.waitUntilLastEmailMatches(site.id, owen.emailAddress,
          [selinaExtUser.username, "logged_in_via_a_PASETO_token"]);
  });



  // ----- Bad tokens

  it(`Selina goes to a page but The Token is Bad!`, () => {
    selina_brB.go2(embeddingOrigin + '/so-bad-token.html');
  });
  it(`... there's a server error dialog`, () => {
    selina_brB.switchToEmbCommentsIframeIfNeeded();
    selina_brB.serverErrorDialog.waitAndAssertTextMatches('TyEPASSECEX_');
  });

  it(`Selina goes to a page with an ok token, but no 'user' field`, () => {
    selina_brB.go2(embeddingOrigin + '/so-no-user.html');
  });
  it(`... there's a server error dialog`, () => {
    selina_brB.switchToEmbCommentsIframeIfNeeded();
    selina_brB.serverErrorDialog.waitAndAssertTextMatches(
          'TyEPARMAP0MAP_.*TyEPASCLAIMS_');
  });

  it(`Selina goes to a page with an ok token, but no 'ssoId' field`, () => {
    selina_brB.go2(embeddingOrigin + '/so-no-ssoid.html');
  });
  it(`... there's a server error dialog`, () => {
    selina_brB.switchToEmbCommentsIframeIfNeeded();
    selina_brB.serverErrorDialog.waitAndAssertTextMatches('TyEPARMAP0ST_.*TyEPASCLAIMS_');
  });

  it(`Selina goes to a page with a token with her id, but Maria's email`, () => {
    selina_brB.go2(embeddingOrigin + '/so-wrong-email.html');
  });
  it(`... Selena gets logged in as Selena. Talkyard in this case ignores the email
          — it's used only during the first upsert (i.e. insert).
          To change the user after that, the external user database should instead
          call  /-/v0/upsert-user`, () => {
    selina_brB.switchToEmbCommentsIframeIfNeeded();
    selina_brB.me.waitUntilLoggedIn();
    assert.eq(selina_brB.metabar.getMyUsernameInclAt(), '@' + selinaExtUser.username);
  });
  it(`... she replies`, () => {
    selina_brB.complex.replyToEmbeddingBlogPost(`My id but_wrong_email`);
  });
  it(`... her name, 'Selena', not 'Maria', is shown as the author`, () => {
    assert.eq(selina_brB.topic.getPostAuthorUsernameInclAt(c.FirstReplyNr),
          '@' + selinaExtUser.username);
  });
  it(`... Owen gets notified via email — from Selena not Maria`, () => {
    server.waitUntilLastEmailMatches(site.id, owen.emailAddress,
          [selinaExtUser.username, "but_wrong_email"]);
  });




  it(`Selina returns to embedding page so-as-selina.html, with her token`, () => {
    selina_brB.go2(embeddingOrigin + '/so-as-selina.html');
  });

  it(`... she's logged in, can reply, just like before`, () => {
    selina_brB.complex.replyToEmbeddingBlogPost("Logged in via a PASETO token, msg 3");
  });



  // ----- View one's profile, via authn token login


  it(`Selina clicks her username in the pagebar`, () => {
    selina_brB.metabar.openMyProfilePageInNewTab();
  });

  it(`... a new tab opens; she switches to it`, () => {
    assert.eq(selina_brB.origin(), embeddingOrigin);
    selina_brB.swithToOtherTabOrWindow();
  });

  it(`... she's now at the Talkyard server  (but not the embedding site)`, () => {
    assert.eq(selina_brB.origin(), site.origin);
  });



  // ----- Combining emb SSO with direct SSO   TyT306MRG2

  // Combining SSO in page PASETO tokens, with SSO login directly to forum:


  // Later:
  // The pat willl get redirected to the SSO login page,
  // probably auto authenticated there — since hen's logged in at the blog already.
  // And then redirected to hens profile page, with a one time login token.
  //
  // But currently Ty doesn't remember the session type, and doesn't know that
  // pat should get redirected to the SSO page, to be able to access hens profile.
  // Instead, currently, an extra Log In button click, is needed.
  //
  let urlPath = '';
  it(`Selina logs in (extra topbar Log In click currently needed)`, () => {
    selinasProfilePageUrl = selina_brB.getUrl();
    selina_brB.rememberCurrentUrl();
    urlPath = selina_brB.urlPath();
    assert.eq(urlPath, '/-/users/selina_un/activity/posts');  // ttt
    selina_brB.topbar.clickLogin();
  });

  it(`... gets to the dummy external login page, at localhost:8080`, () => {
    selina_brB.waitForNewUrl();
    const urlNow = selina_brB.getUrl();
    assert.eq(urlNow, ssoUrlVarsReplaced(urlPath));

    // http://localhost:8080/sso-dummy-login.html?returnPath=/-/users/selina_un/activity/posts
  });

  let oneTimeLoginSecret: St;

  it(`The remote server upserts Selina`, () => {
    oneTimeLoginSecret = server.apiV0.upsertUserGetLoginSecret({
          origin: site.origin, apiRequesterId: c.SysbotUserId,
          apiSecret: apiSecret.secretKey, externalUser: selinaExtUser });
  });

  it(`... gets back a one time login secret`, () => {
    console.log(`Got back login secret: ${oneTimeLoginSecret}`);
    assert.ok(oneTimeLoginSecret);
  });

  it(`... redirects Selina back to Talkyard`, () => {
    selina_brB.rememberCurrentUrl();
    selina_brB.apiV0.loginWithSecret({
            origin: site.origin, oneTimeSecret: oneTimeLoginSecret,
            thenGoTo: selinasProfilePageUrl });
    selina_brB.waitForNewUrl();
    assert.eq(selina_brB.origin(), site.origin);
  });

  it(`... now Selina is logged in`, () => {
    selina_brB.complex.waitUntilLoggedIn();
  });

  it(`... as ${selinaExtUser.username} herself`, () => {
    const username = selina_brB.userProfilePage.waitAndGetUsername();
    assert.eq(username, selinaExtUser.username + "(you)");
  });

  it(`... and can access her private stuff`, () => {
    selina_brB.userProfilePage.goToPreferences();
    selina_brB.userProfilePage.preferences.switchToEmailsLogins();
  });

  it(`... sees her email: ${selinaExtUser.primaryEmailAddress}, verified`, () => {
    selina_brB.userProfilePage.preferences.emailsLogins.waitUntilEmailAddressListed(
          selinaExtUser.primaryEmailAddress, { shallBeVerified: true });
  });

  it(`Selina clicks Log Out`, () => {
    selina_brB.rememberCurrentUrl();
    selina_brB.topbar.clickLogout({ waitForLoginButton: false });
    selina_brB.waitForNewUrl();
  });

  it(`... gets redirected to the Logout URL  TyTSSOLGO002`, () => {
    assert.eq(selina_brB.getUrl(), ssoLogoutUrl);
    assert.includes(selina_brB.getPageSource(), 'LGO_RDR_TST_865033_');
  });



  it(`At the no-token page, she isn't logged in`, () => {
    brB.go2(embeddingOrigin + '/so-no-token.html');
    brB.switchToEmbCommentsIframeIfNeeded();
    brB.metabar.waitUntilNotLoggedIn();
  });
  it(`... whilst at the yes-token, she *is* logged in`, () => {
    selina_brB.go2(embeddingOrigin + '/so-as-selina.html');
    selina_brB.switchToEmbCommentsIframeIfNeeded();
    selina_brB.metabar.waitUntilLoggedIn();
  });
  it(`... as Selina of course`, () => {
    assert.eq(selina_brB.metabar.getMyUsernameInclAt(), '@' + selinaExtUser.username);
  });

  it(`Selina clicks Log Out, this time in the embedded comments iframe`, () => {
    selina_brB.rememberCurrentUrl();
    selina_brB.metabar.clickLogout({ waitForLoginButton: false });
    selina_brB.waitForNewUrl();
  });

  it(`... gets redirected to the Logout URL  TyTSSOLGO002`, () => {
    assert.eq(selina_brB.getUrl(), ssoLogoutUrl);
    assert.includes(selina_brB.getPageSource(), 'LGO_RDR_TST_865033_');
  });




  it(`Owen removes the Logout Redir URL  TyTSSOLGO002`, () => {
    owen_brA.adminArea.settings.login.setSsoLogoutUrl('');
  });
  it(`... and saves the new settings`, () => {
    owen_brA.adminArea.settings.clickSaveAll();
  });

  it(`Selina is back`, () => {
    selina_brB.go2(embeddingOrigin + '/so-as-selina.html');
    selina_brB.switchToEmbCommentsIframeIfNeeded();
    selina_brB.metabar.waitUntilLoggedIn();
    assert.eq(selina_brB.metabar.getMyUsernameInclAt(), '@' + selinaExtUser.username);
  });

  // Now there shouldn't be any logout button? Because login is managed
  // by the embedd*ing* website and pat needs to log out from that website,
  // for it to no longer include the authn token. But, now with the Loguot Redir
  // url gone, pat no longer gets logged out from the embedding site.
  // So the logout button doesn't work, any more. Then, don't show it?
  //
  // ----------------
  // For now only, it's there, just reloads the iframe:  (thereafter, still logged in.)
  it(`... clicks Log Out again`, () => {
    selina_brB.metabar.clickLogout({ waitForLoginButton: false });
  });
  it(`... doesn't work, she's still logged in afterwards:
            the embedding site still includes the PASETO authn token`, () => {
    selina_brB.refresh2();
    selina_brB.switchToEmbCommentsIframeIfNeeded();
    selina_brB.metabar.waitUntilLoggedIn();
  });
  // ----------------
  // Later:
  it(`Now there's no logout button — Selena will need to use the embedding site's
            login and logout buttons instead,
            since just logging out from Ty wouldn't have any effect; the embedding
            page would still include the authn token  UNIMPL  [hide_authn_btns]`, () => {
    //assert.not(selina_brB.metabar.isLogoutBtnDisplayed());
    // ttt:
    assert.not(selina_brB.metabar.isLoginButtonDisplayed());
  });
  // ----------------



  it(`Selina leaves, Maria logs in`, () => {
    brB.go2(embeddingOrigin + '/so-as-maria.html');
  });

  it(`Maria's token is embedded in the HTML`, () => {
    maria_brB.switchToEmbCommentsIframeIfNeeded();
    maria_brB.metabar.waitUntilLoggedIn();
  });
  it(`... Maria not Selina is logged in   [.lookup_by_ssoid]`, () => {
    assert.eq(maria_brB.metabar.getMyUsernameInclAt(), '@' + maria.username);
  });


  it(`At the no-token page, no one is logged in`, () => {
    brB.go2(embeddingOrigin + '/so-no-token.html');
    brB.switchToEmbCommentsIframeIfNeeded();
    brB.metabar.waitUntilNotLoggedIn();
  });


  // TESTS_MISSING Maybe later:
  // Expired token — then try fetch from authn server, once iframe is in view?
  // That'll be a separate test?

});

