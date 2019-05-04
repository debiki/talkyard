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

let everyone;
let owen;
let owensBrowser;
let maria;
let mariasBrowser;

let idAddress: IdAddress;
let forumTitle = "Basic Spam Test Forum";

let countersBefore;

describe("spam test, Akismet false positives = incorrectly detected as spam  TyT205MKRRK0", () => {

  if (!settings.include3rdPartyDependentTests) {
    console.log("Skipping this spec; no 3rd party credentials specified.");
    return;
  }

  it("initialize people", () => {
    everyone = _.assign(browser, pagesFor(browser));
    owen = make.memberOwenOwner();
    owensBrowser = _.assign(browserA, pagesFor(browserA));
    maria = make.memberMaria();
    mariasBrowser = _.assign(browserB, pagesFor(browserB));
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('spamfapo', { title: forumTitle });
    site.settings.numFirstPostsToReview = 9;
    site.settings.numFirstPostsToAllow = 9;
    site.members.push(maria);
    idAddress = server.importSiteData(site);
    countersBefore = server.getTestCounters();
  });

  it("Maria logs in", () => {
    mariasBrowser.go(idAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });


  // ----- Three comments gets detected as spam

  it("Posts a topic about v*agra", () => {
    mariasBrowser.complex.createAndSaveTopic(
        { title: "V*agra Topic Title", body: "V*agra topic body " + c.AlwaysSpamText });
  });

  it("... and two replies", () => {
    mariasBrowser.complex.replyToOrigPost("Reply one, " + c.AlwaysSpamText);
    mariasBrowser.complex.replyToOrigPost("Reply two, " + c.AlwaysSpamText);
    // Now 3 comments detected as spam, so Maria gets blocked. [TyT029ASL45]
  });

  it("All her posts get classified as spam, and hidden", () => {
    mariasBrowser.topic.refreshUntilBodyHidden(c.BodyNr);
    mariasBrowser.topic.refreshUntilBodyHidden(c.FirstReplyNr + 0);
    mariasBrowser.topic.refreshUntilBodyHidden(c.FirstReplyNr + 1);
  });


  // ----- Too many seems-like-spam comments, Maria gets blocked

  it("Maria wants to post a new topic", () => {
    mariasBrowser.topbar.clickHome();
    mariasBrowser.complex.createAndSaveTopic(
        { title: "This gets blocked", body: "Blocked topic text.", resultInError: true });
  });

  it("... but now she gets blocked: the server thinks she's a spammer", () => {
    mariasBrowser.serverErrorDialog.waitForTooManyPendingMaybeSpamPostsError();
  });


  // ------ Marking supposed spam, as not-spam

  it("Owen goes to the Review admin tab and logs in", () => {
    owensBrowser.adminArea.goToReview(idAddress.origin, { loginAs: owen });
  });

  it("He approves Maria's posts, which aren't spam — v*agra is on-topic in this forum", () => {
    owensBrowser.adminArea.review.approvePostForTaskIndex(1);
    owensBrowser.adminArea.review.approvePostForTaskIndex(2);
    owensBrowser.adminArea.review.approvePostForTaskIndex(3);
    owensBrowser.adminArea.review.playTimePastUndo();
  });

  it("Now Maria can post the new topic", () => {
    mariasBrowser.refresh();
    mariasBrowser.complex.createAndSaveTopic(
        { title: "Not blocked topic", body: "Not blocked text." });
  });

  it("... and a reply too", () => {
    const text = "Not blocked reply";
    mariasBrowser.complex.replyToOrigPost(text);
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, text);
  });


  // ------ Report misclassifications

  it("The server reports the false positives to Akismet", () => {
    let countersNow = server.getTestCounters();
    logAndDie.logMessage(
        `numReportedSpamFalsePositives before: ${countersBefore.numReportedSpamFalsePositives}, ` +
        `after: ${countersNow.numReportedSpamFalsePositives}`);
    while (true) {
      if (countersNow.numReportedSpamFalsePositives - countersBefore.numReportedSpamFalsePositives >= 3)
        break;
      process.stdout.write(' ' + countersNow.numReportedSpamFalsePositives + ' ');
      owensBrowser.pause(200);
      countersNow = server.getTestCounters();
    }
  });


});

