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

let everyonesBrowsers;
let maria;
let mariasBrowser;
let michael;
let michaelsBrowser;
let owen;
let owensBrowser;

let idAddress: IdAddress;
let siteId: any;

const mariasOpReply = 'mariasOpReply';
const mariasOpReplyReply = 'mariasOpReplyReply';

const bottomCommentOneText = 'bottomCommentOneText';
const bottomCommentTwoText = 'bottomCommentTwoText';


describe("Page type discussion, and progress comments", () => {

  it("Initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    mariasBrowser = everyonesBrowsers;
    michaelsBrowser = everyonesBrowsers;
    owensBrowser = everyonesBrowsers;
    maria = make.memberMaria();
    michael = make.memberMichael();
    owen = make.memberOwenOwner();
  });

  it("Import a site", () => {
    const site: SiteData = make.forumOwnedByOwen('pgstbc', { title: "Emb Cmts Disc Id Test" });
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

  it("She posts a topic, type Discussion", () => {
    mariasBrowser.complex.createAndSaveTopic({
      type: c.TestPageRole.Discussion, title: "Marias Topic Title", body: "Marias Topic Text" });
  });

  it("Closes", () => {
    mariasBrowser.topic.closeTopic();
  });

  it("... then reopens", () => {
    mariasBrowser.topic.reopenTopic();
  });

  it("Two status change events appear (after page refresh)", () => {
    mariasBrowser.refresh(); // [2PKRRSZ0]
    assert.equal(c.FirstReplyNr, 2);
    mariasBrowser.topic.waitForPostNrVisible(2); // status post 1 (close)
    mariasBrowser.topic.waitForPostNrVisible(3); // status post 2 (reopen)
  });

  it("... with the correct text contents", () => {
    mariasBrowser.topic.assertMetaPostTextMatches(2, 'closed');
    mariasBrowser.topic.assertMetaPostTextMatches(3, 'reopened');
  });

  it("Maria posts a progress reply", () => {
    // c.FirstReplyNr + 2 = #post-4
    mariasBrowser.complex.addProgressReply(bottomCommentOneText);
  });

  it("Changes status to Closed", () => {
    // c.FirstReplyNr + 3 = #post-5
    mariasBrowser.topic.closeTopic();
  });

  it("Posts an Orig Post reply", () => {
    // c.FirstReplyNr + 4 = #post-6
    mariasBrowser.complex.replyToOrigPost(mariasOpReply);
  });

  it("... and a reply to the reply", () => {
    // c.FirstReplyNr + 5 = #post-7
    mariasBrowser.complex.replyToPostNr(6, mariasOpReplyReply);
  });

  it("Changes status to Open", () => {
    mariasBrowser.topic.reopenTopic();   // event #post-8
  });

  it("Posts another progress comment", () => {
    mariasBrowser.complex.addBottomComment(bottomCommentTwoText);  // #post-9
  });

  it("The posts has the correct contents", () => {
    mariasBrowser.refresh();  // currently needed, so event posts will appear [2PKRRSZ0]
    mariasBrowser.topic.waitForPostNrVisible(9);
    mariasBrowser.topic.assertPostTextMatches(9, bottomCommentTwoText);
    mariasBrowser.topic.assertMetaPostTextMatches(8, 'reopened');
  });

  it("Everything is in the correct order", () => {
    const postElems = mariasBrowser.elements('[id^="post-"]').value;
    for (let i = 0; i < postElems.length; ++i) {
      const elem = postElems[i];
      const id = mariasBrowser.elementIdAttribute(elem.ELEMENT, 'id').value;
      console.log('id: ' + id);
      assert.equal(2, c.BodyNr + 1);
      assert.equal(2, c.FirstReplyNr);
      switch (i) {
        case c.TitleNr: assert.equal(id, 'post-' + c.TitleNr);  break;
        case c.BodyNr:  assert.equal(id, 'post-' + c.BodyNr);  break;
        case 2:  assert.equal(id, 'post-6');  break; // the orig post reply gets placed first
        case 3:  assert.equal(id, 'post-7');  break; // orig post reply reply
        case 4:  assert.equal(id, 'post-2');  break; // closed
        case 5:  assert.equal(id, 'post-3');  break; // reopened
        case 6:  assert.equal(id, 'post-4');  break; // progress comment
        case 7:  assert.equal(id, 'post-5');  break; // closed
        case 8:  assert.equal(id, 'post-8');  break; // reopened
        case 9:  assert.equal(id, 'post-9');  break; // progress comment
      }
    }
  });

  it("Michael may not change page status, not his page", () => {
    assert(mariasBrowser.topic.canCloseOrReopen()); // tests the test code
     mariasBrowser.topbar.clickLogout();
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
    assert(!michaelsBrowser.topic.canCloseOrReopen());
  });

  it("Owen can, he's admin", () => {
    michaelsBrowser.topbar.clickLogout();
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
    assert(owensBrowser.topic.canCloseOrReopen());
    owensBrowser.topic.closeTopic();
  });

});

