/// <reference path="../test-types.ts"/>

// CR_MISSING

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { checkEmailsTo } from '../utils/emails-e2e';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { E2eVote, E2eAuthor } from '../test-types';
import { ForbiddenPs } from '../test-types2';
import { TestAnonStatus, TestNeverAlways } from '../test-constants';
import c from '../test-constants';
import { j2s, logBoring, logDebug, die } from '../utils/log-and-die';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;

let owen: Member;
let owen_brA: TyE2eTestBrowser;
let owensForbiddenWords: St[] | U;
let owensForbiddenPs: ForbiddenPs;

const owensAnonsUrl = '/-/users/-11';
// Owen does the first anon interaction (except for posting the orig post, but
// no orig post avatar is shown, currently [no_op_avatar]) —  he gets avatar 'A'.
const owensAnonsLetters = 'A';
const owensAnonAuthor: E2eAuthor = {
  username: null,
  fullName: c.PermAnonName,
  profileUrl: owensAnonsUrl,
  avatarText: owensAnonsLetters,
  saysIsYou: false,
};
const owenSelf: E2eAuthor = {
  username: 'owen_owner',
  fullName: 'Owen Owner',
  profileUrl: '/-/users/owen_owner',
  avatarText: 'O',
  saysIsYou: false,
};

let maja: Member;
let maja_brB: TyE2eTestBrowser;
let majasForbiddenWords: St[] | U;
let majasForbiddenPs: ForbiddenPs;
const majasAnonsUrl = '/-/users/-10';
const majasAnonsLetters = 'A2';
const majasAnonAuthor: E2eAuthor = {
  username: null,
  fullName: c.PermAnonName,
  profileUrl: majasAnonsUrl,
  avatarText: majasAnonsLetters,
  saysIsYou: false,
};
const majaSelf: E2eAuthor = {
  username: 'maja',
  fullName: 'Maja Gräddnos',
  profileUrl: '/-/users/maja',
  avatarText: 'M',
  saysIsYou: false,
};

let michael: Member;
let michael_brB: TyE2eTestBrowser;
let michaelsForbiddenWords: St[] | U;
let michaelsForbiddenPs: ForbiddenPs;
/*
const michaelsAnonsUrl = '/-/users/-12';
// Michael is the third person to vote or comment — he gets letter A3.
const michaelsAnonsLetters = 'A3';
const michaelsAnonAuthor: E2eAuthor = {
  username: null,
  fullName: 'Anonym',
  profileUrl: michaelsAnonsUrl,
  avatarText: michaelsAnonsLetters,
  saysIsYou: false,
}; */



let site: IdAddress;
let forum: TwoCatsTestForum;  // or TwoPagesTestForum or EmptyTestForum or LargeTestForum


let majasPagePath: St | U;
const ma_x_jasPage = {
  title: 'ma_x_jasPage_title',
  body: 'ma_x_jasPage_body',
};

const ow_ensReply1 = 'ow_ensReply1';
const ow_ensReply2 = 'ow_ensReply2';
const ma_jasReply = 'ma_jasReply';
const mi_chaelsReply1 = 'mi_chaelsReply1';
const mi_chaelsReply2 = 'mi_chaelsReply2';

const ow_ensReplyText = 'ow_ensReplyText';
const ma_jasReplyToOw_enText = 'ma_jasReplyToOw_enText';
const ow_ensReplyToMa_jasReplyText = 'ow_ensReplyToMa_jasReplyText';
const ma_jaContinuesText = 'ma_jaContinuesText';
const ma_jaContinuesText2 = 'ma_jaContinuesText2';
const ow_enContinuesText2 = 'ow_enContinuesText2';
const ma_jaFinishesThread = 'ma_jaFinishesThread';

const ow_ensThreadTwoStart = 'ow_ensThreadTwoStart';
const ow_ensThreadTwoCtd = 'ow_ensThreadTwoCtd';
const ow_ensThreadThreeStart = 'ow_ensThreadThreeStart';

