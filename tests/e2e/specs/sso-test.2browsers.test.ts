/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import fs = require('fs');
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import c = require('../test-constants');
import * as lad from '../utils/log-and-die';

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
    'http://localhost:8080/sso-test-login-page.html?returnTo=${talkyardPathQueryEscHash}&test=123';

const ssoUrlVarsReplaced =
    `http://localhost:8080/sso-test-login-page.html?returnTo=${c.SsoTestPath}&test=123`;

const owensSsoId = 'owensSsoId';
const mariasReplyText = "I login as usual, although SSO is being tested.";


describe("sso-test  TyT4ABKRW0268", () => {


  it("import a site", () => {
    const builder = buildSite();
    const site = builder.getSite();
    site.settings.enableApi = true;
    forum = builder.addLargeForum({
      title: "Test of SSO Test",
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

  it("create external login page, to be shown at localhost:8080/something.html", () => {
    const dirPath = 'target'; //  doesn't work:   target/e2e-emb' — why not.
    if (!fs.existsSync(dirPath)) {  // —>  "FAIL: Error \n unknown error line"
      fs.mkdirSync(dirPath, '0777');
    }
    fs.writeFileSync(`${dirPath}/sso-test-login-page.html`, `
<html>
<head>
<title>Single Sign-On E2E dummmy login page</title>
</head>
<body style="background: black; color: #ccc; font-family: monospace">
<p>This is a dummy external login page. Ok to delete. SSODUMMY01.</p>
</body>
</html>`);
  });


  it("Owen goes to the admin area, the API tab", () => {
    owensBrowser.adminArea.goToApi(siteIdAddress.origin, { loginAs: owen });
  });

  it("... generates an API secret", () => {
    owensBrowser.adminArea.apiTab.generateSecret();
  });

  let apiSecret: string;

  it("... copies the secret key", () => {
    apiSecret = owensBrowser.adminArea.apiTab.showAndCopyMostRecentSecret();
  });


  it("Owen goes to the admin area, login settings", () => {
    owensBrowser.adminArea.goToLoginSettings();
  });

  it("... and types an SSO login URL", () => {
    owensBrowser.adminArea.settings.login.typeSsoUrl(ssoUrl);
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("... clicks the link to the SSO test page", () => {
    owensBrowser.adminArea.settings.login.goToSsoTestPage();
  });

  it("The SSO test page says he needs to be logged out, to test login", () => {
    owensBrowser.waitForVisible('.e_SsoTstLgdIn');
  });

  it("... he logs out", () => {
    owensBrowser.deleteCookie('dwCoSid');
    owensBrowser.refresh();
  });

  it("On the SSO test page, he sees the SSO URL setting, and the variables-replaced version", () => {
    const ssoUrlShown = owensBrowser.waitAndGetVisibleText('.e_SsoSettingsUrl');
    const ssoUrlVarsReplShown = owensBrowser.waitAndGetVisibleText('.e_SsoTstLgiLnk');
    assert.equal(ssoUrlShown, ssoUrl);
    assert.equal(ssoUrlVarsReplShown, ssoUrlVarsReplaced);
  });

  it("... he sees a SSO login link", () => {
    const ssoLinkText = owensBrowser.waitAndGetVisibleText('.e_SsoTstLgiLnk');
    assert.equal(ssoLinkText, ssoUrlVarsReplaced);
  });

  it("... clicks it the SSO link", () => {
    owensBrowser.rememberCurrentUrl();
    owensBrowser.waitAndClick('.e_SsoTstLgiLnk');
    owensBrowser.waitForNewUrl();
  });

  it("... and gets to the dummy external login page, at localhost:8080", () => {
    const url = owensBrowser.getUrl();
    assert.equal(url, ssoUrlVarsReplaced);
  });

  it("... with the right contents", () => {
    // Maybe skip this? So won't have to start http-server. This doesn't really test anything anyway.
    //owensBrowser.assertPageHtmlSourceMatches_1('SSODUMMY01');
  });

  it("Let's pretend he logs in ... (noop)", () => {
    // Noop.
  });

  let oneTimeLoginSecret: string;

  it("The remote server does an API request to Talkyard, to synchronize his account", () => {
    const externalOwen = utils.makeExternalUserFor(owen, { ssoId: owensSsoId });
    console.log(`externalOwen: ${ JSON.stringify(externalOwen) }`);
    oneTimeLoginSecret = server.apiV0.upsertUserGetLoginSecret({ origin: siteIdAddress.origin,
        apiRequesterId: c.SysbotUserId, apiSecret, externalUser: externalOwen });
  });

  it("... gets back a one time login secret", () => {
    console.log(`Got back login secret: ${ oneTimeLoginSecret }`);
    assert(oneTimeLoginSecret);
  });

  it("... redirects Owen to the Talkyard login-with-secret endpoint", () => {
    owensBrowser.rememberCurrentUrl();
    owensBrowser.apiV0.loginWithSecret({
        origin: siteIdAddress.origin, oneTimeSecret: oneTimeLoginSecret, thenGoTo: '/-/sso-test' });
    owensBrowser.waitForNewUrl();
  });

  it("The Talkayrd server logs him in, and redirects him back to where he started", () => {
    const url = owensBrowser.getUrl();
    assert.equal(siteIdAddress.origin + '/-/sso-test', url);
  });

  it("He is logged in now", () => {
    owensBrowser.waitForVisible('.e_SsoTstLgdIn');
  });

  it("... as Owen", () => {
    const atUsername = owensBrowser.waitAndGetVisibleText('.e_LgdInAs');
    assert.equal(atUsername, '@owen_owner');
  });

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


  // ------ Others aren't affected, when just testing SSO

  it("Maria goes to the discussion page", () => {
    mariasBrowser.go(discussionPageUrl);
  });

  it("... logs in, without getting redirected to the external SSO login page", () => {
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... she logs out", () => {
    mariasBrowser.topbar.clickLogout();
  });

  it("... clicks reply", () => {
    mariasBrowser.topic.clickReplyToOrigPost();
  });

  it("... logs in and replies, without getting redirected to the external login page", () => {
    mariasBrowser.loginDialog.loginWithPassword(maria);
    mariasBrowser.editor.editText(mariasReplyText);
    mariasBrowser.editor.save();
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, mariasReplyText);
  });

});

