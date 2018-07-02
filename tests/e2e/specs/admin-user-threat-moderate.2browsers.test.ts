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
let forumTitle = "Admin User Threat Moderate";

let mariasPageUrl: string;

const mariasReplyOrig = 'mariasReplyOrig';
const mariasReplyEdited = 'mariasReplyEdited';
const mariasReplyNotThreat = 'mariasReplyNotThreat';

describe("admin-user-threat-moderate [TyT5KHFIQ20]", function() {

  it("import a site", () => {
    browser.perhapsDebugBefore();
    forum = buildSite().addLargeForum({ title: forumTitle });
    siteIdAddress = server.importSiteData(forum.siteData);
  });

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    othersBrowser = _.assign(browserB, pagesFor(browserB));

    owen = forum.members.owen;
    owensBrowser = _.assign(browserA, pagesFor(browserA));

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


  it("Owen marks Maria as moderate threat", function() {
    owensBrowser.adminArea.user.markAsModerateThreat();
  });

  it("... she appears in the Watching list", function() {
    owensBrowser.adminArea.users.switchToWatching();
    owensBrowser.adminArea.users.assertUserListed(maria);
    owensBrowser.adminArea.users.asserExactlyNumUsers(1);
  });

  it("Maria can post a comment", function() {
    mariasBrowser.complex.replyToOrigPost(mariasReplyOrig);
  });

  it("... she sees a notice that it's awaiting moderation", function() {
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, mariasReplyOrig);
    mariasBrowser.topic.assertPostNeedsApprovalBodyVisible(c.FirstReplyNr);
  });

  it("She can edit the comment (although awaiting moderation)", function() {
    mariasBrowser.complex.editPostNr(c.FirstReplyNr, mariasReplyEdited);
  });

  it("A stranger won't see it", function() {
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, mariasReplyEdited);
    mariasBrowser.topbar.clickLogout();
    strangersBrowser.refresh();
    strangersBrowser.topic.waitForPostNrVisible(c.BodyNr);
    strangersBrowser.topic.assertPostNeedsApprovalBodyHidden(c.FirstReplyNr);
  });

  it("The comment appears in Owen's review list", function() {
    owensBrowser.adminArea.goToReview();
    assert(owensBrowser.adminArea.review.isMoreStuffToReview());
  });

  it("Michael has *not* been notified about the reply — because not yet approved", function() {
    assert(server.countLastEmailsSentTo(
        siteIdAddress.id, forum.members.michael.emailAddress) === 0);
  });

  it("... Owen accepts it", function() {
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions();
    assert(!owensBrowser.adminArea.review.isMoreStuffToReview());
  });

  it("Now the stranger sees it", function() {
    strangersBrowser.topic.refreshUntilPostNotPendingApproval(c.FirstReplyNr);
    strangersBrowser.topic.assertPostTextMatches(c.FirstReplyNr, mariasReplyEdited);
  });

  it("Michael, the page author, gets a reply notification email", function() {
    server.waitUntilLastEmailMatches(
        siteIdAddress.id, forum.members.michael.emailAddress, mariasReplyEdited, browser);
    assert(server.countLastEmailsSentTo(
        siteIdAddress.id, forum.members.michael.emailAddress) === 1);
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

  it("... the stranger sees it directly", function() {
    mariasBrowser.topbar.clickLogout();
    strangersBrowser.refresh();
    strangersBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr + 1, mariasReplyNotThreat);
  });

  it("... and Michael directly gets a reply notification email", function() {
    server.waitUntilLastEmailMatches(
        siteIdAddress.id, forum.members.michael.emailAddress, mariasReplyNotThreat, browser);
    assert(server.countLastEmailsSentTo(
        siteIdAddress.id, forum.members.michael.emailAddress) === 2);
  });

});

