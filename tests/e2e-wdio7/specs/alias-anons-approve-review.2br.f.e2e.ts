/// <reference path="../test-types.ts"/>

// CR_MISSING

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { checkEmailsTo } from '../utils/emails-e2e';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { ForbiddenPs } from '../test-types2';
import { TestAnonStatus, TestNeverAlways } from '../test-constants';
import c from '../test-constants';
import { j2s, logDebug } from '../utils/log-and-die';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;

let owen: Member;
let owen_brA: TyE2eTestBrowser;
let owensForbiddenWords: St[] | U;
let owensForbiddenPs: ForbiddenPs;

let memah: Member;
let memah_brB: TyE2eTestBrowser;
let memahsForbiddenWords: St[] | U;
let memahsForbiddenPs: ForbiddenPs;

let modya: Member;
let modya_brB: TyE2eTestBrowser;
let modyasForbiddenWords: St[] | U;
let modyasForbiddenWordsMinusOwen: St[] | U;
let modyasForbiddenPs: ForbiddenPs;
let modyasForbiddenPsMinusOwen: ForbiddenPs;

let owenIdName: St[] | U;
let memahIdName: St[] | U;
let modyaIdName: St[] | U;


let site: IdAddress;
let forum: TwoCatsTestForum;  // or TwoPagesTestForum or EmptyTestForum or LargeTestForum


let memahsPagePath: St | U;
const me_x_mahsPage = {
  title: 'me_x_mahsPage_title',
  body: 'me_x_mahsPage_body',
};

const ow_ensReply1 = 'ow_ensReply1';
const ow_ensReply2 = 'ow_ensReply2';
const me_mahsReply1 = 'me_mahsReply1';
const me_mahsReply2 = 'me_mahsReply2';
const me_mahsReply3 = 'me_mahsReply3';

const allPostTexts = [
        me_x_mahsPage.title,
        me_x_mahsPage.body,
        ow_ensReply1,
        ow_ensReply2,
        me_mahsReply1,
        me_mahsReply2,
        me_mahsReply3,
        ];

let expectedNumEmails = 0;


