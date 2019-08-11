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

const waitForInviteEmail = server.waitAndGetInviteLinkEmailedTo;

let forum: EmptyTestForum;

let everyonesBrowsers;
let staffsBrowser;
let othersBrowser;
let owen: Member;
let owensBrowser;
let janesBrowser;

let siteId;
let siteIdAddress: IdAddress;
let forumTitle = "Some E2E Test";

const GroupStudentsFullName = 'GroupStudentsFullName';
const GroupStudentsUsername = 'students_un';

const GroupTeachersFullName = 'GroupTeachersFullName';
const GroupTeachersUsername = 'teachers_un';


const studentOneAddr = 'e2e-test--student-one@x.co';
const studentOneUsername = 'e2e_test_student_one';  // 20 chars, = max

const studentTwoAddr = 'e2e-test--stud-two@x.co';
const studentTwoUsername = 'e2e_test_stud_two';


const teacherOneAddr = 'e2e-test--teacher-one@x.co';
const teacherOneUsername = 'e2e_test_teacher_one';

const teacherTwoAddr = 'e2e-test--teacher-two@x.co';
const teacherTwoUsername = 'e2e_test_teacher_two';


describe("invite-to-groups  TyT7WKTJ40ZT22", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: forumTitle,
      members: []
    });
    assert(builder.getSite() === forum.siteData);
    siteIdAddress = server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
  });

  it("initialize people", () => {
    everyonesBrowsers = _.assign(browser, pagesFor(browser));
    staffsBrowser = _.assign(browserA, pagesFor(browserA));
    othersBrowser = _.assign(browserB, pagesFor(browserB));
    owen = forum.members.owen;
    owensBrowser = staffsBrowser;
    janesBrowser = othersBrowser;
  });

  it("Owen goes to the groups page", () => {
    owensBrowser.groupListPage.goHere(siteIdAddress.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... creates a Students group", () => {
    owensBrowser.groupListPage.createGroup(
        { username: GroupStudentsUsername, fullName: GroupStudentsFullName });
  });

  it("... and a Teachers group", () => {
    owensBrowser.waitAndClick('.esTopbar_custom_title a');
    owensBrowser.groupListPage.createGroup(
        { username: GroupTeachersUsername, fullName: GroupTeachersFullName });
  });

  it("Owen goes to the Invites tab", () => {
    owensBrowser.adminArea.goToUsersInvited(siteIdAddress.origin);
  });

  it("He sends invites to addr1 and addr2 to join the students group [TyT2BR057]", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeAndSubmitInvite(`
        addToGroups: @${GroupStudentsUsername}
        ${studentOneAddr}
        ${studentTwoAddr}
        `,
        { numWillBeSent: 2 });
  });

  let inviteLinkStudentOne;
  let inviteLinkStudentTwo;


  it("An email is sent to sudent one", () => {
    inviteLinkStudentOne = waitForInviteEmail(siteId, studentOneAddr, browserA);
    assert(inviteLinkStudentOne);
  });

  it("An email is sent to addr2-retry", () => {
    inviteLinkStudentTwo = waitForInviteEmail(siteId, studentTwoAddr, browserA);
    assert(inviteLinkStudentTwo);
  });

  it("Student one accepts", () => {
    othersBrowser.go(inviteLinkStudentOne);
    othersBrowser.topbar.waitForMyMenuVisible();
    othersBrowser.topbar.assertMyUsernameMatches(studentOneUsername);
  });

  it("... and hen became a member of the Students group", () => {
    othersBrowser.topbar.navigateToGroups();
    // TESTS_MISSING: should be Students group
    othersBrowser.waitForVisible('.e_YoureMbr');
    assert.equal(othersBrowser.count('.s_Gs-Custom .e_YoureMbr'), 1);
    assert.equal(othersBrowser.count('.e_YoureMbr'), 3); // Everyone, New members, and Students
  });

  it("... now that group has one member", () => {
    // TESTS_MISSING
  });

  it("... whilst the teachers group is empty", () => {
    // TESTS_MISSING
  });


  // ----- Already joined

  it("Owen invites student two again, to the Students group", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeInvite(`
      addToGroups: @${GroupStudentsUsername}
      ${studentTwoAddr}
      `);
    owensBrowser.inviteDialog.clickSubmit();
  });

  it("... results in an already-invited info dialog, and invite-again? question", () => {
    owensBrowser.inviteDialog.waitForCorrectNumSent(0);
    owensBrowser.inviteDialog.assertAlreadyInvited(studentTwoAddr);
  });

  it("... he resends the invite, to student 2, to join the Students group", () => {
    owensBrowser.inviteDialog.closeResultsDialog();
    assert(owensBrowser.inviteDialog.isInviteAgainVisible());
    owensBrowser.inviteDialog.clickSubmit();
    owensBrowser.inviteDialog.closeResultsDialog();
  });

  let studentTwoInviteLinkTwo;

  it("... so student two got a new invite email", () => {
    studentTwoInviteLinkTwo = waitForInviteEmail(siteId, studentTwoAddr, browserA);
    assert(studentTwoInviteLinkTwo);
    assert(studentTwoInviteLinkTwo !== inviteLinkStudentTwo)
  });


  it("Now student two accepts the most recent invite", () => {
    othersBrowser.topbar.clickLogout();
    othersBrowser.go(studentTwoInviteLinkTwo);
    othersBrowser.topbar.waitForMyMenuVisible();
    othersBrowser.topbar.assertMyUsernameMatches(studentTwoUsername);
  });

  it("... and student two became a member of the Students group", () => {
    othersBrowser.topbar.navigateToGroups();
    // TESTS_MISSING: should be Students group
    othersBrowser.waitForVisible('.e_YoureMbr');
    assert.equal(othersBrowser.count('.s_Gs-Custom .e_YoureMbr'), 1);
    assert.equal(othersBrowser.count('.e_YoureMbr'), 3); // Everyone, New members, and Students
  });

  it("... now that group has two members", () => {
    // TESTS_MISSING
  });

  /* TESTS_MISSING  include invite-to-group in the invites list ?
  it("Owens refreshes, invites will be sorted by time", () => {
    owensBrowser.refresh();
  });

  ... See invites-many-retry.2browsers.test.ts  [TyT402AKTS406] for code to
  copy-paste-edit.

  */


  it("Owen goes to the Invites tab", () => {
    owensBrowser.adminArea.goToUsersInvited(siteIdAddress.origin);
  });

  it("He tries to send invites to two teachers to join the Teachers group " +
        "— but types a typo in 'addToGroups'", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeInvite(`
        addToGroups_typo: @${GroupTeachersUsername}_typo
        ${teacherOneAddr}
        ${teacherTwoAddr}
        `);
    owensBrowser.inviteDialog.clickSubmit();
  });

  it("... there's an error, Owen closes the error dialog", () => {
    //owensBrowser.serverErrorDialog. ??? waitForTooManyInvitesError();
    owensBrowser.serverErrorDialog.close();
  });

  it("He tries again — but types a typo in the Teachers group name", () => {
    owensBrowser.inviteDialog.typeInvite(`
        addToGroups: @${GroupTeachersUsername}_typo
        ${teacherOneAddr}
        ${teacherTwoAddr}
        `,
        { numWillBeSent: 2 });
    owensBrowser.inviteDialog.clickSubmit();
  });

  it("... there's an error, again, Owen closes the error dialog", () => {
    owensBrowser.serverErrorDialog.close();
  });

  it("He tries again — no typos this time", () => {
    owensBrowser.inviteDialog.typeAndSubmitInvite(`
        addToGroups: @${GroupTeachersUsername}
        ${teacherOneAddr}
        ${teacherTwoAddr}
        `,
        { numWillBeSent: 2 });
  });


  let inviteLinkTeacherOne;
  let inviteLinkTeacherTwo;

  it("An email is sent to teacher one", () => {
    inviteLinkTeacherOne = waitForInviteEmail(siteId, teacherOneAddr, browserA);
    assert(inviteLinkTeacherOne);
  });

  it("... and to teacher two", () => {
    inviteLinkTeacherTwo = waitForInviteEmail(siteId, teacherTwoAddr, browserA);
    assert(inviteLinkTeacherTwo);
  });

  it("Teacher two accepts", () => {
    othersBrowser.go(inviteLinkTeacherTwo);
    othersBrowser.topbar.waitForMyMenuVisible();
    othersBrowser.topbar.assertMyUsernameMatches(teacherTwoUsername);
  });

  it("... and hen became a member of the Teachers group", () => {
    othersBrowser.topbar.navigateToGroups();
    // TESTS_MISSING: got added to the Teachers group, not Students?
    othersBrowser.waitForVisible('.e_YoureMbr');
    assert.equal(othersBrowser.count('.s_Gs-Custom .e_YoureMbr'), 1);
    assert.equal(othersBrowser.count('.e_YoureMbr'), 3); // New members, and Teachers
  });

  it("Owen goes to the groups page", () => {
    owensBrowser.adminArea.navToGroups();
  });

  it("... the Students group has two members", () => {
    // TESTS_MISSING
  });

  it("... and the Teachers group has one member", () => {
    // TESTS_MISSING
  });

});

