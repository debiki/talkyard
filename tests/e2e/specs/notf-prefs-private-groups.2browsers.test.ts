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

const mariasGroupUsername = 'marias_group';
const mariasGroupFullName = 'Marias Group Full Name';

const michaelsGroupUsername = 'michaels_group';
const michaelsGroupFullName = 'Michaels Group Full Name';

const topicOneTitle = 'topicOneTitle SpecCat';
const topicOneBody = 'topicOneBody SpecCat';
const topicTwoTitleOnlyMichael = 'topicTwoTitleOnlyMichael DefCat';
const topicTwoBodyOnlyMichael = 'topicTwoBodyOnlyMichael only Michael';

const mentionMichael = '@michael';
const mentionMaria = '@maria';

const topicThreeTitle = 'topicThreeTitle';
const topicThreeBodyMentionsMichael = `topicThreeBodyMentionsMichael ${mentionMichael} hello`;

const topicFourTitleToBoth = 'topicFourTitleToBoth';
const topicFourBodyToBoth = 'topicFourBodyToBoth';

const topicFiveTitleMariaOnly = 'topicFiveTitleMariaOnly';
const topicFiveBodyMariaOnly = 'topicFiveBodyMariaOnly';

const owensReplyMentionsMichaelMaria =
    `owensReplyMentionsMichaelMaria ${mentionMichael} ${mentionMaria} hi`;

let numEmailsToMaria = 0;
let numEmailsToMichael = 0;
let numEmailsTotal = 0;

let siteIdAddress: IdAddress;
let siteId;

let forum: TwoPagesTestForum;


