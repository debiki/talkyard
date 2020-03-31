/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('../utils/ty-assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import pagesFor = require('../utils/pages-for');
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');
import c = require('../test-constants');

declare var browser: any;

var owen;
var maria;

var idAddress;
var forumTitle = "Impersonate Each Other Forum";


describe("impersonate-restricted-areas  TyT6502PKSNR57", () => {

  it("initialize people", () => {
    owen = _.assign(browser, pagesFor(browser), make.memberOwenOwner());
  });

  it("import a site", () => {
    var site: SiteData = make.forumOwnedByOwen('impers-others', { title: forumTitle });
    maria = make.memberMaria();
    site.members.push(maria);
    idAddress = server.importSiteData(site);
    _.assign(owen, make.memberOwenOwner());
  });

  it("Owen logs in to the admin area", () => {
    owen.adminArea.goToUsersEnabled(idAddress.origin);
    owen.loginDialog.loginWithPassword(owen);
  });

  it("... opens Maria's profile", () => {
    owen.waitForThenClickText('.dw-username', maria.username);
  });


  // ----- Access restricted area, when impersonating someone

  let mariaInAdminAreaUrl: string;

  it("Owen impersonates Maria", () => {
    owen.topbar.assertMyUsernameMatches(owen.username);
    mariaInAdminAreaUrl = owen.urlPath();
    owen.adminArea.user.assertUsernameIs(maria.username);
    owen.adminArea.user.startImpersonating();
  });

  let afterImpClickUrl: string;

  it("... the browser jumped to the homepage", () => {
    owen.assertPageTitleMatches(forumTitle);
    afterImpClickUrl = owen.urlPath();
  });

  it("... and he's now logged in as Maria", () => {
    owen.topbar.assertMyUsernameMatches(maria.username);
  });

  it("Owen goes to the Admin Area, as Maria", () => {
    owen.adminArea.goToUsersEnabled();
  });

  it("... sees an Access Denied message", () => {
    waitForAccessDenied();
  });

  it("... and a Back button", () => {
    assert.ok(isBackButtonVisible());  // this tests the test
  });

  it("Owen clicks Back", () => {
    assert.notEq(owen.urlPath(), afterImpClickUrl);
    owen.repeatUntilAtNewUrl(() => {
      clickBack();
    });
  });

  it("... which takes him back to the previous page", () => {
    assert.eq(owen.urlPath(), afterImpClickUrl);
  });

  it("... that page works fine: Owen sees Maria's username", () => {
    owen.topbar.assertMyUsernameMatches(maria.username);
  });

  it("Owen goes to the Admin Area, as Maria,  *again*!  — *what* is he up to?", () => {
    owen.adminArea.goToUsersEnabled();
  });

  it("... then stops impersonating    — at last!", () => {
    stopImpersonating();
  });

  it("Now he can access the Admin Area agan", () => {
    owen.adminArea.waitAssertVisible();
  });

  it("... he's in the Users | Enabled admin area section", () => {
    assert.eq(owen.urlPath(), "/-/admin/users/enabled");
  });

  it("... he's Owen again", () => {
    owen.topbar.assertMyUsernameMatches(owen.username);
  });

  it("... he reloads the page, is still in the Admin Area", () => {
    owen.refresh();
    owen.adminArea.waitAssertVisible();
  });

  it("... he's still Owen", () => {
    owen.topbar.waitForVisible();
    owen.topbar.assertMyUsernameMatches(owen.username);
  });



  // ----- Impersonate when Login Required,  and user *suspended*

  // Don't want the admin to get locked out somehow.

  it("Owen goes to the login settings", () => {
    owen.adminArea.settings.login.goHere();
  });

  it("... enables Require Login", () => {
    owen.adminArea.settings.login.setLoginRequired(true);
  });

  it("... saves", () => {
    owen.adminArea.settings.clickSaveAll();
  });

  it("Owen suspends Maria", () => {
    owen.go2(mariaInAdminAreaUrl);
    owen.adminArea.user.assertUsernameIs(maria.username);
    owen.adminArea.user.suspendUser();
  });

  it("... impersonates Maria again", () => {
    owen.adminArea.user.startImpersonating();
  });

  it("Now, since Maria is suspended, there's an access denied message", () => {
    waitForAccessDenied();
  });

  it("... but there's no Back button, since last page was the Admin Area", () => {
    assert.not(isBackButtonVisible());
  });

  it("Owen stops impersonating", () => {
    stopImpersonating();
  });

  it("... becomes Owen again", () => {
    owen.topbar.assertMyUsernameMatches(owen.username);
  });

  it("... goes to Maria's profile in the Admin Area agan", () => {
    owen.go2(mariaInAdminAreaUrl);
    owen.adminArea.waitAssertVisible();
  });


  // ----- Impersonate when Login Required,  user *not* suspended

  it("Owen unsuspends Maria", () => {
    owen.adminArea.user.assertUsernameIs(maria.username);
    owen.adminArea.user.unsuspendUser();
  });

  it("... impersonates Maria again", () => {
    owen.adminArea.user.startImpersonating();
  });

  it("... now he is Maria", () => {
    assert.eq(owen.urlPath(), afterImpClickUrl);
    owen.topbar.assertMyUsernameMatches(maria.username);
  });

  it("Owen goes to the Admin Area, as Maria, to view Maria's profile", () => {
    owen.go2(mariaInAdminAreaUrl);
  });

  it("... sees an Access Denied message (because Maria cannot access the Admin Area)", () => {
    waitForAccessDenied();
  });

  it("... and the Back button", () => {
    assert.ok(isBackButtonVisible());
  });

  it("... stops impersonating", () => {
    stopImpersonating();
  });

  it("... becomes Owen again", () => {
    owen.topbar.assertMyUsernameMatches(owen.username);
  });

  it("... he can access the Admin Area agan, Maria's profile", () => {
    owen.adminArea.waitAssertVisible();
    owen.adminArea.user.assertUsernameIs(maria.username);
  });


  // ----- Impersonate a suspended user, login *not* required

  it("Owen goes to the login settings", () => {
    owen.adminArea.settings.login.goHere();
  });

  it("... disables Require Login", () => {
    owen.adminArea.settings.login.setLoginRequired(false);
  });

  it("... saves", () => {
    owen.adminArea.settings.clickSaveAll();
  });

  it("... suspends Maria again", () => {
    owen.go2(mariaInAdminAreaUrl);
    owen.adminArea.user.suspendUser();
  });

  it("... impersonates Maria again", () => {
    owen.adminArea.user.startImpersonating();
  });

  it("... since Maria suspended, Owen now impersonates a Stranger. Well, whatever", () => {
    // Don't know what makes the most sense here. Becoming a Stranger feels fairly ok.
    waitForIsStranger();
  });

  it("Owen tries to go to Maria's page in the Admin Area", () => {
    owen.go2(mariaInAdminAreaUrl);
  });

  it("... access denied", () => {
    waitForAccessDenied();
  });

  it("Owen clicks Stop Impersonating", () => {
    stopImpersonating();
  });

  it("... sees Maria's page again", () => {
    owen.adminArea.waitAssertVisible();
    owen.adminArea.user.assertUsernameIs(maria.username);
  });

  it("... he's back as Owen", () => {
    owen.topbar.assertMyUsernameMatches(owen.username);
  });



  it("Owen phones Maria, tells her she shouldn't have tried to access the Admin Area", () => {
    // to-do
  });


  function isBackButtonVisible(): boolean {
    return owen.isVisible('.e_ImpBackB');
  }

  function clickBack() {
    owen.waitAndClick('.e_ImpBackB');
  }

  function waitForAccessDenied() {
    owen.waitForVisible('.e_ImpFrbdn');
  }

  function stopImpersonating() {
    owen.waitAndClick('.e_ImpStopB');
  }

  function waitForIsStranger() {
    owen.waitForVisible('.s_MMB-IsImp-Stranger');
  }

});