const allPostTexts = [
        ma_x_jasPage.title,
        ma_x_jasPage.body,
        ow_ensReply1,
        ow_ensReply2,
        ma_jasReply,
        mi_chaelsReply1,
        mi_chaelsReply2,
        ow_ensReplyText,
        ma_jasReplyToOw_enText,
        ow_ensReplyToMa_jasReplyText,
        ma_jaContinuesText,
        ma_jaContinuesText2,
        ow_enContinuesText2,
        ma_jaFinishesThread,
        ow_ensThreadTwoStart,
        ow_ensThreadTwoCtd,
        ow_ensThreadThreeStart,
        ];

let owenIdName: St[] | U;
let majaIdName: St[] | U;
let michaelIdName: St[] | U;

let lastPostNr = 0;

let expectedNumEmails = 0;


describe(`alias-anons-true-mixed.2br.f  TyTALIANONTRUEMX`, () => {

  it(`Construct site`, async () => {
    make.setNextUserId(1020304001); // [e2e_forbidden_anon_ids]

    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "E2e: Sensitive Anon Discs",
      members: ['mei', 'maja', 'michael']
    });

    // +  Configure Sensitive Anon Discs, see:  alias-anons-edit-alter.2br.f.e2e.ts

    // Disable notifications, or notf email counts will be off
    // (since Owen would get emails).
    builder.settings({
      numFirstPostsToApprove: 0,
      //maxPostsPendApprBefore: 0,
      numFirstPostsToReview: 0,
    });
    builder.getSite().pageNotfPrefs = [{
      memberId: forum.members.owen.id,
      notfLevel: c.TestPageNotfLevel.EveryPostAllEdits,
      wholeSite: true,
    }];

    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    maja = forum.members.maja;
    maja_brB = brB;
    michael = forum.members.michael;
    michael_brB = brB;

    const forbiddenPs = { forbiddenWordsOkInPresence: false, shouldFindWords: allPostTexts };

    owenIdName    = ['' + owen.id, "owen", owen.username, owen.fullName];
    majaIdName    = ['' + maja.id, maja.username, maja.fullName];
    michaelIdName = ['' + michael.id, michael.username, michael.fullName];
    assert.eq(michael.id, 1020304004); // or test fails below

    owensForbiddenWords = [...majaIdName, ...michaelIdName];
    owensForbiddenPs = { forbiddenWords: owensForbiddenWords, ...forbiddenPs };

    majasForbiddenWords = [...owenIdName, ...michaelIdName];
    majasForbiddenPs = { forbiddenWords: majasForbiddenWords, ...forbiddenPs };

    michaelsForbiddenWords = [...owenIdName, ...majaIdName];
    michaelsForbiddenPs = { forbiddenWords: michaelsForbiddenWords, ...forbiddenPs };

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });



  // Not finished!


  // ============================================
  return;
  // ============================================

  // ----- Default oneself

  it(`Maja goes to Category A`, async () => {
    await maja_brB.go2(site.origin + '/latest/category-a');
    await maja_brB.complex.loginWithPasswordViaTopbar(maja);
  });
  it(`Maja starts composing a topic`, async () => {
    await maja_brB.forumButtons.clickCreateTopic();
  });
  it(`... a Post-as dropdown appears`, async () => {
    await maja_brB.waitForVisible('.c_AliasB');
  });
  it(`... with as-you pre-selected  (anonymity is Allowed, not Recommended)`, async () => {
    await maja_brB.editor.waitForAnonPurpose(TestAnonStatus.NotAnon);
  });
  it(`... she submits the topic`, async () => {
    await maja_brB.editor.editTitle(ma_x_jasPage.title);
    await maja_brB.editor.editText(ma_x_jasPage.body);
    await maja_brB.complex.saveTopic(ma_x_jasPage);
    majasPagePath = await maja_brB.urlPath();
  });


  it(`Owen starts replying to Maja`, async () => {
    await owen_brA.go2(majasPagePath);
    await owen_brA.topic.clickReplyToPostNr(c.BodyNr);
  });
  it(`... a Post-as shows Anonymous`, async () => {
    await owen_brA.waitForVisible('.c_AliasB');
  });
  it(`... he's also himself`, async () => {
    await owen_brA.editor.waitForAnonPurpose(TestAnonStatus.NotAnon);
  });
  it(`... he submits his comment`, async () => {
    await owen_brA.editor.editText(ow_ensReplyText);
    await owen_brA.editor.save();
  });


  // ----- Really not anon?  [_OP_and_1st_reply]

  it(`Maja sees she's not anonymous`, async () => {
    const author = await maja_brB.topic.getPostAuthor(c.BodyNr);
    assert.deepEqual(author, { ...majaSelf, avatarText: null });
  });
  it(`Maja sees Owen too — he's also not anonymous`, async () => {
    await maja_brB.topic.waitForPostNrVisible(c.FirstReplyNr, { refreshBetween: true });
    const author = await maja_brB.topic.getPostAuthor(c.FirstReplyNr);
    assert.deepEqual(author, owenSelf);
  });


  // ----- Switch to anon

  // Works for page author:
  it(`Maja starts replying to Owen's reply to her`, async () => {
    lastPostNr = c.FirstReplyNr;
    await maja_brB.topic.clickReplyToPostNr(lastPostNr);
  });
  it(`... she's herself`, async () => {
    await maja_brB.editor.waitForAnonPurpose(TestAnonStatus.NotAnon);
  });
  it(`... but swiches to Anonymous`, async () => {
    await maja_brB.waitAndClick('.c_AliasB');
    await maja_brB.waitAndClick('.e_AnonPrmB');
  });
  it(`... submits`, async () => {
    await maja_brB.editor.editText(ma_jasReplyToOw_enText);
    await maja_brB.editor.save();
    //await maja_brB.waitAndClick('.e_AnoMby .e_HelpOk');
    lastPostNr += 1;
  });

  // Commenter:
  it(`Owen starts replying to Maja's reply to him`, async () => {
    await owen_brA.topic.waitForPostNrVisible(lastPostNr, { refreshBetween: true });
    await owen_brA.topic.clickReplyToPostNr(lastPostNr);
  });
  it(`... he is himself`, async () => {
    await owen_brA.editor.waitForAnonPurpose(TestAnonStatus.NotAnon);
  });
  it(`... swiches to Anonymous, he too`, async () => {
    await owen_brA.editor.setAnonPurpose(TestAnonStatus.IsAnonOnlySelfCanDeanon);
  });
  it(`... he submits his comment`, async () => {
    await owen_brA.editor.editText(ow_ensReplyToMa_jasReplyText);
    await owen_brA.editor.save();
    //await owen_brA.waitAndClick('.e_AnoMby .e_HelpOk');
    lastPostNr += 1;
  });


  // ----- Continue as anon

  // Comments:
  it(`Maja continues the thread`, async () => {
    await maja_brB.topic.waitForPostNrVisible(lastPostNr, { refreshBetween: true });
    await maja_brB.topic.clickReplyToPostNr(lastPostNr);
  });
  it(`... now she's Anonymous — Talkyard looks at her last comment in the thread`, async () => {
    await maja_brB.waitForVisible('.e_AnonPrm');
  });
  it(`... submits`, async () => {
    await maja_brB.editor.editText(ma_jaContinuesText);
    await maja_brB.editor.save();
    lastPostNr += 1;
  });

  // Votes:
  it(`Owen likes how Maja continued writing — anonymously since his last
            comment was anonymous`, async () => {
    await owen_brA.topic.waitForPostNrVisible(lastPostNr, { refreshBetween: true });
    await owen_brA.topic.clickLikeVote(lastPostNr);
  });


  // ----- Switch to true user

  // Maja:
  it(`Maja continues even more`, async () => {
    await maja_brB.topic.clickReplyToPostNr(lastPostNr);
  });
  it(`... she's anonymous — but switches to herself`, async () => {
    await maja_brB.waitForVisible('.e_AnonPrm');
    await maja_brB.waitAndClick('.c_AliasB');
    await maja_brB.waitAndClick('.e_AsSelfB');
  });
  it(`... submits`, async () => {
    await maja_brB.editor.editText(ma_jaContinuesText2);
    await maja_brB.editor.save();
    lastPostNr += 1;
  });

  // Owen:
  it(`Owen continues too, even more`, async () => {
    await owen_brA.topic.waitForPostNrVisible(lastPostNr, { refreshBetween: true });
    await owen_brA.topic.clickReplyToPostNr(lastPostNr);
  });
  it(`... he's Anonymous, but switches to himself he too`, async () => {
    await owen_brA.waitForVisible('.e_AnonPrm');
    await owen_brA.waitAndClick('.c_AliasB');
    await owen_brA.waitAndClick('.e_AsSelfB');
  });
  it(`... submits`, async () => {
    await owen_brA.editor.editText(ow_enContinuesText2);
    await owen_brA.editor.save();
    lastPostNr += 1;
  });


  // ----- Continue as true

  // Comments:
  it(`Maja finishes the thread`, async () => {
    await maja_brB.topic.waitForPostNrVisible(lastPostNr, { refreshBetween: true });
    await maja_brB.topic.clickReplyToPostNr(lastPostNr);
  });
  it(`... she's herself — becuse her last comment in the thread is`, async () => {
    await maja_brB.editor.waitForAnonPurpose(TestAnonStatus.NotAnon);
  });
  it(`... submits`, async () => {
    await maja_brB.editor.editText(ma_jaFinishesThread);
    await maja_brB.editor.save();
    lastPostNr += 1;
  });

  // Votes:
  it(`Owen likes how Maja gracefully finished the thread`, async () => {
    await owen_brA.topic.waitForPostNrVisible(lastPostNr, { refreshBetween: true });
    await owen_brA.topic.clickLikeVote(lastPostNr);
  });



  // ----- Choose, if been both true & anon

  // Choose anon
  let subThreadTwoStartNr: PostNr | U;
  it(`Owen starts another top level reply to Maja's OP`, async () => {
    await owen_brA.topic.clickReplyToPostNr(c.BodyNr);
  });
  it(`... a Post-as is visible`, async () => {
    await owen_brA.waitForVisible('.c_AliasB');
  });
  it(`... he needs to choose: Self or Anon, since he's been both in other threads on this page`,
          async () => {
    // TESTS_MISSING
    // await owen_brA.waitForVisible('.e_ChooseAlias');
  });
  it(`... he chooses anon`, async () => {
    await owen_brA.waitAndClick('.c_AliasB');
    await owen_brA.waitAndClick('.e_AnonPrmB');
  });
  it(`... he submits his comment`, async () => {
    await owen_brA.editor.editText(ow_ensThreadTwoStart);
    await owen_brA.editor.save();
    lastPostNr += 1;
    subThreadTwoStartNr = lastPostNr;
  });

  // Choose self
  it(`Owen starts another top level reply to Maja's OP`, async () => {
    await owen_brA.topic.clickReplyToPostNr(c.BodyNr);
  });
  it(`... a Post-as is visible`, async () => {
    await owen_brA.waitForVisible('.c_AliasB');
  });
  it(`... again, he needs to choose: Self or Anon`, async () => {
    // TESTS_MISSING
    // await owen_brA.waitForVisible('.e_ChooseAlias');
  });
  it(`... he chooses Self`, async () => {
    await owen_brA.waitAndClick('.c_AliasB');
    await owen_brA.waitAndClick('.e_AsSelfB');
  });
  it(`... he submits his comment`, async () => {
    await owen_brA.editor.editText(ow_ensThreadThreeStart);
    await owen_brA.editor.save();
    lastPostNr += 1;
  });


  // ----- Auto anon in 2nd sub thread

  it(`Owen replies to himself in his 2nd subthread — he was last anon there`, async () => {
    await owen_brA.topic.clickReplyToPostNr(subThreadTwoStartNr);
  });
  it(`... a Post-as is visible`, async () => {
    await owen_brA.waitForVisible('.c_AliasB');
  });
  it(`... he's anon by default — since he was before, in this sub thread`, async () => {
    await owen_brA.waitForVisible('.e_AnonPrm');
  });
  it(`... he submits his comment`, async () => {
    await owen_brA.editor.editText(ow_ensThreadTwoCtd);
    await owen_brA.editor.save();
    lastPostNr += 1;
  });


  // ----- Check anon / true

  // (_OP_and_1st_reply checked above)
  let checkPostNr = c.FirstReplyNr;
  let author: E2eAuthor | U;

  it(`Maja sees the correct anons & true users. Check: Switched to anons`, async () => {
    // Votes aren't sent via Websocket, so need to refresh the page.
    await maja_brB.refresh2();
    // Better wait for the last comment too (this might do nothing).
    await maja_brB.topic.waitForPostNrVisible(lastPostNr, { refreshBetween: true });

    checkPostNr += 1;
    author = await maja_brB.topic.getPostAuthor(checkPostNr);
    assert.deepEqual(author, { ...majasAnonAuthor, saysIsYou: true });

    checkPostNr += 1;
    author = await maja_brB.topic.getPostAuthor(checkPostNr);
    assert.deepEqual(author, owensAnonAuthor);
  });

  it(`Check: Continued as anons`, async () => {
    checkPostNr += 1;
    author = await maja_brB.topic.getPostAuthor(checkPostNr);
    assert.deepEqual(author, { ...majasAnonAuthor, saysIsYou: true });

    await maja_brB.topic.openLikeVotes(checkPostNr); // Owen upvoted
    const votes: E2eVote[] = await maja_brB.topic.votesDiag.getVotes({ exactly: 1 });
    assert.deepEq(votes, [
          { avatarText: owensAnonsLetters, voteUrl: owensAnonsUrl, isMine: false },
          ] satisfies E2eVote[]);
    await maja_brB.topic.votesDiag.close();
  });

  it(`Check: Switch to true user`, async () => {
    checkPostNr += 1;
    author = await maja_brB.topic.getPostAuthor(checkPostNr);
    assert.deepEqual(author, majaSelf);

    checkPostNr += 1;
    author = await maja_brB.topic.getPostAuthor(checkPostNr);
    assert.deepEqual(author, owenSelf);
  });

  it(`Check: Continued as anons`, async () => {
    checkPostNr += 1;
    author = await maja_brB.topic.getPostAuthor(checkPostNr);
    assert.deepEqual(author, majaSelf);

    await maja_brB.topic.openLikeVotes(checkPostNr); // Owen upvoted
    const votes = await maja_brB.topic.votesDiag.getVotes({ exactly: 1 });
    assert.deepEq(votes, [
          { avatarText: owenSelf.avatarText, voteUrl: owenSelf.profileUrl, isMine: false },
          ] satisfies E2eVote[]);
  });

  it(`Check: Owen's sub thread 2`, async () => {
    author = await maja_brB.topic.getPostAuthor(subThreadTwoStartNr);
    assert.deepEqual(author, owensAnonAuthor);
    // Sub thread 2 end (another sub thread 3 comment in betweeen, so + 2).
    author = await maja_brB.topic.getPostAuthor(subThreadTwoStartNr + 2);
    assert.deepEqual(author, owensAnonAuthor);
  });

  it(`Check: Owen's sub thread 3`, async () => {
    author = await maja_brB.topic.getPostAuthor(subThreadTwoStartNr + 1);
    assert.deepEqual(author, owenSelf);
  });

});

