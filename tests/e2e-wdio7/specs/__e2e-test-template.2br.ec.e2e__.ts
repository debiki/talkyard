/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as nodeAssert from 'assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import * as make from '../utils/make';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { dieIf } from '../utils/log-and-die';
import c from '../test-constants';
import { IsWhere } from '../test-types';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;

const localHostname = 'comments-for-e2e-test-embdftpv';
const embeddingOrigin = 'http://e2e-test-embdftpv.localhost:8080';

let site: IdAddress;
let forum: TwoCatsTestForum;



describe(`some-e2e-test.2br  TyTE1234ABC`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some Emb Comments E2E Test",
      members: undefined, // default = everyone
        // ['mons', 'modya', 'regina', 'corax', 'memah', 'maria', 'michael', 'mallory']
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;
    memah = forum.members.memah;
    memah_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });


  it(`Create embedding pages`, () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/page-a-slug.html`, makeHtml('aaa', '#500'));
    fs.writeFileSync(`${dir}/page-b-slug.html`, makeHtml('bbb', '#040'));
    function makeHtml(pageName: St, bgColor: St): St {
      return utils.makeEmbeddedCommentsHtml({
              pageName, discussionId: '', localHostname, bgColor});
    }
  });


  it(`Owen goes to emb page a`, async () => {
    await owen_brA.go2(embeddingOrigin + '/page-a-slug.html');
  });
  it(`... logs in`, async () => {
    await owen_brA.complex.loginIfNeededViaMetabar(owen);
  });


  it(`Maria goes there too`, async () => {
    await maria_brB.go2(embeddingOrigin + '/page-a-slug.html');
  });

  it(`... logs in`, async () => {
    await maria_brB.complex.loginIfNeededViaMetabar(maria);
  });

});

