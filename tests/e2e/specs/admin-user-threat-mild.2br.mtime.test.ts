/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');





let forum: LargeTestForum;

let everyonesBrowsers;
let othersBrowser: TyE2eTestBrowser;
let owen;
let owensBrowser: TyE2eTestBrowser;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let forumTitle = "Admin User Threat Mild";

let mariasPageUrl: string;

const mariasReplyMildThreat = 'mariasReplyMildThreat';
const mariasReplyMildEditedThreat = 'mariasReplyMildEditedThreat';
const mariasReplyNotThreatOrig = 'mariasReplyNotThreatOrig';
const mariasReplyNotThreatEdited = 'mariasReplyNotThreatEdited';

describe("admin-user-threat-mild [TyT2WKBG4Z]", () => {

  it("import a site", () => {
    forum = buildSite().addLargeForum({ title: forumTitle });
    siteIdAddress = server.importSiteData(forum.siteData);
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    owen = forum.members.owen;
    owensBrowser = new TyE2eTestBrowser(browserA);
    othersBrowser = new TyE2eTestBrowser(browserB);
    maria = forum.members.maria;
    mariasBrowser = othersBrowser;
    strangersBrowser = othersBrowser;
  });

  it("Owen logs in to admin area, views Maria's profile", () => {
    owensBrowser.adminArea.goToUsersEnabled(siteIdAddress.origin);
    owensBrowser.loginDialog.loginWithPassword(owen);
    owensBrowser.adminArea.users.waitForLoaded();
    owensBrowser.adminArea.users.goToUser(maria);
    owensBrowser.adminArea.user.assertEnabled();
    mariasPageUrl = owensBrowser.getUrl();
  });

  it("Maria logs in", () => {
    mariasBrowser.go(siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });


  it("Owen marks Maria as mild threat", () => {
    owensBrowser.adminArea.user.markAsMildThreat();
  });

  it("... she appears in the Watching list", () => {
    owensBrowser.adminArea.users.switchToWatching();
    owensBrowser.adminArea.users.assertUserListed(maria);
    owensBrowser.adminArea.users.asserExactlyNumUsers(1);
  });

  it("Maria can post a comment", () => {
    mariasBrowser.complex.replyToOrigPost(mariasReplyMildThreat);
  });

  it("... it appears in the review list", () => {
    owensBrowser.adminArea.goToReview();
    assert(owensBrowser.adminArea.review.isMoreStuffToReview());
  });

  it("Maria sees her reply, and strangers see it too", () => {
    mariasBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, mariasReplyMildThreat);
    mariasBrowser.topbar.clickLogout();
    strangersBrowser.refresh();
    strangersBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, mariasReplyMildThreat);
  });

  it("... and Michael (the topic author) directly gets a reply notification email", () => {
    server.waitUntilLastEmailMatches(
        siteIdAddress.id, forum.members.michael.emailAddress, mariasReplyMildThreat, browser);
  });

  it("... Owen approves the reply", () => {
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions();
    assert(!owensBrowser.adminArea.review.isMoreStuffToReview());
  });

  it("Maria edits her reply", () => {
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.complex.editPostNr(c.FirstReplyNr, mariasReplyMildEditedThreat);
  });

  it("... strangers can see the edits, before approved (because mild threat only)", () => {
    mariasBrowser.topbar.clickLogout();
    strangersBrowser.refresh();
    strangersBrowser.topic.waitUntilPostTextMatches(c.FirstReplyNr, mariasReplyMildEditedThreat);
  });

  it("... results in a review task", () => {
    owensBrowser.refresh();
    owensBrowser.adminArea.review.waitUntilLoaded();
    assert(owensBrowser.adminArea.review.countReviewTasksFor(
        forum.topics.byMichaelCategoryA.id, c.FirstReplyNr, { waiting: true }) === 1);
  });

  it("... Owen approves it", () => {
    owensBrowser.adminArea.review.approvePostForMostRecentTask();
    owensBrowser.adminArea.review.playTimePastUndo();
    owensBrowser.adminArea.review.waitForServerToCarryOutDecisions();
    assert(!owensBrowser.adminArea.review.isMoreStuffToReview());
  });

  it("Owen un-marks Maria: no longer a threat", () => {
    owensBrowser.go(mariasPageUrl);
    owensBrowser.adminArea.user.unlockThreatLevel();
  });

  it("... she disappears from the Watching list", () => {
    owensBrowser.adminArea.users.switchToWatching();
    owensBrowser.adminArea.users.assertUserListEmpty();
  });

  it("... Maria can post a comment", () => {
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
    mariasBrowser.complex.replyToOrigPost(mariasReplyNotThreatOrig);
  });

  it("... Michael as usual gets a reply notification email", () => {
    server.waitUntilLastEmailMatches(
        siteIdAddress.id, forum.members.michael.emailAddress, mariasReplyNotThreatOrig, browser);
    assert(server.countLastEmailsSentTo(
        siteIdAddress.id, forum.members.michael.emailAddress) === 2);
  });

  it("Maria can edit the comment", () => {
    mariasBrowser.complex.editPostNr(c.FirstReplyNr + 1, mariasReplyNotThreatEdited);
  });

  it("... and the post does not appear in the review list; Maria is no longer a threat", () => {
    owensBrowser.adminArea.goToReview();
    assert(!owensBrowser.adminArea.review.isMoreStuffToReview());
  });

});

