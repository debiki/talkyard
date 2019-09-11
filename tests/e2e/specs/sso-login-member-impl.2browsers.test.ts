/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import c = require('../test-constants');
import { die, dieIf } from '../utils/log-and-die';

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

let everyonesBrowsers;
let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser;
let maria: Member;
let mariasBrowser;
let michael: Member;
let michaelsBrowser;
let strangersBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: LargeTestForum;

let discussionPageUrl: string;

const ssoUrl =
    'http://localhost:8080/sso-dummy-login.html?returnPath=${talkyardPathQueryEscHash}';

const ssoUrlVarsReplaced = (path: string): string =>
    `http://localhost:8080/sso-dummy-login.html?returnPath=${path}`;

const mariasExternalId = 'mariasExternalId';
const mariasReplyText = "I login as usual, although SSO is being tested.";


// Previously, there was a bug [SSOBUGHACK] when combining SSO with Login Required,
// so let's test those combinations.

function constructSsoLoginTest(testName: string, variants: {
      loginRequired: boolean,
      ssoLoginRequiredLogoutUrl?: string,
      approvalRequired: boolean }) {  describe(testName, () => {  // I don't want to reindent now

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
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    richBrowserA = _.assign(browserA, pagesFor(browserA));
    richBrowserB = _.assign(browserB, pagesFor(browserB));

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    michael = forum.members.michael;
    michaelsBrowser = richBrowserB;
    strangersBrowser = richBrowserB;
  });


  // ----- Owen enables SSO

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


  // ------ Maria logs in via SSO

  const willBeInstantRedirect = variants.loginRequired && variants.ssoLoginRequiredLogoutUrl;

  it("Maria goes to the discussion page", () => {
    // (Don't try to disable rate limits, if there'll be an instant redirect
    // — that'd cause "Error: unable to set cookie". )
    mariasBrowser.go(discussionPageUrl, { useRateLimits: willBeInstantRedirect });
  });

  let mariasUrlBeforeLogin;

  it("... (maybe clicks Log In, and) gets redirected to the SSO page", () => {
    mariasUrlBeforeLogin = mariasBrowser.url().value;
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
    const url = mariasBrowser.url().value;
    const pathQueryHash = mariasUrlBeforeLogin.replace(siteIdAddress.origin, '');
    assert.equal(url, ssoUrlVarsReplaced(pathQueryHash));
  });

  it("Let's pretend she logs in ... (noop)", () => {
    // Noop.
  });

  let oneTimeLoginSecret: string;

  it("The remote server does an API request to Talkyard, to synchronize her account", () => {
    const externalMaria = utils.makeExternalUserFor(maria, { externalId: mariasExternalId });
    oneTimeLoginSecret = server.apiV0.upsertUserGetLoginSecret({ origin: siteIdAddress.origin,
        requesterId: c.SysbotUserId, apiSecret, externalUser: externalMaria });
  });

  // + try with the wrong secret
  // + try with the wrong requester id, like System

  it("... gets back a one time login secret", () => {
    console.log(`Got back login secret: ${ oneTimeLoginSecret }`);
    assert(oneTimeLoginSecret);
  });

  it("... redirects Maria to the Talkyard login-with-secret endpoint", () => {
    mariasBrowser.rememberCurrentUrl();
    mariasBrowser.apiV0.loginWithSecret({
      origin: siteIdAddress.origin, oneTimeSecret: oneTimeLoginSecret, thenGoTo: discussionPageUrl });
    mariasBrowser.waitForNewUrl();
  });

  it("The Talkayrd server logs her in, and redirects her back to where she started", () => {
    const url = mariasBrowser.url().value;
    assert.equal(url, discussionPageUrl);
  });


  if (variants.approvalRequired) {
    it("There's a message to Maria that she's not yet approved", () => {
      mariasBrowser.assertMayNotLoginBecauseNotYetApproved();
    });

    it("Owen approves Maria to join the site", () => {
      owensBrowser.adminArea.goToUsersEnabled();
      owensBrowser.adminArea.users.switchToWaiting();
      owensBrowser.adminArea.users.waiting.approveFirstListedUser();
    });

    it("Maria reloads the page", () => {
      mariasBrowser.refresh();
      // ... Oh she actually needs to login again. Thereafter, will work. (unimpl3904643)
      // But right now, this blocks forever.
      // TESTS_MISSING
    });
  }


  it("Maria is logged in now, as Maria", () => {
    const username = mariasBrowser.topbar.getMyUsername();
    assert.equal(username, 'maria');
  });


  it("Maria logs out", () => {
    mariasBrowser.rememberCurrentUrl();
    mariasBrowser.topbar.clickLogout({ waitForLoginButton: !variants.loginRequired });
  });

  if (variants.ssoLoginRequiredLogoutUrl) {
    it("... and gets sent to the  ssoLoginRequiredLogoutUrl  page ", () => {
      mariasBrowser.waitForNewOrigin();
      assert.equal(mariasBrowser.url().value, variants.ssoLoginRequiredLogoutUrl);
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




  Owen

  it("He clicks the Back-to-login-settings link, and gets back to the settings area, as admin", () => {
    owensBrowser.waitAndClick('.e_BkToStngs');
    owensBrowser.adminArea.waitAssertVisible();  // if can see, means is still admin
  });

  it("... logs out", () => {
    owensBrowser.topbar.clickLogout();
  });

  it("The one-time-login-secret cannot be used again", () => {
    owensBrowser.apiV0.loginWithSecret({
        origin: siteIdAddress.origin, oneTimeSecret: oneTimeLoginSecret, thenGoTo: '/-/sso-test' });
    owensBrowser.assertPageHtmlSourceMatches_1('TyELGISECR_');
  });

  it("... but he can still login with password, as usual", () => {
    owensBrowser.adminArea.goToLoginSettings('', { loginAs: owen });
  });
  */


}); }

export default constructSsoLoginTest;
