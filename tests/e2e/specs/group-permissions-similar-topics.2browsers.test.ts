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
let michaelsBrowser;
let maria;
let mariasBrowser;
let maja;
let majasBrowser;

let siteIdAddress: IdAddress;
let siteId;

let forum: EmptyTestForum;

const GroupOneFullName = 'GroupOneFullName';
const GroupOneUsername = 'GroupOneUsername';
const GroupTwoFullName = 'GroupTwoFullName';
const GroupTwoUsername = 'GroupTwoUsername';


const SharedText = 'SharedText';

const CatOneName = 'CatOneName';
const CatOneTopic =
    { title: 'CatOneTopic_Title', body: `CatOneTopic_Body ${SharedText}` };
let catOneTopicUrl: string;

const CatTwoName = 'CatTwoName';
const CatTwoTopic =
    { title: 'CatTwoTopic_Title', body: `CatTwoTopic_Body ${SharedText}` };
let catTwoTopicUrl: string;

const PublicTopic =
    { title: 'PublicTopic_Title', body: `PublicTopic_Body ${SharedText}` };
let publiTopicUrl: string;


describe("group-permissions-similar-topics  TyT05BMRSH2J", () => {

  it("import a site", () => {
    const builder = buildSite();
    forum = builder.addEmptyForum({
      title: "Group Perms and Similar Topics",
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
    michaelsBrowser = richBrowserB;
    maria = forum.members.maria;
    mariasBrowser = richBrowserB;
    maja = forum.members.maja;
    majasBrowser = richBrowserB;
  });


  // ------- Prepaare groups

  it("Owen logs in to the groups page", () => {
    owensBrowser.groupListPage.goHere(siteIdAddress.origin);
    owensBrowser.complex.loginWithPasswordViaTopbar(owen);
  });

  it("... creates Group One", () => {
    owensBrowser.groupListPage.createGroup(
        { username: GroupOneUsername, fullName: GroupOneFullName });
  });

  it("... adds Maja", () => {
    owensBrowser.userProfilePage.groupMembers.addOneMember(maja.username);
  });

  it("Owen creates Group Two", () => {
    owensBrowser.userProfilePage.navBackToGroups();
    owensBrowser.groupListPage.createGroup(
        { username: GroupTwoUsername, fullName: GroupTwoFullName });
  });

  it("... adds Michael", () => {
    owensBrowser.userProfilePage.groupMembers.addOneMember(michael.username);
  });


  // ------- Prepaare categories

  it("Owen goes to the categories page", () => {
    owensBrowser.forumCategoryList.goHere();
  });

  it("... starts creating a category, Cat One", () => {
    owensBrowser.forumButtons.clickCreateCategory();
    owensBrowser.categoryDialog.fillInFields({ name: CatOneName });
  });

  it("... makes it visible only for Group One members", () => {
    owensBrowser.categoryDialog.openSecurityTab();
    owensBrowser.categoryDialog.securityTab.switchGroupFromTo(c.EveryoneFullName, GroupOneFullName);
  });

  it("... saves this new cateory", () => {
    owensBrowser.categoryDialog.submit();
  });

  it("Owen starts creating Category Two", () => {
    owensBrowser.forumButtons.clickCreateCategory();
    owensBrowser.categoryDialog.fillInFields({ name: CatTwoName });
  });

  it("... makes it visible only for Group Two members", () => {
    owensBrowser.categoryDialog.openSecurityTab();
    owensBrowser.categoryDialog.securityTab.switchGroupFromTo(c.EveryoneFullName, GroupTwoFullName);
  });

  it("... saves this new cateory", () => {
    owensBrowser.categoryDialog.submit();
  });


  // ------- Prepare topics

  it("Owen opens the new Cat One category", () => {
    owensBrowser.forumCategoryList.openCategory(CatOneName);
  });

  it("... posts a topic", () => {
    owensBrowser.complex.createAndSaveTopic(CatOneTopic);
    catOneTopicUrl = owensBrowser.url().value;
  });

  it("Owen goes back to the categories", () => {
    owensBrowser.topbar.clickHome();
  });

  it("... switches to Cat Two", () => {
    owensBrowser.forumTopicList.switchToCategory(CatTwoName);
  });

  it("... posts a topic in Cat Two", () => {
    owensBrowser.complex.createAndSaveTopic(CatTwoTopic);
    catTwoTopicUrl = owensBrowser.url().value;
  });

  it("... switches to a public category", () => {
    owensBrowser.topbar.clickHome();
    owensBrowser.forumTopicList.switchToCategory(forum.categories.categoryA.name);
  });

  it("... posts a public topic", () => {
    owensBrowser.complex.createAndSaveTopic(PublicTopic);
    publiTopicUrl = owensBrowser.url().value;
  });


  // ------- A non-group member gets Similar Topics suggestions

  it("Maria logs in", () => {
    mariasBrowser.go(siteIdAddress.origin);
    mariasBrowser.complex.loginWithPasswordViaTopbar(maria);
  });

  it("Starts writing a new topic", () => {
    mariasBrowser.forumButtons.clickCreateTopic();
  });

  it("... sets the title to a text that occurs in all 3 topics", () => {
    mariasBrowser.editor.editTitle("How do I " + SharedText);
  });

  it("... stops typing", () => {
    //server.playTimeSeconds(5);
  });

  it("Similar topics suggestions appear", () => {
    mariasBrowser.editor.waitForSimilarTopics();
  });

  it("... namely the public topic", () => {
    assert(mariasBrowser.editor.isSimilarTopicTitlePresent(PublicTopic.title));
  });

  it("... but nothing more — none of the private topics; Maja may not see them", () => {
    assert.equal(mariasBrowser.editor.numSimilarTopics(), 1);
  });


  // ------- The non-group member cannot see or access private custom group topics

  it("Maria visits a private topic's URL directly (Michael told her the URL)", () => {
    mariasBrowser.go(catTwoTopicUrl);
  });

  it("... gets a permission error", () => {
    mariasBrowser.assertNotFoundError();
  });

  it("Maria clicks a not-found page link back to the homepage  TyT406AK24", () => {
    mariasBrowser.waitAndClick('.s_LD_NotFound_HomeL');
  });

  it("Maria looks at the topic list", () => {
    mariasBrowser.forumTopicList.waitForTopics();
  });

  it("... sees the public topic", () => {
    majasBrowser.forumTopicList.assertTopicVisible(PublicTopic.title);
  });

  it("... nothing else", () => {
    majasBrowser.forumTopicList.assertNumVisible(1);
  });


  // ------- The 2nd group member gets Similar Topics suggestions, sees a private topic

  it("Michael logs in (Maja leaves)", () => {
    majasBrowser.topbar.clickLogout();
    michaelsBrowser.complex.loginWithPasswordViaTopbar(michael);
  });

  it("Michael starts writing a new topic", () => {
    michaelsBrowser.forumButtons.clickCreateTopic();
  });

  it("... he too types a title with a text that occurs in all 3 topics", () => {
    michaelsBrowser.editor.editTitle("How does one " + SharedText);
  });

  it("... stops typing", () => {
    //server.playTimeSeconds(5);
  });

  it("Similar topics suggestions appear", () => {
    michaelsBrowser.editor.waitForSimilarTopics();
  });

  it("... with the public topic", () => {
    assert(michaelsBrowser.editor.isSimilarTopicTitlePresent(PublicTopic.title));
  });

  it("... and the private topic in Category Two", () => {
    assert(michaelsBrowser.editor.isSimilarTopicTitlePresent(CatTwoTopic.title));
  });

  it("... but nothing more — not the Category One topic; Michael may not see it", () => {
    assert.equal(michaelsBrowser.editor.numSimilarTopics(), 2);
  });


  // ------- The group member can access private custom group topics

  // In hens group only.

  it("Michael clicks the Category Two private topic link", () => {
    michaelsBrowser.waitForThenClickText('.s_E_SimlTpcs_L_It a', CatTwoTopic.title);
  });

  it("... a 2nd tab opens, michael continues there", () => {
    assert.equal(michaelsBrowser.numBrowserTabs(), 2);
    michaelsBrowser.swithToOtherTabOrWindow();
  });

  it("... he's on the Cat Two topic page's url", () => {
    assert.equal(michaelsBrowser.url().value, catTwoTopicUrl);
  });

  it("... works fine, he may see it", () => {
    michaelsBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, CatTwoTopic.body);
  });

  it("... also after refresh", () => {
    michaelsBrowser.refresh();
    michaelsBrowser.topic.waitForPostAssertTextMatches(c.BodyNr, CatTwoTopic.body);
  });

  it("Michael visits the Category One private topic's URL directly", () => {
    michaelsBrowser.go(catOneTopicUrl);
  });

  it("... gets a permission error", () => {
    michaelsBrowser.assertNotFoundError();
  });

  it("Michael looks at the topic list", () => {
    michaelsBrowser.go('/');
    michaelsBrowser.forumTopicList.waitForTopics();
  });

  it("... and sees the public topic", () => {
    michaelsBrowser.forumTopicList.assertTopicVisible(PublicTopic.title);
  });

  it("... and the Category Two private topic", () => {
    michaelsBrowser.forumTopicList.assertTopicVisible(CatTwoTopic.title);
  });

  it("... nothing else (not the Category One private topic)", () => {
    michaelsBrowser.forumTopicList.assertNumVisible(2);
  });

  it("Michael returns to the first tab", () => {
    michaelsBrowser.close();
    michaelsBrowser.swithToOtherTabOrWindow();
  });


  // ------- The first group member instead sees Category One things

  it("Maja logs in (Michael leaves)", () => {
    michaelsBrowser.topbar.clickLogout();
    majasBrowser.complex.loginWithPasswordViaTopbar(maja);
  });

  it("Maja starts writing a new topic", () => {
    majasBrowser.forumButtons.clickCreateTopic();
  });

  let majasTitle = "How does one " + SharedText;

  it("... surprisingly, she types a title with a word from all 3 topics", () => {
    majasBrowser.editor.editTitle(majasTitle);
  });

  it("... stops typing", () => {
    //server.playTimeSeconds(5);
  });

  it("Similar topics suggestions appear", () => {
    majasBrowser.editor.waitForSimilarTopics();
  });

  it("... with the public topic", () => {
    assert(majasBrowser.editor.isSimilarTopicTitlePresent(PublicTopic.title));
  });

  it("... and the private topic in Category One (not Two)", () => {
    assert(majasBrowser.editor.isSimilarTopicTitlePresent(CatOneTopic.title));
  });

  it("... but nothing more — not the Category Two topic; Maja may not see it", () => {
    assert.equal(majasBrowser.editor.numSimilarTopics(), 2);
  });


  // ------- The Similar Topics search button

  it("Maja clicks Search in the Similar Topics dialog", () => {
    majasBrowser.waitAndClick('.s_E_SimlTpcs_SearchB');
  });

  it("... a new tab opens", () => {
    assert.equal(majasBrowser.numBrowserTabs(), 2);
    majasBrowser.swithToOtherTabOrWindow();
  });

  it("... it's the search page", () => {
    majasBrowser.searchResultsPage.waitForSearchInputField();
  });

  it("... here, the title she typed, and the two similar topics, appear", () => {
    majasBrowser.searchResultsPage.waitForAssertNumPagesFound(majasTitle, 2);
  });

  it("... namely the public topic", () => {
    majasBrowser.searchResultsPage.assertResultPageTitlePresent(PublicTopic.title);
  });

  it("... and the Category One private topic", () => {
    majasBrowser.searchResultsPage.assertResultPageTitlePresent(CatOneTopic.title);
  });

});

