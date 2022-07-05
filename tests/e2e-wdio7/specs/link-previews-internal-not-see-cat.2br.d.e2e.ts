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
let memah: Member;
let memah_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

let owensStaffPageUrl: St;
let mariasTopicId: St;

const owensReplyUrl = (): St => `${owensStaffPageUrl}#post-${c.FirstReplyNr}`;

const mariasTopicTitle = 'mariasTopicTitle';



describe(`link-previews-internal-not-see-cat.2br  TyTE2ELNPVIN4837`, () => {

  it(`Construct site`, () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Internal May-Not-See Link Previews E2E Test",
      members: ['owen', 'memah', 'maria'],
    });

    const newPage: PageJustAdded = builder.addPage({
      id: 'extraPageId',
      folder: '/',
      showId: false,
      slug: 'owens-staff-page',
      role: c.TestPageRole.Discussion,
      title: "Owen's Staff Only Page",
      body: "Non-staff members may not see any link preview of this page",
      categoryId: forum.categories.staffOnlyCategory.id,
      authorId: forum.members.owen.id,
    });

    builder.addPost({
      page: newPage,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.owen.id,
      approvedSource: "Staff-only reply",
    });

    everyonesBrowsers = new TyE2eTestBrowser(allWdioBrowsers);
    richBrowserA = new TyE2eTestBrowser(wdioBrowserA);
    richBrowserB = new TyE2eTestBrowser(wdioBrowserB);

    owen = forum.members.owen;
    owen_brA = richBrowserA;

    maria = forum.members.maria;
    maria_brB = richBrowserB;
    memah = forum.members.maria;
    memah_brB = richBrowserB;
    stranger_brB = richBrowserB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, () => {
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
    owensStaffPageUrl = site.origin + '/owens-staff-page';
  });


  it(`Owen logs in to his staff page page`, () => {
    owen_brA.go2(owensStaffPageUrl);
    owen_brA.loginDialog.loginWithPassword(owen);
  });


  it(`Maria logs in to the topic index page`, () => {
    maria_brB.go2(site.origin);
    maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });


  it(`Maria starts composing a new topic`, () => {
    maria_brB.forumButtons.clickCreateTopic();
    maria_brB.editor.editTitle(mariasTopicTitle);
  });


  it(`She adds a link to Owen's staff page`, () => {
    maria_brB.editor.editText(owensStaffPageUrl);
  });


  it(`... a broken! link preview appears, in the new topic preview`, () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: owensStaffPageUrl,
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN' });
    maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });


  it(`She adds a 2nd link to Owen's reply`, () => {
    maria_brB.editor.editText(`\n\n` + owensReplyUrl(), { append: true });
  });


  it(`... a 2nd link preview appears — it's Not-Found broken too`, () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: owensReplyUrl(),
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN' });
    maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });


  it(`Maria submits the new topic`, () => {
    maria_brB.complex.saveTopic({ title: mariasTopicTitle });
    mariasTopicId = maria_brB.getPageId();
  });


  it(`In the new topic, there're 2 broken internal link previews`, () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink');
    maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 2 });
  });


  it(`... with the correct urls and invisible error codes`, () => {
    let sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: owensStaffPageUrl,
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN' });
    maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });

    sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: owensReplyUrl(),
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN' });
    maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });
  });


  it(`Owen refreshes his staff page`, () => {
    owen_brA.refresh2();
  });


  it(`... sees a backlink to Maria's topic  TyT60T6SRTR3
        — although, from Maria's perspective, the links are broken,
        since it's a staff-only page`, () => {
    owen_brA.topic.backlinks.refreshUntilNum(1);
    assert.ok(owen_brA.topic.backlinks.isLinkedFromPageId(mariasTopicId));
  });


  it(`Owen moves the page to Category A, which is public  TyTMVPG2OTRCAT`, () => {
    owen_brA.topic.movePageToOtherCategory(forum.categories.categoryA.name);
  });


  it(`Maria posts a reply, linking to Owen's page and reply, again`, () => {
    maria_brB.complex.replyToOrigPost(
          owensStaffPageUrl + '\n\n' + owensReplyUrl() + '\n');
  });


  it(`... this time it works: an ok preview link to Owen's page appears`, () => {
    maria_brB.topic.waitForExistsInPost(c.FirstReplyNr,
          utils.makePreviewOkSelector('InternalLink', { url: owensStaffPageUrl }));
  });


  it(`... and to Owen's reply`, () => {
    maria_brB.topic.waitForExistsInPost(c.FirstReplyNr,
          utils.makePreviewOkSelector('InternalLink', { url: owensReplyUrl() }));
  });


  it(`Owen moves the page back to the Staff category`, () => {
    owen_brA.topic.movePageToOtherCategory(forum.categories.staffOnlyCategory.name);
  });


  it(`Maria posts a 2nd reply, again linking to Owen'st page and reply`, () => {
    maria_brB.complex.replyToOrigPost(
          owensStaffPageUrl + '\n\n' + owensReplyUrl() + '\n');
  });


  it(`... but the the preview links are broken`, () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink');
    maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 2 });
  });


  it(`... because the page is again for staff only`, () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink', {
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN' });
    maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 2 });
  });


  it(`Maria clicks the link to Owen's staff-only page`, () => {
    const sel = utils.makePreviewOkSelector('InternalLink', { url: owensReplyUrl() });
    maria_brB.repeatUntilAtNewUrl(() => {
      maria_brB.waitAndClick(sel);
    });
  });


  it(`... she gets a page not found error, because accesss denied  TyT0ACSPG043`, () => {
    // Remove:
    maria_brB.notFoundDialog.waitAndAssertErrorMatches(
          'TyE404_', '-TyEM0SEE_-TyMMBYSEE_')
    // Instead, only this: (it's the same)
    maria_brB.assertNotFoundError({ whyNot: 'MayNotSeeCat' });
  });

  // TESTS_MISSING  Link to access-denied *sub category*.  TyTE2ELNSUBCAT
});

