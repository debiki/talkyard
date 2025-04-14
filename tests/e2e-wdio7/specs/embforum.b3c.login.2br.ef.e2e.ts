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


describe("embedded-forum-no-cookies-login  TyT5029FKRDE", () => {

  it("import a site", async () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({  // or: builder.addLargeForum
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });
    assert.eq(builder.getSite(), forum.siteData);
    const site: SiteData2 = forum.siteData;
    site.meta.localHostname = localHostname;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
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
  height: 1200px;
}
</style>
</head>
<body style="background: ${bgColor}; color: #ccc; font-family: monospace">
<p>Embedded forum E2E test page ${pageName}. Ok to delete. [205KDGJURM2]
<hr>

<!--
<script>talkyardServerUrl='${settings.scheme}://${localHostname}.localhost';</script>
<script async defer src="${siteIdAddress.origin}/-/talkyard-embedded-forum.js"></script>
-->
<div class="talkyard-forum" style="margin-top: 45px;">
<iframe src="${settings.scheme}://${localHostname}.localhost?embHow=Forum">
  Oops iframe didn't want to load
</iframe>

<hr>
<p>/End of page.</p>
</body>
</html>`;
  }

  it("Maria opens a tall embedding page, does *not* scroll to comment-1", async () => {
    await maria_brB.go2(embeddingOrigin + '/' + embPageOneSlug);
  });

});

