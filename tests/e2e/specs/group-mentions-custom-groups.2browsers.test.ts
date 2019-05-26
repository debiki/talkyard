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
let michael;
let maria;
let maja;
let majasBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: EmptyTestForum;

const BasicGroupFullName = 'BasicGroupFullName';
const BasicGroupUsername = 'BasicGroupUsername';
const GroupTwoFullName = 'GroupTwoFullName';
const GroupTwoUsername = 'GroupTwoUsername';

const OwensTopicMentionsBasicGroup =
    { title: 'OwensTopicTitle', body: 'OwensTopicBody, Hi @' + BasicGroupUsername };

const majasReplyMentionsBasicGroup = 'majasReplyMentionsBasicGroup @' + BasicGroupUsername;

let discussionPageUrl: string;


describe("group-mentions-custom-group  TyT5BMRP2058", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "Some E2E Test",
      members: ['owen', 'maja', 'maria', 'michael']
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

    michael = forum.members.michael;
    maria = forum.members.maria;
    maja = forum.members.maja;
    majasBrowser = richBrowserB;
  });

  it("Owen logs in to the groups page", () => {
    owensBrowser.groupListPage.goHere(siteIdAddress.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... creates Basic Group", () => {
    owensBrowser.groupListPage.createGroup(
        { username: BasicGroupUsername, fullName: BasicGroupFullName });
  });

  it("... adds Maja and Michael", () => {
    owensBrowser.userProfilePage.groupMembers.addOneMember(maria.username);
    owensBrowser.userProfilePage.groupMembers.addOneMember(maja.username);
  });

  it("Owen creates Group Two", () => {
    owensBrowser.userProfilePage.navigateBackToUsersOrGroupsList();
    owensBrowser.groupListPage.createGroup(
        { username: GroupTwoUsername, fullName: GroupTwoFullName });
  });

  it("... adds Michael", () => {
    owensBrowser.userProfilePage.groupMembers.addOneMember(michael.username);
  });

  it("Owen posts a topic, mentions @" + BasicGroupUsername, () => {
    owensBrowser.topbar.clickBack();
    owensBrowser.complex.createAndSaveTopic(OwensTopicMentionsBasicGroup);
    discussionPageUrl = owensBrowser.url().value;
  });

  it("Maja logs in", () => {
    majasBrowser.go(siteIdAddress.origin);
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
  });

  it("... sees a new-post-to-you notification", () => {
    majasBrowser.topbar.waitForNumDirectNotfs(1);
  });

  it("... Maja and Maria get a notification email", () => {
    const titleBody = [OwensTopicMentionsBasicGroup.title, OwensTopicMentionsBasicGroup.body];
    server.waitUntilLastEmailMatches(siteId, maria.emailAddress, titleBody, richBrowserA);
    server.waitUntilLastEmailMatches(siteId, maja.emailAddress, titleBody, richBrowserA);
  });

  it("... those were the only emails sent", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, 2, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it("Maja opens the new topic, via the topbar", () => {
    majasBrowser.topbar.openNotfToMe({ waitForNewUrl: true });
  });

  it("Maja replies, also mentions @" + BasicGroupUsername, () => {
    majasBrowser.complex.replyToOrigPost(majasReplyMentionsBasicGroup);
  });

  it("... Maria gets a notf email — not Maja, she's the reply author", () => {
    server.waitUntilLastEmailMatches(
          siteId, maria.emailAddress, majasReplyMentionsBasicGroup, richBrowserA);
  });

  it("... Owen also get notified, since Maja replied to him", () => {
    server.waitUntilLastEmailMatches(
          siteId, owen.emailAddress, majasReplyMentionsBasicGroup, richBrowserA);
  });

  it("... no one else got an email", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, 4, `Emails sent to: ${addrsByTimeAsc}`);
  });

});

