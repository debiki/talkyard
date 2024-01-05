/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { dieIf, j2s, logMessage } from '../utils/log-and-die';


let brA: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;

const localHostname = 'comments-for-e2e-test-loadtwice.localhost-8080';
const embeddingOrigin = 'http://e2e-test-loadtwice.localhost:8080';

let site: IdAddress;
let forum: TwoCatsTestForum;

const startupInfoMsgs = [
          `"Talkyard comments: Starting`,
          `"Talkyard comments: Session iframe inited`,
          `"Talkyard comments: Editor iframe inited`,
          `"Talkyard comments: Comments iframe nr`,
          `"Talkyard comments: All comment iframes inited`,
          ];
// As of Dec 2023, there's 5 startup info messages — let's say at most 7, so can add
// a few more without breaking these tests.
const startupInfoMsgsAtMost = 7;

// This is 10 messages, > 7.
const startupDebugMsgs = [
          ...startupInfoMsgs,
          `"Talkyard comments: createSessionFrame`,
          `"Talkyard comments: inserted editorIframe`,
          `"Talkyard comments: loadFirstCommentsIframe`,
          `"Talkyard comments: intCommentIframe(`,
          `"Talkyard comments: loadRemainingCommentIframes`
          ];



describe(`embcom.log-levels-on-loaded.1br.ec  TyTECLOGSCLBKS`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some Emb Comments E2E Test",
      members: ['maria', 'michael']
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;

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
    fs.writeFileSync(`${dir}/log-level-undef.html`, makeHtml('ll-undef', '#500'));
    fs.writeFileSync(`${dir}/log-level-99.html`, makeHtml('ll-99', '#500', 99));
    fs.writeFileSync(`${dir}/log-level-debug.html`, makeHtml('ll-dbg', '#500', "'debug'"));
    fs.writeFileSync(`${dir}/log-level-info.html`, makeHtml('ll-info', '#500', "'info'"));
    fs.writeFileSync(`${dir}/log-level-warn.html`, makeHtml('ll-warn', '#500', '"warn"'));
    /* Could test as well, later — but right now, it's either 'warn' or 'debug':
    fs.writeFileSync(`${dir}/log-level-trace.html`, makeHtml('...', '#500', 'trace'));
    fs.writeFileSync(`${dir}/log-level-......html`, makeHtml('...', '#500', 0 ));
    fs.writeFileSync(`${dir}/log-level-......html`, makeHtml('...', '#500', 'off' ));
    */
    function makeHtml(pageName: St, bgColor: St, talkyardLogLevel?: St | Nr): St {
      return utils.makeEmbeddedCommentsHtml({
              pageName, discussionId: '', localHostname, bgColor, talkyardLogLevel,
              appendExtraHtml: `
                  <script>
                  // TyTSCRIPTCLBK
                  onTalkyardScriptLoaded = function() { scriptLoaded = true; }
                  // TyTCOMTSCLBK
                  onTalkyardCommentsLoaded = function() { commentsLoaded = true; }
                  </script>`
              });
    }
  });


  it(`Owen goes to log-level-99.html`, async () => {
    await owen_brA.go2(embeddingOrigin + '/log-level-99.html');
  });

  it(`The onTalkyardScriptLoaded callback works`, async () => {
    await utils.tryUntilTrue(`Loading script`, 'ExpBackoff', async (): Pr<Bo> => {
      return await owen_brA.execute(async function() {
        return window['scriptLoaded'] === true;
      });
    });
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


  it(`Owen goes to log-level-info.html`, async () => {
    await owen_brA.go2('/log-level-info.html');
  });
  it(`There's a bit fewer log messages here`, async () => {
    await waitForLogMessages(owen_brA, startupInfoMsgs, { atMost: startupInfoMsgsAtMost });
  });


  it(`Owen goes to log-level-undef.html`, async () => {
    await owen_brA.go2('/log-level-undef.html');
  });
  it(`Lots of messages — log level is 'trace', by default`, async () => {
    await waitForLogMessages(owen_brA, startupDebugMsgs);
  });


  it(`Owen goes to log-level-warn.html`, async () => {
    await owen_brA.go2('/log-level-warn.html');
  });
  it(`There are no "Talkyard comments: ..." messages  (no warnings or errs)`, async () => {
    await waitForLogMessages(owen_brA, [], { atMost: 0 });
  });

  it(`But Owen makes an invalid Talkyard function invocation`, async () => {
    await owen_brA.execute(async function() {
      window['talkyardAddCommentsIframe']({});
    })
  });
  it(`Now there's an error log message — errors & warnings are still logged`, async () => {
    await waitForLogMessages(owen_brA, ["No elem to append in", 'TyE0ELM2APND_'], {
          level: 'SEVERE', atMost: 1 });
  });

  it(`Owen appends  #talkyardLogLevel=99  to the URL path`, async () => {
    // This won't reload the page.
    await owen_brA.go2(await owen_brA.urlPath() + '#talkyardLogLevel=99');
    // So need to:
    await owen_brA.refresh2();
  });
  it(`Now, lots of log messages — any URL path log level has precedence`, async () => {
    await waitForLogMessages(owen_brA, startupDebugMsgs);
  });


  async function waitForLogMessages(sbd_brX: TyE2eTestBrowser,
          expectedMsgParts: St[], ps: { atMost?: Nr, level?: 'SEVERE' } = {}) {

    // (Maybe could do sth more fancy, but let's just poll.)
    await utils.tryUntilTrue(`Loading Talkyard comments`, 'ExpBackoff', async (): Pr<Bo> => {
      return await sbd_brX.execute(async function() {
        return window['commentsLoaded'] === true;
      });
    });

    const msgs = await sbd_brX.getLogs_worksInChrome('browser');
    const allTyMsgs = msgs.filter(m => m.message.indexOf(`"Talkyard comments:`) >= 0);
    const missing = [];
    const wrongLevel = [];
    const fine = [];

    for (let expPart of expectedMsgParts) {
      let found = false;
      let foundButWrongLevel = false;

      for (let m of allTyMsgs) {
        if (m.message.indexOf(expPart) === -1) {
          // Continue looking
        }
        else if (ps.level && ps.level !== m.level) {
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

    const showLogMsgs = () =>
            `\nTalkyard log messages: ${allTyMsgs.map(m => j2s(m))}\n\n`;

    if (missing.length || wrongLevel.length) {
      // What's this?
      const driverMsgs = await sbd_brX.getLogs_worksInChrome('driver');
      logMessage(`\nDriver log messages: ${driverMsgs.map(m => j2s(m))}\n`);

      logMessage(showLogMsgs());

      assert.fail(`Log messages missing: ${j2s(missing)}
            Got logged, but wrong log level: ${j2s(wrongLevel)}
            Got logged, fine: ${j2s(fine)}),
            (Find all log messages just above)`);
    }

    dieIf(fine.length !== expectedMsgParts.length, 'TyE702MSJL45');

    if (_.isNumber(ps.atMost) && allTyMsgs.length > ps.atMost) {
      logMessage(showLogMsgs());
      assert.fail(`Too many log messages: Expected at most ${
            ps.atMost} but got ${allTyMsgs.length}, see above.`)
    }

    // All seems fine.
  };
});

