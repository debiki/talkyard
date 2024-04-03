/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');

const mariasCommentOne = 'mariasCommentOne';
const mariasCommentTwo = 'mariasCommentTwo';

const embeddingOrigin = 'http://e2e-test-emb-forum.localhost:8080';
const embPageOneSlug = 'emb-page-one.html';
const embPageTwoSlug = 'emb-page-two.html';





let everyonesBrowsers;
let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;

const localHostname = 'e2e-test-emb-forum';

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;

let discussionPageUrl: string;


describe("embedded-forum-no-cookies-login  TyT5029FKRDE", () => {

  it("import a site", () => {
    lad.die('Unimpl [395023PFS]');

    const builder = buildSite();
    forum = builder.addTwoPagesForum({  // or: builder.addLargeForum
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });
    assert(builder.getSite() === forum.siteData);
    const site: SiteData2 = forum.siteData;
    site.meta.localHostname = localHostname;
    site.settings.allowEmbeddingFrom = embeddingOrigin;
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
    server.skipRateLimits(siteId);
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

    // http://e2e-test-emb-forum.localhost:8080/
  });

  it("create two embedding pages", () => {
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
  height: 300px;
}
</style>
</head>
<body style="background: ${bgColor}; color: #ccc; font-family: monospace">
<p>Embedded forum E2E test page ${pageName}. Ok to delete. [205KDGJURM2]
<hr>

<!--
<script>talkyardServerUrl='${settings.scheme}://${localHostname}.localhost';</script>
-->
<script async defer src="${siteIdAddress.origin}/-/talkyard-embedded-forum.js"></script>
<div class="talkyard-forum" style="margin-top: 45px;">
<iframe src="${settings.scheme}://${localHostname}.localhost">Oops iframe didn't want to load</iframe>

<hr>
<p>/End of page.</p>
</body>
</html>`;
  }

  it("Maria opens a tall embedding page, does *not* scroll to comment-1", () => {
    mariasBrowser.go(embeddingOrigin + '/' + embPageOneSlug);
  });

});

