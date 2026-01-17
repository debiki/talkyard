/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import * as fs from 'fs';
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
let mallory: Member;
let mallory_brB: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

const localHostname = 'comments-for-e2e-test-embdftpv';
const embeddingOrigin = 'http://e2e-test-embdftpv.localhost:8080';

let site: IdAddress;
let forum: TwoCatsTestForum;

const replA_toApr_txt = 'replA_toApr_txt';
const replA_toApr_nr = c.FirstReplyNr;
const replB_txt = 'replB_txt';
const replB_nr = c.FirstReplyNr + 1;
const replC_toRej_txt = 'replC_toRej_txt';
const replC_toRej_nr = c.FirstReplyNr + 2;
const replD_toEdApr_txt = 'replD_toEdApr_txt';
const replD_toEdApr_nr = c.FirstReplyNr + 3;
const replD_more_txt = ' replD_more_txt';

const replE_txt = 'replE_txt';
const replE_nr = c.FirstReplyNr + 4;
const replF_toBan_txt = 'replF_toBan_txt';
const replF_toBan_nr = c.FirstReplyNr + 5;


// In this test:
//
// Maria posts embedded comments.  Owen owner edits, approves, rejects directly from the emb page.
// Mallory posts spam, Owen bans, directly from the emb page.
//
// Similar to:  modn-from-disc-page-appr-befr.2br.f  TyTE2E603RTJ,
// but this test is for embedded comments, that test is for forums.
//
describe(`embcom-modn-from-disc-appr-befr.2br.ec  TyTEC_MODN_APRBF`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoCatsForum({
      title: "Some Emb Comments E2E Test",
      members: ['owen', 'maria', 'michael', 'mallory']
    });

    builder.getSite().meta.localHostname = localHostname;
    builder.settings({
      allowEmbeddingFrom: embeddingOrigin,
      numFirstPostsToApprove: 0,
      requireApprovalIfTrustLte: c.TestTrustLevel.FullMember,
      maxPostsPendApprBefore: 4,
      numFirstPostsToReview: 0,
    });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.Muted,
      wholeSite: true,
    }];

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;
    mallory = forum.members.mallory;
    mallory_brB = brB;
    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });


  it(`Create embedding page`, () => {
    const dir = 'target';
    fs.writeFileSync(`${dir}/page-mod-from.html`, makeHtml('mod-from', '#500'));
    function makeHtml(pageName: St, bgColor: St): St {
      return utils.makeEmbeddedCommentsHtml({
              pageName, discussionId: '', localHostname, bgColor});
    }
  });


  it(`Maria goes to the embedding page`, async () => {
    await maria_brB.go2(embeddingOrigin + '/page-mod-from.html');
  });

  it(`... logs in`, async () => {
    await maria_brB.complex.loginIfNeededViaMetabar(maria);
  });

  // Similar to: [approve_comments_bef_from_disc], which is for forum pages (not emb comments).
  it(`Maria posts 4 comments`, async () => {
    await maria_brB.complex.replyToEmbeddingBlogPost(replA_toApr_txt);
    await maria_brB.complex.replyToEmbeddingBlogPost(replB_txt);
    await maria_brB.complex.replyToEmbeddingBlogPost(replC_toRej_txt);
    await maria_brB.complex.replyToEmbeddingBlogPost(replD_toEdApr_txt);
  });

  it(`... they become pending-approval`, async () => {
    await maria_brB.topic.assertPostNeedsApprovalBodyVisible(replA_toApr_nr);
    await maria_brB.topic.assertPostNeedsApprovalBodyVisible(replB_nr);
    await maria_brB.topic.assertPostNeedsApprovalBodyVisible(replC_toRej_nr);
    await maria_brB.topic.assertPostNeedsApprovalBodyVisible(replD_toEdApr_nr);
  });

  it(`Owen goes to the embedding page`, async () => {
    await owen_brA.go2(embeddingOrigin + '/page-mod-from.html');
  });
  it(`... logs in`, async () => {
    await owen_brA.complex.loginIfNeededViaMetabar(owen);
  });

  it(`Owen rejects reply C`, async () => {
    await owen_brA.topic.rejectPostNr(replC_toRej_nr);
  });

  it(`... edits reply D — before approving it`, async () => {
    await owen_brA.complex.editPostNr(replD_toEdApr_nr, replD_more_txt, { append: true });
  });

  it(`... edititing it won't approve it  TyTE2E407RKS`, async () => {
    await owen_brA.refresh2();
    await owen_brA.topic.waitForPostAssertTextMatches(  // _switches_if_needed
          replD_toEdApr_nr, replD_toEdApr_txt + replD_more_txt);
    await owen_brA.topic.assertPostNeedsApprovalBodyVisible(replD_toEdApr_nr);
    // (Reply C is gone, Owen rejected it, so 3 left.)
    assert.deepEq(await owen_brA.topic.countReplies({ skipWait: true }),
          { numNormal: 0, numPreviews: 0, numDrafts: 0, numUnapproved: 3, numDeleted: 0 });
  });

  it(`... approves reply A and D`, async () => {
    await owen_brA.topic.approvePostNr(replA_toApr_nr);
    await owen_brA.topic.approvePostNr(replD_toEdApr_nr);
  });


  it(`Maria reloads the page, sees reply D got approved`, async () => {
    await maria_brB.topic.refreshUntilPostNotPendingApproval(
            replD_toEdApr_nr, { isEmbedded: true });
  });

  it(`... reply A too`, async () => {
    await maria_brB.topic.waitForPostAssertTextMatches(replA_toApr_nr, replA_toApr_txt);
  });

  it(`... B is still pending approval. Text visible, since Maria is the author`, async () => {
    await maria_brB.topic.assertPostNeedsApprovalBodyVisible(replB_nr);
  });

  it(`Maria leaves`, async () => {
    await maria_brB.metabar.clickLogout();
  });


  it(`A stranger arrives`, async () => {
    await stranger_brB.refresh2();
    await stranger_brB.switchToEmbeddedCommentsIrame();
  });
  it(`... sees reply D incl edits  TyTE2E603SKD`, async () => {
    await stranger_brB.topic.waitForPostAssertTextMatches(  // _switches_if_needed to emb comts
          replD_toEdApr_nr, replD_toEdApr_txt + replD_more_txt);
  });

  it(`... and reply A got approved as-is`, async () => {
    await stranger_brB.topic.waitForPostAssertTextMatches(replA_toApr_nr, replA_toApr_txt);
  });

  it(`... reply B still pending approval — the stranger can't see the actual text`, async () => {
    await stranger_brB.topic.assertPostNeedsApprovalBodyHidden(replB_nr);
  });

  it(`... C gone`, async () => {
    assert.not(await stranger_brB.topic.isPostNrVisible(replC_toRej_nr));
  });

  it(`... those are all posts`, async () => {
    assert.deepEq(await stranger_brB.topic.countReplies({ skipWait: true }),
          { numNormal: 2, numPreviews: 0, numDrafts: 0, numUnapproved: 1, numDeleted: 0 });
  });


  // ----- Ban from discussion page

  it(`Mallory logs in`, async () => {
    await mallory_brB.complex.loginIfNeededViaMetabar(mallory);
  });

  it(`... posts 2 comments`, async () => {
    await mallory_brB.complex.replyToEmbeddingBlogPost(replE_txt);
    await mallory_brB.complex.replyToEmbeddingBlogPost(replF_toBan_txt);
  });

  it(`Owen sees Mallory's two unapproved posts`, async () => {
    await owen_brA.refresh2();
    await owen_brA.switchToEmbeddedCommentsIrame();
    assert.deepEq(await owen_brA.topic.countReplies({ skipWait: true }),
          { numNormal: 2, numPreviews: 0, numDrafts: 0, numUnapproved: 1 + 2, numDeleted: 0 });
  });

  it(`Owen bans Mallory! Via reply F`, async () => {
    await owen_brA.topic.banSpammerViaPostNr(replF_toBan_nr);
  });

  it(`... both Mallory's posts get deleted`, async () => {
    await owen_brA.topic.waitForPostVisibleAsDeleted(replE_nr);
    await owen_brA.topic.waitForPostVisibleAsDeleted(replF_toBan_nr);

    assert.deepEq(await owen_brA.topic.countReplies({ skipWait: true }),
          { numNormal: 2, numPreviews: 0, numDrafts: 0, numUnapproved: 1, numDeleted: 2 });
  });


  it(`Mallory can't post any more`, async () => {
    await mallory_brB.complex.startReplyingToEmbBlogPost("wont_work");
    await mallory_brB.editor.save();
  });
  it(`... there's a Not-logged-in error`, async () => {
    await mallory_brB.serverErrorDialog.waitForNotLoggedInError();
  });
  it(`... because Mallory got logged out, when banned`, async () => {
    await mallory_brB.refresh2();
    // Avoid race — don't look for the login buttons before page loaded. Not really
    // needed (because waitUntilNotLoggedIn() calls waitForMyDataAdded()), but anyway.
    await mallory_brB.topic.waitForPostAssertTextMatches(replA_toApr_nr, replA_toApr_txt);
  });
  it(`... login button visible`, async () => {
    await mallory_brB.metabar.waitUntilNotLoggedIn();
    await mallory_brB.metabar.waitForLoginButtonVisible();
  });

  it(`A stranger sees comments A and D, and B pending approval`, async () => {
    await stranger_brB.topic.waitForPostAssertTextMatches(replA_toApr_nr, replA_toApr_txt);
    await stranger_brB.topic.assertPostNeedsApprovalBodyHidden(replB_nr);
    await stranger_brB.topic.waitForPostAssertTextMatches(
                                    replD_toEdApr_nr, replD_toEdApr_txt + replD_more_txt);
  });
  it(`... but none of Mallory's posts`, async () => {
    assert.deepEq(await stranger_brB.topic.countReplies({ skipWait: true }),
          { numNormal: 2, numPreviews: 0, numDrafts: 0, numUnapproved: 1, numDeleted: 0 });
  });


  it(`Owen clicks the Admin link to the moderation page`, async () => {
    await owen_brA.switchToEmbCommentsIframeIfNeeded();
    assert.eq(await owen_brA.origin(), embeddingOrigin);
    await owen_brA.blogButtons.clickAdminLinkSwitchToModTab();
    assert.eq(await owen_brA.origin(), site.origin);
  });
  it(`... sees everyones tasks, both done and pending`, async () => {
    const expected = {};
    expected[maria.username] = 4;
    expected[mallory.username] = 2;
    assert.deepEq(await owen_brA.adminArea.review.countTasksByUsername(), expected);
  });
  it(`... Owen hides completed tasks`, async () => {
    await owen_brA.adminArea.review.hideCompletedTasks();
  });
  it(`... now sees only Maria's reply B`, async () => {
    const expected = {};
    expected[maria.username] = 1;
    assert.deepEq(await owen_brA.adminArea.review.countTasksByUsername(), expected);
  });
  it(`... with the correct text: ${replB_txt}`, async () => {
    await owen_brA.adminArea.review.waitForTextToReview(replB_txt, { index: 1 });
  });


  it(`Owen goes to the banned users list, in the admin area  TyTMODN_SUSPLS`, async () => {
    await owen_brA.go2('/-/admin/users/suspended');
    await owen_brA.adminArea.users.waitForLoaded();
  });
  it(`... sees Mallory in the list`, async () => {
    await owen_brA.adminArea.users.assertUsenamesAreAndOrder([mallory.username]);
  });

});

