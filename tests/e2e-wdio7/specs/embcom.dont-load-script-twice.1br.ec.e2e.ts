/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import { logUnusual, j2s } from '../utils/log-and-die';
import c from '../test-constants';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;

const localHostname = 'comments-for-e2e-test-loadtwice';
const embeddingOrigin = 'http://e2e-test-loadtwice.localhost:8080';

let site: IdAddress;
let forum: TwoCatsTestForum;



describe(`embcom.dont-load-script-twice.1br.ec  TyTECLOADTWICE`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some Emb Comments E2E Test",
      members: [],
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');

    owen = forum.members.owen;
    owen_brA = brA;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });


  it(`Create embedding pages`, () => {
    const dir = 'target';
    const extraScript =
            `<script async defer src="${site.origin}/-/talkyard-comments.js"></script>`;
    fs.writeFileSync(`${dir}/page-a.html`, makeHtml('aaa', '#500'));
    function makeHtml(pageName: St, bgColor: St): St {
      return utils.makeEmbeddedCommentsHtml({
              pageName, discussionId: '', localHostname, bgColor,
              appendExtraHtml: extraScript });
    }
  });


  it(`Owen goes to emb page a`, async () => {
    await owen_brA.go2(embeddingOrigin + '/page-a.html');
  });

  it(`There's a warning about the Talkyard script getting loaded twice`, async () => {
    const msgs = await owen_brA.getLogs_worksInChrome('browser');
    for (let m of msgs) {
      if (m.message.indexOf('Talkyard comments script loaded twice') >= 0
          && m.message.indexOf('TyEEMBJSLD2') >= 0)
        return;
    }
    logUnusual(`Browser log messages: ` + msgs.map(m => j2s(m)));
    assert.fail(`No comments-loaded-twice browser error log message?  (Or? See above)`)
  });

  it(`Otherwise the blog comments work: Owen can log in`, async () => {
    await owen_brA.complex.loginIfNeededViaMetabar(owen);
  });
  it(`... and post a comment`, async () => {
    await owen_brA.complex.replyToEmbeddingBlogPost(`Zero. One. Tw ... Too_many`);
    await owen_brA.topic.postNrContainsVisible(c.FirstReplyNr, 'Too_many');
  });

});

