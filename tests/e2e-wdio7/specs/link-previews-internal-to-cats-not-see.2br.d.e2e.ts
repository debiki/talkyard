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
let memah: Member;
let memah_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

let mariasTopicId: St;

const owensReplyUrl = (): St => `${owensStaffPageUrl}#post-${c.FirstReplyNr}`;

const mariasTopicTitle = 'mariasTopicTitle';



describe(`link-previews-internal-to-cats-not-see.2br.d  TyTE2ELN2CAT`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Internal Cat Link Previews E2E Test",
      members: ['owen', 'memah', 'maria'],
    });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;
    memah = forum.members.maria;
    memah_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });


  it(`Owen logs in`, async () => {
    await owen_brA.go2(site.origin);
    await owen_brA.loginDialog.loginWithPassword(owen);
  });


  it(`Maria logs in to the topic index page`, async () => {
    await maria_brB.go2(site.origin);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });


  it(`Maria starts composing a new topic`, async () => {
    await maria_brB.forumButtons.clickCreateTopic();
    await maria_brB.editor.editTitle(mariasTopicTitle);
  });


  it(`She adds a link to the staff category`, async () => {
    await maria_brB.editor.editText('???');
  });


  it(`... a broken! link preview appears, in the new topic preview`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: '???',
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN' });
    await maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });

  // ??   link to  B when sub cat of private  Staff Cat?

  it(`She adds a 2nd link to Category B`, async () => {
    await maria_brB.editor.editText(`\n\n` + '???', { append: true });
  });


  it(`... a 2nd link preview appears — it's Not-Found broken too`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: '???',
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN' });
    await maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });


  it(`Maria submits the new topic`, async () => {
    await maria_brB.complex.saveTopic({ title: mariasTopicTitle });
    mariasTopicId = await maria_brB.getPageId();
  });


  it(`In the new topic, there's 1 broken internal link preview`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink');
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 2 });
  });


  it(`... with the correct urls and invisible error codes`, async () => {
    let sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: owensStaffPageUrl,
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN' });
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });

    sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: owensReplyUrl(),
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN' });
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });
  });


  it(`... and 1 ok link preview to Category A`, async () => {
  });


  it(`Owen refreshes his staff page`, async () => {
    await owen_brA.refresh2();
  });


  /*
  it(`Maria posts a reply, linking to Owen's page and reply, again`, async () => {
    await maria_brB.complex.replyToOrigPost(
          owensStaffPageUrl + '\n\n' + owensReplyUrl() + '\n');
  });


  it(`... this time it works: an ok preview link to Owen's page appears`, async () => {
    await maria_brB.topic.waitForExistsInPost(c.FirstReplyNr,
          utils.makePreviewOkSelector('InternalLink', { url: owensStaffPageUrl }));
  });


  it(`... and to Owen's reply`, async () => {
    await maria_brB.topic.waitForExistsInPost(c.FirstReplyNr,
          utils.makePreviewOkSelector('InternalLink', { url: owensReplyUrl() }));
  });


  it(`Owen moves the page back to the Staff category`, async () => {
    await owen_brA.topic.movePageToOtherCategory(forum.categories.staffOnlyCategory.name);
  });


  it(`Maria posts a 2nd reply, again linking to Owen'st page and reply`, async () => {
    await maria_brB.complex.replyToOrigPost(
          owensStaffPageUrl + '\n\n' + owensReplyUrl() + '\n');
  });


  it(`... but the the preview links are broken`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink');
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 2 });
  });


  it(`... because the page is again for staff only`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink', {
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN' });
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 2 });
  });


  it(`Maria clicks the link to Owen's staff-only page`, async () => {
    const sel = utils.makePreviewOkSelector('InternalLink', { url: owensReplyUrl() });
    await maria_brB.repeatUntilAtNewUrl(async () => {
      await maria_brB.waitAndClick(sel);
    });
  });


  it(`... she gets a page not found error, because accesss denied  TyT0ACSPG043`, async () => {
    // Remove:
    await maria_brB.notFoundDialog.waitAndAssertErrorMatches(
          'TyE404_', '-TyEM0SEE_-TyMMBYSEE_')
    // Instead, only this: (it's the same)
    await maria_brB.assertNotFoundError({ whyNot: 'MayNotSeeCat' });
  }); */

  // TESTS_MISSING  Link to access-denied *sub category*.   !
});

