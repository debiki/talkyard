/// <reference path="../test-types.ts"/>
/// <reference path="../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import * as _ from 'lodash';
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import assert = require('assert');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;
declare let browserA: any;
declare let browserB: any;

let everyone;
let owen;
let maria;
let stranger;
let guest;

let idAddress: IdAddress;
let forumTitle = "Publ Search Forum";

let wordQwertyTitle = "qwerty_title";
let wordQwertyBody = "qwerty_body";
let wordQwertyReply = "qwerty_reply";
let wordMagicMonsters = "magic_monsters";

let wordAbcdef = "abcdef";

let qwertyAbcTitle = `${wordQwertyTitle} ${wordAbcdef}`;
let qwertyAbcBody = `${wordQwertyBody} ${wordAbcdef}`;
let qwertyAbcReply = `${wordQwertyReply} ${wordAbcdef}`;

let xyzTitle = "xyz_title";


describe("basic publ search:", () => {

  it("initialize people", () => {
    browser.perhapsDebugBefore();
    everyone = _.assign(browser, pagesFor(browser));
    owen = _.assign(browserA, pagesFor(browserA), make.memberOwenOwner());
    maria = _.assign(browserB, pagesFor(browserB), make.memberMaria());
    // Reuse the same browser.
    stranger = maria;
    guest = maria;
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('impersonate', { title: forumTitle });
    site.settings.allowGuestLogin = true;
    site.members.push(make.memberMaria());
    idAddress = server.importSiteData(site);
  });

  it("Owen and Maria go to the homepage and log in", () => {
    everyone.go(idAddress.origin);
    everyone.assertPageTitleMatches(forumTitle);
    owen.complex.loginWithPasswordViaTopbar(owen);
    maria.complex.loginWithPasswordViaTopbar(maria);
    // Maria will search a lot.
    maria.disableRateLimits();
  });

  it(`Maria searches for '${wordQwertyTitle}'`, () => {
    maria.topbar.searchFor(wordQwertyTitle);
  });

  it("... finds nothing", () => {
    maria.searchResultsPage.assertPhraseNotFound(wordQwertyTitle);
  });

  it(`... then searches for '${wordAbcdef}', finds nothing`, () => {
    maria.searchResultsPage.searchForWaitForResults(wordAbcdef);
  });

  it("... finds nothing", () => {
    maria.searchResultsPage.assertPhraseNotFound(wordAbcdef);
  });

  it("Owen creates a page with title & body 'will_not_be_found'", () => {
    owen.complex.createAndSaveTopic({ title: 'will_not_be_found', body: 'will_not_be_found' });
  });

  it(`... and another page with 'qwertyTitle/Body abcdef' title & body`, () => {
    owen.back();
    owen.complex.createAndSaveTopic({ title: qwertyAbcTitle, body: qwertyAbcBody });
  });

  it(`... and two replies: '${qwertyAbcReply}' and '${wordMagicMonsters}'`, () => {
    owen.complex.replyToOrigPost(qwertyAbcReply);
    owen.complex.replyToOrigPost(wordMagicMonsters);
  });

  // Search for the most recently added comment first — when that one has been indexed,
  // everything else should have been indexed, too.

  it(`Maria searches for '${wordMagicMonsters}', finds that reply (only)`, () => {
    maria.searchResultsPage.searchForUntilNumPagesFound(wordMagicMonsters, 1);
    maria.assertTextMatches('.esSERP_Hit_PageTitle', qwertyAbcTitle);
    maria.assertNoTextMatches('.esSERP_Hit_Text', wordQwertyTitle);
    maria.assertNoTextMatches('.esSERP_Hit_Text', wordQwertyBody);
    maria.assertNoTextMatches('.esSERP_Hit_Text', wordQwertyReply);
    maria.assertTextMatches('.esSERP_Hit_In', /comment|reply/);
    maria.assertTextMatches('.esSERP_Hit_Text', wordMagicMonsters);
    maria.assertExactly(1, '.esSERP_Hit_In');
    maria.assertExactly(1, '.esSERP_Hit_Text');
  });

  it(`... she searches for '${wordQwertyTitle}' and finds the page title`, () => {
    maria.searchResultsPage.searchForUntilNumPagesFound(wordQwertyTitle, 1);
    maria.assertTextMatches('.esSERP_Hit_PageTitle', qwertyAbcTitle);
    maria.assertTextMatches('.esSERP_Hit_In', "title");
    maria.assertTextMatches('.esSERP_Hit_Text', wordQwertyTitle);
    maria.assertExactly(1, '.esSERP_Hit_In');
    maria.assertExactly(1, '.esSERP_Hit_Text');
  });

  it(`... she searches for '${wordQwertyBody}', finds the page body`, () => {
    maria.searchResultsPage.searchForWaitForResults(wordQwertyBody);
    maria.assertTextMatches('.esSERP_Hit_PageTitle', qwertyAbcTitle);
    maria.assertTextMatches('.esSERP_Hit_In', "page text");
    maria.assertTextMatches('.esSERP_Hit_Text', wordQwertyBody);
    maria.assertExactly(1, '.esSERP_Hit_In');
    maria.assertExactly(1, '.esSERP_Hit_Text');
  });

  it(`... she searches for '${wordQwertyReply}', finds the reply`, () => {
    maria.searchResultsPage.searchForWaitForResults(wordQwertyReply);
    maria.assertTextMatches('.esSERP_Hit_PageTitle', qwertyAbcTitle);
    maria.assertTextMatches('.esSERP_Hit_In', /comment|reply/);
    maria.assertTextMatches('.esSERP_Hit_Text', wordQwertyReply);
    maria.assertExactly(1, '.esSERP_Hit_In');
    maria.assertExactly(1, '.esSERP_Hit_Text');
  });

  it(`... she searches for '${wordAbcdef}', finds title, body, one reply`, () => {
    maria.searchResultsPage.searchForWaitForResults(wordAbcdef);
    assert(maria.searchResultsPage.countNumPagesFound_1() === 1);
    maria.assertTextMatches('.esSERP_Hit_PageTitle', qwertyAbcTitle);
    maria.assertAnyTextMatches('.esSERP_Hit_Text', qwertyAbcTitle); // wordQwertyTitle);
    maria.assertAnyTextMatches('.esSERP_Hit_Text', qwertyAbcBody); // wordQwertyBody);
    maria.assertAnyTextMatches('.esSERP_Hit_Text', qwertyAbcReply); // wordQwertyReply);
    maria.assertNoTextMatches('.esSERP_Hit_Text', wordMagicMonsters);
    maria.assertExactly(3, '.esSERP_Hit_In');
    maria.assertExactly(3, '.esSERP_Hit_Text');
  });

  it(`Owen creates a third page, title & body '${xyzTitle}' and '${wordQwertyBody}'`, () => {
    owen.back();
    owen.complex.createAndSaveTopic({ title: xyzTitle, body: wordQwertyBody });
  });

  it(`Maria searches for '${wordQwertyBody}', finds both pages, xyz first, then qwerty`, () => {
    maria.searchResultsPage.searchForUntilNumPagesFound(wordQwertyBody, 2);
    assertFoundTwoQwertyBodies(maria);
  });

  function assertFoundTwoQwertyBodies(someone) {
    // xyz should be first, because its page body matches the search phrase exactly,
    // but the qwerty page also includes the text "abcdef" = less good match?
    someone.assertNthTextMatches('.esSERP_Hit_PageTitle', 1, xyzTitle);
    someone.assertNthTextMatches('.esSERP_Hit_PageTitle', 2, qwertyAbcTitle);
    someone.assertNthTextMatches('.esSERP_Hit_Text', 1, wordQwertyBody);
    someone.assertNthTextMatches('.esSERP_Hit_Text', 2, qwertyAbcBody);
    someone.assertExactly(2, '.esSERP_Hit_In');
    someone.assertExactly(2, '.esSERP_Hit_Text');
  }

  it(`Owen also searches for '${wordQwertyBody}'`, () => {
    owen.topbar.searchFor(wordQwertyBody);
  });

  it(`... and finds both pages`, () => {
    assertFoundTwoQwertyBodies(owen);
  });

  it(`Maria leaves; a stranger arrives`, () => {
    assert(stranger === maria);
    maria.go(idAddress.origin);
    maria.topbar.clickLogout();
  });

  it(`The stranger searches for '${wordQwertyBody}', finds both pages`, () => {
    stranger.topbar.searchFor(wordQwertyBody);
    assertFoundTwoQwertyBodies(stranger);
  });

  it(`... but doesn't find 'non_existing_text'`, () => {
    stranger.searchResultsPage.searchForWaitForResults('non_existing_text');
    stranger.searchResultsPage.assertPhraseNotFound('non_existing_text');
  });

  it(`A guest logs in`, () => {
    assert(guest === stranger);
    stranger.go(idAddress.origin);
    guest.complex.loginAsGuestViaTopbar("Gunnar Guest");
  });

  it(`The guest searches for '${wordQwertyBody}', finds both pages`, () => {
    guest.topbar.searchFor(wordQwertyBody);
    assertFoundTwoQwertyBodies(guest);
  });

  it(`... but doesn't find 'non_existing_text'`, () => {
    guest.searchResultsPage.searchForWaitForResults('non_existing_text');
    guest.searchResultsPage.assertPhraseNotFound('non_existing_text');
  });

  it("Done", () => {
    everyone.perhapsDebug();
  });

});

