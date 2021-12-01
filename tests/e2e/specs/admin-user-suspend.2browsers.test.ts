/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');





let forum: LargeTestForum;

let everyonesBrowsers;
let othersBrowser: TyE2eTestBrowser;
let owen;
let owensBrowser: TyE2eTestBrowser;
let maria;
let mariasBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let forumTitle = "Admin User Suspend";

let mariasPageUrl: string;

const mariasTopicTitle = 'mariasTopicTitle';
const mariasTopicBody = 'mariasTopicBody';

describe("admin-user-suspend [TyT5GKQSG2]", function() {

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


  it("Owen logs in to admin area, views Maria's profile", function() {
    owensBrowser.adminArea.goToUsersEnabled(siteIdAddress.origin);
    owensBrowser.loginDialog.loginWithPassword(owen);
    owensBrowser.adminArea.users.waitForLoaded();
    owensBrowser.adminArea.users.goToUser(maria);
    owensBrowser.adminArea.user.assertEnabled();
    owensBrowser.adminArea.user.assertApprovedInfoAbsent();
    mariasPageUrl = owensBrowser.getUrl();
  });

  it("Maria logs in", function() {
    mariasBrowser.go(siteIdAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... and starts creating a topic", function() {
    mariasBrowser.forumButtons.clickCreateTopic();
    mariasBrowser.editor.editTitle(mariasTopicTitle);
    mariasBrowser.editor.editText(mariasTopicBody);
  });

  it("... a draft gets saved", function() {
    // Wait for this, or the server error dialog pops up at the wrong time, breaking this test.
    mariasBrowser.editor.waitForDraftSaved();
  });


  it("Owen suspends Maria", function() {
    owensBrowser.adminArea.user.suspendUser();
  });

  it("... she appears in the Suspended list", function() {
    owensBrowser.adminArea.users.switchToSuspended();
    owensBrowser.adminArea.users.assertUserListed(maria);
    owensBrowser.adminArea.users.asserExactlyNumUsers(1);
  });

  it("... Maria now cannot create a topic", function() {
    mariasBrowser.editor.save();
    mariasBrowser.waitUntilLoadingOverlayGone();
  });

  it("... there's a server error about suspended or not-logged-in", function() {
    mariasBrowser.serverErrorDialog.waitForJustGotSuspendedError();
    mariasBrowser.serverErrorDialog.dismissReloadPageAlert();
  });

  it("... she dismisses it", function() {
    mariasBrowser.serverErrorDialog.close();
  });

  it("... and cancels the editor", function() {
    mariasBrowser.editor.cancel();
  });

  // TESTS_MISSING: should not get any more live updates via WebSocket  TyTE0MOREWSMSG
  // Or is that better done in a separate e2e test file?

  it("... Now, she cannot login (was logged out by the server)", function() {
    mariasBrowser.refresh();
    mariasBrowser.acceptAnyAlert(2);  // for some reason, up to 2 alerts
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria, { resultInError: true });
    mariasBrowser.loginDialog.waitForAccountSuspendedError();
  });

  it("Owen unsuspends Maria", function() {
    owensBrowser.go(mariasPageUrl);
    owensBrowser.adminArea.user.unsuspendUser();
  });

  it("... she is no longer in the Suspended list", function() {
    owensBrowser.adminArea.users.switchToSuspended();
    owensBrowser.adminArea.users.assertUserListEmpty();
  });

  it("... Maria can login again", function() {
    mariasBrowser.refresh();
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... and can post comments", function() {
    mariasBrowser.complex.createAndSaveTopic({ title: mariasTopicTitle, body: mariasTopicBody });
  });

});

