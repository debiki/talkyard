/// <reference path="../test-types.ts"/>
/// <reference path="../../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../../modules/definitely-typed/mocha/mocha.d.ts"/>

import * as _ from 'lodash';
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import assert = require('assert');
import logAndDie = require('../utils/log-and-die');

declare var browser: any;
declare var browserA: any;
declare var browserB: any;
declare var browserC: any;

var everyone;
var owen;
var owensPages;
var mons;
var monsPages;
var maria;
var mariasPages;

var idAddress;
var WastelandCategorySelector = 'a*=Wasteland';
var DefaultCategorySelector = 'a*=Uncategorized';


describe("categories", function() {

  it("initialize people", function() {
    everyone = browser;
    owen = browserA;
    owensPages = pagesFor(owen);
    mons = browserB;
    monsPages = pagesFor(mons);
    maria = browserC;
    mariasPages = pagesFor(maria);
  });

  it("import a site", function() {
    var site: SiteData = make.forumOwnedByOwen('categories');
    site.members.push(make.memberModeratorMons());
    site.members.push(make.memberMaria());
    idAddress = server.importSiteData(site);
  });

  it("Owen logs in, views categories", function() {
    owen.go(idAddress.siteIdOrigin);
    owensPages.topbar.clickLogin();
    owensPages.loginDialog.loginWithPassword({ username: 'owen_owner', password: 'publicOwen' });
    owensPages.forumButtons.clickViewCategories();
    owen.waitForAtLeast(1, '.esForum_cats_cat .forum-title');
    owen.assertTextMatches('.esForum_cats_cat .forum-title', /Uncategorized/, /default/);
  });

  it("Owen ceates a category", function() {
    owensPages.forumButtons.clickCreateCategory();
    owensPages.categoryDialog.fillInFields({ name: "Wasteland" });
    owensPages.categoryDialog.submit();
  });

  it("Maria logs in, sees the new category", function() {
    maria.go(idAddress.siteIdOrigin + '/categories');
    maria.clickLinkToNewPage(WastelandCategorySelector);
    mariasPages.topbar.clickLogin();
    mariasPages.loginDialog.loginWithPassword({ username: 'maria', password: 'publicMaria' });
    maria.assertTextMatches('.esForum_topics_topic', /About/, /Wasteland/);
  });

  var mariasFirstTopicTitle = "Marias topic";
  var mariasFirstTopicText = "Marias text text text.";

  it("Maria creates a topic, in the new category", function() {
    mariasPages.forumButtons.clickCreateTopic();
    mariasPages.editor.editTitle(mariasFirstTopicTitle);
    mariasPages.editor.editText(mariasFirstTopicText);
    maria.rememberCurrentUrl();
    mariasPages.editor.save();
    maria.waitForNewUrl();
    // ensure ancestor Wasteland visible
    maria.assertTextMatches('.dw-p-ttl', mariasFirstTopicTitle);
    maria.assertTextMatches('.esOrigPost', mariasFirstTopicText);
  });

  it("Owen sees Marias' topic", function() {
    owen.clickLinkToNewPage(WastelandCategorySelector);
    owen.assertNthTextMatches('.dw-tpc-title', 2, mariasFirstTopicTitle);
  });

  it("Owen renames and unlists the category", function() {
    owensPages.forumButtons.clickEditCategory();
    owensPages.categoryDialog.fillInFields({ name: "Wasteland Unlisted" });
    owen.waitAndClick('#e2eShowUnlistedCB');
    owen.waitAndClick('#e2eUnlistedCB');
    owensPages.categoryDialog.submit();
    owen.assertNthTextMatches('.esForum_topics_topic', 1, /Wasteland Unlisted/);
    owen.assertNthTextMatches('.esForum_topics_topic', 2, /Wasteland Unlisted/);
  });

  it("Mons doesn't sees it, he hasn't logged in", function() {
    mons.go(idAddress.siteIdOrigin + '/categories');
    mons.waitForVisible(DefaultCategorySelector);
    assert(!mons.isVisible(WastelandCategorySelector));
  });

  it("Mons logs in, sees the unlisted Wasteland category because he's a moderator", function() {
    monsPages.topbar.clickLogin();
    monsPages.loginDialog.loginWithPassword({ username: 'mod_mons', password: 'publicMons' });
    mons.waitForVisible(WastelandCategorySelector);
  });

  var urlToMonsPage;
  var urlToMonsPage2;
  var urlToMonsPage3;

  it("Mons can create a Wasteland topic", function() {
    mons.clickLinkToNewPage(WastelandCategorySelector);
    monsPages.complex.createAndSaveTopic({ title: "Mons Topic", body: "Mons text text text." });
    urlToMonsPage = mons.url().value;
  });

  it("Maria no longer sees it, but can access pages in the category", function() {
    maria.go(idAddress.siteIdOrigin + '/categories');
    maria.waitForVisible(DefaultCategorySelector);
    assert(!maria.isVisible(WastelandCategorySelector));
  });

  it("Maria can access pages in the category via direct links though", function() {
    maria.go(urlToMonsPage);
    maria.assertPageTitleMatches(/Mons Topic/);
    maria.assertPageBodyMatches(/Mons text text text/);
  });

  it("Owen re-lists the category, sets only-staff-may-post", function() {
    owen.go(idAddress.siteIdOrigin + '/latest/wasteland');
    owensPages.forumButtons.clickEditCategory();
    owensPages.categoryDialog.fillInFields({ name: "Wasteland Only Staff Create" });
    owen.waitAndClick('#e2eShowUnlistedCB');
    owen.waitAndClick('#e2eUnlistedCB');
    owen.waitAndClick('#e2eShowOnlyStaffCreateCB');
    owen.waitAndClick('#e2eOnlyStaffCreateCB');
    owensPages.categoryDialog.submit();
    owen.assertNthTextMatches('.esForum_topics_topic', 1, /Wasteland Only Staff Create/);
    owen.assertNthTextMatches('.esForum_topics_topic', 2, /Wasteland Only Staff Create/);
  });

  it("Mons can post a new topic", function() {
    mons.go(idAddress.siteIdOrigin + '/latest/wasteland');
    mons.pause(15*1000); // rate limits: max 1 topic per 15 seconds [7KEF02]
    monsPages.complex.createAndSaveTopic({
      title: "Mons Only Staff Create Topic",
      body: "Mons Only Staff Create text text text.",
    });
    urlToMonsPage2 = mons.url().value;
  });

  it("Maria sees the category and the topic", function() {
    maria.go(idAddress.siteIdOrigin + '/categories');
    maria.waitForVisible(DefaultCategorySelector);
    assert(maria.isVisible(WastelandCategorySelector));
    // She sees Mons' most recent topic in the per category recent topics list.
    maria.assertNthTextMatches('.topic-title', 1, /Mons Only Staff Create Topic/);
  });

  it("... but cannot create new topics", function() {
    maria.waitAndClick(WastelandCategorySelector);
    mariasPages.forumButtons.assertNoCreateTopicButton();
  });

  it ("... she can open the topic", function() {
    maria.go(urlToMonsPage2);
    maria.assertPageTitleMatches("Mons Only Staff Create Topic");
  });

  it("Owen sets the category to staff only", function() {
    owen.go(idAddress.siteIdOrigin + '/latest/wasteland');
    owensPages.forumButtons.clickEditCategory();
    owensPages.categoryDialog.fillInFields({ name: "Wasteland Staff Only" });
    owen.waitAndClick('#e2eShowStaffOnlyCB');
    owen.waitAndClick('#e2eStaffOnlyCB');
    owensPages.categoryDialog.submit();
    owen.assertNthTextMatches('.esForum_topics_topic', 1, /Wasteland Staff Only/);
    owen.assertNthTextMatches('.esForum_topics_topic', 2, /Wasteland Staff Only/);
    owen.assertNthTextMatches('.esForum_topics_topic', 3, /Wasteland Staff Only/);
  });

  it("Mons sees it and can create a 2nd topic", function() {
    mons.go(idAddress.siteIdOrigin + '/categories');
    mons.pause(15*1000); // rate limits: max 1 topic per 15 seconds [7KEF02]
    mons.clickLinkToNewPage(WastelandCategorySelector);
    monsPages.complex.createAndSaveTopic({ title: "Mons Topic", body: "Mons text text text." });
    urlToMonsPage3 = mons.url().value;
  });

  it("Maria doesn't see the category", function() {
    maria.go(idAddress.siteIdOrigin + '/categories');
    maria.waitForVisible(DefaultCategorySelector);
    assert(!maria.isVisible(WastelandCategorySelector));
  });

  it("... and cannot access pages in it", function() {
    maria.go(urlToMonsPage);
    maria.assertNotFoundError();
    maria.go(urlToMonsPage3);
    maria.assertNotFoundError();
  });

  // Owen deletes the category? How prevent mod Mons from seeing the stuff therein?
  // Two levels of delete? One for normal members, but visible to staff? One that leaves
  // the deleted page visible to admins only?

  it("Done", function() {
    everyone.perhapsDebug();
  });

});

