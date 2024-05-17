/// <reference path="../test-types.ts"/>

// CR_MISSING

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { E2eVote, E2eAuthor } from '../test-types';
import { logBoring } from '../utils/log-and-die';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;

let owen: Member;
let owen_brA: TyE2eTestBrowser;
const owensAnonsUrl = '/-/users/-11';
// Owen posts the first reply — he gets letter A.
const owensAnonsLetters = 'A';
const owensAnonAuthor: E2eAuthor = {
  username: null,
  fullName: 'Anonym',
  profileUrl: owensAnonsUrl,
  avatarText: owensAnonsLetters,
  saysIsYou: false,
};

let maria: Member;
let maria_brB: TyE2eTestBrowser;
const mariasAnonsUrl = '/-/users/-10';
// Maria posts the second reply — she gets letter A2.
const mariasAnonsLetters = 'A2';
const mariasAnonAuthor: E2eAuthor = {
  username: null,
  fullName: 'Anonym',
  profileUrl: mariasAnonsUrl,
  avatarText: mariasAnonsLetters,
  saysIsYou: false,
};

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
};


let site: IdAddress;
let forum: TwoCatsTestForum;  // or TwoPagesTestForum or EmptyTestForum or LargeTestForum

let mariasPagePath: St | U;
const mariasPage = {
  title: 'mariasPage_title',
  body: 'mariasPage_body',
};

const owensReplyText = 'owensReplyText';
const mariasReplyText = 'mariasReplyText';
const owensReplyToMariasReplyText = 'owensReplyToMariasReplyText';
const owensReply2 = 'owensReply2';
const michaelsReply = 'michaelsReply';

/* Anon tests:

- Search results show anon names (not real names)

alias-anon-alter-page.2br.f.e2e.ts:
  - Accept answer, unaccept  — as anon, if page anon. As real, if page by real name.
  - Rename page
  - Change page type
  - Move to other category,  & to non-anon cat


- Anon comments & votes:
    - Never
    - Allowed
    - Recommended

has replied/voted earlier same thread:
    pub reply:
        anon-never-can-cont  —> pub reply
        anon-allowed         —> pub reply, dropdown
        anon-recommended     —> pub reply, dropdown

    anon reply:
        anon-never-can-cont  —> anon reply, dropdown
        anon-allowed         —> anon reply, dropdown
        anon-rec.            —> anon reply, dropdown

  has voted earlier same thread:
      pub vote:
          anon-rec           —> pub reply, dropdown

      anon vote:
          anon-rec           —> anon reply, dropdown

  pub reply, anon reply  —>  anon reply & vote
      vote, anon reply   —>  anon reply & vote

  pub reply, anon vote   —>  anon reply & vote
      vote, anon vote    —>  anon reply & vote

  anon reply, pub reply  —>  pub reply & vote
        vote, pub reply  —>  pub reply & vote

  anon reply, pub vote   —>  pub reply & vote
        vote, pub vote   —>  pub reply & vote

has replied/voted elsewhere same page:

  pub reply | vote       —>  pub reply & vote

  anon reply | vote      —>  anon reply & vote

  pub reply, then anon   —>  anon reply & vote
  anon reply, then pub   —>  pub reply & vote


has nothing:
        anon-never-can-cont  —> pub reply
        anon-allowed         —> pub reply, dropdown
        anon-recommended     —> anon reply, dropdown
*/


