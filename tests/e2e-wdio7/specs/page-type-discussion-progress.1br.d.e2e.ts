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

let everyonesBrowsers;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let michael;
let michaelsBrowser: TyE2eTestBrowser;
let owen;
let owensBrowser: TyE2eTestBrowser;

let idAddress: IdAddress;
let siteId: any;

const mariasOpReply = 'mariasOpReply';
const mariasOpReplyReply = 'mariasOpReplyReply';

const bottomCommentOneText = 'bottomCommentOneText';
const bottomCommentTwoText = 'bottomCommentTwoText';


describe("Page type discussion, and progress comments", () => {

  it("Initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
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
    mariasBrowser.topic.refreshUntilPostNrAppears(3, { isMetaPost: true }); // [2PKRRSZ0]
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

  it("Posts another progress reply", () => {
    mariasBrowser.complex.addProgressReply(bottomCommentTwoText);  // #post-9
  });

  it("The posts has the correct contents", () => {
    // currently needed, so event posts will appear [2PKRRSZ0]
    mariasBrowser.topic.refreshUntilPostNrAppears(8, { isMetaPost: true });
    // Also takes a while for the server to refresh its cache:
    mariasBrowser.topic.refreshUntilPostNrAppears(9);

    mariasBrowser.topic.waitForPostAssertTextMatches(9, bottomCommentTwoText);
    mariasBrowser.topic.assertMetaPostTextMatches(8, 'reopened');
  });

  it("Everything is in the correct order", () => {
    mariasBrowser.topic.assertPostOrderIs([  //  CROK  CODE REVIEW DONE OK
        c.TitleNr,
        c.BodyNr,
        6,   // the orig post reply gets placed first
        7,   // orig post reply reply
        2,   // closed
        3,   // reopened
        4,   // progress comment
        5,   // closed
        8,   // reopened
        9]); // progress comment
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

