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

let owensStaffPageUrl: St;
let mariasTopicId: St;
let catBPageUrl: St;

const owensReplyUrl = (): St => `${owensStaffPageUrl}#post-${c.FirstReplyNr}`;

const mariasTopicTitle = 'mariasTopicTitle';



describe(`link-previews-internal-not-see-cat.2br  TyTE2ELNPVIN4837`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "Internal May-Not-See Link Previews E2E Test",
      members: ['owen', 'memah', 'maria'],
    });

    // Place Cat B in Staff Cat.
    forum.categories.catB.parentId = forum.categories.staffCat.id;

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

    const catBPage: PageJustAdded = builder.addPage({
      id: 'catBPageId',
      folder: '/',
      showId: false,
      slug: 'cat-b-page',
      role: c.TestPageRole.Discussion,
      title: "Cat_B_Page_Title",
      body: "Cat_B_Page_Body",
      categoryId: forum.categories.catB.id, // which is in StaffCat
      authorId: forum.members.owen.id,
    });

    builder.addPost({
      page: newPage,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.owen.id,
      approvedSource: "Staff-only _Owens_reply",
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
    owensStaffPageUrl = site.origin + '/owens-staff-page';
    catBPageUrl = site.origin + '/cat-b-page';
  });


  it(`Owen goes to /cat-b-page,  in CatB in StaffCat`, async () => {
    await owen_brA.go2(catBPageUrl);
  });
  it(`... it's private; he logs in to see it   TyT0ACSPG043`, async () => {
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


  it(`She adds a link to Owen's staff page`, async () => {
    await maria_brB.editor.editText(owensStaffPageUrl);
  });
  it(`... a May-Not-See broken link preview appears, in the editor preview`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: owensStaffPageUrl,
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN_' });
    await maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });

  it(`... a 2nd link to _Owens_reply`, async () => {
    await maria_brB.editor.editText(`\n\n` + owensReplyUrl(), { append: true });
  });
  it(`... a 2nd broken preview appears — it's Not-Found broken`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: owensReplyUrl(),
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN_' });
    await maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });

  it(`... a 3rd link to /cat-b-page — it's private; it's in CatB in StaffCat`, async () => {
    await maria_brB.editor.editText(`\n\n` + catBPageUrl, { append: true });
  });
  it(`... a 3rd link preview appears — it's May-Not-See broken  TyTE2ELNSUBCAT`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: catBPageUrl,
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN_' });
    await maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });


  it(`Maria submits the new topic`, async () => {
    await maria_brB.complex.saveTopic({ title: mariasTopicTitle });
    mariasTopicId = await maria_brB.getPageId();
  });


  it(`In the new topic, there're 3 broken internal link previews`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink');
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 3 });
  });


  it(`... with the correct urls and invisible error codes: The staff page ...`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: owensStaffPageUrl,
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN_' });
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });
  });
  it(`... _Owens_reply ...`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: owensReplyUrl(),
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN_' });
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });
  });
  it(`... and the private /cat-b-page  TyTE2ELNSUBCAT`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: catBPageUrl,
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN_' });
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });
  });



  it(`Owen goes to his staff page`, async () => {
    await owen_brA.go2(owensStaffPageUrl);
  });

  it(`... sees a backlink to Maria's topic  TyT60T6SRTR3
        — although, from Maria's perspective, the links are broken,
        since it's a staff-only page`, async () => {
    await owen_brA.topic.backlinks.refreshUntilNum(1);
    assert.ok(await owen_brA.topic.backlinks.isLinkedFromPageId(mariasTopicId));
  });


  it(`Owen moves the page to Category A, which is public  TyTMVPG2OTRCAT`, async () => {
    await owen_brA.topic.movePageToOtherCategory(forum.categories.categoryA.name);
  });


  it(`Owen goes to /cat-b-page`, async () => {
    await owen_brA.go2(catBPageUrl);
  });

  it(`... sees a backlink to Maria's topic  TyT60T6SRTR3
        — although, from Maria's perspective, the link is broken,
        since the page is in Cat B which is in the staff cat`, async () => {
    await owen_brA.topic.backlinks.refreshUntilNum(1);
    assert.ok(await owen_brA.topic.backlinks.isLinkedFromPageId(mariasTopicId));
  });


  it(`Owen navigates to the page's category, Cat B`, async () => {
    await owen_brA.topbar.clickAncestor("CatB");
  });
  it(`... moves Category B so it's a child of Category A — it'll be public`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
    await owen_brA.categoryDialog.setParentCategory("CategoryA");
    await owen_brA.categoryDialog.submit();
  });


  it(`Maria posts a reply, linking to Owen's page & reply & /cat-b-page, again`, async () => {
    await maria_brB.complex.replyToOrigPost(
          owensStaffPageUrl + '\n\n' + owensReplyUrl() + '\n\n' + catBPageUrl + '\n');
  });


  it(`... this time it works: an ok preview link to Owen's page appears`, async () => {
    await maria_brB.topic.waitForExistsInPost(c.FirstReplyNr,
          utils.makePreviewOkSelector('InternalLink', { url: owensStaffPageUrl }));
  });


  it(`... and to _Owens_reply`, async () => {
    await maria_brB.topic.waitForExistsInPost(c.FirstReplyNr,
          utils.makePreviewOkSelector('InternalLink', { url: owensReplyUrl() }));
  });

  it(`... and to /cat-b-page  TyTE2ELNSUBCAT`, async () => {
    await maria_brB.topic.waitForExistsInPost(c.FirstReplyNr,
          utils.makePreviewOkSelector('InternalLink', { url: catBPageUrl }));
  });


  it(`Owen moves his staff page back to the Staff category`, async () => {
    await owen_brA.go2(owensStaffPageUrl);
    await owen_brA.topic.movePageToOtherCategory(forum.categories.staffOnlyCategory.name);
  });


  it(`Maria posts a 2nd reply, again linking to Owen's page and reply`, async () => {
    await maria_brB.complex.replyToOrigPost(
          owensStaffPageUrl + '\n\n' + owensReplyUrl() + '\n');
  });


  it(`... but the the preview links are broken`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink');
    await maria_brB.topic.waitForExistsInPost(c.SecondReplyNr, sel, { howMany: 2 });
  });


  it(`... because the page is again for staff only`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink', {
            errCode: 'TyMLNPG404-M0SEEPG-PO404-TyEM0SEE_-TyMMBYSEE_-ABX94WN_' });
    await maria_brB.topic.waitForExistsInPost(c.SecondReplyNr, sel, { howMany: 2 });
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
  });

});

