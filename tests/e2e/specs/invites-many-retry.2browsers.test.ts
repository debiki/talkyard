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

const addr1Accepts = 'e2e-test--addr1-accepts@x.co';
const addr1Username = 'e2e_test_addr1_accepts'.substr(0, c.MaxUsernameLength);
const addr2Retry = 'e2e-test--addr2-retry@x.co';
const addr2Username = 'e2e_test_addr2_retry'.substr(0, c.MaxUsernameLength);
const addr3 = 'e2e-test--addr3@x.co';
const addr3Username = 'e2e_test_addr3';
const addr4 = 'e2e-test--addr4@x.co';


describe("invites-many-retry  TyT5BKA2WA30", () => {

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

  // invite:
  //
  // adr1
  // adr2
  //
  // adr1 accepts
  //
  // adr1  = cannot invite again
  //
  // adr2  = asks if wants to retry
  //
  // adr1  = cannot invite again
  // adr2  = asks if wants to retry
  //
  //
  // adr1  = cannot invite again
  // adr2  = asks if wants to retry
  // adr3  = ok
  // adr4  = ok

  it("He sends invites to addr1 and addr2, and spaces trimmed and #comments skipped [TyT2BR057]", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    // Trailing comma and ; should be ignored.
    owensBrowser.inviteDialog.typeAndSubmitInvite(
        `\n${addr1Accepts}\n\n   ${addr2Retry},;  \n#ignored\n  # also ignored  \n\n`,
        { numWillBeSent: 2 });
  });

  let inviteLinkAddr1Accepts;
  let inviteLinkAddr2Retry;


  it("An email is sent to addr1-accepts", () => {
    inviteLinkAddr1Accepts = waitForInviteEmail(siteId, addr1Accepts, browserA);
    assert(inviteLinkAddr1Accepts);
  });

  it("An email is sent to addr2-retry", () => {
    inviteLinkAddr2Retry = waitForInviteEmail(siteId, addr2Retry, browserA);
    assert(inviteLinkAddr2Retry);
  });

  it("Addr 1 accepts", () => {
    othersBrowser.go(inviteLinkAddr1Accepts);
    othersBrowser.topbar.waitForMyMenuVisible();
    othersBrowser.topbar.assertMyUsernameMatches(addr1Username);
  });


  // ----- Already joined

  it("Owen invites addr1 again", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeInvite(addr1Accepts);
    owensBrowser.inviteDialog.clickSubmit();
  });

  it("... results in an already-joined info dialog", () => {
    owensBrowser.inviteDialog.waitForCorrectNumSent(0);
    owensBrowser.inviteDialog.assertAlreadyJoined(addr1Accepts);
    owensBrowser.inviteDialog.closeResultsDialog();
  });


  // ----- Resend invite questions

  it("Owen invites addr2 again", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeInvite(addr2Retry);
    owensBrowser.inviteDialog.clickSubmit();
  });

  it("... results in an already-invited info dialog, and invite-again? question", () => {
    owensBrowser.inviteDialog.waitForCorrectNumSent(0);
    owensBrowser.inviteDialog.assertAlreadyInvited(addr2Retry);
  });

  it("... he resends the invite", () => {
    owensBrowser.inviteDialog.closeResultsDialog();
    assert(owensBrowser.inviteDialog.isInviteAgainVisible());
    owensBrowser.inviteDialog.clickSubmit();
    owensBrowser.inviteDialog.closeResultsDialog();
  });

  let inviteLinkAddr2RetryB;

  it("... so addr2 got a new invite email", () => {
    inviteLinkAddr2RetryB = waitForInviteEmail(siteId, addr2Retry, browserA);
    assert(inviteLinkAddr2RetryB);
    assert(inviteLinkAddr2RetryB !== inviteLinkAddr2Retry)
  });

  let numEmailsToAddr1;

  it("Remember num emails to addr1", () => {
    numEmailsToAddr1 = server.countLastEmailsSentTo(siteId, addr1Accepts);
    assert(numEmailsToAddr1 < 5);  // not sure exactly how many
  });

  // ----- All at the same time

  it("Owen invites addr1, addr2, addr3, addr4", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeInvite(
        `${addr1Accepts}\n${addr2Retry}\n${addr3}\n${addr4}\n`);
    owensBrowser.inviteDialog.clickSubmit();
  });

  it("... gets a message that two people invited (addr3 and addr4)", () => {
    owensBrowser.inviteDialog.waitForCorrectNumSent(2);
  });

  it("... and that addr1 already joined", () => {
    owensBrowser.inviteDialog.assertAlreadyJoined(addr1Accepts);
  });

  it("... and addr2 already invited, invite again?", () => {
    owensBrowser.inviteDialog.assertAlreadyInvited(addr2Retry);
  });

  it("... and addr3 and addr4 will be invited", () => {
    owensBrowser.inviteDialog.waitForCorrectNumSent(2);
  });

  it("... cancels the dialog, won't invite addr2 again", () => {
    owensBrowser.inviteDialog.closeResultsDialog();
    assert(owensBrowser.inviteDialog.isInviteAgainVisible());
    owensBrowser.inviteDialog.cancel();
  });

  it("Now: the invite list lists all invites, in the correct statuses", () => {
    owensBrowser.invitedUsersList.waitAssertInviteRowPresent(1, {
      email: addr2Retry, accepted: false,
    });
    owensBrowser.invitedUsersList.waitAssertInviteRowPresent(2, {
      email: addr1Accepts, acceptedByUsername: addr1Username,
    });
    owensBrowser.invitedUsersList.waitAssertInviteRowPresent(3, {
      email: addr2Retry, accepted: false,
    });
    owensBrowser.invitedUsersList.waitAssertInviteRowPresent(4, {
      email: addr3, accepted: false,
    });
    owensBrowser.invitedUsersList.waitAssertInviteRowPresent(5, {
      email: addr4, accepted: false,
    });
  });

  let inviteLinkAddr3;

  it("Addr3 got an invite email", () => {
    inviteLinkAddr3 = waitForInviteEmail(siteId, addr3, browserA);
    assert(inviteLinkAddr3);
  });

  it("... and addr4 too", () => {
    const inviteLinkAddr4 = waitForInviteEmail(siteId, addr4, browserA);
    assert(inviteLinkAddr4);
  });

  it("... the links work: Addr3 can log in ", () => {
    othersBrowser.topbar.clickLogout();
    othersBrowser.go(inviteLinkAddr3);
    othersBrowser.topbar.waitForMyMenuVisible();
    othersBrowser.topbar.assertMyUsernameMatches(addr3Username);
  });

  it("Addr1 didn't get any new email though", () => {
    // Addr1 got some welcome email(s) when signing up, so cannot check that last email is the
    // old invite email (instead, it's some welcome email).
    const numNow = server.countLastEmailsSentTo(siteId, addr1Accepts);
    assert.equal(numNow, numEmailsToAddr1);
  });

  it("... and addr2 also didn't", () => {
    const latestLink = waitForInviteEmail(siteId, addr2Retry, browserA);
    assert.equal(latestLink, inviteLinkAddr2RetryB);
  });

  it("Now addr2 accepts the most recent invite", () => {
    othersBrowser.topbar.clickLogout();
    othersBrowser.go(inviteLinkAddr2RetryB);
    othersBrowser.topbar.waitForMyMenuVisible();
    othersBrowser.topbar.assertMyUsernameMatches(addr2Username);
  });

  it("Owens refreshes, invites will be sorted by time", () => {   // [TyT402AKTS406]
    owensBrowser.refresh();
    // Will be:
    // Inv to addr 4                  index 1
    // Inv to addr 3 = accepted       index 2
    // Inv to addr 2 = accepted       index 3
    // Inv to addr 2 = invalidated    index 4
    // Inv to addr 1 = accepted       index 5
  });

  it("... in Owens browser, the most recent addr2 invite now appears as accepted", () => {
    owensBrowser.invitedUsersList.waitAssertInviteRowPresent(3, {
      email: addr2Retry, acceptedByUsername: addr2Username,
    });
  });

  it("... and the old invite to addr2, is now invalidated", () => {
    owensBrowser.invitedUsersList.waitAssertInviteRowPresent(4, {
      email: addr2Retry, deleted: true,
    });
  });

  it("... the invite for addr3 is accepted", () => {
    owensBrowser.invitedUsersList.waitAssertInviteRowPresent(2, {
      email: addr3, accepted: addr3Username,
    });
  });

  it("... the other invites, didn't change", () => {
    owensBrowser.invitedUsersList.waitAssertInviteRowPresent(5, {
      email: addr1Accepts, acceptedByUsername: addr1Username,
    });
    owensBrowser.invitedUsersList.waitAssertInviteRowPresent(1, {
      email: addr4, accepted: false,
    });
  });

});

