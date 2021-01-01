/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
// import fs = require('fs');  EMBCMTS
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/pages-for';
import settings = require('../utils/settings');
import lad = require('../utils/log-and-die');
import c = require('../test-constants');


let everyonesBrowsers: TyAllE2eTestBrowsers;
let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

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

  it(`construct site`, () => {
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

    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owen_brA = richBrowserA;

    maria = forum.members.maria;
    maria_brB = richBrowserB;
    stranger_brB = richBrowserB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
    michaelsTopicUrl = site.origin + '/' + forum.topics.byMichaelCategoryA.slug;
    mariasTopicUrl = site.origin + '/' + forum.topics.byMariaCategoryA.slug;
  });


  it(`Owen logs in to Michael's page`, () => {
    owen_brA.go2(michaelsTopicUrl);
    owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });


  it(`Maria logs in to the topic index page`, () => {
    maria_brB.go2(site.origin);
    maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });


  it(`Maria starts composing a new topic`, () => {
    maria_brB.forumButtons.clickCreateTopic();
    maria_brB.editor.editTitle(mariasTopicTitle);
  });


  it(`She adds a link to Michael's topic`, () => {
    maria_brB.editor.editText(michaelsTopicUrl);
  });


  it(`... a link preview appears, in the new topic preview`, () => {
    const sel = utils.makePreviewOkSelector('InternalLink', { url: michaelsTopicUrl });
    maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });


  it(`She adds a 2nd link, this time to Owen's reply to Michael`, () => {
    maria_brB.editor.editText(`\n\n` + owensReplyUrl(), { append: true });
  });


  it(`... a 2nd link preview appears — it shows Owen's reply (not the Orig Post)`, () => {
    const sel = utils.makePreviewOkSelector('InternalLink', { url: owensReplyUrl() });
    maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });


  it(`She adds a 3rd link, to reply 2 — which doesn't exist`, () => {
    maria_brB.editor.editText(`\n\n` + owensRe2Url_willDelete(), { append: true });
  });


  it(`... a 3rd link preview appears — it's Not-Found broken`, () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink',
            { url: owensRe2Url_willDelete() });
    // TESTS_MISSING: Could check error code: TyMLNPG404-PO404
    maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });


  it(`Maria submits the new topic`, () => {
    maria_brB.complex.saveTopic({ title: mariasTopicTitle });
    mariasTopicId = maria_brB.getPageId();
  });


  it(`In the new topic, there're 2 ok internal link previews`, () => {
    const previewOkSelector = utils.makePreviewOkSelector('InternalLink');
    maria_brB.topic.waitForExistsInPost(c.BodyNr, previewOkSelector, { howMany: 2 });
  });


  it(`... and 1 broken`, () => {
    const previewBrokenSelector = utils.makePreviewBrokenSelector('InternalLink');
    maria_brB.topic.waitForExistsInPost(c.BodyNr, previewBrokenSelector, { howMany: 1 });
  });


  it(`Owen refreshes Michael's page`, () => {
    owen_brA.refresh2();
  });


  it(`... sees a backlink to Maria's topic  TyT606SRTR3`, () => {
    owen_brA.topic.backlinks.refreshUntilNum(1);
    assert.ok(owen_brA.topic.backlinks.isLinkedFromPageId(mariasTopicId));
  });


  it(`Owen posts a new reply — so now there's a 2nd reply`, () => {
    owen_brA.complex.replyToOrigPost(owensRe2Text_willDelete)
  });


  it(`Maria posts a link to the 2nd reply`, () => {
    maria_brB.complex.replyToOrigPost(owensRe2Url_willDelete());
  });


  it(`... this time it works: a preview of the reply appears`, () => {
    maria_brB.topic.waitForExistsInPost(c.FirstReplyNr,
          utils.makePreviewOkSelector('InternalLink',
          { url: owensRe2Url_willDelete() }));
  });


  it(`But Owen deletes the 2nd reply`, () => {
    owen_brA.topic.deletePost(owensRe2Nr_willDelete);
  });


  it(`Maria again posts a link to the 2nd reply — which got deleted`, () => {
    maria_brB.complex.replyToOrigPost(owensRe2Url_willDelete());
  });


  it(`... a broken link preview appears`, () => {
    maria_brB.topic.waitForExistsInPost(c.FirstReplyNr + 1,
          utils.makePreviewBrokenSelector('InternalLink',
          { url: owensRe2Url_willDelete() }));
  });


  it(`Maria posts a link to a non-existing page (same site)`, () => {
    maria_brB.complex.replyToOrigPost(brokenPageUrl());
  });


  it(`... a "Not found" broken preview appears`, () => {
    maria_brB.topic.waitForExistsInPost(c.FirstReplyNr + 2,
          utils.makePreviewBrokenSelector('InternalLink', { url: brokenPageUrl() }));
  });


  it(`Maria clicks the internal link preview to Owen's reply nr 1`, () => {
    const sel = utils.makePreviewOkSelector('InternalLink', { url: owensReplyUrl() });
    maria_brB.repeatUntilAtNewUrl(() => {
      maria_brB.waitAndClick(sel, { clickFirst: true });
    });
  });


  it(`... which takes her to Michael's page, Owen's reply`, () => {
    assert.eq(maria_brB.getUrl(), owensReplyUrl());
  });


  it(`... she sees Owen's first reply, not deleted`, () => {
    maria_brB.topic.waitUntilPostTextIs(c.FirstReplyNr, owensReplyToMichael);
  });

});
