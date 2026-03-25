/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
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

const forumTitle = "Forum in sv_SE";
const testId = utils.generateTestId();
let siteId: SiteId;
let siteUrl: St;

const Äga_ett_mål = "Äga ett mål";
const Man_får_inte_använda_hönor_som_fotboll = "Man får inte använda hönor som fotboll";
const höns = "höns";
const hönor = "hönor";

// The leftmost words do *not* work well w the Swedish analyzer, which thinks 'û' != 'u',
// 'à' != 'a', 'ø' != 'o' etc, so it's hard to type & find those letters
// on a Swedish keyboard (or English or Finnish etc kbd for that matter).
//
// But the icu_analyzer simplifies 'ûàø' to 'uao' etc, making it simpler to search
// and find something. But it's not good at any specific language — that's why
// we're indexing with both the icu_analyzer and language specific analyzers,
// see: [multilingual_mapping].
//
const variousLanguages = [
        `Août — August, in French`,
        `Università — University, Italian`,
        `Smørrebrød — sandwitch, Danish`,
        `Fußball — soccer, German`,
        `Piñata — Spanish`];

const variousLanguagesSearch =
        `Août Università Smørrebrød Fußball Piñata`;

// E.g. 'u' instead of 'û',  'o' not 'ø',  'ss' not 'ß'.
const variousLanguagesNearbySearch =
        `Aout Universita Smorrebrod Fussball Pinata`;

const variousLangHits = [
          '/-13/various-languages',         // Août — August, in French
          '/-13/various-languages#post-2',  // Università — University, Italian
          '/-13/various-languages#post-3',  // Smørrebrød — sandwitch, Danish
          '/-13/various-languages#post-4',  // Fußball — soccer, German
          '/-13/various-languages#post-5',  // Piñata — Spanish
          ];

// Sandwitch (in Danish), highlighted. Note: There's 2 'ø' not any 'o'.
const smørrebrødMarked = '<mark>Smørrebrød</mark>';
// Sandwitch with 'o' instead of 'ø'.
const smorrebrod = 'smorrebrod';

/* First I tried to use _Korean_and_Chinese to test the icu_analyzer, but these
   words works with the Swedish analyzer too! If you index & search in Swedish, you
   can find thanksInKorean, so can't use this to try out the univ_icu field.
   Searching for just "hello" (in Korean) doesn't work — the Swedish analyzer doesn't
   see it's part of "hello world".
   But this didn't work with the icu_analyzer either! Probably works with the
   Korean 'nori' analyzer?
const helloInKorean      = '안녕하세요';
const helloWorldInKorean = '안녕하세요세상';  // note: no space between hello & world
const thanksInKorean     = '감사합니다';
const thanksGoodbyeInChinese = '谢谢，再见'   // note: no space (!), it's a Chinese comma
*/


