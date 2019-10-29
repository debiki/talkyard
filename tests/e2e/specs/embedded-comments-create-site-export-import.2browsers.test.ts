/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import { execSync} from 'child_process';
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pages = require('../utils/pages');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

// s/wdio target/e2e/wdio.2chrome.conf.js  --only embedded-comments-create-site-export-import.2browsers   --da

declare let browser: any;
declare let browserA: any;
declare let browserB: any;

let everyonesBrowsers;
let owen;
let owensBrowser;
let maria;
let mariasBrowser;
let strangersBrowser;

let data;
let idAddress: IdAddress;
let siteId: any;
let talkyardSiteOrigin: string;

const mariasReplyOne = 'mariasReplyOne';
const mariasReplyTwoWithImage = 'mariasReplyTwoWithImage';
const owensReplyToMaria = 'owensReplyToMaria';


const dirPath = 'target'; //  doesn't work:   target/e2e-emb' — why not.

// dupl code! [5GKWXT20]

describe("embedded comments, new site, import Disqus comments  TyT5KFG0P75", () => {

  if (settings.prod) {
    console.log("Skipping this spec — the server needs to have upsert conf vals enabled."); // E2EBUG
    return;
  }

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    owensBrowser = _.assign(browserA, pagesFor(browserA));
    mariasBrowser = _.assign(browserB, pagesFor(browserB));
    strangersBrowser = mariasBrowser;
    owen = make.memberOwenOwner();
    maria = make.memberMaria();
  });


  function createPasswordTestData() {
    const testId = utils.generateTestId();
    const embeddingHostPort = `test--emeximp-${testId}.localhost:8080`;
    const localHostname     = `test--emeximp-${testId}-localhost-8080`;
    //const localHostname = settings.localHostname ||
    //  settings.testLocalHostnamePrefix + 'create-site-' + testId;
    return {
      testId: testId,
      embeddingUrl: `http://${embeddingHostPort}/`,
      origin: `http://comments-for-${localHostname}.localhost`,
      orgName: "E2E Emb Exp Imp",
      fullName: 'E2E Emb Exp Imp ' + testId,
      email: settings.testEmailAddressPrefix + testId + '@example.com',
      username: 'owen_owner',
      password: 'publ-ow020',
    }
  }

  it('Owen creates an embedded comments site as a Password user  @login @password', () => {
    data = createPasswordTestData();
    owensBrowser.go(utils.makeCreateEmbeddedSiteWithFakeIpUrl());
    owensBrowser.disableRateLimits();
    owensBrowser.createSite.fillInFieldsAndSubmit(data);
    // New site; disable rate limits here too.
    owensBrowser.disableRateLimits();

    owensBrowser.createSite.clickOwnerSignupButton();
    owensBrowser.loginDialog.createPasswordAccount(data, true);
    siteId = owensBrowser.getSiteId();
    const email = server.getLastEmailSenTo(siteId, data.email, owensBrowser);
    const link = utils.findFirstLinkToUrlIn(
        data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    owensBrowser.go(link);
    owensBrowser.waitAndClick('#e2eContinue');
    talkyardSiteOrigin = owensBrowser.origin();
  });


  // ----- Prepare: Create embedding pages and API secret

  it("Owen clicks Blog = Something Else, to show the instructions", () => {
    // ?? why this needed although didn' do; browser.tour.runToursAlthoughE2eTest() ??
    owensBrowser.tour.exitTour();

    owensBrowser.waitAndClick('.e_SthElseB');
  });


  const twoRepliesPageSlug = 'impexp-two-replies';
  const replyWithImagePageSlug = 'impexp-reply-w-image';
  const onlyLikeVotePageSlug = 'impexp-like-vote';
  const onlySubscrNotfsPageSlug = 'impexp-subscr-notfs';

  it("He creates some embedding pages", () => {
    makeEmbeddingPage(twoRepliesPageSlug);
    makeEmbeddingPage(replyWithImagePageSlug);
    makeEmbeddingPage(onlyLikeVotePageSlug);
    makeEmbeddingPage(onlySubscrNotfsPageSlug);
  });


  function makeEmbeddingPage(urlPath: string, discussionId?: string) {
    // Dupl code [046KWESJJLI3].
    owensBrowser.waitForVisible('#e_EmbCmtsHtml');
    let htmlToPaste = owensBrowser.getText('#e_EmbCmtsHtml');
    if (discussionId) {
      htmlToPaste = htmlToPaste.replace(
          ` data-discussion-id=""`, ` data-discussion-id="${discussionId}"`)
    }
    fs.writeFileSync(`${dirPath}/${urlPath}.html`, `
<html>
<head>
<title>Embedded comments E2E test: Creating, exporting and importing a site</title>
</head>
<body style="background: #a359fc; color: #000; font-family: monospace; font-weight: bold">
<p>Embedded comments E2E test page, for testing site export and import.
  Ok to delete. 603AKDLRK398.<br>
URL path: ${urlPath}<br>
Discussion id: ${discussionId ? `"${discussionId}"` : '(none)'}<br>
The comments:</p>
<hr>
${htmlToPaste}
<hr>
<p>/End of page.</p>
</body>
</html>`);
  };


  // ----- Create things to export

  it(`Maria goes to ${twoRepliesPageSlug}`, () => {
    mariasBrowser.go(data.embeddingUrl + twoRepliesPageSlug);
    mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("Maria posts a comment", () => {
    mariasBrowser.complex.replyToEmbeddingBlogPost(mariasReplyOne,
        { signUpWithPaswordAfterAs: maria, needVerifyEmail: false });
  });

  it("... Owen posts a reply", () => {
    owensBrowser.go(data.embeddingUrl + twoRepliesPageSlug);
    owensBrowser.topic.refreshUntilPostAppears(c.FirstReplyNr, { isEmbedded: true });
    owensBrowser.complex.replyToPostNr(c.FirstReplyNr, owensReplyToMaria, { isEmbedded: true });
  });

  it(`Maria goes to ${replyWithImagePageSlug}`, () => {
    mariasBrowser.go(data.embeddingUrl + replyWithImagePageSlug);
    mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... posts a comment with an image", () => {
    // TESTS_MISSING
    mariasBrowser.complex.replyToEmbeddingBlogPost(mariasReplyTwoWithImage);
  });

  it(`Maria goes to ${onlyLikeVotePageSlug}`, () => {
    mariasBrowser.go(data.embeddingUrl + onlyLikeVotePageSlug);
    mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... Like-votes the blog post", () => {
    // This tests export & import of an empty page, except for the Like vote.
    mariasBrowser.topic.clickLikeVoteForBlogPost();
  });

  it(`Maria goes to ${onlySubscrNotfsPageSlug}`, () => {
    mariasBrowser.go(data.embeddingUrl + onlySubscrNotfsPageSlug);
    mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... subscribes to new comments", () => {
    // This tests export & import of an empty page — there's just the new-replies subscription.
    mariasBrowser.metabar.setPageNotfLevel(c.TestPageNotfLevel.EveryPost);
  });


  // ----- Export site

  it("Exports the site as json", () => {
    owensBrowser.go(talkyardSiteOrigin + '/-/export-site-json');
  });

  let jsonDump: any;

  it("Can parse the exported json into a js obj", () => {
    // The browser wraps the json response in a <html><body><pre> tag. At least Chrome does.
    const jsonDumpStr = owensBrowser.getText('pre');
    jsonDump = JSON.parse(jsonDumpStr);
    console.log("JSON: " + JSON.stringify(jsonDump, null, 2));
settings.debugEachStep=true;
  });

  let response: IdAddress;


  // ----- Imoprts the site, to a new site

  it("Imports the site", () => {
    response = server.importRealSiteData(jsonDump);
    console.log("Import site response: " + JSON.stringify(response));
  });

  it("Owen goes to the re-imported site", () => {
    owensBrowser.go(response.origin || response.siteIdOrigin);
  });

  it("... logs in", () => {
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    //owensBrowser.complex.loginWithPasswordViaMetabar(owen);
  });

  testContentsLookOk();


  // ----- Imoprts the site, as a patch, to an already existing embedded comments site

  it("Owen creates a 2nd embedded comments site", () => {
    data = createPasswordTestData();
    owensBrowser.go(utils.makeCreateEmbeddedSiteWithFakeIpUrl());
    owensBrowser.disableRateLimits();
    owensBrowser.createSite.fillInFieldsAndSubmit(data);
    // New site; disable rate limits here too.
    owensBrowser.disableRateLimits();

    owensBrowser.createSite.clickOwnerSignupButton();
    owensBrowser.loginDialog.createPasswordAccount(data, true);
    siteId = owensBrowser.getSiteId();
    const email = server.getLastEmailSenTo(siteId, data.email, owensBrowser);
    const link = utils.findFirstLinkToUrlIn(
        data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    owensBrowser.go(link);
    owensBrowser.waitAndClick('#e2eContinue');
    talkyardSiteOrigin = owensBrowser.origin();
  });

  // save to file,
  // [Import] btn somewhere in adm interface, but where??

  // postCommentsToTalkyard(talkyardPatchFilePath);
  /*
function postOrDie(url, data, opts: { apiUserId?: number, apiSecret?: string,
      retryIfXsrfTokenExpired?: Boolean } = {}): { statusCode: number, headers, bodyJson } {
  */

  testContentsLookOk();


  // ----- Imoprts the site, as a patch, to an already existing forum site

  testContentsLookOk();

  function testContentsLookOk() {

  }


/*
  // ----- Comments appear?

  it("Maria goes to the one-imported-reply page", () => {
mariasBrowser.debug();
    mariasBrowser.go('/' + replyWithImagePageUrlPath)
  });

  it("... there's no discussion id on this page", () => {
    const source = mariasBrowser.getSource();
    assert(source.indexOf(onlyLikeVotePageUrlPath) === -1);
    assert(source.indexOf('data-discussion-id=""') >= 0);
  });

  it("... and sees a comment, imported from Disqus " +
        "— matched by url path, althoug origins differ", () => {
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    mariasBrowser.topic.assertNumRepliesVisible(1);
  });

  it("... with the correct text", () => {
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, '...');
  });

  it("She can post a reply", () => {
    mariasBrowser.complex.replyToPostNr(
        c.FirstReplyNr, '...', { isEmbedded: true });
    mariasBrowser.topic.waitForPostAssertTextMatches(
        c.FirstReplyNr + 1, '...');
  });

  it("... the reply is there after page reload", () => {
    mariasBrowser.refresh();
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForPostAssertTextMatches(
        c.FirstReplyNr + 1, '...');
  });

  it("... the comment author (a guest user) gets a reply notf email", () => {
    //server.waitUntilLastEmailMatches(
    //    siteId, year2030AuthorEmail, [mariasReplyThreeToImportedComment], mariasBrowser);
  });

  it("Owen replies to Maria", () => {
    owensBrowser.go(data.embeddingUrl + replyWithImagePageUrlPath)
    owensBrowser.complex.replyToPostNr(
        c.FirstReplyNr + 1, owensReplyToMaria, { isEmbedded: true });
  });

  it("Owen replies to the orig post on the image page", () => {
  });

  it("Owen posts the first comment on the page Maria subscribed to", () => {
  });

  //  —> notf about reply, & page subsr to, but not the comment on the images page.

  function checkSantaSailingPageAfterDisqusImportNr(importNr: number) {
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, mariasReplyOne);
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 1, mariasReplyTwoWithImage);
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 2, "a Santa Sailing Ship");
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 3, "reach the escape velocity");
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 4, "in a way surprising");
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr + 5, "tried using the pets");
  }


  // ----- Importing the same thing many times

  it("Owen re-imports the same Disqus comments, again", () => {
    postCommentsToTalkyard(talkyardPatchFilePath);
  });

  it("Maria refreshes the page", () => {
    mariasBrowser.refresh();
    mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... nothing has changed — there are no duplicated Disqus comments", () => {
    checkCatsAndMilkPageAfterDisqusImportNr(2);
  });

  it("She goes to the santa sailing page", () => {
    mariasBrowser.go(data.embeddingUrl + twoRepliesPageUrlPath)
    mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... it also didn't change after the re-import", () => {
    checkSantaSailingPageAfterDisqusImportNr(2);
  });


  // ----- Importing the same thing plus **more** things

  it(`Owen generates a new Disqus export file, with even more contents`, () => {
    createDisqusXmlDumpFile({ withExtraComments: true, dst: disqusXmlDumpFilePath2 });
  });

  it(`... and converts to Talkyard format: ${talkyardPatchFilePath2}`, () => {
    convertDisqusFileToTalkyardFile(disqusXmlDumpFilePath2, talkyardPatchFilePath2);
  });

  it("Owen re-imports the Disqus comments, with an extra comment and a new page!! wow!", () => {
    postCommentsToTalkyard(talkyardPatchFilePath2);
  });

  it("Maria returns to the cat and milk page", () => {
    mariasBrowser.go('/' + replyWithImagePageUrlPath)
    mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... and sees 5 comments: 1 + 1 new, from Disqus, her 1, and Owen's 2", () => {
    checkCatsAndMilkPageAfterDisqusImportNr(3);
  });

  it("But on the santa sailing page ...", () => {
    mariasBrowser.go(data.embeddingUrl + twoRepliesPageUrlPath);
    mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... nothing has changed", () => {
    checkSantaSailingPageAfterDisqusImportNr(3);
  });

  it("Maria goes to a page created later", () => {
    mariasBrowser.go('/' + pageCreatedLaterUrlPath)
    mariasBrowser.switchToEmbeddedCommentsIrame();
  });

  it("... and sees one comment, impored from Disqus, in the 3rd import run", () => {
    mariasBrowser.topic.waitForPostAssertTextMatches(c.FirstReplyNr, commentOnPageCreatedLaterText);
    mariasBrowser.topic.assertNumRepliesVisible(1);
  });

  it("The empty page is still empty. And will be, til the end of time", () => {
    //server.playTimeMillis(EndOfUniverseMillis - nowMillis() - 1);
    mariasBrowser.go('/' + noDisqusRepliesPageUrlPath)
    mariasBrowser.switchToEmbeddedCommentsIrame();
    mariasBrowser.topic.waitForReplyButtonAssertNoComments();
  });
*/
});

