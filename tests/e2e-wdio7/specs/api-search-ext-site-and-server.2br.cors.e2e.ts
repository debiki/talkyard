/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { logMessage } from '../utils/log-and-die';
import c from '../test-constants';


let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;

let forum: TwoCatsTestForum;

let publicPageUrl: St;
let staffPageUrl: St;


const sharedTitle = 'CORS_test_title';
const sharedBody = 'CORS_test_body';
const publicPageId = 'publicPageId';
const publicPageTitle = sharedTitle + ' publicly_visible';
const publicPageText = sharedBody + ' publicly_visible';
const staffPageId = 'staffPageId';
const staffPageTitle = sharedTitle + ' staff_only';
const staffPageBody = sharedBody + ' staff_only';

const extSiteOrigin = 'http://allowed-cors-origin.localhost:8080';
const extSitePageSlug = 'ext-cors-site.html';
const extSitePageUrl = extSiteOrigin + '/' + extSitePageSlug;


interface SearchParams {
  logMessage: St;
  searchFor: St;
  shouldFail?: true;
  pageIdsToFind?: PageId[];
}


describe(`api-search-ext-site-and-server.2br.cors  TyTEAPIEXTSRV`, () => {

  it("Construct site", async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "E2E Test API Ext Srv & Cors Site",
      members: ['owen', 'memah', 'maria'],
    });

    builder.addPage({
      id: publicPageId,
      folder: '/',
      showId: false,
      slug: 'public-page',
      role: c.TestPageRole.Discussion,
      title: publicPageTitle,
      body: publicPageText,
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.memah.id,
    });

    builder.addPage({
      id: staffPageId,
      folder: '/',
      showId: false,
      slug: 'staff-page',
      role: c.TestPageRole.Discussion,
      title: staffPageTitle,
      body: staffPageBody,
      categoryId: forum.categories.staffOnlyCategory.id,
      authorId: forum.members.owen.id,
    });

    builder.getSite().isTestSiteIndexAnyway = true;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
    publicPageUrl = site.origin + '/public-page';
    staffPageUrl = site.origin + '/staff-page';
  });

  it(`Create external CORS request page`, async () => {
    fs.copyFileSync(__dirname + '/../utils/ext-cors-site.html',
          './target/' + extSitePageSlug);
  });

  it(`Initialize people`, async () => {
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = richBrowserA;

    maria = forum.members.maria;
    maria_brB = richBrowserB;

    stranger_brB = richBrowserB;
  });


  it(`Owen arrives, logs in`, async () => {
    await owen_brA.go2(site.origin);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });
  it(`... searches for the shared title: "${sharedTitle}"`, async () => {
    await owen_brA.topbar.searchFor(sharedTitle);
  });
  it(`... finds both the public and the private topics (he's admin)`, async () => {
    await owen_brA.searchResultsPage.searchForUntilNumPagesFound(sharedTitle, 2);
    await owen_brA.searchResultsPage.assertResultPageTitlePresent(publicPageTitle);
    await owen_brA.searchResultsPage.assertResultPageTitlePresent(staffPageTitle);
  });


  it(`Owen goes to the Admin Area, Settings | Features`, async () => {
    await owen_brA.adminArea.settings.features.goHere(site.origin);
  });

  it(`Maria goes to the external website`, async () => {
    await maria_brB.go2(extSitePageUrl, { isExternalPage: true });
  });


  addExtBrowserCorsTets('br_cors_1: ', {
        logMessage: `This should fail — CORS not configured, not allowed`,
        searchFor: sharedTitle, shouldFail: true });

  addExtServerTests('ext_srv_1: ', {
        logMessage: `This should work — is a server-server req for publ data`,
        searchFor: sharedTitle, pageIdsToFind: [publicPageId] });


  it(`Owen enables CORS`, async () => {
    await owen_brA.adminArea.settings.features.setEnableApi(true);
    await owen_brA.adminArea.settings.features.setEnableCors(true);
    await owen_brA.adminArea.settings.features.setCorsOrigins(extSiteOrigin);
  });
  it(`... saves`, async () => {
    await owen_brA.adminArea.settings.clickSaveAll();
  });


  addExtBrowserCorsTets('br_cors_2: ', {
        logMessage: `This should work — CORS now configured`,
        searchFor: sharedTitle, pageIdsToFind: [publicPageId] });

  addExtServerTests('ext_srv_2: ', {
        logMessage: `This should work, doesn't matter that CORS now configured`,
        searchFor: sharedTitle, pageIdsToFind: [publicPageId] });


  it(`Owen changes the CORS origin to the wrong site`, async () => {
    await owen_brA.adminArea.settings.features.setCorsOrigins("https://wrong.ex.co");
  });
  it(`... saves`, async () => {
    await owen_brA.adminArea.settings.clickSaveAll();
  });


  addExtBrowserCorsTets('br_cors_3: ', {
        logMessage: `This should fail — CORS incorrectly configured`,
        searchFor: sharedTitle, shouldFail: true });

  addExtServerTests('ext_srv_3: ', {
        logMessage: `Thist should still work`,
        searchFor: sharedTitle, pageIdsToFind: [publicPageId] });


  // -- The end. --


  function addExtBrowserCorsTets(id: St, ps: SearchParams) {
    let okResp: SearchQueryResults<PageFound> | U;
    let errResp;

    it(`${id} Maria attempts to load data via a CORS API search request`, async () => {
      logMessage(ps.logMessage);

      const response = await maria_brB.executeAsync(
              function(talkyardSiteOrigin: St, sharedTitle: St, done): Ay {
        // We're now in ext-cors-site.html, which has a fn corsFetch() in a <script>.
        window['corsFetch']({
            url: talkyardSiteOrigin + '/-/v0/search',
            POST: { searchQuery: { freetext: sharedTitle }},
            onError: function(statusCode, statusText, ex) {
              if (done) done({ errResp: { statusCode, statusText, ex } });
            },
            onDone: function(okResp) {
              window['logToPageAndConsole'](okResp);
              if (done) done({ okResp });
            }});
      }, site.origin, ps.searchFor);

      console.log(`response: ${JSON.stringify(response)}`);
      okResp = response.okResp;
      errResp = response.errResp;
    });

    if (ps.shouldFail) {
      it(`${id} ... doesn't work`, async () => {
        assert.not(okResp);
        assert.ok(errResp);
      });
      it(`${id} ... status code 0: the request didn't happen at all`, async () => {
        // When the request won't happen at all, because of CORS rules, the
        // browser sets the status code to 0.
        assert.eq(errResp.statusCode, 0);
      });
    }
    else {
      it(`${id} ... works`, async () => {
        assert.not(errResp);
        assert.ok(okResp);
      });
      // Dupl tests [.dupl_ok_tests]
      it(`${id} finds ${ps.pageIdsToFind.length} pages`, async () => {
        assert.eq(okResp.thingsFound.length, ps.pageIdsToFind.length);
      });
      it(`${id} ... with ids: ${JSON.stringify(ps.pageIdsToFind)}`, async () => {
        for (id of ps.pageIdsToFind) {
          const page = _.find(okResp.thingsFound, p => p.pageId === id)
          assert.ok(page, `Page missing in CORS search resutls, id: ${id}`);
        }
      });
    }
  }


  function addExtServerTests(id: St, ps: SearchParams) {
    let okRes: SearchQueryResults<PageFound> | U;

    it(`${id} An external server calls /-/v0/search`, async () => {
      logMessage(ps.logMessage);
      okRes = await server.apiV0.fullTextSearch({
            origin: site.origin, queryText: ps.searchFor,
            opts: { cookie: null, xsrfTokenHeader: null }}
            ) as SearchQueryResults<PageFound>;
    });
    // Dupl tests [.dupl_ok_tests]
    it(`${id} ... finds ${ps.pageIdsToFind.length} pages`, async () => {
      assert.eq(okRes.thingsFound.length, ps.pageIdsToFind.length);
    });
    it(`${id} ... with ids: ${JSON.stringify(ps.pageIdsToFind)}`, async () => {
      for (id of ps.pageIdsToFind) {
        const page = _.find(okRes.thingsFound, p => p.pageId === id)
        assert.ok(page, `Page missing in server-server search resutls, id: ${id}`);
      }
    });

    let errRes;

    it(`${id} But the external server includes a cookie header ...`, async () => {
      errRes = await server.apiV0.fullTextSearch({
            origin: site.origin, queryText: ps.searchFor,
            opts: { cookie: 'theCookie=theValue', xsrfTokenHeader: null, fail: true }});
    });
    it(`${id} ... now the request gets rejected — requests with credentials (cookies)
                  need an xsrf token`, async () => {
      assert.eq(typeof errRes, 'string');
      assert.includes(errRes, 'TyE0XSRFTKN_');
    });

    it(`${id} The external server includes a Talkyard SID header`, async () => {
      errRes = await server.apiV0.fullTextSearch({
            origin: site.origin, queryText: ps.searchFor,
            opts: { cookie: null, xsrfTokenHeader: null,
                    sidHeader: 'whatever', fail: true }});
    });
    it(`${id} ... this request gets rejected, too: credentials (the SID header)
                  but no xsrf token`, async () => {
      assert.eq(typeof errRes, 'string');
      assert.includes(errRes, 'TyE0XSRFTKN_');
    });
  }


});

