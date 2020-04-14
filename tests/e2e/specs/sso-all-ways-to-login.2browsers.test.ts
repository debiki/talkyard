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
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: LargeTestForum;

let discussionPageUrl: string;

const michaelsLastPostNr = c.FirstReplyNr + 5;

const ssoUrl =
    'http://localhost:8080/sso-dummy-login.html?returnPath=${talkyardPathQueryEscHash}';

const ssoUrlVarsReplaced = (path: string): string =>
    `http://localhost:8080/sso-dummy-login.html?returnPath=${path}`;


const mariasSsoId = 'mariasSsoId';
let mariasExternalData;

let urlBeforeLogin: string;
let oneTimeLoginSecret: string;
let returnToPathQueryEscHash: string;


describe("sso-all-ways-to-login  TyT7FKRTTSR024", () => {

  it("import a site", () => {
    const builder = buildSite();
    const site = builder.getSite();
    site.settings.enableApi = true;
    site.settings.ssoUrl = ssoUrl;
    //site.settings.enableSso = true;   no API secret [5ABKR2038]
    forum = builder.addLargeForum({
      title: "SSO All Logins",
      members: undefined, // default = everyone
    });

    builder.addPost({
      page: forum.topics.byMichaelCategoryA,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.michael.id,
      approvedSource: "It's raining today",
    });
    builder.addPost({
      page: forum.topics.byMichaelCategoryA,
      nr: c.FirstReplyNr + 1,
      parentNr: c.FirstReplyNr,
      authorId: forum.members.michael.id,
      approvedSource: "No this is sunshine",
    });
    builder.addPost({
      page: forum.topics.byMichaelCategoryA,
      nr: c.FirstReplyNr + 2,
      parentNr: c.FirstReplyNr + 1,
      authorId: forum.members.michael.id,
      approvedSource: "Sunny clouds",
    });
    builder.addPost({
      page: forum.topics.byMichaelCategoryA,
      nr: c.FirstReplyNr + 3,
      parentNr: c.FirstReplyNr + 2,
      authorId: forum.members.michael.id,
      approvedSource: "Singing sounds of sunshine",
    });
    builder.addPost({
      page: forum.topics.byMichaelCategoryA,
      nr: c.FirstReplyNr + 4,
      parentNr: c.FirstReplyNr + 3,
      authorId: forum.members.michael.id,
      approvedSource: "Listen all night long",
    });
    builder.addPost({
      page: forum.topics.byMichaelCategoryA,
      nr: michaelsLastPostNr,
      parentNr: c.FirstReplyNr + 4,
      authorId: forum.members.michael.id,
      approvedSource: "Save sleep for rainy days",
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

    mariasExternalData = utils.makeExternalUserFor(maria, { ssoId: mariasSsoId });
    console.log(`mariasExternalData: ${ JSON.stringify(mariasExternalData) }`);
  });


  // ----- Generate API secret  LATER import instead, once supported  [5ABKR2038]

  it("Owen goes to the admin area, the API tab", () => {
    owensBrowser.adminArea.goToApi(siteIdAddress.origin, { loginAs: owen });
  });

  it("... generates an API secret", () => {
    owensBrowser.adminArea.apiTab.generateSecret();
  });

  let apiSecret: string;

  it("... copies the API secret", () => {
    apiSecret = owensBrowser.adminArea.apiTab.showAndCopyMostRecentSecret();
  });

  it("... goes to the login settings", () => {
    owensBrowser.adminArea.goToLoginSettings();
  });

  //it("... and types an SSO login URL", () => {   — already imported via site settings
  //  owensBrowser.adminArea.settings.login.typeSsoUrl(ssoUrl);
  //});

  it("... and enables SSO", () => {
    owensBrowser.adminArea.settings.login.setEnableSso(true);
  });

  it("... and saves the new settings", () => {
    owensBrowser.adminArea.settings.clickSaveAll();
  });


  // ------ Maria logs in via Log In button

  //
  // Already tested here:  [TyT2ABKR058TN2]
  //


  // ------ Maria logs in via Sign Up button

  it("Maria goes to the discussion page", () => {
    mariasBrowser.go(discussionPageUrl);
  });

  it("... clicks Sign Up, gets redirected to the SSO page", () => {
    urlBeforeLogin = mariasBrowser.getUrl();
    mariasBrowser.rememberCurrentUrl();
    mariasBrowser.topbar.clickSignUp();
    mariasBrowser.waitForNewUrl();
  });

  it("... and dummy-logs-in at the dummy external login page", () => {
    const urlNow = mariasBrowser.getUrl();
    const pathQueryHash = urlBeforeLogin.replace(siteIdAddress.origin, '');
    assert.equal(urlNow, ssoUrlVarsReplaced(pathQueryHash));
  });

  it("The remote server does an API request to Talkyard, to synchronize her account", () => {
    oneTimeLoginSecret = server.apiV0.upsertUserGetLoginSecret({ origin: siteIdAddress.origin,
        apiRequesterId: c.SysbotUserId, apiSecret, externalUser: mariasExternalData });
  });

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
    const url = mariasBrowser.getUrl();
    assert.equal(url, discussionPageUrl);
  });

  it("Maria is logged in now, as Maria", () => {
    const username = mariasBrowser.topbar.getMyUsername();
    assert.equal(username, 'maria');
  });


  // ------ Maria logs in via Reply button

  it("Maria logs out 2", () => {
    mariasBrowser.topbar.clickLogout();
  });

  it("Maria clicks reply ...", () => {
    urlBeforeLogin = mariasBrowser.getUrl();
    returnToPathQueryEscHash =
        mariasBrowser.urlPathQueryHash() + '__dwHash__post-' + michaelsLastPostNr;

    mariasBrowser.rememberCurrentUrl();
    mariasBrowser.topic.clickReplyToPostNr(michaelsLastPostNr);
  });

  it("... gets redirected to the SSO page", () => {
    mariasBrowser.waitForNewUrl();
  });

  it("... and gets to the dummy external login page, with  __dwHash__ in the return-to-url", () => {
    const urlNow = mariasBrowser.getUrl();
    console.log(`urlNow should incl __dwHash__: ${urlNow}`);
    assert.equal(urlNow, ssoUrlVarsReplaced(returnToPathQueryEscHash));
  });

  it("The remote server does an SSO API request to Talkyard, gets a one-time login secret", () => {
    oneTimeLoginSecret = server.apiV0.upsertUserGetLoginSecret({ origin: siteIdAddress.origin,
      apiRequesterId: c.SysbotUserId, apiSecret, externalUser: mariasExternalData });
    assert(oneTimeLoginSecret);
  });

  it("... redirects Maria to the Talkyard login-with-secret endpoint", () => {
    mariasBrowser.rememberCurrentUrl();
    mariasBrowser.apiV0.loginWithSecret({
      origin: siteIdAddress.origin, oneTimeSecret: oneTimeLoginSecret, thenGoTo: returnToPathQueryEscHash });
    mariasBrowser.waitForNewUrl();
  });

  it("The Talkayrd server logs her in, and redirects her to the #post-nr she wanted to reply to", () => {
    const urlNow = mariasBrowser.getUrl();
    const urlBeforePlusHashPostNr = urlBeforeLogin + '#post-' + michaelsLastPostNr;
    console.log(`urlNow: ${urlNow}`);
    assert.equal(urlNow, urlBeforePlusHashPostNr);
  });

  it("Maria is logged in now, as Maria", () => {
    const username = mariasBrowser.topbar.getMyUsername();
    assert.equal(username, 'maria');
  });

  it("... clicks reply again, replies to Michael — without getting redirected to the SSO page", () => {
    urlBeforeLogin = mariasBrowser.getUrl();
    mariasBrowser.complex.replyToPostNr(michaelsLastPostNr, "Fly and sing with the ducks");
  });


  // ------ Maria logs in via Like vote

  it("Maria logs out 3", () => {
    mariasBrowser.topbar.clickLogout();
  });

  it("Maria Like-votes Michael's poetic post", () => {
    mariasBrowser.go(discussionPageUrl);
    returnToPathQueryEscHash =
        mariasBrowser.urlPathQueryHash() + '__dwHash__post-' + (michaelsLastPostNr - 1);
    mariasBrowser.rememberCurrentUrl();
    mariasBrowser.topic.clickLikeVote(michaelsLastPostNr - 1);
    mariasBrowser.waitForNewUrl();
  });

  it("... gets to the dummy login page, with  __dwHash__", () => {
    const urlNow = mariasBrowser.getUrl();
    console.log(`urlNow should incl __dwHash__: ${urlNow}`);
    assert.equal(urlNow, ssoUrlVarsReplaced(returnToPathQueryEscHash));

    // This is enough; need not test the API requests again here too.
  });


  // ------ Maria logs in via disagree button   TEST_MISSING  not important, Like vote already tested

  // ------ Maria logs in via create-chat button   TEST_MISSING  not important, maybe even hide if
                                                                              // not logged in?

});

