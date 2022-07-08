/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
import server from '../utils/server';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import settings from '../utils/settings';
import c from '../test-constants';
import * as embPages from './embcom.expimpjson.test-data';

let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;
let guestsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let data: NewSiteData;
let siteId: SiteId;
let talkyardSiteOrigin: St;


describe(`embedded comments export json  TyT7FKDJF3`, async () => {

  if (settings.prod) {
    console.log("Skipping this spec — the server needs to have upsert conf vals enabled."); // E2EBUG
    return;
  }

  it(`Initialize people`, async () => {
    owensBrowser = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    mariasBrowser = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    michaelsBrowser = mariasBrowser;
    strangersBrowser = mariasBrowser;
    guestsBrowser = strangersBrowser;
    owen = make.memberOwenOwner();
    maria = make.memberMaria();
    michael = make.memberMichael();
  });


  it('Owen creates an embedded comments site as a Password user  @login @password', async () => {
    const newSiteData: NewSiteData = owensBrowser.makeNewSiteDataForEmbeddedComments_sync({
        shortName: 'emb-exp', longName: "Emb Cmts Exp" });
    const result = await owensBrowser.newSite.createNewSite(newSiteData);
    await owensBrowser.newSite.signUpAsOwner(result);
    data = result.data;
    siteId = result.siteId;
    talkyardSiteOrigin = result.talkyardSiteOrigin;
  });


  // ----- Prepare: Create embedding pages and API secret

  it(`Owen clicks Blog = Something Else, to show the instructions`, async () => {
    await owensBrowser.waitAndClick('.e_SthElseB');
  });


  it(`He creates some embedding pages`, async () => {
    await embPages.createEmbeddingPages(owensBrowser);
  });


  // ----- Create things to export

  it(`A stranger goes to ${embPages.slugs.guestReplyPageSlug}`, async () => {
    await strangersBrowser.go(data.embeddingUrl + embPages.slugs.guestReplyPageSlug);
  });

  it(`... posts a comment`, async () => {
    // Dupl code 0. [60290KWFUDTT]
    await guestsBrowser.switchToEmbeddedCommentsIrame();
    await guestsBrowser.topic.clickReplyToEmbeddingBlogPost();
    await guestsBrowser.switchToEmbeddedEditorIrame();
    await guestsBrowser.editor.editText(embPages.texts.guestsReply);
    await guestsBrowser.editor.save();
  });

  it(`... logs in as Garbo Guest`, async () => {
    // Dupl code 1. [60290KWFUDTT]
    await guestsBrowser.swithToOtherTabOrWindow();
    await guestsBrowser.disableRateLimits();
    await guestsBrowser.loginDialog.signUpLogInAs_Real_Guest(
        embPages.texts.guestsName, embPages.texts.guestsEmail);
    await guestsBrowser.switchBackToFirstTabOrWindow();
  });

  it(`... the comment appears`, async () => {
    // Dupl code 2. [60290KWFUDTT]
    await guestsBrowser.switchToEmbeddedCommentsIrame();
    await guestsBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    await guestsBrowser.topic.assertPostTextMatches(c.FirstReplyNr, embPages.texts.guestsReply);
  });

  it(`... the guest leaves`, async () => {
    await guestsBrowser.metabar.clickLogout();
  });

  it(`Michael goes to ${embPages.slugs.threeRepliesPageSlug}`, async () => {
    await michaelsBrowser.go(data.embeddingUrl + embPages.slugs.threeRepliesPageSlug);
    await michaelsBrowser.switchToEmbeddedCommentsIrame();
  });

  it(`Michael posts a comment, does *not* verify his email address`, async () => {
    await michaelsBrowser.complex.replyToEmbeddingBlogPost(embPages.texts.michaelsReply,
      { signUpWithPaswordAfterAs: michael, needVerifyEmail: false });
  });

  it(`Michael leaves`, async () => {
    await michaelsBrowser.metabar.clickLogout();
  });

  it(`Maria posts a comment`, async () => {
    await mariasBrowser.complex.replyToEmbeddingBlogPost(embPages.texts.mariasReplyOne,
      { signUpWithPaswordAfterAs: maria, needVerifyEmail: false });
  });

  it(`... and *does* verify her email address`, async () => {
    const link = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(
        siteId, maria.emailAddress);
    await mariasBrowser.go2(link);
  });

  it(`Maria and Michael got 1 emails each: the verif-addr email`, async () => {
    assert.eq(await server.countLastEmailsSentTo(siteId, michael.emailAddress), 1);
    assert.eq(await server.countLastEmailsSentTo(siteId, maria.emailAddress), 1);
  });

  it(`Owen goes to the blog`, async () => {
    await owensBrowser.go2(data.embeddingUrl + embPages.slugs.threeRepliesPageSlug);
  });

  it(`... Owen needs to login?`, async () => {
    await owensBrowser.complex.loginIfNeededViaMetabar(owen);
  });

  it(`Owen flags Michael's reply`, async () => {
    await owensBrowser.topic.refreshUntilPostNrAppears(c.FirstReplyNr, { isEmbedded: true });
    await owensBrowser.complex.flagPost(c.FirstReplyNr, 'Inapt');
  });

  it(`... and posts a reply, @mentions both Michael and Maria`, async () => {
    await owensBrowser.complex.replyToEmbeddingBlogPost(embPages.texts.owensReplyMentionsMariaMichael);
  });

  it(`Maria gets a reply notf email, Michael doesn't (didn't verify his email)`, async () => {
    await server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, embPages.texts.owensReplyMentionsMariaMichael, mariasBrowser);
    // Email addr verif email + reply notf = 2.
    assert.eq(await server.countLastEmailsSentTo(siteId, maria.emailAddress), 2);
  });

  it(`... but Michal got no more emails`, async () => {
    // Email addr verif email + *no* reply notf = 1.
    assert.eq(await server.countLastEmailsSentTo(siteId, michael.emailAddress), 1);
  });

  it(`Maria goes to ${embPages.slugs.replyWithImagePageSlug}`, async () => {
    await mariasBrowser.go2(data.embeddingUrl + embPages.slugs.replyWithImagePageSlug);
  });

  it(`... posts a comment with an image`, async () => {
    // TESTS_MISSING: no image uploaded [402KGS4RQ]
    await mariasBrowser.complex.replyToEmbeddingBlogPost(embPages.texts.mariasReplyTwoWithImage);
  });

  it(`Maria goes to ${embPages.slugs.onlyLikeVotePageSlug}`, async () => {
    await mariasBrowser.go2(data.embeddingUrl + embPages.slugs.onlyLikeVotePageSlug);
  });

  it(`... Like-votes the blog post`, async () => {
    // This tests export & import of an empty page, except for the Like vote.
    await mariasBrowser.topic.clickLikeVoteForBlogPost();
  });

  it(`Maria goes to ${embPages.slugs.onlySubscrNotfsPageSlug}`, async () => {
    await mariasBrowser.go2(data.embeddingUrl + embPages.slugs.onlySubscrNotfsPageSlug);
  });

  it(`... subscribes to new comments`, async () => {
    // This tests export & import of an empty page — there's just the new-replies subscription.
    await mariasBrowser.metabar.setPageNotfLevel(c.TestPageNotfLevel.EveryPost);
  });


  // ----- Export site to .json file

  it(`Exports the site as json`, async () => {
    await owensBrowser.adminArea.goToBackupsTab(talkyardSiteOrigin);

    // There should be a download file link here.
    await owensBrowser.waitForVisible('.e_DnlBkp');
    const downloadAttr = await (await owensBrowser.$('.e_DnlBkp')).getAttribute('download');
    assert.that(_.isString(downloadAttr)); // but not null
    const wrongAttr = await (await owensBrowser.$('.e_DnlBkp')).getAttribute('download-wrong');
    assert.that(!_.isString(wrongAttr)); // tests the test

    // Don't know how to choose where to save the file, so instead, open the json 
    // directly in the browser:
    const downloadUrl = await (await owensBrowser.$('.e_DnlBkp')).getAttribute('href');
    await owensBrowser.go(downloadUrl);
  });


  let jsonDumpStr: string;

  it(`Can parse the exported json into a js obj`, async () => {
    let dummy;
    [jsonDumpStr, dummy] = await owensBrowser.getWholePageJsonStrAndObj();
  });

  it(`Saves the dump, here:\n\n      ` + c.EmbCommentsJsonExport + `\n`, () => {
    fs.writeFileSync(c.EmbCommentsJsonExport, jsonDumpStr);
  });


});

