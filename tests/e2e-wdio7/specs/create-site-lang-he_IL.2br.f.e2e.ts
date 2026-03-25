/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import server from '../utils/server';
import * as utils from '../utils/utils';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { logMessage } from '../utils/log-and-die';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;

const forumTitle = "Forum in he_IL";
const testId = utils.generateTestId();
let siteId: SiteId;
let siteUrl: St;


describe(`create-site-lang-he_IL.2br.f  TyTE_NEWF_LANG_HE_IL.TyTMULTILING_SEARCH`, () => {

  it(`Init browsers and people`, async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen_brA = brA;
    owen = make.memberOwenOwner();
    // Use an unique address so won't run into max-sites-per-email limit.
    owen.emailAddress = "e2e-test--owen-" + testId + "@example.com";

    maria_brB = brB;
    maria = make.memberMaria();
  });

  it(`Owen creates a site, in Hebrew (a right-to-left language)`, async () => {
    // Bit dupl [mk_site_cust_lang].

    const localHostname = utils.getLocalHostname('create-site-' + testId);
    logMessage(`Generated local hostname: ${localHostname}`);

    // Enable indexing (so search works).
    // Hmm, not needed. I guess "manually" created sites get indexed by default, I forgot.
    // builder.getSite().isTestSiteIndexAnyway = true;

    const newSiteData = {
      testId: testId,
      localHostname: localHostname,
      name: localHostname,
      origin: utils.makeSiteOrigin(localHostname),
      originRegexEscaped: utils.makeSiteOriginRegexEscaped(localHostname),
      orgName: "Owen's E2E Org",
      langName: 'Hebrew',
      fullName: 'E2E Test Hebrew ' + testId,
      email: owen.emailAddress,
    };

    console.log("Goes to the create-new-site page");
    await owen_brA.go2(utils.makeCreateSiteWithFakeIpUrl());

    console.log("Fills in fields and submits");
    await owen_brA.createSite.fillInFieldsAndSubmit(newSiteData);
  });

  it(`Owen signs up as owner`, async () => {
    console.log("Clicks login");
    await owen_brA.createSite.clickOwnerSignupButton();
    await owen_brA.disableRateLimits();
    console.log("Creates password account");
    await owen_brA.loginDialog.createPasswordAccount(owen);
    siteId = await owen_brA.getSiteId();
    console.log("Gets a verification email");
    const link = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(siteId, owen.emailAddress);
    await owen_brA.go2(link);
    console.log("Clicks continue");
    await owen_brA.waitAndClick('#e2eContinue');
  });

  it(`Owen finishes creating the forum`, async () => {
    console.log("Creates a forum");
    await owen_brA.createSomething.createForum(forumTitle);
    siteUrl = await owen_brA.getUrl();
  });

  it(`... buttons are in Hebrew, for Owen`, async () => {
    await owen_brA.topic.assertTranslationLooksOk({
            viewCatsLink: "הצגת קטגוריות", createTopicBtn: "צור נושא" });
  });

  /* Later, with a better analyzer [es_hebrew], can type & search for:
   *  בית (a house)
   *  בבית (in the house)
   *  לבית (to the house)
   *  בבתים (in houses)
   *  לבתים (to houses)
   *
   * See: https://www.elastic.co/search-labs/blog/elasticsearch-lemmatization-hebrew-analyzer
   */

  it(`Owen creates topics about רוח — means 'wind'`, async () => {
    await owen_brA.complex.createAndSaveTopic({
            title: "רוח", body: "Means 'wind'." });
    await owen_brA.back();
    await owen_brA.complex.createAndSaveTopic({
            title: "הרוח", body: "Means 'The wind'." });
    await owen_brA.complex.replyToOrigPost(
          "ר = the letter Resh, the first letter in 'wind'.");
  });

  it(`... and some text in Swedish about "${c.wow.älgar}" (means "elks")`, async () => {
    await owen_brA.back();
    await owen_brA.complex.createAndSaveTopic(
            c.wow.Angående_älgar_Älgar_älskar_äta_ärtor);
  });

  it(`Maria sees the forum`, async () => {
    await maria_brB.go2(siteUrl);
    await maria_brB.assertPageTitleMatches(forumTitle);
    await maria_brB.disableRateLimits();
  });

  it(`... buttons are in Hebrew, for Maria too`, async () => {
    await maria_brB.topic.assertTranslationLooksOk({
            viewCatsLink: "הצגת קטגוריות", createTopicBtn: "צור נושא" });
  });

  it(`Searching in Hebrew for 'הרוח' ('the wind') ...`, async () => {
    await maria_brB.topbar.searchFor("הרוח");
  });
  it(`... finds that word, but not 'wind' — analyzer not good enough [es_hebrew]`, async () => {
    await maria_brB.searchResultsPage.assertResultLinksAre([
          '/-12',
          ], { countTitleLinks: true });
  });

  it(`Likewise, searching for 'רוח' ('wind')`, async () => {
    await maria_brB.searchResultsPage.searchForWaitForResults("רוח");
  });
  it(`... finds that word but not 'הרוח' ('the wind')`, async () => {
    await maria_brB.searchResultsPage.assertResultLinksAre([
          '/-11',
          ], { countTitleLinks: true });
  });

  it(`... Searching for Swedish words: "${c.wow.älgen}" doesn't work  [es_swedish_search]`,
          async () => {
    await maria_brB.searchResultsPage.searchForWaitForResults(c.wow.älgen);
  });
  it(`... finds nothing — but would have found "${c.wow.älgar}" with a Swedish analyzer`,
          async () => {
    await maria_brB.searchResultsPage.assertPhraseNotFound(c.wow.älgen);
  });

  it(`... Searching for exact Swedish words: "${c.wow.älgar}"`, async () => {
    await maria_brB.searchResultsPage.searchForWaitForResults(c.wow.älgar);
  });
  it(`... works though: finds the "Angående ${c.wow.älgar}" page`, async () => {
    await maria_brB.searchResultsPage.assertResultLinksAre([
          '/-13/angaende-algar',
          ], { countTitleLinks: true });
  });

});

