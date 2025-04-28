/// <reference path="../test-types.ts"/>

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
let mons: Member;
let mons_brA: TyE2eTestBrowser;
let modya: Member;
let modya_brA: TyE2eTestBrowser;
let mallory: Member;
let mallory_brB: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let michael: Member;
let michael_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: EmptyTestForum;

const oldPageTitle = 'Old_Page_Title';

const topicOneTitle = 'topicOneTitle';
const topicOneBody = 'topicOneBody';

const topicTwoTitle = 'topicTwoTitle';
const topicTwoBody = 'topicTwoBody';

let nextOldPageReplyNr = c.FirstReplyNr - 1;


// In this test:
//
// Maria, Michael, Mallory post pages and comments.  Moderator Modya bans everyone,
// and all pages and comments get deleted.
//
describe(`modn-ban-from-disc-page.2br.f  TyTEBANFROMDISC`, () => {

  it(`construct site`, async () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "Some E2E Test",
      members: undefined, // default = everyone
    });

    builder.settings({
      numFirstPostsToApprove: 0,
      requireApprovalIfTrustLte: c.TestTrustLevel.FullMember,
      maxPostsPendApprBefore: 6,
      numFirstPostsToReview: 0,
    });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    builder.addPage({
      id: 'oldPageId',
      folder: '/',
      showId: false,
      slug: 'old-page',
      role: c.TestPageRole.Discussion,
      title: oldPageTitle,
      body: "Old pade text text text.",
      categoryId: forum.categories.categoryA.id,
      authorId: forum.members.owen.id,
    });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    mons = forum.members.mons;
    modya = forum.members.modya;
    owen_brA = brA;
    mons_brA = brA;
    modya_brA = brA;

    maria = forum.members.maria;
    michael = forum.members.michael;
    mallory = forum.members.mallory;
    maria_brB = brB;
    michael_brB = brB;
    mallory_brB = brB;
    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });

  it(`Modya wakes up, and logs in,  in a bad mood, after having seen the neighbor's
        dog with a bad looking haircut (in Modya's opinion) yesterday evening`, async () => {
    await modya_brA.go2(site.origin + '/');
    await modya_brA.complex.loginWithPasswordViaTopbar(modya);
  });

  it(`Maria logs in`, async () => {
    await maria_brB.go2(site.origin + '/');
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });

  let mariasPagesFn = addCreateSpamSteps(() => maria_brB, `Maria`);


  interface NewPages {
    topicOneUrl: St;
    topicTwoUrl: St
  }

  function addCreateSpamSteps(br: () => TyE2eTestBrowser, name: St): () => NewPages {
    let topicOneUrl: St;
    let topicTwoUrl: St;

    it(`${name} posts a new topic`, async () => {
      await br().complex.createAndSaveTopic({
            title: topicOneTitle + ` by ${name}`, body: topicOneBody,
            willBePendingApproval: true });
      topicOneUrl = await br().getUrl();
    });

    it(`... it becomes pending approval`, async () => {
      await br().topic.waitForPostAssertTextMatches(c.BodyNr, topicOneBody);
      await br().topic.waitForPostAssertTextMatches(c.TitleNr, topicOneTitle);
      await br().topic.assertPagePendingApprovalBodyVisible();
    });

    it(`... han posts 2 comments`, async () => {
      await br().complex.replyToOrigPost(`Comment_1_by_${name}`, 'DiscussionSection');
      await br().complex.replyToOrigPost(`Comment_2_by_${name}`, 'DiscussionSection');
    });

    it(`${name} posts another topic`, async () => {
      await br().topbar.clickHome();
      await br().complex.createAndSaveTopic({
            title: topicTwoTitle, body: topicTwoBody, willBePendingApproval: true });
      topicTwoUrl = await br().getUrl();
    });

    it(`... it becomes pending approval`, async () => {
      await br().topic.assertPagePendingApprovalBodyVisible();
    });

    it(`${name} replies to an old page`, async () => {
      await br().go2('/old-page');
      await br().complex.replyToOrigPost(`Old_page_comment_by_${name}`);
      nextOldPageReplyNr += 1;
    });

    it(`... hans new comment becomes pending approval`, async () => {
      await br().topic.assertPostNeedsApprovalBodyVisible(nextOldPageReplyNr);
    });

    return function() { return { topicOneUrl, topicTwoUrl }};
  }


  it(`Modya goes to the Moderation page`, async () => {
    await modya_brA.adminArea.review.goHere();
  });
  it(`... sees 5 things to review: Maria's 2 pages, 3 comments`, async () => {
    assert.eq(await modya_brA.adminArea.review.countThingsToReview(), 5);
    assert.that(await modya_brA.adminArea.review.isMoreStuffToReview()); // ttt
  });
  it(`... ticks the 'Hide completed' checkbox  TyT05KD2SM1`, async () => {
    await modya_brA.adminArea.review.hideCompletedTasks();
  });
  it(`... all 5 still shown, pending review`, async () => {
    assert.eq(await modya_brA.adminArea.review.countThingsToReview(), 5);
  });

  it(`Modya goes to the old page`, async () => {
    await modya_brA.go2('/old-page');
  });
  it(`... sees Maria's comment`, async () => {
    await modya_brA.topic.waitForPostAssertTextMatches(
            c.FirstReplyNr, `Old_page_comment_by_Maria`);
  });

  it(`Modya goes to Maria's new topic one`, async () => {
    await modya_brA.go2(mariasPagesFn().topicOneUrl);
  });
  it(`... replies to Maria's first comment   TyTREBEFAPR`, async () => {
    await modya_brA.complex.replyToPostNr(c.FirstReplyNr, `Modyas_reply_to_Marias_1st_reply`);
  });
  it(`Modya bans Maria, by clicking Ban on the page (orig post)`, async () => {
    await modya_brA.topic.banSpammerViaPostNr(c.BodyNr);
  });
  it(`... this deletes the page`, async () => {
    await modya_brA.topic.waitUntilPageDeleted();
  });
  it(`... ... and Maria's two comments`, async () => {
    await modya_brA.topic.waitForPostVisibleAsDeleted(c.FirstReplyNr);
    await modya_brA.topic.waitForPostVisibleAsDeleted(c.SecondReplyNr);
  });
  it(`... but not Modya's reply`, async () => {
    await modya_brA.topic.waitForPostAssertTextMatches(
          c.ThirdReplyNr, `Modyas_reply_to_Marias_1st_reply`);
    assert.not(await modya_brA.topic.isPostVisibleAsDeleted(c.ThirdReplyNr));
  });

  it(`Modya goes to Maria's other new topic`, async () => {
    await modya_brA.go2(mariasPagesFn().topicTwoUrl);
  });
  it(`... it got deleted too — all Maria's posts are gone`, async () => {
    await modya_brA.topic.waitUntilPageDeleted();
  });



  it(`Michael logs in (Maria got logged out automatically, when banned)`, async () => {
    await michael_brB.go2(site.origin + '/');
    await michael_brB.complex.loginWithPasswordViaTopbar(michael);
  });

  let michaelsPagesFn = addCreateSpamSteps(() => michael_brB, `Michael`);


  it(`Modya goes to the old page`, async () => {
    await modya_brA.go2('/old-page');
  });
  it(`... sees Michael's comment`, async () => {
    await modya_brA.topic.waitForPostAssertTextMatches(
            c.SecondReplyNr, `Old_page_comment_by_Michael`);
  });
  it(`... but Maria's comment is gone — deleted when she banned Maria`, async () => {
    assert.not(await modya_brA.topic.isPostNrVisible(c.FirstReplyNr));
  });

  it(`Modya goes to Michael's new topic one`, async () => {
    await modya_brA.go2(michaelsPagesFn().topicOneUrl);
  });
  it(`... replies to Michael's first comment   TyTREBEFAPR`, async () => {
    await modya_brA.complex.replyToPostNr(c.FirstReplyNr, `Modyas_reply_to_Michaels_1st_reply`);
  });
  it(`Modya bans Michael, by clicking Ban on Michael's 2nd comment`, async () => {
    await modya_brA.topic.banSpammerViaPostNr(c.SecondReplyNr);
  });
  it(`... this deletes the page — since Michael is the author, and now banned`, async () => {
    await modya_brA.topic.waitUntilPageDeleted();
  });
  it(`... ... Michael's two comments got deleted too`, async () => {
    await modya_brA.topic.waitForPostVisibleAsDeleted(c.FirstReplyNr);
    await modya_brA.topic.waitForPostVisibleAsDeleted(c.SecondReplyNr);
  });

  it(`Modya goes to Michael's other new topic`, async () => {
    await modya_brA.go2(michaelsPagesFn().topicTwoUrl);
  });
  it(`... it's been deleted too — all Michael's posts are gone`, async () => {
    await modya_brA.topic.waitUntilPageDeleted();
  });



  it(`Mallory logs in`, async () => {
    await mallory_brB.go2(site.origin + '/');
    await mallory_brB.complex.loginWithPasswordViaTopbar(mallory);
  });

  let mallorysPagesFn = addCreateSpamSteps(() => mallory_brB, `Mallory`);


  it(`Modya goes to the old page`, async () => {
    await modya_brA.go2('/old-page');
  });
  it(`... sees Mallory's comment`, async () => {
    await modya_brA.topic.waitForPostAssertTextMatches(
            c.ThirdReplyNr, `Old_page_comment_by_Mallory`);
  });
  it(`... Michael's comment is gone — deleted when he banned Michael`, async () => {
    assert.not(await modya_brA.topic.isPostNrVisible(c.FirstReplyNr)); // Maria's, deleted too
    assert.not(await modya_brA.topic.isPostNrVisible(c.SecondReplyNr));
  });

  it(`Modya bans Mallory`, async () => {
    await modya_brA.topic.banSpammerViaPostNr(c.ThirdReplyNr);
  });
  it(`... comment deleted`, async () => {
    await modya_brA.topic.waitForPostVisibleAsDeleted(c.ThirdReplyNr);
  });
  it(`... but not the page. It's not Mallory's page`, async () => {
    assert.not(await modya_brA.topic.isPageDeletedButVisible());
    await modya_brA.assertPageTitleMatches(`Old_Page_Title`);
  });

  it(`Modya goes to Mallory's first new topic`, async () => {
    await modya_brA.go2(mallorysPagesFn().topicOneUrl);
  });
  it(`... it's been deleted`, async () => {
    await modya_brA.topic.waitUntilPageDeleted();
  });
  /*
  it(`... and Mallory's two comments (same page) also deleted`, async () => {
    // Ooops but [deleted_comment_not_loaded].
    await modya_brA.topic.waitForPostVisibleAsDeleted(c.FirstReplyNr);
    await modya_brA.topic.waitForPostVisibleAsDeleted(c.SecondReplyNr);
  }); */

  it(`Modya goes to Mallory's other new topic`, async () => {
    await modya_brA.go2(mallorysPagesFn().topicTwoUrl);
  });
  it(`... it got deleted too — all Mallory's pages are gone`, async () => {
    await modya_brA.topic.waitUntilPageDeleted();
  });


  it(`Modya goes to the old page again`, async () => {
    await modya_brA.go2('/old-page');
  });
  it(`... it's empty, just the orig post`, async () => {
    const counts = await modya_brA.topic.countReplies();
    assert.deepEq(counts, {
          numNormal: 0, numDrafts: 0, numPreviews: 0, numUnapproved: 0,
          // Currently, [deleted_comment_not_loaded], unless there's non-deleted
          // replies to them.
          numDeleted: 0 });
  });


  it(`A stranger goes to the homepage`, async () => {
    await stranger_brB.go2('/');
  });
  it(`... in the topic list, only the Old Page is visible`, async () => {
    await stranger_brB.forumTopicList.assertTopicTitlesAreAndOrder([oldPageTitle]);
  });
  it(`Mallory got logged out (it's really the stranger, not Mallory)`, async () => {
    await stranger_brB.topbar.waitUntilLoginButtonVisible();
  });


  it(`Modya goes to the banned users list, in the admin area  TyTMODN_SUSPLS`, async () => {
    await modya_brA.go2('/-/admin/users/suspended');
  });
  it(`... sees Mallory, Michael and Maria in the list`, async () => {
    await modya_brA.adminArea.users.assertUsenamesAreAndOrder([
            mallory.username, michael.username, maria.username]);
  });

  it(`Modya goes to the Moderation tab`, async () => {
    await modya_brA.adminArea.review.goHere();
  });
  it(`... there's 5 tasks per person (Mallory, Michael, Maria)`, async () => {
    const key = {};
    key[maria.username] = 5;
    key[michael.username] = 5;
    key[mallory.username] = 5;
    assert.deepEq(await modya_brA.adminArea.review.countTasksByUsername(), key);
  });
  it(`Modya ticks the 'Hide completed' checkbox  TyT05KD2SM1`, async () => {
    await modya_brA.adminArea.review.hideCompletedTasks();
  });
  it(`... all tasks gone, thanks to Modya having banned everyone  TyTMODN_TASKINV`, async () => {
    assert.eq(await modya_brA.adminArea.review.countThingsToReview(), 0);
    assert.not(await modya_brA.adminArea.review.isMoreStuffToReview()); // ttt
  });

});

