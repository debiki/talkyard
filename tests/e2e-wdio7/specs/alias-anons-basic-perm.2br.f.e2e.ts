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

let michael: Member;
let michael_brB: TyE2eTestBrowser;
let michaelsForbiddenWords: St[] | U;
let michaelsForbiddenPs: ForbiddenPs;


let site: IdAddress;
let forum: TwoCatsTestForum;


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

const allPostTexts = [
        ma_x_jasPage.title,
        ma_x_jasPage.body,
        ow_ensReply1,
        ow_ensReply2,
        ma_jasReply,
        mi_chaelsReply1,
        mi_chaelsReply2,
        ];

let owenIdName: St[] | U;
let majaIdName: St[] | U;
let michaelIdName: St[] | U;

let expectedNumEmails = 0;


describe(`alias-anons-true-mixed.2br.f  TyTALIANONTRUEMX`, () => {

  it(`Construct site`, async () => {
    make.setNextUserId(1020304001); // [e2e_forbidden_anon_ids]

    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "E2e: Sensitive Anon Discs",
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


  // ----- Can't be anon, by default

  it(`Maja goes to Category A`, async () => {
    await maja_brB.go2(site.origin + '/latest/category-a');
    await maja_brB.complex.loginWithPasswordViaTopbar(maja);
  });

  it(`There's no persona indicator`, async () => {
    await maja_brB.topbar.personaIndicator.assertNoIndicator();
  });

  it(`Maja starts composing a topic`, async () => {
    await maja_brB.forumButtons.clickCreateTopic();
  });
  it(`... there's no Post-as dropdown`, async () => {
    // When "Reply to ..." is visible,
    await maja_brB.waitForDisplayed('.s_E_DoingWhat');
    // but "Loading any draft ..." is gone,
    await maja_brB.waitForGone('.e_LdDft');
    // any Post-as dropdown should have appeared:
    assert.not(await maja_brB.isExisting('.c_AliasB'));
  });


  // ----- Configure Sensitive Anon Discs: Feature not enabled

  it(`Owen goes to Category A`, async () => {
    await owen_brA.go2(site.origin + '/latest/category-a');
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });
  it(`... edits the category`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
  });
  it(`... sets Anonymous Comments to Allowed`, async () => {
    await owen_brA.categoryDialog.setAnonAllowed(TestNeverAlways.Allowed);
  });
  it(`... wants to set the Anon Purpose to Sensitive Discussions   TyTANOSENSDISLN
          — but it's disabled, Owen follows a link to the admin settings`, async () => {
    await owen_brA.categoryDialog.setAnonPurpose(TestAnonStatus.IsAnonOnlySelfCanDeanon,
            { disabled: true });
  });

  it(`Another browser tab opens`, async () => {
    await owen_brA.swithToOtherTabOrWindow();
  });
  it(`... it's the Admin Area`, async () => {
    await owen_brA.adminArea.waitAssertVisible();
  });


  // ----- Enable Sensitive Anon Discs

  it(`The Presence feature is enabled, Owen sees, in the Admin Area`, async () => {
    assert.ok(await owen_brA.adminArea.settings.features.getEnablePresence());
  });
  it(`... the Anon Sensitive Discs feature is disabled`, async () => {
    assert.not(await owen_brA.adminArea.settings.features.getEnableAnonSensitiveDiscs());
  });
  it(`... Owen enables Anon Sensitive Discs`, async () => {
    await owen_brA.adminArea.settings.features.setEnableAnonSensitiveDiscs(true);
  });
  it(`... the Presence feature now got disabled`, async () => {
    assert.not(await owen_brA.adminArea.settings.features.getEnablePresence());
  });

  it(`... Owen saves`, async () => {
    await owen_brA.adminArea.settings.clickSaveAll();
  });
  it(`The features stay the same (enabled, disabled) after reload`, async () => {
    await owen_brA.refresh2();
    assert.ok(await owen_brA.adminArea.settings.features.getEnableAnonSensitiveDiscs());
    assert.not(await owen_brA.adminArea.settings.features.getEnablePresence());
  });


  // ----- Configure Sensitive Anon Discs  (feature now enabled)

  it(`Owen goes back to the category`, async () => {
    // (Can skip: owen_brA.switchBackToFirstTabIfNeeded().)
    await owen_brA.go2('/latest/category-a');
  });
  it(`... edits the category`, async () => {
    await owen_brA.forumButtons.clickEditCategory();
  });
  it(`... sets Anonymous Comments to Allowed`, async () => {
    await owen_brA.categoryDialog.setAnonAllowed(TestNeverAlways.Recommended);
  });
  it(`... now he can choose Sensitive Discussions as purpose`, async () => {
    await owen_brA.categoryDialog.setAnonPurpose(TestAnonStatus.IsAnonOnlySelfCanDeanon);
  });
  it(`... saves`, async () => {
    await owen_brA.categoryDialog.submit();
  });


  // ----- Persona indicator?

  it(`Maja reloads the page,  with forbidden words ...`, async () => {
    await maja_brB.go2(site.origin + '/latest/category-a', majasForbiddenPs);
  });
  it(`... now there's a persona indicator: Maja is anonymous, by default`, async () => {
    await maja_brB.topbar.personaIndicator.assertIsIndicated({
            anonStatus: TestAnonStatus.IsAnonOnlySelfCanDeanon });
  });


  // ----- Post anonymously

  it(`Maja starts composing a topic`, async () => {
    await maja_brB.forumButtons.clickCreateTopic();
  });
  it(`... a Post-as dropdown appears`, async () => {
    await maja_brB.waitForVisible('.c_AliasB');
  });
  it(`... with Anonymously preselected (anonymity recommended here)`, async () => {
    await maja_brB.editor.waitForAnonPurpose(TestAnonStatus.IsAnonOnlySelfCanDeanon);
  });
  it(`... she submits the topic`, async () => {
    await maja_brB.editor.editTitle(ma_x_jasPage.title);
    await maja_brB.editor.editText(ma_x_jasPage.body);
    await maja_brB.complex.saveTopic(ma_x_jasPage);
    majasPagePath = await maja_brB.urlPath();

    owen.expectedNumEmails = 1; // Owen is subscribed to everything
    expectedNumEmails += 1;
  });

  let emailHtml: St | U;

  it(`Owen gets notified about Maja's new topic`, async () => {
    const emails: EmailSubjectBody[] =
            await server.waitGetLastEmailsSentTo(
                site.id, owen.emailAddress, owen.expectedNumEmails);
    emailHtml = emails[emails.length - 1].bodyHtmlText;
    assert.includes(emailHtml, ma_x_jasPage.title);
    assert.includes(emailHtml, ma_x_jasPage.body);
  });
  it(`... he doesn't see her name — instead, ${c.EmailAnonName}`, async () => {
    assert.excludes(emailHtml, [maja.username, maja.fullName]);
    assert.includes(emailHtml, `>${c.EmailAnonName}</`); // between <i>..</i> tags
  });
  it(`... and his own name`, async () => {
    assert.includes(emailHtml, `Dear ${owen.username}`);
  });
  it(`No other emails get sent`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, expectedNumEmails, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ----- Forbidden words

  it(`ttt: Maja's frobidden words are remembered, on the new page`, async () => {
    const wordsObj: [St[], Bo, St[]] = await maja_brB.getForbiddenWords();
    assert.deepEq(wordsObj, [majasForbiddenWords, false, allPostTexts]);
  });

  it(`Owen goes to Maja's topic — doesn't see her name anywhere`, async () => {
    await owen_brA.go2(majasPagePath, owensForbiddenPs);
  });


  // ----- Vote & post anonymously

  it(`Owen Like-votes Maja's topic  (creates an anon for Owen)`, async () => {
    await owen_brA.topic.likeVote(c.BodyNr);
    maja.expectedNumEmails = 1;
    expectedNumEmails += 1;
  });

  checkEmailsTo("Maja", () => maja, { from: ["Owen", () => owen], isAnon: true,
              isWhat: 'VotedLike', postNr: c.BodyNr,
              expectedNumEmails: () => expectedNumEmails, site: () => site });

  it(`Owen replies to Maja  (reuses the same anon)`, async () => {
    await owen_brA.complex.replyToOrigPost(ow_ensReply1);
    maja.expectedNumEmails += 1;
    expectedNumEmails += 1;
  });

  it(`... Maja sees Owen's comment in a WebSocket message`, async () => {
    const expected = {};
    expected[ow_ensReply1] = { exactly: 1 };
    const counts = await maja_brB.waitForShouldWords(expected);
    logDebug(`counts 1: ${j2s(counts)}`);
  });

  checkEmailsTo("Maja", () => maja, { from: ["Owen", () => owen], isAnon: true,
              isWhat: 'DirectReply', textOrRegex: ow_ensReply1,
              expectedNumEmails: () => expectedNumEmails, site: () => site });

  it(`Maja reloads the page ...`, async () => {
    await maja_brB.refresh2();
  });

  it(`... sees Owen's comment text in the json and html,  and the title   ttt`, async () => {
    const expected = {};
    // In json: page meta, sanitizedHtml, unsafeSource, and in html: <title>, <h1> tag = 5.
    expected[ma_x_jasPage.title] = { exactly: 5 };
    // In json and in the html = 2 occurrences.
    expected[ow_ensReply1] = { exactly: 2 };
    expected[ma_x_jasPage.body] = { exactly: 2 };
    const counts = await maja_brB.waitForShouldWords(expected);
    logDebug(`counts 2: ${j2s(counts)}`);
  });

  it(`Maja replies to Owen  (reuses her orig post anon)`, async () => {
    await maja_brB.complex.replyToPostNr(c.FirstReplyNr, ma_jasReply);
    owen.expectedNumEmails += 1;
    expectedNumEmails += 1;
  });

  checkEmailsTo("Owen", () => owen, { from: ["Maja", () => maja], isAnon: true,
              isWhat: 'DirectReply', textOrRegex: ma_jasReply,
              expectedNumEmails: () => expectedNumEmails, site: () => site });

  it(`Like-votes Owen's reply`, async () => {
    await maja_brB.topic.likeVote(c.FirstReplyNr);
    owen.expectedNumEmails += 1;
    expectedNumEmails += 1;
  });

  checkEmailsTo("Owen", () => owen, { from: ["Maja", () => maja], isAnon: true,
              isWhat: 'VotedLike', postNr: c.FirstReplyNr,
              expectedNumEmails: () => expectedNumEmails, site: () => site });

  it(`Owen replies again`, async () => {
    await owen_brA.refresh2();
    await owen_brA.complex.replyToPostNr(c.SecondReplyNr, ow_ensReply2);
    maja.expectedNumEmails += 1;
    expectedNumEmails += 1;
  });

  checkEmailsTo("Maja", () => maja, { from: ["Owen", () => owen], isAnon: true,
              isWhat: 'DirectReply', textOrRegex: ow_ensReply2,
              expectedNumEmails: () => expectedNumEmails, site: () => site });


  // ----- Owen is anonymous?

  it(`Maja looks at Owen's vote. It's anonymous   TyTLISTVOTES`, async () => {
    await maja_brB.refresh2();
    await maja_brB.topic.openLikeVotes(c.BodyNr);
    const votes: E2eVote[] = await maja_brB.topic.votesDiag.getVotes({ exactly: 1 });
    assert.deepEq(votes, [
          { avatarText: owensAnonsLetters, voteUrl: owensAnonsUrl, isMine: false },
          ] satisfies E2eVote[]);
    await maja_brB.topic.votesDiag.close();
  });
  it(`Owen is anonymous to Maja; she won't see the text "You"`, async () => {
    const author: E2eAuthor = await maja_brB.topic.getPostAuthor(c.FirstReplyNr);
    assert.deepEq(author, owensAnonAuthor);
  });
  it(`... she sees "You" at her name though, at the OP and her reply to Owen`, async () => {
    const key: E2eAuthor = { ...majasAnonAuthor, saysIsYou: true };

    logBoring(`The orig post:`)
    const author: E2eAuthor = await maja_brB.topic.getPostAuthor(c.BodyNr);
    assert.deepEq(author, { ...key, avatarText: null });

    logBoring(`Maja's reply to Owen:`)
    const author2: E2eAuthor = await maja_brB.topic.getPostAuthor(c.SecondReplyNr);
    assert.deepEq(author2, key);
  });


  // ----- Post more anonymously

  it(`Maja leaves`, async () => {
    await maja_brB.go2('/');
    await maja_brB.topbar.clickLogout();
  });
  it(`Michael arrives ...`, async () => {
    await michael_brB.complex.loginWithPasswordViaTopbar(michael, {
            resultInError: true }); // ttt: Forbidden word, "michael"
  });

  it(`ttt: But the browser remembers Maja's forbidden words: "michael"
              — there's a TyEFORBWDS_ error`, async () => {
    await michael_brB.serverErrorDialog.waitAndAssertTextMatches(
            /TyEFORBWDS_.+req url: +\/-\/load-my-page-data.+words: +\["1020304004","michael"/s);
  });

  it(`Michael goes to Maja's page,  the browser remembers *his* forbidden words`, async () => {
    await michael_brB.serverErrorDialog.close();
    await michael_brB.setForbiddenWords(michaelsForbiddenWords, false, allPostTexts);
    await michael_brB.go2(majasPagePath);
  });

  it(`Michael replies to Maja's orig post,  not to Owen`, async () => {
    await michael_brB.complex.replyToOrigPost(mi_chaelsReply1);
    maja.expectedNumEmails += 1;
    owen.expectedNumEmails += 1; // subscribed to everything
    expectedNumEmails += 2;
  });

  checkEmailsTo("Maja", () => maja, { from: ["Michael", () => michael], isAnon: true,
              isWhat: 'DirectReply', textOrRegex: mi_chaelsReply1,
              // Skip expectedNumEmails — we don't know if the email to Owen has been sent yet.
              site: () => site });

  checkEmailsTo("Owen", () => owen, { from: ["Michael", () => michael], isAnon: true,
              isWhat: 'CommentNotf', textOrRegex: mi_chaelsReply1,
              expectedNumEmails: () => expectedNumEmails, site: () => site });


  // ----- Maja & Michael are anonymous?

  it(`Owen looks at Maja's vote. It's anonymous   TyTLISTVOTES`, async () => {
    await owen_brA.refresh2();
    await owen_brA.topic.openLikeVotes(c.FirstReplyNr);
    const votes: E2eVote[] = await owen_brA.topic.votesDiag.getVotes({ exactly: 1 });
    assert.deepEq(votes, [
          { avatarText: majasAnonsLetters, voteUrl: majasAnonsUrl, isMine: false },
          ] satisfies E2eVote[]);
    await owen_brA.topic.votesDiag.close();
  });
  it(`Owen can't see who Maja is — she's anonymous`, async () => {
    logBoring(`... in the orig post:`)
    const author: E2eAuthor = await owen_brA.topic.getPostAuthor(c.BodyNr);
    // Currently no avatar is shown for the orig post. [no_op_avatar]
    assert.deepEq(author, { ...majasAnonAuthor, avatarText: null });

    logBoring(`... and in her reply to him:`)
    const author2: E2eAuthor = await owen_brA.topic.getPostAuthor(c.SecondReplyNr);
    assert.deepEq(author2, majasAnonAuthor);
  });
  it(`Owen himself is anonymous too  —  he, though, sees the text "You"`, async () => {
    const author: E2eAuthor = await owen_brA.topic.getPostAuthor(c.FirstReplyNr);
    assert.deepEq(author, { ...owensAnonAuthor, saysIsYou: true });
  });


  // ----- Maja & Owen are anonymous?

  it(`Michael sees everyone's comments in the json and html,  and the title   ttt`, async () => {
    const expected = {};
    // In json: page meta, sanitizedHtml, unsafeSource, and in html: <title>, <h1> tag = 5.
    expected[ma_x_jasPage.title] = { exactly: 5 };
    // In json and in the html = 2 occurrences.
    expected[ma_x_jasPage.body] = { exactly: 2 };
    expected[ow_ensReply1] = { exactly: 2 };
    expected[ma_jasReply] = { exactly: 2 };
    expected[ow_ensReply2] = { exactly: 2 };
    expected[mi_chaelsReply1] = { exactly: 2 };
    const counts = await maja_brB.waitForShouldWords(expected);
    logDebug(`counts 2: ${j2s(counts)}`);
  });


  // ----- Disable Sensitive Anon Discs

  it(`Owen goes to the Admin Area, features page`, async () => {
    await owen_brA.adminArea.settings.features.goHere();
  });
  it(`... Owen disables Anon Sensitive Discs`, async () => {
    await owen_brA.adminArea.settings.features.setEnableAnonSensitiveDiscs(false);
  });
  it(`... the Presence feature stays disabled`, async () => {
    assert.not(await owen_brA.adminArea.settings.features.getEnablePresence());
  });

  it(`... Owen saves`, async () => {
    await owen_brA.adminArea.settings.clickSaveAll();
  });
  it(`The features stay the same (disabled, disabled) after reload`, async () => {
    await owen_brA.refresh2();
    assert.not(await owen_brA.adminArea.settings.features.getEnableAnonSensitiveDiscs());
    assert.not(await owen_brA.adminArea.settings.features.getEnablePresence());
  });


  // ----- Anon comments rejected

  it(`Michael tries to Like-vote Owen's 2nd reply, but the server says Error,
          since Anon Sens Discs now disabled`, async () => {
    await michael_brB.topic.tryLikeVote(c.ThirdReplyNr, { errorCode: 'TyE0ANONSENS' });
  });
  it(`... Michael closes the error dialog`, async () => {
    await michael_brB.serverErrorDialog.close();
  });

  it(`Michael tries to reply anonymously ...`, async () => {
    await michael_brB.complex.replyToOrigPost(mi_chaelsReply2);
  });
  it(`... the server says Error now too`, async () => {
    await michael_brB.serverErrorDialog.waitAndAssertTextMatches('TyE0ANONSENS');
  });
  it(`... Michael closes the error dialog`, async () => {
    await michael_brB.serverErrorDialog.close();
  });
  it(`... and the editor`, async () => {
    await michael_brB.editor.closeIfOpen();
  });
  it(`... the text she couldn't post, is now a draft`, async () => {
    await michael_brB.drafts.waitForNthDraftWithText(1, mi_chaelsReply2);
  });

  it(`... the persona indicator shows Anonymous, although it's been disabled
            (a rare situation, not worth the code to do anything better)`, async () => {
    await michael_brB.topbar.personaIndicator.assertIsIndicated({
            anonStatus: TestAnonStatus.IsAnonOnlySelfCanDeanon });
  });

});

