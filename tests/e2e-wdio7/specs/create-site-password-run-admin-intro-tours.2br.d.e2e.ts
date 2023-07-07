/// <reference path="../test-types.ts"/>

import server from '../utils/server';
import * as utils from '../utils/utils';
import { TyE2eTestBrowser } from '../utils/ty-e2e-test-browser';
import c from '../test-constants';

let browser: TyE2eTestBrowser;

const newMembersEmail = 'e2e-test--mia@example.com';
const newMembersTopicTitle = 'newMembersTopicTitle';
const newMembersTopicText = 'newMembersTopicText';


describe('create-site-password  @createsite @login @password  TyT7BAWFPK9', () => {

  it('initialize', async () => {
    browser = new TyE2eTestBrowser(wdioBrowserA, 'brA');
  });

  let data: NewSiteData | U;

  it('Create site', async () => {
    // Something timed out in here, twice. [E2EBUG]
    // Break up into smaller steps then? To find out what.
    data = utils.generateNewSiteData();
    await browser.go2(utils.makeCreateSiteWithFakeIpUrl());
    await browser.disableRateLimits();
    await browser.createSite.fillInFieldsAndSubmit(data);
    // New site; disable rate limits here too.
    await browser.disableRateLimits();
  });

  it('Signup as owner with a password account', async () => {
    await browser.createSite.clickOwnerSignupButton();
    await browser.loginDialog.createPasswordAccount(data, true);
    const siteId = await browser.getSiteId();
    const email = await server.getLastEmailSenTo(siteId, data.email, wdioBrowserA);
    const link = utils.findFirstLinkToUrlIn(
        data.origin + '/-/login-password-confirm-email', email.bodyHtmlText);
    await browser.go2(link);
    await browser.waitAndClick('#e2eContinue');

    await browser.tour.runToursAlthoughE2eTest();
  });

  it('create forum', async () => {
    await browser.createSomething.createForum("Password Forum Title");
  });

  it("the forum admin tour works", async () => {
    await browser.tour.assertTourStarts(true);
    console.log('Step 1');
    await browser.waitAndClick('.s_Tour-Step-1 .s_Tour_D_Bs_NextB');
    console.log('Step 2');
    await browser.waitAndClick('.s_Tour-Step-2 .s_Tour_D_Bs_NextB');
    console.log('Step 3');
    await browser.waitAndClick('.s_Tour-Step-3 .s_Tour_D_Bs_NextB');
    console.log('Step 4');
    await browser.waitForDisplayed('.s_Tour-Step-4 .s_Tour_Highlight');
    await browser.waitAndClick('#e_ViewCatsB');
    console.log('Step 5');
    await browser.waitAndClick('.s_Tour-Step-5 .s_Tour_D_Bs_NextB');
    console.log('Step 6');
    await browser.waitForDisplayed('.s_Tour-Step-6 .s_Tour_Highlight');
    await browser.waitAndClick('.esAvtrName_name');
    console.log('Step 7');
    await browser.waitAndClick('.s_Tour-Step-7 .s_Tour_D_Bs_NextB');
  });

  it("Closes the my-menu dropdown, goes to the topic list again", async () => {
    await browser.clickBackdrop();
    await browser.forumButtons.viewTopics();
  });

  it("The tour won't restart", async () => {
    await browser.tour.assertTourStarts(false);
  });

  it("Owen goes to the admin area", async () => {
    await browser.topbar.clickGoToAdmin();
  });

  it("the admin area admin tour works", async () => {
    console.log('Step 1');
    await browser.waitAndClick('.s_Tour-Step-1 .s_Tour_D_Bs_NextB');
    console.log('Step 2');
    await browser.waitAndClick('#e2eAA_Ss_LoginL');
    console.log('Step 3');
    await browser.waitAndClick('.s_Tour-Step-3 .s_Tour_D_Bs_NextB');
    console.log('Step 4');
    await browser.waitAndClick('.e_UsrsB');
    console.log('Step 5');
    await browser.waitAndClick('.e_InvitedUsB');
    console.log('Step 6');
    await browser.waitAndClick('.s_Tour-Step-6 .s_Tour_D_Bs_NextB');
    console.log('Step 7');
    await browser.waitAndClick('.s_Tour-Step-7 .s_Tour_D_Bs_NextB');
  });

  // Done with create site stuff. But let's test a little bit more, so we know the forum can
  // actually be used, once it's been created: Edit forum title and post a topic.

  it("goes back to the topic list", async () => {
    await browser.go2('/');
  });

  it("closes the contextbar — otherwise sometimes overlaps the title", async () => {
    await browser.contextbar.close();
  });

  it("the forum works: Owen can edit forum title", async () => {
    // --- Edit title
    await browser.pageTitle.clickEdit();
    await browser.pageTitle.editTitle("Pwd Frm Edtd");
    await browser.pageTitle.save();
    await browser.assertPageTitleMatches(/Pwd Frm Edtd/);
  });

  it("the forum works: can post a topic", async () => {
    await browser.forumButtons.clickCreateTopic();
    await browser.editor.editTitle("New topic title");
    await browser.editor.editText("New topic text, so many chars 303456789012345678901234568901");
    await browser.rememberCurrentUrl();
    await browser.editor.clickSave();
    await browser.waitForNewUrl();
    await browser.topic.waitUntilPostTextMatches(c.TitleNr, /New topic title/);
    await browser.topic.assertPostTextMatches(c.BodyNr, /New topic text/);
  });


  it("the forum intro tour is shown just once", async () => {
    await browser.go2('/');
    await browser.tour.assertTourStarts(false);
  });

  it("... and the admin area tour, just once, it too", async () => {
    await browser.topbar.clickGoToAdmin();
    await browser.tour.assertTourStarts(false);
  });

});

