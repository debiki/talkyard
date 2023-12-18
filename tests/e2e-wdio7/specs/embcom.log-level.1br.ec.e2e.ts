/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';
import { dieIf, j2s, logMessage } from '../utils/log-and-die';


let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;

const localHostname = 'comments-for-e2e-test-loadtwice.localhost-8080';
const embeddingOrigin = 'http://e2e-test-loadtwice.localhost:8080';

let site: IdAddress;
let forum: TwoCatsTestForum;

const startupDebugMsgs = [
          "Talkyard comments: Starting",
          "Talkyard comments: createSessionFrame",
          "Talkyard comments: inserted editorIframe"];



describe(`embcom.dont-load-script-twice.2br.ec  TyTECLOADTWICE`, () => {

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
    fs.writeFileSync(`${dir}/log-level-undef.html`, makeHtml('aaa', '#500'));
    fs.writeFileSync(`${dir}/log-level-99.html`, makeHtml('aaa', '#500', 99));
    fs.writeFileSync(`${dir}/log-level-debug.html`, makeHtml('aaa', '#500', "'debug'"));
    fs.writeFileSync(`${dir}/log-level-warn.html`, makeHtml('aaa', '#500', '"warn"'));
    /* Could test as well, later — but right now, it's either 'warn' or 'debug':
    fs.writeFileSync(`${dir}/log-level-trace.html`, makeHtml('aaa', '#500', 'trace'));
    fs.writeFileSync(`${dir}/log-level-trace.html`, makeHtml('aaa', '#500', 0 ));
    fs.writeFileSync(`${dir}/log-level-trace.html`, makeHtml('aaa', '#500', 'off' ));
    */
    function makeHtml(pageName: St, bgColor: St, talkyardLogLevel?: St | Nr): St {
      return utils.makeEmbeddedCommentsHtml({
              pageName, discussionId: '', localHostname, bgColor, talkyardLogLevel });
    }
  });


  it(`Owen goes to log-level-99.html`, async () => {
    await owen_brA.go2(embeddingOrigin + '/log-level-99.html');
  });
  it(`There's lots of log messages`, async () => {
    await waitForLogMessages(owen_brA, startupDebugMsgs);
  });


  it(`Owen goes to log-level-debug.html`, async () => {
    await owen_brA.go2('/log-level-debug.html');
  });
  it(`There's lots of log messages here too`, async () => {
    await waitForLogMessages(owen_brA, startupDebugMsgs);
  });


  it(`Owen goes to log-level-undef.html`, async () => {
    await owen_brA.go2('/log-level-undef.html');
  });
  it(`Lots of messages — log level is 'trace', by default`, async () => {
    await waitForLogMessages(owen_brA, startupDebugMsgs);
  });


  it(`Owen goes to log-level-warn.html`, async () => {
await owen_brA.d();
    await owen_brA.go2('/log-level-warn.html');
  });
  it(`There are no "Talkyard comments: ..." messages  (no warnings or errs)`, async () => {
// How verif ythere're none? Wait for how long
    await waitForLogMessages(owen_brA, []);
  });

  it(`But Owen makes an invalid Talkyard function invocation`, async () => {
await owen_brA.d();
    await owen_brA.execute(async function() {
      window['talkyardAddCommentsIframe']({});
    })
  });
  it(`Now there's an error log message — errors & warnings are still logged`, async () => {
    await waitForLogMessages(owen_brA, ["No elem to append in", 'TyE0ELM2APND_'], 'SEVERE');
  });

  it(`Owen appends  #talkyardLogLevel=99  to the URL path`, async () => {
await owen_brA.d();
    // This won't reload the page.
    await owen_brA.go2(await owen_brA.urlPath() + '#talkyardLogLevel=99');
    // So do here:
    await owen_brA.refresh2();
  });
  it(`Now, lots of log messages — any URL path log level has precedence`, async () => {
    await waitForLogMessages(owen_brA, startupDebugMsgs);
  });


  async function waitForLogMessages(sbd_brX: TyE2eTestBrowser,
          expectedMsgParts: St[], level?: 'SEVERE') {
await sbd_brX.d();  // wait for how long?
    const msgs = await sbd_brX.getLogs_worksInChrome('browser');
    const missing = [];
    const wrongLevel = [];
    const fine = [];
    for (let expPart of expectedMsgParts) {
      let found = false;
      let foundButWrongLevel = false;
      for (let m of msgs) {
        if (m.message.indexOf(expPart) === -1) {
          // Continue looking
        }
        else if (level && level !== m.level) {
          found = true;
          foundButWrongLevel = true;
        }
        else {
          found = true;
          foundButWrongLevel = false;
          break;
        }
      }
      if (!found) {
        missing.push(expPart);
      }
      else if (foundButWrongLevel) {
        wrongLevel.push(expPart);
      }
      else {
        fine.push(expPart);
      }
    }

    if (!missing.length && !wrongLevel.length && fine.length) {
      dieIf(fine.length !== expectedMsgParts.length, 'TyE702MSJL45');
      return;
    }

    const driverMsgs = await sbd_brX.getLogs_worksInChrome('driver');

    // What's this?
    logMessage(`\nDriver log messages: ${driverMsgs.map(m => j2s(m))}\n\n`);

    logMessage(`\nBrowser log messages: ${msgs.map(m => j2s(m))}\n\n`);

    assert.not(missing.length, `Log messages missing: ${j2s(missing)}
          Got logged, but wrong log level: ${j2s(wrongLevel)}
          Got logged, fine: ${j2s(fine)}),
          (Find all log messages just above)`);
  };
});

