/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');

const mariasCommentOne = 'mariasCommentOne';
const mariasCommentTwo = 'mariasCommentTwo';

const embeddingOrigin = 'http://e2e-test-emb-forum.localhost:8080';
const embPageOneSlug = 'emb-page-one.html';
const embPageTwoSlug = 'emb-page-two.html';
const ssoDummyLoginSlug = 'sso-dummy-login.html';

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

const localHostname = 'e2e-test-emb-forum-localhost-8080';

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;

let discussionPageUrl: string;

const apiSecret: TestApiSecret = {
  nr: 1,
  userId: c.SysbotUserId,
  createdAt: c.MinUnixMillis,
  deletedAt: undefined,
  isDeleted: false,
  secretKey: 'publicE2eTestSecretKeyAbc123',
};

const ssoUrl =
    `http://localhost:8080/${ssoDummyLoginSlug}?returnPath=\${talkyardPathQueryEscHash}`;

const mariasExternalId = 'mariasExternalId';


describe("embedded-forum-no-cookies-login  TyT5029FKRDE", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({  // or: builder.addLargeForum
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });
    assert(builder.getSite() === forum.siteData);
    const site: SiteData2 = forum.siteData;
    site.meta.localHostname = localHostname;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
    site.settings.enableSso = true;
    site.settings.ssoUrl = ssoUrl;
    site.settings.enableApi = true;
    site.apiSecrets = [apiSecret];
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

    // http://e2e-test-emb-forum.localhost:8080/
  });

  it("create two embedding pages", () => {
    const dir = 'target';

    fs.writeFileSync(`${dir}/${ssoDummyLoginSlug}`,
      "<html><body style='background: #eee'><p>Dummy SSO login page [602KFSHNZP46]");
    //fs.writeFileSync(`${dir}/${pageShortSlug}`, makeHtml('short', 0, '#005'));
    fs.writeFileSync(`${dir}/${embPageOneSlug}`, makeHtml('one', 2000, '#405'));
    fs.writeFileSync(`${dir}/${embPageTwoSlug}`, makeHtml('two', 2000, '#045'));
    //fs.writeFileSync(`${dir}/${pageTallerSlug}`, makeHtml('taller', 5000, '#040'));
  });


  function makeHtml(pageName: string, extraHeight: number, bgColor: string): string {
    return `
<html>
<head>
<title>Embedded forum E2E test</title>
<style>
iframe {
  width: calc(100% - 40px);
  margin-left: 10px;
  height: 300px;
}
</style>
</head>
<body style="background: ${bgColor}; color: #ccc; font-family: monospace">
<p>Embedded forum E2E test page ${pageName}. Ok to delete. [205KDGJURM2]
<hr>

<!--
<script>talkyardServerUrl='http://${localHostname}.localhost';</script>
-->
<script async defer src="${siteIdAddress.origin}/-/talkyard-embedded-forum.js"></script>
<div class="talkyard-forum" style="margin-top: 45px;">
<iframe src="http://${localHostname}.localhost">Oops iframe didn't want to load</iframe>

<hr>
<p>/End of page.</p>
</body>
</html>`;
  }


  // ----- Owen enables SSO

  // Dupl code [40954RKSTDG2]

  // Can auto ins API secret elsewhere too, [5ABKR2038]
  /*

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
  }); */


  // ----- Upsert user: Maria, and generate SSO login secret

  let oneTimeLoginSecret;

  it("The remote server does an API request to Talkyard, to synchronize her account", () => {
mariasBrowser.debug();
    const externalMaria = utils.makeExternalUserFor(maria, { externalId: mariasExternalId });
    oneTimeLoginSecret = server.apiV0.upsertUserGetLoginSecret({ origin: siteIdAddress.origin,
        requesterId: c.SysbotUserId, apiSecret: apiSecret.secretKey, externalUser: externalMaria });
  });

  it("... gets back a one time login secret", () => {
    console.log(`Got back login secret: ${ oneTimeLoginSecret }`);
    assert(oneTimeLoginSecret);
settings.debugEachStep=true;
  });

  it("... redirects Maria to the Talkyard login-with-secret endpoint", () => {
    mariasBrowser.rememberCurrentUrl();
    mariasBrowser.apiV0.loginWithSecret({
      origin: siteIdAddress.origin,
      oneTimeSecret: oneTimeLoginSecret,
      thenGoTo: embeddingOrigin + '/' + embPageOneSlug,
    });
    mariasBrowser.waitForNewUrl();
  });

  it("The Talkayrd server logs her in, and redirects her back to where she started", () => {
    const url = mariasBrowser.url().value;
    //assert.equal(url, discussionPageUrl);
  });

  it("Maria opens a tall embedding page, does *not* scroll to comment-1", () => {
    //mariasBrowser.go(embeddingOrigin + '/' + embPageOneSlug);
  });

});