describe(`create-site-lang-sv_SE.2br.f  TyTE_NEWF_LANG_SV_SE.TyTMULTILING_SEARCH`, () => {

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

  it(`Owen creates a site, in Swedish`, async () => {
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
      langName: 'Swedish',
      fullName: 'E2E Test Swedish ' + testId,
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

  it(`... buttons are in Swedish, for Owen`, async () => {
    await owen_brA.topic.assertTranslationLooksOk({
        viewCatsLink: "Visa kategorier", createTopicBtn: "Skapa Ämne" });
  });

  it(`Owen educates everyone about elks, life and soccer`, async () => {
    await owen_brA.complex.createAndSaveTopic(
            c.wow.Angående_älgar_Älgar_älskar_äta_ärtor);
    await owen_brA.back();
    await owen_brA.complex.createAndSaveTopic({
            title: Äga_ett_mål, body: Man_får_inte_använda_hönor_som_fotboll });

    // Can also try this:
    // "Måla en kö" (till biljard) != "mala en ko".
    // "Älgen, skogens konung"     != "Algen, skogens konung"
  });

  it(`Owen creates a page with random words in various languages`, async () => {
    await owen_brA.back();
    await owen_brA.complex.createAndSaveTopic({
            title: "Various languages", body: variousLanguages[0] });
    for (let line of variousLanguages.slice(1)) {
      await owen_brA.complex.replyToOrigPost(line);
    }
  });

  /* _Korean_and_Chinese
  it(`Owen says "hello world" and "thanks" in Korean: ${helloWorldInKorean} ${thanksInKorean}`,
          async () => {
    await owen_brA.back();
    await owen_brA.complex.createAndSaveTopic({
            title: "Hello and Thanks in Korean", body: `${helloWorldInKorean} ${thanksInKorean}` });
  });

  it(`Owen says Thanks, Goodbye in Simplified Chinese: `,
          async () => {
    await owen_brA.back();
    await owen_brA.complex.createAndSaveTopic({
            title: "Thanks, Goodbye in Chinese", body: `${thanksGoodbyeInChinese}` });
  }); */

  it(`Maria sees the forum`, async () => {
    await maria_brB.go2(siteUrl);
    await maria_brB.assertPageTitleMatches(forumTitle);
    await maria_brB.disableRateLimits();
  });

  it(`... buttons are in Swedish, for Maria too`, async () => {
    await maria_brB.topic.assertTranslationLooksOk({
        viewCatsLink: "Visa kategorier", createTopicBtn: "Skapa Ämne" });
  });

  it(`Searching for ${c.wow.älgen} ... [es_swedish_search]`, async () => {
    // Don't want any accidental direct match.
    const älgen = c.wow.älgen.toLowerCase();
    assert.excludes(c.wow.Angående_älgar_Älgar_älskar_äta_ärtor.title.toLowerCase(), älgen);
    assert.excludes(c.wow.Angående_älgar_Älgar_älskar_äta_ärtor.body.toLowerCase(), älgen);

    await maria_brB.topbar.searchFor(c.wow.älgen);  // the page title is "Älgar" not "älgen"
  });
  it(`... finds similar Swedish words: "${c.wow.älgar}" on the elk page`, async () => {
    await maria_brB.searchResultsPage.assertResultLinksAre([
          '/-11/angaende-algar',
          ], { countTitleLinks: true });
  });

  it(`Searching for more Swedish words: "${höns}"`, async () => {
    // Don't want any accidental direct match.
    assert.excludes(Man_får_inte_använda_hönor_som_fotboll.toLowerCase(), höns);
    // This is what we'll find:
    assert.includes(Man_får_inte_använda_hönor_som_fotboll.toLowerCase(), hönor);

    await maria_brB.searchResultsPage.searchForWaitForResults(höns); // but the text is "hönor"
  });
  it(`... finds the soccer page with the text "${hönor}"`, async () => {
    await maria_brB.searchResultsPage.assertResultLinksAre([
          '/-12/aga-ett-mal',
          ], { countTitleLinks: true });
  });

  it(`... Searching for more Swedish words: "fåren" = "får" + "en"`, async () => {
    // "får" + "en" = "fåren" will find "får", because ElasticSearch's Swedish analyzer knows
    // it's the same base word.  But "som" + "en" will *not* find "som". [fåren_vs_somen] 
    //
    // However, ElasticSearch's Swedish analyzer doesn't seem to realize that "får" here is
    // a verb ("får" means "may", "is allowed to") not a subject ("får" = "sheep", the animal).
    // Oh well.
    // (You can't append "en" to the verb, only to the subject.)
    //
    await maria_brB.searchResultsPage.searchForWaitForResults("fåren"); // but the text is "får"
  });
  it(`... finds the soccer page with the word "får" (incorrectly)`, async () => {
    await maria_brB.searchResultsPage.assertResultLinksAre([
          '/-12/aga-ett-mal',
          ], { countTitleLinks: true });
  });

  it(`... Searching for *not* Swedish words doesn't work: "somen" = "som" + "en"`, async () => {
    // "som" + "en" will *not* find "som". [fåren_vs_somen] 
    const som = "som";
    assert.includes(Man_får_inte_använda_hönor_som_fotboll, som);
    await maria_brB.searchResultsPage.searchForWaitForResults(som + "en");
  });
  it(`... does Not find the soccer page with the word "som"`, async () => {
    await maria_brB.searchResultsPage.assertPhraseNotFound("somen");
  });

  it(`Using 'aao' instead of 'åäö' when searching, works,
              thanks to our universal fallback field, univ_icu`, async () => {
    await maria_brB.searchResultsPage.searchForWaitForResults(c.wow.algar_flojt_vaghorn);
  });
  it(`... finds "${c.wow.älgar_flöjt_våghorn}" because of the univ_icu fallback`, async () => {
    await maria_brB.searchResultsPage.assertResultLinksAre([
          '/-11/angaende-algar',
          ], { countTitleLinks: true });
  });

  it(`Using 'aao' works in other languages too,
              again thanks to our universal fallback field, univ_icu`, async () => {
    // Note: the `...NearbySearch`, uses 'aou' etc instead of the exact correct chars.
    await maria_brB.searchResultsPage.searchForWaitForResults(variousLanguagesNearbySearch);
  });
  it(`... finds all words in the different languages`, async () => {
    await maria_brB.searchResultsPage.assertResultLinksAre(
            variousLangHits, { countTitleLinks: true, anyOrder: true });
  });

  /* _Korean_and_Chinese: Oh, this works anyway also w/o univ_icu, so doesn't test anything.
  it(`... so does searching for Korean, thanks to the univ_icu fallback (??)`, async () => {
    await maria_brB.searchResultsPage.searchForWaitForResults(helloInKorean); //thanksInKorean);
  });
  it(`... finds the Korean page`, async () => {
    await maria_brB.searchResultsPage.assertResultLinksAre([
          '/-13/hello-and-thanks-in-korean',
          ], { countTitleLinks: true });
  }); */

  it(`... But with the universal fallback disabled`, async () => {
    // [es_toggle_univ_icu]
    const url = await maria_brB.getUrl();
    await maria_brB.go2(url + '&univ=false');
    await maria_brB.searchResultsPage.waitForResults(variousLanguagesNearbySearch);
  });
  it(`... finds nothing`, async () => {
    await maria_brB.searchResultsPage.assertPhraseNotFound(variousLanguagesNearbySearch);
  });

  it(`... however, using the correct 'åäö' letters works  (also w/o univ_icu)`, async () => {
    await maria_brB.searchResultsPage.searchForWaitForResults(variousLanguagesSearch);
  });
  it(`... finds the words in different languages`, async () => {
    await maria_brB.searchResultsPage.assertResultLinksAre(
            variousLangHits, { countTitleLinks: true, anyOrder: true });
  });

  it(`... searching in Swedish using the correct 'åäö' letters also works  (w/o univ_icu)`,
          async () => {
    await maria_brB.searchResultsPage.searchForWaitForResults(c.wow.älgar_flöjt_våghorn);
  });
  it(`... finds the elks page again`, async () => {
    await maria_brB.searchResultsPage.assertResultLinksAre([
          '/-11/angaende-algar',
          ], { countTitleLinks: true });
  });

  const nearbyAllLangs = `${variousLanguagesNearbySearch} ${c.wow.algar_flojt_vaghorn}`;

  it(`Double checking that "nearby" search doesn't work, w/o universal fallback`, async () => {
    // Nice to do this using the Search button too, not the `go2(...&univ=true)` "hack".
    await maria_brB.searchResultsPage.searchForWaitForResults(nearbyAllLangs);
  });
  it(`... finds nothing`, async () => {
    await maria_brB.searchResultsPage.assertPhraseNotFound(nearbyAllLangs);
  });

  it(`... But with the universal fallback enabled again`, async () => {
    // [es_toggle_univ_icu]
    const url = await maria_brB.getUrl();
    const url2 = url.replace('&univ=false', '');
    await maria_brB.go2(url2);
    await maria_brB.searchResultsPage.waitForResults(nearbyAllLangs);
  });
  it(`... finds everything, when "nearby" searching`, async () => {
    await maria_brB.searchResultsPage.assertResultLinksAre([
            // First, since many words match in this post.
            '/-11/angaende-algar',
            // Just one matche in each post.
            ...variousLangHits],
            { countTitleLinks: true, anyOrder: true });
  });


  // ----- Same language has priority

  // Verify that exact matches, e.g.  'sandwitch', has priority over/ "nearby" matches
  // like 'smorrebrod' with 'o' not 'ø'.
  //
  // Here, 'sandwitch' hits the Swedish language field, 'se', while 'smorrebrod' hits
  // the 'univ_icu' field indexed w the icu_analyzer.
  //
  // We've configured ElasticSearch to prioritize language specific fields ('sv'),
  // see [boost_lang_fields].
  // So when searching for and hitting both 'sandwitch' and 'smorrebrod' — but
  // in different fields: 'se' and 'univ_icu', ElasticSearch will pick 'sandwitch'
  // not 'Smørrebrød'.
  //

  it(`Same-language hits are prioritized over "nearby" hits.
          First, double check that "nearby" works: "smorrebrod"  ('o' not 'ø')`,
          async () => {
    await maria_brB.searchResultsPage.searchForWaitForResults(smorrebrod);
  });
  it(`... finds the "Smørrebrød" comment`, async () => {
    await maria_brB.searchResultsPage.assertResultLinksAre([
          '/-13/various-languages#post-3',  // Smørrebrød — sandwitch, Danish
          ]);
  });
  it(`... "Smørrebrød" is highlighted`, async () => {
    const html = await maria_brB.waitAndGetVisibleHtml('.c_SR_Hit_Text');
    assert.includes(html, smørrebrødMarked);
  });
  it(`... only "Smørrebrød" nothing else`, async () => {
    const markedText = await maria_brB.waitAndGetVisibleText('mark');
    assert.eq(markedText, 'Smørrebrød');
  });
  it(`... but if searching for "sandwitch" at the same time`,
          async () => {
    // Both "smorrebrod" and "sandwitch".
    await maria_brB.searchResultsPage.searchForWaitForResults(smorrebrod + " sandwitch");
  });
  it(`... we've configured ElasticSearch to prioritize the language specific field,
            'sv' in this case (Swedish). We find the comment, ...`,
            async () => {
    await maria_brB.searchResultsPage.assertResultLinksAre([
          '/-13/various-languages#post-3',  // Smørrebrød — sandwitch, Danish
          ]);
  });
  it(`... and "sandwitch", not "Smørrebrød", is highlighted`, async () => {
    const html = await maria_brB.waitAndGetVisibleHtml('.c_SR_Hit_Text');
    assert.excludes(html, smørrebrødMarked);
    assert.includes(html, "<mark>sandwitch</mark>");
  });
  it(`... really only "sandwitch" is highlighted`, async () => {
    const markedText = await maria_brB.waitAndGetVisibleText('mark');
    assert.eq(markedText, 'sandwitch');
  });

});

