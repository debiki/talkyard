/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import { execSync } from 'child_process';
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pages = require('../utils/pages');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');
import * as embPages from './embedded-comments-create-site-export-json.2browsers.pages';

// s/wdio target/e2e/wdio.2chrome.conf.js  --only embedded-comments-create-site-export-import.2browsers   --da

declare let browser: any;
declare let browserA: any;
declare let browserB: any;

let everyonesBrowsers;
let owen;
let owensBrowser;
let maria: Member;
let mariasBrowser;
let michael: Member;
let michaelsBrowser;
let strangersBrowser;

let data;
let idAddress: IdAddress;
let siteId: any;
let talkyardSiteOrigin: string;


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
    michaelsBrowser = _.assign(browserB, pagesFor(browserB));
    strangersBrowser = mariasBrowser;
    owen = make.memberOwenOwner();
    maria = make.memberMaria();
    michael = make.memberMichael();
  });


  it('Owen creates an embedded comments site as a Password user  @login @password', () => {
    const result = owensBrowser.createSiteAsOwen({
        shortName: 'emb-exp', longName: "Emb Cmts Exp"});
    data = result.data;
    siteId = result.siteId;
    talkyardSiteOrigin = result.talkyardSiteOrigin;
  });


  // ----- Prepare: Create embedding pages and API secret

  it("Owen clicks Blog = Something Else, to show the instructions", () => {
    // ?? why this needed although didn' do; browser.tour.runToursAlthoughE2eTest() ?? [306MKP67]
    owensBrowser.tour.exitTour();

    owensBrowser.waitAndClick('.e_SthElseB');
  });


  it("He creates some embedding pages", () => {
    embPages.createEmbeddingPages(owensBrowser);
  });


  // ----- Create things to export

  it(`Michael goes to ${embPages.slugs.threeRepliesPageSlug}`, () => {
    michaelsBrowser.go(data.embeddingUrl + embPages.slugs.threeRepliesPageSlug);
    michaelsBrowser.switchToEmbeddedCommentsIrame();
  });

  it("Michael posts a comment, does *not* verify his email address", () => {
    michaelsBrowser.complex.replyToEmbeddingBlogPost(embPages.texts.michaelsReply,
      { signUpWithPaswordAfterAs: michael, needVerifyEmail: false });
  });

  it("Michael leaves", () => {
    michaelsBrowser.metabar.clickLogout();
  });

  it("Maria posts a comment", () => {
    mariasBrowser.complex.replyToEmbeddingBlogPost(embPages.texts.mariasReplyOne,
      { signUpWithPaswordAfterAs: maria, needVerifyEmail: false });
  });

  it("... and *does* verify her email address", () => {
    const link = server.getLastVerifyEmailAddressLinkEmailedTo(
        siteId, maria.emailAddress, mariasBrowser);
    mariasBrowser.go2(link);
  });

  it("Maria and Michael got 1 emails each: the verif-addr email", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), 1);
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), 1);
  });

  it("Owen flags Michael's reply", () => {
    owensBrowser.go(data.embeddingUrl + embPages.slugs.threeRepliesPageSlug);
    owensBrowser.topic.refreshUntilPostAppears(c.FirstReplyNr, { isEmbedded: true });
    owensBrowser.complex.flagPost(c.FirstReplyNr, 'Inapt');
  });

  it("... and posts a reply, @mentions both Michael and Maria", () => {
    owensBrowser.complex.replyToEmbeddingBlogPost(embPages.texts.owensReplyMentiosMariaMichael);
  });

  it(`Maria gets a reply notf email, Michael doesn't (didn't verify his email)`, () => {
    server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, embPages.texts.owensReplyMentiosMariaMichael, mariasBrowser);
    // Email addr verif email + reply notf = 2.
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), 2);
  });

  it("... but Michal got no more emails", () => {
    // Email addr verif email + *no* reply notf = 1.
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), 1);
  });

  it(`Maria goes to ${embPages.slugs.replyWithImagePageSlug}`, () => {
    mariasBrowser.go2(data.embeddingUrl + embPages.slugs.replyWithImagePageSlug);
  });

  it("... posts a comment with an image", () => {
    // TESTS_MISSING
    mariasBrowser.complex.replyToEmbeddingBlogPost(embPages.texts.mariasReplyTwoWithImage);
  });

  it(`Maria goes to ${embPages.slugs.onlyLikeVotePageSlug}`, () => {
    mariasBrowser.go2(data.embeddingUrl + embPages.slugs.onlyLikeVotePageSlug);
  });

  it("... Like-votes the blog post", () => {
    // This tests export & import of an empty page, except for the Like vote.
    mariasBrowser.topic.clickLikeVoteForBlogPost();
  });

  it(`Maria goes to ${embPages.slugs.onlySubscrNotfsPageSlug}`, () => {
    mariasBrowser.go2(data.embeddingUrl + embPages.slugs.onlySubscrNotfsPageSlug);
  });

  it("... subscribes to new comments", () => {
    // This tests export & import of an empty page — there's just the new-replies subscription.
    mariasBrowser.metabar.setPageNotfLevel(c.TestPageNotfLevel.EveryPost);
  });


  // ----- Export site to .json file

  it("Exports the site as json", () => {
    owensBrowser.adminArea.goToBackupsTab(talkyardSiteOrigin);

    // There should be a download file link here.
    const downloadAttr = owensBrowser.getAttribute('.e_DnlBkp', 'download')
    assert(_.isString(downloadAttr)); // but not null
    const wrongAttr = owensBrowser.getAttribute('.e_DnlBkp', 'download-wrong')
    assert(!_.isString(wrongAttr)); // tests the test

    // Don't know how to choose where to save the file, so instead, open the json 
    // directly in the browser:
    const downloadUrl = owensBrowser.getAttribute('.e_DnlBkp', 'href')
    owensBrowser.go(downloadUrl);
  });


  let jsonDumpStr;

  it("Can parse the exported json into a js obj", () => {
    // The browser wraps the json response in a <html><body><pre> tag. At least Chrome does.
    jsonDumpStr = owensBrowser.getText('pre');
    JSON.parse(jsonDumpStr);
  });

  it("Saves the dump, here:\n\n      " + c.EmbCommentsJsonExport + "\n", () => {
    fs.writeFileSync(c.EmbCommentsJsonExport, jsonDumpStr);
  });


});

