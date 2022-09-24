/// <reference path="../test-types.ts"/>

import * as _ from 'lodash';
import server from '../utils/server';
import * as make from '../utils/make';
import { TyE2eTestBrowser, TyAllE2eTestBrowsers } from '../utils/ty-e2e-test-browser';

let brA: TyE2eTestBrowser;
let brB: TyE2eTestBrowser;
let brC: TyE2eTestBrowser;

let everyone: TyAllE2eTestBrowsers;
let owen; // : MemberBrowser;
let michael; // : MemberBrowser;
let maria; // : MemberBrowser;

let idAddress;
const forumTitle = "Login to Read Forum";


describe(`settings-toggle-login-required.3br.d  TyT4GKBW20`, () => {

  it("initialize people", async () => {
    everyone = new TyE2eTestBrowser(allWdioBrowsers, 'brAll');
    brA = new TyE2eTestBrowser(wdioBrowserA, 'brA');
    brB = new TyE2eTestBrowser(wdioBrowserB, 'brB');
    brC = new TyE2eTestBrowser(wdioBrowserC, 'brC');

    owen = _.assign(brA, make.memberOwenOwner());
    michael = _.assign(brB, make.memberMichael());
    maria = _.assign(brC, make.memberMaria());
    // SECURITY COULD test that login-as-guest cannot be combined with login-to-read?
  });

  it("import a site", async () => {
    var site: SiteData = make.forumOwnedByOwen('login-to-read', { title: forumTitle });
    site.members.push(make.memberMichael());
    site.members.push(make.memberMaria());
    idAddress = await server.importSiteData(site);
  });

  it("Owen, Maria and Michael sees the forum, when not logged in", async () => {
    await everyone.go2(idAddress.origin);
    await owen.assertPageTitleMatches(forumTitle);
    await michael.assertPageTitleMatches(forumTitle);
    await maria.assertPageTitleMatches(forumTitle);
  });

  it("Owen logs in to admin area", async () => {
    await owen.adminArea.goToLoginSettings(idAddress.origin);
    await owen.loginDialog.loginWithPassword(owen);
  });

  it("...and enables login-required", async () => {
    await owen.adminArea.settings.login.setLoginRequired(true);
    await owen.adminArea.settings.clickSaveAll();
  });

  it("Maria and Michael see the login dialog only", async () => {
    await owen.refresh2();
    await owen.adminArea.waitAssertVisible();
    await maria.loginDialog.refreshUntilFullScreen();
    await michael.loginDialog.refreshUntilFullScreen();
  });

  it("Maria logs in, sees homepage again", async () => {
    await maria.loginDialog.loginWithPassword(maria);
    await maria.assertPageTitleMatches(forumTitle);
  });

  var mariasTopicUrl;
  var mariasTopicTitle = "Marias Topic";

  it("... and can posts a forum topic", async () => {
    await maria.complex.createAndSaveTopic({ title: mariasTopicTitle, body: "Marias text." });
    mariasTopicUrl = await maria.getUrl();
  });

  it("Michael only sees the login dialog, when he goes to the forum topic url", async () => {
    await michael.go2(mariasTopicUrl);
    await michael.loginDialog.waitAssertFullScreen();
  });

  it("Maria logs out, then she no longer sees her topic or the homepage", async () => {
    await maria.topbar.clickLogout({ waitForLoginButton: false });
    await maria.loginDialog.waitAssertFullScreen();
    await maria.go2(idAddress.origin);
    await maria.loginDialog.waitAssertFullScreen();
  });

  it("Owen disables login required", async () => {
    await owen.adminArea.settings.login.setLoginRequired(false);
    await owen.adminArea.settings.clickSaveAll();
  });

  it("Now Michael sees the pages again", async () => {
    await michael.refresh2();
    await michael.assertPageTitleMatches(mariasTopicTitle);
    await michael.go2(idAddress.origin);
    await michael.assertPageTitleMatches(forumTitle);
  });

  it("And Maria too", async () => {
    await maria.refresh2();
    await maria.assertPageTitleMatches(forumTitle);
  });

});

