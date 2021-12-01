/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import { dieIf } from '../utils/log-and-die';


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
      dieIf(!settings.localHostname,
              `Don't know which site to reuse, when --localHostname
              not specified [TyE9395RKST4]`);
      // Maybe query the server?
      site = {
        id: -1,
        pubId: '?',
        origin: settings.proto2Slash + settings.localHostname + '.localhost',
        siteIdOrigin: '?',
        cdnOriginOrEmpty: '',
      };
    }
    else {
      site = server.importSiteData(forum.siteData);
      server.skipRateLimits(site.id);
    }
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    memah = forum.members.memah;
    memahsBrowser = richBrowserB;
  });

  it(`Owen goes to the admin area, ... `, async () => {
    await owensBrowser.adminArea.goToUsersEnabled(site.origin);
  });

  it(`... logs in`, async () => {
    await owensBrowser.loginDialog.loginWithPassword(owen);
  });

  it("Memah logs in", async () => {
    await memahsBrowser.go2(site.origin + '/' + forum.topics.byMichaelCategoryA.slug);
    await memahsBrowser.complex.loginWithPasswordViaTopbar(memah);
  });

  it("Done", () => {
    console.log("\n" +
          "\n" +
          "Now you can test manually: " +
            "Pass  --da  or  --debugAfter  to wdio, to pause here.\n");
  });

});

