/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import { execSync} from 'child_process';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings from '../utils/settings';
import { dieIf, logError, logErrorNoTrace } from '../utils/log-and-die';
import c from '../test-constants';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let mons: Member;

let maria: Member;
let maria_brB: TyE2eTestBrowser;

let defSite: IdAddress;
let defForum: TwoCatsTestForum;

let otherSite: IdAddress;
let otherForum: TwoCatsTestForum;

const evilIp = '111.112.113.114';

const mentionsOwenTitle = 'mentionsOwenTitle';
const mentionsOwenBody = 'mentionsOwenBody, Hi @owen_owner';



describe(`d.secfix.host-header-inj.2br  TyTEHOSTHDRINJ`, () => {

  it(`Construct browsers`, async () => {
    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen_brA = brA;
    maria_brB = brB;
  });

  // ----- Not the default site
  
  // Attack won't work (unless accidentally same email).

  /*
  it(`Construct additional site`, async () => {
    const builder = buildSite();
    otherForum = builder.addTwoCatsForum({
      title: "Host Hdr Inj Extra Site",
      members: ['mons', 'maria']
    });

    owen = otherForum.members.owen;
    mons = otherForum.members.mons;
    maria = otherForum.members.maria;

    assert.refEq(builder.getSite(), otherForum.siteData);
  });


  it(`Import additional site`, async () => {
    otherSite = await server.importSiteData(otherForum.siteData);
    await server.skipRateLimits(otherSite.id);
  });
  */


  it(`Construct default site, overwrite existing`, async () => {
    const builder = buildSite();
    defForum = builder.addTwoCatsForum({
      title: "Host Hdr Inj Default Site",
      members: ['mons', 'maria']
    });

    // Hmm, these are the same as at otherSite:
    owen = defForum.members.owen;
    mons = defForum.members.mons;
    maria = defForum.members.maria;

    assert.refEq(builder.getSite(), defForum.siteData);
  });


  it(`Import-overwrite default site, siteId 1`, async () => {
    defSite = await server.importSiteData(defForum.siteData, { overwriteDefaultSite: true });
    await server.skipRateLimits(defSite.id);
  });


  it(`Maria logs in`, async () => {
    await maria_brB.go2(defSite.origin);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });


  it(`Owen sends a well intended reset-password request via cURL — this is ok`, async () => {
    await makeResetPasswordRequest({ toOrigin: defSite.origin, forEmailAdr: owen.emailAddress,
            useRealHostAdr: true });
  });


  it(`Mallory sends a mallicious reset-password request, on Owen's behalf
          — the server must not allow this`, async () => {
    await makeResetPasswordRequest({ toOrigin: defSite.origin, forEmailAdr: owen.emailAddress,
            fakeHostAdr: '111.112.113.114' });
  });


  it(`Maria posts a message to Owen`, async () => {
    await maria_brB.complex.createAndSaveTopic({
            title: mentionsOwenTitle, body: mentionsOwenBody });
  });

  it(`... Owen gets a notification email about Maria's message`, async () => {
    await server.waitUntilLastEmailMatches(defSite.id, owen.emailAddress, mentionsOwenTitle);
    // Now all other emails should have been sent, too.
  });

  let emails: EmailSubjectBody[] | U;

  it(`Owen checks all his emails`, async () => {
    emails = await server.waitGetLastEmailsSenTo(defSite.id, owen.emailAddress);
  });

  it(`The first one is a reset password email — the one he sent to himself`, async () => {
    const emailOne = emails[0];
    assert.includes(emailOne.bodyHtmlText,
          `${defSite.origin}/-/reset-password/choose-password/`);
    assert.excludes(emailOne.bodyHtmlText, evilIp);
  });

  it(`The last one is the @mention notification`, async () => {
    const emailLast = emails[emails.length - 1];
    assert.includes(emailLast.bodyHtmlText, mentionsOwenTitle);
    assert.excludes(emailLast.bodyHtmlText, evilIp);
  });

  it(`Owen got no other emails — really not the mallicious password reset email`, async () => {
    if (emails.length >= 3) {
      logErrorNoTrace(`\nSecurity bug: Owen got Mallory's mallicious pwd reset email?`);
      if (emails.length === 3) {
        logErrorNoTrace(`This should be the bad email:\n`);
        logErrorNoTrace(JSON.stringify(emails[1], undefined, 4) + '\n');
      }
      else {
        logErrorNoTrace(`Unexpectedly many emails! Here:\n`);
        logErrorNoTrace(JSON.stringify(emails, undefined, 4) + '\n');
      }
      assert.fail('TyE025MWEJ46');
    }
    else {
      assert.eq(emails.length, 2); // ttt
    }

    // Extra test, not really needed.
    for (const email of emails) {
      assert.excludes(email.bodyHtmlText, evilIp);
    }
  });



  async function makeResetPasswordRequest(ps: { toOrigin: St, forEmailAdr: St,
            fakeHostAdr?: St, useRealHostAdr?: true }) {

    // Should specify exactly one.
    dieIf(!!ps.fakeHostAdr === !!ps.useRealHostAdr, 'TyE40MJEMG52');

    const anyBadHostHeader = ps.fakeHostAdr ? `-H 'Host: ${ps.fakeHostAdr}'` : '';
    const emailAdrEscaped = ps.forEmailAdr.replace('@', '%40');

    const curlCmd = `curl '${defSite.origin}/-/reset-password/specify-email'   -H 'Connection: keep-alive'   -H 'Cache-Control: max-age=0'   -H 'sec-ch-ua: "Chromium";v="94", "Google Chrome";v="94", ";Not A Brand";v="99"'   -H 'sec-ch-ua-mobile: ?0'   -H 'sec-ch-ua-platform: "Linux"'   -H 'Upgrade-Insecure-Requests: 1'   -H 'Origin: http://e2e-test-cid-0-0-now-9537.localhost'   -H 'Content-Type: application/x-www-form-urlencoded'   -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.71 Safari/537.36'   -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9'   -H 'Sec-Fetch-Site: same-origin'   -H 'Sec-Fetch-Mode: navigate'   -H 'Sec-Fetch-User: ?1'   -H 'Sec-Fetch-Dest: document'   -H 'Referer: http://e2e-test-cid-0-0-now-9537.localhost/-/reset-password/specify-email'   -H 'Accept-Language: en-US,en;q=0.9'   -H 'Cookie: esCoE2eTestPassword=public; dwCoBrId=1633895389.web70c9kjla3.Rgl-3lQa0VWtRUX; XSRF-TOKEN=1633895417.2pkcqk834br6.PgqwR4YjTj7MiGi'   --data-raw 'dw-fi-xsrf=1633895417.2pkcqk834br6.PgqwR4YjTj7MiGi&email=${emailAdrEscaped}'   --compressed ${anyBadHostHeader} -v -v`;

    console.log(`\nSending network request:\n${curlCmd}`);

    const resultBuf: Buffer = execSync(curlCmd);

    const resultSt: St = resultBuf.toString();
    console.log(`\nResult:\n${resultSt}\n`);
  }

});

// Oops. Sending reset email should be INFO log level. (Not just DEUBG)
