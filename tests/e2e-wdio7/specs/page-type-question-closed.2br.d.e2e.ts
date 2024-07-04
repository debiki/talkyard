/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let browser: TyE2eTestBrowser;
declare let browserA: any;
declare let browserB: any;

let corax;
let corax_brA: TyE2eTestBrowser;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let michael;
let michaelsBrowser: TyE2eTestBrowser;
let owen;
let owensBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

let mariasTopicUrl: string;

const catAnserNr = c.FirstReplyNr;
const otterAnserNr = c.SecondReplyNr;
const selectAnswerPostNr = 4;
const closeEventPostNr = selectAnswerPostNr + 6;  // = 10
const reopenEventPostNr = closeEventPostNr + 3;   // = 13


describe(`page-type-question-closed.2br.d  TyTPATYQUESTCLOSD`, () => {

  it("Initialize people", () => {
    const brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    michaelsBrowser = brA;
    owensBrowser = brA;
    corax_brA = brA;
    mariasBrowser = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    corax = make.memberCorax();
    maria = make.memberMaria();
    michael = make.memberMichael();
    owen = make.memberOwenOwner();
  });

  it("Import a site", async () => {
    const site: SiteData = make.forumOwnedByOwen('ptqst', { title: "Page type Question test" });
    site.members.push(corax);
    site.members.push(maria);
    site.members.push(michael);
    idAddress = await server.importSiteData(site);
    siteId = idAddress.id;
    await server.skipLimits(siteId, { rateLimits: true });
  });

  it("Maria logs in", async () => {
    await mariasBrowser.go2(idAddress.origin);
    await mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("She posts a question", async () => {
    await mariasBrowser.complex.createAndSaveTopic({
            type: c.TestPageRole.Question, title: "Which pet?",
            body: "Should I get a cat or an otter?" });
    mariasTopicUrl = await mariasBrowser.getUrl();
  });

  it("... a help text explains how the Question topic type works", async () => {
    assert.ok(await mariasBrowser.topicTypeExpl.isTopicTypeExplVisible());
  });

  it("Michael logs in", async () => {
    await michaelsBrowser.go2(mariasTopicUrl);
    await michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
  });

  it("... posts two answers", async () => {
    await michaelsBrowser.complex.replyToOrigPost("Yes, a cat");     // becomes post nr 2
    await michaelsBrowser.complex.replyToOrigPost("Yes, an otter");  // becomes post nr 3
    await michaelsBrowser.topic.waitForPostNrVisible(otterAnserNr);  // avoids [refresh_race]
  });

  it("... attempts to select an answer, but cannot (not his question)", async () => {
    await michaelsBrowser.topic.refreshUntilPostNrAppears(otterAnserNr);
    assert.not(await michaelsBrowser.topic.canSelectAnswer());  // (2PR5PH)
  });

  it("Maria selects one answer", async () => {
    await mariasBrowser.refresh2();
    await mariasBrowser.topic.waitForPostNrVisible(catAnserNr);
    assert.ok(await mariasBrowser.topic.canSelectAnswer()); // (2PR5PH)
    // Meta comment, nr 4 == selectAnswerPostNr
    await mariasBrowser.topic.selectPostNrAsAnswer(catAnserNr); // a cat
  });

  it("... unselects", async () => {
    await mariasBrowser.topic.unselectPostNrAsAnswer(catAnserNr); // nr 5
  });

  it("... selects another", async () => {
    await mariasBrowser.topic.selectPostNrAsAnswer(otterAnserNr); // nr 6
  });

  it("... unselects it, selects it again", async () => {
    await mariasBrowser.topic.unselectPostNrAsAnswer(otterAnserNr); // nr 7
    await mariasBrowser.topic.selectPostNrAsAnswer(otterAnserNr);   // nr 8
  });

  it("She can click the check mark icon next to the title, to view the answer", async () => {
    await mariasBrowser.waitAndClick('.dw-p-ttl .dw-clickable')
    await mariasBrowser.waitAndClick('.e_VwAnsB');
    // (Bonus points: Could verify that the browser scrolls to the answer.)
  });

  it("Owen logs in", async () => {
    await michaelsBrowser.topbar.clickLogout();
    await owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... sees 5 select or unselect answer meta comments", async () => {
    assert.that(await owensBrowser.topic.isPostNrVisible(selectAnswerPostNr));
    assert.that(await owensBrowser.topic.isPostNrVisible(selectAnswerPostNr + 1));
    assert.that(await owensBrowser.topic.isPostNrVisible(selectAnswerPostNr + 2));
    assert.that(await owensBrowser.topic.isPostNrVisible(selectAnswerPostNr + 3));
    assert.that(await owensBrowser.topic.isPostNrVisible(selectAnswerPostNr + 4));
  });

  it("... and unselects the answer", async () => {
    await owensBrowser.topic.unselectPostNrAsAnswer(otterAnserNr);  // nr 9
  });

  it("... and closes the topic", async () => {
    assert.not(await owensBrowser.topic.isPostNrVisible(closeEventPostNr)); // ttt
    await owensBrowser.topic.closeTopic();  // generates post nr 4 = closeEventPostNr
  });

  it("Maria wants to select Otter as answer again, but she cannot (page closed)", async () => {
    await mariasBrowser.topic.refreshUntilPostNrAppears(closeEventPostNr, { isMetaPost: true });
    await mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    assert.not(await owensBrowser.topic.isPostNrVisible(closeEventPostNr + 1)); // ttt
    assert.not(await mariasBrowser.topic.canSelectAnswer());  // (2PR5PH)
  });

  it("... instead she replies", async () => {
    await mariasBrowser.complex.replyToPostNr(otterAnserNr, "Thanks! Such a good idea"); // nr 11
  });

  it("... and post a progress reply", async () => {
    await mariasBrowser.complex.addProgressReply(
          "Thanks everyone! An otter then, a bath tube, and fish.")  // nr 12
  });

  it("Owen reopens the topic", async () => {
    assert.not(await owensBrowser.topic.isPostNrVisible(reopenEventPostNr)); // ttt
    await owensBrowser.topic.reopenTopic();  // generates post nr `reopenEventPostNr` nr 13
  });

  it("Now Maria can select Otter — but oh no! She accidentally selects Cat", async () => {
    await mariasBrowser.refresh2();
    await mariasBrowser.topic.selectPostNrAsAnswer(catAnserNr); // nr 14
  });

  it("... Currently needs to refres for all posts to appear", async () => {
    await mariasBrowser.topic.refreshUntilPostNrAppears(reopenEventPostNr + 1, { isMetaPost: true });
    // There's no post nr `reopenEventPostNr + 2`.
    assert.not(await owensBrowser.topic.isPostNrVisible(reopenEventPostNr + 2)); // ttt
  });

  it("Everything is in the correct order", async () => {
    await mariasBrowser.topic.waitForPostAssertTextMatches(1, "a cat or an otter?");
    await mariasBrowser.topic.assertPostTextMatches(2, "Yes, a cat");
    await mariasBrowser.topic.assertPostTextMatches(3, "Yes, an otter");

    await mariasBrowser.topic.assertMetaPostTextMatches(selectAnswerPostNr, /^accepted an answer/);
    await mariasBrowser.topic.assertMetaPostTextMatches(selectAnswerPostNr + 1, "unaccepted an answer");
    await mariasBrowser.topic.assertMetaPostTextMatches(closeEventPostNr, "closed");            // nr 10
    await mariasBrowser.topic.assertPostTextMatches(closeEventPostNr + 1, "good idea");         // nr 11
    await mariasBrowser.topic.assertPostTextMatches(closeEventPostNr + 2, "Thanks everyone!");  // nr 12

    await mariasBrowser.topic.assertMetaPostTextMatches(reopenEventPostNr, "reopened");
  });

  it("Everything is in the correct order", async () => {
    await mariasBrowser.topic.assertPostOrderIs([
        c.TitleNr,
        c.BodyNr,
        2,   // cat
        3,   // otter
       11,   //  `——— the "Good idea" reply

        4,   // selects cat
        5,   // unselects
        6,   // selects otter
        7,   // unselects
        8,   // reselects
        9,   // Owen unselects
       10,   // Owen closes page

       12,   // the "Thanks everyone" comment
       13,   // Owen reopens page
       14,   // Maria selects cat, accidentally
       ]);
  });

  it("Owen leaves, Corax arrives", async () => {
    await owensBrowser.topbar.clickLogout();
    await corax_brA.complex.loginWithPasswordViaTopbar(corax);
  });

  it("... and unselects the answer. Corax can, he's a Core Member  TyTCORECAN", async () => {
    await corax_brA.topic.unselectPostNrAsAnswer(catAnserNr);
  });

  it("... selects Otter, very helpfully. All is fine again", async () => {
    await corax_brA.topic.selectPostNrAsAnswer(otterAnserNr);
  });

  it("Maria reloads, sees Otter is selected", async () => {
    await mariasBrowser.refresh2();
    await mariasBrowser.topic.waitUntilPostNrIsAnswer(otterAnserNr);
  });

});

