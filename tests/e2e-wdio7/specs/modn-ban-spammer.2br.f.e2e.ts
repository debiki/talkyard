/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';
import { logBoring } from '../utils/log-and-die';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let angryElk: Member;
let angryElk_brA: TyE2eTestBrowser;
let maria: Member;
let maria_brB: TyE2eTestBrowser;
let merche: Member;
let merche_brB: TyE2eTestBrowser;
let mallory: Member;
let mallory_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoCatsTestForum;

/* Structure:

We_are_protesting!   (Angry Elk)
    Use zebra_crossing  (by Maria)
    What are you rambling_about? Are you drunk?   (Merche)  <— —ban & delete,
                                                                deletes Michaels topic too
Elk stew  (by Maria)
    We want safety! (Angry Elk)

Mashed potatoes (by Maria)   <— ban & delete, deletes all Maria's

Who_ate_my_apples  (by Merche)

Buy v14gr4   (by Mallory, spammer)
    Where can I do that?  (Angry Elk)
    Send money to .... (Mallory)   <— banning & deleting this, should delete the whole page
                                      since Mallory is the page author too
*/


const angryElksTopicA_title = 'We_are_protesting!';
const angryElksTopicA_body =
    `We have had enough! We demand free passage accross all roads.`;
let angryElksUrl: St | U;

const mariasReply_zebraCrossing = `Can't you just use the zebra_crossing?`;

const merchesReply_ramblingDrunk = `What are you rambling_about? Are you drunk?`;
// The first reply is by Maria. It gets deleted by Owen.
const merchesReplyNr = c.SecondReplyNr;

const mariasTopic_elkStew = {
  title: `Elk_stew_recipie?`,
  body: `I just got my license, and there's elks here. Any recipie_suggestion?`
};

const mariasTopic_mashedPotatoes = {
  title: `Mashed_potatoes`,
  body: `Do I need to mash the potatoes? With my clogs_or_a_hammer`
};

// const angryElksReplyToMariasTopic1 =
//     `We want safety in our own forrest!
//     We demand that all hunting be forbidden!
//     And more equality, and we need to get rid of all the cars and traffic from the roads`;

const merchesTopic_ateApples = {
  title: `Who_ate_my_apples`,
  body: `Someone ate all_my_apples, why would anyone do that`
};

const mallorysTopic_v14gr4 = {
  title: `Buy_v14gr4`,
  body: `Cheap v14gr4 who wants`
};

const mallorysTopic2 = {
  title: `I ship to all forrests`,
  body: `Look at a tree and say what you want, and you'll get it dropshipped a week later!
        Anything! An inflatable elk to confuse the hunters? Easy!`
};

const mallorysComment2 = `But pay to the following BitCoin address first, wait`;

let mallorysPageUrl: St | U;
let mallorysPage2Url: St | U;

const angryElksReplyToMallory = `Where can I do that? Can you ship to the murky ` +
          `tree at the stone near the lake?`;
const mallorysReplyToAngryElk = `Sure, just pay to this BitCoin address, wait`;



