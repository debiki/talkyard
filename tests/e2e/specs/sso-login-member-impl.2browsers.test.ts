/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import * as fs from 'fs';
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
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: LargeTestForum;

let discussionPageUrl: string;

const loginPageSlug = 'sso-dummy-login.html';
const loginPageFileSysPath = './target/' + loginPageSlug;

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

// Previously, there was a bug [SSOBUGHACK] when combining SSO with Login Required,
// so let's test those combinations.

function constructSsoLoginTest(testName: string, variants: SsoLoginTestVariants) {
      describe(testName, () => {

  dieIf(variants.approvalRequired,
      "Not impl: variants.approvalRequired [TyE305KDKSHT20]")  // see (unimpl3904643)

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
    owensBrowser = richBrowserA;

    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    michael = forum.members.michael;
    michaelsBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });


  // ----- Owen enables SSO

  // Dupl code [40954RKSTDG2]

  it("Owen goes to the admin area, the API tab", () => {
    owensBrowser.adminArea.goToApi(siteIdAddress.origin, { loginAs: owen });
  });

  it("... generates an API secret, copies it", () => {
    owensBrowser.adminArea.apiTab.generateSecret();
  });

  let apiSecret: string;

  it("... copies the secret key", () => {
    apiSecret = owensBrowser.adminArea.apiTab.showAndCopyMostRecentSecret();
  });

  it("... goes to the login settings", () => {
    owensBrowser.adminArea.goToLoginSettings();
  });

  it("... and types an SSO login URL", () => {
    owensBrowser.scrollToBottom(); // just speeds the test up slightly
    owensBrowser.adminArea.settings.login.typeSsoUrl(ssoUrl);
  });

  it("... and enables SSO", () => {
    owensBrowser.scrollToBottom(); // just speeds the test up slightly
    owensBrowser.adminArea.settings.login.setEnableSso(true);
  });

  it("... and saves the new settings", () => {
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("Owen creates an external login page", () => {
    // Chrome? Webdriverio? wants a 200 OK reply, so need to create this dummy page.
    if (!fs.existsSync(loginPageFileSysPath)) {
      logMessage(`Creating html page: ${loginPageFileSysPath}`);
      fs.writeFileSync(loginPageFileSysPath,
            '<html><body>\n' +
            "Ty SSO test dummy login page. [8906QKSHM40]\n" +
            '</body></html>\n');
    }
    else {
      logMessage(`Page already exists: ${loginPageFileSysPath}`);
    }
  });


  if (variants.loginRequired || variants.approvalRequired) {
    it("Owen enables Login Requred and/or Approval Required", () => {
      owensBrowser.scrollToTop(); // just speeds the test up slightly
      if (variants.loginRequired) {
        owensBrowser.adminArea.settings.login.setLoginRequired(true);
      }
      if (variants.approvalRequired) {
        owensBrowser.adminArea.settings.login.setApproveUsers(true);
      }
      if (variants.ssoLoginRequiredLogoutUrl) {
        owensBrowser.scrollToBottom(); // speeds the test up
        owensBrowser.adminArea.settings.login.setSsoLoginRequiredLogoutUrl(
            variants.ssoLoginRequiredLogoutUrl);
      }
      owensBrowser.adminArea.settings.clickSaveAll();
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

  let externalMaria: ExternalUser;
  let extUserDispName: string;
  let extUsernameMustBe: string;
  let expectedErrorCode = newExtUser?.expectedErrorCode;

  it(`${extUserDispName} goes to the discussion page`, () => {
    const extUserAndResult: ExtUserAndResult = variants.extUsers?.[extUserNr];
    externalMaria = extUserAndResult?.extUser ||
            // `maria` not available outside this fn.
            utils.makeExternalUserFor(maria, { ssoId: mariasSsoId });

    extUsernameMustBe = extUserAndResult?.usernameAfteMustBe || 'maria';
    extUserDispName = externalMaria.fullName || `@${externalMaria.username}`;

    // (Don't try to disable rate limits, if there'll be an instant redirect
    // — that'd cause "Error: unable to set cookie". )
    mariasBrowser.go2(discussionPageUrl, {
      useRateLimits: willBeInstantRedirect,
      // Will get redirected directly to a non-existing dummy login page, different origin.
      // There's an harmles error, with WebDriver [E2ESSOLGIREDR].
      waitForPageType: false,
    });
  });

  let mariasUrlBeforeLogin;

  it("... (maybe clicks Log In, and) gets redirected to the SSO page", () => {
    mariasUrlBeforeLogin = mariasBrowser.getUrl();
    mariasBrowser.rememberCurrentUrl();  // (is wrong if willBeInstantRedirect, fine)

    if (variants.loginRequired) {
      if (variants.ssoLoginRequiredLogoutUrl) {
        // Should get auto redirected to the SSO url, at a different origin.
        // So url() above is the wrong url, instead:
        mariasUrlBeforeLogin = discussionPageUrl;
      }
      else {
        // No topbar visible, because not logged in yet. Instead, a "full screen"
        // login button is all Maria sees.
        mariasBrowser.loginDialog.clickSingleSignOnButton();
      }
    }
    else {
      // The forum is visible also without login, and in the topbar, there's a Login button,
      // which redirects to the single-sign-on page.
      mariasBrowser.topbar.clickLogin();   // [TyT2ABKR058TN2]
    }

    mariasBrowser.waitForNewOrigin(
        willBeInstantRedirect ? discussionPageUrl : undefined);
  });

  it("... and gets to the dummy external login page, at localhost:8080", () => {
    const url = mariasBrowser.getUrl();
    const pathQueryHash = mariasUrlBeforeLogin.replace(siteIdAddress.origin, '');
    assert.equal(url, ssoUrlVarsReplaced(pathQueryHash));
  });

  it("Let's pretend hen logs in ... (noop)", () => {
    // Noop.
  });

  let oneTimeLoginSecretOrError: string;

  it("The remote server does an API request to Talkyard, to synchronize hens account", () => {
    oneTimeLoginSecretOrError = server.apiV0.upsertUserGetLoginSecret({
          origin: siteIdAddress.origin, apiRequesterId: c.SysbotUserId,
          apiSecret: getApiSecret(), externalUser: externalMaria,
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
    mariasBrowser.rememberCurrentUrl();
    mariasBrowser.apiV0.loginWithSecret({
            origin: siteIdAddress.origin, oneTimeSecret: oneTimeLoginSecret,
            thenGoTo: discussionPageUrl });
    mariasBrowser.waitForNewUrl();
  });

  it("The Talkayrd server logs hen in, and redirects hen back to where hen started", () => {
    const url = mariasBrowser.getUrl();
    assert.equal(url, discussionPageUrl);
  });


  if (variants.approvalRequired) {
    it(`There's a message to ${extUserDispName} that hen's not yet approved`, () => {
      mariasBrowser.assertMayNotLoginBecauseNotYetApproved();
    });

    it(`Owen approves ${extUserDispName} to join the site`, () => {
      owensBrowser.adminArea.goToUsersEnabled();
      owensBrowser.adminArea.users.switchToWaiting();
      owensBrowser.adminArea.users.waiting.approveFirstListedUser();
    });

    it(`${extUserDispName} reloads the page`, () => {
      mariasBrowser.refresh();
      // ... Oh she actually needs to login again. Thereafter, will work. (unimpl3904643)
      // But right now, this blocks forever.
      // TESTS_MISSING
    });
  }


  let generatedUsername;

  it(`${extUserDispName} is logged in now`, () => {
    generatedUsername = mariasBrowser.topbar.getMyUsername();
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


  it(`${extUserDispName} logs out`, () => {
    mariasBrowser.rememberCurrentUrl();
    mariasBrowser.topbar.clickLogout({ waitForLoginButton: !variants.loginRequired });
  });

  if (variants.ssoLoginRequiredLogoutUrl) {
    it("... and gets sent to the  ssoLoginRequiredLogoutUrl  page ", () => {
      mariasBrowser.waitForNewOrigin();
      assert.equal(mariasBrowser.getUrl(), variants.ssoLoginRequiredLogoutUrl);
    });
  }
  else if (variants.loginRequired) {
    it("... and the SSO login button appears", () => {
      mariasBrowser.loginDialog.waitForSingleSignOnButton();
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
