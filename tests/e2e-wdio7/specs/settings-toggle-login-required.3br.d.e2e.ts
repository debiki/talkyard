/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import assert = require('assert');
import server = require('../utils/server');
import utils = require('../utils/utils');
import { TyE2eTestBrowser, TyAllE2eTestBrowsers, MemberBrowser } from '../utils/pages-for';
import settings = require('../utils/settings');
import make = require('../utils/make');
import logAndDie = require('../utils/log-and-die');


let everyone: TyAllE2eTestBrowsers;
let owen: MemberBrowser;
let michael: MemberBrowser;
let maria: MemberBrowser;

let idAddress;
const forumTitle = "Login to Read Forum";


describe("settings-toggle-login-required [TyT4GKBW20]", function() {

  it("initialize people", function() {
    everyone = new TyE2eTestBrowser(wdioBrowser);
    owen = _.assign(new TyE2eTestBrowser(browserA), make.memberOwenOwner());
    michael = _.assign(new TyE2eTestBrowser(browserB), make.memberMichael());
    maria = _.assign(new TyE2eTestBrowser(browserC), make.memberMaria());
    // SECURITY COULD test that login-as-guest cannot be combined with login-to-read?
  });

  it("import a site", function() {
    var site: SiteData = make.forumOwnedByOwen('login-to-read', { title: forumTitle });
    site.members.push(make.memberMichael());
    site.members.push(make.memberMaria());
    idAddress = server.importSiteData(site);
  });

  it("Owen, Maria and Michael sees the forum, when not logged in", function() {
    everyone.go(idAddress.origin);
    owen.assertPageTitleMatches(forumTitle);
    michael.assertPageTitleMatches(forumTitle);
    maria.assertPageTitleMatches(forumTitle);
  });

  it("Owen logs in to admin area", function() {
    owen.adminArea.goToLoginSettings(idAddress.origin);
    owen.loginDialog.loginWithPassword(owen);
  });

  it("...and enables login-required", function() {
    owen.adminArea.settings.login.setLoginRequired(true);
    owen.adminArea.settings.clickSaveAll();
  });

  it("Maria and Michael see the login dialog only", function() {
    owen.refresh();
    owen.adminArea.waitAssertVisible();
    maria.loginDialog.refreshUntilFullScreen();
    michael.loginDialog.refreshUntilFullScreen();
  });

  it("Maria logs in, sees homepage again", function() {
    maria.loginDialog.loginWithPassword(maria);
    maria.assertPageTitleMatches(forumTitle);
  });

  var mariasTopicUrl;
  var mariasTopicTitle = "Marias Topic";

  it("... and can posts a forum topic", function() {
    maria.complex.createAndSaveTopic({ title: mariasTopicTitle, body: "Marias text." });
    mariasTopicUrl = maria.getUrl();
  });

  it("Michael only sees the login dialog, when he goes to the forum topic url", function() {
    michael.go(mariasTopicUrl);
    michael.loginDialog.waitAssertFullScreen();
  });

  it("Maria logs out, then she no longer sees her topic or the homepage", function() {
    maria.topbar.clickLogout({ waitForLoginButton: false });
    maria.loginDialog.waitAssertFullScreen();
    maria.go(idAddress.origin);
    maria.loginDialog.waitAssertFullScreen();
  });

  it("Owen disables login required", function() {
    owen.adminArea.settings.login.setLoginRequired(false);
    owen.adminArea.settings.clickSaveAll();
  });

  it("Now Michael sees the pages again", function() {
    michael.refresh();
    michael.assertPageTitleMatches(mariasTopicTitle);
    michael.go(idAddress.origin);
    michael.assertPageTitleMatches(forumTitle);
  });

  it("And Maria too", function() {
    maria.refresh();
    maria.assertPageTitleMatches(forumTitle);
  });

});

