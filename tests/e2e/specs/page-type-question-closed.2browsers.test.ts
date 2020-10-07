/// <reference path="../test-types.ts"/>
import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

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
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    mariasBrowser = new TyE2eTestBrowser(browserA);
    strangersBrowser = new TyE2eTestBrowser(browserB);
    michaelsBrowser = strangersBrowser;
    owensBrowser = strangersBrowser;
    maria = make.memberMaria();
    michael = make.memberMichael();
    owen = make.memberOwenOwner();
  });

  it("Import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('ptqst', { title: "Page type Question test" });
    site.members.push(maria);
    site.members.push(michael);
    idAddress = server.importSiteData(site);
    siteId = idAddress.id;
  });

  it("Maria logs in", () => {
    mariasBrowser.go(idAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.disableRateLimits();
  });

  it("She posts a question", () => {
    mariasBrowser.complex.createAndSaveTopic({
      type: c.TestPageRole.Question, title: "Which pet?", body: "Should I get a cat or an otter?" });
    mariasTopicUrl = mariasBrowser.getUrl();
  });

  it("... a help text explains how the Question topic type works", () => {
    assert.ok(mariasBrowser.topicTypeExpl.isTopicTypeExplVisible());
  });

  it("Michael logs in", () => {
    michaelsBrowser.go(mariasTopicUrl);
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
  });

  it("... posts two answers", () => {
    michaelsBrowser.complex.replyToOrigPost("Yes, a cat");     // becomes post nr 2
    michaelsBrowser.complex.replyToOrigPost("Yes, an otter");  // becomes post nr 3
  });

  it("... attempts to select an answer, but cannot (not his question)", () => {
    michaelsBrowser.topic.refreshUntilPostNrAppears(c.FirstReplyNr + 1);
    michaelsBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);  // can remove
    assert(!michaelsBrowser.topic.canSelectAnswer());  // (2PR5PH)
  });

  it("Maria selects one answer", () => {
    mariasBrowser.refresh();
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    assert(mariasBrowser.topic.canSelectAnswer()); // (2PR5PH)
    mariasBrowser.topic.selectPostNrAsAnswer(2);   // a cat
  });

  it("... unselects", () => {
    mariasBrowser.topic.unselectPostNrAsAnswer(2); // no cat
  });

  it("... selects another", () => {
    mariasBrowser.topic.selectPostNrAsAnswer(3);   // an otter
  });

  it("... unselects it, selects it again", () => {
    mariasBrowser.topic.unselectPostNrAsAnswer(3);
    mariasBrowser.topic.selectPostNrAsAnswer(3);
  });

  it("She can click the check mark icon next to the title, to view the answer", () => {
    mariasBrowser.waitAndClick('.dw-p-ttl .dw-clickable')
    mariasBrowser.waitAndClick('.e_VwAnsB');
    // (Bonus points: Could verify that the browser scrolls to the answer.)
  });

  it("Owen logs in", () => {
    michaelsBrowser.topbar.clickLogout();
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... and unselects the answer", () => {
    owensBrowser.topic.unselectPostNrAsAnswer(3);
  });

  it("... and closes the topic", () => {
    owensBrowser.topic.closeTopic();   // generates an event post, nr 4 = closeEventPostNr
  });

  it("Maria wants to select Otter as the accepted answer again, but now she cannot", () => {
    mariasBrowser.topic.refreshUntilPostNrAppears(closeEventPostNr, { isMetaPost: true });
    mariasBrowser.topic.waitForPostNrVisible(c.FirstReplyNr);
    assert(!mariasBrowser.topic.canSelectAnswer());  // (2PR5PH)
  });

  it("... instead she replies", () => {
    mariasBrowser.complex.replyToPostNr(3, "Thanks! Such a good idea");  // becomes post nr 5
  });

  it("... and post a progress reply", () => {
    mariasBrowser.complex.addProgressReply("Thanks everyone! An otter then, a bath tube, and fish.")
  });

  it("Owen reopens the topic", () => {
    owensBrowser.topic.reopenTopic();   // generates an event post, nr 7 = reopenEventPostNr
  });

  it("Now Maria can select Otter", () => {
    mariasBrowser.refresh();
    mariasBrowser.topic.selectPostNrAsAnswer(3);
  });

  it("... Currently needs to refres for all posts to appear", () => {
    mariasBrowser.topic.refreshUntilPostNrAppears(7, { isMetaPost: true });
  });

  it("Everything is in the correct order", () => {
    mariasBrowser.topic.waitForPostAssertTextMatches(1, "a cat or an otter?");
    mariasBrowser.topic.assertPostTextMatches(2, "Yes, a cat");
    mariasBrowser.topic.assertPostTextMatches(3, "Yes, an otter");
    assert.equal(closeEventPostNr, 4);
    mariasBrowser.topic.assertMetaPostTextMatches(4, "closed");
    mariasBrowser.topic.assertPostTextMatches(5, "good idea");
    mariasBrowser.topic.assertPostTextMatches(6, "Thanks everyone!");
    assert.equal(reopenEventPostNr, 7);
    mariasBrowser.topic.assertMetaPostTextMatches(7, "reopened");

    mariasBrowser.topic.assertPostOrderIs([  //  CROK  CODE REVIEW DONE OK
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

