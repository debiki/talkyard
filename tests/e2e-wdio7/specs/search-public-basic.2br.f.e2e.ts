/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';

let everyone: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;
let guest_brB: TyE2eTestBrowser;

let idAddress: IdAddress;
const forumTitle = "Publ Search Forum";

const wordQwertyTitle = "qwerty_title";
const wordQwertyBody = "qwerty_body";
const wordQwertyReply = "qwerty_reply";
const wordMagicMonsters = "magic_monsters";

const wordAbcdef = "abcdef";

const qwertyAbcTitle = `${wordQwertyTitle} ${wordAbcdef}`;
const qwertyAbcBody = `${wordQwertyBody} ${wordAbcdef}`;
const qwertyAbcReply = `${wordQwertyReply} ${wordAbcdef}`;

const xyzTitle = "xyz_title";


describe("search-public-basic.2br.f  TyTSEARCHPUBBASIC", () => {

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    everyone = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    owen_brA = brA;
    owen = make.memberOwenOwner();
    maria_brB = brB;
    maria = make.memberMaria();
    // Reuse the same browser.
    stranger_brB = maria_brB;
    guest_brB = maria_brB;
  });

  it("import a site", async () => {
    let site: SiteData = make.forumOwnedByOwen('impersonate', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.settings.requireVerifiedEmail = false;
    site.settings.mayPostBeforeEmailVerified = true; // remove later, if email not required [0KPS2J]
    site.members.push(make.memberMaria());
    idAddress = await server.importSiteData(site);
  });

  it("Owen and Maria go to the homepage and log in", async () => {
    await everyone.go2(idAddress.origin);
    await owen_brA.assertPageTitleMatches(forumTitle);
    await maria_brB.assertPageTitleMatches(forumTitle);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
    // Maria will search a lot.
    await maria_brB.disableRateLimits();
  });

  it(`Maria searches for '${wordQwertyTitle}'`, async () => {
    await maria_brB.topbar.searchFor(wordQwertyTitle);
  });

  it("... finds nothing", async () => {
    await maria_brB.searchResultsPage.assertPhraseNotFound(wordQwertyTitle);
  });

  it(`... then searches for '${wordAbcdef}', finds nothing`, async () => {
    await maria_brB.searchResultsPage.searchForWaitForResults(wordAbcdef);
  });

  it("... finds nothing", async () => {
    await maria_brB.searchResultsPage.assertPhraseNotFound(wordAbcdef);
  });

  it("Owen creates a page with title & body 'will_not_be_found'", async () => {
    await owen_brA.complex.createAndSaveTopic({ title: 'will_not_be_found', body: 'will_not_be_found' });
  });

  it(`... and another page with 'qwertyTitle/Body abcdef' title & body`, async () => {
    await owen_brA.back();
    await owen_brA.complex.createAndSaveTopic({ title: qwertyAbcTitle, body: qwertyAbcBody });
  });

  it(`... and two replies: '${qwertyAbcReply}' and '${wordMagicMonsters}'`, async () => {
    await owen_brA.complex.replyToOrigPost(qwertyAbcReply);
    await owen_brA.complex.replyToOrigPost(wordMagicMonsters);
  });

  // Search for the most recently added comment first — when that one has been indexed,
  // everything else should have been indexed, too.

  it(`Maria searches for '${wordMagicMonsters}', finds that reply (only)`, async () => {
    await maria_brB.searchResultsPage.searchForUntilNumPagesFound(wordMagicMonsters, 1);
    await maria_brB.assertTextMatches('.c_SR_Ttl', qwertyAbcTitle);
    await maria_brB.assertNoTextMatches('.esSERP_Hit_Text', wordQwertyTitle);
    await maria_brB.assertNoTextMatches('.esSERP_Hit_Text', wordQwertyBody);
    await maria_brB.assertNoTextMatches('.esSERP_Hit_Text', wordQwertyReply);
    await maria_brB.assertTextMatches('.esSERP_Hit_In', /comment|reply/);
    await maria_brB.assertTextMatches('.esSERP_Hit_Text', wordMagicMonsters);
    await maria_brB.assertExactly(1, '.esSERP_Hit_In');
    await maria_brB.assertExactly(1, '.esSERP_Hit_Text');
  });

  it(`... she searches for '${wordQwertyTitle}' and finds the page title`, async () => {
    await maria_brB.searchResultsPage.searchForUntilNumPagesFound(wordQwertyTitle, 1);
    await maria_brB.assertTextMatches('.c_SR_Ttl-HitTtl', qwertyAbcTitle);
    await maria_brB.assertTextMatches('.esSERP_Hit_Text', wordQwertyTitle);
    assert.ok(!(await maria_brB.isVisible('.esSERP_Hit_In')));
    await maria_brB.assertExactly(1, '.esSERP_Hit_Text');
  });

  it(`... she searches for '${wordQwertyBody}', finds the page body`, async () => {
    await maria_brB.searchResultsPage.searchForWaitForResults(wordQwertyBody);
    await maria_brB.assertTextMatches('.c_SR_Ttl-HitOp', qwertyAbcTitle);
    //maria.assertTextMatches('.esSERP_Hit_In', "page text");
    await maria_brB.assertTextMatches('.esSERP_Hit_Text', wordQwertyBody);
    //maria.assertExactly(1, '.esSERP_Hit_In');
    assert.ok(!(await maria_brB.isVisible('.esSERP_Hit_In')));
    await maria_brB.assertExactly(1, '.esSERP_Hit_Text');
  });

  it(`... she searches for '${wordQwertyReply}', finds the reply`, async () => {
    await maria_brB.searchResultsPage.searchForWaitForResults(wordQwertyReply);
    await maria_brB.assertTextMatches('.c_SR_Ttl', qwertyAbcTitle);
    await maria_brB.assertTextMatches('.esSERP_Hit_In', /comment|reply/);
    await maria_brB.assertTextMatches('.esSERP_Hit_Text', wordQwertyReply);
    await maria_brB.assertExactly(1, '.esSERP_Hit_In');
    await maria_brB.assertExactly(1, '.esSERP_Hit_Text');
  });

  it(`... she searches for '${wordAbcdef}', finds title, body, one reply`, async () => {
    await maria_brB.searchResultsPage.searchForWaitForResults(wordAbcdef);
    assert.eq(await maria_brB.searchResultsPage.countNumPagesFound_1(), 1);
    await maria_brB.assertTextMatches('.c_SR_Ttl-HitTtl', qwertyAbcTitle);
    await maria_brB.assertAnyTextMatches('.esSERP_Hit_Text', qwertyAbcTitle); // wordQwertyTitle);
    await maria_brB.assertAnyTextMatches('.esSERP_Hit_Text', qwertyAbcBody); // wordQwertyBody);
    await maria_brB.assertAnyTextMatches('.esSERP_Hit_Text', qwertyAbcReply); // wordQwertyReply);
    await maria_brB.assertNoTextMatches('.esSERP_Hit_Text', wordMagicMonsters);
    await maria_brB.assertExactly(1, '.esSERP_Hit_In'); // only for the reply
    await maria_brB.assertExactly(3, '.esSERP_Hit_Text');
  });

  it(`Owen creates a third page, title & body '${xyzTitle}' and '${wordQwertyBody}'`, async () => {
    await owen_brA.back();
    await owen_brA.complex.createAndSaveTopic({ title: xyzTitle, body: wordQwertyBody });
  });

  it(`Maria searches for '${wordQwertyBody}', finds both pages, xyz first, then qwerty`, async () => {
    await maria_brB.searchResultsPage.searchForUntilNumPagesFound(wordQwertyBody, 2);
    await assertFoundTwoQwertyBodies(maria_brB);
  });

  async function assertFoundTwoQwertyBodies(brX: TyE2eTestBrowser) {
    // xyz should be first, because its page body matches the search phrase exactly,
    // but the qwerty page also includes the text "abcdef" = less good match?
    await brX.assertNthTextMatches('.c_SR_Ttl', 1, xyzTitle);
    await brX.assertNthTextMatches('.c_SR_Ttl', 2, qwertyAbcTitle);
    await brX.assertNthTextMatches('.esSERP_Hit_Text', 1, wordQwertyBody);
    await brX.assertNthTextMatches('.esSERP_Hit_Text', 2, qwertyAbcBody);
    await brX.assertExactly(0, '.esSERP_Hit_In'); // only for comments, not the orig-post
    await brX.assertExactly(2, '.esSERP_Hit_Text');
  }

  it(`Owen also searches for '${wordQwertyBody}'`, async () => {
    await owen_brA.topbar.searchFor(wordQwertyBody);
  });

  it(`... and finds both pages`, async () => {
    await assertFoundTwoQwertyBodies(owen_brA);
  });

  it(`Maria leaves; a stranger arrives`, async () => {
    assert.eq(stranger_brB, maria_brB);
    await maria_brB.go2(idAddress.origin);
    await maria_brB.topbar.clickLogout();
  });

  it(`The stranger searches for '${wordQwertyBody}', finds both pages`, async () => {
    await stranger_brB.topbar.searchFor(wordQwertyBody);
    await assertFoundTwoQwertyBodies(stranger_brB);
  });

  it(`... but doesn't find 'non_existing_text'`, async () => {
    await stranger_brB.searchResultsPage.searchForWaitForResults('non_existing_text');
    await stranger_brB.searchResultsPage.assertPhraseNotFound('non_existing_text');
  });

  it(`A guest logs in`, async () => {
    assert.eq(guest_brB, stranger_brB);
    await stranger_brB.go2(idAddress.origin);
    await guest_brB.complex.signUpAsGuestViaTopbar("Gunnar Guest");
  });

  it(`The guest searches for '${wordQwertyBody}', finds both pages`, async () => {
    await guest_brB.topbar.searchFor(wordQwertyBody);
    await assertFoundTwoQwertyBodies(guest_brB);
  });

  it(`... but doesn't find 'non_existing_text'`, async () => {
    await guest_brB.searchResultsPage.searchForWaitForResults('non_existing_text');
    await guest_brB.searchResultsPage.assertPhraseNotFound('non_existing_text');
  });

});

