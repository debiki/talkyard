/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let brC: TyE2eTestBrowser;

let owen;
let mons;
let maria;

let idAddress;
const WastelandCategoryName = 'Wasteland';
const WastelandCategoryNameOnlyStaffCreate = 'Wasteland Only Staff Create';
const WastelandCategoryNameStaffOnly = "Wasteland Staff Only";
const WastelandCategorySelector = 'a*=Wasteland';
const DefaultCategorySelector = 'a*=Uncategorized';


describe(`categories-basic.3br.d   TyTCATSBASIC`, () => {

  it("initialize people", async () => {
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    brC = new TyE2eTestBrowser(wdioBrowserC, 'brC');
    owen = _.assign(brA, make.memberOwenOwner());
    mons = _.assign(brB, make.memberModeratorMons());
    maria = _.assign(brC, make.memberMaria());
  });

  it("import a site", async () => {
    const site: SiteData = make.forumOwnedByOwen('categories');
    site.members.push(make.memberModeratorMons());
    site.members.push(make.memberMaria());
    idAddress = await server.importSiteData(site);
  });

  it("Owen logs in, views categories", async () => {
    await owen.go2(idAddress.origin);
    await owen.topbar.clickLogin();
    await owen.loginDialog.loginWithPassword(owen);
    await owen.forumButtons.clickViewCategories();
    await owen.waitForAtLeast(1, '.esForum_cats_cat .forum-title');
    await owen.assertTextMatches('.esForum_cats_cat .forum-title', [/Uncategorized/, /default/]);
  });

  it("Owen creates a category", async () => {
    await owen.forumButtons.clickCreateCategory();
    await owen.categoryDialog.fillInFields({ name: "Wasteland" });
    await owen.categoryDialog.submit();
  });

  it("Maria logs in, sees the new category", async () => {
    await maria.go2(idAddress.origin + '/categories');
    await maria.forumCategoryList.openCategory(WastelandCategoryName);
    await maria.topbar.clickLogin();
    await maria.loginDialog.loginWithPassword(maria);
    await maria.assertTextMatches('.s_F_Ts_Cat_Ttl', /Wasteland/);
  });

  var mariasFirstTopicTitle = "Marias topic";
  var mariasFirstTopicText = "Marias text text text.";

  it("Maria creates a topic, in the new category", async () => {
    await maria.forumButtons.clickCreateTopic();
    await maria.editor.editTitle(mariasFirstTopicTitle);
    await maria.editor.editText(mariasFirstTopicText);
    await maria.rememberCurrentUrl();
    await maria.editor.save();
    await maria.waitForNewUrl();
    // Ensure ancestor Wasteland visible.
    await maria.assertPageTitleMatches(mariasFirstTopicTitle);
    await maria.assertPageBodyMatches(mariasFirstTopicText);
  });

  it("Owen sees Marias' topic", async () => {
    await owen.refresh2();
    await owen.forumCategoryList.openCategory(WastelandCategoryName);
    await owen.forumTopicList.waitForTopicVisible(mariasFirstTopicTitle);
    await owen.forumTopicList.assertTopicNrVisible(1, mariasFirstTopicTitle);
  });

  it("Owen starts editing the category", async () => {
    await owen.forumButtons.clickEditCategory();
  });

  it("... renames it", async () => {
    await owen.categoryDialog.fillInFields({ name: "Wasteland Unlisted" });
  });

  it("... and unlists it", async () => {
    await owen.categoryDialog.setCategoryUnlisted();
  });

  it("... saves the changes", async () => {
    await owen.categoryDialog.submit();
  });

  it("... now he sees the category title got updated", async () => {
    await owen.assertTextMatches('.s_F_Ts_Cat_Ttl', /Wasteland Unlisted/);
  });

  it("... and the category column in the topic list too", async () => {
    await owen.assertNthTextMatches('.e2eF_T', 1, /Wasteland Unlisted/);
  });

  it(`Mons arrives`, async () => {
    await mons.go2(idAddress.origin + '/categories');
  });
  it(`... sees the page`, async () => {
    await mons.waitForVisible(DefaultCategorySelector);
  });
  it(`... but not the category — he hasn't logged in`, async () => {
    assert.not(await mons.isVisible(WastelandCategorySelector));
  });

  it("Mons logs in", async () => {
    await mons.topbar.clickLogin();
    await mons.loginDialog.loginWithPassword(mons);
  });

  it("... sees the unlisted Wasteland category because he's a moderator", async () => {
    await mons.waitForVisible(DefaultCategorySelector);
    await mons.waitForMyDataAdded();
    assert.that(await mons.isVisible(WastelandCategorySelector));  // cmp w (27KAK6) below
  });

  var urlToMonsPage;
  var urlToMonsPage2;
  var urlToMonsPage3;

  it("Mons goes to the Wasteland category", async () => {
    await mons.forumCategoryList.openCategory(WastelandCategoryName);
  });

  it("... he can create a new topic in Wasteland", async () => {
    await mons.complex.createAndSaveTopic({ title: "Mons Topic", body: "Mons text text text." });
    urlToMonsPage = await mons.getUrl();
  });

  it("Maria no longer sees Wasteland, but can access pages in the category", async () => {
    await maria.go2(idAddress.origin + '/categories');
    await maria.waitForVisible(DefaultCategorySelector);
    await maria.waitForMyDataAdded();
    assert.not(await maria.isVisible(WastelandCategorySelector));  // cmp w (27KAK6) above
  });

  it("Maria can access pages in the category via direct links though", async () => {
    await maria.go2(urlToMonsPage);
    await maria.assertPageTitleMatches(/Mons Topic/);
    await maria.assertPageBodyMatches(/Mons text text text/);
  });

  it("Owen re-lists the category, sets only-staff-may-post", async () => {
    await owen.go2(idAddress.origin + '/latest/wasteland');
    await owen.forumButtons.clickEditCategory();
    await owen.categoryDialog.fillInFields({ name: WastelandCategoryNameOnlyStaffCreate });
    await owen.categoryDialog.setNotUnlisted();
    await owen.categoryDialog.openSecurityTab();
    await owen.categoryDialog.securityTab.setMayCreate(c.EveryoneId, false);
    await owen.categoryDialog.submit();
  });

  it("The category title changes", async () => {
    await owen.assertTextMatches('.s_F_Ts_Cat_Ttl', /Wasteland Only Staff Create/);
  });

  it("And the category links in the topic list", async () => {
    await owen.assertNthTextMatches('.e2eF_T', 1, /Wasteland Only Staff Create/);
    await owen.assertNthTextMatches('.e2eF_T', 2, /Wasteland Only Staff Create/);
  });

  it("Mons can post a new topic", async () => {
    await mons.go2(idAddress.origin + '/latest/wasteland');
    await mons.disableRateLimits(); // otherwise max 1 topic per 15 seconds
    await mons.complex.createAndSaveTopic({
      title: "Mons Only Staff Create Topic",
      body: "Mons Only Staff Create text text text.",
    });
    urlToMonsPage2 = await mons.getUrl();
  });

  it("Maria sees the category and the topic", async () => {
    await maria.go2(idAddress.origin + '/categories');
    await maria.waitForVisible(DefaultCategorySelector);
    assert.that(await maria.isVisible(WastelandCategorySelector));
    // She sees Mons' most recent topic in the per category recent topics list.
    await maria.assertNthTextMatches('.topic-title', 1, /Mons Only Staff Create Topic/);
  });

  it("... but cannot create new topics", async () => {
    await maria.forumCategoryList.openCategory(WastelandCategoryNameOnlyStaffCreate);
    await maria.forumButtons.assertNoCreateTopicButton();
  });

  it ("... she can open the topic", async () => {
    await maria.go2(urlToMonsPage2);
    await maria.assertPageTitleMatches("Mons Only Staff Create Topic");
  });

  it("Owen sets the category to staff only", async () => {
    await owen.go2(idAddress.origin + '/latest/wasteland');
    await owen.forumButtons.clickEditCategory();
    await owen.categoryDialog.fillInFields({ name: WastelandCategoryNameStaffOnly });
    await owen.categoryDialog.openSecurityTab();
    await owen.categoryDialog.securityTab.setMayReply(c.EveryoneId, false);
    await owen.categoryDialog.securityTab.setMaySee(c.EveryoneId, false);
    await owen.categoryDialog.submit();
  });

  it("The category title changes", async () => {
    await owen.assertTextMatches('.s_F_Ts_Cat_Ttl', WastelandCategoryNameStaffOnly);
  });

  it("And the category links in the topic list", async () => {
    await owen.assertNthTextMatches('.e2eF_T', 1, /Wasteland Staff Only/);
    await owen.assertNthTextMatches('.e2eF_T', 2, /Wasteland Staff Only/);
    await owen.assertNthTextMatches('.e2eF_T', 3, /Wasteland Staff Only/);
  });

  it("Mons sees it and can create a 2nd topic", async () => {
    await mons.go2(idAddress.origin + '/categories');
    await mons.waitForVisible(DefaultCategorySelector);
    await mons.waitForMyDataAdded();
    assert.that(await mons.isVisible(WastelandCategorySelector));   // cmp w (410RKE5) below
    await mons.forumCategoryList.openCategory(WastelandCategoryNameStaffOnly);
    await mons.complex.createAndSaveTopic({ title: "Mons Topic", body: "Mons text text text." });
    urlToMonsPage3 = await mons.getUrl();
  });

  it("Maria doesn't see the category", async () => {
    await maria.go2(idAddress.origin + '/categories');
    await maria.waitForVisible(DefaultCategorySelector);
    await maria.waitForMyDataAdded();
    assert.not(await maria.isVisible(WastelandCategorySelector));   // cmp w (410RKE5) above
  });

  it("... and cannot access pages in it", async () => {
    await maria.go2(urlToMonsPage);
    await maria.assertNotFoundError();
    await maria.go2(urlToMonsPage3);
    await maria.assertNotFoundError();
  });

  // Owen deletes the category? How prevent mod Mons from seeing the stuff therein?
  // Two levels of delete? One for normal members, but visible to staff? One that leaves
  // the deleted page visible to admins only?

});

