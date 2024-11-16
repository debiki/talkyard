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

let alice: Member;
let alice_brA: TyE2eTestBrowser;
let alicesForbiddenWords: St[] | U;
let alicesForbiddenPs: ForbiddenPs;

let owenIdName: St[] | U;
let memahIdName: St[] | U;
let aliceIdName: St[] | U;


let site: IdAddress;
let forum: TwoCatsTestForum;  // or TwoPagesTestForum or EmptyTestForum or LargeTestForum


let memahsPagePath: St | U;
const me_x_mahsPage = {
  title0Ed: 'me_x_mahsPage_title0Ed',
  titleEdited: 'me_x_mahsPage_titleEdited',
  body0Ed: 'me_x_mahsPage_body0Ed',
  bodyEdited: 'me_x_mahsPage_bodyEdited',
};

const al_icesReply1 = 'al_icesReply1';
const me_mahsReply0Ed = 'me_mahsReply0Ed';
const me_mahsReplyEdited = 'me_mahsReplyEdited';

const allPostTexts = [
        me_x_mahsPage.title0Ed,
        me_x_mahsPage.titleEdited,
        me_x_mahsPage.body0Ed,
        me_x_mahsPage.bodyEdited,
        al_icesReply1,
        me_mahsReply0Ed,
        me_mahsReplyEdited,
        ];

let nextReplyNr = c.FirstReplyNr;
let alicesReplyNr: Nr | U;
let memahsReplyNr: Nr | U;
let expectedNumEmails = 0;


