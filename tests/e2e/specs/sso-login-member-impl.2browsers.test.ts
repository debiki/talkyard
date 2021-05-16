/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import tyAssert = require('../utils/ty-assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import c = require('../test-constants');
import { die, dieIf, logMessage } from '../utils/log-and-die';





let everyonesBrowsers;
let richBrowserA;
let richBrowserB;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let user_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: LargeTestForum;

let discussionPageUrl: string;

const loginPageSlug = 'sso-dummy-login.html';
const afterLogoutPageSlug = 'after-logout-page.html';

const ssoUrl =
    `http://localhost:8080/${loginPageSlug}?returnPath=\${talkyardPathQueryEscHash}`;

const ssoUrlVarsReplaced = (path: string): string =>
    `http://localhost:8080/${loginPageSlug}?returnPath=${path}`;

const mariasSsoId = 'mariasSsoId';
const mariasReplyText = "I login as usual, although SSO is being tested.";

export interface ExtUserAndResult {
  extUser: ExternalUser;
  expectedErrorCode?: string;
  usernameAfteMustBe?: string;
  usernameAfteMustMatch?: RegExp;
}

export interface SsoLoginTestVariants {
  loginRequired: boolean;
  ssoLoginRequiredLogoutUrl?: string;
  approvalRequired: boolean;
  extUsers?: ExtUserAndResult[];
}

// Previously, there was a bug when combining SSO with Login Required,
// because the sso endpoint (/-/v0/login-with-secret) wasn't public,
// isLogin = true wasn't set.
// So let's test those combinations.

function constructSsoLoginTest(testName: string, variants: SsoLoginTestVariants) {
      describe(testName, () => {

  dieIf(variants.approvalRequired,
      "Not impl: variants.approvalRequired [TyE305KDKSHT20]")  // see (unimpl3904643)

  // Maybe the param should be a Bo instead.
  dieIf(variants.ssoLoginRequiredLogoutUrl && variants.ssoLoginRequiredLogoutUrl !=
            "http://localhost:8080/" + afterLogoutPageSlug, "TyE602MKSRM2");

  it("import a site", () => {
    const builder = buildSite();
    const site = builder.getSite();
    site.settings.enableApi = true;
    forum = builder.addLargeForum({
      title: "Test of SSO for Real",
      members: undefined, // default = everyone
    });
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    discussionPageUrl = siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owen_brA = richBrowserA;

    maria = forum.members.maria;
    user_brB = richBrowserB;
    stranger_brB = richBrowserB;
  });


  // ----- Owen enables SSO

  // Dupl code [40954RKSTDG2]

  it("Owen goes to the admin area, the API tab", () => {
    owen_brA.adminArea.goToApi(siteIdAddress.origin, { loginAs: owen });
  });

  it("... generates an API secret, copies it", () => {
    owen_brA.adminArea.apiTab.generateSecret();
  });

  let apiSecret: string;

  it("... copies the secret key", () => {
    apiSecret = owen_brA.adminArea.apiTab.showAndCopyMostRecentSecret();
  });

  it("... goes to the login settings", () => {
    owen_brA.adminArea.goToLoginSettings();
  });

  it("... and types an SSO login URL", () => {
    owen_brA.scrollToBottom(); // just speeds the test up slightly
    owen_brA.adminArea.settings.login.typeSsoUrl(ssoUrl);
  });

  it("... and enables SSO", () => {
    owen_brA.scrollToBottom(); // just speeds the test up slightly
    owen_brA.adminArea.settings.login.setEnableSso(true);
  });

  it("... and saves the new settings", () => {
    owen_brA.adminArea.settings.clickSaveAll();
  });

  it("Owen creates an external login page, and after-logout page", () => {
    // Chrome? Webdriverio? wants a 200 OK reply, so need to create this dummy page.
    utils.createPageInHtmlDirUnlessExists(loginPageSlug,
            '<html><body>\n' +
            "SSO Login Ty test page. [8906QKSHM40]\n" +
            '</body></html>\n');
    utils.createPageInHtmlDirUnlessExists(afterLogoutPageSlug,
            '<html><body>\n' +
            "After Logout Ty SSO test page. [AFT_LGO_TST_537503_]\n" +
            '</body></html>\n');
  });


  if (variants.loginRequired || variants.approvalRequired) {
    it("Owen enables Login Requred and/or Approval Required", () => {
      owen_brA.scrollToTop(); // just speeds the test up slightly
      if (variants.loginRequired) {
        owen_brA.adminArea.settings.login.setLoginRequired(true);
      }
      if (variants.approvalRequired) {
        owen_brA.adminArea.settings.login.setApproveUsers(true);
      }
      if (variants.ssoLoginRequiredLogoutUrl) {
        owen_brA.scrollToBottom(); // speeds the test up
        owen_brA.adminArea.settings.login.setSsoLoginRequiredLogoutUrl(
            variants.ssoLoginRequiredLogoutUrl);
      }
      owen_brA.adminArea.settings.clickSaveAll();
    });
  }


  // ------ Ext users logs in via SSO

  for (let extUserNr = 0; extUserNr < (variants.extUsers?.length || 1); ++extUserNr) {
    addOneExtUserTests(variants, () => apiSecret, extUserNr);
  }

}); }



function addOneExtUserTests(variants: SsoLoginTestVariants, getApiSecret: () => string,
            extUserNr: number) {

  const willBeInstantRedirect = !!(
      variants.loginRequired && variants.ssoLoginRequiredLogoutUrl);

  const newExtUser: ExtUserAndResult = variants.extUsers?.[extUserNr];

  let externalUser: ExternalUser;
  let extUserDispName = newExtUser?.extUser?.fullName || 'maria';
  let extUsernameMustBe: string;
  let expectedErrorCode = newExtUser?.expectedErrorCode;

  it(`${extUserDispName} goes to the discussion page`, () => {
    const extUserAndResult: ExtUserAndResult = variants.extUsers?.[extUserNr];
    externalUser = extUserAndResult?.extUser ||
            // `maria` not available outside this fn.
            utils.makeExternalUserFor(maria, { ssoId: mariasSsoId });

    extUsernameMustBe = extUserAndResult?.usernameAfteMustBe || 'maria';
    // This line not needed? Done above already, right?
    extUserDispName = externalUser.fullName || `@${externalUser.username}`;

    // (Don't try to disable rate limits, if there'll be an instant redirect
    // — that'd cause "Error: unable to set cookie". )
    user_brB.go2(discussionPageUrl, {
      useRateLimits: willBeInstantRedirect,
      // Will get redirected directly to a non-existing dummy login page, different origin.
      // There's an harmles error, with WebDriver [E2ESSOLGIREDR].
      waitForPageType: false,
    });
  });

  let usersUrlBeforeLogin;

  it("... (maybe clicks Log In, and) gets redirected to the SSO page", () => {
    usersUrlBeforeLogin = user_brB.getUrl();
    user_brB.rememberCurrentUrl();  // (is wrong if willBeInstantRedirect, fine)

    if (variants.loginRequired) {
      if (variants.ssoLoginRequiredLogoutUrl) {
        // Should get auto redirected to the SSO url, at a different origin.
        // So url() above is the wrong url, instead:
        usersUrlBeforeLogin = discussionPageUrl;
      }
      else {
        // No topbar visible, because not logged in yet. Instead, a "full screen"
        // login button is all Maria sees.
        user_brB.loginDialog.clickSingleSignOnButton();
      }
    }
    else {
      // The forum is visible also without login, and in the topbar, there's a Login button,
      // which redirects to the single-sign-on page.
      user_brB.topbar.clickLogin();   // [TyT2ABKR058TN2]
    }

    user_brB.waitForNewOrigin(
        willBeInstantRedirect ? discussionPageUrl : undefined);
  });

  it("... and gets to the dummy external login page, at localhost:8080", () => {
    const url = user_brB.getUrl();
    const pathQueryHash = usersUrlBeforeLogin.replace(siteIdAddress.origin, '');
    assert.equal(url, ssoUrlVarsReplaced(pathQueryHash));
  });

  it("Let's pretend hen logs in ... (noop)", () => {
    // Noop.
  });

  let oneTimeLoginSecretOrError: string;

  it("The remote server does an API request to Talkyard, to synchronize hens account", () => {
    oneTimeLoginSecretOrError = server.apiV0.upsertUserGetLoginSecret({
          origin: siteIdAddress.origin, apiRequesterId: c.SysbotUserId,
          apiSecret: getApiSecret(), externalUser: externalUser,
          fail: !!expectedErrorCode });
  });

  if (expectedErrorCode) {
    it(`But there's an error: ${expectedErrorCode}`, () => {
      const errorMessage = oneTimeLoginSecretOrError;
      tyAssert.includes(errorMessage, expectedErrorCode);
    });
  }
  else {  // don't want to reindent now

  let oneTimeLoginSecret: string;

  it("... gets back a one time login secret", () => {
    oneTimeLoginSecret = oneTimeLoginSecretOrError;
    console.log(`Got back login secret: ${ oneTimeLoginSecret }`);
    assert(oneTimeLoginSecret);
  });

  it(`... redirects ${extUserDispName} to the Talkyard login-with-secret endpoint`, () => {
    user_brB.rememberCurrentUrl();
    user_brB.apiV0.loginWithSecret({
            origin: siteIdAddress.origin, oneTimeSecret: oneTimeLoginSecret,
            thenGoTo: discussionPageUrl });
    user_brB.waitForNewUrl();
  });

  it("The Talkayrd server logs hen in, and redirects hen back to where hen started", () => {
    const url = user_brB.getUrl();
    assert.equal(url, discussionPageUrl);
  });


  if (variants.approvalRequired) {
    it(`There's a message to ${extUserDispName} that hen's not yet approved`, () => {
      user_brB.assertMayNotLoginBecauseNotYetApproved();
    });

    it(`Owen approves ${extUserDispName} to join the site`, () => {
      owen_brA.adminArea.goToUsersEnabled();
      owen_brA.adminArea.users.switchToWaiting();
      owen_brA.adminArea.users.waiting.approveFirstListedUser();
    });

    it(`${extUserDispName} reloads the page`, () => {
      user_brB.refresh();
      // ... Oh she actually needs to login again. Thereafter, will work. (unimpl3904643)
      // But right now, this blocks forever.
      // TESTS_MISSING
    });
  }


  let generatedUsername;

  it(`${extUserDispName} is logged in now`, () => {
    generatedUsername = user_brB.topbar.getMyUsername();
    assert.ok(generatedUsername.length >= 1);
  });


  it(`... as @${newExtUser?.usernameAfteMustMatch || extUsernameMustBe}`, () => {
    if (newExtUser?.usernameAfteMustMatch) {
      tyAssert.matches(generatedUsername, newExtUser?.usernameAfteMustMatch);
    }
    else {
      tyAssert.eq(generatedUsername, extUsernameMustBe);
    }
  });


  it(`${extUserDispName} views hens login methods on hens profile page`, () => {
    user_brB.topbar.clickGoToProfile();
    user_brB.userProfilePage.goToPreferences();
    user_brB.userProfilePage.preferences.switchToEmailsLogins();
  });

  it(`... sees Single Sign-On login method  TyTE2ESSOLGIMS`, () => {
    // If new user, then, !!extUsers and the only login method is SSO — index is 1.
    // Else, there's password login plus SSO, index will be 2.
    user_brB.userProfilePage.preferences.emailsLogins.waitAndAssertLoginMethod({
          index: variants.extUsers?.length ? 1 : 2,
          providerName: 'Talkyard Single Sign-On API',
          username: undefined,
          emailAddr: undefined });
  });



  it(`${extUserDispName} logs out, when at: /-/username/...`, () => {
    user_brB.rememberCurrentUrl();
    user_brB.topbar.clickLogout({ waitForLoginButton: !variants.loginRequired });
  });

  if (variants.ssoLoginRequiredLogoutUrl) {


    // ----- Test SSO Logout URLs  TyTE2ELGOURL


    // 1) This was when logging out from /-/username/../..:

    it("... and gets sent to the  ssoLoginRequiredLogoutUrl  page ", () => {
      user_brB.waitForNewOrigin();
      tyAssert.eq(user_brB.getUrl(), variants.ssoLoginRequiredLogoutUrl);
      tyAssert.includes(user_brB.getPageSource(), 'AFT_LGO_TST_537503_');
    });

    // 2) Now try logging out from a discussion page:

    it("Logs in again: A remote server generates a login secret ...", () => {
      oneTimeLoginSecret = server.apiV0.upsertUserGetLoginSecret({
            origin: siteIdAddress.origin, apiRequesterId: c.SysbotUserId,
            apiSecret: getApiSecret(), externalUser: externalUser,
            fail: !!expectedErrorCode });
    });

    it(`... ${extUserDispName} uses the secret to login`, () => {
      user_brB.rememberCurrentUrl();
      user_brB.apiV0.loginWithSecret({
              origin: siteIdAddress.origin, oneTimeSecret: oneTimeLoginSecret,
              thenGoTo: discussionPageUrl });
      user_brB.waitForNewUrl();
    });

    it(`${extUserDispName} logs out, when on a discussion page`, () => {
      user_brB.rememberCurrentUrl();
      user_brB.topbar.clickLogout({ waitForLoginButton: !variants.loginRequired });
    });

    it("... and again gets sent to the  ssoLoginRequiredLogoutUrl  page ", () => {
      user_brB.waitForNewOrigin();
      tyAssert.eq(user_brB.getUrl(), variants.ssoLoginRequiredLogoutUrl);
      tyAssert.includes(user_brB.getPageSource(), 'AFT_LGO_TST_537503_');
    });


  }
  else if (variants.loginRequired) {
    it("... and the SSO login button appears", () => {
      user_brB.loginDialog.waitForSingleSignOnButton();
    });
  }
  else {
    // clickLogout() has already verified that a Log In button has appeared.
  }


  /*

  it("... clicks reply", () => {
    mariasBrowser.topic.clickReplyToOrigPost();
  });

  it("... logs in and replies, without getting redirected to the external login page", () => {
    mariasBrowser.loginDialog.loginWithPassword(maria);
    mariasBrowser.editor.editText(mariasReplyText);
    mariasBrowser.editor.save();
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, mariasReplyText);
  });

  + check stays logged in

  */

  }
}

export default constructSsoLoginTest;
