/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as utils from '../utils/utils';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;

let owen: Member;
let owen_brA: TyE2eTestBrowser;
let parinia = { username: 'parinia', emailAddress: 'e2e-test-parinia@x.co',
                  fullName: 'Parinia Safiti', password: 'publ-pa020' };
let parinia_brA: TyE2eTestBrowser;
let parinia_brB: TyE2eTestBrowser;

let stranger_brA: TyE2eTestBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: EmptyTestForum;

const GroupFullName = 'GroupFullName';
const GroupUsername = 'GroupUsername';

const pariniasTopic = { title: 'PariniasTopicTitle', body: 'PariniasTopicBody' };
let discussionPageUrl: string;


describe("user-self-delete-upd-groups.2br.f.e2e.ts  TyT6DMSNW3560", () => {

  it("import a site", async () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "Some E2E Test",
      members: ['owen', 'maria', 'michael']
    });
    assert.eq(builder.getSite(), forum.siteData);
    siteIdAddress = await server.importSiteData(forum.siteData);
    siteId = siteIdAddress.id;
  });

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    stranger_brA = brA;

    parinia_brA = brA;
    parinia_brB = brB;
  });


  // ----- Create account

  it("Parinia creates an account", async () => {
    await parinia_brB.go2(siteIdAddress.origin);
    await parinia_brB.complex.signUpAsMemberViaTopbar(parinia);
  });

  it("... verifies her email", async () => {
    const link = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(
            siteId, parinia.emailAddress);
    await parinia_brB.go2(link);
    await parinia_brB.waitAndClick('#e2eContinue');
    await parinia_brB.disableRateLimits();
  });


  // ----- Create group: Maria & Parinia

  it("Owen logs in to the groups page", async () => {
    await owen_brA.groupListPage.goHere(siteIdAddress.origin);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... creates a group", async () => {
    await owen_brA.groupListPage.createGroup({
            username: GroupUsername, fullName: GroupFullName });
  });

  it("... adds Maria and Parinia", async () => {
    await owen_brA.userProfilePage.groupMembers.addOneMember(forum.members.maria.username);
    await owen_brA.userProfilePage.groupMembers.addOneMember(parinia.username);
  });

  it("... so there're two members", async () => {
    assert.eq(await owen_brA.userProfilePage.groupMembers.getNumMembers(), 2);
  });

  it("... Parinia and Maria", async () => {
    await owen_brA.userProfilePage.groupMembers.waitUntilMemberPresent(parinia.username);
    await owen_brA.userProfilePage.groupMembers.waitUntilMemberPresent(forum.members.maria.username);
  });

  it("... there're more members in the All Members group", async () => {
    await owen_brA.userProfilePage.groupMembers.goHere(c.AllMembersUsername);
    assert.eq(await owen_brA.userProfilePage.groupMembers.getNumMembers(), 4);
  });

  it("... namely Parinia", async () => {
    await owen_brA.userProfilePage.groupMembers.waitUntilMemberPresent(parinia.username);
  });

  it("... and Maria, Owen and Michael", async () => {
    const waitUntilMemberPresent = owen_brA.userProfilePage.groupMembers.waitUntilMemberPresent;
    await waitUntilMemberPresent(forum.members.maria.username);
    await waitUntilMemberPresent(forum.members.owen.username);
    await waitUntilMemberPresent(forum.members.michael.username);
  });

  it("Owen leaves", async () => {
    await owen_brA.topbar.clickLogout();
  });


  // ----- New topic

  it("Parinia posts a topic,  to see if anything feels suspicious", async () => {
    await parinia_brB.complex.createAndSaveTopic(pariniasTopic);
    discussionPageUrl = await parinia_brB.getUrl();
  });

  it(`A stranger can see Parinia's name, as the topic author.  (He wears a trench coat and a hat,
        types on a laptop hidden behind a newspaper he prentents to be reading)`, async () => {
    await stranger_brA.go2(discussionPageUrl);
    await stranger_brA.topic.waitForLoaded();
    assert.eq(await stranger_brA.topic.getTopicAuthorUsernameInclAt(), '@' + parinia.username);
  });


  // ----- Get a pwd reset link

  it(`Parinia realizes they're out there to get her.
          She goes to a small carpentry shed in her backard, to log in on a laptop hidden there
              — but she has forgotten the password.
          She clicks  Reset-password`, async () => {
    await parinia_brA.topbar.clickLogin();  // note: brA
    await parinia_brA.loginDialog.clickResetPasswordCloseDialogSwitchTab();
  });
  it(`... submits her email`, async () => {
    await parinia_brA.resetPasswordPage.submitAccountOwnerEmailAddress(parinia.emailAddress);
  });


  // ----- Log in

  it(`Then she sees her password. She's carved it into a corner in the wooden wall, long ago
            She logs in`, async () => {
    await parinia_brA.go2('/');  // note: brA
    await parinia_brA.complex.loginWithPasswordViaTopbar(parinia);
    await parinia_brA.topbar.assertMyUsernameMatches(parinia.username);
  });


  // ----- Delete account

  it(`Parina goes to her user profile page  — back in the main house  (because she
            had forgotten to turn off the oven, and thinks it's unwise to attract
            additional attention by burning down her house)`, async () => {
    await parinia_brB.topbar.clickGoToProfile();  // note: brB
  });

  it("... goes to the Preferencet | Account tab ", async () => {
    await parinia_brB.userProfilePage.goToPreferences();
    await parinia_brB.userProfilePage.preferences.switchToEmailsLogins();
  });

  it("Parinia deletes her account", async () => {
    await parinia_brB.userProfilePage.preferences.emailsLogins.deleteAccount();
  });

  it("... gets logged out", async () => {
    await parinia_brB.topbar.waitUntilLoginButtonVisible();
  });

  it("... the username changed to anonNNNN", async () => {
    const username = await parinia_brB.userProfilePage.waitAndGetUsername();
    assert.eq(username.substr(0, 'anon'.length), 'anon');
  });

  it("... the account says it's deleted or deactivated", async () => {
    await parinia_brB.userProfilePage.waitUntilDeletedOrDeactivated();
  });


  // ----- Logged out everywhere

  it("She's logged out from the laptop in the shed too", async () => {
    await parinia_brA.refresh2();  // note: brA,  the one in the carpentry shed
    await parinia_brA.topbar.waitUntilLoginButtonVisible();
  });


  // ----- Reset links won't work   TyT_DELACT_RSTPW

  let resetPwdPageLink: St;

  it("She finds a reset-password link in an email", async () => {
    const email = await server.getLastEmailSenTo(siteIdAddress.id, parinia.emailAddress);
    resetPwdPageLink = utils.findFirstLinkToUrlIn(
            siteIdAddress.origin + '/-/reset-password/choose-password/', email.bodyHtmlText);
  });

  it("... follows the link", async () => {
    await parinia_brA.rememberCurrentUrl();
    await parinia_brA.go2(resetPwdPageLink, { isExternalPage: true });
    await parinia_brA.waitForNewUrl();
  });

  it("... but it doesn't work — account deleted", async () => {
    const text = await parinia_brA.getPageSource();
    assert.includes(text, "User deleted");
    assert.includes(text, 'TyEUSRDLD02_');
  });


  // ----- Others can't see deleted user

  it("The stranger, who is in fact a secret agent, reloads the page (a mistake!)", async () => {
    await stranger_brA.go2(discussionPageUrl); // back from pwd reset page
    await stranger_brA.topic.waitForLoaded();
  });

  it("... Parinia's username is gone — it changed to anonNNNN", async () => {
    const username = await stranger_brA.topic.getTopicAuthorUsernameInclAt();
    assert.eq(username.substr(0, '@anon'.length), '@anon');
  });

  it("The secret agent desperately clicks anonNNNN, goes to the account page", async () => {
    await stranger_brA.complex.openPageAuthorProfilePage();
  });

  it("... the user profile page username is  anonNNNNN", async () => {
    const username = await stranger_brA.userProfilePage.waitAndGetUsername();
    assert.eq(username.substr(0, 'anon'.length), 'anon');
  });

  it("... and deleted or deactivated", async () => {
    await stranger_brA.userProfilePage.waitUntilDeletedOrDeactivated();
  });


  // ----- Custom group updated

  it("Owen returns to the group members page", async () => {
    await owen_brA.userProfilePage.groupMembers.goHere(GroupUsername);
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... now there's only one member — Parinia is gone", async () => {
    assert.eq(await owen_brA.userProfilePage.groupMembers.getNumMembers(), 1);
  });

  it("... Maria is there", async () => {
    await owen_brA.userProfilePage.groupMembers.waitUntilMemberPresent(
            forum.members.maria.username);
  });


  // ----- Auto groups updated

  it("... and in the All Members group, there're now 3 members instead of 4", async () => {
    await owen_brA.userProfilePage.groupMembers.goHere(c.AllMembersUsername);
    assert.eq(await owen_brA.userProfilePage.groupMembers.getNumMembers(), 3);
  });

  it("... they are Maria, Owen and Michael (the secret agent is nowhere to be seen)", async () => {
    const waitUntilMemberPresent = owen_brA.userProfilePage.groupMembers.waitUntilMemberPresent;
    await waitUntilMemberPresent(forum.members.maria.username);
    await waitUntilMemberPresent(forum.members.owen.username);
    await waitUntilMemberPresent(forum.members.michael.username);
  });

});

