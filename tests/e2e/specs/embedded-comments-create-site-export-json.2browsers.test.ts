/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');
import * as embPages from './embedded-comments-create-site-export-json.2browsers.pages';

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
let guestsBrowser;
let strangersBrowser;

let data: NewSiteData;
let siteId: any;
let talkyardSiteOrigin: string;


describe("embedded comments export json  TyT7FKDJF3", () => {

  if (settings.prod) {
    console.log("Skipping this spec — the server needs to have upsert conf vals enabled."); // E2EBUG
    return;
  }

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    owensBrowser = _.assign(browserA, pagesFor(browserA));
    mariasBrowser = _.assign(browserB, pagesFor(browserB));
    michaelsBrowser = mariasBrowser;
    strangersBrowser = mariasBrowser;
    guestsBrowser = strangersBrowser;
    owen = make.memberOwenOwner();
    maria = make.memberMaria();
    michael = make.memberMichael();
  });


  it('Owen creates an embedded comments site as a Password user  @login @password', () => {
    const newSiteData: NewSiteData = owensBrowser.makeNewSiteDataForEmbeddedComments({
        shortName: 'emb-exp', longName: "Emb Cmts Exp" });
    const result = owensBrowser.createNewSite(newSiteData);
    data = result.data;
    siteId = result.siteId;
    talkyardSiteOrigin = result.talkyardSiteOrigin;
  });


  // ----- Prepare: Create embedding pages and API secret

  it("Owen clicks Blog = Something Else, to show the instructions", () => {
    owensBrowser.waitAndClick('.e_SthElseB');
  });


  it("He creates some embedding pages", () => {
    embPages.createEmbeddingPages(owensBrowser);
  });


  // ----- Create things to export

  it(`A stranger goes to ${embPages.slugs.guestReplyPageSlug}`, () => {
    strangersBrowser.go(data.embeddingUrl + embPages.slugs.guestReplyPageSlug);
  });

  it("... posts a comment", () => {
    // Dupl code 0. [60290KWFUDTT]
    guestsBrowser.switchToEmbeddedCommentsIrame();
    guestsBrowser.topic.clickReplyToEmbeddingBlogPost();
    guestsBrowser.switchToEmbeddedEditorIrame();
    guestsBrowser.editor.editText(embPages.texts.guestsReply);
    guestsBrowser.editor.save();
  });

  it("... logs in as Garbo Guest", () => {
    // Dupl code 1. [60290KWFUDTT]
    guestsBrowser.swithToOtherTabOrWindow();
    guestsBrowser.disableRateLimits();
    guestsBrowser.loginDialog.signUpLogInAs_Real_Guest(
        embPages.texts.guestsName, embPages.texts.guestsEmail);
    guestsBrowser.switchBackToFirstTabOrWindow();
  });

  it("... the comment appears", () => {
    // Dupl code 2. [60290KWFUDTT]
    guestsBrowser.switchToEmbeddedCommentsIrame();
    guestsBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    guestsBrowser.topic.assertPostTextMatches(c.FirstReplyNr, embPages.texts.guestsReply);
  });

  it("... the guest leaves", () => {
    guestsBrowser.metabar.clickLogout();
  });

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
    owensBrowser.topic.refreshUntilPostNrAppears(c.FirstReplyNr, { isEmbedded: true });
    owensBrowser.complex.flagPost(c.FirstReplyNr, 'Inapt');
  });

  it("... and posts a reply, @mentions both Michael and Maria", () => {
    owensBrowser.complex.replyToEmbeddingBlogPost(embPages.texts.owensReplyMentionsMariaMichael);
  });

  it(`Maria gets a reply notf email, Michael doesn't (didn't verify his email)`, () => {
    server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, embPages.texts.owensReplyMentionsMariaMichael, mariasBrowser);
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
    // TESTS_MISSING: no image uploaded [402KGS4RQ]
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
    owensBrowser.waitForVisible('.e_DnlBkp');
    const downloadAttr = owensBrowser.$('.e_DnlBkp').getAttribute('download');
    assert(_.isString(downloadAttr)); // but not null
    const wrongAttr = owensBrowser.$('.e_DnlBkp').getAttribute('download-wrong');
    assert(!_.isString(wrongAttr)); // tests the test

    // Don't know how to choose where to save the file, so instead, open the json 
    // directly in the browser:
    const downloadUrl = owensBrowser.$('.e_DnlBkp').getAttribute('href');
    owensBrowser.go(downloadUrl);
  });


  let jsonDumpStr: string;

  it("Can parse the exported json into a js obj", () => {
    let dummy;
    [jsonDumpStr, dummy] = owensBrowser.getWholePageJsonStrAndObj();
  });

  it("Saves the dump, here:\n\n      " + c.EmbCommentsJsonExport + "\n", () => {
    fs.writeFileSync(c.EmbCommentsJsonExport, jsonDumpStr);
  });


});

