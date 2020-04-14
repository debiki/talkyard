/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import c = require('../test-constants');





let everyonesBrowsers;
let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let mons: Member;
let monsBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;

const staffOnlyTopic = { title: 'staffOnlyTopic Title', body: 'staffOnlyTopic Body.' };

const monsExternalId = 'monsExternalId';

const ssoUrl =
    'http://localhost:8080/sso-login-to-access.html?returnPath=${talkyardPathQueryEscHash}';

const ssoUrlVarsReplaced = (path: string): string =>
    `http://localhost:8080/sso-login-to-access.html?returnPath=${path}`;

const majasExternalId = 'majasExternalId';
const majasReplyText = "I login as usual, although SSO is being tested.";


describe("sso-access-denied-login  TyT4AKT02DKJ41", () => {

  it("import a site", () => {
    const builder = buildSite();
    const site = builder.getSite();
    site.settings.enableApi = true;
    forum = builder.addTwoPagesForum({
      title: "Test of SSO for Real",
      members: ['mons', 'maja', 'michael', 'maria'],
    });
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    mons = forum.members.mons;
    monsBrowser = richBrowserB;
  });


  // ----- Owen enables SSO  LATER import instead, once supported  [5ABKR2038]

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
    owensBrowser.adminArea.settings.login.typeSsoUrl(ssoUrl);
  });

  it("... and enables SSO", () => {
    owensBrowser.adminArea.settings.login.setEnableSso(true);
  });

  it("... and saves the new settings", () => {
    owensBrowser.adminArea.settings.clickSaveAll();
  });


  // ------ Accessing a staff-only page, and may see it, but is logged out

  let staffOnlyPageUrl;

  it("Owen creates a staff-only page", () => {
    owensBrowser.forumTopicList.goHere({ categorySlug: forum.categories.staffOnlyCategory.slug });
    owensBrowser.complex.createAndSaveTopic(staffOnlyTopic);
    staffOnlyPageUrl = owensBrowser.getUrl();
  });

  it("Mons goes to the staff-only page", () => {
    monsBrowser.go(staffOnlyPageUrl);
  });

  it("... there's an access denied error", () => {
    monsBrowser.waitForVisible('.s_LD_NotFound_Title');
  });

  it("... and a SSO login button", () => {
    monsBrowser.waitForVisible('.s_LD_SsoB');
  });


  // ------ SSO login via login page

   let monsUrlBeforeLogin;

  it("... which Mons clicks", () => {
    monsUrlBeforeLogin = monsBrowser.getUrl();
    monsBrowser.rememberCurrentUrl();
    monsBrowser.waitAndClick('.s_LD_SsoB');
    monsBrowser.waitForNewUrl();
  });

  it("... he gets to the dummy external login page, at localhost:8080", () => {
    const url = monsBrowser.getUrl();
    const pathQueryHash = monsUrlBeforeLogin.replace(siteIdAddress.origin, '');
    assert.equal(url, ssoUrlVarsReplaced(pathQueryHash));
  });

  it("Mons logs in (noop)", () => {
  });

  let oneTimeLoginSecret: string;

  it("The remote server sends an API request to Talkyard, to synchronize Mons' account", () => {
    const externalMons = utils.makeExternalUserFor(mons, { ssoId: monsExternalId });
    console.log(`externalMons: ${ JSON.stringify(externalMons) }`);
    oneTimeLoginSecret = server.apiV0.upsertUserGetLoginSecret({ origin: siteIdAddress.origin,
        apiRequesterId: c.SysbotUserId, apiSecret, externalUser: externalMons });
  });

  it("... gets back a one time login secret", () => {
    console.log(`Got back login secret: ${ oneTimeLoginSecret }`);
    assert(oneTimeLoginSecret);
  });

  it("... redirects Monst to the Talkyard login-with-secret endpoint", () => {
    monsBrowser.rememberCurrentUrl();
    monsBrowser.apiV0.loginWithSecret({
        origin: siteIdAddress.origin,
        oneTimeSecret: oneTimeLoginSecret,
        thenGoTo: monsUrlBeforeLogin });
    monsBrowser.waitForNewUrl();
  });

  it("The Talkayrd server logs Mons in, and redirects him back to where she started", () => {
    const url = monsBrowser.getUrl();
    assert.equal(url, monsUrlBeforeLogin);
  });


  // ------ May see page, after SSO login

  it("Mons is logged in now, as Mons", () => {
    const username = monsBrowser.topbar.getMyUsername();
    assert.equal(username, mons.username);
  });

  it("He's on the access restricted staff only page", () => {
    monsBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, staffOnlyTopic.body);
  });

});

