/// <reference path="../test-types.ts"/>

// CR_MISSING

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { E2eVote, E2eAuthor } from '../test-types';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;

let owen: Member;
let owen_brA: TyE2eTestBrowser;
const owensAnonsUrl = '/-/users/-11';
// Owen posts the second anon reply —  he gets avatar 'A2'.
const owensAnonsLetters = 'A2';
const owensAnonAuthor: E2eAuthor = {
  username: null,
  fullName: 'Anonym',
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
const majasAnonsUrl = '/-/users/-10';
// Maja posts the first anon reply — her anon gets avatar 'A'.
const majasAnonsLetters = 'A';
const majasAnonAuthor: E2eAuthor = {
  username: null,
  fullName: 'Anonym',
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

/*
let michael: Member;
let michael_brB: TyE2eTestBrowser;
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
const majasPage = {
  title: 'majasPage_title',
  body: 'majasPage_body',
};

const owensReplyText = 'owensReplyText';
const majasReplyToOwenText = 'majasReplyToOwenText';
const owensReplyToMajasReplyText = 'owensReplyToMajasReplyText';
const majaContinuesText = 'majaContinuesText';
const majaContinuesText2 = 'majaContinuesText2';
const owenContinuesText2 = 'owenContinuesText2';
const majaFinishesThread = 'majaFinishesThread';

const owensThreadTwoStart = 'owensThreadTwoStart';
const owensThreadTwoCtd = 'owensThreadTwoCtd';
const owensThreadThreeStart = 'owensThreadThreeStart';

let lastPostNr = 0;


describe(`alias-anons-true-mixed.2br.f  TyTALIANONTRUEMX`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "Some E2E Test",
      members: ['mei', 'maja', 'michael']
    });

    // Disable notifications, or notf email counts will be off
    // (since Owen would get emails).
    builder.settings({
      numFirstPostsToApprove: 0,
      //maxPostsPendApprBefore: 0,
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

    maja = forum.members.maja;
    maja_brB = brB;
    //michael = forum.members.michael;
    //michael_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });


  // ----- Configure Anons Allowed

  it(`Owen goes to Category A`, async () => {
    await owen_brA.go2(site.origin + '/latest/category-a');
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });
  it(`... opens the Anonymous dropdown`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
    await owen_brA.waitAndClick('.e_AnonComtsB');
  });
  it(`... sets it to Allowed`, async () => {
    await owen_brA.waitAndClick('.c_NevAlwD .e_Alow');
  });
  it(`... opens the Anon Purpose dialog`, async () => {
    await owen_brA.waitAndClick('.e_AnonPurpB');
  });
  it(`... selects Sensitive Discussions`, async () => {
    await owen_brA.waitAndClick('.e_OnlSelf');
  });
  it(`... saves`, async () => {
    await owen_brA.categoryDialog.submit();
  });


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
    await maja_brB.waitForVisible('.e_AsSelf');
  });
  it(`... she submits the topic`, async () => {
    await maja_brB.editor.editTitle(majasPage.title);
    await maja_brB.editor.editText(majasPage.body);
    await maja_brB.complex.saveTopic(majasPage);
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
    await owen_brA.waitForVisible('.e_AsSelf');
  });
  it(`... he submits his comment`, async () => {
    await owen_brA.editor.editText(owensReplyText);
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
    await maja_brB.waitForVisible('.e_AsSelf');
  });
  it(`... but swiches to Anonymous`, async () => {
    await maja_brB.waitAndClick('.c_AliasB');
    await maja_brB.waitAndClick('.e_AnonPrmB');
  });
  it(`... submits`, async () => {
    await maja_brB.editor.editText(majasReplyToOwenText);
    await maja_brB.editor.save();
    lastPostNr += 1;
  });

  // Commenter:
  it(`Owen starts replying to Maja's reply to him`, async () => {
    await owen_brA.topic.waitForPostNrVisible(lastPostNr, { refreshBetween: true });
    await owen_brA.topic.clickReplyToPostNr(lastPostNr);
  });
  it(`... he is himself`, async () => {
    await owen_brA.waitForVisible('.e_AsSelf');
  });
  it(`... swiches to Anonymous, he too`, async () => {
    await owen_brA.waitAndClick('.c_AliasB');
    await owen_brA.waitAndClick('.e_AnonPrmB');
  });
  it(`... he submits his comment`, async () => {
    await owen_brA.editor.editText(owensReplyToMajasReplyText);
    await owen_brA.editor.save();
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
    await maja_brB.editor.editText(majaContinuesText);
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
    await maja_brB.editor.editText(majaContinuesText2);
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
    await owen_brA.editor.editText(owenContinuesText2);
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
    await maja_brB.waitForVisible('.e_AsSelf');
  });
  it(`... submits`, async () => {
    await maja_brB.editor.editText(majaFinishesThread);
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
    await owen_brA.editor.editText(owensThreadTwoStart);
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
    await owen_brA.editor.editText(owensThreadThreeStart);
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
    await owen_brA.editor.editText(owensThreadTwoCtd);
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

