/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
// import fs = require('fs');  EMBCMTS
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
let owensBrowser: TyE2eTestBrowser;
let memah: Member;
let memahsBrowser: TyE2eTestBrowser;

let site: IdAddress;

let forum: TwoPagesTestForum;



describe("some-e2e-test  TyT1234ABC", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({  // or: builder.addLargeForum
      title: "Some E2E Test",
      members: ['maria', 'memah', 'michael'],
    });
    assert.refEq(builder.getSite(), forum.siteData);

    if (settings.reuseOldSite) {
      lad.dieIf(!settings.localHostname,
              `Don't know which site to reuse, when --localHostname
              not specified [TyE9395RKST4]`);
      // Maybe query the server?
      site = {
        id: -1,
        pubId: '?',
        origin: settings.proto2Slash + settings.localHostname + '.localhost',
        siteIdOrigin: '?',
      };
    }
    else {
      site = server.importSiteData(forum.siteData);
      server.skipRateLimits(site.id);
    }
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    memah = forum.members.memah;
    memahsBrowser = richBrowserB;
  });

  it("Owen logs in to admin area, ... ", () => {
    owensBrowser.adminArea.goToUsersEnabled(site.origin);
    owensBrowser.loginDialog.loginWithPassword(owen);
  });

  it("Memah logs in", () => {
    memahsBrowser.go2(site.origin + '/' + forum.topics.byMichaelCategoryA.slug);
    memahsBrowser.complex.loginWithPasswordViaTopbar(memah);
  });

  it("Done", () => {
    console.log("\n" +
          "\n" +
          "Now you can test manually: " +
            "Pass  --da  or  --debugAfter  to wdio, to pause here.\n");
  });

});

