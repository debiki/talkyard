/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { die } from '../utils/log-and-die';
import c from '../test-constants';
import { IsWhere } from '../test-types';

const mariasCommentOne = 'mariasCommentOne';
const mariasCommentTwo = 'mariasCommentTwo';

const embeddingOrigin = 'http://e2e-test-emb-forum.localhost:8080';
const embPageOneSlug = 'emb-page-one.html';
const embPageTwoSlug = 'emb-page-two.html';
const ssoDummyLoginSlug = 'sso-dummy-login.html';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let michael: Member;
let michael_brB: TyE2eTestBrowser;

const localHostname = 'e2e-test-emb-forum';

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

const mariasSsoId = 'mariasSsoId';


describe("embedded-forum-no-cookies-login  TyT5029FKRDE", () => {

  it("import a site", async () => {
    die('Unimpl [8608RKTHS]');

    const builder = buildSite();
    forum = builder.addTwoPagesForum({  // or: builder.addLargeForum
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });
    assert.eq(builder.getSite(), forum.siteData);
    const site: SiteData2 = forum.siteData;
    site.meta.localHostname = localHostname;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
    site.settings.enableSso = true;
    site.settings.ssoUrl = ssoUrl;
    site.settings.enableApi = true;
    site.apiSecrets = [apiSecret];
    siteIdAddress = await server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
    discussionPageUrl = siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;
    michael = forum.members.michael;
    michael_brB = brB;

    // http://e2e-test-emb-forum.localhost:8080/
  });

  it("create two embedding pages", async () => {
    const dir = 'target';

    fs.writeFileSync(`${dir}/${ssoDummyLoginSlug}`,
      "<html><body style='background: #eee'><p>Dummy SSO login page [602KFSHNZP46]");
    //fs.writeFileSync(`${dir}/${pageShortSlug}`, makeHtml('short', 0, '#005'));
    fs.writeFileSync(`${dir}/${embPageOneSlug}`, makeHtml('one', 2000, '#405'));
    fs.writeFileSync(`${dir}/${embPageTwoSlug}`, makeHtml('two', 2000, '#045'));
    //fs.writeFileSync(`${dir}/${pageTallerSlug}`, makeHtml('taller', 5000, '#040'));
  });


  function makeHtml(pageName: string, bgColor: string): string {
    return `
<html>
<head>
<title>Embedded forum SSO E2E test</title>
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

<script>
talkyardServerUrl='${settings.scheme}://${localHostname}.localhost';
</script>

<script async defer src="${siteIdAddress.origin}/-/talkyard-forum.js"></script>

<div class="talkyard-forum" style="margin-top: 45px;">

<hr>
<p>/End of page.</p>
</body>
</html>`;
  }


  // ----- Owen enables SSO

  // Dupl code [40954RKSTDG2]

  // Can auto ins API secret elsewhere too, [5ABKR2038]
  /*

  it("Owen goes to the admin area, the API tab", async () => {
    await owensBrowser.adminArea.goToApi(siteIdAddress.origin, { loginAs: owen });
  });

  it("... generates an API secret, copies it", async () => {
    await owensBrowser.adminArea.apiTab.generateSecret();
  });

  let apiSecret: string;

  it("... copies the secret key", async () => {
    apiSecret = await owensBrowser.adminArea.apiTab.showAndCopyMostRecentSecret();
  });

  it("... goes to the login settings", async () => {
    await owensBrowser.adminArea.goToLoginSettings();
  });

  it("... and types an SSO login URL", async () => {
    await owensBrowser.scrollToBottom(); // just speeds the test up slightly
    await owensBrowser.adminArea.settings.login.typeSsoUrl(ssoUrl);
  });

  it("... and enables SSO", async () => {
    await owensBrowser.scrollToBottom(); // just speeds the test up slightly
    await owensBrowser.adminArea.settings.login.setEnableSso(true);
  });

  it("... and saves the new settings", async () => {
    await owensBrowser.adminArea.settings.clickSaveAll();
  }); */


  // ----- Upsert user: Maria, and generate SSO login secret

  let oneTimeLoginSecret;

  it("The remote server does an API request to Talkyard, to synchronize her account", async () => {
await maria_brB.debug();
    const externalMaria = utils.makeExternalUserFor(maria, { ssoId: mariasSsoId });
    oneTimeLoginSecret = await server.apiV0.upsertUserGetLoginSecret({ origin: siteIdAddress.origin,
        apiRequesterId: c.SysbotUserId, apiSecret: apiSecret.secretKey, externalUser: externalMaria });
  });

  it("... gets back a one time login secret", async () => {
    console.log(`Got back login secret: ${ oneTimeLoginSecret }`);
    assert.ok(oneTimeLoginSecret);
settings.debugEachStep=true;
  });

  it("... redirects Maria to the Talkyard login-with-secret endpoint", async () => {
    await maria_brB.rememberCurrentUrl();
    await maria_brB.apiV0.loginWithSecret({
      origin: siteIdAddress.origin,
      oneTimeSecret: oneTimeLoginSecret,
      thenGoTo: embeddingOrigin + '/' + embPageOneSlug,
    });
    await maria_brB.waitForNewUrl();
  });

  it("The Talkayrd server logs her in, and redirects her back to where she started", async () => {
    const url = await maria_brB.getUrl();
    //assert.eq(url, discussionPageUrl);
  });

  it("Maria opens a tall embedding page, does *not* scroll to comment-1", async () => {
    //await mariasBrowser.go2(embeddingOrigin + '/' + embPageOneSlug);
  });

});

