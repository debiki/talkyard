/// <reference path="../test-types.ts"/>

// CR_MISSING

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { E2eVote, E2eAuthor } from '../test-types';
import { ForbiddenPs } from '../test-types2';
import { logBoring, logMessage, j2s } from '../utils/log-and-die';
import { TestAnonStatus, TestNeverAlways } from '../test-constants';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;


let owen: Member;
let owen_brA: TyE2eTestBrowser;
let owensForbiddenWords: St[] | U;
let owensForbiddenPs: ForbiddenPs;
const owensAnonsUrl = '/-/users/-11';
// Owen posts the first reply — he gets letter A.
const owensAnonsLetters = 'A';
const owensAnonAuthor: E2eAuthor = {
  username: null,
  fullName: 'Temp Anonymous',
  profileUrl: owensAnonsUrl,
  avatarText: owensAnonsLetters,
  saysIsYou: false,
};

let maria: Member;
let maria_brB: TyE2eTestBrowser;
let mariasForbiddenWords: St[] | U;
let mariasForbiddenPs: ForbiddenPs;
const mariasAnonsUrl = '/-/users/-10';
// Maria posts the second reply — she gets letter A2.
const mariasAnonsLetters = 'A2';
const mariasAnonAuthor: E2eAuthor = {
  username: null,
  fullName: 'Temp Anonymous',
  profileUrl: mariasAnonsUrl,
  avatarText: mariasAnonsLetters,
  saysIsYou: false,
};

let michael: Member;
let michael_brB: TyE2eTestBrowser;
let michaelsForbiddenWords: St[] | U;
let michaelsForbiddenPs: ForbiddenPs;
const michaelsAnonsUrl = '/-/users/-12';
// Michael is the third person to vote or comment — he gets letter A3.
const michaelsAnonsLetters = 'A3';


let site: IdAddress;
let forum: TwoCatsTestForum;  // or TwoPagesTestForum or EmptyTestForum or LargeTestForum

let mariasPagePath: St | U;
// '_x_' changes the page slug from 'mariaspagetitle' to  'maxriaspagetitle' — so we can
// look at the _page_html_source and see that "maria" is nowhere in the source,
// except for possibly the users-online field (presence enabled by default).
const ma_x_riasPage = {
  title: 'ma_x_riasPage_title',
  body: 'ma_x_riasPage_body',
};

// "Ow_en" with underscore '_' so the page and comment texts won't match anyone's
// name or username, not in emails, and not in the _page_html_source.
const ow_ensReplyText = 'ow_ensReplyText';
const ma_riasReplyText = 'ma_riasReplyText';
const ow_ensReplyToMa_riasReplyText = 'ow_ensReplyToMa_riasReplyText';
const ow_ensReply2 = 'ow_ensReply2';
const mi_chaelsReply = 'mi_chaelsReply';

const allPostTexts = [
        ma_x_riasPage.title,
        ma_x_riasPage.body,
        ow_ensReplyText,
        ma_riasReplyText,
        ow_ensReplyToMa_riasReplyText,
        ow_ensReply2,
        mi_chaelsReply,
        ];

let owenIdName: St[] | U;
let mariaIdName: St[] | U;
let michaelIdName: St[] | U;

