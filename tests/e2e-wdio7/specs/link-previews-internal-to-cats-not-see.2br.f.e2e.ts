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
let forum: TwoCatsTestForum;

let mariasTopicId: St;

const owensReplyUrl = (): St => `${owensStaffPageUrl}#post-${c.FirstReplyNr}`;

const mariasTopicTitle = 'mariasTopicTitle';
const mariasTopicTitle2 = 'mariasTopicTitle2';
const mariasTopicTitle3 = 'mariasTopicTitle3';

const staffCatPath = '/latest/staff-only';
const catAPath = '/latest/category-a';
const catBPath = '/latest/cat-b';
let nonExistingCatUrl: St | U;
let staffCatUrl: St | U;
let catAUrl: St | U;
let catBUrl: St | U;



describe(`link-previews-internal-to-cats-not-see.2br.f  TyTE2ELN2CAT.TyT0ACSPG043`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "Internal Cat Link Previews E2E Test",
      members: ['owen', 'maria'],
    });

    const staffPage: PageJustAdded = builder.addPage({
      id: 'staffPageId',
      folder: '/',
      showId: false,
      slug: 'staff-page',
      role: c.TestPageRole.Discussion,
      title: "Staff_Page_Title",
      body: "Staff_page_body",
      categoryId: forum.categories.staffCat.id,
      authorId: forum.members.owen.id,
    });

    const catBPage: PageJustAdded = builder.addPage({
      id: 'catBPageId',
      folder: '/',
      showId: false,
      slug: 'cat-b-page',
      role: c.TestPageRole.Discussion,
      title: "Cat_B_Page_Title",
      body: "Cat_B_page_body",
      categoryId: forum.categories.catB.id,
      authorId: forum.members.owen.id,
    });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    nonExistingCatUrl = site.origin + '/latest/non-existing';
    staffCatUrl = site.origin + staffCatPath;
    catAUrl = site.origin + catAPath;
    catBUrl = site.origin + catBPath;
    await server.skipRateLimits(site.id);
  });


  it(`Owen goes to Cat B, logs in`, async () => {
    await owen_brA.go2(site.origin + catBPath);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });


  it(`Maria arrives`, async () => {
    await maria_brB.go2(site.origin);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });


  // ----- Links to priv cats


  it(`Maria starts composing a topic`, async () => {
    await maria_brB.forumButtons.clickCreateTopic();
    await maria_brB.editor.editTitle(mariasTopicTitle);
  });
  it(`... adds a link to the staff category — which she can't see, it's private`, async () => {
    await maria_brB.editor.editText('Staff cat:\n\n' + staffCatUrl);
  });
  it(`... a broken! link preview appears, in the new topic preview`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: staffCatUrl,
            errCode: 'TyMLNPG404-M0SEECAT' });
    await maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });


  it(`She adds a link to Category B`, async () => {
    await maria_brB.editor.editText(`\n\nCat B:\n\n` + catBUrl, { append: true });
  });
  it(`... works fine: A link preview appears`, async () => {
    const sel = utils.makePreviewOkSelector('InternalLink', { url: catBUrl });
    await maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });


  it(`Maria submits the new topic`, async () => {
    await maria_brB.complex.saveTopic({ title: mariasTopicTitle });
    mariasTopicId = await maria_brB.getPageId();
  });

  it(`In the new topic, there's 1 broken internal link preview`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink');
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });
  });
  it(`... with the correct urls and invisible error codes`, async () => {
    let sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: staffCatUrl,
            errCode: 'TyMLNPG404-M0SEECAT' });
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });
  });

  it(`... and 1 ok link preview to Category B`, async () => {
    const previewOkSelector = utils.makePreviewOkSelector('InternalLink', { url: catBUrl });
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, previewOkSelector, { howMany: 1 });
  });


  // ----- Sub cat of priv cat


  it(`Owen moves Category B so it's a child of Staff Cat`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
    await owen_brA.categoryDialog.setParentCategory("Staff Only");
    await owen_brA.categoryDialog.submit();
  });


  it(`Maria clicks the Cat B link  (extra test, ttt)`, async () => {
    const sel = utils.makePreviewOkSelector('InternalLink', { url: catBUrl });
    await maria_brB.repeatUntilAtNewUrl(async () => {
      await maria_brB.waitAndClick(sel);
    });
  });
  it(`... she sees a Category not found error, because accesss denied`, async () => {
    // Hmm, this is for a category one cannot see.
    // But what about accesing a page in the category? Then:  [_0see_page_in_cat_or_cat]
    await maria_brB.waitForTextVisibleAssertMatches('.c_F_0Cat', '_TyE0CAT');
  });


  it(`Maria starts composing another topic`, async () => {
    await maria_brB.go2('/');
    await maria_brB.forumButtons.clickCreateTopic();
    await maria_brB.editor.editTitle(mariasTopicTitle2);
  });

  it(`... adds a link to Category B — which she can no longer access`, async () => {
    await maria_brB.editor.editText('Cat B:\n\n' + catBUrl);
  });
  it(`... now the preview of cat B is broken  (since now it's private)`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: catBUrl,
            errCode: 'TyMLNPG404-M0SEECAT' });
    await maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });


  it(`Maria submits topic "${mariasTopicTitle2}"`, async () => {
    await maria_brB.complex.saveTopic({ title: mariasTopicTitle2 });
    mariasTopicId = await maria_brB.getPageId();
  });

  it(`... there's 1 broken internal link preview`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink');
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });
  });

  it(`... to Cat B, and with invisible error codes`, async () => {
    let sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: catBUrl,
            errCode: 'TyMLNPG404-M0SEECAT' });
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });
  });


  // ----- Sub cat of pub cat


  it(`Owen moves Category B to Category A`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
    await owen_brA.categoryDialog.setParentCategory("CategoryA");
    await owen_brA.categoryDialog.submit();
  });


  it(`Maria starts composing a 3rd topic`, async () => {
    await maria_brB.go2('/');
    await maria_brB.forumButtons.clickCreateTopic();
    await maria_brB.editor.editTitle(mariasTopicTitle3);
  });

  it(`... adds a link to Category B, a third time`, async () => {
    await maria_brB.editor.editText(catBUrl);
  });
  it(`... works fine: A link preview appears`, async () => {
    const sel = utils.makePreviewOkSelector('InternalLink', { url: catBUrl });
    await maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });


  // ----- Non-existing cat


  it(`Maria adds a link to a non-existing category`, async () => {
    await maria_brB.editor.editText(
            '\n\nNon-existing cat:\n\n' + nonExistingCatUrl, { append: true });
  });
  it(`... a broken link preview appears, in the editor preview`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: nonExistingCatUrl,
            errCode: 'TyMLNPG404-CAT404' });
    await maria_brB.preview.waitForExist(sel, { where: 'InEditor' });
  });


  it(`Maria submits the new topic`, async () => {
    await maria_brB.complex.saveTopic({ title: mariasTopicTitle3 });
    mariasTopicId = await maria_brB.getPageId();
  });

  it(`In the new topic, there's an ok link preview to Category B`, async () => {
    const previewOkSelector = utils.makePreviewOkSelector('InternalLink', { url: catBUrl });
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, previewOkSelector, { howMany: 1 });
  });

  it(`... and 1 broken link preview`, async () => {
    const sel = utils.makePreviewBrokenSelector('InternalLink');
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });
  });
  it(`... to the non-existing cat, and with invisible error codes`, async () => {
    let sel = utils.makePreviewBrokenSelector('InternalLink', {
            url: nonExistingCatUrl,
            errCode: 'TyMLNPG404-CAT404' });
    await maria_brB.topic.waitForExistsInPost(c.BodyNr, sel, { howMany: 1 });
  });


});

