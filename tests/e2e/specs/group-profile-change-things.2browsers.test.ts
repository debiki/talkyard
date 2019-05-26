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

let everyonesBrowsers;
let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser;
let maria: Member;
let mariasBrowser;
let strangersBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;

let discussionPageUrl: string;

const DummyGroupUsername = "dummy_ignore_group";
const DummyGroupFullName = "Dummy Ignore Group";
const GroupsFirstFullName = 'GroupsFirstFullName';
const GroupsFirstUsername = 'groups_1st_username';
const GroupsSecondFullName = 'GroupsSecondFullName';
const GroupsSecondUsername = 'groups_2nd_username';

const DummyGroupNames = { username: DummyGroupUsername, fullName: DummyGroupFullName };
const GroupsFirstNames = { username: GroupsFirstUsername, fullName: GroupsFirstFullName };
const GroupsSecondNames = { username: GroupsSecondUsername, fullName: GroupsSecondFullName };


describe("group-profile-change-things  TyT5MS5TWV0", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Group Profile Change Things",
      members: undefined, // default = everyone
    });
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
  });

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    richBrowserA = _.assign(browserA, pagesFor(browserA));
    richBrowserB = _.assign(browserB, pagesFor(browserB));

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    maria = forum.members.maria;
    mariasBrowser = richBrowserB;

    strangersBrowser = richBrowserB;
  });

  it("Owen logs in to the groups page", () => {
    owensBrowser.groupListPage.goHere(siteIdAddress.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... creates a dummy won't-be-used group", () => {
    // Just so can verify the server won't edit the wrong custom group.
    owensBrowser.groupListPage.createGroup(
        { username: DummyGroupUsername, fullName: DummyGroupFullName });
  });

  it("... navigates back to the groups list page", () => {
    owensBrowser.userProfilePage.navigateBackToUsersOrGroupsList();
  });

  it("... creates a group to edit", () => {
    owensBrowser.groupListPage.createGroup(
        { username: GroupsFirstUsername, fullName: GroupsFirstFullName });
  });

  it("... adds Maria", () => {
    owensBrowser.userProfilePage.groupMembers.addOneMember(maria.username);
  });

  it("Maria logs in", () => {
    mariasBrowser.go(siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("... goes to the groups page, via her username menu", () => {
    mariasBrowser.topbar.navigateToGroups();
  });

  it("There're two custom groups", () => {
    assert.equal(mariasBrowser.groupListPage.countCustomGroups(), 2);
  });

  it("... with the correct names", () => {
    mariasBrowser.groupListPage.waitUntilGroupPresent(DummyGroupNames);
    mariasBrowser.groupListPage.waitUntilGroupPresent(GroupsFirstNames);
  });

  it("Owen goes to the group's prefs | about page", () => {
    owensBrowser.userProfilePage.goToPreferences();
  });

  it("... the group's name is in the about box", () => {
    owensBrowser.userProfilePage.waitUntilUsernameIs(GroupsFirstUsername);
  });

  it("He renames the group: changes the username", () => {
    owensBrowser.userProfilePage.preferences.startChangingUsername();
    owensBrowser.userProfilePage.preferences.setUsername(GroupsSecondUsername);
  });

  it("... and the full name", () => {
    owensBrowser.userProfilePage.preferences.setFullName(GroupsSecondFullName);
  });

  it("... saves", () => {
    owensBrowser.userProfilePage.preferences.save();
  });

  it("The group's new username is now in the about box", () => {
    owensBrowser.userProfilePage.waitUntilUsernameIs(GroupsSecondUsername);
  });

  it("Maria refreshes the page, and there're still two custom groups", () => {
    mariasBrowser.refresh();
    mariasBrowser.groupListPage.waitUntilLoaded();
    assert.equal(mariasBrowser.groupListPage.countCustomGroups(), 2);
  });

  it("... with the correct names", () => {
    mariasBrowser.groupListPage.waitUntilGroupPresent(DummyGroupNames);
    mariasBrowser.groupListPage.waitUntilGroupPresent(GroupsSecondNames);
  });

  // Later: edit title, verify member's title (dispalyed next to hens username,
  // at hens posts) gets refreshed.

});

