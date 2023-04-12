/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert from '../utils/ty-assert';
import server from '../utils/server';
import { buildSite } from '../utils/site-builder';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';

let allBrowsers: TyAllE2eTestBrowsers;
let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let owen: Member;
let owen_brA: TyE2eTestBrowser;
let modya: Member;
let modya_brB: TyE2eTestBrowser;
let corax: Member;
let corax_brB: TyE2eTestBrowser;
let regina: Member;
let regina_brB: TyE2eTestBrowser;
let michael: Member;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoPagesTestForum;

let michaelsTopicUrl: St;



describe(`may-see-email-adrs.2br.d.  TyTSEEEMLADRS01`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "Some E2E Test",
      members: ['owen', 'modya', 'corax', 'regina', 'maria', 'michael'],
    });

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;

    modya = forum.members.modya;
    modya_brB = brB;
    corax = forum.members.corax;
    corax_brB = brB;
    regina = forum.members.regina;
    regina_brB = brB;
    michael = forum.members.michael;
    stranger_brB = brB;

    assert.refEq(builder.getSite(), forum.siteData);
  });

  it(`Import site`, async () => {
    site = await server.importSiteData(forum.siteData);
    await server.skipRateLimits(site.id);
    michaelsTopicUrl = site.origin + '/' + forum.topics.byMichaelCategoryA.slug;
  });


  it(`Owen goes to the moderators' permissions page, ... `, async () => {
    await owen_brA.adminArea.goToUsersEnabled(site.origin);
    await owen_brA.userProfilePage.openPermissionsFor('moderators');
  });
  it(`... he may not access that page`, async () => {
    await owen_brA.waitForTextVisibleAssertMatches('.e_May0', /TyE0SEEGRPPRMS/);  // atm
    assert.not(await owen_brA.isDisplayed('.s_PP_PrmsTb'));
  });

  it(`Owen logs in`, async () => {
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });
  it(`... now he sees the permission settings`, async () => {
    await owen_brA.waitForGone('.e_May0');
    await owen_brA.userProfilePage.permissions.waitUntilLoaded();
    // ttt
    assert.that(await owen_brA.userProfilePage.permissions.canGrantMaySeeEmailAdrs());
  });


  it(`A stranger arrives`, async () => {
    await stranger_brB.go2(michaelsTopicUrl);
  });
  it(`... cannot see anyone's email addr`, async () => {
    await stranger_brB.pageTitle.openAboutAuthorDialog();
    assert.deepEq(await stranger_brB.aboutUserDialog.getGroupNames(), ["Basic Members"]);  // atm
    assert.eq(await stranger_brB.aboutUserDialog.getEmailAdrOrNull(), null);  // atm
    await stranger_brB.aboutUserDialog.close();
  });


  it(`Modya logs in`, async () => {
    await modya_brB.complex.loginWithPasswordViaTopbar(modya);
  });
  it(`Modya cannot see Mihael's complete email addr`, async () => {
    await modya_brB.pageTitle.openAboutAuthorDialog();
    // Wait until groups listed ...
    assert.deepEq(await modya_brB.aboutUserDialog.getGroupNames(), ["Basic Members"]);
    // ... then, pat's email adr would also have appeared, if it got loaded.
    // This'll be like:  '...@example.com' because mods can always see the email domain.
    assert.eq(await modya_brB.aboutUserDialog.getEmailAdrOrNull(),
          michael.emailAddress.replace(/.*@/, '...@'));  // atm
  });

  it(`Owen grants mods the permission to view everyone's email addrs`, async () => {
    await owen_brA.userProfilePage.permissions.setMaySeeEmailAdrs(true);  // atm
    await owen_brA.userProfilePage.permissions.save();
  });
  it(`... now Modya can see Mihaels email addr`, async () => {
    await modya_brB.refresh2();
    await modya_brB.pageTitle.openAboutAuthorDialog();
    assert.deepEq(await modya_brB.aboutUserDialog.getGroupNames(), ["Basic Members"]);
    assert.eq(await modya_brB.aboutUserDialog.getEmailAdrOrNull(), michael.emailAddress);
    // +  /-/users/michael/preferences/about
    // +  /-/users/michael/preferences/account
    await modya_brB.aboutUserDialog.close();
  });


  it(`Modya leaves, Corax logs in`, async () => {
    await modya_brB.topbar.clickLogout();
    await corax_brB.complex.loginWithPasswordViaTopbar(corax);
  });
  it(`Corax cannot see Mihaels email addr`, async () => {
    await corax_brB.pageTitle.openAboutAuthorDialog();
    assert.deepEq(await corax_brB.aboutUserDialog.getGroupNames(), ["Basic Members"]);
    assert.eq(await corax_brB.aboutUserDialog.getEmailAdrOrNull(), null);
  });

  it(`Owen navigates to the Core Members group, permissions tab`, async () => {
    await owen_brA.topbar.clickBackToGroups();
    await owen_brA.groupListPage.openGroupWithUsername('core_members');
    await owen_brA.userProfilePage.tabs.switchToPermissions();  // atm
  });

  it(`Owen grants core members the view email addrs permission, too`, async () => {
    await owen_brA.userProfilePage.permissions.setMaySeeEmailAdrs(true);
    await owen_brA.userProfilePage.permissions.save();
  });
  it(`... now Corax can see Mihaels email addr`, async () => {
    await corax_brB.refresh2();
    await corax_brB.pageTitle.openAboutAuthorDialog();
    assert.deepEq(await corax_brB.aboutUserDialog.getGroupNames(), ["Basic Members"]);
    assert.eq(await corax_brB.aboutUserDialog.getEmailAdrOrNull(), michael.emailAddress);
    await corax_brB.aboutUserDialog.close();
  });

  it(`Corax leaves, Regina logs in`, async () => {
    await corax_brB.topbar.clickLogout();
    await regina_brB.complex.loginWithPasswordViaTopbar(regina);
  });
  it(`Regina cannot see Mihaels addr — she's not a core member`, async () => {
    await regina_brB.pageTitle.openAboutAuthorDialog();
    assert.deepEq(await regina_brB.aboutUserDialog.getGroupNames(), ["Basic Members"]);
    assert.eq(await regina_brB.aboutUserDialog.getEmailAdrOrNull(), null);  // fok
  });

  it(`Owen navigates to the Regular Members group, permissions tab`, async () => {
    await owen_brA.topbar.clickBackToGroups();
    await owen_brA.groupListPage.openGroupWithUsername('regular_members');
    await owen_brA.userProfilePage.tabs.switchToPermissions();
  });
  it(`... he can *not* grant the see-email-adrs permissions —
            only Core Members and Moderators can be granted that permission`, async () => {
    assert.not(await owen_brA.userProfilePage.permissions.canGrantMaySeeEmailAdrs());  // atm
  });


});

