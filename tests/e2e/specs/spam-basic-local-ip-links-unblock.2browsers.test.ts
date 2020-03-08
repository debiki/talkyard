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
let forumTitle = "Basic Spam Ip Link And Unblock Test Forum";


describe("spam test, no external services, ip links & unblock  TyT602RGL4X", () => {

  it("initialize people", () => {
    everyone = _.assign(browser, pagesFor(browser));
    owen = make.memberOwenOwner();
    owensBrowser = _.assign(browserA, pagesFor(browserA));
    maria = make.memberMaria();
    mariasBrowser = _.assign(browserB, pagesFor(browserB));
  });

  it("import a site", () => {
    let site: SiteData = make.forumOwnedByOwen('basicspam', { title: forumTitle });
    site.members.push(maria);
    idAddress = server.importSiteData(site);
  });

  it("Maria goes to the homepage and logs in", () => {
    mariasBrowser.go(idAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("She posts https://11.22.33.44 ip addr links — the server will think they're spam", () => {
    mariasBrowser.complex.createAndSaveTopic(
        { title: "My numbers, I like them", body: "You like numbers also, 1 2 3, and 4" });
    // (Incl one http: link too)
    mariasBrowser.complex.replyToOrigPost("http://11.22.33.44/ip-page-two");
    mariasBrowser.complex.replyToOrigPost("https://11.22.33.44/ip-page-three");
    mariasBrowser.complex.replyToOrigPost("https://11.22.33.44/ip-page-four");
  });

  it("Such ip addr links get classified as spam, and hidden", () => {
    mariasBrowser.topic.refreshUntilBodyHidden(c.FirstReplyNr + 0);
    mariasBrowser.topic.refreshUntilBodyHidden(c.FirstReplyNr + 1);
    mariasBrowser.topic.refreshUntilBodyHidden(c.FirstReplyNr + 2);
  });


  // ------ Three seems like spam posts, gets blocked

  it("Maria tries to post another reply", () => {
    mariasBrowser.complex.replyToOrigPost("I like ip addresses and numbers.");
  });

  it("... but gets blocked: max 3 pending maybe-spam posts allowed [TyT029ASL45]", () => {
    mariasBrowser.serverErrorDialog.waitForTooManyPendingMaybeSpamPostsError();
  });


  // ------ Marking supposed spam, as not-spam

  it("Owen logs in to the Review admin tab", () => {
    owensBrowser.adminArea.goToReview(idAddress.origin, { loginAs: owen });
  });

  it("He approves Maria's posts, which actually aren't spam", () => {
    owensBrowser.adminArea.review.approvePostForTaskIndex(1);
    owensBrowser.adminArea.review.approvePostForTaskIndex(2);
    owensBrowser.adminArea.review.approvePostForTaskIndex(3);
    owensBrowser.adminArea.review.playTimePastUndo();
  });

  it("Now Maria can post posts again", () => {
    mariasBrowser.refresh();
    const text = "I can be the ip addresses coordinator.";
    mariasBrowser.complex.replyToOrigPost(text);
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr + 3, text);
  });

});

