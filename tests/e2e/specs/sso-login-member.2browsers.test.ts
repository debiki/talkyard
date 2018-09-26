/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import c = require('../test-constants');

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


describe("sso-real  TyT5HNATS20P", () => {

  it("import a site", () => {
    const builder = buildSite();
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
    owensBrowser.adminArea.settings.login.typeSsoUrl(ssoUrl);
  });

  it("... and enables SSO", () => {
    owensBrowser.adminArea.settings.login.setEnableSso(true);
  });

  it("... and saves the new settings", () => {
    owensBrowser.adminArea.settings.clickSaveAll();
  });


  // ------ Maria logs in via SSO

  it("Maria goes to the discussion page", () => {
    mariasBrowser.go(discussionPageUrl);
  });

  let mariasUrlBeforeLogin;

  it("... clicks Log In, gets redirected to the SSO page", () => {
    mariasUrlBeforeLogin = mariasBrowser.url().value;
    mariasBrowser.rememberCurrentUrl();
    mariasBrowser.topbar.clickLogin();
    mariasBrowser.waitForNewUrl();
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
    console.log(`externalMaria: ${ JSON.stringify(externalMaria) }`);
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

  it("Maria is logged in now, as Maria", () => {
    const username = mariasBrowser.topbar.getMyUsername();
    assert.equal(username, 'maria');
  });

  /*
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


});

