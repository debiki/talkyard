/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare let browser: any;
declare let browserA: any;
declare let browserB: any;

let owen;
let owensBrowser;
let mallory;
let mallorysBrowser;

let idAddress: IdAddress;
let forumTitle = "Basic Spam Test Forum";

const topicOneNotSpamTitle = 'topicOneNotSpamTitle'
const topicOneNotSpamBody = 'topicOneNotSpamBody'
const replyOneFine = 'replyOneFine';
const replyTwoMalware = 'replyTwoMalware ' + c.SafeBrowsingMalwareLink;
const replyThreeMalware = 'replyThreeMalware ' + c.SafeBrowsingMalwareLink;
const replyFourMalware = 'replyFourMalware ' + c.SafeBrowsingMalwareLink;


describe("spam test, Google Safe Browsing API  TyTSPSAFEBRAPI", () => {

  if (!settings.include3rdPartyDependentTests) {
    console.log("Skipping this spec; no 3rd party credentials specified.");
    return;
  }

  it("initialize people", () => {
    owen = make.memberOwenOwner();
    owensBrowser = _.assign(browserA, pagesFor(browserA));
    mallory = make.memberMallory();
    mallorysBrowser = _.assign(browserB, pagesFor(browserB));
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('safebrapi', { title: forumTitle });
    site.settings.numFirstPostsToReview = 9;
    site.settings.numFirstPostsToAllow = 9;
    site.members.push(mallory);
    idAddress = server.importSiteData(site);
  });

  it("Mallory arrives, with wild wide eyes, whispers 'shhh, quiet' to his cat", () => {
    mallorysBrowser.go(idAddress.origin);
  });

  it("... he logs in", () => {
    mallorysBrowser.complex.loginWithPasswordViaTopbar(mallory);
  });

  it("... submits a topic, no bad links", () => {
    mallorysBrowser.complex.createAndSaveTopic(
        { title: topicOneNotSpamTitle, body: topicOneNotSpamBody });
  });

  it("Mallory posts one ok reply, and three replies with Malware links", () => {
    mallorysBrowser.complex.replyToOrigPost(replyOneFine);
    mallorysBrowser.complex.replyToOrigPost(replyTwoMalware);
    mallorysBrowser.complex.replyToOrigPost(replyThreeMalware);
    mallorysBrowser.complex.replyToOrigPost(replyFourMalware);
  });

  it("... which are all be visible, initially", () => {
    mallorysBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 3); // reply nr 4
    assert(!mallorysBrowser.topic.isPostBodyHidden(c.FirstReplyNr));
    assert(!mallorysBrowser.topic.isPostBodyHidden(c.FirstReplyNr + 1));
    assert(!mallorysBrowser.topic.isPostBodyHidden(c.FirstReplyNr + 2));
    assert(!mallorysBrowser.topic.isPostBodyHidden(c.FirstReplyNr + 3));
  });

  it("The last reply gets hidden, eventually — Safe Browsing API noticed the malware link", () => {
    mallorysBrowser.topic.refreshUntilBodyHidden(c.FirstReplyNr + 3);
  });

  it("... No post disappeared", () => {
    mallorysBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 0);
    mallorysBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 1);
    mallorysBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 2);
    mallorysBrowser.topic.waitForPostNrVisible(c.FirstReplyNr + 3);
  });

  it("... The other two replies got hidden, too", () => {
    assert(mallorysBrowser.topic.isPostBodyHidden(c.FirstReplyNr + 1));
    assert(mallorysBrowser.topic.isPostBodyHidden(c.FirstReplyNr + 2));
    assert(mallorysBrowser.topic.isPostBodyHidden(c.FirstReplyNr + 3));
  });

  it("... But not the non-spam reply", () => {
    assert(!mallorysBrowser.topic.isPostBodyHidden(c.FirstReplyNr + 0));
  });


  // ----- Too much malware, Mallory gets blocked

  it("Mallory tries to post another reply", () => {
    mallorysBrowser.complex.replyToOrigPost("This reply gets blocked.");
  });

  it("... but gets blocked: max 3 pending maybe-spam posts allowed [TyT029ASL45]", () => {
    mallorysBrowser.serverErrorDialog.waitForTooManyPendingMaybeSpamPostsError();
  });


  // ------ Reviewing spam (malware)

  it("Owen goes to the Review admin tab and logs in", () => {
    owensBrowser.adminArea.goToReview(idAddress.origin, { loginAs: owen });
  });

  it("He reject-deletes Mallory's three malware posts, and approves the 1st non-malware", () => {
    owensBrowser.adminArea.review.rejectDeleteTaskIndex(1);
    owensBrowser.adminArea.review.rejectDeleteTaskIndex(2);
    owensBrowser.adminArea.review.rejectDeleteTaskIndex(3);
    owensBrowser.adminArea.review.approvePostForTaskIndex(4);
    owensBrowser.adminArea.review.playTimePastUndo();
  });

  it("Mallory tries again ...", () => {
    mallorysBrowser.refresh(); // does away with dialogs
    mallorysBrowser.complex.replyToOrigPost("Gets blocked");
  });

  it("... but is still blocked. The cat falls asleep on the keyboard.", () => {
    mallorysBrowser.serverErrorDialog.waitForTooManyPendingMaybeSpamPostsError();
  });

});

