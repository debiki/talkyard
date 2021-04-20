/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');





let everyonesBrowsers: TyE2eTestBrowser;
let richBrowserA: TyE2eTestBrowser;
let richBrowserB: TyE2eTestBrowser;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;
let maria: Member;
let mariasBrowser: TyE2eTestBrowser;

let michael: Member;
let zelda: Member;
let strangersBrowser: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;

const GroupsFirstFullName = 'GroupsFirstFullName';
const GroupsFirstUsername = 'groups_1st_username';

const GroupsFirstNames = { username: GroupsFirstUsername, fullName: GroupsFirstFullName };


describe("many-users-mention-list-join-group  TyT0326SKDGW2", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Many Users Tests",
      members: undefined, // default = everyone
    });

    // Add 100 members: Minion Mia1, Mia2, Mia3 ... Mia100.
    // They'll have lowercase usernames:  minion_mia1, ...mia2,  ...mia3  and so on.
    builder.addMinions({ oneWordName: "Mia", howMany: 100, mixedCaseUsernameStartWithUpper: false });

    // These will have mixed case usernames:  Minion_Mina1, ...Mina2 etc.
    builder.addMinions({ oneWordName: "Mina", howMany: 150, mixedCaseUsernameStartWithUpper: true });

    // Add Minion Zelda.
    [zelda] = builder.addMinions({ oneWordName: "Zelda", howMany: 1,
        mixedCaseUsernameStartWithUpper: false });

    assert.ok(builder.getSite() === forum.siteData);
    assert.greaterThan(builder.getSite().members.length, 251);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
  });

  it("initialize people", () => {
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    richBrowserA = new TyE2eTestBrowser(browserA);
    richBrowserB = new TyE2eTestBrowser(browserB);

    owen = forum.members.owen;
    owensBrowser = richBrowserA;

    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    michael = forum.members.michael;

    strangersBrowser = richBrowserB;
  });

  it("Owen logs in to the groups page", () => {
    owensBrowser.groupListPage.goHere(siteIdAddress.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });



  // ----- Groups: Adding member, when many users to list  TyT602857SKR


  it("... creates a group to edit", () => {
    owensBrowser.groupListPage.createGroup(GroupsFirstNames);
  });

  it("... adds Maria, works fine, she's before all the minions, alphabetically", () => {
    owensBrowser.userProfilePage.groupMembers.addOneMember(maria.username);
  });

  it("Owen starts typing Michael", () => {
    owensBrowser.userProfilePage.groupMembers.openAddMemberDialog();
    owensBrowser.addUsersToPageDialog.focusNameInputField();
    owensBrowser.addUsersToPageDialog.startTypingNewName("Mi");
  });

  it("... sees Michael", () => {
    owensBrowser.waitUntilAnyTextMatches('.Select-option', michael.username);
  });

  it("... and many minions", () => {
    owensBrowser.waitUntilAnyTextMatches('.Select-option', "minion_mia22");
    owensBrowser.waitUntilAnyTextMatches('.Select-option', "minion_mia33");
  });

  it("... Michael is listed first", () => {
    owensBrowser.waitUntil(() =>
      owensBrowser.waitAndGetVisibleText(
          '.Select-option').indexOf(michael.username) >= 0, {
      message: `Michael before the minions?`
    })
  });

  it("... hits Enter to add Michael", () => {
    owensBrowser.addUsersToPageDialog.hitEnterToSelectUser();
  });

  it("Owen continuse typing: 'Minion Mia7'", () => {
    owensBrowser.addUsersToPageDialog.startTypingNewName("minion_mia7");
  });

  it("... Sees 11 minions", () => {
    owensBrowser.waitForAtMost(11, '.Select-option');
    owensBrowser.waitForAtLeast(11, '.Select-option');
    assert.eq(owensBrowser.count('.Select-option'), 11);
  });

  it("... adds 'Minion Mia77'", () => {
    owensBrowser.addUsersToPageDialog.appendChars("7");
    owensBrowser.addUsersToPageDialog.hitEnterToSelectUser();
  });

  it("... saves Michael and Minion_Mia77", () => {
    owensBrowser.addUsersToPageDialog.submit();
  });

  it("... adds 'Minion Mina134' — with first username letter in Uppercase", () => {
    owensBrowser.userProfilePage.groupMembers.openAddMemberDialog();
    owensBrowser.addUsersToPageDialog.addOneUser('Minion_Mina134');
    owensBrowser.addUsersToPageDialog.submit();
  });

  it("Owen adds Zelda — she's listed *after* all the minions", () => {
    owensBrowser.userProfilePage.groupMembers.addOneMember(zelda.username);
  });

  it("There are now 5 people in the group", () => {
    assert.eq(owensBrowser.userProfilePage.groupMembers.getNumMembers(), 5);
  });

  it("... namely Maria, Michael and the minions", () => {
    owensBrowser.userProfilePage.groupMembers.waitUntilMemberPresent(maria.username);
    owensBrowser.userProfilePage.groupMembers.waitUntilMemberPresent(michael.username);
    owensBrowser.userProfilePage.groupMembers.waitUntilMemberPresent('minion_mia77');
    owensBrowser.userProfilePage.groupMembers.waitUntilMemberPresent('Minion_Mina134');
    owensBrowser.userProfilePage.groupMembers.waitUntilMemberPresent(zelda.username);
  });



  // ----- Admin Area: Listing many users


  it("Owen goes to the admin area, the users list", () => {
    owensBrowser.adminArea.goToUsersEnabled();
  });

  it("Oh so many. Owen types ... Maria, Michael, Zelda? Where?", () => {
    // TESTS_MISSING  TyT60295KTDT
  });



  // ----- Discussions: Mentioning someone, finding via name prefix  TyT2602SKJJ356


  it("Maria logs in", () => {
    mariasBrowser.go2(siteIdAddress.origin + '/' + forum.topics.byMichaelCategoryA.slug);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("Maria starts typing Michael's name:  '@mi...'", () => {
    mariasBrowser.topic.clickReplyToOrigPost();
    mariasBrowser.editor.editText(`Hello @mi`);
  });

  it("... his name appears", () => {
    mariasBrowser.waitUntilAnyTextMatches('.rta__entity', michael.username);
  });

  it("... beore all the 'minon...'s", () => {
    mariasBrowser.assertNthTextMatches('.rta__entity', 1, michael.username);
  });

  it("... there're > 30 minions", () => {
    mariasBrowser.waitForAtLeast(30, '.rta__entity');
  });

  it("Maria clicks Enter to auto-complete Michael's name", () => {
    mariasBrowser.keys(['Enter']);
  });

  it("Maria continues typing Zelda", () => {
    mariasBrowser.editor.editText(` and @minion_z`, { append: true });
  });

  it("... her name appears", () => {
    mariasBrowser.waitUntilAnyTextMatches('.rta__entity', zelda.fullName);
  });

  it("... there's just that single name starting with Z", () => {
    mariasBrowser.waitForAtLeast(1, '.rta__entity');
    assert.eq(mariasBrowser.count('.rta__entity'), 1);
  });

  it("Maria clicks Enter to auto-complete Zelda's name", () => {
    mariasBrowser.keys(['Enter']);
  });

  it("Maria mentions one of the Uppercase username minions too: types Minion_Mina103", () => {
    mariasBrowser.editor.editText(` and @Minion_Mina103`, { append: true });
  });

  it("... there's only one such minion", () => {
    mariasBrowser.waitForAtMost(1, '.rta__entity');
    assert.eq(mariasBrowser.count('.rta__entity'), 1);
  });

  it("... hits Enter to select @Minion_Mina103", () => {
    mariasBrowser.keys(['Enter']);
  });

  it("Maria submits the message", () => {
    mariasBrowser.editor.save();
  });

  it("Michael gets notified", () => {
    server.waitUntilLastEmailMatches(
        siteIdAddress.id, michael.emailAddress,
        [michael.username, zelda.username, 'Minion_Mina103']);
  });

  it("... and Zelda", () => {
    server.waitUntilLastEmailMatches(
        siteIdAddress.id, zelda.emailAddress,
        [michael.username, zelda.username, 'Minion_Mina103']);
  });

  it("... and, last but not least — really not least — Minion_Mina103", () => {
    server.waitUntilLastEmailMatches(
        siteIdAddress.id, zelda.emailAddress,
        [michael.username, zelda.username, 'Minion_Mina103']);
  });


});

