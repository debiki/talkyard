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
let stranger_brA: TyE2eTestBrowser;
let stranger_brB: TyE2eTestBrowser;

let site: IdAddress;
let forum: TwoPagesTestForum;

let michaelsTopicUrl: St;



describe(`may-see-email-adrs.2br.d  TyTSEEEMLADRS01`, () => {

  it(`Construct site`, async () => {
    const builder = buildSite();
    forum = builder.addTwoPagesForum({
      title: "May see email addrs E2E Test",
      members: ['owen', 'modya', 'corax', 'regina', 'maria', 'michael'],
    });

    allBrowsers = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');

    owen = forum.members.owen;
    owen_brA = brA;
    stranger_brA = brA;

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


  // ----- Strangers can't see others' email addrs

  it(`A stranger arrives`, async () => {
    await stranger_brB.go2(michaelsTopicUrl);
  });

  addCanSeeEmailAdrTestSteps(`The stranger`, `can't`, function() { return {
          br: stranger_brB, expectedAdr: () => null }});


  // ----- Strangers can't access group permission tabs

  it(`A stranger goes to the moderators' permissions page, ... `, async () => {
    await stranger_brB.adminArea.goToUsersEnabled(site.origin);
    await stranger_brB.userProfilePage.openPermissionsFor('moderators');
  });
  it(`... hen may not access that tab  TyT0ACCESSPERMS04`, async () => {
    await stranger_brB.waitForDisplayed('.c_BadRoute');
    assert.not(await stranger_brB.isDisplayed('.s_PP_PrmsTb'));
  });


  // ----- Moderators also cannot

  it(`Moderator Modya logs in`, async () => {
    await modya_brB.complex.loginWithPasswordViaTopbar(modya);
  });
  it(`... also cannot access the perms tab (although is mod)  TyT0ACCESSPERMS04`, async () => {
    await stranger_brB.waitForDisplayed('.c_BadRoute');
    assert.not(await stranger_brB.isDisplayed('.s_PP_PrmsTb'));
  });


  // ----- Admins can

  it(`Owen logs in`, async () => {
    await owen_brA.complex.loginWithPasswordViaTopbar(owen);
  });
  it(`... now he sees the permission tab  TyT0ACCESSPERMS04`, async () => {
    await owen_brA.waitForGone('.c_BadRoute');
    await owen_brA.userProfilePage.permissions.waitUntilLoaded();
  });
  it(`... and can configure may-see-email-addrs  TyTCANCONFSEEML`, async () => {
    assert.that(await owen_brA.userProfilePage.permissions.canGrantMaySeeEmailAdrs());
  });


  // ----- Moderators can see others' email domains

  // But not the local part.

  it(`Modya goes to Michael's page`, async () => {
    await modya_brB.go2(michaelsTopicUrl);
  });

  addCanSeeEmailAdrTestSteps(`Modya`, 'can', function() { return {
          br: modya_brB, expectedAdr: () => michael.emailAddress, localPartIsDots: true }});


  // ----- Admins can let Mods see whole addresses

  it(`Owen grants mods permission to see everyone's email addrs  TyTCANCONFSEEML`, async () => {
    await owen_brA.userProfilePage.permissions.setMaySeeEmailAdrs(true);
    await owen_brA.userProfilePage.permissions.save();
  });

  it(`Modya reloads the page ...`, async () => {
    await modya_brB.refresh2();
  });

  addCanSeeEmailAdrTestSteps(`Modya`, `can now`, function() { return {
          br: modya_brB, expectedAdr: () => michael.emailAddress }});


  // ----- Admins can let Core Members see whole addresses

  it(`Modya leaves, Corax logs in`, async () => {
    await modya_brB.topbar.clickLogout();
    await corax_brB.complex.loginWithPasswordViaTopbar(corax);
  });

  addCanSeeEmailAdrTestSteps(`Corax`, `cannot `, function() { return {
          br: corax_brB, expectedAdr: () => null }});

  it(`Owen navigates to the Core Members' permissions tab  TyT0ACCESSPERMS04`, async () => {
    await owen_brA.topbar.clickBackToGroups();
    await owen_brA.groupListPage.openGroupWithUsername('core_members');
    await owen_brA.userProfilePage.tabs.switchToPermissions();
  });

  it(`Owen grants core members the view email addrs permission, too`, async () => {
    await owen_brA.userProfilePage.permissions.setMaySeeEmailAdrs(true);
    await owen_brA.userProfilePage.permissions.save();
  });
  it(`Corax reloads the page ...`, async () => {
    await corax_brB.refresh2();
  });

  addCanSeeEmailAdrTestSteps(`Corax`, `can now `, function() { return {
          br: corax_brB, expectedAdr: () => michael.emailAddress }});


  // ----- Others can never see others' email addrs

  it(`Corax leaves, Regina logs in`, async () => {
    await corax_brB.topbar.clickLogout();
    await regina_brB.complex.loginWithPasswordViaTopbar(regina);
  });

  addCanSeeEmailAdrTestSteps(`Regina isn't a core member, `, `cannot `, function() { return {
          br: regina_brB, expectedAdr: () => null }});

  it(`Owen navigates to the Regular Members group, permissions tab`, async () => {
    await owen_brA.topbar.clickBackToGroups();
    await owen_brA.groupListPage.openGroupWithUsername('regular_members');
    await owen_brA.userProfilePage.tabs.switchToPermissions();
  });
  it(`... he can *not* grant the see-email-adrs permission —   TyTCANCONFSEEML
            only Core Members and Moderators can be granted that permission`, async () => {
    assert.not(await owen_brA.userProfilePage.permissions.canGrantMaySeeEmailAdrs());
  });


  // ----- /End.


  function addCanSeeEmailAdrTestSteps(who: St, canOrNot: St,
          ps: () => { br: TyE2eTestBrowser, expectedAdr: () => St | N, localPartIsDots?: true }) {

    const expectedAdr = () => {
      let adr = ps().expectedAdr();
      // This'll be like:  '...@example.com' because mods can always see the email domain.
      if (ps().localPartIsDots) return adr.replace(/.*@/, '...@');  // TyTHIDELOCALEMLPART
      else return adr;
    }

    // (Ok although ps().br is still undefined)
    const butNotTheLocalPart = ps().localPartIsDots ?
            ` — but not the local part, it's been replaced by '...'` : '';

    it(`${who} sees that Michaels is in the Basic Members group  TyTSEEPATSGROUPS`, async () => {
      await ps().br.pageTitle.openAboutAuthorDialog();
      assert.deepEq(await ps().br.aboutUserDialog.getGroupNames(), ["Basic Members"]);
    });

    it(`${who} ${canOrNot} see Michaels email addr in the about user dialog  TyTABOUTBOXEML` +
            butNotTheLocalPart, async () => {
      assert.eq(await ps().br.aboutUserDialog.getEmailAdrOrNull(), expectedAdr());
      if (expectedAdr() === null) {
        await ps().br.waitForExist('.s_UD .e_0Em');
      }
    });

    // One's email address is shown on one's profile page, at two places, as well.
    // The first is /-/users/michael/preferences/about:
    it(`... goes to Michael's profile page`, async () => {
      await ps().br.aboutUserDialog.clickViewProfile();
    });

    it(`... ${canOrNot} see Michael's preferences tab link  TyT0ACSPREFS01`, async () => {
      // Then there's nothing this user can see in the preferences tab, and the switch-
      // -to-tab nav should be gone.
      assert.eq(await ps().br.userProfilePage.tabs.isPreferencesTabDisplayed(),
              expectedAdr() !== null);
    });
    it(`... ${canOrNot} see Michael's email addr in that tab`, async () => {
      if (expectedAdr() === null) {
        // If going there anyway, there should be an error.
        // One is /-/users/michael/preferences/about:
        await ps().br.userProfilePage.preferences.goHere('michael');
        await ps().br.waitForDisplayed('.c_BadRoute');
      }
      else {
        await ps().br.userProfilePage.tabs.switchToPreferences();
        const primaryAdr = await ps().br.userProfilePage.preferences.getPrimaryEmailAdr();
        assert.eq(primaryAdr, expectedAdr());
      }
    });

    // TESTS_MISSING: Verify local part replaced by '...' (like so: '...@ex.co')
    // also on the accounts sub tab. Not that interesting though, so can wait — currently
    // that tab throws a may-not-see-email-addr exception if one may not. UX fix.
    if (butNotTheLocalPart) {
      it(`... UNIMPL when cannot see local part:  goes to Michael's account tab`, async () => {
        await ps().br.topbar.clickBack();
      });
      return;
    }

    // The second is /-/users/michael/preferences/account:
    it(`... ${canOrNot} goes to Michael's account tab`, async () => {
      if (expectedAdr() === null) {
        await ps().br.userProfilePage.preferences.emailsLogins.goHere('michael');
      }
      else {
        await ps().br.userProfilePage.preferences.tabs.switchToAccount();
      }
    });
    it(`... ${canOrNot} see Michaels email addr`, async () => {
      if (expectedAdr() === null) {
        await ps().br.waitForDisplayed('.c_BadRoute');
      }
      else {
        const adrs: St[] =
                await ps().br.userProfilePage.preferences.emailsLogins.getAllEmailAddresses();
        assert.deepEq(adrs, [expectedAdr()]);
      }
    });

    it(`${who} clicks Back, returns to the discussion page`, async () => {
      await ps().br.topbar.clickBack();
    });
  }

});

