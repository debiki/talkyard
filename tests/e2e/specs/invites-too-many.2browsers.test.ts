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





let forum: EmptyTestForum;

let everyonesBrowsers;
let staffsBrowser: TyE2eTestBrowser;
let othersBrowser: TyE2eTestBrowser;
let owen: Member;
let owensBrowser: TyE2eTestBrowser;

let siteId;
let siteIdAddress: IdAddress;
let forumTitle = "Some E2E Test";


function make20Addresses(firstLetter: string): string {  // sync 20 with app server [6ABKR021]
  return (
      'e2e-test--' + firstLetter + '-01@x.co\n' +
      'e2e-test--' + firstLetter + '-02@x.co\n' +
      'e2e-test--' + firstLetter + '-03@x.co\n' +
      'e2e-test--' + firstLetter + '-04@x.co\n' +
      'e2e-test--' + firstLetter + '-05@x.co\n' +
      'e2e-test--' + firstLetter + '-06@x.co\n' +
      'e2e-test--' + firstLetter + '-07@x.co\n' +
      'e2e-test--' + firstLetter + '-08@x.co\n' +
      'e2e-test--' + firstLetter + '-09@x.co\n' +
      'e2e-test--' + firstLetter + '-10@x.co\n' +
      '\n' +
      'e2e-test--' + firstLetter + '-11@x.co\n' +
      'e2e-test--' + firstLetter + '-12@x.co\n' +
      'e2e-test--' + firstLetter + '-13@x.co\n' +
      'e2e-test--' + firstLetter + '-14@x.co\n' +
      'e2e-test--' + firstLetter + '-15@x.co\n' +
      'e2e-test--' + firstLetter + '-16@x.co\n' +
      'e2e-test--' + firstLetter + '-17@x.co\n' +
      'e2e-test--' + firstLetter + '-18@x.co\n' +
      'e2e-test--' + firstLetter + '-19@x.co\n' +
      'e2e-test--' + firstLetter + '-20@x.co\n' +
      '\n');
}

/* Manually, can try these 21 emails:

a-01@x.co
a-02@x.co
a-03@x.co
a-04@x.co
a-05@x.co
a-06@x.co
a-07@x.co
a-08@x.co
a-09@x.co
a-10@x.co

b-01@x.co
b-02@x.co
b-03@x.co
b-04@x.co
b-05@x.co
b-06@x.co
b-07@x.co
b-08@x.co
b-09@x.co
b-10@x.co

c-01@x.co

 */


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
    everyonesBrowsers = new TyE2eTestBrowser(wdioBrowser);
    staffsBrowser = new TyE2eTestBrowser(browserA);
    othersBrowser = new TyE2eTestBrowser(browserB);
    owen = forum.members.owen;
    owensBrowser = staffsBrowser;
  });

  it("Owen goes to the Invites tab", () => {
    owensBrowser.adminArea.goToUsersInvited(siteIdAddress.origin, { loginAs: owen });
  });

  it("He invites 20 people, works fine", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeAndSubmitInvite(make20Addresses('a'),
        { numWillBeSent: 20 });
  });

  it("He attempts to invite 21 people", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeInvite(make20Addresses('b') + '\n e2e-test--one-more@x.co');
    owensBrowser.inviteDialog.clickSubmit();
  });

  it("... results in a too-many-emails error", () => {
    owensBrowser.serverErrorDialog.waitForTooManyInvitesError();
    owensBrowser.serverErrorDialog.close();
    owensBrowser.inviteDialog.cancel();
  });

  it("He invites 20 people again, still works fine", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeAndSubmitInvite(make20Addresses('c'),
        { numWillBeSent: 20 });
  });

  it("He invites 20 people again, now 60 in total", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeAndSubmitInvite(make20Addresses('d'),
        { numWillBeSent: 20 });
  });

  it("He invites 20 people again, now 80 in total", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeAndSubmitInvite(make20Addresses('e'),
        { numWillBeSent: 20 });
  });

  it("He invites 20 people again, now 100 in total", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeAndSubmitInvite(make20Addresses('f'),
        { numWillBeSent: 20 });
  });

  it("He invites 20 people again, now 120 in total", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeAndSubmitInvite(make20Addresses('g'),
        { numWillBeSent: 20 });
  });

  it("He attempts to invite just one more", () => {
    owensBrowser.adminArea.users.invites.clickSendInvite();
    owensBrowser.inviteDialog.typeInvite('\n e2e-test--one-last-final-more@plz.co');
    owensBrowser.inviteDialog.clickSubmit();
  });

  it("... results in a too-many-emails this week error", () => {
    owensBrowser.serverErrorDialog.waitForTooManyInvitesLastWeekError();
  });

});
