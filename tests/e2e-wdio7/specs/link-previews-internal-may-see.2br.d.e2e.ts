/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';



let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoPagesTestForum;

let michaelsTopicUrl: St;
let mariasTopicId: St;
let mariasTopicUrl: St;

const owensReplyToMichael = 'owensReplyToMichael';
const owensReplyPostNr = c.FirstReplyNr;
const owensReplyUrl = () => `${michaelsTopicUrl}#post-${owensReplyPostNr}`;
const owensRe2Text_willDelete = 'owensRe2Text_willDelete';
const owensRe2Url_willDelete = () => `${michaelsTopicUrl}#post-${c.FirstReplyNr + 1}`;
const owensRe2Nr_willDelete = c.FirstReplyNr + 1;
const brokenPageUrl = () => `${site.origin}/-999999/does-not-exist`;

const mariasTopicTitle = 'mariasTopicTitle';



describe(`link-previews-internal-may-see.2br  TyTE2ELNPVIN7252`, () => {

  it(`construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Internal Link Previews E2E Test",
      members: ['owen', 'maria', 'michael']
    });

    builder.addPost({
      page: forum.topics.byMichaelCategoryA,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.owen.id,
      approvedSource: owensReplyToMichael,
    });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
    michaelsTopicUrl = site.origin + '/' + forum.topics.byMichaelCategoryA.slug;
    mariasTopicUrl = site.origin + '/' + forum.topics.byMariaCategoryA.slug;
  });


  it(`Owen logs in to Michael's page`, async () => {
    await owen_brA.go2(michaelsTopicUrl);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });


  it(`Maria logs in to the topic index page`, async () => {
    await maria_brB.go2(site.origin);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });


  it(`Maria starts composing a new topic`, async () => {
    await maria_brB.forumButtons.clickCreateTopic();
    await maria_brB.editor.editTitle(mariasTopicTitle);
  });


  it(`She adds a link to Michael's topic`, async () => {
    await maria_brB.editor.editText(michaelsTopicUrl);
  });


  it(`... a link preview appears, in the new topic preview`, async () => {
    const sel = utils.makePreviewOkSelector('InternalLink', { url: michaelsTopicUrl });
    await maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });


  it(`She adds a 2nd link, this time to Owen's reply to Michael`, async () => {
    await maria_brB.editor.editText(`\n\n` + owensReplyUrl(), { append: true });
  });


  it(`... a 2nd link preview appears — it shows Owen's reply (not the Orig Post)`, async () => {
    const sel = utils.makePreviewOkSelector('InternalLink', { url: owensReplyUrl() });
    await maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });


  it(`She adds a 3rd link, to reply 2 — which doesn't exist`, async () => {
    await maria_brB.editor.editText(`\n\n` + owensRe2Url_willDelete(), { append: true });
  });


  it(`... a 3rd link preview appears — as a normal link: Post not found`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink',
            { url: owensRe2Url_willDelete(), errCode: 'TyMLNPG404-M0SEEPG-PO404' });
    await maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });


  it(`Maria submits the new topic`, async () => {
    await maria_brB.complex.saveTopic({ title: mariasTopicTitle });
    mariasTopicId = await maria_brB.getPageId();
  });


  it(`In the new topic, there're 2 ok internal link previews`, async () => {
    const previewOkSelector = utils.makePreviewOkSelector('InternalLink');
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, previewOkSelector, { howMany: 2 });
  });


  it(`... and 1 broken`, async () => {
    const previewBrokenSelector = utils.makePreviewBrokenSelector('InternalLink');
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, previewBrokenSelector, { howMany: 1 });
  });


  it(`... the broken link url and error code (if debug build) is correct`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink',
            { url: owensRe2Url_willDelete(), errCode: 'TyMLNPG404-M0SEEPG-PO404' });
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });
  });


  it(`Owen refreshes Michael's page`, async () => {
    await owen_brA.refresh2();
  });


  it(`... sees a backlink to Maria's topic  TyT606SRTR3`, async () => {
    await owen_brA.topic.backlinks.refreshUntilNum(1);
    assert.that(await owen_brA.topic.backlinks.isLinkedFromPageId(mariasTopicId));
  });


  it(`Owen posts a new reply — so now there's a 2nd reply`, async () => {
    await owen_brA.complex.replyToOrigPost(owensRe2Text_willDelete)
  });


  it(`Maria posts a link to the 2nd reply`, async () => {
    await maria_brB.complex.replyToOrigPost(owensRe2Url_willDelete());
  });


  it(`... this time it works: a preview of the reply appears`, async () => {
    await maria_brB.topic.waitForExistsInPost(c.FirstReplyNr,
          utils.makePreviewOkSelector('InternalLink',
          { url: owensRe2Url_willDelete() }));
  });


  it(`But Owen deletes the 2nd reply`, async () => {
    await owen_brA.topic.deletePost(owensRe2Nr_willDelete);
  });


  it(`Maria again posts a link to the 2nd reply — which got deleted`, async () => {
    await maria_brB.complex.replyToOrigPost(owensRe2Url_willDelete());
  });


  it(`... a broken link preview appears`, async () => {
    await maria_brB.topic.waitForExistsInPost(c.FirstReplyNr + 1,
          utils.makePreviewBrokenSelector('InternalLink',
          { url: owensRe2Url_willDelete() }));
  });


  it(`Maria posts a link to a non-existing page (same site)`, async () => {
    await maria_brB.complex.replyToOrigPost(brokenPageUrl());
  });


  it(`... a "Not found" broken preview appears`, async () => {
    await maria_brB.topic.waitForExistsInPost(c.FirstReplyNr + 2,
          utils.makePreviewBrokenSelector('InternalLink', { url: brokenPageUrl() }));
  });


  it(`Maria clicks the internal link preview to Owen's reply nr 1`, async () => {
    const sel = utils.makePreviewOkSelector('InternalLink', { url: owensReplyUrl() });
    await maria_brB.repeatUntilAtNewUrl(async () => {
      await maria_brB.waitAndClick(sel, { clickFirst: true });
    });
  });


  it(`... which takes her to Michael's page, Owen's reply`, async () => {
    assert.eq(await maria_brB.getUrl(), owensReplyUrl());
  });


  it(`... she sees Owen's first reply, not deleted`, async () => {
    await maria_brB.topic.waitUntilPostTextIs(c.FirstReplyNr, owensReplyToMichael);
  });

});
