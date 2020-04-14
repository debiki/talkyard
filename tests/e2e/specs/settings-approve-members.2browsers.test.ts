/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');





let everyone;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let michael: Member;
let michaelsBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let siteIdAddress;
const forumTitle = "Approve Members Forum";


describe("settings-approve-members [TyT2HUWX8]", function() {

  it("initialize people", function() {
    everyone = new TyE2eTestBrowser(wdioBrowser);
    owen = make.memberOwenOwner();
    owensBrowser = new TyE2eTestBrowser(browserA);
    michael = make.memberMichael();
    michaelsBrowser = new TyE2eTestBrowser(browserB);
    maria = make.memberMaria();
    mariasBrowser = michaelsBrowser;
    strangersBrowser = michaelsBrowser;
  });

  it("import a site", function() {
    const site: SiteData = make.forumOwnedByOwen('approve-members', { title: forumTitle });
    site.members.push(michael);
    siteIdAddress = server.importSiteData(site);
  });

  it("A stranger sees the forum, when not logged in", function() {
    strangersBrowser.go(siteIdAddress.origin);
    strangersBrowser.assertPageTitleMatches(forumTitle);
  });

  it("Owen logs in to admin area", function() {
    owensBrowser.adminArea.goToLoginSettings(siteIdAddress.origin);
    owensBrowser.loginDialog.loginWithPassword(owen);
  });

  it("...and enables approve-users", function() {
    owensBrowser.adminArea.settings.login.setApproveUsers(true);
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("Now the stranger sees the login dialog only", function() {
    owensBrowser.refresh();
    owensBrowser.adminArea.waitAssertVisible();
    strangersBrowser.loginDialog.refreshUntilFullScreen();
  });

  it("Michael logs in", function() {
    michaelsBrowser.loginDialog.loginWithPassword(michael);
  });

  it("... sees Not yet approved page", function() {
    michaelsBrowser.assertPageHtmlSourceMatches_1('TyM0APPR_');
  });

  it("... he got logged out by the server", function() {
    michaelsBrowser.refresh();
    michaelsBrowser.loginDialog.refreshUntilFullScreen();
  });

  let  mariasEmailVerifLink;

  it("Maria signs up, doesn't immediately verify her email", function() {
    mariasBrowser.loginDialog.createPasswordAccount(maria);
    mariasEmailVerifLink = server.getLastVerifyEmailAddressLinkEmailedTo(
        siteIdAddress.id, maria.emailAddress, mariasBrowser);
  });

  it("Owen views users enabled, sees himself only", function() {
    owensBrowser.adminArea.goToUsersEnabled();
    owensBrowser.adminArea.users.waitForLoaded();
    owensBrowser.adminArea.users.assertUserListed(owen);
    owensBrowser.adminArea.users.asserExactlyNumUsers(1);
  });

  it("... and users waiting, sees Michael", function() {
    // Michael has verified his email addr. He's now waiting for Owen to approve him.
    owensBrowser.adminArea.users.switchToWaiting();
    owensBrowser.adminArea.users.assertUserListed(michael);
    owensBrowser.adminArea.users.asserExactlyNumUsers(1);
    owensBrowser.adminArea.users.assertEmailVerified_1_user(michael, true);
  });

  it("... and new users, sees Maria, Michael and himself, Maria's email not verified", function() {
    // Maria isn't waiting, instead, it's her turn to verify her email addr.
    owensBrowser.adminArea.users.switchToNew();
    owensBrowser.adminArea.users.assertUserListed(maria);
    owensBrowser.adminArea.users.assertUserListed(michael);
    owensBrowser.adminArea.users.assertUserListed(owen);
    owensBrowser.adminArea.users.asserExactlyNumUsers(3);
    owensBrowser.adminArea.users.assertEmailVerified_1_user(maria, false);
  });

  it("Maria verifies her email", function() {
    mariasBrowser.go(mariasEmailVerifLink);
  });

  it("... and Owen now sees it's been verified", function() {
    owensBrowser.refresh();
    owensBrowser.adminArea.users.assertUserListed(maria);
    owensBrowser.adminArea.users.asserExactlyNumUsers(3);  // maria, michael, owen
    owensBrowser.adminArea.users.assertEmailVerified_1_user(maria, true);
  });

  it("... Maria appears in the Waiting list", function() {
    owensBrowser.adminArea.users.switchToWaiting();
    owensBrowser.adminArea.users.assertUserListed(maria);
    owensBrowser.adminArea.users.assertUserListed(michael);
    owensBrowser.adminArea.users.asserExactlyNumUsers(2);
    owensBrowser.adminArea.users.assertEmailVerified_1_user(maria, true);
    owensBrowser.adminArea.users.assertEmailVerified_1_user(michael, true);
  });

  it("... but cannot yet access the site", function() {
    mariasBrowser.rememberCurrentUrl();
    mariasBrowser.waitAndClick('#e2eContinue');
    mariasBrowser.waitForNewUrl();
    mariasBrowser.assertPageHtmlSourceMatches_1('TyM0APPR_');
  });

  it("Owen approves Maria", function() {
    owensBrowser.adminArea.users.waiting.approveFirstListedUser();
  });

  it("... so Maria can access the site", function() {
    mariasBrowser.refresh(); // clears the waiting-for-approval message, so login dialog appears
    mariasBrowser.loginDialog.loginWithPassword(maria);
    mariasBrowser.assertPageTitleMatches(forumTitle);
  });

  it("Owen clicks Undo", function() {
    owensBrowser.adminArea.users.waiting.undoApproveOrReject();
  });

  it("... Maria can no longer access the site", function() {
    mariasBrowser.refresh();
    mariasBrowser.assertPageHtmlSourceMatches_1('TyM0APPR_');
  });

  it("Owen approves Maria, again", function() {
    owensBrowser.adminArea.users.waiting.approveFirstListedUser();
  });

  it("... so Maria can access the site, again", function() {
    mariasBrowser.refresh();
    mariasBrowser.loginDialog.loginWithPassword(maria);
    mariasBrowser.assertPageTitleMatches(forumTitle);
  });

  it("Maria no longer listed on the Waiting page", function() {
    owensBrowser.refresh();
    owensBrowser.adminArea.users.assertUserListed(michael);
    owensBrowser.adminArea.users.asserExactlyNumUsers(1);
    owensBrowser.adminArea.users.assertEmailVerified_1_user(michael, true);
  });

  it("Maria leaves", function() {
    mariasBrowser.topbar.clickLogout({ waitForLoginButton: false });
  });

  it("Owen rejects Michael", function() {
    owensBrowser.adminArea.users.waiting.rejectFirstListedUser(); // only Michael listed
  });

  it("... now waitnig list empty", function() {
    owensBrowser.refresh();
    owensBrowser.adminArea.users.assertUserListEmpty();
  });

  it("... and Michael sees a be-gone message", function() {
    michaelsBrowser.loginDialog.loginWithPassword(michael);
    michaelsBrowser.assertPageHtmlSourceMatches_1('TyM0APPR_-TyMNOACCESS_');
  });

  it("Owen disables approve-members", function() {
    owensBrowser.adminArea.goToLoginSettings();
    owensBrowser.adminArea.settings.login.setApproveUsers(false);
    owensBrowser.adminArea.settings.clickSaveAll();
  });

  it("... the Waiting tab disappears", function() {
    owensBrowser.adminArea.goToUsersEnabled();
    assert(!owensBrowser.adminArea.users.isWaitingTabVisible());
  });

  it("... now anyone can access the site", function() {
    strangersBrowser.refresh();
    strangersBrowser.assertPageTitleMatches(forumTitle);
  });

});

