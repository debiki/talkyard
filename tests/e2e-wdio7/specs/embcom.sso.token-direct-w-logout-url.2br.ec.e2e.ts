/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as u from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';



// Dupl code  [embcom_sso_e2e_dupl]

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

// Inited later. [_init_data_user]
let selinaWithMariasEmailAuthnMsg = _.cloneDeep(selinaAutnhMsg);


const localHostname = 'comments-for-e2e-test-embsth';
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



describe(`embcom.sso.token-direct-w-logout-url.2br.ec  TyTE2EEMBSSO1`, () => {

  it(`Construct site`, async () => {
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

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria_brB = brB;
    maria = forum.members.maria;
    maria.ssoId = 'maria_ssoid';   // TyTIMPWSSOID
    mariaExtUser = {
      // Exclude Maria's name, so we'll know that 'maria_ssoid' really gets used
      // to look up the correct user, and we'll se username "Maria" although
      // not specified here.  [.lookup_by_ssoid]
      // username: ... – no, skip
      // fullName: ... — skip
      ssoId: 'maria_ssoid',
      isEmailAddressVerified: true,
      primaryEmailAddress: maria.emailAddress,
    };

    selina_brB = brB;
    selinaWithMariasEmailAuthnMsg.data.user = {  // [_init_data_user]
      ...mariaExtUser,
      ssoId: selinaExtUser.ssoId,
    };
    assert.eq(selinaWithMariasEmailAuthnMsg.data.user.primaryEmailAddress,  // ttt
          maria.emailAddress);

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

    mariasToken = u.encryptLocalPasetoV2Token(pasetoV2LocalSecret, mariaAutnhMsg);
  });


  let badAuthnToken: St | U;

  it(`... a bad login token appears from nowhere (!)`, async () => {
    badAuthnToken = u.encryptLocalPasetoV2Token(
          'bad00bad00bad00bad00beefdeadbeefdeadbeefdeadbeefdeadbeefbaadbeef', selinaAutnhMsg);
  });

  let tokenNoUser: St | U;

  it(`... another one with a missing 'user' field  (hmm!)`, async () => {
    tokenNoUser = u.encryptLocalPasetoV2Token(pasetoV2LocalSecret, { data: { user: null }});
  });

  let tokenNoSsoId: St | U;

  it(`... another one with no 'ssoId' field  (gah!)`, async () => {
    tokenNoSsoId = u.encryptLocalPasetoV2Token(pasetoV2LocalSecret,
          { data: { user: { username: 'Brynolf' } }});  // 'ssoId' missing
  });

  let tokenWrongEmail: St | U;

  it(`... another one with Selena's 'ssoId' but Maria's email  (oops!)`, async () => {
    tokenWrongEmail = u.encryptLocalPasetoV2Token(
          pasetoV2LocalSecret, selinaWithMariasEmailAuthnMsg);
  });



  // ----- Create test website

  it(`There's a website with embedding pages`, async () => {
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



  // ----- SSO, good token

  it(`Selina opens embedding page aaa`, async () => {
    await selina_brB.go2(embeddingOrigin + '/so-as-selina.html');
  });

  it(`... can reply directly, auto logged in via PASETO token`, async () => {
    await selina_brB.complex.replyToEmbeddingBlogPost("I got logged_in_via_a_PASETO_token");
  });

  it(`There's no logout button — not included, when auto logged in via token,
          then, the embedd*ing* page manages login/out
          by including/excluding a PASETO token   UNIMPL   [hide_authn_btns]`, async () => {
    // assert.not(await selina_brB.metabar.isLogoutBtnDisplayed());
  });
  it(`... and no login button  (already logged in)`, async () => {
    assert.not(await selina_brB.metabar.isLoginButtonDisplayed());
  });



  // ----- No token

  it(`Selina goes to a page without any token`, async () => {
    await selina_brB.go2('/so-no-token.html');
    await selina_brB.switchToEmbeddedCommentsIrame();
    await selina_brB.metabar.waitForDisplayed();
  });

  it(`... she's NOT logged in, because auto token sessions are NOT remembered
        across page reloads`, async () => {
    // ttt  [.648927]
    await selina_brB.complex.waitForNotLoggedInInEmbeddedCommentsIframe({
          willBeLoginBtn: false });
    await selina_brB.switchToEmbeddedCommentsIrame();
    assert.not(await selina_brB.metabar.isMyUsernameVisible());
  });

  it(`... there's a Login button`, async () => {
    assert.ok(await selina_brB.metabar.isLoginButtonDisplayed());
  });
  it(`... no logout button  UNIMPL   [hide_authn_btns]`, async () => {
    //assert.not(await selina_brB.metabar.isLogoutBtnDisplayed());
  });


  /*  [hide_authn_btns]
  it(`Owen hides emb comments authn buttons — using PASETO tokens instead`, async () => {
    await owen_brA.adminArea.settings.login.setShowEmbAuthnBtns(false);
  });
  it(`... saves`, async () => {
    await owen_brA.adminArea.settings.clickSaveAll();
  });
  */


  it(`Selina reloads the page`, async () => {
    await selina_brB.refresh2();
    await selina_brB.switchToEmbeddedCommentsIrame();
    await selina_brB.metabar.waitForDisplayed();
  });
  it(`... still not logged in ...`, async () => {
    // test code tested above  [.648927]
    await selina_brB.complex.waitForNotLoggedInInEmbeddedCommentsIframe({
          willBeLoginBtn: false });
    await selina_brB.switchToEmbeddedCommentsIrame();
    assert.not(await selina_brB.metabar.isMyUsernameVisible());
  });
  it(`... and now, no login or logout buttons  UNIMPL  [hide_authn_btns]`, async () => {
    //assert.not(await selina_brB.metabar.isLoginButtonDisplayed());
    assert.not(await selina_brB.metabar.isLogoutBtnDisplayed());
  });


  it(`Now a reply notf email has arrived to Owen`, async () => {
    await server.waitUntilLastEmailMatches(site.id, owen.emailAddress,
          [selinaExtUser.username, "logged_in_via_a_PASETO_token"]);
  });



  // ----- Bad tokens

  it(`Selina goes to a page but The Token is Bad!`, async () => {
    await selina_brB.go2(embeddingOrigin + '/so-bad-token.html');
  });
  it(`... there's a server error dialog`, async () => {
    await selina_brB.switchToEmbCommentsIframeIfNeeded();
    await selina_brB.serverErrorDialog.waitAndAssertTextMatches('TyEPASSECEX_');
  });

  it(`Selina goes to a page with an ok token, but no 'user' field`, async () => {
    await selina_brB.go2(embeddingOrigin + '/so-no-user.html');
  });
  it(`... there's a server error dialog`, async () => {
    await selina_brB.switchToEmbCommentsIframeIfNeeded();
    await selina_brB.serverErrorDialog.waitAndAssertTextMatches(
          'TyEPARMAP0MAP_.*TyEPASCLAIMS_');
  });

  it(`Selina goes to a page with an ok token, but no 'ssoId' field`, async () => {
    await selina_brB.go2(embeddingOrigin + '/so-no-ssoid.html');
  });
  it(`... there's a server error dialog`, async () => {
    await selina_brB.switchToEmbCommentsIframeIfNeeded();
    await selina_brB.serverErrorDialog.waitAndAssertTextMatches('TyEPARMAP0ST_.*TyEPASCLAIMS_');
  });

  it(`Selina goes to a page with a token with her id, but Maria's email`, async () => {
    await selina_brB.go2(embeddingOrigin + '/so-wrong-email.html');
  });
  it(`... Selena gets logged in as Selena. Talkyard in this case ignores the email
          — it's used only during the first upsert (i.e. insert).
          To change the user after that, the external user database should instead
          call  /-/v0/upsert-user`, async () => {
    await selina_brB.switchToEmbCommentsIframeIfNeeded();
    await selina_brB.me.waitUntilLoggedIn();
    assert.eq(await selina_brB.metabar.getMyUsernameInclAt(), '@' + selinaExtUser.username);
  });
  it(`... she replies`, async () => {
    await selina_brB.complex.replyToEmbeddingBlogPost(`My id but_wrong_email`);
  });
  it(`... her name, 'Selena', not 'Maria', is shown as the author`, async () => {
    assert.eq(await selina_brB.topic.getPostAuthorUsernameInclAt(c.FirstReplyNr),
          '@' + selinaExtUser.username);
  });
  it(`... Owen gets notified via email — from Selena not Maria`, async () => {
    await server.waitUntilLastEmailMatches(site.id, owen.emailAddress,
          [selinaExtUser.username, "but_wrong_email"]);
  });




  it(`Selina returns to embedding page so-as-selina.html, with her token`, async () => {
    await selina_brB.go2(embeddingOrigin + '/so-as-selina.html');
  });

  it(`... she's logged in, can reply, just like before`, async () => {
    await selina_brB.complex.replyToEmbeddingBlogPost("Logged in via a PASETO token, msg 3");
  });



  // ----- View one's profile, via authn token login


  it(`Selina clicks her username in the pagebar`, async () => {
    await selina_brB.metabar.openMyProfilePageInNewTab();
  });

  it(`... a new tab opens; she switches to it`, async () => {
    assert.eq(await selina_brB.origin(), embeddingOrigin);
    await selina_brB.swithToOtherTabOrWindow();
  });

  it(`... she's now at the Talkyard server  (but not the embedding site)`, async () => {
    assert.eq(await selina_brB.origin(), site.origin);
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
  it(`Selina logs in (extra topbar Log In click currently needed)`, async () => {
    selinasProfilePageUrl = await selina_brB.getUrl();
    await selina_brB.rememberCurrentUrl();
    urlPath = await selina_brB.urlPath();
    assert.eq(urlPath, '/-/users/selina_un/activity/posts');  // ttt
    await selina_brB.topbar.clickLogin();
  });

  it(`... gets to the dummy external login page, at localhost:8080`, async () => {
    await selina_brB.waitForNewUrl();
    const urlNow = await selina_brB.getUrl();
    assert.eq(urlNow, ssoUrlVarsReplaced(urlPath));

    // http://localhost:8080/sso-dummy-login.html?returnPath=/-/users/selina_un/activity/posts
  });

  let oneTimeLoginSecret: St;

  it(`The remote server upserts Selina`, async () => {
    oneTimeLoginSecret = await server.apiV0.upsertUserGetLoginSecret({
          origin: site.origin, apiRequesterId: c.SysbotUserId,
          apiSecret: apiSecret.secretKey, externalUser: selinaExtUser });
  });

  it(`... gets back a one time login secret`, async () => {
    console.log(`Got back login secret: ${oneTimeLoginSecret}`);
    assert.ok(oneTimeLoginSecret);
  });

  it(`... redirects Selina back to Talkyard`, async () => {
    await selina_brB.rememberCurrentUrl();
    await selina_brB.apiV0.loginWithSecret({
            origin: site.origin, oneTimeSecret: oneTimeLoginSecret,
            thenGoTo: selinasProfilePageUrl });
    await selina_brB.waitForNewUrl();
    assert.eq(await selina_brB.origin(), site.origin);
  });

  it(`... now Selina is logged in`, async () => {
    await selina_brB.complex.waitUntilLoggedIn();
  });

  it(`... as ${selinaExtUser.username} herself`, async () => {
    const username = await selina_brB.userProfilePage.waitAndGetUsername();
    assert.eq(username, selinaExtUser.username + "(you)");
  });

  it(`... and can access her private stuff`, async () => {
    await selina_brB.userProfilePage.goToPreferences();
    await selina_brB.userProfilePage.preferences.switchToEmailsLogins();
  });

  it(`... sees her email: ${selinaExtUser.primaryEmailAddress}, verified`, async () => {
    await selina_brB.userProfilePage.preferences.emailsLogins.waitUntilEmailAddressListed(
          selinaExtUser.primaryEmailAddress, { shallBeVerified: true });
  });

  it(`Selina clicks Log Out`, async () => {
    await selina_brB.rememberCurrentUrl();
    await selina_brB.topbar.clickLogout({ waitForLoginButton: false });
    await selina_brB.waitForNewUrl();
  });

  it(`... gets redirected to the Logout URL  TyTSSOLGO002`, async () => {
    assert.eq(await selina_brB.getUrl(), ssoLogoutUrl);
    assert.includes(await selina_brB.getPageSource(), 'LGO_RDR_TST_865033_');
  });



  it(`At the no-token page, she isn't logged in`, async () => {
    await brB.go2(embeddingOrigin + '/so-no-token.html');
    await brB.switchToEmbCommentsIframeIfNeeded();
    await brB.metabar.waitUntilNotLoggedIn();
  });
  it(`... whilst at the yes-token, she *is* logged in`, async () => {
    await selina_brB.go2(embeddingOrigin + '/so-as-selina.html');
    await selina_brB.switchToEmbCommentsIframeIfNeeded();
    await selina_brB.metabar.waitUntilLoggedIn();
  });
  it(`... as Selina of course`, async () => {
    assert.eq(await selina_brB.metabar.getMyUsernameInclAt(), '@' + selinaExtUser.username);
  });

  it(`Selina clicks Log Out, this time in the embedded comments iframe`, async () => {
    await selina_brB.rememberCurrentUrl();
    await selina_brB.metabar.clickLogout({ waitForLoginButton: false });
    await selina_brB.waitForNewUrl();
  });

  it(`... gets redirected to the Logout URL  TyTSSOLGO002`, async () => {
    assert.eq(await selina_brB.getUrl(), ssoLogoutUrl);
    assert.includes(await selina_brB.getPageSource(), 'LGO_RDR_TST_865033_');
  });




  it(`Owen removes the Logout Redir URL  TyTSSOLGO002`, async () => {
    await owen_brA.adminArea.settings.login.setSsoLogoutUrl('');
  });
  it(`... and saves the new settings`, async () => {
    await owen_brA.adminArea.settings.clickSaveAll();
  });

  it(`Selina is back`, async () => {
    await selina_brB.go2(embeddingOrigin + '/so-as-selina.html');
    await selina_brB.switchToEmbCommentsIframeIfNeeded();
    await selina_brB.metabar.waitUntilLoggedIn();
    assert.eq(await selina_brB.metabar.getMyUsernameInclAt(), '@' + selinaExtUser.username);
  });

  // Now there shouldn't be any logout button? Because login is managed
  // by the embedd*ing* website and pat needs to log out from that website,
  // for it to no longer include the authn token. But, now with the Loguot Redir
  // url gone, pat no longer gets logged out from the embedding site.
  // So the logout button doesn't work, any more. Then, don't show it?
  //
  // ----------------
  // For now only, it's there, just reloads the iframe:  (thereafter, still logged in.)
  it(`... clicks Log Out again`, async () => {
    await selina_brB.metabar.clickLogout({ waitForLoginButton: false });
  });
  it(`... doesn't work, she's still logged in afterwards:
            the embedding site still includes the PASETO authn token`, async () => {
    await selina_brB.refresh2();
    await selina_brB.switchToEmbCommentsIframeIfNeeded();
    await selina_brB.metabar.waitUntilLoggedIn();
  });
  // ----------------
  // Later:
  it(`Now there's no logout button — Selena will need to use the embedding site's
            login and logout buttons instead,
            since just logging out from Ty wouldn't have any effect; the embedding
            page would still include the authn token  UNIMPL  [hide_authn_btns]`, async () => {
    //assert.not(await selina_brB.metabar.isLogoutBtnDisplayed());
    // ttt:
    assert.not(await selina_brB.metabar.isLoginButtonDisplayed());
  });
  // ----------------



  it(`Selina leaves, Maria logs in`, async () => {
    await brB.go2(embeddingOrigin + '/so-as-maria.html');
  });

  it(`Maria's token is embedded in the HTML`, async () => {
    await maria_brB.switchToEmbCommentsIframeIfNeeded();
    await maria_brB.metabar.waitUntilLoggedIn();
  });
  it(`... Maria not Selina is logged in   [.lookup_by_ssoid]`, async () => {
    assert.eq(await maria_brB.metabar.getMyUsernameInclAt(), '@' + maria.username);
  });


  it(`At the no-token page, no one is logged in`, async () => {
    await brB.go2(embeddingOrigin + '/so-no-token.html');
    await brB.switchToEmbCommentsIframeIfNeeded();
    await brB.metabar.waitUntilNotLoggedIn();
  });


  // TESTS_MISSING Maybe later:
  // Expired token — then try fetch from authn server, once iframe is in view?
  // That'll be a separate test?

});