describe("notf-prefs-private-groups  TyT406WMDKG26", () => {

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


  // ------- Create group, add people, subscr to categories

  it("Owen logs in to the groups page", () => {
    owensBrowser.groupListPage.goHere(siteIdAddress.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... creates Maria's Group", () => {
    owensBrowser.groupListPage.createGroup({
        username: mariasGroupUsername, fullName: mariasGroupFullName });
  });

  it("... adds Maria", () => {
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

  it("... creates Michael's Group", () => {
    owensBrowser.groupListPage.createGroup({
        username: michaelsGroupUsername, fullName: michaelsGroupFullName });
  });

  it("... adds Michael", () => {
    owensBrowser.userProfilePage.groupMembers.addOneMember(michael.username);
  });

  it("... navigates to the group's notf prefs", () => {
    owensBrowser.userProfilePage.goToPreferences();
    owensBrowser.userProfilePage.preferences.switchToNotifications();
  });

  it("... sets notf prefs = New Topics, for the Specific Category, for this group too", () => {
    owensBrowser.userProfilePage.preferences.notfs.setNotfLevelForCategoryId(
        forum.categories.specificCategory.id, c.TestPageNotfLevel.NewTopics);
  });


  // ------- Group cat subscriptions work

  it("Owen goes to the Specific Category", () => {
    owensBrowser.forumCategoryList.goHere();
    owensBrowser.forumCategoryList.openCategory(forum.categories.specificCategory.name);
  });

  it("... posts a topic", () => {
    owensBrowser.complex.createAndSaveTopic({ title: topicOneTitle, body: topicOneBody });
    numEmailsToMaria += 1;
    numEmailsToMichael += 1;
    numEmailsTotal += 2;
  });

  it("... Maria and Michael gets notified", () => {
    const titleBody = [topicOneTitle, topicOneBody];
    server.waitUntilLastEmailMatches(siteId, maria.emailAddress, titleBody, browser);
    server.waitUntilLastEmailMatches(siteId, michael.emailAddress, titleBody, browser);
  });

  it("... once, exactly", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), numEmailsToMichael);
  });

  it("... num emails sent is correct", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ------- No notf, if cannot see category

  it("Owen goes to Specific Category", () => {
    owensBrowser.forumTopicList.goHere({ categorySlug: forum.categories.specificCategory.slug });
  });

  it("... opens the security tab", () => {
    owensBrowser.forumButtons.clickEditCategory();
    owensBrowser.categoryDialog.openSecurityTab();
  });

  it("... changes the security settings so only Michael sees the category", () => {
    owensBrowser.categoryDialog.securityTab.switchGroupFromTo(
        c.EveryoneFullName, michaelsGroupFullName);
  });

  it("... saves the settings", () => {
    owensBrowser.categoryDialog.submit();
  });

  it("... posts a topic", () => {
    owensBrowser.complex.createAndSaveTopic({
        title: topicTwoTitleOnlyMichael, body: topicTwoBodyOnlyMichael });
    numEmailsToMaria += 0;
    numEmailsToMichael += 1;
    numEmailsTotal += 1;
  });

  it("... Michael gets notified", () => {
    const titleBody = [topicTwoTitleOnlyMichael, topicTwoBodyOnlyMichael];
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


  // ------- Not yet any site wide notf prefs

  it("Owen goes to Category A", () => {
    owensBrowser.forumTopicList.goHere({ categorySlug: forum.categories.categoryA.slug });
  });

  it("... posts a topic, mentions Michael", () => {
    owensBrowser.complex.createAndSaveTopic({
        title: topicThreeTitle, body: topicThreeBodyMentionsMichael });
    numEmailsToMaria += 0;
    numEmailsToMichael += 1;
    numEmailsTotal += 1;
  });

  it("... Michael gets notified", () => {
    server.waitUntilLastEmailMatches(
        siteId, michael.emailAddress, topicThreeBodyMentionsMichael, browser);
  });

  it("... once, only once", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), numEmailsToMichael);
  });

  it("... not Maria", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  it("... num emails sent is correct", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ------- Site wide notf prefs works

  it("Owen configures site wide New Topics notfs, for Maria's group", () => {
    owensBrowser.userProfilePage.openNotfPrefsFor(mariasGroupUsername);
    owensBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.NewTopics);
  });

  it("... and Michael's group", () => {
    owensBrowser.userProfilePage.openNotfPrefsFor(michaelsGroupUsername);
    owensBrowser.userProfilePage.preferences.notfs.setSiteNotfLevel(c.TestPageNotfLevel.NewTopics);
  });

  it(`He posts a new topic`, () => {
    owensBrowser.forumTopicList.goHere({ categorySlug: forum.categories.categoryA.slug });
    owensBrowser.complex.createAndSaveTopic({
        title: topicFourTitleToBoth, body: topicFourBodyToBoth });
    numEmailsToMaria += 1;
    numEmailsToMichael += 1;
    numEmailsTotal += 2;
  });

  it("... both Michael and Maria get notified", () => {
    server.waitUntilLastEmailMatches(siteId, maria.emailAddress, topicFourBodyToBoth, browser);
    server.waitUntilLastEmailMatches(siteId, michael.emailAddress, topicFourBodyToBoth, browser);
  });

  it("... only once, each", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), numEmailsToMichael);
  });

  it("... num emails sent is correct", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });


  // ------- Whole site notf prefs respect category privacy

  it("Owen restricts access to Category A to only Maria's group: opens the category dialog", () => {
    owensBrowser.forumTopicList.goHere({ categorySlug: forum.categories.categoryA.slug });
    owensBrowser.forumButtons.clickEditCategory();
    owensBrowser.categoryDialog.openSecurityTab();
  });

  it("... changes the security settings so only Maria sees the category", () => {
    owensBrowser.categoryDialog.securityTab.switchGroupFromTo(
        c.EveryoneFullName, mariasGroupFullName);
  });

  it("... saves the settings", () => {
    owensBrowser.categoryDialog.submit();
  });

  it(`Owen again posts a topic in Category A`, () => {
    // This tests  [2069RSK25-B]: topic subscrptions.
    owensBrowser.forumTopicList.goHere({ categorySlug: forum.categories.categoryA.slug });
    owensBrowser.complex.createAndSaveTopic({
        title: topicFiveTitleMariaOnly, body: topicFiveBodyMariaOnly });
    numEmailsToMaria += 1;
    numEmailsToMichael += 0;
    numEmailsTotal += 1;
  });

  it("... Maria gets notified", () => {
    server.waitUntilLastEmailMatches(siteId, maria.emailAddress, topicFiveBodyMariaOnly, browser);
  });

  it(`... once only`, () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  it("... but not Michael", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), numEmailsToMichael);
  });

  it("... num emails sent is correct", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

  it(`Owen tries again, replies and @mentions Michael and Maria`, () => {
    // This tests  [2069RSK25-A]: direct replies and @mentions.
    owensBrowser.complex.replyToOrigPost(owensReplyMentionsMichaelMaria);
    numEmailsToMaria += 1;
    numEmailsToMichael += 0;
    numEmailsTotal += 1;
  });

  it("... but to no avail: Maria gets notified", () => {
    server.waitUntilLastEmailMatches(
        siteId, maria.emailAddress, owensReplyMentionsMichaelMaria, browser);
  });

  it(`... once`, () => {
    assert.equal(server.countLastEmailsSentTo(siteId, maria.emailAddress), numEmailsToMaria);
  });

  it("... not Michael", () => {
    assert.equal(server.countLastEmailsSentTo(siteId, michael.emailAddress), numEmailsToMichael);
  });

  it("... num emails sent is correct", () => {
    const { num, addrsByTimeAsc } = server.getEmailsSentToAddrs(siteId);
    assert.equal(num, numEmailsTotal, `Emails sent to: ${addrsByTimeAsc}`);
  });

});