let expectedNumEmails = 0;

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
    // This'll give people ids  1020304001, 1020304002, 1020304003, ... which we'll look for,
    // to make sure they aren't anywhere in the server responses —  then, we can be more
    // certain that no one's identity is leaked (name or id, even if not shown anywhere
    // on the page).
    make.setNextUserId(1020304001); // [e2e_forbidden_anon_ids]

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
      notfLevel: c.TestPageNotfLevel.EveryPostAllEdits,
      // TESTS_MISSING: Edits! Real name not in email  TyTANONEDIT
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

    const forbiddenPs = { forbiddenWordsOkInPresence: true, shouldFindWords: allPostTexts };

    owenIdName = ['' + owen.id, "owen", owen.username, owen.fullName];
    mariaIdName = ['' + maria.id, maria.username, maria.fullName];
    michaelIdName = ['' + michael.id, michael.username, michael.fullName];
    assert.eq(michael.id, 1020304006); // or a test breaks, at the end.

    // No, ok:  anonForId, right.   DONE:  test before each navigation
    owensForbiddenWords = [...mariaIdName, ...michaelIdName];
    owensForbiddenPs = { forbiddenWords: owensForbiddenWords, ...forbiddenPs };

    mariasForbiddenWords = [...owenIdName, ...michaelIdName];
    mariasForbiddenPs = { forbiddenWords: mariasForbiddenWords, ...forbiddenPs };

    michaelsForbiddenWords = [...owenIdName, ...mariaIdName];
    michaelsForbiddenPs = { forbiddenWords: michaelsForbiddenWords, ...forbiddenPs };

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

  it(`... edits the category`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
  });

  it(`... sets Anon Comments to Recommended`, async () => {
    await owen_brA.categoryDialog.setAnonAllowed(TestNeverAlways.Recommended);
  });
  it(`... sets Anon Purpose to Better Ideas`, async () => {
    await owen_brA.categoryDialog.setAnonPurpose(TestAnonStatus.IsAnonCanAutoDeanon);
  });

  it(`... saves`, async () => {
    await owen_brA.categoryDialog.submit();
  });

  // Remember _here_instead of below?
  //it(`Owen's browser remembers forbidden words: ${j2s(owensForbiddenWords)}`, async () => {
  //  await owen_brA.execute(function(words) {
  //    window['debiki2'].Server.setE2eTestForbiddenWords(words);
  //  }, owensForbiddenWords);
  //});


  it(`Maria logs in`, async () => {
    await maria_brB.go2(site.origin);
    await maria_brB.complex.loginWithPasswordViaTopbar(maria);
  });

  it(`Maria's browser remembers forbidden words: ${j2s(mariasForbiddenWords)}`, async () => {
    await maria_brB.setForbiddenWords(mariasForbiddenWords, true, allPostTexts);
  });


  it(`There's no persona indicator — only Category A is anonymous`, async () => {
    await maria_brB.topbar.personaIndicator.assertNoIndicator();
  });

  it(`Maria goes to Category A  (after Owen has made it Anonymous-Recommended)`, async () => {
    await maria_brB.forumTopicList.switchToCategory('CategoryA');
  });

  it(`... a persona indicator appears: Maja is temp anon, by default`, async () => {
    await maria_brB.topbar.personaIndicator.waitForIndicated({
            anonStatus: TestAnonStatus.IsAnonCanAutoDeanon });
  });

  it(`Maria starts composing a topic`, async () => {
    await maria_brB.forumButtons.clickCreateTopic();
  });
  it(`... she's Anonymous Temporarily by default`, async () => {
    await maria_brB.editor.waitForAnonPurpose(TestAnonStatus.IsAnonCanAutoDeanon);
  });
  it(`... she submits the topic`, async () => {
    await maria_brB.editor.editTitle(ma_x_riasPage.title);
    await maria_brB.editor.editText(ma_x_riasPage.body);
    await maria_brB.complex.saveTopic(ma_x_riasPage);
    mariasPagePath = await maria_brB.urlPath();
    expectedNumEmails += 1; // to Owen, he's subscribed to all topics & comments
    owen.expectedNumEmails = 1;
  });
  it(`Maria's comment is indeed anonymous`, async () => {
    assert.eq(await maria_brB.topic.getTopicAuthorFullName(), mariasAnonAuthor.fullName);
  });

  it(`... and she's temp anon in this new topic`, async () => {
    await maria_brB.topbar.personaIndicator.waitForIndicated({
            anonStatus: TestAnonStatus.IsAnonCanAutoDeanon });
  });

  it(`Needed again? Remember forbidden words: ${j2s(mariasForbiddenWords)}`, async () => {
    await maria_brB.setForbiddenWords(mariasForbiddenWords, true, allPostTexts);
  });


  let emailHtml: St | U;

  it(`Owen gets notified about Maria's new topic`, async () => {
    const emails: EmailSubjectBody[] =
            await server.waitGetLastEmailsSentTo(
                site.id, owen.emailAddress, owen.expectedNumEmails);
    logMessage(j2s(emails));
    emailHtml = emails[emails.length - 1].bodyHtmlText;
    assert.includes(emailHtml, ma_x_riasPage.title);
    assert.includes(emailHtml, ma_x_riasPage.body);
  });
  it(`... he doesn't see her name or id — instead, ${c.EmailAnonName}`, async () => {
    assert.excludes(emailHtml, mariaIdName);
    assert.includes(emailHtml, `>${c.EmailAnonName}</`); // between <i>..</i> tags
  });
  it(`No other emails get sent`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, expectedNumEmails, `Emails sent to: ${addrsByTimeAsc}`);
  });


  it(`Owen goes to Maria's page`, async () => {
    // Remember params up _here_instead, of here?
    await owen_brA.go2(mariasPagePath, owensForbiddenPs);
  });
  it(`... he's temp anon, he too`, async () => {
    await owen_brA.topbar.personaIndicator.waitForIndicated({
            anonStatus: TestAnonStatus.IsAnonCanAutoDeanon });
  });

  it(`Owen starts replying to Maria`, async () => {
    await owen_brA.topic.clickReplyToOrigPost();
  });
  it(`... he's Anonymous Temporarily, in the editor's Post As dropdown`, async () => {
    await owen_brA.editor.waitForAnonPurpose(TestAnonStatus.IsAnonCanAutoDeanon);
  });
  it(`... he submits his comment`, async () => {
    await owen_brA.editor.editText(ow_ensReplyText);
    await owen_brA.editor.save();
    expectedNumEmails += 1; // to Maria
    maria.expectedNumEmails = 1;
  });

  addEmailNotfTests("Maria", () => maria, "Owen", () => owen, ow_ensReplyText);


  it(`Maria replies  (should reuse Maria's anonym)`, async () => {
    // Sometimes Websocket stops working, oh well.
    await maria_brB.refresh2();
    await maria_brB.complex.replyToPostNr(c.FirstReplyNr, ma_riasReplyText);
    owen.expectedNumEmails += 1;
    expectedNumEmails += 1; // to Owen
  });

  addEmailNotfTests("Owen", () => owen, "Maria", () => maria, ma_riasReplyText);

  it(`Owen replies to Maria's reply  (should reuse Owen's anonym)`, async () => {
    await owen_brA.refresh2();
    await owen_brA.complex.replyToPostNr(c.SecondReplyNr, ow_ensReplyToMa_riasReplyText);
    expectedNumEmails += 1; // to Maria
    maria.expectedNumEmails += 1;
  });

  addEmailNotfTests("Maria", () => maria, "Owen", () => owen, ow_ensReplyToMa_riasReplyText);

  it(`Owen posts a new top-level reply  (should reuse Owen's anonym)`, async () => {
    await owen_brA.complex.replyToPostNr(c.BodyNr, ow_ensReply2);
    expectedNumEmails += 1; // to Maria
    maria.expectedNumEmails += 1;
  });

  addEmailNotfTests("Maria", () => maria, "Owen", () => owen, ow_ensReply2);



  // (Could use  checkEmailsTo()  from  emails-e2e.ts  instead, oh well.)
  //
  function addEmailNotfTests(toName: St, to: () => Member,
            fromName: St, from: () => Member, textOrRegex: St | RegExp) {
    it(`${toName} gets notified about ${fromName}'s reply`, async () => {
      const emails: EmailSubjectBody[] =
              await server.waitGetLastEmailsSentTo(
                  site.id, to().emailAddress, to().expectedNumEmails);
      logMessage(j2s(emails));
      emailHtml = emails[emails.length - 1].bodyHtmlText;
      if (_.isString(textOrRegex))
        assert.includes(emailHtml, textOrRegex);
      else
        assert.matches(emailHtml, textOrRegex);
    });

    it(`... doesn't see ${fromName}'s name — instead, ${c.EmailAnonName}`, async () => {
      // make  lowercase  a  ps {}  ?
      assert.excludes(emailHtml.toLowerCase(), [
                fromName, from().username, from().fullName].map(x => x.toLowerCase()));
      assert.includes(emailHtml, `>${c.EmailAnonName}</`); // between <i>..</i> tags
    });

    it(`No other emails get sent`, async () => {
      const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
      assert.eq(num, expectedNumEmails, `Emails sent to: ${addrsByTimeAsc}`);
    });
  }


  it(`Owen can't see who Maria is — she's anonymous`, async () => {
    const author: E2eAuthor = await owen_brA.topic.getPostAuthor(c.BodyNr);
    // Currently no avatar is shown for the orig post. [no_op_avatar]
    assert.deepEq(author, { ...mariasAnonAuthor, avatarText: null });
  });


  it(`Owen himself is anonymous too  —  he, though, sees the text "You"`, async () => {
    const author: E2eAuthor = await owen_brA.topic.getPostAuthor(c.FirstReplyNr);
    assert.deepEq(author, { ...owensAnonAuthor, saysIsYou: true });
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
    await owen_brA.topic.likeVote(c.BodyNr);
    await maria_brB.topic.likeVote(c.FirstReplyNr);
    owen.expectedNumEmails += 1;
    maria.expectedNumEmails += 1;
    expectedNumEmails += 2;
  });

  // (Check the notf to Owen first, to avoid a tot-num-notf-emails race.)
  addEmailNotfTests("Owen", () => owen, "Maria", () => maria, new RegExp(
       `<i>${c.EmailAnonName
        }</i> likes <a href="https?://e2e-test-[^/]+/-2#post-${c.FirstReplyNr}">your reply`));

  addEmailNotfTests("Maria", () => maria, "Owen", () => owen, new RegExp(
       `<i>${c.EmailAnonName
        }</i> likes <a href="https?://e2e-test-[^/]+/-2#post-${c.BodyNr}">your topic`));



  it(`Maria looks at Owen's vote. It is anonymous   TyTLISTVOTES`, async () => {
    await maria_brB.refresh2();
    await maria_brB.topic.openLikeVotes(c.BodyNr);
    const votes: E2eVote[] = await maria_brB.topic.votesDiag.getVotes({ exactly: 1 });
    assert.deepEq(votes, [
            { avatarText: owensAnonsLetters, voteUrl: owensAnonsUrl, isMine: false },
            ] satisfies E2eVote[]);
    await maria_brB.topic.votesDiag.close();
  });



  it(`Maria leaves`, async () => {
    await maria_brB.topbar.clickLogout();
  });
  it(`Michael arrives, with his forbidden words`, async () => {
    await michael_brB.setForbiddenWords(michaelsForbiddenWords, true, allPostTexts);
    await michael_brB.complex.loginWithPasswordViaTopbar(michael);
  });

  it(`... Like-votes the page (Maria's) and Owen's comment  (creates new anon)`, async () => {
    await michael_brB.topic.likeVote(c.BodyNr);
    await michael_brB.topic.likeVote(c.FirstReplyNr);
  });

  it(`... replies to the page  (reuses Michael's votes-anon)`, async () => {
    await michael_brB.complex.replyToOrigPost(mi_chaelsReply);
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


  // Any visible names ought to already have broken the test, because
  // of the forbidden-words error dialog. But let's double check, in these ways, too:
  it(`Owen doesn't see the others' names anywhere in the _page_html_source
                    — except for in the \`usersOnline\` field`, async () => {
    const source = await owen_brA.getPageSource();
    const sourceWithoutUsersOnline = utils.removeUsersOnlineJson(source);
    assert.excludes(sourceWithoutUsersOnline, owensForbiddenWords);
  });
  it(`... there's no error dialog`, async () => {
    await owen_brA.serverErrorDialog.failIfDisplayed();
  });

  it(`Michael also doesn't see anyone's id or name`, async () => {
    const source = await michael_brB.getPageSource();
    const sourceWithoutUsersOnline = utils.removeUsersOnlineJson(source);
    assert.excludes(sourceWithoutUsersOnline, michaelsForbiddenWords);
  });
  it(`... and no error dialog`, async () => {
    await michael_brB.serverErrorDialog.failIfDisplayed();
  });

  it(`Michael submits a comment ...`, async () => {
    await michael_brB.topic.clickReplyToOrigPost();
  });
  it(`... using his real name!`, async () => {
    await michael_brB.editor.setAnonPurpose(TestAnonStatus.NotAnon);
    await michael_brB.editor.editText("It's me!");
    await michael_brB.editor.save();
  });

  it(`ttt: Owen sees Michael's id and name in a websocket message —
              it's a forbidden word, the error dialog appears`, async () => {
    // No refresh.
    await owen_brA.serverErrorDialog.waitAndAssertTextMatches(
          /TyEFORBWDS_.+ req url: +WebSocket.+ words: +\["1020304006","michael"/s);
  });

  it(`ttt: After reload, the error dialog appears again, shows Michael's name and id`, async () => {
    await owen_brA.refreshNothingElse();
    await owen_brA.serverErrorDialog.waitAndAssertTextMatches(
          /TyEFORBWDS_.+ req url: +https?:\/\/e2e-test.+ words: +\["1020304006","michael"/s);
  });
  it(`ttt: ... the page source includes Michael's name and id`, async () => {
    const source = await owen_brA.getPageSource();
    const sourceWithoutUsersOnline = utils.removeUsersOnlineJson(source);
    assert.includes(sourceWithoutUsersOnline, '' + michael.id);
    assert.includes(sourceWithoutUsersOnline, michael.username);
  });

});