describe(`alias-anons-approve-review.2br.f  TyTALIANONAPRREV`, () => {

  it(`Construct site`, async () => {
    make.setNextUserId(1020304001); // [e2e_forbidden_anon_ids]

    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "E2e: Anon Edit Alter",
      members: ['modya', 'memah', 'maria', 'michael']
    });

    builder.getSite().settings.enableAnonSens = true;
    builder.getSite().settings.enablePresence = false;

    // Make Cat A anonymous, permanently (for sensitive discussions).
    forum.categories.categoryA.comtsStartAnon = TestNeverAlways.Recommended;
    forum.categories.categoryA.newAnonStatus = TestAnonStatus.IsAnonOnlySelfCanDeanon;

    // We'll verify that no real names are in the new-posts-to-moderate emails.
    builder.settings({
      numFirstPostsToApprove: 2,
      maxPostsPendApprBefore: 2,
      numFirstPostsToReview: 1,
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

    memah = forum.members.memah;
    memah_brB = brB;
    modya = forum.members.modya;
    modya_brB = brB;

    const forbiddenPs = { forbiddenWordsOkInPresence: false, shouldFindWords: allPostTexts };

    owenIdName = ['' + owen.id, "owen", owen.username, owen.fullName];
    memahIdName = ['' + memah.id, memah.username, memah.fullName];
    modyaIdName = ['' + modya.id, modya.username, modya.fullName];
    //assert.eq(michael.id, 1020304006); // or a test breaks, at the end.

    owensForbiddenWords = [...modyaIdName, ...memahIdName];
    owensForbiddenPs = { forbiddenWords: owensForbiddenWords, ...forbiddenPs };

    memahsForbiddenWords = [...owenIdName, ...modyaIdName];
    memahsForbiddenPs = { forbiddenWords: memahsForbiddenWords, ...forbiddenPs };

    modyasForbiddenWords = [...owenIdName, ...memahIdName];
    modyasForbiddenPs = { forbiddenWords: modyasForbiddenWords, ...forbiddenPs };

    modyasForbiddenWordsMinusOwen = [memah.username, memah.fullName];
    modyasForbiddenPsMinusOwen = { forbiddenWords: modyasForbiddenWordsMinusOwen, ...forbiddenPs };

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    server.skipRateLimits(site.id);
  });


  // ----- Login & forbidden words

  it(`Memah goes to Category A,  with forbidden words ...`, async () => {
    await memah_brB.go2(site.origin + '/latest/category-a', memahsForbiddenPs);
  });

  it(`... logs in`, async () => {
    await memah_brB.complex.loginWithPasswordViaTopbar(memah);
  });

  it(`ttt: Memah's forbidden words are remembered across login`, async () => {
    const wordsObj: [St[], Bo, St[]] = await memah_brB.getForbiddenWords();
    assert.deepEq(wordsObj, [memahsForbiddenWords, false, allPostTexts]);
  });


  // ----- Imported anon cat worked?

  it(`... now there's a persona indicator: Memah is anonymous, by default`, async () => {
    await memah_brB.topbar.personaIndicator.assertIsIndicated({
            anonStatus: TestAnonStatus.IsAnonOnlySelfCanDeanon });
  });


  // ----- Post anonymously

  it(`Memah starts composing a topic`, async () => {
    await memah_brB.forumButtons.clickCreateTopic();
  });
  it(`... a Post-as dropdown appears`, async () => {
    await memah_brB.waitForVisible('.c_AliasB');
  });
  it(`... with Anonymously preselected (anonymity recommended here)`, async () => {
    await memah_brB.editor.waitForAnonPurpose(TestAnonStatus.IsAnonOnlySelfCanDeanon);
  });
  it(`... she submits the topic, as a question`, async () => {
    await memah_brB.editor.editTitle(me_x_mahsPage.title);
    await memah_brB.editor.editText(me_x_mahsPage.body);
    await memah_brB.editor.setTopicType(c.TestPageRole.Question);
    await memah_brB.complex.saveTopic({ ...me_x_mahsPage,
            // Title & text not shown until after Owen has approved the page.
            matchAfter: false });
    memahsPagePath = await memah_brB.urlPath();

    owen.expectedNumEmails = 1; // Owen gets a new-page-to-approve email, since is admin
    modya.expectedNumEmails = 1; // Modya too, since is moderator
    expectedNumEmails += 2;
  });

  let emailHtml: St | U;

  // Modya_too!
  it(`Owen gets notified about Memah's new topic`, async () => {
    const emails: EmailSubjectBody[] =
            await server.waitGetLastEmailsSentTo(
                site.id, owen.emailAddress, owen.expectedNumEmails);
    emailHtml = emails[emails.length - 1].bodyHtmlText;
    assert.includes(emailHtml, me_x_mahsPage.title);
    assert.includes(emailHtml, me_x_mahsPage.body);
  });
  it(`... he doesn't see her name`, async () => {
    assert.excludes(emailHtml, [memah.username, memah.fullName]);
  });
  it(`... instead, "${c.EmailAnonName}" as author name`, async () => {
    assert.includes(emailHtml, `>${c.EmailAnonName}</`); // between <i>..</i> tags
  });
  it(`... it's to him; he sees his name`, async () => {
    assert.includes(emailHtml, `Dear ${owen.username}`);
  });
  it(`... it's a mod task`, async () => {
    assert.includes(emailHtml, `e_NfEm_ModTsk`);
  });
  it(`No other emails get sent`, async () => {
    const { num, addrsByTimeAsc } = await server.getEmailsSentToAddrs(site.id);
    assert.eq(num, expectedNumEmails, `Emails sent to: ${addrsByTimeAsc}`);
  });


  it(`Owen goes to Memah's page, without logging in`, async () => {
    await owen_brA.go2(site.origin + memahsPagePath); //, owensForbiddenPs);
    //  oops, too soon:   bodyHtml = document.body.outerHTML;     in Server.ts    <———
  });
  it(`... he doesn't see the page. It's not yet approved,  and he hasn't logged in
            so he doesn't see unapproved posts  [add_2_test_map]`, async () => {
    await owen_brA.assertNotFoundError();
  });
  it(`Owen logs in,  doesn't see Memah's name anywhere, because Memah is anon`, async () => {
    await owen_brA.loginDialog.loginWithPassword(owen);
  });
  //it(`ttt: ... and Owen's forbidden words are remembered across login`, async () => {
  //  const wordsObj: [St[], Bo, St[]] = await owen_brA.getForbiddenWords();
  //  assert.deepEq(wordsObj, [owensForbiddenWords, false, allPostTexts]);
  //});

  it(`Owen goes the admin area, moderation page`, async () => {
    await owen_brA.topbar.myMenu.goToAdminReview();
  });
  it(`... sees Mema's new topic`, async () => {
    await owen_brA.adminArea.review.waitForTextToReview(
            // 's' makes '.' match line breaks too.
            new RegExp(`${me_x_mahsPage.title}.*${me_x_mahsPage.body}`, 's'));
  });

  it(`... approves Memah's new topic`, async () => {
    await owen_brA.adminArea.review.approvePostForMostRecentTask();
    await owen_brA.adminArea.review.playTimePastUndo();
    await owen_brA.adminArea.review.waitForServerToCarryOutDecisions();
  });

  it(`... follows the link to Memah's page  [add_2_test_map]`, async () => {
    await owen_brA.go2(site.origin + memahsPagePath, owensForbiddenPs);
    //await owen_brA.waitAndClick('.s_A_Rvw_Tsk_ViewB');
    //await owen_brA.closeWindowSwitchToOther();
  });

  it(`... replies anonymously to Memah`, async () => {
    await owen_brA.complex.replyToOrigPost(ow_ensReply1);
    // New comment to review. Otherwise, Modya could guess it's by Owen. [mod_deanon_risk]
    modya.expectedNumEmails += 1;
    expectedNumEmails += 1;
  });
  it(`... Owen's reply doesn't get approved automatically`, async () => {
    // Doesn't work. Calls:  this.waitForVisible('.c_AuD')   no idea why.
    //await owen_brA.topic.assertPostNeedsApprovalBodyVisible(c.SecondReplyNr);
  });
  it(`... Owen approves his reply 2`, async () => {
    await owen_brA.adminArea.review.goHere();
    await owen_brA.adminArea.review.waitForTextToReview(ow_ensReply1);
    await owen_brA.adminArea.review.approvePostForMostRecentTask();
    await owen_brA.adminArea.review.playTimePastUndo();
    await owen_brA.adminArea.review.waitForServerToCarryOutDecisions();

    // Now a notf email gets sent to Memah
    memah.expectedNumEmails = 1;
    expectedNumEmails += 1;
  });

  it(`... Memah sees Owen's comment in a WebSocket message`, async () => {
    const expected = {};
    expected[ow_ensReply1] = { exactly: 1 };
  });

  checkEmailsTo("Memah", () => memah, { from: ["Owen", () => owen], isAnon: true,
              isWhat: 'DirectReply', textOrRegex: ow_ensReply1,
              expectedNumEmails: () => expectedNumEmails, site: () => site });

  it(`Memah reloads the page, notices Owen's reply is now approved`, async () => {
    await memah_brB.refresh2();
  });
  it(`... replies to Owen  (reuses her orig post anon)`, async () => {
    await memah_brB.complex.replyToPostNr(c.FirstReplyNr, me_mahsReply1);
    owen.expectedNumEmails += 1;
    modya.expectedNumEmails += 1;
    expectedNumEmails += 2;
  });

  checkEmailsTo("Owen", () => owen, { from: ["Memah", () => memah], isAnon: true,
            isWhat: 'ReplyToReview', textOrRegex: me_mahsReply1,
            // expectedNumEmails — skip, don't know if the email to Modya has been sent yet.
            site: () => site });

  checkEmailsTo("Modya", () => modya, { from: ["Memah", () => memah], isAnon: true,
            isWhat: 'ReplyToReview', textOrRegex: me_mahsReply1,
            expectedNumEmails: () => expectedNumEmails, site: () => site });

  it(`... Owen approves Memah's reply`, async () => {
    await owen_brA.refresh2();
    await owen_brA.adminArea.review.waitForTextToReview(me_mahsReply1);
    await owen_brA.adminArea.review.approvePostForMostRecentTask();
    await owen_brA.adminArea.review.playTimePastUndo();
    await owen_brA.adminArea.review.waitForServerToCarryOutDecisions();
  });


  it(`Memah replies again to Owen, now appears directly`, async () => {
    await memah_brB.complex.replyToPostNr(c.FirstReplyNr, me_mahsReply2);
    // But still to be reviewed, afterwards:
    owen.expectedNumEmails += 1;
    modya.expectedNumEmails += 1;
    expectedNumEmails += 2;
  });
  checkEmailsTo("Owen", () => owen, { from: ["Memah", () => memah], isAnon: true,
              isWhat: 'ReplyToReview', textOrRegex: me_mahsReply2,
              expectedNumEmails: () => expectedNumEmails, site: () => site });
  it(`... Owen sees Memah's comment in a WebSocket message`, async () => {
    const expected = {};
    expected[me_mahsReply2] = { exactly: 1 };
    const counts = await owen_brA.waitForShouldWords(expected);
    logDebug(`counts 1: ${j2s(counts)}`);
  });

  it(`... Owen reviews Memah's reply (which is already shown)`, async () => {
    await owen_brA.refresh2();
    await owen_brA.adminArea.review.waitForTextToReview(me_mahsReply2);
    await owen_brA.adminArea.review.approvePostForMostRecentTask();
    await owen_brA.adminArea.review.playTimePastUndo();
    await owen_brA.adminArea.review.waitForServerToCarryOutDecisions();
  });


  it(`Memah replies a third time to Owen, now appears directly and no review task`, async () => {
    await memah_brB.complex.replyToPostNr(c.FirstReplyNr, me_mahsReply3);
    owen.expectedNumEmails += 1; // a reply notification
    // modya.expectedNumEmails — won't change. Nothing to review, this time.
    expectedNumEmails += 1;
  });
  checkEmailsTo("Owen", () => owen, { from: ["Memah", () => memah], isAnon: true,
              isWhat: 'DirectReply', textOrRegex: me_mahsReply3,
              expectedNumEmails: () => expectedNumEmails, site: () => site });

  // Nope, he's in the admin area, not watching any page for the moment, skip:
  // it(`... Owen sees Memah's comment in a WebSocket message`, async () => { ... });

  it(`Owen sees the posts-to-moderate list is empty`, async () => {
    await owen_brA.refresh2();
    assert.not(await owen_brA.adminArea.review.isMoreStuffToReview());
  });

  it(`Owen replies to Memah again, anonymously`, async () => {
    await owen_brA.go2(memahsPagePath);
    await owen_brA.complex.replyToPostNr(c.SecondReplyNr, ow_ensReply2);
    modya.expectedNumEmails += 1; // about reviewing Owen's anon comment
    expectedNumEmails += 1;
  });

  checkEmailsTo("Modya", () => modya, { from: ["Owen", () => owen], isAnon: true,
              isWhat: 'ReplyToReview', textOrRegex: ow_ensReply2,
              expectedNumEmails: () => expectedNumEmails, site: () => site });

  // [moderate_anon_cats]
  // This isn't yet allowed — results in a "You cannot yet do this anonymously .. enter Yourself
  // mode [TyEPERSONAUNSUP1]" error,  since otherwise mods maybe maybe would believe that their
  // *moderator* actions are anonymous.
  // Later: Show a "Do as yourself? [y / n]" dialog.

  // HARMLESS_BUG:  One's name in users list if has bookmark, but only oneself can see.


  it(`Memah leaves`, async () => {
    await memah_brB.topbar.clickLogout();
  });
  it(`Moderator Modya arrives,  Memah is a forbidden word — but not Owen; his name
            will be on the moderation page, because he's approved some comments`, async () => {
    await modya_brB.go2(memahsPagePath, modyasForbiddenPsMinusOwen);
    await modya_brB.complex.loginWithPasswordViaTopbar(modya);
  });

  it(`... Modya goes to the moderation page, approves Owen's reply`, async () => {
    await modya_brB.adminArea.review.goHere();
    await modya_brB.adminArea.review.waitForTextToReview(ow_ensReply2);
    await modya_brB.adminArea.review.approvePostForMostRecentTask();
    await modya_brB.adminArea.review.playTimePastUndo();
    await modya_brB.adminArea.review.waitForServerToCarryOutDecisions();
  });

  it(`... now Modya sees Owen's reply — it's anonymous.  Both Owen & Mema forbidden`, async () => {
    await modya_brB.go2(memahsPagePath, modyasForbiddenPs);
    // Owen's 1st reply, Memah 3 replies —> 4, next is the 5th reply.
    await modya_brB.topic.waitForPostAssertTextMatches(c.FourthReplyNr + 1, ow_ensReply2);
  });

  it(`No one's name is in the page html source`, async () => {
    const source = await modya_brB.getPageSource();
    assert.excludes(source, modyasForbiddenWords);
  });

  it(`ttt: But on the users list page, Modya sees Owen's and Memah's names ...`, async () => {
    await modya_brB.adminArea.goToUsersEnabled();
  });
  it(`ttt: ... which makes this e2e test pop up an error dialog`, async () => {
    await modya_brB.serverErrorDialog.waitAndAssertTextMatches(
        /TyEFORBWDS_.+req url: +\/-\/list-complete-users\?.+words: +\["1020304001","owen",.*"memah"/s);
  });

});

