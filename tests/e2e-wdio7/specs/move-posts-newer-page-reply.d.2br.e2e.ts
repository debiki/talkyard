/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { postElem } from '../utils/ty-e2e-post';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

let discussionPageUrl: string;

const oldPageTitle = 'oldPageTitle';
const oldPageBody  = 'oldPageBody';

const newPageTitle = 'newPageTitle';
const newPageBody  = 'newPageBody';

const oldReplyToMove = 'oldReplyToMove';
const oldReplyTwo = 'oldReplyTwo';
const newReplyToMove = 'newReplyToMove';
const newReplyToNewReplyToMove = 'newReplyToNewReplyToMove';

let newPageUrlPath: St;

describe(`move-posts-newer-page.d.2br TyTMOPONEPG`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({ // or addTwoPagesForum, addEmptyForum, addLargeForum
      title: "Some E2E Test",
      categoryAExtId: 'cat_a_ext_id',
      members: undefined, // default = everyone
        // ['mons', 'modya', 'regina', 'corax', 'memah', 'maria', 'michael', 'mallory']
    });

    const oldPage: PageJustAdded = builder.addPage({
      id: 'oldPageId',
      folder: '/',
      showId: false,
      slug: 'old-page',
      role: c.TestPageRole.Discussion,
      title: "Old_Page_Title",
      body: "Old page body.",
      categoryId: forum.categories.catA.id,
      authorId: forum.members.maria.id,
    });

    builder.addPost({
      page: oldPage,
      nr: c.FirstReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: oldReplyToMove,
    });

    builder.addPost({
      page: oldPage,
      nr: c.SecondReplyNr,
      parentNr: c.BodyNr,
      authorId: forum.members.maria.id,
      approvedSource: oldReplyTwo,
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
    site = server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });

  // ----- Create an old and new page with a comment

  it(`Maria logs in`, async () => {
    await maria_brB.go2(site.origin);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });

  it(`Maria creates a page with no replies — the page having no replies,
          triggered a bug in the past, if trying to move a comment to it`, async () => {
    await maria_brB.go2('/');
    await maria_brB.complex.createAndSaveTopic({ title: newPageTitle, body: newPageBody });
    newPageUrlPath = await maria_brB.urlPath();
  });

  it(`Owen logs in, views the old page`, async () => {
    await owen_brA.go2(site.origin + '/-oldPageId');
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
    await owen_brA.disableRateLimits();
  });

  it(`... starts moving the old reply to the new page`, async () => {
    await owen_brA.topic.openMoveDialogForPostNr(c.FirstReplyNr);
    await owen_brA.movePostDialog.typePostLinkMoveToThere(site.origin + newPageUrlPath);
  });

  it(`... confirms`, async () => {
    await owen_brA.waitAndClick('.esStupidDlg a');
    
    /* This triggered the above-mentioned bug, namely:

        Something went wrong: [DwE500REX]

        java.lang.IllegalArgumentException:
                requirement failed: [TyEOLDBUMPAT] page id: '3', ext id: 'None'
          at scala.Predef$.require(Predef.scala:281)
          at com.debiki.core.PageMeta.<init>(Page.scala:289)
          at com.debiki.core.PageMeta.copy(Page.scala:261)
          at com.debiki.core.PageMeta.copyWithUpdatedStats(Page.scala:445)
          at debiki.dao.PagesDao.refreshPageMetaBumpVersion(PagesDao.scala:805)
          at debiki.dao.PagesDao.refreshPageMetaBumpVersion$(PagesDao.scala:802)
          at debiki.dao.SiteDao.refreshPageMetaBumpVersion(SiteDao.scala:113)
          at debiki.dao.PostsDao.$anonfun$movePostIfAuth$1(PostsDao.scala:2521)
          at debiki.dao.SiteDao.$anonfun$writeTx$2(SiteDao.scala:262)
          at debiki.dao.SiteDao.$anonfun$readWriteTransaction$2(SiteDao.scala:302)
          at com.debiki.core.DbDao2.readWriteSiteTransaction(DbDao2.scala:67)
          at debiki.dao.SiteDao.$anonfun$readWriteTransaction$1(SiteDao.scala:302)
          at debiki.dao.SiteDao$.siteWriteLockIdImpl(SiteDao.scala:814)
          at debiki.dao.SiteDao$.$anonfun$withSiteWriteLock$1(SiteDao.scala:803)
          at debiki.dao.SystemDao$.withWholeDbReadLock(SystemDao.scala:876)
          at debiki.dao.SiteDao$.withSiteWriteLock(SiteDao.scala:803)
          at debiki.dao.SiteDao.readWriteTransaction(SiteDao.scala:301)
          at debiki.dao.SiteDao.writeTx(SiteDao.scala:278)
          at debiki.dao.SiteDao.writeTx(SiteDao.scala:249)
          at debiki.dao.PostsDao.movePostIfAuth(PostsDao.scala:2382)
          at debiki.dao.PostsDao.movePostIfAuth$(PostsDao.scala:2374)
          at debiki.dao.SiteDao.movePostIfAuth(SiteDao.scala:113)
          at controllers.EditController.$anonfun$movePost$1(EditController.scala:385)  */
  });

  it(`Owen gets redirected to the new page`, async () => {
    await owen_brA.assertPageTitleMatches(newPageTitle);
  });

  it("... now there's a comment here", async () => {
    await owen_brA.topic.assertNumRepliesVisible(1);
  });

  it("... it's the old comment", async () => {  // hmm?
    await owen_brA.topic.forAllPostIndexNrElem(async (index, nr, elem) => {
      // Originally, all post got so that their post nr is also their position from the top.
      assert.eq(nr, index);
      const text = await postElem(elem).getText();
      switch (nr) {
        case c.FirstReplyNr: assert.eq(text, oldReplyToMove); break;
      }
    });
  });


  it(`Maria posts a new comment on the new page`, async () => {
    await maria_brB.complex.replyToOrigPost(newReplyToMove);
  });

  it(`Owen looks at the new reply`, async () => {
    await owen_brA.refresh2();
    await owen_brA.topic.waitUntilPostTextIs(c.SecondReplyNr, newReplyToMove);
  });

  it(`... he moves the new reply to the old page`, async () => {
    await owen_brA.topic.openMoveDialogForPostNr(c.SecondReplyNr);
    await owen_brA.movePostDialog.typePostLinkMoveToThere(site.origin + '/-oldPageId');
  });

  it(`... confirms moving it`, async () => {
    await owen_brA.waitAndClick('.esStupidDlg a');
  });

  it(`Owen gets redirected back to the old page`, async () => {
    await owen_brA.assertPageTitleMatches("Old_Page_Title");
  });

  it(`... now the new reply is here instead`, async () => {
    await owen_brA.topic.assertNumRepliesVisible(2);
  });

  it(`... it's the right comment`, async () => {  // hmm?
    await owen_brA.topic.waitUntilPostTextIs(c.ThirdReplyNr, newReplyToMove);
  });

  it(`The old 2nd reply is still the 2nd reply`, async () => {
    await owen_brA.topic.waitUntilPostTextIs(c.SecondReplyNr, oldReplyTwo);
  });

  it(`Owen can reply to the new reply on the old page`, async () => {
    await owen_brA.complex.replyToPostNr(c.ThirdReplyNr, newReplyToNewReplyToMove);
    await owen_brA.topic.waitUntilPostTextIs(c.FourthReplyNr, newReplyToNewReplyToMove);
  });

});

