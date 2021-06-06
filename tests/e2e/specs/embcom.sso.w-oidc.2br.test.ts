/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let mons: Member;
let mons_brA: TyE2eTestBrowser;
let modya: Member;
let modya_brA: TyE2eTestBrowser;
let corax: Member;
let corax_brA: TyE2eTestBrowser;
let regina: Member;
let regina_brB: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let michael: Member;
let michael_brB: TyE2eTestBrowser;
let mallory: Member;
let mallory_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

const localHostname = 'e2e-test-azure-oidc'; // settings.azureTalkyardLocalHostname;
const embeddingOrigin = 'http://e2e-test-embssooidc.localhost:8080';

const loginPageSlug = 'sso-dummy-login.html';

const ssoUrl =
    `http://localhost:8080/${loginPageSlug}?returnPath=\${talkyardPathQueryEscHash}`;

const ssoUrlVarsReplaced = (path: string): string =>
    `http://localhost:8080/${loginPageSlug}?returnPath=${path}`;


let site: IdAddress;
let forum: TwoCatsTestForum;



describe(`some-e2e-test  TyTE2E1234ABC`, () => {

  if (!settings.https) {
    console.log("Skipping Azure OIDC spec; only works with HTTPS");
    return;
  }

  it(`Construct site`, () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Blog comments SSO w OIDC",
      members: ['maria'],
    });

    // Embedded comments:
    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;

    // OIDC SSO:
    builder.getSite().settings.enableCustomIdps = true;
    builder.getSite().identityProviders = [{
      id: 1,
      protocol: "oidc",
      alias: "azure_test_alias",
      enabled: true,
      displayName: "Azure AD Test",
      description: "Azure AD login test",
      guiOrder: null,
      trustVerifiedEmail: true,
      emailVerifiedDomains: settings.azureEmailVerifiedDomains,
      linkAccountNoLogin: false,
      syncMode: 1,
      oauAuthorizationUrl: settings.azureOauAuthorizationUrl,
      oauAuthReqScope: "openid",
      oauAuthReqClaims: null,
      oauAuthReqHostedDomain: null,
      oauAccessTokenUrl: settings.azureOauAccessTokenUrl,
      oauAccessTokenAuthMethod: null,
      oauClientId: settings.azureOidcClientId,
      oauClientSecret: settings.azureOidcClientSecret,
      oauIssuer: "https://what.eve.r.example.com",
      oidcUserInfoUrl: "https://graph.microsoft.com/oidc/userinfo",
      oidcUserInfoFieldsMap: null,
      oidcUserinfoReqSendUserIp: null,
      oidcLogoutUrl: null
    }];

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    brA = new TyE2eTestBrowser(wdioBrowserA);
    brB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owen.emailAddress = settings.azureUser01UsernameAndEmail;
    owen_brA = brA;

    mons = forum.members.mons;
    mons_brA = brA;
    modya = forum.members.modya;
    modya_brA = brA;
    corax = forum.members.corax;
    corax_brA = brA;

    regina = forum.members.regina;
    regina_brB = brB;
    maria = forum.members.maria;
    maria_brB = brB;
    memah = forum.members.memah;
    memah_brB = brB;
    michael = forum.members.michael;
    michael_brB = brB;
    mallory = forum.members.mallory;
    mallory_brB = brB;
    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Create embedding pages`, () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/embssooidc-a.html`, makeHtml('aaa', '#500'));
    fs.writeFileSync(`${dir}/embssooidc-b.html`, makeHtml('bbb', '#040'));
    function makeHtml(pageName: string, bgColor: string): string {
      return utils.makeEmbeddedCommentsHtml({ pageName, discussionId: '', localHostname, bgColor});
    }
  });


  it(`Owen goes to the blog`, () => {
owen_brA.d();
    //owen_brA.adminArea.settings.login.goHere(site.origin);
    owen_brA.go2(embeddingOrigin + '/embssooidc-a.html');
  });

  it("... clicks Log In", () => {
    owen_brA.switchToEmbeddedCommentsIrame();
    owen_brA.metabar.clickLogin();
  });

  it(`... a popup opens; Owen switches to it`, () => {
    owen_brA.swithToOtherTabOrWindow(IsWhere.LoginPopup);
  });

  it(`... picks OIDC (Azure)`, () => {
    owen_brA.loginDialog.clickLoginWithOidcAzureAd();
  });

  it(`... logs in with OIDC`, () => {
    owen_brA.loginDialog.loginWithOidcAzureAd({
          email: settings.azureUser01UsernameAndEmail,
          password: settings.azureUser01Password,
          isInLoginPopupAlready: true,
          //fullScreenLogin: true,  // admin area
          });
  });

  it(`... links the account`, () => {
    owen_brA.loginDialog.clickYesLinkAccounts();
  });

  it(`... clicks Log In Again`, () => {
owen_brA.d();
    owen_brA.loginDialog.clickLogInAgain({
          isInPopupThatWillClose: true });
  });

  it(`... the login popup closes`, () => {
owen_brA.d();
    owen_brA.switchBackToFirstTabOrWindow(IsWhere.EmbeddingPage);
  });

  it(`Owen clicks a link to the admin area`, () => {
    owen_brA.d();
  });

  it(`... goes to the login settings`, () => {
    owen_brA.adminArea.tabs.navToLoginSettings();
  });

  it(`... enables SSO via OIDC`, () => {
    owen_brA.adminArea.settings.login.setOnlyOidc(true);
  });

  it(`... saves`, () => {
    owen_brA.adminArea.settings.clickSaveAll();
  });



  it("Maria opens embedding embssooidc-a.html", () => {
    maria_brB.go2(embeddingOrigin + '/embssooidc-a.html');
  });

  it("... logs in", () => {
    maria_brB.d();
    owen_brA.switchToEmbeddedCommentsIrame();
    maria_brB.metabar.clickLogin();
  });

});

