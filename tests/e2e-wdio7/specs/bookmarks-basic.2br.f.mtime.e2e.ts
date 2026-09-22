/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { logDebug, j2s } from '../utils/log-and-die';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;  // or TwoPagesTestForum or EmptyTestForum or LargeTestForum

const pageA = { id: 'pageA', slug: 'page-a', title: "PageA", body: "Page A." };
const pageB = { id: 'pageB', slug: 'page-b', title: "PageB", body: "Page B." };
const pageC = { id: 'pageC', slug: 'page-c', title: "PageC", body: "Page C." };

const owensReplyToMaria = 'owensReplyToMaria';
const mariasReplyToOwen = 'mariasReplyToOwen';

// 15 is many enough for the page to be so tall so we'll need to scroll down to
// see the bookmarked post.
const middlePostNr = 9;
const lastPostNr = 18;

const mariasPage = { title: 'mariasPageTitle', body: 'mariasPageBody' };
let mariasPageUrl: St;
let mariasPageId: St;

const mariasBookmarkLinksPageABC: St[] = [
          linkTo(pageC, lastPostNr),
          linkTo(pageC, c.BodyNr),
          linkTo(pageC, middlePostNr),
          linkTo(pageB, lastPostNr),
          linkTo(pageA, c.BodyNr)];

function linkTo(page: St | { id: St }, postNr?: Nr): St {
  const pageLink =  `/-${page['id'] || page}`;
  return !postNr ? pageLink : pageLink + `#post-${postNr}`;
}