describe(`modn-ban-spammer.2br.f  TyTMODNBANSPM`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "Ban Spam E2E Test",
      members: ['mons', 'maria', 'mallory']
    });

    builder.settings({
      numFirstPostsToApprove: 3,
      maxPostsPendApprBefore: 3,
      numFirstPostsToReview: 0,
    });

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;
    angryElk = make.member('angryelk', { fullName: "Angry Elk" });
    angryElk_brA = brA;

    maria = forum.members.maria;
    maria_brB = brB;
    merche = make.memberMerche();
    merche_brB = brB;
    mallory = forum.members.mallory;
    mallory_brB = brB;

    // Changing trust & threat levels:
    mallory.trustLevel = c.TestTrustLevel.Basic;
    mallory.threatLevel = c.TestThreatLevel.HopefullySafe;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  it(`Angry Elk, who is indeed angry, like the name implies, goes to the forum`, async () => {
    await angryElk_brA.go2(site.origin);
  });
  it(`... signs up`, async () => {
    await angryElk_brA.complex.signUpAsMemberViaTopbar(angryElk);
  });
  it(`... verifies his email`, async () => {
    const url = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(
            site.id, angryElk.emailAddress);
    await angryElk_brA.go2(url);
    await angryElk_brA.hasVerifiedSignupEmailPage.clickContinue();
  });


  it(`Angry Elk creates a new topic, it'll be pending approval`, async () => {
    await angryElk_brA.complex.createAndSaveTopic({
          title: angryElksTopicA_title,
          body: angryElksTopicA_body,
          willBePendingApproval: true });
    angryElksUrl = await angryElk_brA.getUrl();
  });
  it(`Angry Elk leaves, in an unusually bad mood`, async () => {
    await angryElk_brA.topbar.clickLogout();
  });

  it(`Owen logs in, goes to the moderation page`, async () => {
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
    await owen_brA.topbar.myMenu.goToAdminReview();
  });
  it(`... approves Angry Elk's topic`, async () => {
    await owen_brA.adminArea.review.approvePostForMostRecentTask();
    await owen_brA.adminArea.review.playTimePastUndo();
  });


  // ----- Post comment, 2 pages

  it(`Maria goes to Angry Elk's page, it gets approved ...`, async () => {
    // There's a _race: Page might load, before it's been approved and rerendered.
    // So, refresh and retry.
    await maria_brB.go2(angryElksUrl);
    await maria_brB.refreshUntil(async () => {
      return await maria_brB.topbar.isVisible();
    })
  });
  it(`Maria logs in`, async () => {
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });
  it(`... replies to Angry Elk`, async () => {
    await maria_brB.complex.replyToOrigPost(mariasReply_zebraCrossing);
  });
  it(`... posts a new topic: Elk stew?  (will be 2nd _most_recent)`, async () => {
    await maria_brB.topbar.clickHome();
    await maria_brB.complex.createAndSaveTopic({ ...mariasTopic_elkStew,
              willBePendingApproval: true });
  });
  it(`... posts another topic: Mashed potatoes`, async () => {
    await maria_brB.topbar.clickHome();
    await maria_brB.complex.createAndSaveTopic({ ...mariasTopic_mashedPotatoes,
              willBePendingApproval: true, matchAfter: false });
  });


  // ----- Banning via page

  // This should delete [other pages and comments in the moderation queue] by the spammer.

  it(`Owen reloads the moderation page, sees Maria's elk stew topic`, async () => {
    await owen_brA.refresh2();
  });
  it(`... bans Maria, via the elk stew topic`, async () => {
    await owen_brA.adminArea.review.banAndDeleteTaskNr(2);  // 2nd _most_recent
    await owen_brA.adminArea.review.playTimePastUndo();
  });

  it(`Maria no longer sees her mashed potatoes page: it's deleted, not approved`, async () => {
    // Isn't this a _race too,  should use   refreshUntil(async () => { ... }) ?  [E2EBUG]
    // Also see _untested below.
    await maria_brB.refresh2();
    await maria_brB.assertNotFoundError();
  });
  it(`... she's no longer logged in`, async () => {
    await maria_brB.waitAndClick('.s_LD_NotFound_HomeL');
    await maria_brB.me.waitUntilKnowsNotLoggedIn();
    await maria_brB.topbar.waitUntilLoginButtonVisible(); // ttt
  });
  it(`... and can't log in`, async () => {
    await maria_brB.topbar.clickLogin();
    await maria_brB.loginDialog.loginWithPassword(maria, { resultInError: true });
  });
  it(`... an error dialog says "Banned"`, async () => {
    await maria_brB.serverErrorDialog.waitForBannedError('WhenLoggingIn');
  });


  // ----- Post comment and page

  it(`Merche signs up`, async () => {
    await merche_brB.refresh2();
    await merche_brB.complex.signUpAsMemberViaTopbar(merche);
  });
  it(`... verifies her email`, async () => {
    const url = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(
            site.id, merche.emailAddress);
    await merche_brB.go2(url);
    await merche_brB.hasVerifiedSignupEmailPage.clickContinue();
  });

  it(`... posts a topic: Apples`, async () => {
    await merche_brB.complex.createAndSaveTopic({ ...merchesTopic_ateApples,
            willBePendingApproval: true, matchAfter: false });
  });
  it(`... replies to Angry Elk: rambling_about  (will be  _most_recent)`, async () => {
    await merche_brB.go2(angryElksUrl);
    await merche_brB.complex.replyToOrigPost(merchesReply_ramblingDrunk)
  });


  // ----- Banning via comment

  // This too should delete [other stuff in the queue] by the spammer.

  it(`Owen reloads the moderation page, sees Merche's comment`, async () => {
    await owen_brA.refresh2();
  });
  it(`... bans Merche, via task nr 1, the comment`, async () => {
    await owen_brA.adminArea.review.banAndDeleteTaskNr(1); // the _most_recent
    await owen_brA.adminArea.review.playTimePastUndo();
  });

  it(`Merche still sees her unapproved comment`, async () => {
    await merche_brB.topic.assertPostNeedsApprovalBodyVisible(merchesReplyNr);
  });
  it(`... but after page reload, it's gone: Deleted, not approved`, async () => {
    // Another _race, another loop.
    await merche_brB.refreshUntil(async () => {
      await merche_brB.topic.waitForPostNrVisible(c.BodyNr);
      return !await merche_brB.topic.isPostNrVisible(merchesReplyNr);
    });
  });
  it(`... she's no longer logged in`, async () => {
    await merche_brB.me.waitUntilKnowsNotLoggedIn();
  });
  it(`... can't log in`, async () => {
    await merche_brB.topbar.clickLogin();
    await merche_brB.loginDialog.loginWithPassword(merche, { resultInError: true });
  });
  it(`... an error dialog says "Banned"`, async () => {
    await merche_brB.serverErrorDialog.waitForBannedError('WhenLoggingIn');
  });


  // ----- Owen changes settings to review-after

  it(`Owen changes settings to review-after`, async () => {
    await owen_brA.adminArea.settings.moderation.goHere();
    await owen_brA.adminArea.settings.moderation.setNumFirstToApproveBefore(0);
    await owen_brA.adminArea.settings.moderation.setNumFirstToReviewAfter(4);
    await owen_brA.adminArea.settings.moderation.setMaxNumPendingReview(4);
    await owen_brA.adminArea.settings.clickSaveAll();
  });

  // ----- Banning via spam comment on spam page

  // When deleting a spammer's comment on a spam page by the same spammer,
  // the whole page should get deleted, not just the comment.

  it(`Mallory arrives, posts a spam page`, async () => {
    await mallory_brB.go2('/')
    await mallory_brB.complex.loginWithPasswordViaTopbar(mallory);
    await mallory_brB.complex.createAndSaveTopic({ ...mallorysTopic_v14gr4, matchAfter: false });
    mallorysPageUrl = await mallory_brB.getUrl();
  });

  it(`Angry Elk is back`, async () => {
    await owen_brA.topbar.clickLogout();
    await angryElk_brA.complex.loginWithPasswordViaTopbar(angryElk);
    await angryElk_brA.go2(mallorysPageUrl);
  });
  it(`... replies to Mallory's spam page`, async () => {
    await angryElk_brA.complex.replyToOrigPost(angryElksReplyToMallory);
  });

  it(`Mallory replies to Angry Elk  (will be Mallory's _most_recent post)`, async () => {
    // Angry Elk's reply should have appeared via WebSocket.  TyTWS702MEGR5
    await mallory_brB.complex.replyToPostNr(c.FirstReplyNr, mallorysReplyToAngryElk);
  });

  it(`... posts another spam page, with a comment`, async () => {
    await mallory_brB.go2('/')
    await mallory_brB.complex.createAndSaveTopic({ ...mallorysTopic2, matchAfter: false });
    await mallory_brB.complex.replyToOrigPost(mallorysComment2);
    mallorysPage2Url = await mallory_brB.getUrl();
  });

  it(`Owen is back`, async () => {
    await angryElk_brA.topbar.clickLogout();
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  it(`... Owen goes to the moderation page`, async () => {
    await owen_brA.topbar.myMenu.goToAdminReview();
  });
  it(`... bans Mallory via his comment — should delete the whole page`, async () => {
    await owen_brA.adminArea.review.banAndDeleteTaskNr(1); // the comment is _most_recent
    await owen_brA.adminArea.review.playTimePastUndo();
  });

  it(`Mallory no longer sees his spam page: it's deleted`, async () => {
    // A _race, loop until deleted server side.
    await mallory_brB.refreshUntil(async () => {
      try { await mallory_brB.assertNotFoundError(); }
      catch (ex) {
        logBoring(`Waiting for Mallory's page to get deleted ...`);
        return false;  // _untested  UNTESTED
      }
      return true;
    });
  });
  it(`... he's no longer logged in`, async () => {
    await mallory_brB.waitAndClick('.s_LD_NotFound_HomeL');
    await mallory_brB.me.waitUntilKnowsNotLoggedIn();
  });
  it(`... and can't log in`, async () => {
    await mallory_brB.topbar.clickLogin();
    await mallory_brB.loginDialog.loginWithPassword(mallory, { resultInError: true });
  });
  it(`... an error dialog says "Banned"`, async () => {
    await mallory_brB.serverErrorDialog.waitForBannedError('WhenLoggingIn');
  });

  // Angry Elk's reply to Mallory doesn't get deleted, and it's still in the
  // moderation queue. But the page it's on, got deleted.
  // That's ok, the mods are supposed to review Angry Elk's first comments, and
  // now they can do that.
  it(`Owen looks at Mallory's deleted page, sees it's deleted`, async () => {
    await owen_brA.go2(mallorysPageUrl);
    await owen_brA.topic.waitUntilPageDeleted();
  });

  it(`... Angry Elks' comment is still there (although the page in inaccessible)`, async () => {
    await owen_brA.topic.assertPostTextIs(c.FirstReplyNr, angryElksReplyToMallory);
  });

  it(`Owen looks at Mallory's other page, it's been deleted, too`, async () => {
    await owen_brA.go2(mallorysPage2Url);
    await owen_brA.topic.waitUntilPageDeleted();
  });

  it(`Owen returns to the review queue`, async () => {
    await owen_brA.topbar.myMenu.goToAdminReview();
  });

  it(`... there's 4 tasks caused by Mallory  (2 pages, 2 comments)`, async () => {
    const tasksByUsername = await owen_brA.adminArea.review.countTasksByUsername();
    assert.eq(tasksByUsername[mallory.username], 4);
  });

  it(`... Owen hides completed tasks`, async () => {
    await owen_brA.adminArea.review.hideCompletedTasks();
  });

  let tasksByUsername: { [username: St]: Nr };

  it(`... now all review tasks about Mallory disappear: they're done or invalidated`, async () => {
    tasksByUsername = await owen_brA.adminArea.review.countTasksByUsername();
    assert.not(tasksByUsername[mallory.username]);
  });

  it(`... only Angry Elk's comment remains  TyTMODN_AUTHRNAME`, async () => {
    assert.deepEq(tasksByUsername, { angryelk: 1 });
  });

});

