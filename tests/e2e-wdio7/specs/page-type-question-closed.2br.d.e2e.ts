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

let everyonesBrowsers;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let michael;
let michaelsBrowser: TyE2eTestBrowser;
let owen;
let owensBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

let mariasTopicUrl: string;

const closeEventPostNr = 4;
const reopenEventPostNr = 7;


describe("Page type question", () => {

  it("Initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    mariasBrowser = new TyE2eTestBrowser(browserA);
    strangersBrowser = new TyE2eTestBrowser(browserB);
    michaelsBrowser = strangersBrowser;
    owensBrowser = strangersBrowser;
    maria = make.memberMaria();
    michael = make.memberMichael();
    owen = make.memberOwenOwner();
  });

  it("Import a site", async () => {
    const site: SiteData = make.forumOwnedByOwen('ptqst', { title: "Page type Question test" });
    site.members.push(maria);
    site.members.push(michael);
    idAddress = await server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("Maria logs in", async () => {
    await mariasBrowser.go2(idAddress.origin);
    await mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    await mariasBrowser.disableRateLimits();
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
  });

  it("... attempts to select an answer, but cannot (not his question)", async () => {
    await michaelsBrowser.topic.refreshUntilPostNrAppears(c.FirstReplyNr + 1);
    await michaelsBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);  // can remove
    assert.not(await michaelsBrowser.topic.canSelectAnswer());  // (2PR5PH)
  });

  it("Maria selects one answer", async () => {
    await mariasBrowser.refresh2();
    await mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    assert.ok(await mariasBrowser.topic.canSelectAnswer()); // (2PR5PH)
    await mariasBrowser.topic.selectPostNrAsAnswer(2);   // a cat
  });

  it("... unselects", async () => {
    await mariasBrowser.topic.unselectPostNrAsAnswer(2); // no cat
  });

  it("... selects another", async () => {
    await mariasBrowser.topic.selectPostNrAsAnswer(3);   // an otter
  });

  it("... unselects it, selects it again", async () => {
    await mariasBrowser.topic.unselectPostNrAsAnswer(3);
    await mariasBrowser.topic.selectPostNrAsAnswer(3);
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

  it("... and unselects the answer", async () => {
    await owensBrowser.topic.unselectPostNrAsAnswer(3);
  });

  it("... and closes the topic", async () => {
    await owensBrowser.topic.closeTopic();   // generates an event post, nr 4 = closeEventPostNr
  });

  it("Maria wants to select Otter as the accepted answer again, but now she cannot", async () => {
    await mariasBrowser.topic.refreshUntilPostNrAppears(closeEventPostNr, { isMetaPost: true });
    await mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    assert.not(await mariasBrowser.topic.canSelectAnswer());  // (2PR5PH)
  });

  it("... instead she replies", async () => {
    await mariasBrowser.complex.replyToPostNr(3, "Thanks! Such a good idea");  // becomes post nr 5
  });

  it("... and post a progress reply", async () => {
    await mariasBrowser.complex.addProgressReply("Thanks everyone! An otter then, a bath tube, and fish.")
  });

  it("Owen reopens the topic", async () => {
    await owensBrowser.topic.reopenTopic();   // generates an event post, nr 7 = reopenEventPostNr
  });

  it("Now Maria can select Otter", async () => {
    await mariasBrowser.refresh2();
    await mariasBrowser.topic.selectPostNrAsAnswer(3);
  });

  it("... Currently needs to refres for all posts to appear", async () => {
    await mariasBrowser.topic.refreshUntilPostNrAppears(7, { isMetaPost: true });
  });

  it("Everything is in the correct order", async () => {
    await mariasBrowser.topic.waitForPostAssertTextMatches(1, "a cat or an otter?");
    await mariasBrowser.topic.assertPostTextMatches(2, "Yes, a cat");
    await mariasBrowser.topic.assertPostTextMatches(3, "Yes, an otter");
    assert.eq(closeEventPostNr, 4);
    await mariasBrowser.topic.assertMetaPostTextMatches(4, "closed");
    await mariasBrowser.topic.assertPostTextMatches(5, "good idea");
    await mariasBrowser.topic.assertPostTextMatches(6, "Thanks everyone!");
    assert.eq(reopenEventPostNr, 7);
    await mariasBrowser.topic.assertMetaPostTextMatches(7, "reopened");

    await mariasBrowser.topic.assertPostOrderIs([  //  CROK  CODE REVIEW DONE OK
        c.TitleNr,
        c.BodyNr,
        2,   // cat
        3,   // otter
        5,   // the "Good idea" reply
        4,   // the topic-closed event
        6,   // the "Thanks everyone" comment
        7]); // the topic-reopened event
  });

});

