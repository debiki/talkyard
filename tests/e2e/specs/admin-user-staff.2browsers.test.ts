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
let michael;
let michaelsBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let forumTitle = "Admin User Staff Trust";

let michaelsPageUrl: string;

const michaelsEditedTextOne = 'michaelsEditedTextOne';
const michaelsEditedTextTwo = 'michaelsEditedTextTwo';

describe("admin-user-staff [TyT2GKFI594]", function() {

  it("import a site", () => {
    forum = buildSite().addLargeForum({ title: forumTitle, members: ['maria', 'michael'] });
    siteIdAddress = server.importSiteData(forum.siteData);
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);

    owen = forum.members.owen;
    owensBrowser = new TyE2eTestBrowser(browserA);

    othersBrowser = new TyE2eTestBrowser(browserB);

    maria = forum.members.maria;
    mariasBrowser = othersBrowser;
    michael = forum.members.michael;
    michaelsBrowser = othersBrowser;
    strangersBrowser = othersBrowser;
  });

  it("Owen logs in to admin area, views Michael's profile", function() {
    owensBrowser.adminArea.goToUsersEnabled(siteIdAddress.origin);
    owensBrowser.loginDialog.loginWithPassword(owen);
    owensBrowser.adminArea.users.waitForLoaded();
    owensBrowser.adminArea.users.goToUser(michael);
    owensBrowser.adminArea.user.assertEnabled();
    michaelsPageUrl = owensBrowser.getUrl();
  });

  it("Owen grants Moderator to Michael", function() {
    owensBrowser.adminArea.user.grantModerator();
  });

  it("... and now sees Michael in the Staff users list", function() {
    owensBrowser.adminArea.users.switchToStaff();
    owensBrowser.adminArea.users.assertUserListed(owen);
    owensBrowser.adminArea.users.assertUserListed(michael);
    owensBrowser.adminArea.users.asserExactlyNumUsers(2);
  });

  it("Michael logs in", function() {
    michaelsBrowser.go(siteIdAddress.origin + '/' + forum.topics.byMariaCategoryA.slug);
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
  });

  it("Michael can edit Maria's posts — he is moderator", function() {
    michaelsBrowser.topic.waitForPostNrVisible(c.BodyNr);
    assert(michaelsBrowser.topic.canEditOrigPost());
    michaelsBrowser.complex.editPageBody(michaelsEditedTextOne);
  });

  it("Owen revokes Moderator", function() {
    owensBrowser.go(michaelsPageUrl);
    owensBrowser.adminArea.user.revokeModerator();
  });

  it("... and Michael disappears from the Staff users list", function() {
    owensBrowser.adminArea.users.switchToStaff();
    owensBrowser.adminArea.users.assertUserListed(owen);
    owensBrowser.adminArea.users.asserExactlyNumUsers(1);
  });

  it("Michael can no longer edit Maria's posts", function() {
    michaelsBrowser.refresh();
    michaelsBrowser.topic.waitForPostNrVisible(c.BodyNr);
    assert(!michaelsBrowser.topic.canEditOrigPost());
  });

  it("Owen grants Admin", function() {
    owensBrowser.go(michaelsPageUrl);
    owensBrowser.adminArea.user.grantAdmin();
  });

  it("... and now sees Michael in the Staff users list, as admin", function() {
    owensBrowser.adminArea.users.switchToStaff();
    owensBrowser.adminArea.users.assertUserListed(owen);
    owensBrowser.adminArea.users.assertUserListed(michael);
    owensBrowser.adminArea.users.asserExactlyNumUsers(2);
  });

  it("Michael goes on editing Maria's posts", function() {
    michaelsBrowser.refresh();
    michaelsBrowser.topic.waitForPostNrVisible(c.BodyNr);
    assert(michaelsBrowser.topic.canEditOrigPost());
    michaelsBrowser.complex.editPageBody(michaelsEditedTextTwo);
  });

  it("Owen revokes Admin", function() {
    owensBrowser.go(michaelsPageUrl);
    owensBrowser.adminArea.user.revokeAdmin();
  });

  it("... and Michael disappears from the Staff users list, again", function() {
    owensBrowser.adminArea.users.switchToStaff();
    owensBrowser.adminArea.users.assertUserListed(owen);
    owensBrowser.adminArea.users.asserExactlyNumUsers(1);
  });

  it("Michael finally cannot edit others' posts any more", function() {
    michaelsBrowser.refresh();
    michaelsBrowser.topic.waitForPostNrVisible(c.BodyNr);
    assert(!michaelsBrowser.topic.canEditOrigPost());
  });

});

