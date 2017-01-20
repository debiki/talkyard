/// <reference path="../test-types.ts"/>
/// <reference path="../../../modules/definitely-typed/lodash/lodash.d.ts"/>
/// <reference path="../../../modules/definitely-typed/mocha/mocha.d.ts"/>

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
var mons;
var maria;

var idAddress;
var WastelandCategorySelector = 'a*=Wasteland';
var DefaultCategorySelector = 'a*=Uncategorized';


describe("categories", function() {

  it("initialize people", function() {
    browser.perhapsDebugBefore();
    everyone = browser;
    owen = _.assign(browserA, pagesFor(browserA), make.memberOwenOwner());
    mons = _.assign(browserB, pagesFor(browserB), make.memberModeratorMons());
    maria = _.assign(browserC, pagesFor(browserC), make.memberMaria());
  });

  it("import a site", function() {
    var site: SiteData = make.forumOwnedByOwen('categories');
    site.members.push(make.memberModeratorMons());
    site.members.push(make.memberMaria());
    idAddress = server.importSiteData(site);
  });

  it("Owen logs in, views categories", function() {
    owen.go(idAddress.origin);
    owen.topbar.clickLogin();
    owen.loginDialog.loginWithPassword(owen);
    owen.forumButtons.clickViewCategories();
    owen.waitForAtLeast(1, '.esForum_cats_cat .forum-title');
    owen.assertTextMatches('.esForum_cats_cat .forum-title', /Uncategorized/, /default/);
  });

  it("Owen creates a category", function() {
    owen.forumButtons.clickCreateCategory();
    owen.categoryDialog.fillInFields({ name: "Wasteland" });
    owen.categoryDialog.submit();
  });

  it("Maria logs in, sees the new category", function() {
    maria.go(idAddress.origin + '/categories');
    maria.clickLinkToNewPage(WastelandCategorySelector);
    maria.topbar.clickLogin();
    maria.loginDialog.loginWithPassword(maria);
    maria.assertTextMatches('.e2eF_T', /About/, /Wasteland/);
  });

  var mariasFirstTopicTitle = "Marias topic";
  var mariasFirstTopicText = "Marias text text text.";

  it("Maria creates a topic, in the new category", function() {
    maria.forumButtons.clickCreateTopic();
    maria.editor.editTitle(mariasFirstTopicTitle);
    maria.editor.editText(mariasFirstTopicText);
    maria.rememberCurrentUrl();
    maria.editor.save();
    maria.waitForNewUrl();
    // ensure ancestor Wasteland visible
    maria.assertPageTitleMatches(mariasFirstTopicTitle);
    maria.assertPageBodyMatches(mariasFirstTopicText);
  });

  it("Owen sees Marias' topic", function() {
    owen.refresh();
    owen.clickLinkToNewPage(WastelandCategorySelector);
    owen.forumTopicList.assertTopicNrVisible(2, mariasFirstTopicTitle);
  });

  it("Owen renames and unlists the category", function() {
    owen.forumButtons.clickEditCategory();
    owen.categoryDialog.fillInFields({ name: "Wasteland Unlisted" });
    owen.waitAndClick('#e2eShowUnlistedCB');
    owen.waitAndClick('#e2eUnlistedCB');
    owen.categoryDialog.submit();
    owen.assertNthTextMatches('.e2eF_T', 1, /Wasteland Unlisted/);
    owen.assertNthTextMatches('.e2eF_T', 2, /Wasteland Unlisted/);
  });

  it("Mons doesn't sees it, he hasn't logged in", function() {
    mons.go(idAddress.origin + '/categories');
    mons.waitForVisible(DefaultCategorySelector);
    assert(!mons.isVisible(WastelandCategorySelector));
  });

  it("Mons logs in, sees the unlisted Wasteland category because he's a moderator", function() {
    mons.topbar.clickLogin();
    mons.loginDialog.loginWithPassword(mons);
    mons.waitForVisible(WastelandCategorySelector);
  });

  var urlToMonsPage;
  var urlToMonsPage2;
  var urlToMonsPage3;

  it("Mons can create a Wasteland topic", function() {
    mons.clickLinkToNewPage(WastelandCategorySelector);
    mons.complex.createAndSaveTopic({ title: "Mons Topic", body: "Mons text text text." });
    urlToMonsPage = mons.url().value;
  });

  it("Maria no longer sees it, but can access pages in the category", function() {
    maria.go(idAddress.origin + '/categories');
    maria.waitForVisible(DefaultCategorySelector);
    assert(!maria.isVisible(WastelandCategorySelector));
  });

  it("Maria can access pages in the category via direct links though", function() {
    maria.go(urlToMonsPage);
    maria.assertPageTitleMatches(/Mons Topic/);
    maria.assertPageBodyMatches(/Mons text text text/);
  });

  it("Owen re-lists the category, sets only-staff-may-post", function() {
    owen.go(idAddress.origin + '/latest/wasteland');
    owen.forumButtons.clickEditCategory();
    owen.categoryDialog.fillInFields({ name: "Wasteland Only Staff Create" });
    owen.waitAndClick('#e2eShowUnlistedCB');
    owen.waitAndClick('#e2eUnlistedCB');
    owen.waitAndClick('#e2eShowOnlyStaffCreateCB');
    owen.waitAndClick('#e2eOnlyStaffCreateCB');
    owen.categoryDialog.submit();
    owen.assertNthTextMatches('.e2eF_T', 1, /Wasteland Only Staff Create/);
    owen.assertNthTextMatches('.e2eF_T', 2, /Wasteland Only Staff Create/);
  });

  it("Mons can post a new topic", function() {
    mons.go(idAddress.origin + '/latest/wasteland');
    mons.disableRateLimits(); // otherwise max 1 topic per 15 seconds
    mons.complex.createAndSaveTopic({
      title: "Mons Only Staff Create Topic",
      body: "Mons Only Staff Create text text text.",
    });
    urlToMonsPage2 = mons.url().value;
  });

  it("Maria sees the category and the topic", function() {
    maria.go(idAddress.origin + '/categories');
    maria.waitForVisible(DefaultCategorySelector);
    assert(maria.isVisible(WastelandCategorySelector));
    // She sees Mons' most recent topic in the per category recent topics list.
    maria.assertNthTextMatches('.topic-title', 1, /Mons Only Staff Create Topic/);
  });

  it("... but cannot create new topics", function() {
    maria.waitAndClick(WastelandCategorySelector);
    maria.forumButtons.assertNoCreateTopicButton();
  });

  it ("... she can open the topic", function() {
    maria.go(urlToMonsPage2);
    maria.assertPageTitleMatches("Mons Only Staff Create Topic");
  });

  it("Owen sets the category to staff only", function() {
    owen.go(idAddress.origin + '/latest/wasteland');
    owen.forumButtons.clickEditCategory();
    owen.categoryDialog.fillInFields({ name: "Wasteland Staff Only" });
    owen.waitAndClick('#e2eShowStaffOnlyCB');
    owen.waitAndClick('#e2eStaffOnlyCB');
    owen.categoryDialog.submit();
    owen.assertNthTextMatches('.e2eF_T', 1, /Wasteland Staff Only/);
    owen.assertNthTextMatches('.e2eF_T', 2, /Wasteland Staff Only/);
    owen.assertNthTextMatches('.e2eF_T', 3, /Wasteland Staff Only/);
  });

  it("Mons sees it and can create a 2nd topic", function() {
    mons.go(idAddress.origin + '/categories');
    mons.clickLinkToNewPage(WastelandCategorySelector);
    mons.complex.createAndSaveTopic({ title: "Mons Topic", body: "Mons text text text." });
    urlToMonsPage3 = mons.url().value;
  });

  it("Maria doesn't see the category", function() {
    maria.go(idAddress.origin + '/categories');
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

