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





let everyonesBrowsers;
let richBrowserA;
let richBrowserB;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let parinia = { username: 'parinia', emailAddress: 'e2e-test-parinia@x.co',
                  fullName: 'Parinia Safiti', password: 'publ-pa020' };
let pariniasBrowser: TyE2eTestBrowser;
let strangersBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: EmptyTestForum;

const GroupFullName = 'GroupFullName';
const GroupUsername = 'GroupUsername';

const pariniasTopic = { title: 'PariniasTopicTitle', body: 'PariniasTopicBody' };
let discussionPageUrl: string;


describe("user-self-delete-upd-groups  TyT6DMSNW3560", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "Some E2E Test",
      members: ['owen', 'maria', 'michael']
    });
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;
    strangersBrowser = richBrowserA;

    pariniasBrowser = richBrowserB;
  });

  it("Parinia creates an account", () => {
    pariniasBrowser.go(siteIdAddress.origin);
    pariniasBrowser.complex.signUpAsMemberViaTopbar(parinia);
  });

  it("... verifies her email", () => {
    var link = server.getLastVerifyEmailAddressLinkEmailedTo(
        siteId, parinia.emailAddress, pariniasBrowser);
    pariniasBrowser.go(link);
    pariniasBrowser.waitAndClick('#e2eContinue');
    pariniasBrowser.disableRateLimits();
  });

  it("Owen logs in to the groups page", () => {
    owensBrowser.groupListPage.goHere(siteIdAddress.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... creates a group", () => {
    owensBrowser.groupListPage.createGroup({ username: GroupUsername, fullName: GroupFullName });
  });

  it("... adds Maria and Parinia", () => {
    owensBrowser.userProfilePage.groupMembers.addOneMember(forum.members.maria.username);
    owensBrowser.userProfilePage.groupMembers.addOneMember(parinia.username);
  });

  it("... so there're two members", () => {
    assert.equal(owensBrowser.userProfilePage.groupMembers.getNumMembers(), 2);
  });

  it("... Parinia and Maria", () => {
    owensBrowser.userProfilePage.groupMembers.waitUntilMemberPresent(parinia.username);
    owensBrowser.userProfilePage.groupMembers.waitUntilMemberPresent(forum.members.maria.username);
  });

  it("... there're more members in the All Members group", () => {
    owensBrowser.userProfilePage.groupMembers.goHere(c.AllMembersUsername);
    assert.equal(owensBrowser.userProfilePage.groupMembers.getNumMembers(), 4);
  });

  it("... namely Parinia", () => {
    owensBrowser.userProfilePage.groupMembers.waitUntilMemberPresent(parinia.username);
  });

  it("... and Maria, Owen and Michael", () => {
    owensBrowser.userProfilePage.groupMembers.waitUntilMemberPresent(forum.members.maria.username);
    owensBrowser.userProfilePage.groupMembers.waitUntilMemberPresent(forum.members.owen.username);
    owensBrowser.userProfilePage.groupMembers.waitUntilMemberPresent(forum.members.michael.username);
  });

  it("Owen leaves", () => {
    owensBrowser.topbar.clickLogout();
  });

  it("Parinia posts a topic", () => {
    pariniasBrowser.complex.createAndSaveTopic(pariniasTopic);
    discussionPageUrl = pariniasBrowser.getUrl();
  });

  it("A stranger can see Parinia's name, as the topic author", () => {
    strangersBrowser.go(discussionPageUrl);
    strangersBrowser.topic.waitForLoaded();
    assert.equal(strangersBrowser.topic.getTopicAuthorUsernameInclAt(), '@' + parinia.username);
  });

  it("Parinia realizes they're out there to get her. She goes to her user profile page", () => {
    pariniasBrowser.topbar.clickGoToProfile();
  });

  it("... to the Preferencet | Account tab ", () => {
    pariniasBrowser.userProfilePage.goToPreferences();
    pariniasBrowser.userProfilePage.preferences.switchToEmailsLogins();
  });

  it("Parinia deletes her account", () => {
    pariniasBrowser.userProfilePage.preferences.emailsLogins.deleteAccount();
  });

  it("... gets logged out", () => {
    pariniasBrowser.topbar.waitUntilLoginButtonVisible();
  });

  it("... the username changed to anonNNNN", () => {
    const username = pariniasBrowser.userProfilePage.waitAndGetUsername();
    assert.equal(username.substr(0, 'anon'.length), 'anon');
  });

  it("... the account says it's deleted or deactivated", () => {
    pariniasBrowser.userProfilePage.waitUntilDeletedOrDeactivated();
  });

  it("The stranger, who is in fact a secret agent, reloads the page (a mistake!)", () => {
    strangersBrowser.refresh();
    strangersBrowser.topic.waitForLoaded();
  });

  it("... Parinia's username is gone — it changed to anonNNNN", () => {
    const username = strangersBrowser.topic.getTopicAuthorUsernameInclAt();
    assert.equal(username.substr(0, '@anon'.length), '@anon');
  });

  it("The secret agent desperately clicks anonNNNN, goes to the account page", () => {
    strangersBrowser.complex.openPageAuthorProfilePage();
  });

  it("... the user profile page username is  anonNNNNN", () => {
    const username = strangersBrowser.userProfilePage.waitAndGetUsername();
    assert.equal(username.substr(0, 'anon'.length), 'anon');
  });

  it("... and deleted or deactivated", () => {
    strangersBrowser.userProfilePage.waitUntilDeletedOrDeactivated();
  });

  it("Owen returns to the group members page", () => {
    owensBrowser.userProfilePage.groupMembers.goHere(GroupUsername);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... now there's only one member — Parinia is gone", () => {
    assert.equal(owensBrowser.userProfilePage.groupMembers.getNumMembers(), 1);
  });

  it("... Maria is there", () => {
    owensBrowser.userProfilePage.groupMembers.waitUntilMemberPresent(forum.members.maria.username);
  });

  it("... and in the All Members group, there're now 3 members instead of 4", () => {
    owensBrowser.userProfilePage.groupMembers.goHere(c.AllMembersUsername);
    assert.equal(owensBrowser.userProfilePage.groupMembers.getNumMembers(), 3);
  });

  it("... they are Maria, Owen and Michael", () => {
    owensBrowser.userProfilePage.groupMembers.waitUntilMemberPresent(forum.members.maria.username);
    owensBrowser.userProfilePage.groupMembers.waitUntilMemberPresent(forum.members.owen.username);
    owensBrowser.userProfilePage.groupMembers.waitUntilMemberPresent(forum.members.michael.username);
  });

});

