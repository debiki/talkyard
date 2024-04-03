/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { logMessage, j2s, logBoring } from '../utils/log-and-die';
import c from '../test-constants';
import { IsWhere } from '../test-types';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let brC: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let alice: Member;
let alice_brC: TyE2eTestBrowser;
let mons: Member;
let mons_brA: TyE2eTestBrowser;
let maja: Member;
let maja_brA: TyE2eTestBrowser;
let mallory: Member;
let mallory_brB: TyE2eTestBrowser;

// Try to remember to update, if adding more users?
const majasUserId = 104;

const weakSidErrCode = 'TyEWEAKSID_';  // move to test constants?

const localHostname = 'comments-for-e2e-test-stealembs';
const embeddingOrigin = 'http://e2e-test-stealembs.localhost:8080';
let embeddingPageSlug = 'emb-sess-stealer.html';
let embeddingPageUrl = embeddingOrigin + '/' + embeddingPageSlug;

let site: IdAddress;
let forum: TwoCatsTestForum;

let monsLocalStorageSessionJsonSt = '';

let stolenSidPart1And2WasMons = '';

let stolenSidPart1OnlyWasOwens = '';
let stolenSidPart1And2WasOwens = '';


describe(`embcom.sessions-emb-sess-cannot-moderate.3br  TyTEECSESS0MOD`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Emb Comments Sessions Cannot Moderate",
      members: ['owen', 'alice', 'mons', 'maja', 'mallory'],
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.getSite().settings.allowEmbeddingFrom = embeddingOrigin;

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    brC = new TyE2eTestBrowser(wdioBrowserC, 'brC');

    owen = forum.members.owen;
    owen_brA = brA;

    mons = forum.members.mons;
    mons_brA = brA;

    maja = forum.members.maja;
    maja_brA = brA;

    mallory = forum.members.mallory;
    mallory_brB = brB;

    alice = forum.members.alice;
    alice_brC = brC;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Create embedding pages`, () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/${embeddingPageSlug}`, makeHtml('aaa', '#800'));
    function makeHtml(pageName: St, bgColor: St): St {
      return utils.makeEmbeddedCommentsHtml({
              pageName, discussionId: '', localHostname, bgColor});
    }
  });


  it(`Mons goes to a dangerous embedding page (in browser A)
            with an xss attack that lets Mallory steal session part 1 and 2`, async () => {
    await mons_brA.go2(embeddingPageUrl);
  });

  it(`... Mons logs in`, async () => {
    await mons_brA.complex.loginIfNeededViaMetabar(mons);
  });

  it(`Mallory steals the session via the xss attack`, async () => {
    monsLocalStorageSessionJsonSt = await mons_brA.execute(function() {
      return localStorage.getItem('talkyardSession');
    });

    stolenSidPart1And2WasMons = JSON.parse(monsLocalStorageSessionJsonSt).weakSessionId;

    logMessage(`Mallory stole Mons' session: "${monsLocalStorageSessionJsonSt}",
        part 1 + 2: "${stolenSidPart1And2WasMons}"`);
  });


  it(`Mallory goes to the embedding page, in his own browser B`, async () => {
    await mallory_brB.go2(embeddingPageUrl);
  });

  it(`... puts the stolen session in localStorage`, async () => {
    await mallory_brB.execute(function(s) {
      localStorage.setItem('talkyardSession', s);
    }, monsLocalStorageSessionJsonSt);
  });

  it(`... reloads`, async () => {
    await mallory_brB.refresh2();
  });

  it(`... now Mallory is logged in as Mons — but with session id parts 1+2 only`, async () => {
    await mallory_brB.switchToEmbeddedCommentsIrame();
    assert.eq(await mallory_brB.metabar.getMyUsernameInclAt(), '@' + mons.username);
  });

  it(`Bad 1, will work: Mallory posts a comment`, async () => {
    await mallory_brB.complex.replyToEmbeddingBlogPost(
            "Hi I'm Mons no I'm not yes_no_yes_you_guess");
  });

  let resp;

  it(`Bad 2, won't work: Mallory tries to suspend Maja`, async () => {
    await mallory_brB.switchToEmbCommentsIframeIfNeeded(); // reidr
    resp = await mallory_brB.hackServer.suspendUser(majasUserId);
  });
  it(`Bad 2: ... the server refuses`, async () => {
    assert.not(resp.serverSaysOk);  // ttt
    assert.that(resp.serverSaysError);
  });
  it(`Bad 2: ... there's an error dialog`, async () => {
    await mallory_brB.serverErrorDialog.waitAndAssertTextMatches(weakSidErrCode);
    await mallory_brB.serverErrorDialog.close();
  });

  it(`Bad 3: Mallory then tries to add his own email addr to Mon's account`, async () => {
    await mallory_brB.switchToEmbCommentsIframeIfNeeded();  // reidr
    resp = await mallory_brB.hackServer.addEmailAddresses("mallory@x.co");
  });
  it(`Bad 3: ... the server refuses`, async () => {
    assert.not(resp.serverSaysOk);  // ttt
    assert.that(resp.serverSaysError);
  });
  it(`Bad 3: ... there's an error dialog`, async () => {
    await mallory_brB.serverErrorDialog.waitAndAssertTextMatches(weakSidErrCode);
    await mallory_brB.serverErrorDialog.close();
  });


  it(`Bad 4: Mallory tries to list Mons' email addresses`, async () => {
    await mallory_brB.switchToEmbCommentsIframeIfNeeded();  // reidr
    resp = await mallory_brB.hackServer.loadEmailAddressesAndLoginMethods();
  });
  it(`Bad 4: ... the server refuses`, async () => {
    assert.not(resp.serverSaysOk);  // ttt
    assert.that(resp.serverSaysError);
  });
  it(`Bad 4: ... there's another error dialog`, async () => {
    await mallory_brB.serverErrorDialog.waitAndAssertTextMatches(weakSidErrCode);
    await mallory_brB.serverErrorDialog.close();
  });


  it(`Good 4: Mons also cannot list his email addresses from inside the iframe`, async () => {
    await mons_brA.switchToEmbCommentsIframeIfNeeded();  // reidr
    resp = await mons_brA.hackServer.loadEmailAddressesAndLoginMethods();
  });
  it(`Good 4: ... the server says no to Mons too`, async () => {
    assert.not(resp.serverSaysOk);  // ttt
    assert.that(resp.serverSaysError);
  });
  it(`Good 4: ... Mons also gets an error dialog`, async () => {
    await mons_brA.serverErrorDialog.waitAndAssertTextMatches(weakSidErrCode);
    await mons_brA.serverErrorDialog.close();
  });


  /*
  it(`Bad 5: Mallory tries to download Mons' personal data  TESTS_MISSING`, async () => {
    await mallory_brB.switchToEmbCommentsIframeIfNeeded();  // reidr
    resp = await mallory_brB.hackServer.  ?? ();
  });
  it(`Bad 5: ... the server refuses`, async () => {
    assert.not(resp.serverSaysOk);  // ttt
    assert.that(resp.serverSaysError);
  });
  it(`Bad 5: ... there's another error dialog`, async () => {
    await mallory_brB.serverErrorDialog.waitAndAssertTextMatches(weakSidErrCode);
    await mallory_brB.serverErrorDialog.close();
  });
  */

  let monsUserId: Nr | U;

  it(`Mallory remembers Mons' user id`, async () => {
    monsUserId = await mallory_brB.hackServer.getMyUserId();
    logBoring(`Mons' user id is: ${monsUserId}`);
  });



  it(`Mallory click-opens Mons' profile in a new tab`, async () => {
    await mallory_brB.metabar.openMyProfilePageInNewTab();
  });

  it(`... but in the new tab, he's not logged in — cookies missing`, async () => {
    await mallory_brB.swithToOtherTabOrWindow();
    await mallory_brB.me.waitUntilKnowsNotLoggedIn();
  });


  it(`Mons, though, can click his name ...`, async () => {
    await mons_brA.switchToEmbCommentsIframeIfNeeded();
    await mons_brA.metabar.openMyProfilePageInNewTab();
  });

  it(`... and in the new tab, he *is* logged in`, async () => {
    await mons_brA.swithToOtherTabOrWindow();
    await mons_brA.me.waitUntilLoggedIn();
    await mons_brA.topbar.assertMyUsernameMatches(mons.username);
  });

  it(`Mons checks his email addresses`, async () => {
    await mons_brA.userProfilePage.tabs.switchToPreferences();
    await mons_brA.userProfilePage.preferences.tabs.switchToAccount();
  });

  it(`... no new address has been added`, async () => {
    const adrs: St[] =
            await mons_brA.userProfilePage.preferences.emailsLogins.getAllEmailAddresses();
    assert.deepEq(adrs, [mons.emailAddress]);
  });


  it(`Mallory uses the stolen session parts 1+2, in the new tab`, async () => {
    await mallory_brB.hackServer.setSidPart12ViaJs(stolenSidPart1And2WasMons, { inCookie: true });
  });

  it(`... now Mallory has a cookie for session parts 1+2`, async () => {
    const sids = await mallory_brB.hackServer.getSids();
    logMessage(`getSids() says: ${j2s(sids)}`);
    assert.greaterThan(sids.sidCookiePart123.length, 30);
  });

  it(`Mallory reloads, tries to use the parts 1+2 cookie`, async () => {
    await mallory_brB.refresh2({ isWhere: IsWhere.External });
  });
  it(`... but there's an error: SID part 3 missing`, async () => {
    const source = await mallory_brB.getPageSource();
    assert.includes(source, weakSidErrCode);
  });


  let monsDataUrl: St | U;
  let monsContentUrl: St | U;

  it(`Mallory constructs links to Mons' personal data and Mons' posts`, async () => {
    monsDataUrl = mallory_brB.user.genDownloadPersonalDataUrl_sync(monsUserId);
    monsContentUrl = mallory_brB.user.genDownloadPersonalContentUrl_sync(monsUserId);
  });

  it(`Mallory then tries to fetch Mons' personal data`, async () => {
    await mallory_brB.go2(monsDataUrl, { willBeWhere: IsWhere.External });
  });
  it(`... this not allowed — session id part 3 missing`, async () => {
    const source = await mallory_brB.getPageSource();
    assert.includes(source, weakSidErrCode);
  });

  it(`Mons, though, can download his data — he has SID part 3 HttpOnly`, async () => {
    await mons_brA.go2(monsDataUrl, { willBeWhere: IsWhere.External });
  });
  it(`... his name and emai (among other things) are in the JSON`, async () => {
    const source = await mons_brA.getPageSource();
    assert.includes(source, mons.username);
    assert.includes(source, mons.emailAddress);
    assert.excludes(source, weakSidErrCode);
  });


  it(`Mallory tries to fetch Mon's posts`, async () => {
    await mallory_brB.go2(monsContentUrl, { willBeWhere: IsWhere.External });
  });
  it(`... also not allowed — session id part 3 missing`, async () => {
    const source = await mallory_brB.getPageSource();
    assert.includes(source, weakSidErrCode);
  });

  it(`Mons can download his posts — he has SID part 3 HttpOnly`, async () => {
    await mons_brA.go2(monsContentUrl, { willBeWhere: IsWhere.External });
  });
  it(`... Mallory's post, made with the stolen SID part 1+2, is in the JSON`, async () => {
    const source = await mons_brA.getPageSource();
    assert.includes(source, 'yes_no_yes_you_guess');
    assert.excludes(source, weakSidErrCode);
  });


  /* Maybe?
  it(`... but when Mallory tries to use the sid, the server clears all session cookies
            — it notices that part 3, HttpOnly, is missing`, async () => {
  });

  it(`The server also ends the session — since something is amiss`, async () => {
  });
  */

});

