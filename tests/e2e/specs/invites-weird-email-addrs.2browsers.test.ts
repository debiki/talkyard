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

const janesEmailAddress = 'e2e-test--jane@example.com';
const janesUsername = 'e2e_test_jane';

const joeDoesEmailAddress = 'e2e-test--joe.doe@example.com';
const joeDoesUsername = 'e2e_test_joe_doe';

const johnDoesEmailAddress = 'e2e-test--wow__~~j.doe@example.com';
const johnDoesUsername = 'e2e_test_wow_j_doe';

const fidosTooLongEmailAddress = 'e2e-test--fido~wiffwaff@example.com';
const fidosUsername = 'e2e_test_fido_wiffwa';  // last ...ff = chars 21,22, got removed

const fidosSiblingsEmailAddress = 'e2e-test--fido~wiffwaff-wuff@example.com';
// Here, last char 'a' got replaced with random digit, otherwise would have been identical with
// Fido's username.
const fidosSiblingsUsername = 'e2e_test_fido_wiffw[\\d]';
const fidosSiblingsPassword = 'publ-fi020';

/*  oops, this addr got rejected by Apace Commons Email (but accepted by Apache's validator)
    Incl below as  invalidEmailAddress4  instead, hmm.
const unicondasEmailAddress = 'e2e-test--så_漢字_❤_é@example.com';
const unicondasUsername = 'e2e_test_sa_zz_z_e'; */

const invalidEmailAddress = 'e2e-test--double..dot@example.com';
const invalidEmailAddress2 = 'e2e-test--end-dot.@example.com';
const invalidEmailAddress3 = 'e2e-test--co,mma@example.com';
const invalidEmailAddress4 = 'e2e-test--så_漢字_❤_é@example.com';