// This is an a bit too long test!  2 minutes.
// Could split into:
//   alias-anons-alter-statuses.2br.f  (question answered / idea doing status /...)
//   alias-anons-delete-edit-close.2br.f  (un/delete page, edit page & comment, un/close)
//
describe(`alias-anons-edit-alter.2br.f  TyTALIANONEDALTR`, () => {
    make.setNextUserId(1020304001); // [e2e_forbidden_anon_ids]

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addCatABForum({
      title: "E2e: Anon Edit Alter",
      members: ['alice', 'memah', 'maria', 'michael']
    });

    builder.getSite().settings.enableAnonSens = true;
    builder.getSite().settings.enablePresence = false;

    // Make Cat A and B anonymous, permanently (for sensitive discussions).
    forum.categories.categoryA.comtsStartAnon = TestNeverAlways.Recommended;
    forum.categories.categoryA.newAnonStatus = TestAnonStatus.IsAnonOnlySelfCanDeanon;
    forum.categories.catB.comtsStartAnon = TestNeverAlways.Recommended;
    forum.categories.catB.newAnonStatus = TestAnonStatus.IsAnonOnlySelfCanDeanon;

    builder.settings({
      numFirstPostsToApprove: 0,
      maxPostsPendApprBefore: 0,
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
    alice = forum.members.alice;
    alice_brA = brA;

    memah = forum.members.memah;
    memah_brB = brB;

    const forbiddenPs = { forbiddenWordsOkInPresence: false, shouldFindWords: allPostTexts };

    owenIdName = ['' + owen.id, "owen", owen.username, owen.fullName];
    memahIdName = ['' + memah.id, memah.username, memah.fullName];
    aliceIdName = ['' + alice.id, alice.username, alice.fullName];
    assert.eq(alice.id, 1020304002); // or a test breaks, at the end.
    assert.eq(alice.username, 'admin_alice');

    owensForbiddenWords = [...memahIdName, ...aliceIdName];
    owensForbiddenPs = { forbiddenWords: owensForbiddenWords, ...forbiddenPs };

    memahsForbiddenWords = [...owenIdName, ...aliceIdName];
    memahsForbiddenPs = { forbiddenWords: memahsForbiddenWords, ...forbiddenPs };

    alicesForbiddenWords = [...owenIdName, ...memahIdName];
    alicesForbiddenPs = { forbiddenWords: alicesForbiddenWords, ...forbiddenPs };

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

  it(`Memah posts an anonymous question`, async () => {
    await memah_brB.complex.createAndSaveTopic({
          title: me_x_mahsPage.title0Ed, body: me_x_mahsPage.body0Ed,
          type: c.TestPageRole.Question });
    memahsPagePath = await memah_brB.urlPath();

    owen.expectedNumEmails = 1; // subscribed to everything
    expectedNumEmails += 1;
  });

  checkEmailsTo("Owen", () => owen, { from: ["Memah", () => memah], isAnon: true,
              isWhat: 'NewTopic', textOrRegex: me_x_mahsPage.title0Ed,
              site: () => site });


  it(`Alice goes to Memah's page,  with forbidden words`, async () => {
    await alice_brA.go2(site.origin + memahsPagePath, alicesForbiddenPs);
  });
  it(`... logs in,  doesn't see Memah's name anywhere, because Memah is anon`, async () => {
    await alice_brA.complex.loginWithPasswordViaTopbar(alice);
  });
  it(`ttt: ... Alice's forbidden words are remembered across login`, async () => {
    const wordsObj: [St[], Bo, St[]] = await alice_brA.getForbiddenWords();
    assert.deepEq(wordsObj, [alicesForbiddenWords, false, allPostTexts]);
  });


  // ----- Delete, undelete

  it(`Memah deletes the page  (she can, since there's no replies)  000`, async () => {
    await memah_brB.topic.deletePage();
    // An "Anonymous deleted this topic" meta comment becomes nr c.FirstReplyNr.
    nextReplyNr += 1;
  });

  addAliceDoesntSeeMemahTest(`000`);

  it(`Memah undeletes the page`, async () => {
    await memah_brB.topic.undeletePage();
    nextReplyNr += 1; // an "... undeleted this topic ..." meta comment
  });


  // ----- Add replies

  it(`Alice replies anonymously to Memah`, async () => {
    await alice_brA.complex.replyToOrigPost(al_icesReply1);
    alicesReplyNr = nextReplyNr;
    nextReplyNr += 1;
    memah.expectedNumEmails = 1;
    owen.expectedNumEmails += 1;
    expectedNumEmails += 2;
  });

  it(`... Memah sees Alice's comment in a WebSocket message`, async () => {
    const expected = {};
    expected[al_icesReply1] = { exactly: 1 };
    await memah_brB.waitForShouldWords(expected);
  });

  checkEmailsTo("Memah", () => memah, { from: ["Alice", () => alice], isAnon: true,
              isWhat: 'DirectReply', textOrRegex: al_icesReply1,
              site: () => site });

  checkEmailsTo("Owen", () => owen, { from: ["Alice", () => alice], isAnon: true,
              isWhat: 'CommentNotf', textOrRegex: al_icesReply1,
              expectedNumEmails: () => expectedNumEmails, site: () => site });


  it(`Memah replies to Alice  (reuses her orig post anon)`, async () => {
    await memah_brB.complex.replyToPostNr(alicesReplyNr, me_mahsReply0Ed);
    memahsReplyNr = nextReplyNr;
    nextReplyNr += 1;
    alice.expectedNumEmails = 1;
    owen.expectedNumEmails += 1;
    expectedNumEmails += 2;
  });

  it(`... Alice sees Memah's comment in a WebSocket message`, async () => {
    const expected = {};
    expected[me_mahsReply0Ed] = { exactly: 1 };
    await alice_brA.waitForShouldWords(expected);  // fok
  });

  checkEmailsTo("Alice", () => alice, { from: ["Memah", () => memah], isAnon: true,
              isWhat: 'DirectReply', textOrRegex: me_mahsReply0Ed,
              site: () => site });

  checkEmailsTo("Owen", () => owen, { from: ["Memah", () => memah], isAnon: true,
            isWhat: 'CommentNotf', textOrRegex: me_mahsReply0Ed,
            expectedNumEmails: () => expectedNumEmails, site: () => site });


  // ----- Accept/unaccept answer

  it(`Memah selects Alice's reply as the answer  111`, async () => {
    await memah_brB.refresh2();
    await memah_brB.topic.selectPostNrAsAnswer(alicesReplyNr);
  });

  it(`Afterwards, Alice doesn't see Memah's name anywhere  11aa`, async () => {
    await alice_brA.refresh2();
    await alice_brA.waitForMyDataAdded();
    await alice_brA.serverErrorDialog.failIfDisplayed();
    // ttt: This shouldn't be needed, but just in case.
    assert.excludes(await alice_brA.getPageSource(), alicesForbiddenWords);
  });

  it(`Memah unselects Alice's answer  111`, async () => {
    await memah_brB.topic.unselectPostNrAsAnswer(alicesReplyNr);
  });

  addAliceDoesntSeeMemahTest(`11bb`);


  // ----- Switch to Idea,  select solution

  it(`Memah changes the page to an Idea`, async () => {
    await memah_brB.pageTitle.openChangePageDialog();
    await memah_brB.editor.setTopicType(c.TestPageRole.Idea);
  });

  it(`... selects Alice's reply as the solution  222`, async () => {
    await memah_brB.refresh2();
    await memah_brB.topic.selectPostNrAsAnswer(alicesReplyNr);
  });

  addAliceDoesntSeeMemahTest(`22aa`);

  it(`Memah unselects Alice's answer  222`, async () => {
    await memah_brB.topic.unselectPostNrAsAnswer(alicesReplyNr);
  });


  // ----- Cycle Doing statuses

  it(`Changes status to Planned  222`, async () => {
    await memah_brB.topic.setDoingStatus('Planned');
  });
  it(`... then to Started`, async () => {
    await memah_brB.topic.setDoingStatus('Started');
  });
  it(`... then to Done`, async () => {
    await memah_brB.topic.setDoingStatus('Done');
  });

  addAliceDoesntSeeMemahTest(`22bb`);

  it(`Memah sets the Doing status back to New`, async () => {
    await memah_brB.topic.setDoingStatus('New');
  });


  // ----- Switch to Problem,  select solution

  it(`Memah changes the page to a Problem`, async () => {
    await memah_brB.pageTitle.openChangePageDialog();
    await memah_brB.editor.setTopicType(c.TestPageRole.Problem);
  });

  it(`... selects Alice's reply as the solution  333`, async () => {
    await memah_brB.refresh2();
    await memah_brB.topic.selectPostNrAsAnswer(alicesReplyNr);
  });

  addAliceDoesntSeeMemahTest(`333`);

  it(`Memah unselects Alice's answer  333`, async () => {
    await memah_brB.topic.unselectPostNrAsAnswer(alicesReplyNr);
  });


  // ----- Cycle Solvinging statuses

  it(`Changes status to Planned  333`, async () => {
    await memah_brB.topic.setDoingStatus('Planned');
  });
  it(`... then to Started`, async () => {
    await memah_brB.topic.setDoingStatus('Started');
  });
  it(`... then to Done`, async () => {
    await memah_brB.topic.setDoingStatus('Done');
  });

  addAliceDoesntSeeMemahTest(`333`);

  it(`Memah changes problem status back to New`, async () => {
    await memah_brB.topic.setDoingStatus('New');
  });


  // ----- Close, reopen.

  it(`Memah closes the page  444`, async () => {
    await memah_brB.topic.closeTopic();
  });

  addAliceDoesntSeeMemahTest(`444`);

  it(`... reopens`, async () => {
    await memah_brB.topic.reopenTopic();
  });


  // ----- Edit title & text

  it(`Memah edits the page title and text  555`, async () => {
    await memah_brB.pageTitle.clickEdit();
    await memah_brB.pageTitle.editTitle(me_x_mahsPage.titleEdited);
    await memah_brB.pageTitle.save();
  });

  it(`... and text  555`, async () => {
    await memah_brB.complex.editPageBody(me_x_mahsPage.bodyEdited);
  });

  it(`... Alice sees the changes, but doesn't see Memah's name anywhere  555`, async () => {
    await alice_brA.refresh2();
    await alice_brA.assertPageTitleMatches(me_x_mahsPage.titleEdited);
    await alice_brA.waitForMyDataAdded();
    await alice_brA.serverErrorDialog.failIfDisplayed();
  });


  /* Can't yet do anonymously   [alias_ed_wiki]

  // ----- Wikify page and comment

  it(`Memah wikifies the page  66aa`, async () => {
    await memah_brB.topic.wikifyPostNr(c.BodyNr, true);
  });

  it(`... and her comment  66aa`, async () => {
    await memah_brB.topic.wikifyPostNr(memahsReplyNr, true);
  });

  addAliceDoesntSeeMemahTest(`66aa`);


  // ----- Un-wikify

  it(`Memah unwikifies the page  66bb`, async () => {
    await memah_brB.topic.wikifyPostNr(c.BodyNr, false);
  });

  it(`... and her comment  66bb`, async () => {
    await memah_brB.topic.wikifyPostNr(memahsReplyNr, false);
  });

  addAliceDoesntSeeMemahTest(`66bb`);
  */


  // ----- Move page

  it(`Memah moves the page to Category B  77`, async () => {
    await memah_brB.topic.movePageToOtherCategory(forum.categories.catB.name);
  });

  it(`... Alice sees it's in a new category, but Memah's name is nowhere  77`, async () => {
    await alice_brA.refresh2();
    assert.eq(await alice_brA.topic.getCurCategoryName(), forum.categories.catB.name);
    await alice_brA.waitForMyDataAdded();
    await alice_brA.serverErrorDialog.failIfDisplayed();
  });


  // ----- Deletes comment

  it(`Memah deletes her comment  88`, async () => {
    await memah_brB.topic.deletePost(memahsReplyNr);
  });

  it(`... and the whole page — no, only mods can do that  88`, async () => {
    // Todo?  At least if Alice deletes her reply.  [del_own_page]
  });

  addAliceDoesntSeeMemahTest(`88`);


  // ----- Memah admits

  it(`Memah says who she is ...`, async () => {
    await memah_brB.complex.replyToOrigPost(`It was me all the time! Memah!`);
  });

  it(`ttt: Alice sees Memah's name in a websocket message —
              it's a forbidden word, the error dialog appears`, async () => {
    // No refresh.
    await alice_brA.serverErrorDialog.waitAndAssertTextMatches(
          /TyEFORBWDS_.+req url: +WebSocket.+ words: +\["memah"/s);
  });

  it(`ttt: Alice sees Memah's name after reload too; the error dialog appears`, async () => {
    await alice_brA.refreshNothingElse();
    await alice_brA.serverErrorDialog.waitAndAssertTextMatches(
          /TyEFORBWDS_.+req url:.+words: +\["memah"/s);
  });

  it(`ttt: Alice replies ...`, async () => {
    await alice_brA.clearForbiddenWords(); // or save() fails because of "Memah"
    await alice_brA.refreshNothingElse();
    await alice_brA.topic.clickReplyToOrigPost();
  });
  it(`ttt: ... using her real name!`, async () => {
    await alice_brA.editor.setAnonPurpose(TestAnonStatus.NotAnon);
    await alice_brA.editor.editText("It was me also!");
    await alice_brA.editor.save();
  });

  it(`ttt: Memah sees Alice's id and name in a WebSocket message —
              forbidden words, the error dialog appears`, async () => {
    // No refresh.
    await memah_brB.serverErrorDialog.waitAndAssertTextMatches(
          /TyEFORBWDS_.+ req url: +WebSocket.+ words: +\["1020304002","admin_alice"/s);
  });


  function addAliceDoesntSeeMemahTest(suffix: St) {
    it(`... Alice doesn't see Memah's name anywhere  ${suffix}`, async () => {
      await alice_brA.refresh2();
      await alice_brA.waitForMyDataAdded();
      await alice_brA.serverErrorDialog.failIfDisplayed();
    });
  }

});

