/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');





let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maja: Member;
let majasBrowser: TyE2eTestBrowser;
let mallory: Member;
let mallorysBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;

const apiSecretAnyUser: TestApiSecret = {
  nr: 1,
  userId: undefined, // can use as any user (except for System and guest users)
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSecret306XSEGR20AnyUser',
};

const apiSecretSysbotOnly: TestApiSecret = {
  ...apiSecretAnyUser,
  nr: 2,
  userId: c.SysbotUserId,
  secretKey: 'publicE2eTestSecret306XSEGR20SysbotOnly',
};

const ssoDummyLoginSlug = 'sso-dummy-login.html';
const ssoUrl =
    `http://localhost:8080/${ssoDummyLoginSlug}?returnPath=\${talkyardPathQueryEscHash}`;


const majasSsoId = 'majasSsoId';

let source: string;


describe("sso-one-time-key-errors   TyT5025BDUJQP4R", () => {

  if (settings.prod) {
    console.log("Skipping this spec — it uses the DebugTestController.");
    return;
  }

  // ----- Create site, with SSO enabled

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Ups Pages E2E Test",
      members: ['owen', 'maja', 'mallory', 'maria', 'michael'],
    });
    assert(builder.getSite() === forum.siteData);
    const site: SiteData2 = forum.siteData;
    site.settings.enableApi = true;
    site.apiSecrets = [apiSecretAnyUser, apiSecretSysbotOnly];

    site.settings.ssoUrl = ssoUrl;
    site.settings.enableSso = true;

    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
  });

  it("initialize people", () => {
    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    mallorysBrowser = richBrowserA;

    maja = forum.members.maja;
    majasBrowser = richBrowserB;
  });


  // ----- Try using a non-existing one-time key

  it("Maja tries to login using a non-existing one-time secret", () => {
    majasBrowser.apiV0.loginWithSecret({
      origin: siteIdAddress.origin,
      oneTimeSecret: 'non_existing_secret',
      thenGoTo: '/',
    });
  });

  it("... doesn't work, there's an error", () => {
    source = majasBrowser.getSource();
    assert(source.indexOf('TyELGISECR_') >= 0);
  });

  it("... that says there's no such secret", () => {
    assert(source.indexOf('EMANY_') === -1);
    assert(source.indexOf('EEXP_') === -1);
    assert(source.indexOf('ENONE_') >= 0);
  });



  // ----- Use the wrong API user id  TyT062SUNF3

  let responseErrorText;

  it("Try to upsert Maja, but as System, not Sysbot — that's the wrong user", () => {
    const externalMaja = utils.makeExternalUserFor(maja, { ssoId: majasSsoId });
    responseErrorText = server.apiV0.upsertUserGetLoginSecret({
        fail: true,
        origin: siteIdAddress.origin,
        apiRequesterId: c.SystemUserId,    // wrong, should be Sysbot
        apiSecret: apiSecretSysbotOnly.secretKey,
        externalUser: externalMaja });
  });

  it("... the server rejects the request", () => {
    lad.logServerResponse(responseErrorText);
    assert(responseErrorText.indexOf('TyEAPIWRNGUSR_') >= 0);
  });



  // ----- Use a disallowed user  TyT062SUNF3

  it("Try to upsert Maja, but as System, not Sysbot — not allowed", () => {
    const externalMaja = utils.makeExternalUserFor(maja, { ssoId: majasSsoId });
    responseErrorText = server.apiV0.upsertUserGetLoginSecret({
        fail: true,
        origin: siteIdAddress.origin,
        apiRequesterId: c.SystemUserId,    // System may not do API requests
        apiSecret: apiSecretAnyUser.secretKey,
        externalUser: externalMaja });
  });
  it("... the server rejects the request", () => {
    lad.logServerResponse(responseErrorText);
    assert(responseErrorText.indexOf('TyEAPISYSUSR_') >= 0);
  });


  it("Try to upsert Maja, but as a guest user — not allowed", () => {
    const externalMaja = utils.makeExternalUserFor(maja, { ssoId: majasSsoId });
    responseErrorText = server.apiV0.upsertUserGetLoginSecret({
        fail: true,
        origin: siteIdAddress.origin,
        apiRequesterId: c.UnknownUserId,    // guest users may not do api requests
        apiSecret: apiSecretAnyUser.secretKey,
        externalUser: externalMaja });
  });
  it("... the server rejects the request", () => {
    lad.logServerResponse(responseErrorText);
    assert(responseErrorText.indexOf('TyEAPIBADUSR_') >= 0);
  });


  it("Try to upsert Maja, but with a non-existing API requester id", () => {
    const externalMaja = utils.makeExternalUserFor(maja, { ssoId: majasSsoId });
    responseErrorText = server.apiV0.upsertUserGetLoginSecret({
        fail: true,
        origin: siteIdAddress.origin,
        apiRequesterId: 1234567,             // no such user
        apiSecret: apiSecretAnyUser.secretKey, // ok key
        externalUser: externalMaja });
  });
  it("... the server rejects the request", () => {
    lad.logServerResponse(responseErrorText);
    assert(responseErrorText.indexOf('TyAPI0USR_') >= 0);
  });



  // ----- Use an expired key

  let oneTimeLoginSecret;

  it("Upsert Maja, and get a one-time login secret", () => {
    const externalMaja = utils.makeExternalUserFor(maja, { ssoId: majasSsoId });
    oneTimeLoginSecret = server.apiV0.upsertUserGetLoginSecret({
        origin: siteIdAddress.origin,
        apiRequesterId: c.SysbotUserId,
        apiSecret: apiSecretAnyUser.secretKey,
        externalUser: externalMaja });
  });

  it("... gets back a one time login secret", () => {
    console.log(`Got back login secret: ${ oneTimeLoginSecret }`);
    assert(oneTimeLoginSecret);
  });

  it("... But she eats lunch; the key expires", () => {
    const key = `${siteId}-sso-${oneTimeLoginSecret}`;  // server side: [0639WKUJR45]
    server.deleteRedisKey(key);
  });

  it("Then she tries to login ...", () => {
    majasBrowser.rememberCurrentUrl();
    majasBrowser.apiV0.loginWithSecret({
      origin: siteIdAddress.origin,
      oneTimeSecret: oneTimeLoginSecret,
      thenGoTo: '/',
    });
    majasBrowser.waitForNewUrl();
  });

  it("... doesn't work", () => {
    source = majasBrowser.getSource();
    assert(source.indexOf('TyELGISECR_') >= 0);
  });

  it("... the message says the key has expired (we deleted it)", () => {
    assert(source.indexOf('EMANY_') === -1);
    assert(source.indexOf('EEXP_') >= 0);
    assert(source.indexOf('ENONE_') === -1);
  });


  // ----- Use a non-existing key again
  //
  // Now when there're keys in the database.

  it("Then, again, she tries to login using a random one-time secret", () => {
    majasBrowser.rememberCurrentUrl();
    majasBrowser.apiV0.loginWithSecret({
      origin: siteIdAddress.origin,
      oneTimeSecret: 'random_wrong_secret_again',
      thenGoTo: '/',
    });
    majasBrowser.waitForNewUrl();
  });

  it("... again doesn't work, there's an error, with the correct details text", () => {
    source = majasBrowser.getSource();
    assert(source.indexOf('TyELGISECR_') >= 0);
  });

  it("... with the correct details text", () => {
    assert(source.indexOf('EMANY_') === -1);
    assert(source.indexOf('EEXP_') === -1);
    assert(source.indexOf('ENONE_') >= 0);
  });


  // ----- Use a key many times

  it("Maja gets upserted again, gets a new one-time login secret", () => {
    const externalMaja = utils.makeExternalUserFor(maja, { ssoId: majasSsoId });
    oneTimeLoginSecret = server.apiV0.upsertUserGetLoginSecret({ origin: siteIdAddress.origin,
        apiRequesterId: c.SysbotUserId, apiSecret: apiSecretAnyUser.secretKey, externalUser: externalMaja });
  });

  it("... Maja uses the login secret", () => {
    majasBrowser.rememberCurrentUrl();
    majasBrowser.apiV0.loginWithSecret({
      origin: siteIdAddress.origin,
      oneTimeSecret: oneTimeLoginSecret,
      thenGoTo: '/' + forum.topics.byMichaelCategoryA.slug,
    });
    majasBrowser.waitForNewUrl();
  });

  it("The Talkayrd server logs Maja in, redirects her to /new", () => {
    assert.equal(majasBrowser.urlPath(), '/' + forum.topics.byMichaelCategoryA.slug);
    majasBrowser.topbar.assertMyUsernameMatches(maja.username, { wait: true });
  });

  it("Mallory steals the secret, attempts to reuse it", () => {
    mallorysBrowser.apiV0.loginWithSecret({
      origin: siteIdAddress.origin,
      oneTimeSecret: oneTimeLoginSecret,
      thenGoTo: '/',
    });
  });

  it("... doesn't work; there's an error", () => {
    source = mallorysBrowser.getSource();
    assert(source.indexOf('TyELGISECR_') >= 0);
  });

  it("... the error message says that the key has been used already", () => {
    assert(source.indexOf('EMANY_') >= 0);
    assert(source.indexOf('EEXP_') === -1);
    assert(source.indexOf('EBAD_') === -1);
  });

  it("But all is fine for Maja: she can post a reply", () => {
    const text = "Maja's reply";
    majasBrowser.complex.replyToOrigPost(text);
    majasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, text);
  });

  it("However if she also attempts to reuse the login secret, that won't work", () => {
    majasBrowser.apiV0.loginWithSecret({
      origin: siteIdAddress.origin,
      oneTimeSecret: oneTimeLoginSecret,
      thenGoTo: '/',
    });
    assert(source.indexOf('TyELGISECR_') >= 0);
    assert(source.indexOf('EMANY_') >= 0);
    assert(source.indexOf('EEXP_') === -1);
    assert(source.indexOf('ENONE_') === -1);
  });

  it("She can however go back and post a 2nd reply", () => {
    majasBrowser.back();
    majasBrowser.refresh();
    const text = "Maja's second reply";
    majasBrowser.complex.replyToOrigPost(text);
    majasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 1, text);
  });

});

