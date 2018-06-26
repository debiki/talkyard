/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');

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
let forumTitle = "Admin User Suspend";

let mariasPageUrl: string;

const mariasTopicTitle = 'mariasTopicTitle';
const mariasTopicBody = 'mariasTopicBody';

describe("admin-user-suspend [TyT5GKQSG2]", function() {

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
    owensBrowser.adminArea.user.assertApprovedInfoAbsent();
    mariasPageUrl = owensBrowser.url().value;
  });

  it("Maria logs in", function() {
    mariasBrowser.go(siteIdAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
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
    mariasBrowser.complex.createAndSaveTopic({
        title: mariasTopicTitle, body: mariasTopicBody, resultInError: true });
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

  it("... Now, she cannot login (was logged out by the server)", function() {
    mariasBrowser.refresh();
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

