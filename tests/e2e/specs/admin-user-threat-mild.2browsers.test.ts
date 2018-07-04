/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;

let forum: LargeTestForum;

let everyonesBrowsers;
let othersBrowser;
let owen;
let owensBrowser;
let maria;
let mariasBrowser;
let strangersBrowser;

let siteIdAddress: IdAddress;
let forumTitle = "Admin User Threat Mild";

let mariasPageUrl: string;

const mariasReplyMildThreat = 'mariasReplyMildThreat';
const mariasReplyNotThreat = 'mariasReplyNotThreat';

describe("admin-user-threat-mild [TyT2WKBG4Z]", function() {

  it("import a site", () => {
    browser.perhapsDebugBefore();
    forum = buildSite().addLargeForum({ title: forumTitle });
    siteIdAddress = server.importSiteData(forum.siteData);
  });

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    owen = forum.members.owen;
    owensBrowser = _.assign(browserA, pagesFor(browserA));
    othersBrowser = _.assign(browserB, pagesFor(browserB));
    maria = forum.members.maria;
    mariasBrowser = othersBrowser;
    strangersBrowser = othersBrowser;
  });

  it("Owen logs in to admin area, views Maria's profile", function() {
    owensBrowser.adminArea.goToUsersEnabled(siteIdAddress.origin);
    owensBrowser.loginDialog.loginWithPassword(owen);
    owensBrowser.adminArea.users.waitForLoaded();
    owensBrowser.adminArea.users.goToUser(maria);
    owensBrowser.adminArea.user.assertEnabled();
    mariasPageUrl = owensBrowser.url().value;
  });

  it("Maria logs in", function() {
    mariasBrowser.go(siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });


  it("Owen marks Maria as mild threat", function() {
    owensBrowser.adminArea.user.markAsMildThreat();
  });

  it("... she appears in the Watching list", function() {
    owensBrowser.adminArea.users.switchToWatching();
    owensBrowser.adminArea.users.assertUserListed(maria);
    owensBrowser.adminArea.users.asserExactlyNumUsers(1);
  });

  it("Maria can post a comment", function() {
    mariasBrowser.complex.replyToOrigPost(mariasReplyMildThreat);
  });

  it("... it appears in the review list", function() {
    owensBrowser.adminArea.goToReview();
    assert(owensBrowser.adminArea.review.isMoreStuffToReview());
  });

  it("Maria sees her reply, and strangers see it too", function() {
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, mariasReplyMildThreat);
    mariasBrowser.topbar.clickLogout();
    strangersBrowser.refresh();
    strangersBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, mariasReplyMildThreat);
  });

  it("... and Michael (the topic author) directly gets a reply notification email", function() {
    server.waitUntilLastEmailMatches(
        siteIdAddress.id, forum.members.michael.emailAddress, mariasReplyMildThreat, browser);
  });

  it("... Owen approves the reply", function() {
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions();
    assert(!owensBrowser.adminArea.review.isMoreStuffToReview());
  });

  it("Owen un-marks Maria: no longer a threat", function() {
    owensBrowser.go(mariasPageUrl);
    owensBrowser.adminArea.user.unlockThreatLevel();
  });

  it("... she disappears from the Watching list", function() {
    owensBrowser.adminArea.users.switchToWatching();
    owensBrowser.adminArea.users.assertUserListEmpty();
  });

  it("... Maria can post a comment", function() {
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.complex.replyToOrigPost(mariasReplyNotThreat);
  });

  it("... it does not appear in the review list; Maria is no longer a threat", function() {
    owensBrowser.adminArea.goToReview();
    assert(!owensBrowser.adminArea.review.isMoreStuffToReview());
  });

  it("... and Michael as usual gets a reply notification email", function() {
    server.waitUntilLastEmailMatches(
        siteIdAddress.id, forum.members.michael.emailAddress, mariasReplyNotThreat, browser);
    assert(server.countLastEmailsSentTo(
        siteIdAddress.id, forum.members.michael.emailAddress) === 2);
  });

});

