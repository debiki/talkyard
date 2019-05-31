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
let michael: Member;
let michaelsBrowser;

const groupOneUsername = 'group_one';
const groupOneFullName = 'Group One Full Name';

const groupTwoUsername = 'group_two';
const groupTwoFullName = 'Group Two Full Name';

const topicOneTitle = 'topicOneTitle SpecCat';
const topicOneBody = 'topicOneBody SpecCat';
const topicTwoTitle = 'topicTwoTitle DefCat';
const topicTwoBodyMentionsMichael = 'topicTwoBody DefCat @michael';
const topicThreeTitle = 'topicThreeTitle SpecCat';
const topicThreeBody = 'topicThreeBody SpecCat';
const owensReplyMentionsMichel = 'owensReplyMentionsMichel Hi @michael';
const owensReplyTwo = 'owensReplyTwo';
const owensReplyNotMuted = 'owensReplyNotMuted';
const owensReplyFourMichaelMemberNotMaria = 'owensReplyFourMichaelMemberNotMaria';
const owensReplyFiveMentionsMaria = 'owensReplyFiveMentionsMaria Hi there, @maria';

let numEmailsToMaria = 0;
let numEmailsToMichael = 0;
let numEmailsTotal = 0;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;


describe("notf-prefs-custom-groups.2browsers.test.ts  TyT60MRAT24", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
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
    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    michael = forum.members.michael;
    michaelsBrowser = richBrowserB;
  });


  // ------- Create group, add people, subscr to category NewTopics

  it("Owen logs in to the groups page", () => {
    owensBrowser.groupListPage.goHere(siteIdAddress.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... creates Custom Group One", () => {
    owensBrowser.groupListPage.createGroup({ username: groupOneUsername, fullName: groupOneFullName });
  });

  it("... adds Maria to Custom Group One", () => {
    owensBrowser.userProfilePage.groupMembers.addOneMember(maria.username);
  });

  it("... navigates to the group's notf prefs", () => {
    owensBrowser.userProfilePage.goToPreferences();
    owensBrowser.userProfilePage.preferences.switchToNotifications();
  });

  it("... sets notf prefs = New Topics, for the Specific Category", () => {
    owensBrowser.userProfilePage.preferences.notfs.setNotfLevelForCategoryId(
        forum.categories.specificCategory.id, c.TestPageNotfLevel.NewTopics);
  });

  it("... goes back to the group page", () => {
    owensBrowser.userProfilePage.navBackToGroups();
  });

  it("... creates Custom Group Two", () => {
    owensBrowser.groupListPage.createGroup({ username: groupTwoUsername, fullName: groupTwoFullName });
  });


  // ------- Group cat subscriptions work

  it("Owen goes to the Specific Category", () => {
    owensBrowser.forumCategoryList.goHere();
    owensBrowser.forumCategoryList.openCategory(forum.categories.specificCategory.name);
  });

  it("... posts a topic", () => {
    owensBrowser.complex.createAndSaveTopic({ title: topicOneTitle, body: topicOneBody });
    numEmailsToMaria += 1;
    numEmailsToMichael += 0;
    numEmailsTotal += 1;
  });

  it("... Maria gets notified", () => {
    const titleBody = [topicOneTitle, topicOneBody];
    server.waitUntilLastEmailMatches(siteId, maria.emailAddress, titleBody, browser);
  });

  it("... once, exactly", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  it("... but not Michael", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), numEmailsToMichael);
  });

  it("... num emails sent is correct", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ------- ... But not for the wrong category

  // Only configured for the Spec Cat, not Category A

  it("Owen goes to Category A", () => {
    owensBrowser.forumTopicList.goHere({ categorySlug: forum.categories.categoryA.slug });
  });

  it("... posts a topic, mentions @michael", () => {
    owensBrowser.complex.createAndSaveTopic({ title: topicTwoTitle, body: topicTwoBodyMentionsMichael });
    numEmailsToMaria += 0;
    numEmailsToMichael += 1;
    numEmailsTotal += 1;
  });

  it("... Michael gets notified", () => {
    const titleBody = [topicTwoTitle, topicTwoBodyMentionsMichael];
    server.waitUntilLastEmailMatches(siteId, michael.emailAddress, titleBody, browser);
  });

  it("... once, exactly", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), numEmailsToMichael);
  });

  it("... not Maria", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  it("... num emails sent is correct", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ------- Two groups, chatty prefs wins

  it("Owen adds Maria to Custom Group Two", () => {
    owensBrowser.groupListPage.goHere();
    owensBrowser.groupListPage.openGroupWithUsername(groupTwoUsername);
    owensBrowser.userProfilePage.groupMembers.addOneMember(maria.username);
  });

  it("... goes to the group's notf prefs", () => {
    owensBrowser.userProfilePage.preferences.notfs.goHere(groupTwoUsername, { isGroup: true });
  });

  it("... and sets notf prefs = Muted, for the Spec Cat", () => {
    owensBrowser.userProfilePage.preferences.notfs.setNotfLevelForCategoryId(
        forum.categories.specificCategory.id, c.TestPageNotfLevel.Muted);
  });

  it("Owen posts a 2nd topic in the Specific Category", () => {
    owensBrowser.forumTopicList.goHere({ categorySlug: forum.categories.specificCategory.slug });
    owensBrowser.complex.createAndSaveTopic({ title: topicThreeTitle, body: topicThreeBody });
    numEmailsToMaria += 1;
    numEmailsToMichael += 0;
    numEmailsTotal += 1;
  });

  it(`... Maria gets notified about "${topicThreeTitle}" — NewTopics wins over Muted`, () => {
    const titleBody = [topicThreeTitle, topicThreeBody];
    server.waitUntilLastEmailMatches(siteId, maria.emailAddress, titleBody, browser);
  });

  it("... once, exactly", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  it("... not Michel", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), numEmailsToMichael);
  });

  it("... num emails sent is correct", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ------- (Test the test: Notf setting is NewTopics, not EveryPost)

  it("Owen posts a reply, mentions Michael", () => {
    owensBrowser.complex.replyToOrigPost(owensReplyMentionsMichel);
    numEmailsToMaria += 0;
    numEmailsToMichael += 1;
    numEmailsTotal += 1;
  });

  it(`... Michael gets notified`, () => {
    server.waitUntilLastEmailMatches(siteId, michael.emailAddress, owensReplyMentionsMichel, browser);
  });

  it("... once, exactly", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), numEmailsToMichael);
  });

  it("... not Maria — because only subscribed to NewTopics", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  let pageUrl;

  it("... num emails sent is correct", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
    pageUrl = owensBrowser.url().value;
  });


  // ------- Changing group notf setting to EveryPost, chatty prefs wins

  it("Owen changes Spec Cat from Muted to EveryPost, for Group Two", () => {
    owensBrowser.userProfilePage.preferences.notfs.goHere(groupTwoUsername, { isGroup: true });
    owensBrowser.userProfilePage.preferences.notfs.setNotfLevelForCategoryId(
        forum.categories.specificCategory.id, c.TestPageNotfLevel.EveryPost);
  });

  it("... goes back to the last topic", () => {
    owensBrowser.go(pageUrl);
  });

  it("... and posts another reply", () => {
    owensBrowser.complex.replyToOrigPost(owensReplyTwo);
    numEmailsToMaria += 1;
    numEmailsTotal += 1;
  });

  it(`... Maria gets notified about the reply — chatty EveryPost wins over NewTopics`, () => {
    server.waitUntilLastEmailMatches(siteId, maria.emailAddress, owensReplyTwo, browser);
  });

  it("... once, exactly", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  it("... num emails sent is correct", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ------- Removing a group member, adding another

  it("Owen goes to Group Two", () => {
    owensBrowser.userProfilePage.groupMembers.goHere(groupTwoUsername);
  });

  it("... removes Maria", () => {
    owensBrowser.userProfilePage.groupMembers.removeFirstMember();
  });

  it("... adds Michael", () => {
    owensBrowser.userProfilePage.groupMembers.addOneMember(michael.username);
  });

  it("Owen posts another reply", () => {
    owensBrowser.go(pageUrl);
    owensBrowser.complex.replyToOrigPost(owensReplyFourMichaelMemberNotMaria);
    numEmailsToMaria += 0;
    numEmailsToMichael += 1;
    numEmailsTotal += 1;
  });

  it(`... Michael gets notified about "${owensReplyFourMichaelMemberNotMaria}"`, () => {
    server.waitUntilLastEmailMatches(
        siteId, michael.emailAddress, owensReplyFourMichaelMemberNotMaria, browser);
  });

  it("... once, exactly", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), numEmailsToMichael);
  });

  it("... not Maria — she's no longer in Group Two", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  it("... num emails sent is correct", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ------- Group cat notf pref overrides member whole site pref

  // (Because is more specific, content structure wise.)

  it("Michael logs in", () => {
    michaelsBrowser.userProfilePage.preferences.notfs.goHere(michael.username, { origin: siteIdAddress.origin });
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
  });

  it("... mutes the whole site", () => {
    michaelsBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.Muted);
  });

  it("Owen posts another reply", () => {
    owensBrowser.complex.replyToOrigPost(owensReplyNotMuted);
    numEmailsToMichael += 1;
    numEmailsTotal += 1;
  });

  it("... Michael still gets notified — because the group's EveryPost cat notf pref, is more " +
      "specific, than Michael's whole site Muted pref", () => {
    server.waitUntilLastEmailMatches(siteId, michael.emailAddress, owensReplyNotMuted, browser);
  });

  it("... num emails sent is correct", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ------- Member's cat pref overrides group's cat pref

  // ... on the same content specificity level (category & category).

  it("Michael mutes Spec Cat", () => {
    michaelsBrowser.userProfilePage.preferences.notfs.setNotfLevelForCategoryId(
        forum.categories.specificCategory.id, c.TestPageNotfLevel.Muted);
  });

  it("Owen posts a fifth reply, mentions @maria", () => {
    owensBrowser.complex.replyToOrigPost(owensReplyFiveMentionsMaria);
    numEmailsToMaria += 1;
    numEmailsToMichael += 0;
    numEmailsTotal += 1;
  });

  it(`... Maria gets notified`, () => {
    server.waitUntilLastEmailMatches(siteId, maria.emailAddress, owensReplyFiveMentionsMaria, browser);
  });

  it("... once, exactly", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  it("... not Michael — he has muted the category, and his own cat notf prefs are " +
      "more specific than Group Two's cat notf prefs", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), numEmailsToMichael);
  });

  it("... num emails sent is correct", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ------- Deleting a group

  it("There are two custom groups", () => {
    owensBrowser.groupListPage.goHere();
    assert.equal(owensBrowser.groupListPage.countCustomGroups(), 2);
  });

  it("Owen deletes Group Two (when Maria is still a member)", () => {
    owensBrowser.userProfilePage.preferences.goHere(groupTwoUsername, { isGroup: true });
    owensBrowser.userProfilePage.preferences.switchToEmailsLogins();
    owensBrowser.userProfilePage.preferences.emailsLogins.deleteAccount();
    owensBrowser.groupListPage.waitUntilLoaded();
  });

  it("Now there's just one custom group left", () => {
    assert.equal(owensBrowser.groupListPage.countCustomGroups(), 1);
  });


  // ------- Didn't delete members from the wrong group

  it("It's Group One; Owen opens it", () => {
    owensBrowser.groupListPage.openGroupWithUsername(groupOneUsername);
  });

  it("... Maria is still a member", () => {
    owensBrowser.userProfilePage.groupMembers.waitUntilMemberPresent(maria.username);
  });

});