describe("invites-werd-email-addrs  TyT7KBAJ2AD4", () => {

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

  it("Owen goes to the Invites tab", () => {
    owensBrowser.adminArea.goToUsersInvited(siteIdAddress.origin, { loginAs: owen });
  });

  it("He sends invites to people with unusual email addresses", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeAndSubmitInvite(janesEmailAddress);
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeAndSubmitInvite(joeDoesEmailAddress);
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeAndSubmitInvite(johnDoesEmailAddress);
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeAndSubmitInvite(fidosTooLongEmailAddress);
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeAndSubmitInvite(fidosSiblingsEmailAddress);
    //owensBrowser.adminArea.users.invites.clickSendInvite();
    //owensBrowser.inviteDialog.typeAndSubmitInvite(unicondasEmailAddress);
  });

  it("... some invalid addresses result in errors", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeInvite(invalidEmailAddress);
    owensBrowser.inviteDialog.clickSubmit();
    owensBrowser.serverErrorDialog.waitForBadEmailAddressError();
    owensBrowser.serverErrorDialog.close();

    // (The invite dialog reamins open, need not click-to-open again.)
    owensBrowser.inviteDialog.typeInvite(invalidEmailAddress2);
    owensBrowser.inviteDialog.clickSubmit();
    owensBrowser.serverErrorDialog.waitForBadEmailAddressError();
    owensBrowser.serverErrorDialog.close();

    owensBrowser.inviteDialog.typeInvite(invalidEmailAddress3);
    owensBrowser.inviteDialog.clickSubmit();
    owensBrowser.serverErrorDialog.waitForBadEmailAddressError();
    owensBrowser.serverErrorDialog.close();

    owensBrowser.inviteDialog.typeInvite(invalidEmailAddress4);
    owensBrowser.inviteDialog.clickSubmit();
    owensBrowser.serverErrorDialog.waitForBadEmailAddressError();
    owensBrowser.serverErrorDialog.close();
  });

  let inviteLinkJane;
  let inviteLinkJoeDoe;
  let inviteLinkJohnDoe;
  let inviteLinkFidosTooLong;
  let inviteLinkFidosSibling;
  //let inviteLinkUniconda;


  // These describe(...) make the tests never run :- ( comment out for now.
  //describe("They all get invite emails", () => {
    const waitForInviteEmail = server.waitAndGetInviteLinkEmailedTo;
    it(janesEmailAddress, () => {
      inviteLinkJane = waitForInviteEmail(siteId, janesEmailAddress, browserA);
    });
    it(joeDoesEmailAddress, () => {
      inviteLinkJoeDoe = waitForInviteEmail(siteId, joeDoesEmailAddress, browserA);
    });
    it(johnDoesEmailAddress, () => {
      inviteLinkJohnDoe = waitForInviteEmail(siteId, johnDoesEmailAddress, browserA);
    });
    it(fidosTooLongEmailAddress, () => {
      inviteLinkFidosTooLong = waitForInviteEmail(siteId, fidosTooLongEmailAddress, browserA);
    });
    it(fidosSiblingsEmailAddress, () => {
      inviteLinkFidosSibling = waitForInviteEmail(siteId, fidosSiblingsEmailAddress, browserA);
    });
    /*it(unicondasEmailAddress, () => {
      inviteLinkUniconda = waitForInviteEmail(siteId, unicondasEmailAddress, browserA);
    });*/
  //});

  let fidosSiblingsActualUsername;


  //describe("They click the invite links, and appear with okay & valid usernames", () => {
    it("2 Jane", () => {
      othersBrowser.go(inviteLinkJane);
      othersBrowser.topbar.waitForMyMenuVisible();
      othersBrowser.topbar.assertMyUsernameMatches(janesUsername);
    });
    it("Joe Doe", () => {
      othersBrowser.go(inviteLinkJoeDoe);
      othersBrowser.topbar.waitForMyMenuVisible();
      othersBrowser.topbar.assertMyUsernameMatches(joeDoesUsername);
    });
    it("John Doe", () => {
      othersBrowser.go(inviteLinkJohnDoe);
      othersBrowser.topbar.waitForMyMenuVisible();
      othersBrowser.topbar.assertMyUsernameMatches(johnDoesUsername);
    });
    it("Fido Too Long", () => {
      othersBrowser.go(inviteLinkFidosTooLong);
      othersBrowser.topbar.waitForMyMenuVisible();
      othersBrowser.topbar.assertMyUsernameMatches(fidosUsername);
    });
    it("Fidos Sibling", () => {
      othersBrowser.go(inviteLinkFidosSibling);
      othersBrowser.topbar.waitForMyMenuVisible();
      othersBrowser.topbar.assertMyUsernameMatches(fidosSiblingsUsername);
      fidosSiblingsActualUsername = othersBrowser.topbar.getMyUsername();
    });
    /*it("Uniconda", () => {
      owensBrowser.debug();
      othersBrowser.go(inviteLinkUniconda);
      othersBrowser.topbar.waitForMyMenuVisible();
      othersBrowser.topbar.assertMyUsernameMatches(unicondasUsername);
    });*/
  //});

  let choosePasswordLink;

  it("Fido's sibling (and the others) get a choose-password email", () => {
    choosePasswordLink = server.waitAndGetThanksForAcceptingInviteEmailResetPasswordLink(
      siteId, fidosSiblingsEmailAddress, browserA);
  });

  it("... clicks the choose-password link in the email", () => {
    othersBrowser.go(choosePasswordLink);
  });

  it("... and chooses a password", () => {
    othersBrowser.chooseNewPasswordPage.typeAndSaveNewPassword(fidosSiblingsPassword);
  });

  it("Fido's sibling logs out", () => {
    othersBrowser.go('/');
    othersBrowser.topbar.clickLogout();
  });

  it("... and can login", () => {
    othersBrowser.complex.loginWithPasswordViaTopbar(fidosSiblingsActualUsername, fidosSiblingsPassword);
  });

  it("Fido's sibling can post topics", () => {
    othersBrowser.complex.createAndSaveTopic({ title: "Title Tile Woff", body: "Woff. Wiff. Oink." });
  });

});

