/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


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



describe(`embcom.manual.2br.test.ts  TyTE2EEMBCOMMAN`, () => {

  it(`construct site`, () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Emb Comments Manual E2E Test",
      members: undefined,
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;

    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owen_brA = richBrowserA;
    maria = forum.members.maria;
    maria_brB = richBrowserB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, () => {
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


  it(`Owen logs in to admin area`, () => {
    owen_brA.adminArea.goToUsersEnabled(site.origin);
    owen_brA.loginDialog.loginWithPassword(owen);
  });


  it(`Owen creates embedding pages`, () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/page-a-slug.html`, makeHtml('aaa', '#500'));
    fs.writeFileSync(`${dir}/page-b-slug.html`, makeHtml('bbb', '#040'));
    function makeHtml(pageName: St, bgColor: St): St {
      return utils.makeEmbeddedCommentsHtml({
            pageName, discussionId: '', localHostname, bgColor});
    }
  });


  it("Maria opens embedding page aaa", () => {
    maria_brB.go2(embeddingOrigin + '/page-a-slug.html');
  });


  it("... logs in", () => {
    maria_brB.complex.loginIfNeededViaMetabar(maria);
  });

});

