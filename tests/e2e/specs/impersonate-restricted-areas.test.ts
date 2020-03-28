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

  it("... and clicks Impersonate", () => {
    owen.topbar.assertMyUsernameMatches(owen.username);
    owen.rememberCurrentUrl();
    owen.adminArea.user.startImpersonating();
    owen.waitForNewUrl();
  });

  it("... the browser jumped to the homepage", () => {
    owen.assertPageTitleMatches(forumTitle);
  });

  let urlPath;

  it("... and he's now logged in as Maria", () => {
    owen.topbar.assertMyUsernameMatches(maria.username);
    urlPath = owen.urlPath();
  });

  it("Owen goes to the Admin Area, as Maria", () => {
    owen.adminArea.goToUsersEnabled();
  });

  it("... sees an Access Denied message", () => {
    owen.waitForVisible('.e_ImpFrbdn');
  });

  it("Owen clicks Back", () => {
    assert.notEq(owen.urlPath(), urlPath);
    owen.repeatUntilAtNewUrl(() => {
      owen.waitAndClick('.e_ImpBackB');
    });
  });

  it("... which takes him back to the previous page", () => {
    assert.eq(owen.urlPath(), urlPath);
  });

  it("Owen goes to the Admin Area, as Maria,  *again*!  — *what* is he up to?", () => {
    owen.adminArea.goToUsersEnabled();
  });

  it("... then stops impersonating    — at last!", () => {
    owen.waitAndClick('.e_ImpStopB');
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

  it("Owen phones Maria, tells her she shouldn't have tried to access the Admin Area", () => {
    // to-do
  });

});

