/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';

// Is a different domain than `localHostname`, otherwise cookies would work, which
// would be unrealistic.
const embeddingOrigin = 'http://e2e-test-www.localhost:8080';
const localHostname = 'e2e-test-emb-forum'; //  —>  http://e2e-test-emb-forum.localhost

const embForum = 'emb-forum.html';
const embCat = 'emb-cat-a.html';
const embPage = 'emb-page.html';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoPagesTestForum;
let discussionPageUrl: string;


describe(`embforum.b3c.login.2br.ef  TyTEF_BASIC`, () => {

  it("import a site", async () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Emb Forum Basic E2E",
      members: ['michael', 'maria', 'memah', 'modya']
    });
    assert.eq(builder.getSite(), forum.siteData);
    const siteData: SiteData2 = forum.siteData;
    siteData.meta.localHostname = localHostname;
    siteData.settings.allowEmbeddingFrom = embeddingOrigin;
    site = await server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
    discussionPageUrl = site.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;
  });

  it("create two embedding pages", async () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/${embForum}`, makeHtml('emb-forum', '#405', null));
    fs.writeFileSync(`${dir}/${embCat}`, makeHtml('emb-cat', '#045', '/top/category-a'));
    fs.writeFileSync(`${dir}/${embPage}`, makeHtml('emb-page', '#045', '/by-michael-category-a'));
  });


  function makeHtml(pageName: St, bgColor: St, talkyardPath: St | N): St {
    const pathLine = !talkyardPath ? '' : `talkyardPath = '${talkyardPath}';n`
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
<p>Embedded forum E2E test page ${pageName}. Ok to delete. [205KDGJURM1]</p>
<hr>

<script>
talkyardServerUrl='${settings.scheme}://${localHostname}.localhost';
${pathLine}
</script>

<script async defer src="${site.origin}/-/talkyard-forum.js"></script>

<div class="talkyard-forum"></div>

<hr>
<p>/End of page.</p>
</body>
</html>`;
  }

  it(`Maria opens a page that embeds Category A`, async () => {
    maria_brB.go2(embeddingOrigin + '/' + embCat);  // 0await
    maria_brB.disableRateLimits();  // 0await
  });

  it(`Owen goes to a page that embeds the forum (the all topics list)`, async () => {
    owen_brA.go2(embeddingOrigin + '/' + embForum);  // 0await
    owen_brA.disableRateLimits();  // 0await
  });


  it(`Maria sees Category A`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.forumTopicList.waitForCategoryName(forum.categories.catA.name);
  });
  it(`Owen instead sees All Cats`, async () => {
    await owen_brA.switchToEmbeddedCommentsIrame();
    await owen_brA.forumTopicList.waitForCategoryName(`All categories`);
  });


  it(`Maria logs in`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.complex.loginWithPasswordViaTopbar(maria, { inPopup: true });
  });
  it(`... sees her username in My Menu`, async () => {
    await maria_brB.switchToEmbeddedCommentsIrame();
    await maria_brB.topbar.assertMyUsernameMatches(maria.username);
  });


  it(`Owen logs in`, async () => {
    await owen_brA.switchToEmbeddedCommentsIrame();
    await owen_brA.complex.loginWithPasswordViaTopbar(owen, { inPopup: true });
  });
  it(`... sees his username`, async () => {
    await owen_brA.switchToEmbeddedCommentsIrame();
    await owen_brA.topbar.assertMyUsernameMatches(owen.username);
  });


  it("Owen goes to a page that embeds an embedded page", async () => {
    owen_brA.go2(embeddingOrigin + '/' + embPage);  // 0await
  });
  it("... the correct embedded page is shown", async () => {
    await owen_brA.switchToEmbeddedCommentsIrame();
    await owen_brA.assertPageTitleMatches("By Michael in CategoryA title");
  });
  it(`... he's automatically logged in — session remembered in localStorage`, async () => {
    await owen_brA.switchToEmbeddedCommentsIrame();
    await owen_brA.topbar.assertMyUsernameMatches(owen.username);
  });


  it(`Owen goes to the Admin Area`, async () => {
    owen_brA.adminArea.users.goHere(site.origin, { wait: false });  // 0await
  });
  // Cookies created in the loging popup will work, so Owen is already logged in.
  it(`... he's logged in — session cookies got set in the login popup`, async () => {
    await owen_brA.topbar.assertMyUsernameMatches(owen.username);
  });
  it(`Owen sees the users list`, async () => {
    await owen_brA.adminArea.users.switchToEnabled();
    await owen_brA.adminArea.users.assertUsenamesAreAndOrder([
            'michael', 'maria', 'memah', 'mod_modya', 'owen_owner']);
  });

});

