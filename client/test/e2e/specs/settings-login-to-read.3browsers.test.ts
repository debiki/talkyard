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
var everyonesPages;
var owen;
var owensPages;
var michael;
var michaelsPages;
var maria;
var mariasPages;

var idAddress;
var forumTitle = "Login to Read Forum";


describe("settings-login-to-read", function() {

  it("initialize people", function() {
    everyone = browser;
    everyonesPages = pagesFor(everyone);
    owen = browserA;
    owensPages = pagesFor(owen);
    michael = browserB;
    michaelsPages = pagesFor(michael);
    maria = browserC;
    mariasPages = pagesFor(maria);
  });

  it("import a site", function() {
    var site: SiteData = make.forumOwnedByOwen('login-to-read', { title: forumTitle });
    site.members.push(make.memberMichael());
    site.members.push(make.memberMaria());
    idAddress = server.importSiteData(site);
  });

  it("Owen, Maria and Michael sees the forum, when not logged in", function() {
    everyone.go(idAddress.siteIdOrigin);
    everyone.assertPageTitleMatches(forumTitle);
  });

  it("Owen logs in to admin area", function() {
    owensPages.adminArea.goToLoginSettings(idAddress.siteIdOrigin);
    owensPages.loginDialog.loginWithPassword({ username: 'owen_owner', password: 'publicOwen' });
  });

  it("...and enables login-required", function() {
    owen.waitAndClick('#e2eLoginRequiredCB');
    owen.waitAndClick('.esA_SaveBar_SaveAllB');
  });

  it("Maria and Michael see the login dialog only", function() {
    everyone.refresh();
    owensPages.adminArea.waitAssertVisible();
    mariasPages.loginDialog.waitAssertFullScreen();
    michaelsPages.loginDialog.waitAssertFullScreen();
  });

  it("Maria logs in, sees homepage again", function() {
    mariasPages.loginDialog.loginWithPassword({ username: 'maria', password: 'publicMaria' });
    maria.assertPageTitleMatches(forumTitle);
  });

  var mariasTopicUrl;
  var mariasTopicTitle = "Marias Topic";

  it("... and can posts a forum topic", function() {
    mariasPages.complex.createAndSaveTopic({ title: mariasTopicTitle, body: "Marias text." });
    mariasTopicUrl = maria.url().value;
  });

  it("Michael only sees the login dialog, when he goes to the forum topic url", function() {
    michael.go(mariasTopicUrl);
    michaelsPages.loginDialog.waitAssertFullScreen();
  });

  it("Maria logs out, then she no longer sees her topic or the homepage", function() {
    mariasPages.topbar.clickLogout({ waitForLoginButton: false });
    mariasPages.loginDialog.waitAssertFullScreen();
    maria.go(idAddress.siteIdOrigin);
    mariasPages.loginDialog.waitAssertFullScreen();
  });

  it("Owen disables login required", function() {
    owen.waitAndClick('#e2eLoginRequiredCB');
    owen.waitAndClick('.esA_SaveBar_SaveAllB');
  });

  it("Now Michael sees the pages again", function() {
    michael.refresh();
    michael.assertPageTitleMatches(mariasTopicTitle);
    michael.go(idAddress.siteIdOrigin);
    michael.assertPageTitleMatches(forumTitle);
  });

  it("And Maria too", function() {
    maria.refresh();
    maria.assertPageTitleMatches(forumTitle);
  });

  it("Done", function() {
    everyone.perhapsDebug();
  });

});

