/// <reference path='../test-types.ts'/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
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

const replyToMoveFromPageOne = 'replyToMoveFromPageOne';
const replyToMoveFromPageTwo = 'replyToMoveFromPageTwo';


describe(`move-posts-pin-delete.2br.d  TyTMOPOPINDEL`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some E2E Test",
      categoryAExtId: 'cat_a_ext_id',
      members: undefined, // default = everyone
        // ['mons', 'modya', 'regina', 'corax', 'memah', 'maria', 'michael', 'mallory']
    });

    const pageOne: PageJustAdded = builder.addPage({
      id: '111',
      folder: '/',
      showId: false,
      slug: 'page-one',
      role: c.TestPageRole.Discussion,
      title: "Page_One",
      body: "Page one body.",
      categoryId: forum.categories.catA.id,
      authorId: forum.members.maria.id,
    });

    builder.addPost({
      page: pageOne,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: replyToMoveFromPageOne,
    });

    const pageTwo: PageJustAdded = builder.addPage({
      id: '222',
      folder: '/',
      showId: false,
      slug: 'page-two',
      role: c.TestPageRole.Discussion,
      title: "Page_Two",
      body: "Page two body.",
      categoryId: forum.categories.catA.id,
      authorId: forum.members.maria.id,
    });

    builder.addPost({
      page: pageTwo,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: replyToMoveFromPageTwo,
    });

    builder.addPost({
      page: pageTwo,
      nr: c.SecondReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: "A 2nd reply on page 2.",
    });

    builder.addPage({
      id: 'destPage',
      folder: '/',
      showId: false,
      slug: 'dest-page',
      role: c.TestPageRole.Discussion,
      title: "Dest_Page",
      body: "Destination page.",
      categoryId: forum.categories.catA.id,
      authorId: forum.members.maria.id,
    });

    assert.eq(builder.getSite(), forum.siteData);

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });

  // ----- Create an old and new page with a comment

  it(`Maria logs in`, async () => {
    await maria_brB.go2(site.origin);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });

  it(`Owen logs in, views page one`, async () => {
    await owen_brA.go2(site.origin + '/-111');
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
    await owen_brA.disableRateLimits();
  });


  // ----- Pages with one comment

  it(`Owen moves the one and only reply to another page`, async () => {
    await owen_brA.topic.openMoveDialogForPostNr(c.FirstReplyNr);
    await owen_brA.movePostDialog.typePostLinkMoveToThere(site.origin + '/-destPage');
    await owen_brA.waitAndClick('.esStupidDlg a');
  });

  it(`Owen gets redirected to the destination page`, async () => {
    await owen_brA.assertPageTitleMatches("Dest_Page");
  });

  it(`... now there's a comment here`, async () => {
    await owen_brA.topic.waitUntilPostTextIs(c.FirstReplyNr, replyToMoveFromPageOne);
  });

  it(`Owen goes back to page one`, async () => {
    await owen_brA.go2('/-111')
  });

  it(`Owen can pin the page — runs some [pin_comt_count_checks]  TyTPININCAT`, async () => {
    await owen_brA.topbar.pageTools.pinPage('InCategory', { willBeTipsAfter: true });
  });

  it(`... can delete it too`, async () => {
    await owen_brA.topbar.pageTools.deletePage();
  });

  it(`... undelete it  TyTEUNDELPG`, async () => {
    await owen_brA.topbar.pageTools.restorePage();
  });

  it(`... unpin it`, async () => {
    await owen_brA.topbar.pageTools.unpinPage();
  });


  // ----- Pages with many comments

  it(`Owen goes to page two with 2 comments`, async () => {
    await owen_brA.go2('/-222');
  });

  it(`... moves the first reply, out of two, to another page`, async () => {
    await owen_brA.topic.openMoveDialogForPostNr(c.FirstReplyNr);
    await owen_brA.movePostDialog.typePostLinkMoveToThere(site.origin + '/-destPage');
    await owen_brA.waitAndClick('.esStupidDlg a');
  });

  it(`... gets redirected to the destination page`, async () => {
    await owen_brA.assertPageTitleMatches("Dest_Page");
  });

  it(`... now there're two replies here`, async () => {
    await owen_brA.topic.waitUntilPostTextIs(c.FirstReplyNr, replyToMoveFromPageOne);
    await owen_brA.topic.waitUntilPostTextIs(c.SecondReplyNr, replyToMoveFromPageTwo);
  });

  it(`Owen goes back to page two`, async () => {
    await owen_brA.go2('/-222')
  });

  it(`Owen can pin the page (runs some [pin_comt_count_checks] — and once there was
          a bug, when there was a "hole" in the post nr sequence, since the first
          reply got moved elsewhere)  TyTPININCAT`, async () => {
    await owen_brA.topbar.pageTools.pinPage('InCategory', {
          // The tips is shown only the first time.
          willBeTipsAfter: false });
  });

  it(`... can delete it too`, async () => {
    await owen_brA.topbar.pageTools.deletePage();
  });

  it(`... undelete it  TyTEUNDELPG`, async () => {
    await owen_brA.topbar.pageTools.restorePage();
  });

  it(`... unpin it`, async () => {
    await owen_brA.topbar.pageTools.unpinPage();
  });

});