describe(`bookmarks-basic.2br.f.mtime  TyTBOKM_BSC`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({ // or addTwoPagesForum, addTwoCatsForum, addEmptyForum
      title: "Some E2E Test",
      categoryAExtId: 'cat_a_ext_id',
      members: undefined, // default = everyone
        // ['mons', 'modya', 'regina', 'corax', 'memah', 'maria', 'michael', 'mallory']
    });

    // Search engine
    // Index this test site, so we can verify you can't accidentally find sbd else's
    // bookmarks when full-text-searching.
    // TESTS_MISSING  TyTBOKM_SRCH_0FIND
    builder.getSite().isTestSiteIndexAnyway = true;

    // Manually approve new posts, & max notification level for Owen, so we'll notice if
    // he accidentally gets to review & approve sbd else's *bookmarks*, or get
    // notified about people adding bookmarks. (None of that should happen.)
    // (Good to check, since bookmarks are stored in posts3 = nodes_t, w special post type.)
    builder.settings({
      numFirstPostsToApprove: 2,
      maxPostsPendApprBefore: 9,
      numFirstPostsToReview: 2,
    });
    builder.getSite().pageNotfPrefs.push({
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.EveryPostAllEdits,
      wholeSite: true,
    });

    for (let page of [pageA, pageB, pageC]) {
      const newPage: PageJustAdded = builder.addPage({
        ...page,
        folder: '/',
        showId: false,
        role: c.TestPageRole.Discussion,
        categoryId: forum.categories.categoryA.id,
        authorId: forum.members.memah.id,
      });

      for (let nr = c.FirstReplyNr; nr <= lastPostNr; ++nr) {
        builder.addPost({
          page: newPage,
          nr,
          parentNr: c.BodyNr,
          authorId: forum.members.memah.id,
          // E.g. "pageA_post_10".
          approvedSource: `${page.id}_post_${nr}`,
        });
      }
    }

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;

    // Changing trust & threat levels:
    maria.trustLevel = c.TestTrustLevel.Basic;
    maria.threatLevel = c.TestThreatLevel.HopefullySafe;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    server.skipLimits_sync(site.id, { rateLimits: true });
  });


  it(`Maria goes to page A, logs in`, async () => {
    await maria_brB.go2(site.origin + '/' + pageA.slug);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });
  it(`... bookmarks page A`, async () => {
    await maria_brB.bookmarks.bookmarkPost(c.BodyNr);
  });
  it(`... the bookmark appears in the bookmarks list`, async () => {
    await maria_brB.contextbar.openIfNeeded();
    await maria_brB.contextbar.bookmarks.openTab();  // _opened_bokm_tab
    const links: St[] = await maria_brB.contextbar.bookmarks.getBookmarkLinks();
    assert.deepEq(links, [linkTo(pageA, c.BodyNr)]);
  });

  it(`Maria goes to page B`, async () => {
    await maria_brB.topbar.clickHome();
    await maria_brB.forumTopicList.navToTopic(pageB.title);
  });
  it(`... bookmarks the last comment`, async () => {
    await maria_brB.bookmarks.bookmarkPost(lastPostNr);
  });
  it(`... the bookmark tab is still open — we're doing Single Page App navigation`, async () => {
    assert.that(await maria_brB.contextbar.bookmarks.isTabOpen());  // _opened_bokm_tab
  });
  it(`... the new bookmark appears in the bookmarks list, recent first order`, async () => {
    const links: St[] = await maria_brB.contextbar.bookmarks.getBookmarkLinks();
    assert.deepEq(links, [
          linkTo(pageB, lastPostNr), linkTo(pageA, c.BodyNr)]);
  });

  it(`Maria goes to page C`, async () => {
    await maria_brB.go2('/' + pageC.slug);
  });
  it(`... bookmarks the middle comment, orig post, last comment — in that order`, async () => {
    // Now we'll get to test how per page bookmarks are sorted in the sidebar.  TyTBOKM_ORDR
    await maria_brB.bookmarks.bookmarkPost(middlePostNr);
    await maria_brB.bookmarks.bookmarkPost(c.BodyNr);
    await maria_brB.bookmarks.bookmarkPost(lastPostNr);
  });


  it(`Maria posts a new page — will be pending approval (but not the bookmarks)`, async () => {
    await maria_brB.go2('/');
    await maria_brB.complex.createAndSaveTopic({ ...mariasPage, willBePendingApproval: true });
    mariasPageUrl = await maria_brB.urlPath();
    mariasPageId = await maria_brB.getPageId();
  });


  it(`Owen goes to page C and logs in`, async () => {
    await owen_brA.go2(site.origin + '/' + pageC.slug);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });
  it(`... there's no bookmarks (he can't see Maria's bookmarks)`, async () => {
    const links: St[] = await owen_brA.contextbar.bookmarks.getBookmarkLinks({ exactly: 0 });
    assert.deepEq(links, []);
  });
  it(`Owen bookmarks the orig post and first comment`, async () => {
    await owen_brA.bookmarks.bookmarkPost(c.BodyNr);
    await owen_brA.bookmarks.bookmarkPost(c.FirstReplyNr);
  });

  it(`Owen goes to admin area, the Review tab`, async () => {
    await owen_brA.adminArea.review.goHere(site.origin);
  });
  it(`... sees Maria's topic pending approval — but none of the bookmarks`, async () => {
    const links = await owen_brA.adminArea.review.getLinksToPosts();
    assert.deepEq(links, [linkTo(mariasPageId)])
  });
  it(`... approves it`, async () => {
    await owen_brA.adminArea.review.approvePostForMostRecentTask();
  });
  it(`... waits until takes effect`, async () => {
    await owen_brA.adminArea.review.playTimePastUndo();
  });

  it(`Owen goes to Maria's page`, async () => {
    await owen_brA.adminArea.review.goToPostForTaskIndex(1, { sameWindow: true });
  });

  it(`Owen replies to Maria`, async () => {
    await owen_brA.complex.replyToOrigPost(owensReplyToMaria);
  });

  it(`Maria relies to Owen`, async () => {
    //await maria_brB.refresh2();  // [live_update]
    await maria_brB.complex.replyToPostNr(c.FirstReplyNr, mariasReplyToOwen);
  });

  it(`Owen in-page approves Maria's reply`, async () => {
    // Shown direcly — websocket. [live_update]
    await owen_brA.topic.approvePostNr(c.SecondReplyNr);
  });

  it(`Owen bookmarks Maria's posts (but not his own)`, async () => {
    await owen_brA.bookmarks.bookmarkPost(c.BodyNr, {
            // E2EBUG Race: Sometimes the page hasn't been approved yet, even though we
            // did playTimePastUndo() above.
            // Then the page text is empty, and the pre-filled bookmark note is empty.
            // But one cannot save [empty_bookmarks] (bug).
            // So, for now, in case it's empty, add some custom notes.
            // TESTS_MISSING: Verify note saved properly
            notes: 'Owens_bookmark_for_Marias_page' });
    await owen_brA.bookmarks.bookmarkPost(c.SecondReplyNr, {
            // Why can *this* text be empty, only *sometimes*? Already approved!
            // Oh well, let's just add a note.
            notes: 'Owens_bookmark_for_Marias_comment' });
  });

  it(`Maria bookmarks Owen's reply (but not her own)`, async () => {
    await maria_brB.bookmarks.bookmarkPost(c.FirstReplyNr);
  });

  it(`Maria can't see Owen's bookmarks, not on the page`, async () => {
    await maria_brB.refresh2();
    const nrs = await maria_brB.bookmarks.getBookmarkedPostNrs();
    // But not c.BodyNr or SecondReplyNr, those are Maria's posts, bookmarked by *Owen*.
    assert.deepEq(nrs, [c.FirstReplyNr]);
  });

  it(`... nor in the sidebar bookmarks list`, async () => {
    await maria_brB.contextbar.openIfNeeded();
    await maria_brB.contextbar.bookmarks.openTab();
    const links: St[] = await maria_brB.contextbar.bookmarks.getBookmarkLinks();
    //logDebug(j2s(links));
    // This also checks the sort order.  TyTBOKM_ORDR
    assert.deepEq(links, [
          linkTo(mariasPageId, c.FirstReplyNr),  // Owen's reply, bookmarked by Maria
          ...mariasBookmarkLinksPageABC]);
  });

  it(`Owen can't see Maria's bookmarks on the page`, async () => {
    await owen_brA.refresh2();
    const nrs = await owen_brA.bookmarks.getBookmarkedPostNrs();
    // But not c.FirstReplyNr, that's Maria's bookmark of Owen's reply.
    assert.deepEq(nrs, [c.BodyNr, c.SecondReplyNr]);
  });
  it(`... nor in the sidebar bookmarks list`, async () => {
    await owen_brA.contextbar.openIfNeeded();
    await owen_brA.contextbar.bookmarks.openTab();
    const links: St[] = await owen_brA.contextbar.bookmarks.getBookmarkLinks();
    //logDebug(j2s(links));
    assert.deepEq(links, [
          linkTo(mariasPageId, c.SecondReplyNr),
          linkTo(mariasPageId, c.BodyNr),
          linkTo(pageC, c.FirstReplyNr),
          linkTo(pageC, c.BodyNr)]);
  });


  // ----- Delete bookmarks: Prepare

  // First add bookmarks so Maria and Owen have bookmarked the same post,
  // so we can check that only one's own bookmarks get deleted.

  it(`Now Owen bookmarks his own reply (which Maria has also bookmarked)`, async () => {
    await owen_brA.bookmarks.bookmarkPost(c.FirstReplyNr);
  });
  it(`... the bookmark appears immediately in Owen's sidebar`, async () => {
    const links: St[] = await owen_brA.contextbar.bookmarks.getBookmarkLinks();
    // Also checks sort order.  TyTBOKM_ORDR
    assert.deepEq(links, [
          linkTo(mariasPageId, c.FirstReplyNr),
          linkTo(mariasPageId, c.SecondReplyNr),
          linkTo(mariasPageId, c.BodyNr),
          linkTo(pageC, c.FirstReplyNr),
          linkTo(pageC, c.BodyNr)]);
  });

  it(`Maria bookmarks her page and reply  (which Owen has bookmarked too)`, async () => {
    await maria_brB.bookmarks.bookmarkPost(c.BodyNr);
    await maria_brB.bookmarks.bookmarkPost(c.SecondReplyNr);
  });
  it(`... the bookmarks appear immediately in Maria's sidebar`, async () => {
    const links: St[] = await maria_brB.contextbar.bookmarks.getBookmarkLinks();
    assert.deepEq(links, [
          linkTo(mariasPageId, c.SecondReplyNr),
          linkTo(mariasPageId, c.BodyNr),
          linkTo(mariasPageId, c.FirstReplyNr),
          ...mariasBookmarkLinksPageABC]);
  });


  // ----- Delete bookmarks

  // Delete a comment bookmark.  (Owen deletes his bookmark of Maria's comment.)
  addDeleteBookmarkSteps(() => owen_brA, () => maria_brB, c.SecondReplyNr,
        // But c.SecondReplyNr — gone.
        [c.BodyNr, c.FirstReplyNr],
        () => [linkTo(mariasPageId, c.FirstReplyNr),
                linkTo(mariasPageId, c.BodyNr),
                linkTo(pageC, c.FirstReplyNr),
                linkTo(pageC, c.BodyNr)]);

  // Delete a page bookmark.  (Owen deletes his bookmark of Maria's page.)
  addDeleteBookmarkSteps(() => owen_brA, () => maria_brB, c.BodyNr,
        // But c.BodyNr — gone.
        [c.FirstReplyNr],
        () => [linkTo(mariasPageId, c.FirstReplyNr),
                linkTo(pageC, c.FirstReplyNr),
                linkTo(pageC, c.BodyNr)]);


  // Owen deletes a bookmark for a post both Owen and Maria have bookmarked.
  // We check that the bookmark disappears for Owen only.
  //
  function addDeleteBookmarkSteps(
        owen_brFn: () => TyE2eTestBrowser, maria_brFn: () => TyE2eTestBrowser,
        delBookmOfPostNr: Nr,
        owensBookmarkNrsAfter: Nr[], owensBookmarkLinksAfterFn: () => St[]) {

    it(`Owen deletes his bookmark for Maria's post nr ${delBookmOfPostNr}`, async () => {
      await owen_brFn().bookmarks.deleteBookmark(delBookmOfPostNr);
    });
    it(`... the bookmark disappears from Owen's sidebar`, async () => {
      // Unimplemented: Updating the bookmarks list, when *deleting* bookmark. [del_bokm_upd_list]
      await owen_brFn().refresh2();

      await owen_brFn().contextbar.openIfNeeded();
      await owen_brFn().contextbar.bookmarks.openTab();
      const links: St[] = await owen_brFn().contextbar.bookmarks.getBookmarkLinks();
      //logDebug(j2s(links));
      assert.deepEq(links, owensBookmarkLinksAfterFn());
    });

    it(`... Owen reloads the page`, async () => {
      await owen_brFn().refresh2();
    });
    it(`... the bookmark remains deleted, on the page`, async () => {
      const nrs = await owen_brFn().bookmarks.getBookmarkedPostNrs();
      assert.deepEq(nrs, owensBookmarkNrsAfter);
    });
    it(`... and in the sidebar`, async () => {
      await owen_brFn().contextbar.openIfNeeded();
      await owen_brFn().contextbar.bookmarks.openTab();
      const links: St[] = await owen_brFn().contextbar.bookmarks.getBookmarkLinks();
      logDebug(j2s(links));
      assert.deepEq(links, owensBookmarkLinksAfterFn());
    });


    it(`But Maria's bookmark of the same post didn't disappear`, async () => {
      const nrs: Nr[] = await maria_brFn().bookmarks.getBookmarkedPostNrs();
      assert.deepEq(nrs, [c.BodyNr, c.FirstReplyNr, c.SecondReplyNr]);
    });
    it(`... and is still in Maria's sidebar`, async () => {
      await maria_brFn().refresh2(); // will remove later  [del_bokm_upd_list]
      // _dupl_code_Marias_bookms
      await maria_brFn().contextbar.openIfNeeded();
      await maria_brFn().contextbar.bookmarks.openTab();
      const links: St[] = await maria_brFn().contextbar.bookmarks.getBookmarkLinks();
      logDebug(j2s(links));
      assert.deepEq(links, [
            linkTo(mariasPageId, c.SecondReplyNr),  // Maria's most recent bookmark
            linkTo(mariasPageId, c.BodyNr),
            linkTo(mariasPageId, c.FirstReplyNr),   // Owen's reply
            ...mariasBookmarkLinksPageABC]);
    });

    it(`... after Maria reloads the page`, async () => {
      await maria_brFn().refresh2();
    });
    it(`... bookmarks still there`, async () => {
      const nrs: Nr[] = await maria_brFn().bookmarks.getBookmarkedPostNrs();
      assert.deepEq(nrs, [c.BodyNr, c.FirstReplyNr, c.SecondReplyNr]);
    });
    it(`... in Maria's sidebar too`, async () => {
      // _dupl_code_Marias_bookms
      await maria_brFn().contextbar.openIfNeeded();
      await maria_brFn().contextbar.bookmarks.openTab();
      const links: St[] = await maria_brFn().contextbar.bookmarks.getBookmarkLinks();
      logDebug(j2s(links));
      assert.deepEq(links, [
            linkTo(mariasPageId, c.SecondReplyNr),  // Maria's most recent bookmark
            linkTo(mariasPageId, c.BodyNr),
            linkTo(mariasPageId, c.FirstReplyNr),
            ...mariasBookmarkLinksPageABC]);
    });
  }


  // ----- Jump to bookmarks


  it(`Maria navigates to the Page A bookmark`, async () => {
    await maria_brB.contextbar.bookmarks.navToBookmark(
            linkTo(pageA, c.BodyNr), { newPageTitle: pageA.title });
  });
  it(`... sees her bookmark for the orig post`, async () => {
    const nrs = await maria_brB.bookmarks.getBookmarkedPostNrs();
    assert.deepEq(nrs, [c.BodyNr]);
  });


  it(`Maria navigates to the Page B post nr ${lastPostNr} bookmark`, async () => {
    // Sidebar still open — we're Single-Page-App navigating.
    await maria_brB.contextbar.bookmarks.navToBookmark(
            linkTo(pageB, lastPostNr), { newPageTitle: pageB.title });
  });
  it(`... sees her bookmark of post ${lastPostNr}`, async () => {
    const nrs = await maria_brB.bookmarks.getBookmarkedPostNrs();
    assert.deepEq(nrs, [lastPostNr]);
  });
  it(`... it scrolls into view  (bottom of the page)`, async () => {
    await maria_brB.waitForDisplayedInViewport('#post-' + lastPostNr);
  });


  it(`Maria navigates to the Page C post nr ${middlePostNr} bookmark`, async () => {
    await maria_brB.contextbar.bookmarks.navToBookmark(
            linkTo(pageC, middlePostNr), { newPageTitle: pageC.title });
  });
  it(`... sees her bookmarks on that page`, async () => {
    const nrs = await maria_brB.bookmarks.getBookmarkedPostNrs();
    assert.deepEq(nrs, [c.BodyNr, middlePostNr, lastPostNr]);
  });
  it(`... post nr ${middlePostNr} (the bookmark she clicked) scrolls into view`, async () => {
    await maria_brB.waitForDisplayedInViewport('#post-' + middlePostNr);
  });

  it(`Maria navigates to the Page C orig post bookmark`, async () => {
    await maria_brB.contextbar.bookmarks.navToBookmark(
            linkTo(pageC, c.BodyNr), { samePage: true });
  });
  it(`... the URL and bookmarks doesn't change`, async () => {
    const nrs = await maria_brB.bookmarks.getBookmarkedPostNrs();
    assert.deepEq(nrs, [c.BodyNr, middlePostNr, lastPostNr]);
  });
  it(`... the orig post scrolls into view`, async () => {
    await maria_brB.waitForDisplayedInViewport('#post-' + c.BodyNr);
  });

  it(`Maria navigates to the Page C last post, nr ${lastPostNr}`, async () => {
    await maria_brB.contextbar.bookmarks.navToBookmark(
            linkTo(pageC, lastPostNr), { samePage: true });
  });
  it(`... the URL and bookmarks doesn't change`, async () => {
    const nrs = await maria_brB.bookmarks.getBookmarkedPostNrs();
    assert.deepEq(nrs, [c.BodyNr, middlePostNr, lastPostNr]);
  });
  it(`... post ${lastPostNr} scrolls into view`, async () => {
    await maria_brB.waitForDisplayedInViewport('#post-' + lastPostNr);
  });


  it(`Owen clicks his Page C bookmark`, async () => {
    await owen_brA.contextbar.bookmarks.navToBookmark(
            linkTo(pageC, c.BodyNr), { newPageTitle: pageC.title });
  });
  it(`... sees his two bookmarks`, async () => {
    const nrs = await owen_brA.bookmarks.getBookmarkedPostNrs();
    assert.deepEq(nrs, [c.BodyNr, c.FirstReplyNr]);
  });



  // ----- Move to private cat

  // If you've bookmarked a page but it gets moved to a cat you can't see,
  // then ____ what ...?

  it(`Owen moves Page C to the Staff category`, async () => {
    await owen_brA.topic.movePageToOtherCategory(forum.categories.staffCat.name);
  });

  it(`Maria, still on Page C, tries to bookmark a comment`, async () => {
    await maria_brB.bookmarks.bookmarkPost(c.FirstReplyNr, { willFail: true });
  });
  it(`... but she can no longer see the page — it's staff-only now`, async () => {
    await maria_brB.serverErrorDialog.waitAndAssertTextMatches(
          c.serverErrorCodes.notFound,
          c.serverErrorCodes.mayNotReplyBecauseMayNotSee);
  });
  it(`... closes the dialogs`, async () => {
    await maria_brB.serverErrorDialog.close();
    await maria_brB.bookmarkDialog.cancel();
  });

  it(`Maria tries to delete a bookmark`, async () => {
    await maria_brB.bookmarks.deleteBookmark(c.BodyNr, { willFail: true });
  });
  it(`... again, a Not Found error — annoying? [delete_inaccessible_bookmark]`, async () => {
    await maria_brB.serverErrorDialog.waitAndAssertTextMatches(
          c.serverErrorCodes.notFound,
          // A slightly different error debug code, because is about the *page*,
          // not a comment. (Trying to un-bookmark the orig post.)
          // It's:  TyE404_-TyEM0SEEPG_-TyEM0SEE_-TyMMBYSEE_   as of 2026-04-07,
          // but let's just look for:
          c.serverErrorCodes.mayNotSee);
  });

  it(`Maria reloads the page`, async () => {
    await maria_brB.refresh2();
  });
  it(`... 404 Not Found, she can't access the Staff Cat`, async () => {
    await maria_brB.assertNotFoundError({ whyNot: 'MayNotSeeCat' });
  });
  it(`Maria goes to the topic list`, async () => {
    await maria_brB.notFoundDialog.clickHomeLink();
  });
  it(`... looks at the bookmarks`, async () => {
    await maria_brB.contextbar.openIfNeeded();
    await maria_brB.contextbar.bookmarks.openTab();
  });
  it(`... the Page C bookmarks are gone`, async () => {
    const links: St[] = await maria_brB.contextbar.bookmarks.getBookmarkLinks();
    logDebug(j2s(links));
    assert.deepEq(links, [
          linkTo(mariasPageId, c.SecondReplyNr),
          linkTo(mariasPageId, c.BodyNr),
          linkTo(mariasPageId, c.FirstReplyNr),
          // Would it be better if the server *did* incl a link  [delete_inaccessible_bookmark]
          // to the now inaccessible bookmarks?
          null,
          null,
          null,
          linkTo(pageB, lastPostNr),
          linkTo(pageA, c.BodyNr)]);
  });


  it(`Owen goes to the topic list`, async () => {
    await owen_brA.go2('/');
  });
  it(`... looks at his bookmarks`, async () => {
    await owen_brA.contextbar.openIfNeeded();
    await owen_brA.contextbar.bookmarks.openTab();
  });
  it(`... he sees the Page C bookmarks — he can access the Staff Cat`, async () => {
    const links: St[] = await owen_brA.contextbar.bookmarks.getBookmarkLinks();
    //logDebug(j2s(links));
    assert.deepEq(links, [
                linkTo(mariasPageId, c.FirstReplyNr),
                linkTo(pageC, c.FirstReplyNr),
                linkTo(pageC, c.BodyNr)]);
  });
  it(`Owen navigates to a bookmarked comment on Page C`, async () => {
    await owen_brA.contextbar.bookmarks.navToBookmark(
            linkTo(pageC, c.FirstReplyNr), { newPageTitle: pageC.title });
  });
  it(`... again sees his two bookmarks on Page C`, async () => {
    const nrs = await owen_brA.bookmarks.getBookmarkedPostNrs();
    assert.deepEq(nrs, [c.BodyNr, c.FirstReplyNr]);
  });

});

