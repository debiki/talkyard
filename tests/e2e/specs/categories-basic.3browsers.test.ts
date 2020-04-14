/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');






let everyone;
let owen;
let mons;
let maria;

let idAddress;
const WastelandCategoryName = 'Wasteland';
const WastelandCategoryNameOnlyStaffCreate = 'Wasteland Only Staff Create';
const WastelandCategoryNameStaffOnly = "Wasteland Staff Only";
const WastelandCategorySelector = 'a*=Wasteland';
const DefaultCategorySelector = 'a*=Uncategorized';


describe("categories", function() {

  it("initialize people", function() {
    everyone = browser;
    owen = _.assign(new TyE2eTestBrowser(browserA), make.memberOwenOwner());
    mons = _.assign(new TyE2eTestBrowser(browserB), make.memberModeratorMons());
    maria = _.assign(new TyE2eTestBrowser(browserC), make.memberMaria());
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
    maria.forumCategoryList.openCategory(WastelandCategoryName);
    maria.topbar.clickLogin();
    maria.loginDialog.loginWithPassword(maria);
    maria.assertTextMatches('.s_F_Ts_Cat_Ttl', /Wasteland/);
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
    // Ensure ancestor Wasteland visible.
    maria.assertPageTitleMatches(mariasFirstTopicTitle);
    maria.assertPageBodyMatches(mariasFirstTopicText);
  });

  it("Owen sees Marias' topic", function() {
    owen.refresh();
    owen.forumCategoryList.openCategory(WastelandCategoryName);
    owen.forumTopicList.waitForTopicVisible(mariasFirstTopicTitle);
    owen.forumTopicList.assertTopicNrVisible(1, mariasFirstTopicTitle);
  });

  it("Owen starts editing the category", function() {
    owen.forumButtons.clickEditCategory();
  });

  it("... renames it", function() {
    owen.categoryDialog.fillInFields({ name: "Wasteland Unlisted" });
  });

  it("... and unlists it", function() {
    owen.categoryDialog.setCategoryUnlisted();
  });

  it("... saves the changes", function() {
    owen.categoryDialog.submit();
  });

  it("... now he sees the category title got updated", function() {
    owen.assertTextMatches('.s_F_Ts_Cat_Ttl', /Wasteland Unlisted/);
  });

  it("... and the category column in the topic list too", function() {
    owen.assertNthTextMatches('.e2eF_T', 1, /Wasteland Unlisted/);
  });

  it("Mons doesn't sees it, he hasn't logged in", function() {
    mons.go(idAddress.origin + '/categories');
    mons.waitForVisible(DefaultCategorySelector);
    assert(!mons.isVisible(WastelandCategorySelector));
  });

  it("Mons logs in", () => {
    mons.topbar.clickLogin();
    mons.loginDialog.loginWithPassword(mons);
  });

  it("... sees the unlisted Wasteland category because he's a moderator", () => {
    mons.waitForVisible(DefaultCategorySelector);
    mons.waitForMyDataAdded();
    assert(mons.isVisible(WastelandCategorySelector));  // cmp w (27KAK6) below
  });

  var urlToMonsPage;
  var urlToMonsPage2;
  var urlToMonsPage3;

  it("Mons goes to the Wasteland category", function() {
    mons.forumCategoryList.openCategory(WastelandCategoryName);
  });

  it("... he can create a new topic in Wasteland", function() {
    mons.complex.createAndSaveTopic({ title: "Mons Topic", body: "Mons text text text." });
    urlToMonsPage = mons.getUrl();
  });

  it("Maria no longer sees Wasteland, but can access pages in the category", function() {
    maria.go(idAddress.origin + '/categories');
    maria.waitForVisible(DefaultCategorySelector);
    maria.waitForMyDataAdded();
    assert(!maria.isVisible(WastelandCategorySelector));  // cmp w (27KAK6) above
  });

  it("Maria can access pages in the category via direct links though", function() {
    maria.go(urlToMonsPage);
    maria.assertPageTitleMatches(/Mons Topic/);
    maria.assertPageBodyMatches(/Mons text text text/);
  });

  it("Owen re-lists the category, sets only-staff-may-post", function() {
    owen.go(idAddress.origin + '/latest/wasteland');
    owen.forumButtons.clickEditCategory();
    owen.categoryDialog.fillInFields({ name: WastelandCategoryNameOnlyStaffCreate });
    owen.categoryDialog.setNotUnlisted();
    owen.categoryDialog.openSecurityTab();
    owen.categoryDialog.securityTab.setMayCreate(c.EveryoneId, false);
    owen.categoryDialog.submit();
  });

  it("The category title changes", function() {
    owen.assertTextMatches('.s_F_Ts_Cat_Ttl', /Wasteland Only Staff Create/);
  });

  it("And the category links in the topic list", function() {
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
    urlToMonsPage2 = mons.getUrl();
  });

  it("Maria sees the category and the topic", function() {
    maria.go(idAddress.origin + '/categories');
    maria.waitForVisible(DefaultCategorySelector);
    assert(maria.isVisible(WastelandCategorySelector));
    // She sees Mons' most recent topic in the per category recent topics list.
    maria.assertNthTextMatches('.topic-title', 1, /Mons Only Staff Create Topic/);
  });

  it("... but cannot create new topics", function() {
    maria.forumCategoryList.openCategory(WastelandCategoryNameOnlyStaffCreate);
    maria.forumButtons.assertNoCreateTopicButton();
  });

  it ("... she can open the topic", function() {
    maria.go(urlToMonsPage2);
    maria.assertPageTitleMatches("Mons Only Staff Create Topic");
  });

  it("Owen sets the category to staff only", function() {
    owen.go(idAddress.origin + '/latest/wasteland');
    owen.forumButtons.clickEditCategory();
    owen.categoryDialog.fillInFields({ name: WastelandCategoryNameStaffOnly });
    owen.categoryDialog.openSecurityTab();
    owen.categoryDialog.securityTab.setMayReply(c.EveryoneId, false);
    owen.categoryDialog.securityTab.setMaySee(c.EveryoneId, false);
    owen.categoryDialog.submit();
  });

  it("The category title changes", function() {
    owen.assertTextMatches('.s_F_Ts_Cat_Ttl', WastelandCategoryNameStaffOnly);
  });

  it("And the category links in the topic list", function() {
    owen.assertNthTextMatches('.e2eF_T', 1, /Wasteland Staff Only/);
    owen.assertNthTextMatches('.e2eF_T', 2, /Wasteland Staff Only/);
    owen.assertNthTextMatches('.e2eF_T', 3, /Wasteland Staff Only/);
  });

  it("Mons sees it and can create a 2nd topic", function() {
    mons.go(idAddress.origin + '/categories');
    mons.waitForVisible(DefaultCategorySelector);
    mons.waitForMyDataAdded();
    assert(mons.isVisible(WastelandCategorySelector));   // cmp w (410RKE5) below
    mons.forumCategoryList.openCategory(WastelandCategoryNameStaffOnly);
    mons.complex.createAndSaveTopic({ title: "Mons Topic", body: "Mons text text text." });
    urlToMonsPage3 = mons.getUrl();
  });

  it("Maria doesn't see the category", function() {
    maria.go(idAddress.origin + '/categories');
    maria.waitForVisible(DefaultCategorySelector);
    maria.waitForMyDataAdded();
    assert(!maria.isVisible(WastelandCategorySelector));   // cmp w (410RKE5) above
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

});