describe(`alias-anons-basic.2br.f  TyTALIANONBASC`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "Some E2E Test",
      members: ['modya', 'corax', 'memah', 'maria', 'michael']
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

    maria = forum.members.maria;
    maria_brB = brB;
    michael = forum.members.michael;
    michael_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
  });


  it(`Owen goes to Category A`, async () => {
    await owen_brA.go2(site.origin + '/latest/category-a');
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  it(`... opens the Anonymous dropdown`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
    await owen_brA.waitAndClick('.e_AnonComtsB');
  });

  it(`... sets it to Recommended`, async () => {
    await owen_brA.waitAndClick('.c_NevAlwD .e_Rec');
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


  it(`Maria goes to Category A  (after Owen has made it Anonymous-Recommended)`, async () => {
    await maria_brB.go2(site.origin + '/latest/category-a');
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });

  it(`Maria starts composing a topic`, async () => {
    await maria_brB.forumButtons.clickCreateTopic();
  });

  it(`... a Post-as dropdown appears`, async () => {
    await maria_brB.waitForVisible('.c_AliasB');
  });

  it(`... with Anonymously (permanently) pre-selected)`, async () => {
    await maria_brB.waitForVisible('.e_AnonPrm');
  });

  it(`... she submits the topic`, async () => {
    await maria_brB.editor.editTitle(mariasPage.title);
    await maria_brB.editor.editText(mariasPage.body);
    await maria_brB.complex.saveTopic(mariasPage);
    mariasPagePath = await maria_brB.urlPath();
  });

  it(`Maria is anonymous`, async () => {
    assert.eq(await maria_brB.topic.getTopicAuthorFullName(), 'Anonym');
  });


  it(`Owen starts replying to Maria`, async () => {
    await owen_brA.go2(mariasPagePath);
    await owen_brA.topic.clickReplyToOrigPost();
  });

  it(`... a Post-as shows Anonymous`, async () => {
    await owen_brA.waitForVisible('.c_AliasB');
  });

  it(`... with Anonymously (permanently) pre-selected)`, async () => {
    await owen_brA.waitForVisible('.e_AnonPrm');
  });

  it(`... he submits his comment`, async () => {
    await owen_brA.editor.editText(owensReplyText);
    await owen_brA.editor.save();
  });

  it(`Maria replies  (should reuse Maria's anonym)`, async () => {
    // Sometimes Websocket stops working, oh well.
    await maria_brB.refresh2();
    await maria_brB.complex.replyToPostNr(c.FirstReplyNr, mariasReplyText);
  });

  it(`Owen replies to Maria's reply  (should reuse Owen's anonym)`, async () => {
    await owen_brA.refresh2();
    await owen_brA.complex.replyToPostNr(c.SecondReplyNr, owensReplyToMariasReplyText);
  });

  it(`Owen posts a new top-level reply  (should reuse Owen's anonym)`, async () => {
    await owen_brA.complex.replyToPostNr(c.BodyNr, owensReply2);
  });


  it(`Owen can't see who Maria is — she's anonymous`, async () => {
    const author: E2eAuthor = await owen_brA.topic.getPostAuthor(c.BodyNr);
    // Currently no avatar is shown for the orig post. [no_op_avatar]
    assert.deepEq(author, { ...mariasAnonAuthor, avatarText: null });
  });


  it(`Owen himself is anonymous too  —  he, though, sees the text "You"`, async () => {
    const author: E2eAuthor = await owen_brA.topic.getPostAuthor(c.FirstReplyNr);
    assert.deepEq(author, { ...owensAnonAuthor, saysIsYou: true });
    //assert.eq(await owen_brA.topic.getPostAuthorFullName(c.FirstReplyNr), 'Anonym');
  });


  it(`Owen is anonymous to Maria too, but she won't see the text "You"`, async () => {
    await maria_brB.refresh2();
    const author: E2eAuthor = await maria_brB.topic.getPostAuthor(c.FirstReplyNr);
    assert.deepEq(author, owensAnonAuthor);
  });


  it(`... she sees "You" at her name though, at the OP and her reply to Owen`, async () => {
    const key: E2eAuthor = { ...mariasAnonAuthor, saysIsYou: true };

    logBoring(`The orig post:`)
    const author: E2eAuthor = await maria_brB.topic.getPostAuthor(c.BodyNr);
    assert.deepEq(author, { ...key, avatarText: null });

    logBoring(`Maria's reply to Owen:`)
    const author2: E2eAuthor = await maria_brB.topic.getPostAuthor(c.SecondReplyNr);
    assert.deepEq(author2, key);
  });



  it(`Owen and Maria like each other's posts  (should reuse their anonyms)`, async () => {
    await owen_brA.topic.clickLikeVote(c.BodyNr);
    await maria_brB.topic.clickLikeVote(c.FirstReplyNr);
  });


  it(`Maria looks at Owen's vote. It is anonymous   TyTLISTVOTES`, async () => {
    await maria_brB.refresh2();
    await maria_brB.topic.openLikeVotes(c.BodyNr);
    const votes: E2eVote[] = await maria_brB.topic.votesDiag.getVotes({ exactly: 1 });
    assert.deepEq(votes, [
            { avatarText: owensAnonsLetters, voteUrl: owensAnonsUrl, isMine: false },
            ] satisfies E2eVote[]);
    await maria_brB.topic.votesDiag.close();
  });



  it(`Michael arrives`, async () => {
    await maria_brB.topbar.clickLogout();
    await michael_brB.complex.loginWithPasswordViaTopbar(michael);
  });

  it(`... Like-votes the page (Maria's) and Owen's comment  (creates new anon)`, async () => {
    await michael_brB.topic.clickLikeVote(c.BodyNr);
    await michael_brB.topic.clickLikeVote(c.FirstReplyNr);
  });

  it(`... replies to the page  (reuses Michael's votes-anon)`, async () => {
    await michael_brB.complex.replyToOrigPost(michaelsReply);
  });


  it(`Owen looks at Maria's and Michael's votes. They're anonymous   TyTLISTVOTES`, async () => {
    await owen_brA.refresh2();
    await owen_brA.topic.openLikeVotes(c.FirstReplyNr);
    const votes: E2eVote[] = await owen_brA.topic.votesDiag.getVotes({ exactly: 2 });
    assert.deepEq(votes, [
          // [newest_vote_first].
          { avatarText: michaelsAnonsLetters, voteUrl: michaelsAnonsUrl, isMine: false },
          { avatarText: mariasAnonsLetters, voteUrl: mariasAnonsUrl, isMine: false },
          ] satisfies E2eVote[]);
    await owen_brA.topic.votesDiag.close();
  });


  it(`Owen looks at his and Michael's votes. His is anonymous, ` +
          `with the text 'You'   TyTLISTVOTES`, async () => {
    await owen_brA.topic.openLikeVotes(c.BodyNr);
    const votes: E2eVote[] = await owen_brA.topic.votesDiag.getVotes({ exactly: 2 });
    assert.deepEq(votes, [
          { avatarText: michaelsAnonsLetters, voteUrl: michaelsAnonsUrl, isMine: false },
          { avatarText: owensAnonsLetters, voteUrl: owensAnonsUrl, isMine: true },
          ] satisfies E2eVote[]);
    await owen_brA.topic.votesDiag.close();
  });

});

