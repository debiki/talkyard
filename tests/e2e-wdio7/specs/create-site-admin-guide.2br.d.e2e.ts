/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import server from '../utils/server';
import * as utils from '../utils/utils';
import * as make from '../utils/make';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import { logMessage } from '../utils/log-and-die';

let owen;
let maria;

const forumTitle = "Adm Guide";
const editedForumTitle = "Adm Guide Edtd";
const testId = utils.generateTestId();
const newOrgName = "New Org Name";
const newIntroText = "Intro text text text.";
const newWelcomeTopicText = "New welcome topic text text text";
const newWelcomeTopicTitle = "New Welcome Title Title Title";
const newCategoryName = "Wasteland";
const newTopicTitle = "Total Desert";
const newTopicText = "No water here text text text";
let siteId: SiteId;
let siteUrl: string;

const mariasTopicTitle = "mariasTopicTitle";
const mariasTopicText = "mariasTopicText";


describe("create site, follow the admin guide  TyT62RJHLPK4", function() {

  it("initialize people", async () => {
    const brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    const brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    owen = _.assign(brA, make.memberOwenOwner());
    // Use an unique address so won't run into max-sites-per-email limit.
    owen.emailAddress = "e2e-test--owen-" + testId + "@example.com";
    maria = _.assign(brB, make.memberMaria());
  });

  it("Owen creates a site", async () => {
    const localHostname = utils.getLocalHostname('create-site-' + testId);
    logMessage(`Generated local hostname: ${localHostname}`);

    const newSiteData = {
      testId: testId,
      localHostname: localHostname,
      name: localHostname,
      origin: utils.makeSiteOrigin(localHostname),
      originRegexEscaped: utils.makeSiteOriginRegexEscaped(localHostname),
      orgName: "Owen's E2E Org",
      fullName: 'E2E Test ' + testId,
      email: owen.emailAddress,
    };
    await owen.go2(utils.makeCreateSiteWithFakeIpUrl());
    console.log("Fills in fields and submits");
    await owen.createSite.fillInFieldsAndSubmit(newSiteData);
    console.log("Clicks login");
    await owen.createSite.clickOwnerSignupButton();
    await owen.disableRateLimits();
    console.log("Creates password account");
    await owen.loginDialog.createPasswordAccount(owen);
    siteId = await owen.getSiteId();
    console.log("Gets a verification email");
    const link = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(siteId, owen.emailAddress);
    await owen.go2(link);
    console.log("Clicks continue");
    await owen.waitAndClick('#e2eContinue');
    console.log("Creates a forum");
    await owen.createSomething.createForum(forumTitle);
    siteUrl = await owen.getUrl();
  });

  it("Maria sees it", async () => {
    await maria.go2(siteUrl);
    await maria.assertPageTitleMatches(forumTitle);
    await maria.disableRateLimits();
  });

  it("Owen edits settings: requires people to login", async () => {
    await owen.topbar.clickGoToAdmin();
    await owen.complex.closeSidebars(); // otherwise might open later and bump setting positions
    await owen.adminArea.settings.legal.editOrgName(newOrgName);
    await owen.adminArea.settings.clickLoginNavLink();
    await owen.adminArea.settings.login.setLoginRequired(true);
    await owen.adminArea.settings.clickSaveAll();
  });

  it("Now Maria needs to create an account", async () => {
    await maria.loginDialog.refreshUntilFullScreen();
  });

  it("... she creates an account", async () => {
    await maria.loginDialog.createPasswordAccount(maria);
  });

  it("... clicks an email confirmation link", async () => {
    const link = await server.waitAndGetLastVerifyEmailAddressLinkEmailedTo(siteId, maria.emailAddress);
    await maria.go2(link);
  });

  it("... and can see the homepage again", async () => {
    await maria.go2(siteUrl);
    await maria.assertPageTitleMatches(forumTitle);
  });

  it("... and the new organization name, on the ToU page", async () => {
  });

  it("Owen leaves the admin area, goes back to the forum", async () => {
    await owen.adminArea.clickLeaveAdminArea();
    await owen.assertPageTitleMatches(forumTitle);
  });

  it("... he edits the forum title", async () => {
    await owen.pageTitle.clickEdit();
    await owen.pageTitle.editTitle(editedForumTitle);
    await owen.pageTitle.save();
    await owen.assertPageTitleMatches(editedForumTitle);
  });

  it("... and the forum intro text", async () => {
    await owen.forumButtons.clickEditIntroText();
    await owen.editor.editText(newIntroText);
    await owen.editor.save();
    await owen.waitAndAssertVisibleTextMatches('.esForumIntro', newIntroText);
  });

  it("... opens the Welcome topic", async () => {
    await owen.forumTopicList.goToTopic("Welcome");
  });

  it("... edits title and text", async () => {
    await owen.topic.clickEditOrigPost();
    await owen.editor.editText(newWelcomeTopicText);
    await owen.editor.save();
    await owen.pageTitle.clickEdit();
    await owen.pageTitle.editTitle(newWelcomeTopicTitle);
    await owen.pageTitle.save();
    await owen.assertPageTitleMatches(newWelcomeTopicTitle);
  });

  it("... returns to the forum", async () => {
    await owen.topic.clickHomeNavLink();
  });

  it("... views categories", async () => {
    await owen.forumButtons.clickViewCategories();
  });

  it("... creates a category", async () => {
    await owen.forumButtons.clickCreateCategory();
    await owen.categoryDialog.fillInFields({ name: newCategoryName });
    await owen.categoryDialog.submit();
  });

  it("... and a topic in that category", async () => {
    await owen.forumCategoryList.openCategory(newCategoryName);
    await owen.complex.createAndSaveTopic({ title: newTopicTitle, body: newTopicText });
  });

  it("... returns to the topic list", async () => {
    await owen.topic.clickHomeNavLink();
  });

  it("Now both Owen and Maria see all changes Owen did", async () => {
    await maria.refresh2();
    await maria.assertPageTitleMatches(editedForumTitle);
    await owen.assertPageTitleMatches(editedForumTitle);
    // ...
  });

  it("Maria creates a topic", async () => {
    await maria.complex.createAndSaveTopic({ title: mariasTopicTitle, body: mariasTopicText });
  });

  // This is for email + password users. [7LERTA1]
  it("Owen gets a notification (site owners get notified about everything)", async () => {
    await server.waitUntilLastEmailMatches(
        siteId, owen.emailAddress, [mariasTopicTitle, mariasTopicText], browser);
  });

});

