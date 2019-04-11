/// <reference path="../test-types.ts"/>
import * as _ from 'lodash';
import assert = require('assert');
import fs = require('fs');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pages = require('../utils/pages');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;
declare let browserA: any;
declare let browserB: any;

let everyonesBrowsers;
let maria;
let mariasBrowser;
let michael;
let michaelsBrowser;
let owen;
let owensBrowser;
let strangersBrowser;

let idAddress: IdAddress;
let siteId: any;

let mariasTopicUrl: string;



describe("Page type question", () => {

  it("Initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    mariasBrowser = _.assign(browserA, pagesFor(browserA));
    strangersBrowser = _.assign(browserB, pagesFor(browserB));
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
    mariasTopicUrl = mariasBrowser.url().value;
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
    michaelsBrowser.refresh();
    assert(!michaelsBrowser.topic.canSelectAnswer());  // (2PR5PH)
  });

  it("Maria selects one answer", () => {
    mariasBrowser.refresh();
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

  it("Owen logs in", () => {
    michaelsBrowser.topbar.clickLogout();
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... and unselects the answer", () => {
    owensBrowser.topic.unselectPostNrAsAnswer(3);
  });

  it("... and closes the topic", () => {
    owensBrowser.topic.closeTopic();   // generates an event post, nr 4
  });

  it("Maria wants to select Otter as the accepted answer again, but now she cannot", () => {
    mariasBrowser.refresh();
    assert(!mariasBrowser.topic.canSelectAnswer());  // (2PR5PH)
  });

  it("... instead she replies", () => {
    mariasBrowser.complex.replyToPostNr(3, "Thanks! Such a good idea");  // becomes post nr 5
  });

  it("... and post a progress reply", () => {
    mariasBrowser.complex.addProgressReply("Thanks everyone! An otter then, a bath tube, and fish.")
  });

  it("Owen reopens the topic", () => {
    owensBrowser.topic.reopenTopic();
  });

  it("Now Maria can select Otter", () => {
    mariasBrowser.refresh();
    mariasBrowser.topic.selectPostNrAsAnswer(3);
  });

  it("Everything is in the correct order", () => {
    mariasBrowser.refresh();
    mariasBrowser.topic.assertPostTextMatches(1, "a cat or an otter?");
    mariasBrowser.topic.assertPostTextMatches(2, "Yes, a cat");
    mariasBrowser.topic.assertPostTextMatches(3, "Yes, an otter");
    mariasBrowser.topic.assertMetaPostTextMatches(4, "closed");
    mariasBrowser.topic.assertPostTextMatches(5, "good idea");
    mariasBrowser.topic.assertPostTextMatches(6, "Thanks everyone!");
    mariasBrowser.topic.assertMetaPostTextMatches(7, "reopened");

    const postElems = mariasBrowser.elements('[id^="post-"]').value;
    for (let i = 0; i < postElems.length; ++i) {
      const elem = postElems[i];
      const id = mariasBrowser.elementIdAttribute(elem.ELEMENT, 'id').value;
      console.log('id: ' + id);
      switch (i) {
        case c.TitleNr:  assert(id === 'post-' + c.TitleNr);  break;
        case c.BodyNr:  assert(id === 'post-' + c.BodyNr);  break;
        case 2:  assert(id === 'post-2');  break; // cat
        case 3:  assert(id === 'post-3');  break; // otter
        case 4:  assert(id === 'post-5');  break; // the "Good idea" reply
        case 5:  assert(id === 'post-4');  break; // the topic-closed event
        case 6:  assert(id === 'post-6');  break; // the "Thanks everyone" comment
        case 7:  assert(id === 'post-7');  break; // the topic-reopened event
      }
    }
  });

});

