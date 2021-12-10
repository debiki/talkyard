/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';

let everyonesBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;
const localHostname = 'comments-for-e2e-test-manyifr-localhost-8080';
const embeddingOrigin = 'http://e2e-test-manyifr.localhost:8080';

const embPage404SlashSlug = '/many-embcom-iframes-404.html';
const embPage404FilePath = 'target' + embPage404SlashSlug;


describe(`embcom.many-comment-iframes-same-page.2br  TyTE2E50RMF24S`, () => {

  it(`construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Many Comment Iframes",
      members: undefined, // default = everyone
        // ['mons', 'modya', 'regina', 'corax', 'memah', 'maria', 'michael', 'mallory']
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;


    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;
    memah = forum.members.memah;
    memah_brB = brB;
    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });



  it(`Creates an embedding page`, async () => {
    const dir = 'target';
    fs.writeFileSync(embPage404FilePath, makeHtml('404', '#404'));
    //fs.writeFileSync(`${dir}/page-b-slug.html`, makeHtml('bbb', '#040'));

    function makeHtml(pageName: string, bgColor: string): string {
      return utils.makeManyEmbeddedCommentsHtml({
              pageName, discussionIds: ['111', '222'], localHostname, bgColor});
    }
  });

  it("Maria opens embedding page aaa", async () => {
    await maria_brB.go2(embeddingOrigin + embPage404SlashSlug);
  });

  it("... logs in", async () => {
    await maria_brB.useCommentsIframe({ discussionId: '222' });
    await maria_brB.complex.loginIfNeededViaMetabar(maria);
  });

});


// TESTS_MISSING


// uploadAnyFiles

// Replying to:
// In reply to:

// save draft in browser, frame 111, another in 222.
// delete draft,
// or post draft, in 111 — won't affect 222.


// forgetRemovedCommentIframes
// talkyardAddCommentsIframe(..)