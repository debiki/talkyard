/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import * as fs from 'fs';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import * as utils from '../utils/utils';
import settings from '../utils/settings';

let everyonesBrowsers: TyAllE2eTestBrowsers;
let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;

let site: IdAddress;

const localHostname = 'comments-for-e2e-test-embcomman-localhost-8080';
const embeddingOrigin = 'http://e2e-test-embcomman.localhost:8080';
let forum: TwoPagesTestForum;



describe(`embcom.manual.2br.e2e.ts  TyTE2EEMBCOMMAN`, () => {

  it(`construct site`, () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Emb Comments Manual E2E Test",
      members: undefined,
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;

    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = richBrowserA;
    maria = forum.members.maria;
    maria_brB = richBrowserB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, async () => {
    if (settings.reuseOldSite) {
      // Maybe query the server?
      site = {
        id: -1,
        pubId: '?',
        origin: settings.proto2Slash + localHostname + '.localhost',
        siteIdOrigin: '?',
        cdnOriginOrEmpty: '',
      };
    }
    else {
      site = server.importSiteData(forum.siteData);
      server.skipRateLimits(site.id);
    }
  });


  it(`Owen logs in to admin area`, async () => {
    await owen_brA.adminArea.goToUsersEnabled(site.origin);
    await owen_brA.loginDialog.loginWithPassword(owen);
  });


  it(`Owen creates embedding pages`, async () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/page-a-slug.html`, makeHtml('aaa', '#500'));
    fs.writeFileSync(`${dir}/page-b-slug.html`, makeHtml('bbb', '#040'));
    function makeHtml(pageName: St, bgColor: St): St {
      return utils.makeEmbeddedCommentsHtml({
            pageName, discussionId: '', localHostname, bgColor});
    }
  });


  it(`Maria opens embedding page aaa`, async () => {
    await maria_brB.go2(embeddingOrigin + '/page-a-slug.html');
  });


  it(`... logs in`, async () => {
    await maria_brB.complex.loginIfNeededViaMetabar(maria);
  });

});

